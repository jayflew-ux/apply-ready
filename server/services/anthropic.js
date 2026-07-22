const Anthropic = require('@anthropic-ai/sdk');
const { recordUsage } = require('../lib/usage');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Tiered models — match cost to task value
const MODEL_PREMIUM = 'claude-fable-5';   // resume tailoring + cover letters (the deliverables)
const MODEL_STANDARD = 'claude-opus-4-8'; // scoring, questions, interview prep, debrief
const MODEL_FAST = 'claude-haiku-4-5';    // image text extraction, chatbot
const FALLBACK_MODEL = 'claude-opus-4-8';

// Fable 5 calls go through the beta endpoint so a safety-classifier decline
// automatically retries on Opus 4.8 in the same request. Other models use the
// standard endpoint.
async function createMessage(params) {
  const response = params.model === MODEL_PREMIUM
    ? await client.beta.messages.create({
        ...params,
        betas: ['server-side-fallback-2026-06-01'],
        fallbacks: [{ model: FALLBACK_MODEL }],
      })
    : await client.messages.create(params);

  recordUsage(response.usage);
  return response;
}

// Fable 5 always reasons internally, so responses can contain thinking blocks
// before the text block. Never read content[0] directly.
function extractText(response) {
  if (response.stop_reason === 'refusal') {
    throw new Error('The AI declined this request. Try rephrasing the job posting or resume content.');
  }
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) {
    throw new Error('The AI returned an empty response. Please try again.');
  }
  return textBlock.text;
}

const RECRUITER_SYSTEM = `You are a senior recruiter with 20 years of placement experience. You evaluate candidates honestly and specifically. The resume is canonical — you never invent a skill, metric, title, scope, or outcome the candidate has not documented. If a role requires something absent from the resume, you say so plainly. No fabrication, no bridges over gaps.

WRITING RULES for all output: no em dashes; complete grammatical sentences only, no fragments; warm, direct, and specific over generic; confident without boasting; no corporate jargon; no hollow inspiration; no templated openers.`;

function parseJSON(text) {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]);
    return JSON.parse(text);
  } catch {
    throw new Error('The AI returned an unexpected response. This usually means the job description is empty or unreadable. Please paste the job text manually instead of using a screenshot.');
  }
}

async function extractTextFromImage(imageBuffer, mimeType) {
  const base64 = imageBuffer.toString('base64');
  const response = await createMessage({
    model: MODEL_FAST,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        },
        {
          type: 'text',
          text: 'This is a screenshot of a job posting. Extract and return the full text content exactly as it appears — job title, company, location, requirements, responsibilities, and any other details. Return plain text only, no commentary.',
        },
      ],
    }],
  });
  return extractText(response).trim();
}

async function fitScore(resumeText, jobDescription) {
  const response = await createMessage({
    model: MODEL_STANDARD,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: RECRUITER_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `Return ONLY valid JSON matching this exact schema — no other text:
{
  "overall_score": <integer 0–100>,
  "category_scores": {
    "skills_match": <integer 0–100>,
    "experience_match": <integer 0–100>,
    "culture_values": <integer 0–100>,
    "trajectory_fit": <integer 0–100>
  },
  "why_this_score": "<3–5 honest sentences explaining the score>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "verdict": "<one of: I'd submit you | I'd coach you first, then submit | I wouldn't submit you for this role>",
  "verdict_reason": "<1–2 sentences explaining the verdict>"
}`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `RESUME:\n${resumeText}\n\n---\n\nJOB POSTING:\n${jobDescription}`,
      },
    ],
  });

  return parseJSON(extractText(response));
}

async function scoreImprovementQuestions(resumeText, jobDescription, fitReport) {
  const response = await createMessage({
    model: MODEL_STANDARD,
    max_tokens: 1200,
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `You have already scored this candidate against a job posting. Now generate targeted follow-up questions that, if answered, would give you the additional context needed to tailor the best possible resume and cover letter.

Focus on the gaps you identified. Ask about specific projects, metrics, scope, context, or experience that might exist but wasn't captured in the resume. Do NOT ask about skills the resume clearly shows they don't have — only ask questions where the answer could improve the materials.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "<short_key>",
      "question": "<specific question>",
      "why": "<one sentence: why this answer matters for the application>"
    }
  ]
}

Limit to 3–5 questions maximum.`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `RESUME:\n${resumeText}\n\n---\n\nJOB POSTING:\n${jobDescription}\n\n---\n\nFIT REPORT SUMMARY:\nScore: ${fitReport.overall_score}/100\nVerdict: ${fitReport.verdict}\nGaps: ${fitReport.gaps.join('; ')}`,
      },
    ],
  });

  return parseJSON(extractText(response));
}

async function tailorResume(resumeText, jobDescription, answers = [], style = 'classic') {
  const answersText = answers.length
    ? '\n\nADDITIONAL CONTEXT FROM CANDIDATE:\n' +
      answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')
    : '';

  const response = await createMessage({
    model: MODEL_PREMIUM,
    max_tokens: 3000,
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `Rewrite the candidate's resume to be specifically optimized for this job posting.

CONTENT RULES:
- Only use skills, experiences, and outcomes documented in the original resume or provided in additional context. Do not invent anything.
- Reorder and emphasize sections most relevant to this role.
- Strengthen bullet points using the job's language where the underlying experience genuinely maps.
- Keep all dates, company names, and titles exactly as provided.
- Write in clean, direct sentences. No em dashes. No fragments.
- Do NOT include any disclaimers, notes, caveats, or meta-commentary anywhere in the resume.

STRUCTURE RULES (non-negotiable, apply regardless of style):
- Always begin with the candidate's name on the first line, then contact info on the next line.
- Always include these clearly labeled sections in this order: PROFESSIONAL SUMMARY, EXPERIENCE, EDUCATION, SKILLS.
- Add additional sections (CERTIFICATIONS, PROJECTS, etc.) only if present in the original resume.
- Each section must be separated by a blank line and introduced with its label in ALL CAPS.
- Under EXPERIENCE, each role must show: Job Title | Company | Location | Start Date – End Date, followed by 3–5 bullet points.
- Each bullet point starts with a strong action verb and includes a specific outcome or scope where available.
- Under SKILLS, group into subcategories (e.g., Technical, Leadership, Tools) when there are 6+ skills.

Style requested: ${style}

Return the complete resume as plain text. Nothing before the candidate's name. Nothing after the last line of content.`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `ORIGINAL RESUME:\n${resumeText}${answersText}\n\n---\n\nTARGET JOB POSTING:\n${jobDescription}`,
      },
    ],
  });

  return extractText(response).trim();
}

async function writeCoverLetter(resumeText, jobDescription, answers = [], tailoredResumeText = '') {
  const context = tailoredResumeText || resumeText;
  const answersText = answers.length
    ? '\n\nADDITIONAL CONTEXT:\n' + answers.map(a => `${a.question}: ${a.answer}`).join('\n')
    : '';

  const response = await createMessage({
    model: MODEL_PREMIUM,
    max_tokens: 1500,
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `Write a cover letter for this candidate applying to this specific role.

Rules:
- Draw only from the candidate's documented experience — no invented achievements.
- Open with a specific, compelling statement that connects the candidate's background to this role directly. No "I am writing to express my interest" openers.
- Three paragraphs: why this role, what they bring, why now.
- Close with a clear, confident call to action.
- Tone: warm, direct, specific. No corporate jargon. No hollow inspiration.
- No em dashes. Complete sentences only.
- Do not include date, address block, or signature — just the body text.
- Aim for 300–400 words.`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `CANDIDATE RESUME:\n${context}${answersText}\n\n---\n\nJOB POSTING:\n${jobDescription}`,
      },
    ],
  });

  return extractText(response).trim();
}

async function interviewPrep(resumeText, jobDescription) {
  const response = await createMessage({
    model: MODEL_STANDARD,
    max_tokens: 3000,
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `Prepare this candidate for an interview for this specific role. Return ONLY valid JSON:
{
  "role_context": "<2–3 sentences on what this role actually needs and what will likely be evaluated>",
  "behavioral_questions": [
    { "question": "<question>", "what_they_want": "<what skill or value this is probing>", "coaching": "<specific tip for this candidate given their background>" }
  ],
  "technical_questions": [
    { "question": "<question>", "what_they_want": "<context>", "coaching": "<tip>" }
  ],
  "questions_to_ask": ["<smart question the candidate should ask>"],
  "watch_outs": ["<specific thing this candidate should be ready to address or explain, given their resume vs. the role>"]
}

Provide 4–5 behavioral questions, 3–4 technical questions, 4 questions to ask, and 2–3 watch-outs. All coaching notes must be specific to THIS candidate's resume, not generic advice.`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `CANDIDATE RESUME:\n${resumeText}\n\n---\n\nJOB POSTING:\n${jobDescription}`,
      },
    ],
  });

  return parseJSON(extractText(response));
}

async function postInterviewDebrief(resumeText, jobDescription, interviewNotes) {
  const response = await createMessage({
    model: MODEL_STANDARD,
    max_tokens: 2000,
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `A candidate just finished an interview. Based on their resume, the job posting, and their notes from the interview, give them an honest debrief. Return ONLY valid JSON:
{
  "overall_read": "<2–3 sentences on how this likely went based on what they shared>",
  "went_well": ["<specific thing that likely landed well>"],
  "could_be_stronger": ["<specific thing to address if there's a follow-up or next round>"],
  "red_flags": ["<anything that might concern the hiring team based on their notes — be direct>"],
  "follow_up_action": "<one concrete action they should take in the next 24 hours>",
  "likelihood": "<one of: Strong / Uncertain / Unlikely — with a one-sentence reason>"
}`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `CANDIDATE RESUME:\n${resumeText}\n\n---\n\nJOB POSTING:\n${jobDescription}\n\n---\n\nINTERVIEW NOTES FROM CANDIDATE:\n${interviewNotes}`,
      },
    ],
  });

  return parseJSON(extractText(response));
}

async function rescoreWithAnswers(resumeText, jobDescription, originalReport, answers) {
  const answersText = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');

  const response = await createMessage({
    model: MODEL_STANDARD,
    max_tokens: 800,
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `You previously scored a candidate against a job posting. The candidate has now provided additional context that was missing from their resume. Recalculate the fit score incorporating this new information.

Return ONLY valid JSON:
{
  "overall_score": <integer 0–100>,
  "score_change": <integer, positive or negative>,
  "updated_why": "<2–3 sentences on how the new context changed the picture>",
  "additional_strengths": ["<strength revealed by new context>"]
}`,
      },
    ],
    messages: [{
      role: 'user',
      content: `RESUME:\n${resumeText}\n\n---\n\nJOB POSTING:\n${jobDescription}\n\n---\n\nORIGINAL SCORE: ${originalReport.overall_score}/100\n\nADDITIONAL CONTEXT FROM CANDIDATE:\n${answersText}`,
    }],
  });

  return parseJSON(extractText(response));
}

async function chat(messages, context = {}) {
  const contextLines = [
    context.page             && `Current page: ${context.page}`,
    context.currentTab       && `Active tab: ${context.currentTab}`,
    context.currentJob       && `Job being viewed: ${context.currentJob}`,
    context.fitScore != null  && `Fit score for that job: ${context.fitScore}/100`,
    context.optimizationStep != null && `Optimization flow step: ${context.optimizationStep}`,
    context.hasResume != null && `Has resume on file: ${context.hasResume}`,
  ].filter(Boolean).join('\n');

  const response = await createMessage({
    model: MODEL_FAST,
    max_tokens: 600,
    system: [
      {
        type: 'text',
        text: `You are the Apply Ready assistant — a helpful, direct support agent built into the Apply Ready app. Apply Ready is an AI career prep tool that helps job seekers evaluate their fit for roles, tailor their resumes and cover letters, prep for interviews, and track applications.

HOW THE APP WORKS:
- Discover tab: Job listings matched to the user's target roles and regions. Jobs only appear after target roles and regions are set in Profile and the feed is refreshed. "See my fit score" marks a job as Interested and opens the optimization flow.
- Interested tab: Jobs the user is actively working on. "Optimize + Apply" opens the full flow.
- Submitted tab: Jobs already applied to, with interview tracking and journey notes.
- Optimization Flow (6 steps): Fit Score, Clarifying Questions, Updated Score, Tailored Resume, Cover Letter, Apply.
- Profile: Set target roles, regions, resume style, compensation floor, and upload or replace a resume. The Discover tab will be empty until target roles and regions are filled in here.
- Add a Job: Paste job text or upload a screenshot of any posting found anywhere.
- Resume: Upload a PDF or Word doc, or paste text. The AI tailors it per job without modifying the original.
- Fit Score: 0-100 score across Skills Match, Experience, Culture/Values, and Trajectory Fit.
- Clarifying Questions: 3-5 targeted questions after the fit score to surface context the resume may not capture. Answers improve the score and feed into the tailored resume and cover letter.

TONE: Warm, direct, specific. Short answers unless depth is needed. No jargon.${contextLines ? `\n\nUSER CONTEXT:\n${contextLines}` : ''}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  });

  return extractText(response).trim();
}

async function suggestRoles(resumeText) {
  const response = await createMessage({
    model: MODEL_STANDARD,
    max_tokens: 1200,
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `Read this resume and return job categories and titles this person is likely a strong match for, based on their actual documented experience. Return ONLY valid JSON:
{
  "categories": ["<category 1>", "<category 2>"],
  "roles": [
    { "title": "<job title>", "reason": "<one sentence — specific to their background>", "seniority": "<entry | mid | senior | lead | director | executive>" }
  ]
}

Return 2–3 categories and 8–12 specific role titles. Be realistic — match what the resume actually shows.`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `RESUME:\n${resumeText}`,
      },
    ],
  });

  return parseJSON(extractText(response));
}

module.exports = {
  fitScore,
  scoreImprovementQuestions,
  tailorResume,
  writeCoverLetter,
  interviewPrep,
  postInterviewDebrief,
  suggestRoles,
  extractTextFromImage,
  rescoreWithAnswers,
  chat,
};
