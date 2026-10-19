// Resend email helpers and branded templates.
//
// Voice for every client-facing email: executive, warm, inviting. Never use
// em-dashes. Proper capitalization and punctuation. Signed "The Cascades Team"
// unless directed otherwise.

const { Resend } = require('resend');
const { CONFIG } = require('./config');

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

// Minimal, safe HTML escaping for values interpolated into templates.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Dark, understated shell that echoes the site's cinematic tone without
// depending on external assets (email clients strip most of that anyway).
function shell(bodyHtml) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0a0f1c;font-family:Georgia,'Times New Roman',serif;color:#e8ecf4;">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px;">
    <div style="font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#7f92b8;margin-bottom:28px;">
      Cascades Human Capital Management
    </div>
    ${bodyHtml}
    <div style="margin-top:40px;padding-top:22px;border-top:1px solid rgba(160,180,220,.16);font-size:13px;line-height:1.7;color:#9fb0d0;">
      Warmly,<br>The Cascades Team<br>
      <a href="mailto:${esc(CONFIG.notifyEmail)}" style="color:#8fb0ff;">${esc(CONFIG.notifyEmail)}</a>
    </div>
  </div>
</body></html>`;
}

async function send({ to, subject, html, replyTo }) {
  const resend = client();
  const payload = { from: CONFIG.fromEmail, to: Array.isArray(to) ? to : [to], subject, html };
  if (replyTo) payload.reply_to = replyTo;
  return resend.emails.send(payload);
}

module.exports = { send, shell, esc };
