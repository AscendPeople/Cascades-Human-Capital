// Stateless signed tokens (HMAC-SHA256). Used for onboarding links and the
// diagnostic access session. Payload is base64url JSON with an expiry; the
// signature prevents tampering. Requires TOKEN_SECRET in the environment.

const crypto = require('crypto');

function secret() {
  const s = process.env.TOKEN_SECRET;
  if (!s) throw new Error('TOKEN_SECRET is not set');
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// ttlSeconds: how long the token is valid.
function sign(payload, ttlSeconds) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', secret()).update(data).digest());
  return `${data}.${sig}`;
}

// Returns the payload object if valid and unexpired, otherwise null.
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret()).update(data).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(fromB64url(data).toString('utf8'));
  } catch (_) {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

module.exports = { sign, verify };
