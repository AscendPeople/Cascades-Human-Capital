# The People Infrastructure Gap: Campaign Playbook

**Campaign:** Cascades | People Infrastructure Gap | Inbound Lead Generation
**Status:** Built, not yet live. Nothing below is operational until the steps in section 7 are completed and tested.

## 1. What was built (in `site-v6/`)

| File | Purpose |
|---|---|
| `people-infrastructure-gap.html` | The 8-page executive document. 25 checkpoints, three response options, auto-filled summary, priority matrix, Ascend Framework, and CTA page. Complete it on screen or print it. Use "Save as PDF" to make the PDF. Text stays selectable, and the Calendly link stays clickable. |
| `checklist.html` | Public landing page: SEO copy, cover mockup, gated form, confirmation state, FAQ. |
| `js/lead-capture.js` | Form submission (HubSpot plus a Netlify backup), the pop-up on desktop, the banner on mobile, frequency rules, and event tracking. |
| `hr-readiness-checklist.html` | **The old 40-item checklist.** Nothing links to it any more. Delete it once you approve. |

**Editable source:** the 25 checkpoints are plain text in the `CATS` list near the bottom of `people-infrastructure-gap.html`. Edit the wording there and every page updates.

**Producing the PDF:** open `people-infrastructure-gap.html` in Chrome, click Save as PDF, and choose Letter, margins None, with "Background graphics" turned on. Upload the PDF to HubSpot Files if you want the delivery email to attach it (see section 3).

## 2. Gated delivery and its limits

- The document address is not in the landing page's source. The script adds it only after a successful submission.
- The document is set to `noindex`, and `robots.txt` asks search engines not to crawl it, so it shouldn't appear in Google results.
- **Limit:** this is a static site, so anyone who has the direct URL can open the document. Links can be shared. That is normal and acceptable for a free resource. True per-person access would need expiring links, for example a Netlify Function that issues signed URLs. Not recommended at this stage.
- Returning visitors who have already downloaded skip the form, and the pop-up stops appearing for them. Both are remembered in the visitor's browser.

## 3. HubSpot setup (free CRM works for capture)

### Create the form
In HubSpot, go to **Marketing > Forms > Create > Embedded form** and name it `People Infrastructure Gap`. Add the fields listed below. In Share, copy the **Portal ID** and **Form GUID** into `HUBSPOT` at the top of `js/lead-capture.js`.

### Field mapping

| Site field | HubSpot property | Type | Notes |
|---|---|---|---|
| Full name | `firstname` + `lastname` | default | Split on the first space |
| Business email | `email` | default | |
| Company name | `company` | default | |
| Job title | `jobtitle` | default | |
| Biggest challenge | `hr_challenge` | **create**: dropdown, same 6 options | Optional |
| (hidden) | `cascades_lead_source` | **create**: single-line text | Always "HR Checklist Download" |
| (hidden) | `cascades_service_interest` | **create**: single-line text | "Fractional / Interim HR Leadership" |
| (hidden) | `cascades_entry_point` | **create**: single-line text | popup_*, banner_*, people_inline, direct, linkedin_* |
| Marketing checkbox | Subscription type | **create**: "HR leadership insights" | Replace `999` in `lead-capture.js` with its ID (Settings > Marketing > Email > Subscription types) |

- **Lifecycle stage:** set the form's default contact lifecycle stage to **Lead**.
- **Original source:** HubSpot keeps original traffic attribution automatically when the **HubSpot tracking code** is on the site. Add the script tag from Settings > Tracking code to the `<head>` of every page. The form also sends the `hubspotutk` cookie.
- **No automatic deals:** don't create deals from this form. Create a deal only when a contact books a consultation or replies with intent.

### Backup capture
Every submission also goes to **Netlify Forms** as `people-infrastructure-gap`, including UTM source/medium/campaign, referrer, landing page, and entry point. If HubSpot is down or misconfigured, no lead is lost.

### Segmentation (active lists)
- **Executive buyers:** job title contains CEO, founder, president, owner, COO, or chief.
- **High intent:** `hr_challenge` is "no strategic HR leadership" or "need interim HR leadership".
- **Transformation:** `hr_challenge` is "transformation" or "modernize HR systems".
- **Consult requested:** booked through Calendly. Connect Calendly to HubSpot, or tag by hand.
- **Engaged:** opened or clicked 2 or more nurture emails.

### Delivery email and nurture: tier dependency
- **Immediate delivery email:** sending email from a form needs a HubSpot form follow-up email or a workflow. On **Free**, use the form's built-in "Send follow-up email" option, if it's available on your portal. Otherwise use **Starter (~$20/mo)**. The site already delivers the document instantly on screen, so the email is a convenience, not a dependency.
- **Days 2/5/8 sequence:** needs **Marketing Hub Professional** (workflows). Low-cost alternatives:
  - HubSpot Starter: send the three emails as scheduled marketing emails to the "HR Checklist Download, consented" list.
  - Or MailerLite / Brevo free tiers, synced from HubSpot or exported weekly.
- Send nurture emails **only** to contacts who ticked the marketing checkbox. Every email needs an unsubscribe link and your mailing address.

### Nurture emails (drafts)

**Immediately: Your executive checklist is ready**
> Hi {{firstname}}, here is *The People Infrastructure Gap*: [Download the checklist]. It takes about 15 minutes. Mark each checkpoint honestly, then use the priority matrix on page 6 to choose your three most consequential gaps. If you'd like a second opinion on what you find, [book a 30-minute strategy consultation].

**Day 2: The gap most CEOs don't see**
> Most growing companies don't lack HR activity. They lack HR *leadership*. The tell is checkpoint 4: when routine people issues reach the CEO, strategy time is being spent on operations. If that's you, it isn't a staffing problem. It's a structural one, and it usually gets more expensive with each new hire.

**Day 5: When fractional or interim HR leadership makes sense**
> A full-time CHRO is right for some organizations and premature for others. Fractional leadership fits when you need executive judgment on a set cadence without the cost of the full role. Interim leadership fits when you need someone to own HR completely through a transition, such as a vacancy, a restructure, or an acquisition. Either way, the work should leave infrastructure behind, not dependency.

**Day 8: Bring your checklist to a conversation**
> If you've completed the checklist, you already have the agenda. In 30 minutes we'll go through your top three gaps and what we'd do first. No obligation. [Schedule a 30-minute strategy consultation]

## 4. Pop-up rules (as built)

- **Desktop:** opens after 30 seconds, after scrolling 50% of the page, or on exit intent (pointer leaving the top of the window, after 8 seconds). It never opens on page load, and it waits if someone is typing in a form.
- **Mobile:** a small dismissible bottom banner after 55% scroll. No full-screen interstitial.
- **Frequency:** once per session, suppressed for 14 days after "Not now", and never shown again after a download.
- **Never shown on:** the landing page, Connect, the document itself, the AI Index, or the Diagnostic.
- **Accessibility:** a labelled dialog with focus held inside it. Escape, the × button, a click on the backdrop, or "Not now" closes it, and focus returns to where it was.

## 5. Tracking

The script sends events to whichever tools are installed: Google Tag Manager or GA4, Plausible, or HubSpot's tracking code. With none installed, nothing is sent.

| Event | Meaning |
|---|---|
| `pig_popup_impression` | Pop-up or banner shown (trigger: time_30s, scroll, exit_intent) |
| `pig_popup_click` | CTA clicked |
| `pig_popup_dismiss` | Closed or "Not now" |
| `pig_inline_click` | People page promo clicked |
| `pig_form_start` | First field focused |
| `pig_form_complete` | Successful submission |
| `pig_download` | "Download my checklist" clicked |
| `consult_click` | Strategy consultation clicked from the confirmation |

- **Bookings:** consultations booked are measured in Calendly. Connect Calendly to HubSpot or GA4 to see them alongside the other events.
- **Privacy:** if you add GA4 and serve EU/UK visitors, add a consent banner first. Plausible needs no cookie banner.

## 6. LinkedIn: three concepts

Link every post to `https://cascadeshcm.com/checklist.html?utm_source=linkedin&utm_medium=organic&utm_campaign=people_infrastructure_gap&utm_content=<concept>`.

**Concept 1: The Growth Gap** (`utm_content=growth`)
> Your company has grown. Has your people infrastructure kept pace?
>
> Revenue scales faster than structure. The org chart that worked at 60 people starts slowing decisions at 160, and the cost shows up as rework, turnover, and a leadership team pulled into problems that should be solved two levels down.
>
> We built a 25-point executive checklist to show you where. Five areas, about 15 minutes, and a priority matrix to rank what you find.
>
> Download *The People Infrastructure Gap*, complimentary → [link]

*Visual:* the cover mockup on a light ground, with "60 → 160 employees" set in large uppercase type.

**Concept 2: The Leadership Gap** (`utm_content=leadership`)
> You may not need a full-time CHRO. But your organization still needs strategic HR leadership.
>
> When no one owns people strategy at the executive level, the CEO becomes the default HR escalation. That's the most expensive HR function there is.
>
> The checklist starts with the five checkpoints that reveal it. → [link]
>
> Already evaluating fractional or interim HR leadership? Skip the checklist and message us, or book directly: https://calendly.com/kimberly_lenoir/strategy-chat

*Visual:* navy card, the line "Who owns people strategy?" in large uppercase, and a small cover mockup in the corner.

**Concept 3: The Transformation Gap** (`utm_content=transformation`)
> Growth exposes what your HR infrastructure was never designed to handle.
>
> Systems that don't talk to each other. Data no one trusts. Processes that depend on one person. Managers promoted but never equipped.
>
> 25 checkpoints across leadership, structure, operations, technology, and talent, with a simple way to decide what to fix first. → [link]

*Visual:* a document carousel (LinkedIn PDF post) showing pages 1, 3 and 6 of the checklist, with a final slide pointing to the landing page.

**Cadence:** one concept per week from your personal profile, then reshared from the company page. Reply to every comment within the day.

## 7. SEO and AI search (implemented on `checklist.html`)

- **Title:** Free Executive HR Checklist: The People Infrastructure Gap | Cascades HCM
- **Meta description:** A complimentary 25-point executive checklist for CEOs and founders of growing companies. Find the gaps in HR leadership, operations, systems, and talent before they slow growth.
- **H1:** Is your organization growing faster than its people infrastructure?
- **H2s:**
  - Get the complimentary executive checklist
  - Twenty-five checkpoints. Five areas. Three priorities.
  - Before you download
- **FAQs:** five Q&As, including "What is fractional HR leadership?". They are marked up as FAQPage structured data.
- **Structured data:** BreadcrumbList, FAQPage, and a DigitalDocument entry marked free to access. The page is also listed in `sitemap.xml` and `llms.txt`.
- **Internal links:** People (fractional and interim), Capabilities, and Connect inquiry. The People page links back with a promo band.
- **Images:** the cover mockup is decorative (`aria-hidden`), so it needs no alt text. The logos carry alt text.
- **Ranking:** no ranking or AI-answer placement is guaranteed. Expect early traction from LinkedIn and direct traffic, and from search over 3–6 months.

## 8. Implementation and testing checklist

**Before launch**
- [ ] Review all 25 checkpoints and the document copy. Edit them in `CATS`.
- [ ] Create the HubSpot form, properties, and subscription type. Paste the Portal ID and Form GUID into `lead-capture.js`, and replace `999`.
- [ ] Install the HubSpot tracking code on every page.
- [ ] Confirm `https://calendly.com/kimberly_lenoir/strategy-chat` is the 30-minute event and that it's public.
- [ ] Generate the PDF from the document and spot-check all 8 pages.
- [ ] Deploy to Netlify, then confirm the `people-infrastructure-gap` form appears under Forms.

**Test (desktop Chrome, Safari, mobile iOS/Android)**
- [ ] Submitting with empty fields highlights them and shows an error. An invalid email is rejected.
- [ ] A valid submission shows "Your executive checklist is ready." The Download button opens the document. Nothing redirects to Calendly.
- [ ] A contact is created in HubSpot with lifecycle stage Lead, `cascades_lead_source`, challenge, and entry point. The marketing checkbox maps to the subscription.
- [ ] The Netlify Forms backup receives the same submission, including UTMs.
- [ ] A test with `?utm_source=linkedin` shows the source on the contact.
- [ ] The pop-up appears after about 30 seconds or 50% scroll on desktop, not on load. "Not now" suppresses it, and so does a download. It doesn't appear on Connect or the landing page.
- [ ] On mobile, the banner appears after scrolling, can be dismissed, and doesn't block content.
- [ ] Keyboard only: Tab stays inside the pop-up, and Escape closes it.
- [ ] Document: responses persist after reload, the summary fills in, the matrix lists the marked gaps, the printed PDF has 8 pages, and the CTA link is clickable in the PDF.
- [ ] The delivery email, if configured, arrives with the link. Nurture emails go only to contacts who consented.
