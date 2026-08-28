const express = require('express');
const auth = require('../middleware/auth');
const ai = require('../services/anthropic');
const { verifyListings } = require('../lib/verifyListings');

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

// Billing is live only when Stripe is fully configured AND free mode is off.
// While it is off the whole app is free and unlimited — no paywall, no caps —
// so nobody is stranded at an upgrade prompt they cannot act on.
// To start charging: set the Stripe env vars and remove FREE_MODE.
const FREE_MODE = process.env.FREE_MODE !== 'false';
const BILLING_LIVE = !FREE_MODE
  && Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
const FREE_RESUME_BUILDS = 1; // applies only once BILLING_LIVE is true

router.post('/tailor-resume/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const { data: profile } = await req.db
      .from('profiles')
      .select('resume_builds_used, subscription_status')
      .eq('id', req.user.id)
      .single();

    const buildsUsed = profile?.resume_builds_used || 0;
    const isSubscriber = profile?.subscription_status === 'active';
    const isRegeneration = Boolean(userJob?.tailored_resume_text);

    if (BILLING_LIVE && !isSubscriber && !isRegeneration && buildsUsed >= FREE_RESUME_BUILDS) {
      return res.status(403).json({
        error: 'You have used your free application build. Upgrade to keep building tailored resumes and cover letters for every role you pursue.',
        upgrade_required: true,
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
        resume_revisions_used: 0, // a fresh build restores both revisions
      })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    if (!isRegeneration) {
      await req.db
        .from('profiles')
        .update({ resume_builds_used: buildsUsed + 1 })
        .eq('id', req.user.id);
    }

    res.json({
      tailored_resume_text: tailored,
      builds_used: isRegeneration ? buildsUsed : buildsUsed + 1,
      builds_limit: (!BILLING_LIVE || isSubscriber) ? null : FREE_RESUME_BUILDS,
    });
  } catch (err) {
    next(err);
  }
});

// Revise a tailored resume from the candidate's own feedback.
// Capped per job so a misunderstanding has a fix without becoming a
// free-running generation loop.
const MAX_RESUME_REVISIONS = 2;

router.post('/revise-resume/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const feedback = (req.body?.feedback || '').trim();
    if (!feedback) return res.status(400).json({ error: 'Tell us what you would like changed.' });
    if (feedback.length > 2000) return res.status(400).json({ error: 'Please keep feedback under 2000 characters.' });

    if (!userJob.tailored_resume_text) {
      return res.status(400).json({ error: 'Generate a tailored resume first, then you can request changes.' });
    }

    const used = userJob.resume_revisions_used || 0;
    if (used >= MAX_RESUME_REVISIONS) {
      return res.status(403).json({
        error: `You have used both revisions for this job. You can still edit the text yourself after downloading, or start this job fresh to reset.`,
        revisions_used: used,
        revisions_limit: MAX_RESUME_REVISIONS,
      });
    }

    const revised = await ai.reviseResume(
      resumeText,
      userJob.tailored_resume_text,
      job.description,
      feedback,
    );

    await req.db
      .from('user_jobs')
      .update({ tailored_resume_text: revised, resume_revisions_used: used + 1 })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    res.json({
      tailored_resume_text: revised,
      revisions_used: used + 1,
      revisions_limit: MAX_RESUME_REVISIONS,
    });
  } catch (err) {
    next(err);
  }
});

// Write cover letter — allowed whenever this job already has a tailored
// resume (the build was paid for or free-included); otherwise subscribers only.
router.post('/cover-letter/:userJobId', async (req, res, next) => {
  try {
    const { resumeText, userJob, job } = await getContext(req);
    if (!resumeText) return res.status(400).json({ error: 'No active resume found' });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (!userJob?.tailored_resume_text && BILLING_LIVE) {
      const { data: profile } = await req.db
        .from('profiles')
        .select('subscription_status')
        .eq('id', req.user.id)
        .single();
      if (profile?.subscription_status !== 'active') {
        return res.status(403).json({
          error: 'Cover letters are part of the application build. Upgrade to keep building.',
          upgrade_required: true,
        });
      }
    }

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

    const { interviewer_name = '', interviewer_role = '' } = req.body || {};

    const prep = await ai.interviewPrep(resumeText, job.description, interviewer_name, interviewer_role);
    const stored = { ...prep, interviewer_name, interviewer_role };

    await req.db
      .from('user_jobs')
      .update({ interview_prep: stored })
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    res.json(stored);
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

// Live job listings via web search, scored against the resume.
// Cached per user for 6 hours to keep search costs sane; force=true refreshes.
// Each fresh sweep runs several web searches and feeds the results through
// Opus, so it is the most expensive operation in the app. Job boards do not
// turn over fast enough to justify re-searching more often than daily; users
// who want fresher results can force one with the "Search again" button.
const LISTINGS_CACHE_HOURS = 24;

router.post('/find-listings', async (req, res, next) => {
  try {
    const [{ data: resumeData }, { data: profile }] = await Promise.all([
      req.db.from('resumes').select('raw_text').eq('user_id', req.user.id).eq('is_active', true).limit(1).single(),
      req.db.from('profiles').select('*').eq('id', req.user.id).single(),
    ]);

    if (!resumeData?.raw_text) return res.status(400).json({ error: 'No active resume found' });

    const force = Boolean(req.body?.force);
    const cachedAt = profile?.discover_listings_at ? new Date(profile.discover_listings_at) : null;
    const fresh = cachedAt && (Date.now() - cachedAt.getTime()) < LISTINGS_CACHE_HOURS * 3600 * 1000;

    if (!force && fresh && profile?.discover_listings) {
      return res.json({ ...profile.discover_listings, cached: true, fetched_at: profile.discover_listings_at });
    }

    const raw = await ai.findListings(resumeData.raw_text, profile || {});

    // Never surface a listing we cannot confirm exists. Dead links and
    // non-existent hosts are dropped before the user ever sees them.
    const result = await verifyListings(raw);

    await req.db
      .from('profiles')
      .update({ discover_listings: result, discover_listings_at: new Date().toISOString() })
      .eq('id', req.user.id);

    res.json({ ...result, cached: false, fetched_at: new Date().toISOString() });
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
