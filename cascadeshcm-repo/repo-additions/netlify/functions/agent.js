// Component 1: Site Chat Agent ("Path B")
//
// The homepage chat bar POSTs { messages: [{role, content}, ...] } and renders
// { reply }. This function powers that conversation with Claude, naturally
// collects contact details, and on capture emails Kim a lead (with the full
// transcript) and the requestor a branded confirmation. If the Anthropic call
// fails, it returns the graceful static reply the frontend already expects.

const Anthropic = require('@anthropic-ai/sdk');
const { CONFIG } = require('../../lib/config');
const { send, shell, esc } = require('../../lib/email');
const { put } = require('../../lib/store');

const FALLBACK_REPLY =
  'Thanks for reaching out. Our team will follow up shortly, or you can book a call to talk sooner: ' +
  CONFIG.calendly;

const SYSTEM = `You are the conversational representative for Cascades Human Capital Management LLC (Cascades HCM), a workforce intelligence advisory founded and led by Kimberly Lenoir, based in Houston, Texas. You speak on the website's closing "Start Here" chat.

WHAT CASCADES DOES
Cascades helps organizations design the structure, systems, and leadership to grow without breaking, optimize performance through large-scale transformation, and modernize operating models and service delivery.

FOUR SERVICE MODELS (how work is delivered):
- Managed Services
- AI and Workforce Transformation
- Executive Search
- Fractional and Interim Leadership

SIX PRACTICE AREAS (the substance of the work):
- Workforce Strategy and Transformation
- Organizational Design
- Workforce Planning
- HR Operations and Core HR
- HR Technology Implementation
- AI and People Solutions

THE ASCEND FRAMEWORK is Cascades' method: evidence over opinion, design over advice, and capabilities built to outlast the engagement.

PRODUCTS:
- Ascend People Solutions (an HCM platform: case and ticket submission tracked against response standards, project and deliverable visibility, and a resource library; sold by subscription)
- Executive Growth Accelerator
- The Cascades Organizational Diagnostic (a paid assessment)

YOUR JOB
- Answer questions about the services, practice areas, the Ascend Framework, and the products, concisely and accurately.
- Naturally collect the visitor's name, work email, organization, and the challenge they are facing. Do not interrogate; gather these across the conversation as it fits.
- Once you have all four (name, work email, organization, challenge), call the capture_lead tool exactly once, then confirm to the visitor that a member of the team will follow up within one business day and offer the booking link: ${CONFIG.calendly}

VOICE
Executive, warm, and inviting. Proper capitalization and punctuation. Never use em-dashes. Keep replies to 2 to 5 sentences.

GUARDRAILS
- Never quote prices or make commitments on behalf of Cascades.
- Never give legal advice.
- Never invent capabilities, results, clients, or credentials. Cascades pursues federal contracts, so accuracy is essential; if you do not know something, say the team will confirm.
- Politely decline off-topic or abusive requests and steer back to how Cascades can help.
- You cannot access accounts, process payments, or send anything other than the follow-up this flow arranges.`;

const CAPTURE_TOOL = {
  name: 'capture_lead',
  description:
    'Record the visitor as a lead once you have collected their name, work email, organization, and the challenge they are facing. Call this exactly once, only when all four are known.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Full name of the visitor.' },
      email: { type: 'string', description: 'Work email address.' },
      organization: { type: 'string', description: 'Organization or company name.' },
      challenge: { type: 'string', description: 'The workforce or HR challenge they described.' },
    },
    required: ['name', 'email', 'organization', 'challenge'],
  },
};

function transcriptText(messages) {
  return messages
    .filter((m) => typeof m.content === 'string')
    .map((m) => `${m.role === 'user' ? 'Visitor' : 'Cascades'}: ${m.content}`)
    .join('\n\n');
}

async function emailKimLead(lead, messages) {
  const t = transcriptText(messages);
  const html = shell(`
    <div style="font-family:Georgia,serif;font-size:22px;color:#f4f7ff;margin-bottom:16px;">New lead from the site chat</div>
    <table style="font-size:15px;line-height:1.8;color:#dbe4f6;border-collapse:collapse;">
      <tr><td style="color:#93a6cc;padding-right:14px;">Name</td><td>${esc(lead.name)}</td></tr>
      <tr><td style="color:#93a6cc;padding-right:14px;">Email</td><td>${esc(lead.email)}</td></tr>
      <tr><td style="color:#93a6cc;padding-right:14px;">Organization</td><td>${esc(lead.organization)}</td></tr>
      <tr><td style="color:#93a6cc;padding-right:14px;vertical-align:top;">Challenge</td><td>${esc(lead.challenge)}</td></tr>
    </table>
    <div style="margin-top:24px;color:#93a6cc;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">Full transcript</div>
    <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#c7d3ec;background:rgba(255,255,255,.04);padding:16px;border-radius:8px;">${esc(t)}</pre>
  `);
  return send({
    to: CONFIG.notifyEmail,
    subject: `New lead: ${lead.name}, ${lead.organization}`,
    html,
    replyTo: lead.email,
  });
}

async function emailRequestorConfirmation(lead) {
  const html = shell(`
    <div style="font-family:Georgia,serif;font-size:24px;color:#f4f7ff;margin-bottom:14px;">Thank you, ${esc(lead.name.split(' ')[0])}.</div>
    <div style="font-size:16px;line-height:1.75;color:#dbe4f6;">
      We received your note about ${esc(lead.organization)} and the challenge you are working through. A member of our team will reach out within one business day to understand where your organization is and show you the climb ahead.
    </div>
    <div style="font-size:16px;line-height:1.75;color:#dbe4f6;margin-top:18px;">
      If you would like to talk sooner, you are welcome to book a time directly:
    </div>
    <div style="margin-top:20px;">
      <a href="${esc(CONFIG.calendly)}" style="display:inline-block;background:#c98a3a;color:#0a0f1c;text-decoration:none;font-family:Georgia,serif;font-size:15px;padding:12px 22px;border-radius:8px;">Book a call</a>
    </div>
  `);
  return send({ to: lead.email, subject: 'We received your note at Cascades', html });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ reply: FALLBACK_REPLY }) };
  }

  let messages = [];
  try {
    const body = JSON.parse(event.body || '{}');
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch (_) {
    return { statusCode: 200, body: JSON.stringify({ reply: FALLBACK_REPLY }) };
  }

  // Keep only clean {role, content:string} turns and cap history length.
  const clean = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-24);

  if (!clean.length || clean[0].role !== 'user') {
    // Frontend always leads with a user turn; if not, be graceful.
    return { statusCode: 200, body: JSON.stringify({ reply: FALLBACK_REPLY }) };
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const first = await anthropic.messages.create({
      model: CONFIG.model,
      max_tokens: 700,
      system: SYSTEM,
      tools: [CAPTURE_TOOL],
      messages: clean,
    });

    const toolUse = first.content.find((b) => b.type === 'tool_use' && b.name === 'capture_lead');

    if (!toolUse) {
      const text = first.content.find((b) => b.type === 'text');
      return { statusCode: 200, body: JSON.stringify({ reply: (text && text.text) || FALLBACK_REPLY }) };
    }

    // A lead was captured. Fire side effects, but never let an email failure
    // break the conversation.
    const lead = toolUse.input || {};
    const captured = {
      ...lead,
      capturedAt: new Date().toISOString(),
      transcript: transcriptText(clean),
    };
    try {
      await put('leads', `${Date.now()}-${(lead.email || 'unknown').toLowerCase()}`, captured);
    } catch (e) {
      console.error('lead persist failed', e);
    }
    await Promise.allSettled([emailKimLead(lead, clean), emailRequestorConfirmation(lead)]);

    // Continue the turn so Claude produces a natural confirmation reply.
    const follow = await anthropic.messages.create({
      model: CONFIG.model,
      max_tokens: 500,
      system: SYSTEM,
      tools: [CAPTURE_TOOL],
      messages: [
        ...clean,
        { role: 'assistant', content: first.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content:
                'Lead recorded and the team has been notified. Confirm to the visitor that someone will follow up within one business day, and offer the booking link.',
            },
          ],
        },
      ],
    });

    const followText = follow.content.find((b) => b.type === 'text');
    const reply =
      (followText && followText.text) ||
      `Thank you. A member of our team will follow up within one business day. If you would like to talk sooner, you can book a time here: ${CONFIG.calendly}`;
    return { statusCode: 200, body: JSON.stringify({ reply }) };
  } catch (err) {
    console.error('agent error', err);
    return { statusCode: 200, body: JSON.stringify({ reply: FALLBACK_REPLY }) };
  }
};
