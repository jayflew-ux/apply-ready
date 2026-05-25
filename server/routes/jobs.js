const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getAdapter } = require('../adapters/jobAdapter');
const { parseBuffer, parseText } = require('../services/resumeParser');
const { extractTextFromImage } = require('../services/anthropic');
const router = express.Router();

router.use(auth);

async function getActiveResume(db, userId) {
  const { data } = await db
    .from('resumes')
    .select('raw_text')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data?.raw_text || null;
}

async function getProfile(db, userId) {
  const { data } = await db
    .from('profiles')
    .select('target_roles, target_regions, last_seen_jobs_at')
    .eq('id', userId)
    .single();
  return data;
}

// Refresh job feed for this user based on their profile
router.post('/refresh', async (req, res, next) => {
  try {
    const profile = await getProfile(req.db, req.user.id);
    if (!profile) return res.status(400).json({ error: 'Profile not found' });

    const keywords = Array.isArray(profile.target_roles) ? profile.target_roles : [];
    const regions  = Array.isArray(profile.target_regions) ? profile.target_regions : [];

    const adapter = getAdapter();
    const { jobs } = await adapter.search({ keywords, regions, page: 1, limit: 30 });

    // Upsert jobs into shared cache using service client
    for (const job of jobs) {
      await req.serviceDb.from('jobs').upsert(job, { onConflict: 'external_id', ignoreDuplicates: false });
    }

    // Create user_jobs records for new jobs (discovered)
    const { data: existingUserJobs } = await req.db
      .from('user_jobs')
      .select('job_id')
      .eq('user_id', req.user.id);

    const existingIds = new Set((existingUserJobs || []).map(uj => uj.job_id));

    const { data: dbJobs } = await req.serviceDb
      .from('jobs')
      .select('id, external_id')
      .in('external_id', jobs.map(j => j.external_id));

    const newUserJobs = (dbJobs || [])
      .filter(j => !existingIds.has(j.id))
      .map(j => ({ user_id: req.user.id, job_id: j.id, status: 'discovered' }));

    if (newUserJobs.length) {
      await req.serviceDb.from('user_jobs').insert(newUserJobs);
    }

    res.json({ refreshed: jobs.length, new: newUserJobs.length });
  } catch (err) {
    next(err);
  }
});

// Get the user's job feed (discovered + interested, not ignored)
router.get('/feed', async (req, res, next) => {
  try {
    const profile = await getProfile(req.db, req.user.id);

    const { data, error } = await req.db
      .from('user_jobs')
      .select(`
        id, status, fit_score, fit_score_report, first_seen_at, last_updated_at,
        jobs (
          id, external_id, source, title, company, location, region,
          remote_type, compensation_min, compensation_max, compensation_currency,
          url, posted_at, cached_at
        )
      `)
      .eq('user_id', req.user.id)
      .in('status', ['discovered', 'interested'])
      .order('fit_score', { ascending: false, nullsFirst: false })
      .order('first_seen_at', { ascending: false });

    if (error) throw error;

    const lastSeen = profile?.last_seen_jobs_at ? new Date(profile.last_seen_jobs_at) : null;

    const feed = (data || []).map(uj => ({
      userJobId: uj.id,
      status: uj.status,
      fitScore: uj.fit_score,
      fitScoreReport: uj.fit_score_report,
      isNew: lastSeen ? new Date(uj.jobs?.cached_at) > lastSeen : true,
      firstSeenAt: uj.first_seen_at,
      ...uj.jobs,
    }));

    res.json({ jobs: feed });
  } catch (err) {
    next(err);
  }
});

// Get submitted (applied) jobs
router.get('/submitted', async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from('user_jobs')
      .select(`
        id, status, fit_score, journey_status, journey_notes, applied_at, last_updated_at,
        jobs (
          id, title, company, location, remote_type, url, posted_at
        )
      `)
      .eq('user_id', req.user.id)
      .eq('status', 'applied')
      .order('applied_at', { ascending: false });

    if (error) throw error;
    res.json({ jobs: data || [] });
  } catch (err) {
    next(err);
  }
});

// Update job status (interested / ignored / applied)
router.put('/:userJobId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['interested', 'ignored', 'applied', 'discovered'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const updates = { status };
    if (status === 'applied') updates.applied_at = new Date().toISOString();

    const { data, error } = await req.db
      .from('user_jobs')
      .update(updates)
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Update journey tracker status
router.put('/:userJobId/journey', async (req, res, next) => {
  try {
    const { journey_status, journey_notes } = req.body;
    const updates = {};
    if (journey_status !== undefined) updates.journey_status = journey_status;
    if (journey_notes !== undefined) updates.journey_notes = journey_notes;

    const { data, error } = await req.db
      .from('user_jobs')
      .update(updates)
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Remove a user job entirely
router.delete('/:userJobId', async (req, res, next) => {
  try {
    const { error } = await req.db
      .from('user_jobs')
      .delete()
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Add a job the user found themselves (BYO)
router.post('/add', upload.single('file'), async (req, res, next) => {
  try {
    let description = '';
    let source_type = 'text';
    let source_url = null;
    let raw_input = '';

    if (req.file) {
      source_type = req.file.mimetype.startsWith('image/') ? 'screenshot' : 'pdf';
      if (req.file.mimetype.startsWith('image/')) {
        description = await extractTextFromImage(req.file.buffer, req.file.mimetype);
      } else {
        const { text } = await parseBuffer(req.file.buffer, req.file.mimetype);
        description = text;
      }
      raw_input = description;
    } else if (req.body.text) {
      const parsed = parseText(req.body.text);
      description = parsed.text;
      source_type = 'text';
      raw_input = req.body.text;
    } else if (req.body.url) {
      source_url = req.body.url;
      source_type = 'url';
      // For URL parsing we store the URL; description extracted from any pasted text
      description = req.body.description || req.body.url;
      raw_input = req.body.url;
    } else {
      return res.status(400).json({ error: 'Provide file, text, or url' });
    }

    const title   = req.body.title   || 'Untitled Role';
    const company = req.body.company || 'Unknown Company';

    // Insert into shared jobs cache
    const jobPayload = {
      external_id: `user-${req.user.id}-${Date.now()}`,
      source: 'user-added',
      title,
      company,
      location: req.body.location || '',
      region: req.body.region || '',
      remote_type: req.body.remote_type || 'unknown',
      description,
      url: source_url,
      posted_at: new Date().toISOString(),
    };

    const { data: job, error: jobErr } = await req.serviceDb
      .from('jobs')
      .insert(jobPayload)
      .select()
      .single();

    if (jobErr) throw jobErr;

    // Create user_job record (interested immediately)
    const { data: userJob, error: ujErr } = await req.serviceDb
      .from('user_jobs')
      .insert({ user_id: req.user.id, job_id: job.id, status: 'interested' })
      .select()
      .single();

    if (ujErr) throw ujErr;

    // Record BYO metadata
    await req.serviceDb.from('user_added_jobs').insert({
      user_id: req.user.id,
      job_id: job.id,
      source_url,
      source_type,
      raw_input,
    });

    res.json({ job, userJob });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
