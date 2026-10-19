// Central configuration. No secrets live here; all keys come from
// Netlify environment variables at runtime.

const CONFIG = {
  // Anthropic model for all agent conversations. The handoff brief specifies
  // claude-sonnet-4-6; override with ANTHROPIC_MODEL if Kim wants a different tier.
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',

  // Where lead and onboarding notifications go.
  notifyEmail: process.env.NOTIFY_EMAIL || 'kimberlylenoir@cascadeshcm.com',

  // Verified Resend sender. Must be on the verified cascadeshcm.com domain.
  fromEmail: process.env.FROM_EMAIL || 'The Cascades Team <hello@cascadeshcm.com>',

  // Public booking link.
  calendly: process.env.CALENDLY_URL || 'https://calendly.com/kimberlylenoir-cascadeshcm/60min',

  // Base URL of the deployed main site (used to build onboarding links).
  siteUrl: process.env.SITE_URL || 'https://cascadeshcm.com',

  brand: 'Cascades Human Capital Management',
};

module.exports = { CONFIG };
