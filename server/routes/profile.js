const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const allowed = [
      'full_name', 'situation', 'situation_other', 'resume_style',
      'target_roles', 'target_regions', 'seniority_target',
      'remote_preference', 'compensation_floor', 'compensation_currency',
      'larger_build_note',
    ];
    const updates = {};
    allowed.forEach(k => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    const { data, error } = await req.db
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.put('/onboarding-step', async (req, res, next) => {
  try {
    const { step, complete } = req.body;
    const updates = {};
    if (typeof step === 'number') updates.onboarding_step = step;
    if (complete === true) updates.onboarding_complete = true;

    const { data, error } = await req.db
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.put('/seen-jobs', async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from('profiles')
      .update({ last_seen_jobs_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
