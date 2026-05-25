const express = require('express');
const auth = require('../middleware/auth');
const { generateResume, generateCoverLetter } = require('../services/documentGenerator');
const router = express.Router();

router.use(auth);

router.post('/resume/:userJobId', async (req, res, next) => {
  try {
    const { data: userJob, error } = await req.db
      .from('user_jobs')
      .select('tailored_resume_text, tailored_resume_style, jobs(title, company)')
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id)
      .single();

    if (error || !userJob) return res.status(404).json({ error: 'User job not found' });

    const text  = userJob.tailored_resume_text;
    const style = userJob.tailored_resume_style || req.body.style || 'classic';

    if (!text) return res.status(400).json({ error: 'No tailored resume generated yet. Run the optimization flow first.' });

    const buffer = await generateResume(text, style);
    const filename = `resume-${(userJob.jobs?.company || 'company').replace(/\s+/g, '-').toLowerCase()}.docx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.post('/cover-letter/:userJobId', async (req, res, next) => {
  try {
    const { data: userJob, error } = await req.db
      .from('user_jobs')
      .select('cover_letter_text, tailored_resume_style, jobs(title, company)')
      .eq('id', req.params.userJobId)
      .eq('user_id', req.user.id)
      .single();

    if (error || !userJob) return res.status(404).json({ error: 'User job not found' });

    const text  = userJob.cover_letter_text;
    const style = userJob.tailored_resume_style || req.body.style || 'classic';

    if (!text) return res.status(400).json({ error: 'No cover letter generated yet. Run the optimization flow first.' });

    const buffer = await generateCoverLetter(text, style);
    const filename = `cover-letter-${(userJob.jobs?.company || 'company').replace(/\s+/g, '-').toLowerCase()}.docx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
