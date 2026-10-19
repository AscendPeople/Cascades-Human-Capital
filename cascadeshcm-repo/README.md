# cascadeshcm.com

The static website for Cascades Human Capital Management, deployed on Netlify.

```
site/                       the website (published folder)
netlify/functions/          serverless functions
  submission-created.js     runs after every Netlify Forms submission and sends the contact to HubSpot
docs/                       campaign playbook, Google Business Profile copy
netlify.toml                Netlify build settings
```

## First-time setup

1. Push this folder to a new GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project → GitHub** and pick the repo. Netlify reads the build settings from `netlify.toml`: the publish directory is `site` and there is no build command.
3. In **Domain management**, add `cascadeshcm.com` and redirect `www` to it.
4. In **Site configuration → Environment variables**, add `HUBSPOT_TOKEN`. This is a HubSpot private app token with the `crm.objects.contacts.read` and `crm.objects.contacts.write` scopes.
5. In **Site configuration → Forms → Form notifications**, add an email notification for **Any form**.
6. In HubSpot, go to **Settings → Marketing → Forms → Non-HubSpot forms** and turn collection off. This stops each contact from being captured twice.
7. Once the site is live, open **Google Search Console** and submit `https://cascadeshcm.com/sitemap.xml`.

## Forms

| Form name | Page | HubSpot lead source |
|---|---|---|
| `inquiry` | connect.html | Website Inquiry |
| `people-infrastructure-gap` | checklist.html | HR Checklist Download |
| `ai-readiness-index` | ai-index.html | AI People Solutions Index |

## Editing

- **Checklist content:** edit the `CATS` list at the bottom of `site/people-infrastructure-gap.html`.
- **Styles:** `site/css/cascades.css`.
- **Pop-up and form behaviour:** `site/js/lead-capture.js`.

Every push to `main` deploys automatically.
