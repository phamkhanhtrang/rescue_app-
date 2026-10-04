const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

function setup(adapter, stored = { access_token: 'old', refresh_token: 'refresh' }) {
  const values = new Map(Object.entries(stored));
  const redirects = [];
  axios.defaults.adapter = adapter;
  const exports = {};
  const source = fs.readFileSync('src/services/api.ts', 'utf8')
    .replaceAll('import.meta.env', '({ VITE_API_BASE_URL: "", DEV: true })');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require, localStorage: {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }, window: { location: { protocol: 'http:', hostname: '127.0.0.1', replace: path => redirects.push(path) } } });
  return { client: exports.apiClient, values, redirects };
}
function fail(config, status) {
  return Promise.reject(new axios.AxiosError('Rejected', 'ERR_BAD_REQUEST', config, {}, { status, data: {}, config, headers: {} }));
}
const ok = config => ({ status: 200, data: { access: 'new' }, config, headers: {} });

test('parallel 401 requests share refresh and retry with new token', async () => {
  let refreshes = 0;
  const s = setup(async config => {
    if (config.url.endsWith('/token/refresh/')) { refreshes++; await new Promise(r => setTimeout(r, 5)); return ok(config); }
    return config.headers.Authorization === 'Bearer new' ? ok(config) : fail(config, 401);
  });
  await Promise.all([s.client.get('/zones/'), s.client.get('/sos/'), s.client.get('/missions/')]);
  assert.equal(refreshes, 1);
  assert.equal(s.values.get('access_token'), 'new');
  assert.equal(s.redirects.length, 0);
});
test('legacy session without refresh clears once and redirects', async () => {
  const s = setup(config => fail(config, 401), { access_token: 'old' });
  await Promise.allSettled([s.client.get('/zones/'), s.client.get('/sos/')]);
  assert.equal(s.values.has('access_token'), false);
  assert.equal(s.redirects.length, 1);
});
test('invalid refresh ends session; permission errors preserve it', async () => {
  const s = setup(config => fail(config, 401));
  await assert.rejects(s.client.get('/zones/'));
  assert.equal(s.redirects.length, 1);
  const denied = setup(config => fail(config, 403));
  await assert.rejects(denied.client.get('/zones/'));
  assert.equal(denied.values.get('access_token'), 'old');
  assert.equal(denied.redirects.length, 0);
});
test('refresh network failure preserves session and does not loop', async () => {
  let refreshes = 0;
  const s = setup(config => {
    if (config.url.endsWith('/token/refresh/')) { refreshes++; return Promise.reject(new Error('Network Error')); }
    return fail(config, 401);
  });
  await assert.rejects(s.client.get('/zones/'));
  assert.equal(refreshes, 1);
  assert.equal(s.values.get('refresh_token'), 'refresh');
  assert.equal(s.redirects.length, 0);
});
