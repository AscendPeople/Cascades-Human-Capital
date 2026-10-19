// Netlify event function: runs automatically after every verified Netlify Forms submission
// (inquiry, people-infrastructure-gap, ai-readiness-index, any future form).
// It creates or updates the HubSpot contact by email. No per-form setup is needed.
//
// Setup (Netlify > Site configuration > Environment variables):
//   HUBSPOT_TOKEN = private app access token
//     HubSpot > Settings > Integrations > Private Apps > Create
//     Scopes: crm.objects.contacts.read, crm.objects.contacts.write
//
// Requires a Git-connected (or CLI) deploy. Drag-and-drop deploys do not run functions.

const HS = 'https://api.hubapi.com/crm/v3/objects/contacts';

exports.handler = async (event) => {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return { statusCode: 200, body: 'HUBSPOT_TOKEN not set; skipped' };

  let payload;
  try { payload = JSON.parse(event.body).payload; } catch (e) { return { statusCode: 400, body: 'bad payload' }; }
  const d = payload.data || {};
  const form = payload.form_name || 'website';
  const email = (d.email || '').trim().toLowerCase();
  if (!email) return { statusCode: 200, body: 'no email; skipped' };

  const full = (d.name || '').trim().split(/\s+/);
  const sourceByForm = {
    'people-infrastructure-gap': 'HR Checklist Download',
    'inquiry': 'Website Inquiry',
    'ai-readiness-index': 'AI People Solutions Index',
    'hr-checklist': 'HR Checklist Download'
  };

  // Standard HubSpot properties only, so this works on a fresh portal.
  // Everything else is written to a timestamped note on the contact.
  const props = {
    email,
    firstname: full[0] || undefined,
    lastname: full.slice(1).join(' ') || undefined,
    company: d.company || d.organization || undefined,
    jobtitle: d.jobtitle || d.title || undefined,
    lifecyclestage: 'lead'
  };
  Object.keys(props).forEach((k) => props[k] === undefined && delete props[k]);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // upsert by email
  const up = await fetch(`${HS}/batch/upsert`, {
    method: 'POST', headers,
    body: JSON.stringify({ inputs: [{ idProperty: 'email', id: email, properties: props }] })
  });
  if (!up.ok) {
    // lifecyclestage can't move backwards on existing contacts; retry without it
    delete props.lifecyclestage;
    const retry = await fetch(`${HS}/batch/upsert`, {
      method: 'POST', headers,
      body: JSON.stringify({ inputs: [{ idProperty: 'email', id: email, properties: props }] })
    });
    if (!retry.ok) return { statusCode: 502, body: await retry.text() };
  }
  const contactRes = await fetch(`${HS}/${encodeURIComponent(email)}?idProperty=email`, { headers });
  const contact = contactRes.ok ? await contactRes.json() : null;

  // attach the full submission as a note
  if (contact && contact.id) {
    const skip = new Set(['form-name', 'bot-field', 'name', 'email', 'company', 'organization', 'jobtitle', 'title']);
    const lines = Object.entries(d)
      .filter(([k, v]) => !skip.has(k) && v)
      .map(([k, v]) => `<b>${k.replace(/_/g, ' ')}:</b> ${String(v).replace(/</g, '&lt;')}`);
    const body = `<p><b>${sourceByForm[form] || 'Website form'}</b> (${form})</p><p>${lines.join('<br>')}</p>`;
    await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
      method: 'POST', headers,
      body: JSON.stringify({
        properties: { hs_timestamp: new Date().toISOString(), hs_note_body: body },
        associations: [{ to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }]
      })
    });
  }
  return { statusCode: 200, body: 'ok' };
};
