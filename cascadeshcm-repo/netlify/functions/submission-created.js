// Netlify event function: runs automatically after every verified Netlify Forms submission
// (inquiry, people-infrastructure-gap, ai-readiness-index, any future form).
// Emails the submission straight to CONFIG.notifyEmail via Resend. No CRM required.
//
// Requires a Git-connected (or CLI) deploy. Drag-and-drop deploys do not run functions.

const { CONFIG } = require('../../lib/config');
const { send, shell, esc } = require('../../lib/email');

const sourceByForm = {
  'people-infrastructure-gap': 'HR Checklist Download',
  'inquiry': 'Website Inquiry',
  'ai-readiness-index': 'AI People Solutions Index',
  'hr-checklist': 'HR Checklist Download'
};

exports.handler = async (event) => {
  let payload;
  try { payload = JSON.parse(event.body).payload; } catch (e) { return { statusCode: 400, body: 'bad payload' }; }

  const d = payload.data || {};
  const form = payload.form_name || 'website';
  const email = (d.email || '').trim();
  const name = (d.name || '').trim();
  const label = sourceByForm[form] || 'Website form';

  const skip = new Set(['form-name', 'bot-field']);
  const lines = Object.entries(d)
    .filter(([k, v]) => !skip.has(k) && v)
    .map(([k, v]) => `<p style="margin:0 0 10px;"><b>${esc(k.replace(/_/g, ' '))}:</b> ${esc(v)}</p>`);

  const html = shell(`
    <h1 style="font-size:20px;font-weight:400;margin:0 0 20px;color:#e8ecf4;">${esc(label)}</h1>
    ${lines.join('')}
  `);

  const subject = `New ${label}${name ? ': ' + name : email ? ': ' + email : ''}`;

  try {
    await send({ to: CONFIG.notifyEmail, subject, html, replyTo: email || undefined });
  } catch (e) {
    console.error('submission-created: failed to send notification email', e);
    return { statusCode: 200, body: 'email failed; logged' };
  }
  return { statusCode: 200, body: 'ok' };
};
