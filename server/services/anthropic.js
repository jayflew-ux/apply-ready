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

// Fable 5 always reasons internally, and tool-using calls (web search) can
// emit multiple text blocks — commentary, then a final answer. Always take
// the last one, which is safe for plain single-block responses too.
function extractText(response) {
  if (response.stop_reason === 'refusal') {
    throw new Error('The AI declined this request. Try rephrasing the job posting or resume content.');
  }
  const textBlocks = response.content.filter(b => b.type === 'text');
  const textBlock = textBlocks[textBlocks.length - 1];
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
    max_tokens: 2000,
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
  "keyword_coverage": {
    "covered": ["<important keyword or skill from the posting that the resume already shows>"],
    "missing": ["<important keyword or skill from the posting absent from the resume>"]
  },
  "verdict": "<one of: I'd submit you | I'd coach you first, then submit | I wouldn't submit you for this role>",
  "verdict_reason": "<1–2 sentences explaining the verdict>"
}

For keyword_coverage, pick the 8-14 terms an applicant tracking system or screening recruiter would actually scan for in THIS posting (skills, tools, certifications, domain terms). List each under covered or missing based on the resume. Do not pad either list.`,
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

LENGTH RULE (non-negotiable): the final resume must fit within two U.S. Letter pages when printed. Target roughly 500–650 words total. Prioritize the highest-impact, most relevant experience for this specific role over completeness. If the original resume has more roles or bullets than fit, cut or condense the least relevant ones rather than shrinking type. Older or less relevant roles can be trimmed to one line.

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

async function interviewPrep(resumeText, jobDescription, interviewerName = '', interviewerRole = '') {
  const hasInterviewer = Boolean(interviewerName || interviewerRole);
  const interviewerBlock = hasInterviewer
    ? `\n\nINTERVIEWER PROVIDED BY CANDIDATE:\n${interviewerName ? `Name: ${interviewerName}\n` : ''}${interviewerRole ? `Role/title: ${interviewerRole}\n` : ''}Search for this person's publicly available professional background (e.g. LinkedIn, company bio page, public talks or writing) and use anything relevant to sharpen the coaching. If search turns up nothing solid, say so plainly in interviewer_notes rather than guessing.`
    : `\n\nNo interviewer was named. Use search to research the company and role generally instead — recent news, product focus, culture, anything that would sharpen the candidate's prep.`;

  const response = await createMessage({
    model: MODEL_STANDARD,
    max_tokens: 3000,
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `Prepare this candidate for an interview for this specific role. You have a web_search tool — use it to research the company (recent news, product, culture) and, if named, the interviewer, using only publicly available professional information. Never fabricate what search does not surface; say plainly when nothing useful was found.

After researching, return ONLY valid JSON matching this schema — no markdown fences, no text outside the JSON:
{
  "company_notes": "<1–2 sentences on anything current and relevant you found about the company. If search found nothing useful, write \\"No notable recent company information found.\\">",
  "interviewer_notes": "<1–2 sentences on the interviewer if named and something was found. Empty string if no interviewer was named or nothing was found.>",
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
        content: `CANDIDATE RESUME:\n${resumeText}\n\n---\n\nJOB POSTING:\n${jobDescription}${interviewerBlock}`,
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
- Discover tab: AI-suggested roles based on the user's resume, plus live job listings found by real web search, each with a 0-100 match score and a one-click "Prep this application" button. Requires a resume on file first. Listings refresh on demand and are cached for a few hours.
- Keyword coverage: every fit score includes an ATS-style keyword panel showing which terms from the posting the resume covers and which are missing. Missing keywords only get woven into the tailored resume where the user's real experience supports them.
- Follow-up nudges: on the Submitted tab, applications sitting at "Applied" for 5+ days show a reminder that a short follow-up note can revive them.
- Interested tab: Jobs the user is actively working on. "Optimize + Apply" opens the full flow.
- Submitted tab: Jobs already applied to, with journey status tracking (phone screen, interviews, offer, etc.) and interview prep.
- Optimization Flow (6 steps): Fit Score, Clarifying Questions, Updated Score, Tailored Resume, Cover Letter, Apply.
- Interview Prep: Available on any active job in the Submitted tab once its journey status is applied or later. The user can optionally name the interviewer and their role or title. If given, the AI searches for that person's public professional background to sharpen the coaching. If left blank, the AI researches the company and role generally instead. Produces behavioral and technical questions with coaching notes specific to the candidate, smart questions to ask, and watch-outs.
- Post-interview debrief: Also on the Submitted tab, once a job reaches an interview stage. The user drops in their notes and gets an honest read on how it likely went.
- Profile: Set target roles, regions, resume style, compensation floor, and upload or replace a resume. The Discover tab will be empty until a resume is uploaded.
- Add a Job: Paste job text or upload a screenshot of any posting found anywhere.
- Resume: Upload a PDF or Word doc, or paste text. The AI tailors it per job without modifying the original. Tailored resumes and cover letters print as polished, ready-to-send documents, not plain text.
- Fit Score: 0-100 score across Skills Match, Experience, Culture/Values, and Trajectory Fit.
- Plans: the free plan includes role discovery, scored live listings, fit scores, and one complete application build (tailored resume + cover letter). Dream Job Ready Pro is $19.99/month for unlimited builds, cancel anytime, managed from the Profile page.
- Clarifying Questions: 3-5 targeted questions after the fit score to surface context the resume may not capture. Answers improve the score and feed into the tailored resume and cover letter.

TONE: Warm, direct, specific. Short answers unless depth is needed. No jargon.${contextLines ? `\n\nUSER CONTEXT:\n${contextLines}` : ''}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  });

  return extractText(response).trim();
}

async function findListings(resumeText, profile = {}) {
  const prefs = [
    profile.target_roles?.length ? `Target roles: ${profile.target_roles.join(', ')}` : null,
    profile.target_regions?.length ? `Regions: ${profile.target_regions.join(', ')}` : null,
    profile.seniority_target ? `Seniority target: ${profile.seniority_target}` : null,
    profile.remote_preference ? `Work arrangement preference: ${profile.remote_preference}` : null,
    profile.compensation_floor ? `Minimum annual compensation: ${profile.compensation_floor}` : null,
  ].filter(Boolean).join('\n');

  const response = await createMessage({
    model: MODEL_STANDARD,
    max_tokens: 4000,
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    system: [
      { type: 'text', text: RECRUITER_SYSTEM, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `Use the web_search tool to find CURRENT, REAL job listings that match this candidate's resume and preferences. Search job boards and company career pages. Run several searches covering the candidate's strongest role matches and preferred regions.

STRICT HONESTY RULES:
- Include ONLY listings you actually found through search, with their real URLs. Never invent a listing, company, salary, or URL.
- Prefer direct links to the specific posting. A search-results URL is acceptable only if no direct link surfaced.
- If salary was not stated, use an empty string. If you found fewer than 5 solid listings, return fewer; do not pad.

For each listing, estimate a match score from 0-100 against the resume and preferences, the way a recruiter would judge fit. Be honest; not everything is an 80.

After searching, return ONLY valid JSON — no markdown fences, no text outside the JSON:
{
  "listings": [
    {
      "title": "<job title>",
      "company": "<company>",
      "location": "<location or Remote>",
      "salary": "<stated salary or empty string>",
      "url": "<real URL from search>",
      "summary": "<1-2 sentences: what the role is and what they want>",
      "match_score": <integer 0-100>,
      "match_reason": "<one sentence: why this score, tied to the resume>"
    }
  ],
  "search_note": "<one sentence on coverage, e.g. which boards or regions were searched, or if results were thin>"
}

Return 5-10 listings ordered by match_score descending.`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `RESUME:\n${resumeText}\n\n---\n\nCANDIDATE PREFERENCES:\n${prefs || 'None set — infer sensible targets from the resume.'}`,
      },
    ],
  });

  return parseJSON(extractText(response));
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
  findListings,
  extractTextFromImage,
  rescoreWithAnswers,
  chat,
};
