// Component 2: Ascend People Solutions onboarding agent.
//
// Backs the hosted onboarding chat page. Requires a valid onboarding token from
// the Stripe welcome email. Runs a Claude-guided, conversational intake, confirms
// a summary back to the client, and on completion: emails Kim an onboarding
// summary plus a provisioning checklist, emails the client a confirmation of next
// steps and the human kickoff, and persists the intake keyed to the Stripe customer.

const Anthropic = require('@anthropic-ai/sdk');
const { CONFIG } = require('../../lib/config');
const { verify } = require('../../lib/token');
const { send, shell, esc } = require('../../lib/email');
const { put, get } = require('../../lib/store');

const SYSTEM = `You are the onboarding guide for Ascend People Solutions, the HCM platform from Cascades Human Capital Management LLC (Cascades HCM). A new subscriber has just joined and you are welcoming them and learning about their organization so the Cascades team can set up their account well.

Ascend People Solutions provides case and ticket submission tracked against response standards, project and deliverable visibility, and a resource library.

COLLECT, conversationally and warmly (not as a form march):
1. Organization profile: name, size (headcount), and industry.
2. Primary contact (name, role, email) and the team members to provision (names, roles, emails).
3. Their current HR systems (HRIS, payroll, ATS, ticketing, or "none yet").
4. Their top three priorities for the next quarter.
5. Preferred communication cadence (for example weekly, biweekly, or monthly check-ins).

Ask for one or two things at a time. Acknowledge what they share. When you have gathered everything, read a clear summary back to the client and ask them to confirm it is correct. Only after they confirm, call the complete_onboarding tool exactly once with the structured details, then thank them and tell them the Cascades team will reach out to schedule their kickoff.

VOICE
Executive, warm, and inviting. Proper capitalization and punctuation. Never use em-dashes. Keep replies concise.

GUARDRAILS
- Never quote prices or make commitments about deliverables or timelines beyond scheduling the kickoff.
- Never give legal advice.
- Never invent platform capabilities. Cascades pursues federal contracts, so accuracy matters; if unsure, say the team will confirm.
- Politely keep the conversation to onboarding.`;

const COMPLETE_TOOL = {
  name: 'complete_onboarding',
  description:
    'Record the completed onboarding intake. Call exactly once, only after the client has confirmed the summary is correct.',
  input_schema: {
    type: 'object',
    properties: {
      organization: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          size: { type: 'string' },
          industry: { type: 'string' },
        },
        required: ['name'],
      },
      primary_contact: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name'],
      },
      team_members: {
        type: 'array',
        description: 'People to provision on the platform.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
      current_hr_systems: { type: 'string' },
      top_priorities: { type: 'array', items: { type: 'string' } },
      communication_cadence: { type: 'string' },
    },
    required: ['organization', 'primary_contact', 'top_priorities', 'communication_cadence'],
  },
};

function summaryHtml(intake, customerId) {
  const org = intake.organization || {};
  const pc = intake.primary_contact || {};
  const team = Array.isArray(intake.team_members) ? intake.team_members : [];
  const teamRows = team
    .map((t) => `<li>${esc(t.name || '')}${t.role ? ' — ' + esc(t.role) : ''}${t.email ? ' (' + esc(t.email) + ')' : ''}</li>`)
    .join('');
  const priorities = (intake.top_priorities || []).map((p) => `<li>${esc(p)}</li>`).join('');

  return shell(`
    <div style="font-family:Georgia,serif;font-size:22px;color:#f4f7ff;margin-bottom:12px;">Onboarding completed</div>
    <div style="font-size:14px;color:#93a6cc;margin-bottom:18px;">Stripe customer: ${esc(customerId)}</div>
    <table style="font-size:15px;line-height:1.8;color:#dbe4f6;">
      <tr><td style="color:#93a6cc;padding-right:14px;">Organization</td><td>${esc(org.name || '')}${org.size ? ', ' + esc(org.size) : ''}${org.industry ? ', ' + esc(org.industry) : ''}</td></tr>
      <tr><td style="color:#93a6cc;padding-right:14px;">Primary contact</td><td>${esc(pc.name || '')}${pc.role ? ', ' + esc(pc.role) : ''}${pc.email ? ' (' + esc(pc.email) + ')' : ''}</td></tr>
      <tr><td style="color:#93a6cc;padding-right:14px;">Current HR systems</td><td>${esc(intake.current_hr_systems || 'Not specified')}</td></tr>
      <tr><td style="color:#93a6cc;padding-right:14px;">Cadence</td><td>${esc(intake.communication_cadence || '')}</td></tr>
    </table>
    <div style="margin-top:18px;color:#93a6cc;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">Team to provision</div>
    <ul style="color:#dbe4f6;font-size:15px;line-height:1.7;">${teamRows || '<li>None specified</li>'}</ul>
    <div style="margin-top:12px;color:#93a6cc;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">Top priorities</div>
    <ul style="color:#dbe4f6;font-size:15px;line-height:1.7;">${priorities || '<li>None specified</li>'}</ul>
    <div style="margin-top:22px;color:#93a6cc;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">Provisioning checklist</div>
    <ul style="color:#dbe4f6;font-size:15px;line-height:1.7;">
      <li>Create the organization workspace in Ascend People Solutions.</li>
      <li>Invite the primary contact and each team member above.</li>
      <li>Set response standards and confirm case and ticket routing.</li>
      <li>Load the resource library relevant to their priorities.</li>
      <li>Schedule the human kickoff at the client's preferred cadence.</li>
    </ul>
  `);
}

function clientConfirmationHtml(intake) {
  const pc = intake.primary_contact || {};
  const first = (pc.name || '').split(' ')[0];
  return shell(`
    <div style="font-family:Georgia,serif;font-size:24px;color:#f4f7ff;margin-bottom:14px;">Thank you${first ? ', ' + esc(first) : ''}.</div>
    <div style="font-size:16px;line-height:1.75;color:#dbe4f6;">
      Your onboarding is complete and your details are with our team. We will reach out shortly to schedule your kickoff and begin setting up your Ascend People Solutions workspace.
    </div>
    <div style="font-size:16px;line-height:1.75;color:#dbe4f6;margin-top:18px;">
      We are glad to be working with you.
    </div>
  `);
}

// Calls the Ascend People Solutions platform to create the company and invite
// the team. Configured via ASCEND_PROVISION_URL and the shared ONBOARDING_WEBHOOK_SECRET.
// Returns a small status object and never throws.
async function provisionClient(customerId, intake) {
  const url = process.env.ASCEND_PROVISION_URL;
  const secret = process.env.ONBOARDING_WEBHOOK_SECRET;
  if (!url || !secret) {
    return { attempted: false, reason: 'not configured' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-onboarding-secret': secret },
      body: JSON.stringify({ stripe_customer_id: customerId, intake }),
    });
    const data = await res.json().catch(() => ({}));
    return { attempted: true, ok: res.ok, status: res.status, data };
  } catch (e) {
    console.error('provision call failed', e);
    return { attempted: true, ok: false, error: String(e && e.message) };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ reply: '', done: false }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ reply: '', done: false }) };
  }

  const payload = verify(body.token);
  if (!payload || payload.scope !== 'onboarding' || !payload.customerId) {
    return { statusCode: 401, body: JSON.stringify({ reply: '', done: false, error: 'unauthorized' }) };
  }
  const customerId = payload.customerId;

  const clean = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-40);

  // Opening turn: greet if no history yet.
  const messages = clean.length ? clean : [{ role: 'user', content: 'Hello, I just subscribed and am ready to get started.' }];

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const first = await anthropic.messages.create({
      model: CONFIG.model,
      max_tokens: 900,
      system: SYSTEM,
      tools: [COMPLETE_TOOL],
      messages,
    });

    const toolUse = first.content.find((b) => b.type === 'tool_use' && b.name === 'complete_onboarding');

    if (!toolUse) {
      const text = first.content.find((b) => b.type === 'text');
      return {
        statusCode: 200,
        body: JSON.stringify({ reply: (text && text.text) || 'Could you tell me a little about your organization to begin?', done: false }),
      };
    }

    // Onboarding complete. Persist, notify Kim, confirm to client.
    const intake = toolUse.input || {};
    const existing = (await get('onboarding', customerId).catch(() => null)) || { customerId };
    const record = {
      ...existing,
      customerId,
      status: 'completed',
      completedAt: new Date().toISOString(),
      intake,
    };
    try {
      await put('onboarding', customerId, record);
    } catch (e) {
      console.error('onboarding persist failed', e);
    }

    // Provision the client in the Ascend People Solutions platform (creates the
    // company and invites the team). Non-fatal: if provisioning is unavailable,
    // the intake and Kim's checklist email still go out so it can be done by hand.
    const provision = await provisionClient(customerId, intake);
    record.provision = provision;
    try {
      await put('onboarding', customerId, record);
    } catch (_) { /* best effort */ }

    const clientEmail = (intake.primary_contact && intake.primary_contact.email) || existing.email || payload.email;
    await Promise.allSettled([
      send({ to: CONFIG.notifyEmail, subject: `Onboarding completed: ${(intake.organization && intake.organization.name) || customerId}`, html: summaryHtml(intake, customerId) }),
      clientEmail ? send({ to: clientEmail, subject: 'Your Ascend People Solutions onboarding is complete', html: clientConfirmationHtml(intake) }) : Promise.resolve(),
    ]);

    const follow = await anthropic.messages.create({
      model: CONFIG.model,
      max_tokens: 400,
      system: SYSTEM,
      tools: [COMPLETE_TOOL],
      messages: [
        ...messages,
        { role: 'assistant', content: first.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: 'Onboarding recorded and the team has been notified. Thank the client warmly and tell them the Cascades team will reach out to schedule their kickoff.',
            },
          ],
        },
      ],
    });
    const followText = follow.content.find((b) => b.type === 'text');
    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: (followText && followText.text) || 'Thank you. Your onboarding is complete, and our team will reach out to schedule your kickoff.',
        done: true,
      }),
    };
  } catch (err) {
    console.error('onboarding error', err);
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: 'Thank you. We saved your progress. If anything went wrong, our team will follow up to complete your setup.', done: false }),
    };
  }
};
