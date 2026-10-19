// Netlify Blobs persistence wrapper. Used to store captured leads and
// onboarding intake keyed to stable identifiers. Netlify Blobs is available
// automatically to functions on a deployed Netlify site; no keys required.

const { getStore } = require('@netlify/blobs');

function store(name) {
  return getStore(name);
}

async function put(name, key, value) {
  return store(name).setJSON(key, value);
}

async function get(name, key) {
  return store(name).get(key, { type: 'json' });
}

module.exports = { store, put, get };
