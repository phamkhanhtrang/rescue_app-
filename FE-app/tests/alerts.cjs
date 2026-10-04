const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

function loadModule(file, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = babel.transformSync(source, { configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => imports[name], Date, ...globals });
  return exports;
}

test('explicit type wins over legacy category; rescue directive is retained', () => {
  const policy = loadModule('src/services/alertPolicy.js');
  assert.equal(policy.isEmergencyAlert({ message_type: 'EMERGENCY', category: 'teams' }), true);
  assert.equal(policy.isEmergencyAlert({ message_type: 'BROADCAST', severity: 'HIGH' }), false);
  assert.equal(policy.isEmergencyAlert({ severity: 'critical' }), true);
  const rows = policy.activeAlerts([
    { id: 1, is_active: true, category: 'zone', message_type: 'BROADCAST' },
    { id: 2, is_active: false },
    { id: 3, is_active: true, expires_at: new Date(1000).toISOString() },
  ], 2000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 1);
});

function setupRefresh(load) {
  let focus, onState, tick, cleared = false, removed = false;
  const AppState = { currentState: 'active', addEventListener: (_, callback) => {
    onState = callback; return { remove() { removed = true; } };
  } };
  const hook = loadModule('src/hooks/useLiveRefresh.js', {
    react: { useCallback: f => f, useRef: value => ({ current: value }) },
    'react-native': { AppState },
    '@react-navigation/native': { useFocusEffect: f => { focus = f; } },
  }, { setInterval: callback => { tick = callback; return 1; }, clearInterval: () => { cleared = true; } }).default;
  const refresh = hook(load);
  const cleanup = focus();
  return { refresh, cleanup, tick: () => tick(), state: value => { AppState.currentState = value; onState(value); },
    disposed: () => cleared && removed };
}

test('focus loads once, avoids overlapping requests, background/blur invalidate old responses', async () => {
  const requests = [];
  const hook = setupRefresh(isCurrent => new Promise(resolve => requests.push({ isCurrent, resolve })));
  assert.equal(requests.length, 1);
  await hook.tick();
  assert.equal(requests.length, 1);
  hook.state('background');
  assert.equal(requests[0].isCurrent(), false);
  await hook.tick();
  assert.equal(requests.length, 1);
  hook.state('active');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].isCurrent(), true);
  hook.cleanup();
  assert.equal(requests[1].isCurrent(), false);
  assert.equal(hook.disposed(), true);
  requests.forEach(r => r.resolve());
  await hook.refresh();
  assert.equal(requests.length, 2);
});

test('poll and manual refresh continue after a completed load', async () => {
  let calls = 0;
  const hook = setupRefresh(async () => { calls++; });
  await new Promise(setImmediate);
  await hook.tick();
  await hook.refresh();
  assert.equal(calls, 3);
  hook.cleanup();
});
