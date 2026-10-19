// Component 2: Ascend People Solutions onboarding trigger.
//
// Stripe webhook. On checkout.session.completed or customer.subscription.created
// it provisions an onboarding token, sends the client a branded welcome email
// with a secure tokenized link to the hosted onboarding chat, and records a
// pending intake keyed to the Stripe customer (so the 48h reminder can find it).

const Stripe = require('stripe');
const { CONFIG } = require('../../lib/config');
const { sign } = require('../../lib/token');
const { send, shell, esc } = require('../../lib/email');
const { put, get } = require('../../lib/store');

// Netlify provides the raw body; Stripe signature verification needs it verbatim.
function rawBody(event) {
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
}

async function startOnboarding({ customerId, email, name, org }) {
  if (!customerId) return;

  // Idempotency: if we already started onboarding for this customer, do nothing.
  const existing = await get('onboarding', customerId).catch(() => null);
  if (existing && existing.status && existing.status !== 'pending') return;
  if (existing && existing.welcomeSentAt) return;

  // Onboarding token is valid for 14 days and carries the Stripe customer id.
  const token = sign({ customerId, scope: 'onboarding', email: email || '' }, 14 * 24 * 60 * 60);
  const link = `${CONFIG.siteUrl}/onboarding.html?token=${encodeURIComponent(token)}`;

  const record = {
    customerId,
    email: email || '',
    name: name || '',
    org: org || '',
    status: 'pending',
    welcomeSentAt: new Date().toISOString(),
    reminderSentAt: null,
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
  };
  await put('onboarding', customerId, record);

  if (email) {
    const html = shell(`
      <div style="font-family:Georgia,serif;font-size:24px;color:#f4f7ff;margin-bottom:14px;">Welcome to Ascend People Solutions${name ? ', ' + esc(name.split(' ')[0]) : ''}.</div>
      <div style="font-size:16px;line-height:1.75;color:#dbe4f6;">
        Thank you for choosing Cascades. We are glad to have ${org ? esc(org) : 'your organization'} with us. To set your account up well, we would like to learn a little about your team and priorities. It takes only a few minutes and is a conversation, not a form.
      </div>
      <div style="margin-top:22px;">
        <a href="${esc(link)}" style="display:inline-block;background:#c98a3a;color:#0a0f1c;text-decoration:none;font-family:Georgia,serif;font-size:15px;padding:12px 24px;border-radius:8px;">Begin onboarding</a>
      </div>
      <div style="font-size:14px;line-height:1.7;color:#9fb0d0;margin-top:20px;">
        This link is private to you. Once you finish, our team will confirm your kickoff. If you have any questions in the meantime, simply reply to this note.
      </div>
    `);
    try {
      await send({ to: email, subject: 'Welcome to Ascend People Solutions', html });
    } catch (e) {
      console.error('welcome email failed', e);
    }
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody(event), sig, secret);
  } catch (err) {
    console.error('stripe signature verification failed', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const s = stripeEvent.data.object;
      const customerId = s.customer;
      const email = (s.customer_details && s.customer_details.email) || s.customer_email || '';
      const name = (s.customer_details && s.customer_details.name) || '';
      await startOnboarding({ customerId, email, name, org: '' });
    } else if (stripeEvent.type === 'customer.subscription.created') {
      const sub = stripeEvent.data.object;
      const customerId = sub.customer;
      // Fetch the customer to get email/name if we have a key.
      let email = '';
      let name = '';
      try {
        const cust = await stripe.customers.retrieve(customerId);
        if (cust && !cust.deleted) {
          email = cust.email || '';
          name = cust.name || '';
        }
      } catch (e) {
        console.error('customer retrieve failed', e);
      }
      await startOnboarding({ customerId, email, name, org: '' });
    }
  } catch (e) {
    console.error('onboarding trigger failed', e);
    // Return 200 so Stripe does not retry indefinitely on a downstream error we
    // have already logged; signature already verified above.
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
