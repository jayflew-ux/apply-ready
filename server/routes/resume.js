const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { parseBuffer, parseText } = require('../services/resumeParser');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from('resumes')
      .select('id, filename, raw_text, is_active, created_at')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || null);
  } catch (err) {
    next(err);
  }
});

router.post('/upload', upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { text, warning } = await parseBuffer(req.file.buffer, req.file.mimetype);

    if (warning) return res.status(422).json({ error: warning });

    // Deactivate previous resumes
    await req.db
      .from('resumes')
      .update({ is_active: false })
      .eq('user_id', req.user.id);

    const { data, error } = await req.db
      .from('resumes')
      .insert({
        user_id: req.user.id,
        filename: req.file.originalname,
        raw_text: text,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/text', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text field required' });

    const parsed = parseText(text);

    await req.db
      .from('resumes')
      .update({ is_active: false })
      .eq('user_id', req.user.id);

    const { data, error } = await req.db
      .from('resumes')
      .insert({
        user_id: req.user.id,
        filename: 'pasted-resume.txt',
        raw_text: parsed.text,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
