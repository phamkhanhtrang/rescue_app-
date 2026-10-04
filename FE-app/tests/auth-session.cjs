const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup(fetch) {
  const values = new Map();
  let ended = 0;
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/services/apiClient.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export const /g, 'const ');
  vm.runInNewContext(source + '\nmodule.exports = { apiClient, setAuthSession, getAuthToken, setAuthFailureHandler };', {
    module, fetch, process: { env: {} }, FormData: class {}, AbortController, setTimeout, clearTimeout,
    AsyncStorage: { multiSet: async pairs => pairs.forEach(([k, v]) => values.set(k, v)),
      multiRemove: async keys => keys.forEach(k => values.delete(k)) },
  });
  module.exports.setAuthFailureHandler(() => ended++);
  module.exports.setAuthSession('old', 'refresh');
  return { ...module.exports, values, ended: () => ended };
}
const response = (status, data = {}) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(data) });

test('parallel app requests share one refresh', async () => {
  let refreshes = 0;
  const s = setup(async (url, options) => {
    if (url.endsWith('/token/refresh/')) { refreshes++; await new Promise(r => setTimeout(r, 5)); return response(200, { access: 'new' }); }
    return options.headers.Authorization === 'Bearer new' ? response(200, { ok: true }) : response(401);
  });
  await Promise.all([s.apiClient('/one/'), s.apiClient('/two/')]);
  assert.equal(refreshes, 1); assert.equal(s.getAuthToken(), 'new');
});

test('rejected retried access clears a revoked session', async () => {
  const s = setup(async url => url.endsWith('/token/refresh/') ? response(200, { access: 'new' }) : response(401));
  await assert.rejects(s.apiClient('/accounts/me/'));
  assert.equal(s.getAuthToken(), null); assert.equal(s.ended(), 1);
});

test('pending refresh cannot restore a signed-out session', async () => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const s = setup(async url => {
    if (url.endsWith('/token/refresh/')) { started(); return new Promise(resolve => { release = () => resolve(response(200, { access: 'stale' })); }); }
    return response(401);
  });
  const request = s.apiClient('/accounts/me/');
  await ready; s.setAuthSession(null); release();
  await assert.rejects(request);
  assert.equal(s.getAuthToken(), null); assert.equal(s.values.has('userToken'), false);
});

test('public login keeps server error and never refreshes a previous account', async () => {
  let calls = 0;
  const s = setup(async (url, options) => { calls++; assert.equal(options.headers.Authorization, undefined); return response(403, { error: 'Tài khoản đang chờ duyệt.' }); });
  await assert.rejects(s.apiClient('/accounts/login/', { public: true }), /chờ duyệt/);
  assert.equal(calls, 1); assert.equal(s.ended(), 0);
});

test('temporary app refresh network failure retains session', async () => {
  const s = setup(async url => { if (url.endsWith('/token/refresh/')) throw new Error('offline'); return response(401); });
  await assert.rejects(s.apiClient('/accounts/me/'));
  assert.equal(s.getAuthToken(), 'old'); assert.equal(s.ended(), 0);
});
