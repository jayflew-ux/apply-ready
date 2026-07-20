const express = require('express');
const auth = require('../middleware/auth');
const ai = require('../services/anthropic');

const router = express.Router();

router.use(auth);

async function getContext(req) {
  const [resumeRes, jobRes, userJobRes] = await Promise.all([
    req.db.from('resumes').select('raw_text').eq('user_id', req.user.id).eq('is_active', true).limit(1).single(),
    req.db.from('user_jobs').select('*, jobs(*)').eq('id', req.params.userJobId).eq('user_id', req.user.id).single(),
    Promise.resolve(null),
  ]);

  const resumeText = resumeRes.data?.raw_text || null;
  const userJob    = jobRes.data || null;
  const job        = userJob?.jobs || null;

  return { resumeText, userJob, job };
}

// Fit score for a specific user_job
router.post('/fit-score/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found. Upload your resume first.' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const report = await ai.fitScore(resumeText, job.description);

    await req.db
      .from('user_jobs')
      .update({ fit_score: report.overall_score, fit_score_report: report })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    res.json(report);
  } catch (err) {
    next(err);
  }
});

// Batch fit scores (up to 5 at a time to avoid timeout)
router.post('/fit-scores', async (req, res, next) => {
  try {
    const { userJobIds } = req.body;
    if (!Array.isArray(userJobIds) || userJobIds.length === 0) {
      return res.status(400).json({ error: 'userJobIds array required' });
    }

    const { data: resumeData } = await req.db
      .from('resumes').select('raw_text').eq('user_id', req.user.id).eq('is_active', true).limit(1).single();
    const resumeText = resumeData?.raw_text;
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });

    const batch = userJobIds.slice(0, 5);
    const { data: userJobs } = await req.db
      .from('user_jobs')
      .select('id, fit_score, jobs(id, description)')
      .in('id', batch)
      .eq('user_id', req.user.id);

    const results = {};

    await Promise.allSettled(
      (userJobs || [])
        .filter(uj => uj.fit_score === null && uj.jobs?.description)
        .map(async uj => {
          const report = await ai.fitScore(resumeText, uj.jobs.description);
          await req.db
            .from('user_jobs')
            .update({ fit_score: report.overall_score, fit_score_report: report })
            .eq('id', uj.id)
            .eq('user_id', req.user.id);
          results[uj.id] = report;
        }),
    );

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// Rescore with candidate answers
router.post('/rescore/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    let fitReport = userJob.fit_score_report;
    if (!fitReport) {
      fitReport = await ai.fitScore(resumeText, job.description);
      await req.db
        .from('user_jobs')
        .update({ fit_score: fitReport.overall_score, fit_score_report: fitReport })
        .eq('id', req.params.userJobId)
        .eq('user_id', req.user.id);
    }

    const { answers = [] } = req.body;
    const result = await ai.rescoreWithAnswers(resumeText, job.description, fitReport, answers);

    const newScore = result.overall_score;
    await req.db
      .from('user_jobs')
      .update({ fit_score: newScore, score_improvement_answers: answers })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Score improvement questions
router.post('/score-questions/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    let fitReport = userJob.fit_score_report;
    if (!fitReport) {
      fitReport = await ai.fitScore(resumeText, job.description);
      await req.db
        .from('user_jobs')
        .update({ fit_score: fitReport.overall_score, fit_score_report: fitReport })
        .eq('id', req.params.userJobId)
        .eq('user_id', req.user.id);
    }

    const result = await ai.scoreImprovementQuestions(resumeText, job.description, fitReport);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Tailor resume
const RESUME_BUILD_LIMIT = 5;

router.post('/tailor-resume/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Enforce the resume build limit. Regenerating for the same job is free.
    const { data: profile } = await req.db
      .from('profiles')
      .select('resume_builds_used')
      .eq('id', req.user.id)
      .single();

    const buildsUsed = profile?.resume_builds_used || 0;
    const isRegeneration = Boolean(userJob?.tailored_resume_text);

    if (!isRegeneration && buildsUsed >= RESUME_BUILD_LIMIT) {
      return res.status(403).json({
        error: `You've used all ${RESUME_BUILD_LIMIT} of your resume builds. More are coming soon.`,
      });
    }

    const { answers = [], style } = req.body;

    const tailored = await ai.tailorResume(resumeText, job.description, answers, style);

    await req.db
      .from('user_jobs')
      .update({
        tailored_resume_text: tailored,
        tailored_resume_style: style || 'classic',
        score_improvement_answers: answers,
      })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    if (!isRegeneration) {
      await req.db
        .from('profiles')
        .update({ resume_builds_used: buildsUsed + 1 })
        .eq('id', req.user.id);
    }

    res.json({ tailored_resume_text: tailored, builds_used: isRegeneration ? buildsUsed : buildsUsed + 1, builds_limit: RESUME_BUILD_LIMIT });
  } catch (err) {
    next(err);
  }
});

// Write cover letter
router.post('/cover-letter/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const { answers = [] } = req.body;
    const tailored = userJob?.tailored_resume_text || resumeText;

    const letter = await ai.writeCoverLetter(resumeText, job.description, answers, tailored);

    await req.db
      .from('user_jobs')
      .update({ cover_letter_text: letter })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    res.json({ cover_letter_text: letter });
  } catch (err) {
    next(err);
  }
});

// Interview prep
router.post('/interview-prep/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const prep = await ai.interviewPrep(resumeText, job.description);

    await req.db
      .from('user_jobs')
      .update({ interview_prep: prep })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    res.json(prep);
  } catch (err) {
    next(err);
  }
});

// Post-interview debrief
router.post('/debrief/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const { interview_notes } = req.body;
    if (!interview_notes) return res.status(400).json({ error: 'interview_notes required' });

    const debrief = await ai.postInterviewDebrief(resumeText, job.description, interview_notes);

    await req.db
      .from('user_jobs')
      .update({ post_interview_debrief: debrief })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    res.json(debrief);
  } catch (err) {
    next(err);
  }
});

// Suggest roles from resume
router.post('/suggest-roles', async (req, res, next) => {
  try {
    const { data } = await req.db
      .from('resumes')
      .select('raw_text')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!data?.raw_text) return res.status(400).json({ error: 'No active resume found' });

    const result = await ai.suggestRoles(data.raw_text);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Chat assistant
router.post('/chat', async (req, res, next) => {
  try {
    const { messages = [], context = {} } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const reply = await ai.chat(messages, context);
    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
