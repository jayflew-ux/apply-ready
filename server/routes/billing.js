const express = require('express');
const auth = require('../middleware/auth');
const { serviceClient } = require('../lib/db');

// Billing stays dormant while FREE_MODE is on (the default) or until Stripe
// is configured. Flip it on by setting the Stripe env vars and FREE_MODE=false.
const FREE_MODE = process.env.FREE_MODE !== 'false';
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = (!FREE_MODE && stripeKey) ? require('stripe')(stripeKey) : null;

// Lets the client render the right plan UI without guessing.
const BILLING_ENABLED = Boolean(stripe && process.env.STRIPE_PRICE_ID);

const APP_URL = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();

const router = express.Router();
router.use(auth);

// Whether paid plans are active. Client uses this to show the right plan UI.
router.get('/status', (_req, res) => {
  res.json({ billing_enabled: BILLING_ENABLED });
});

// Start a subscription checkout
router.post('/checkout', async (req, res, next) => {
  try {
    if (!BILLING_ENABLED) {
      return res.status(503).json({ error: 'Dream Job Ready is free right now — no payment needed.' });
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', req.user.id)
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: profile?.email || req.user.email }),
      client_reference_id: req.user.id,
      allow_promotion_codes: true,
      success_url: `${APP_URL}/dashboard?upgraded=1`,
      cancel_url: `${APP_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// Stripe-hosted portal for managing/canceling the subscription
router.get('/portal', async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Billing is not configured yet.' });

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', req.user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription on file for this account.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${APP_URL}/profile`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// Webhook — mounted in index.js with express.raw BEFORE the JSON parser,
// because Stripe signature verification needs the raw request body.
async function webhook(req, res) {
  if (!stripe) return res.status(503).end();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send('bad signature');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.client_reference_id) {
          await serviceClient
            .from('profiles')
            .update({ stripe_customer_id: s.customer, subscription_status: 'active' })
            .eq('id', s.client_reference_id);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const status =
          event.type === 'customer.subscription.deleted' ? 'free'
          : ['active', 'trialing'].includes(sub.status) ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : 'free';
        await serviceClient
          .from('profiles')
          .update({ subscription_status: status })
          .eq('stripe_customer_id', sub.customer);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling failed:', err);
    res.status(500).end();
  }
}

module.exports = { router, webhook };
