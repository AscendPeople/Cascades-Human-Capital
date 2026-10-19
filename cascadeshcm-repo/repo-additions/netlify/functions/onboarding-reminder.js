// Component 2: onboarding stall reminder.
//
// Scheduled function. Sends a single gentle reminder to clients who received a
// welcome email but have not completed onboarding within 48 hours. Never sends
// more than one reminder per client (guarded by reminderSentAt).
//
// Schedule is configured in netlify.toml.

const { getStore } = require('@netlify/blobs');
const { CONFIG } = require('../../lib/config');
const { sign } = require('../../lib/token');
const { send, shell, esc } = require('../../lib/email');

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

exports.handler = async () => {
  const store = getStore('onboarding');
  let listed;
  try {
    listed = await store.list();
  } catch (e) {
    console.error('onboarding list failed', e);
    return { statusCode: 200, body: 'no store' };
  }

  const now = Date.now();
  let sent = 0;

  for (const entry of listed.blobs || []) {
    let rec;
    try {
      rec = await store.get(entry.key, { type: 'json' });
    } catch (_) {
      continue;
    }
    if (!rec || rec.status !== 'pending') continue;
    if (rec.reminderSentAt) continue; // exactly one reminder, ever
    if (!rec.email) continue;
    if (!rec.welcomeSentAt) continue;
    if (now - new Date(rec.welcomeSentAt).getTime() < FORTY_EIGHT_HOURS) continue;

    const token = sign({ customerId: rec.customerId, scope: 'onboarding', email: rec.email }, 14 * 24 * 60 * 60);
    const link = `${CONFIG.siteUrl}/onboarding.html?token=${encodeURIComponent(token)}`;
    const first = (rec.name || '').split(' ')[0];

    const html = shell(`
      <div style="font-family:Georgia,serif;font-size:23px;color:#f4f7ff;margin-bottom:14px;">A gentle nudge${first ? ', ' + esc(first) : ''}.</div>
      <div style="font-size:16px;line-height:1.75;color:#dbe4f6;">
        We noticed your Ascend People Solutions onboarding is not yet complete. It only takes a few minutes, and finishing it helps us set your account up the way your team needs.
      </div>
      <div style="margin-top:22px;">
        <a href="${esc(link)}" style="display:inline-block;background:#c98a3a;color:#0a0f1c;text-decoration:none;font-family:Georgia,serif;font-size:15px;padding:12px 24px;border-radius:8px;">Finish onboarding</a>
      </div>
      <div style="font-size:14px;line-height:1.7;color:#9fb0d0;margin-top:20px;">
        If now is not a good time, simply reply and we will help however works best for you.
      </div>
    `);

    try {
      await send({ to: rec.email, subject: 'Finish setting up Ascend People Solutions', html });
      rec.reminderSentAt = new Date().toISOString();
      await store.setJSON(entry.key, rec);
      sent += 1;
    } catch (e) {
      console.error('reminder send failed for', entry.key, e);
    }
  }

  return { statusCode: 200, body: `reminders sent: ${sent}` };
};
