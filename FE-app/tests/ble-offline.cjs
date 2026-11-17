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

const protocol = loadModule('src/services/bleProtocol.js');

// ─── Giao thức ───────────────────────────────────────────────────────────────

test('SOS packet round-trips through 20 bytes with CRC', () => {
  const { hexString, byteLength } = protocol.encodeSOSPacket({
    sosId: 3000000123, peopleCount: 4, hasElderly: true, hasInjury: true,
    severity: 3, lat: 16.0544, lng: 108.2022, minutesActive: 17,
  });
  assert.equal(byteLength, 20);
  assert.equal(hexString.length, 40);
  assert.ok(hexString.startsWith('475021'));
  const p = protocol.decodePacket(hexString);
  assert.equal(p.isValid, true);
  assert.equal(p.type, protocol.PACKET_TYPE.SOS);
  assert.equal(p.sosId, 3000000123);
  assert.equal(p.peopleCount, 4);
  assert.deepEqual([p.hasElderly, p.hasChildren, p.hasInjury], [true, false, true]);
  assert.equal(p.severity, 3);
  assert.equal(p.minutesActive, 17);
  assert.equal(p.hasLocation, true);
  assert.ok(Math.abs(p.lat - 16.0544) < 1e-4 && Math.abs(p.lng - 108.2022) < 1e-4);
});

test('a single flipped bit is rejected by the CRC', () => {
  const { hexString } = protocol.encodeSOSPacket({ sosId: 42, lat: 16, lng: 108 });
  const corrupted = hexString.slice(0, 10) + (hexString[10] === '0' ? '1' : '0') + hexString.slice(11);
  assert.equal(protocol.decodePacket(corrupted).isValid, false);
  assert.equal(protocol.decodePacket('DEADBEEF').isValid, false);
  assert.equal(protocol.decodePacket('00'.repeat(20)).isValid, false);
});

test('legacy 16-byte packets still decode; missing GPS is flagged', () => {
  const legacy = protocol.decodePacket('47500001595C250341806F6D42D86788');
  assert.equal(legacy.isValid, true);
  assert.equal(legacy.version, 1);
  assert.equal(legacy.sosId, 88412);
  assert.equal(legacy.peopleCount, 4);

  const noGps = protocol.decodePacket(protocol.encodeSOSPacket({ sosId: 7 }).hexString);
  assert.equal(noGps.hasLocation, false);
});

test('PING and MSG carry target, role and message code', () => {
  const ping = protocol.decodePacket(protocol.encodePingPacket({ targetId: 555, lat: 16, lng: 108, nonce: 9 }).hexString);
  assert.equal(ping.type, protocol.PACKET_TYPE.PING);
  assert.equal(ping.senderRole, protocol.SENDER_ROLE.RESCUER);
  assert.equal(protocol.isAddressedTo(ping, 555), true);
  assert.equal(protocol.isAddressedTo(ping, 556), false);

  const all = protocol.decodePacket(protocol.encodePingPacket({}).hexString);
  assert.equal(protocol.isAddressedTo(all, 556), true);

  const msg = protocol.decodePacket(protocol.encodeMessagePacket({
    targetId: 555, code: 103, senderRole: protocol.SENDER_ROLE.RESCUER }).hexString);
  assert.equal(msg.type, protocol.PACKET_TYPE.MSG);
  assert.equal(msg.text, 'Giữ nguyên vị trí, đang tiếp cận gác lửng');
  assert.equal(protocol.decodeSOSPacket(msg.hexString).isValid, false);
});

test('distance helpers: RSSI, haversine, bearing and source selection', () => {
  assert.equal(protocol.calculateDistance(null), null);
  assert.equal(protocol.calculateDistance(-59), 1);
  assert.ok(protocol.calculateDistance(-89) > protocol.calculateDistance(-70));
  assert.equal(protocol.smoothRSSI(null, -70), -70);
  assert.equal(protocol.smoothRSSI(-70, null), -70);

  // 0.001° vĩ độ ≈ 111 m về phía Bắc.
  const north = protocol.haversineMeters(16, 108, 16.001, 108);
  assert.ok(Math.abs(north - 111.2) < 1);
  assert.ok(Math.abs(protocol.bearingDegrees(16, 108, 16.001, 108)) < 0.5);
  assert.ok(Math.abs(protocol.bearingDegrees(16, 108, 16, 108.001) - 90) < 0.5);
  assert.equal(protocol.compassLabel(135), 'Đông Nam');

  assert.deepEqual({ ...protocol.resolveDistance(42, 30) }, { distanceM: 42, source: 'GPS' });
  assert.deepEqual({ ...protocol.resolveDistance(12, 6) }, { distanceM: 6, source: 'RSSI' });
  assert.deepEqual({ ...protocol.resolveDistance(40, null) }, { distanceM: 40, source: 'GPS' });
  assert.deepEqual({ ...protocol.resolveDistance(null, null) }, { distanceM: null, source: null });
});

// ─── Luồng phao ↔ radar ↔ đồng bộ, với "không gian vô tuyến" giả trong bộ nhớ ──

const SPEEDUP = 200; // 1 giây trong service = 5 ms trong test
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function createAir() {
  const stations = [];
  return {
    transportFor(name) {
      const station = { name, advertising: {}, onPacket: null };
      stations.push(station);
      const deliver = () => stations.forEach(listener => {
        if (!listener.onPacket) return;
        stations.forEach(sender => {
          if (sender === listener) return;
          Object.values(sender.advertising).forEach(hex => listener.onPacket({ hex, rssi: -100 }));
        });
      });
      return {
        name: 'FAKE', isSimulated: false, deliver,
        prepare: async () => ({ ok: true }),
        advertise: async (slot, hex) => { station.advertising[slot] = hex; deliver(); },
        stopAdvertise: async slot => { delete station.advertising[slot]; },
        startScan: async onPacket => { station.onPacket = onPacket; deliver(); },
        stopScan: async () => { station.onPacket = null; },
      };
    },
  };
}

function loadService(name, air, api) {
  const storage = new Map();
  const transport = air.transportFor(name);
  const sounds = { played: 0 };
  const service = loadModule('src/services/bleGridService.js', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async k => (storage.has(k) ? storage.get(k) : null),
      setItem: async (k, v) => { storage.set(k, v); },
      removeItem: async k => { storage.delete(k); },
    } },
    'react-native': { Platform: { OS: 'web' } },
    'expo-haptics': {},
    'expo-av': { Audio: {
      setAudioModeAsync: async () => {},
      Sound: { createAsync: async () => {
        sounds.played += 1;
        return { sound: { replayAsync: async () => {}, stopAsync: async () => {}, unloadAsync: async () => {} } };
      } },
    } },
    './apiClient': { apiClient: api },
    './bleTransport': { getTransport: () => transport, getDeviceId: async () => `device-${name}` },
    './bleProtocol': protocol,
  }, {
    setTimeout: (fn, ms) => setTimeout(fn, (ms || 0) / SPEEDUP),
    setInterval: (fn, ms) => setInterval(fn, Math.max(1, (ms || 0) / SPEEDUP)),
    clearTimeout, clearInterval, Promise, Math, Number, JSON, Map, Set, Object, console,
  });
  return { service, transport, sounds, storage };
}

test('beacon is found by the radar, ping and messages cross, rescue is synced once', async () => {
  const air = createAir();
  const uploads = [];
  let online = false;
  const api = async (endpoint, options) => {
    if (!online) { const e = new Error('offline'); e.status = 0; throw e; }
    const body = JSON.parse(options.body);
    uploads.push(body);
    return { synced_count: body.packets.length, synced_items: body.packets.map((p, index) => ({ index })), rejected: [] };
  };
  const citizen = loadService('citizen', air, api);
  const rescuer = loadService('rescuer', air, api);

  try {
  // Người dân bật phao; cứu hộ đứng cách ~111 m về phía Nam và bắt đầu quét.
  const beacon = await citizen.service.startCitizenBeacon({ peopleCount: 3, hasChildren: true, severity: 3, lat: 16.001, lng: 108 });
  assert.equal(beacon.isActive, true);
  rescuer.service.setRescuerPosition({ lat: 16, lng: 108 });
  let signals = [];
  await rescuer.service.startRescuerScanner(list => { signals = list; });
  await wait(30);

  assert.equal(signals.length, 1);
  const found = signals[0];
  assert.equal(found.sosId, beacon.sosId);
  assert.equal(found.peopleCount, 3);
  assert.equal(found.hasChildren, true);
  assert.equal(found.distanceSource, 'GPS');
  assert.ok(Math.abs(found.gpsDistanceM - 111.2) < 1.5);
  assert.ok(found.bearing <= 1 || found.bearing >= 359);
  assert.equal(found.smoothedRSSI, -100);
  assert.ok(found.rssiDistanceM > 15);

  // PING tới đúng phao: còi hú đúng một lần dù gói tin được nghe lặp lại.
  const pings = [];
  citizen.service.subscribeToPing(p => pings.push(p));
  await rescuer.service.sendRemotePing(beacon.sosId);
  citizen.transport.deliver();
  citizen.transport.deliver();
  await wait(20);
  assert.equal(pings.length, 1);
  assert.ok(Math.abs(pings[0].rescuerDistanceM - 111) <= 2);
  assert.equal(citizen.sounds.played, 1);

  // PING tới phao khác thì bị bỏ qua.
  await wait(60);
  await rescuer.service.sendRemotePing(beacon.sosId + 1);
  await wait(20);
  assert.equal(pings.length, 1);

  // Tin nhắn hai chiều.
  await wait(60);
  await rescuer.service.sendQuickChatMessage('RESCUER', 101, beacon.sosId);
  await wait(60);
  await citizen.service.sendQuickChatMessage('CITIZEN', 3);
  await wait(60);
  const citizenChat = await citizen.service.getQuickChatHistory();
  const rescuerChat = await rescuer.service.getQuickChatHistory();
  // So sánh qua JSON vì mảng được tạo trong realm khác của vm.
  assert.equal(JSON.stringify(citizenChat.map(m => [m.senderRole, m.text, m.mine])), JSON.stringify([
    ['CITIZEN', 'Có trẻ nhỏ bị sốt cao', true],
    ['RESCUER', 'Ca-nô đã tới đầu ngõ', false],
  ]));
  assert.equal(JSON.stringify(rescuerChat.map(m => [m.senderRole, m.sosId, m.mine])), JSON.stringify([
    ['CITIZEN', beacon.sosId, false],
    ['RESCUER', beacon.sosId, true],
  ]));

  // Mất mạng: đánh dấu đã cứu vẫn được lưu, đồng bộ báo offline và giữ nguyên hàng đợi.
  assert.equal(await rescuer.service.getOfflineQueueCount(), 1);
  await rescuer.service.markVictimResolvedOffline(found, 'Đã cứu 3 người');
  const failed = await rescuer.service.syncOfflineQueueToBackend();
  assert.equal(failed.success, false);
  assert.equal(failed.offline, true);
  assert.equal(await rescuer.service.getOfflineQueueCount(), 1);
  await wait(15);
  assert.equal(signals.length, 0, 'phao đã cứu phải biến mất khỏi radar');

  // Có mạng: gửi đúng một hồ sơ RESOLVED, lần sau không gửi lại.
  online = true;
  const ok = await rescuer.service.syncOfflineQueueToBackend();
  assert.equal(ok.success, true);
  assert.equal(ok.syncedCount, 1);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].device_id, 'device-rescuer');
  assert.equal(uploads[0].packets[0].status, 'RESOLVED');
  assert.equal(protocol.decodePacket(uploads[0].packets[0].hex_packet).sosId, beacon.sosId);
  assert.equal(await rescuer.service.getOfflineQueueCount(), 0);
  const again = await rescuer.service.syncOfflineQueueToBackend();
  assert.equal(again.empty, true);

  // Máy nạn nhân cũng tự gửi SOS của chính mình (trạng thái PENDING) khi có mạng.
  const own = await citizen.service.syncOfflineQueueToBackend();
  assert.equal(own.success, true);
  assert.equal(uploads[uploads.length - 1].packets[0].status, 'PENDING');

  await citizen.service.stopCitizenBeacon();
  assert.equal(citizen.service.getCitizenBeaconState().isActive, false);
  } finally {
    // Dọn mọi timer để tiến trình test thoát được kể cả khi có assert thất bại.
    await citizen.service.stopCitizenBeacon();
    await rescuer.service.stopRescuerScanner();
  }
});

test('citizen cannot send messages without an active beacon; transport errors surface', async () => {
  const air = createAir();
  const lonely = loadService('lonely', air, async () => ({}));
  await assert.rejects(() => lonely.service.sendQuickChatMessage('CITIZEN', 1), /kích hoạt phao/);

  lonely.transport.prepare = async () => ({ ok: false, reason: 'Bluetooth đang tắt.' });
  await assert.rejects(() => lonely.service.startCitizenBeacon({ lat: 16, lng: 108 }), /Bluetooth đang tắt/);
  await assert.rejects(() => lonely.service.startRescuerScanner(() => {}), /Bluetooth đang tắt/);
});
