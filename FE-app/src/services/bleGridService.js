/**
 * src/services/bleGridService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Điều phối cứu nạn ngoại tuyến BLE (Guardian Pulse Offline Grid).
 *
 * Mọi trao đổi đều là gói tin 0xGP 20 bytes phát bằng BLE Advertising (không kết nối):
 *  - Người dân phát gói SOS liên tục, đồng thời quét để nghe PING / tin nhắn của cứu hộ.
 *  - Cứu hộ quét gói SOS; phát gói PING / MSG trong vài giây khi cần.
 *  - Máy nào nghe được gói SOS cũng lưu lại và tự đẩy lên máy chủ khi có mạng ("bồ câu").
 *
 * Tầng truyền tải (BLE thật hay mô phỏng) được chọn trong bleTransport.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { apiClient } from './apiClient';
import { getTransport, getDeviceId } from './bleTransport';
import {
  PACKET_TYPE,
  SENDER_ROLE,
  BROADCAST_ID,
  encodeSOSPacket,
  encodePingPacket,
  encodeMessagePacket,
  decodePacket,
  isAddressedTo,
  generateBeaconId,
  messageTextForCode,
  calculateDistance,
  smoothRSSI,
  haversineMeters,
  bearingDegrees,
  resolveDistance,
} from './bleProtocol';

const STORAGE_KEYS = {
  MY_BEACON: 'gp_ble_my_beacon_v2',
  RELAY_QUEUE: 'gp_ble_relay_queue_v2',
  CHAT_MESSAGES: 'gp_ble_quick_chat_v2',
};

const TX_DURATION_MS = 6000; // thời gian phát một lệnh PING / tin nhắn
const SIGNAL_STALE_MS = 8000; // quá lâu không nghe thấy → đánh dấu mất sóng
const SIGNAL_DROP_MS = 30000; // quá lâu nữa → bỏ khỏi radar
const QUEUE_MAX_AGE_MS = 48 * 3600 * 1000;
const AUTO_SYNC_INTERVAL_MS = 60000;
const SYNC_BATCH_SIZE = 200;

const listeners = {
  onPulse: new Set(),
  onDiscovered: new Set(),
  onPing: new Set(),
  onChatMessage: new Set(),
  onQueueChange: new Set(),
};

const emit = (set, payload) => set.forEach((fn) => { try { fn(payload); } catch (e) {} });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getTransportInfo() {
  const transport = getTransport();
  return { name: transport.name, isSimulated: transport.isSimulated };
}

// ─────────────────────────────────────────────────────────────────────────────
// ÂM THANH & RUNG (file âm thanh đóng gói sẵn, phát được khi mất mạng)
// ─────────────────────────────────────────────────────────────────────────────

const BEEP_ASSET = require('../../assets/sounds/sonar_beep.wav');
const SIREN_ASSET = require('../../assets/sounds/alarm_siren.wav');

let beepSound = null;
let sirenSound = null;
let sirenStopTimer = null;
let sirenHapticTimer = null;
let sirenSession = 0;

export async function triggerHaptic(type = 'impact') {
  try {
    if (Platform.OS === 'web') return;
    if (type === 'alarm') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (type === 'warning') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch (err) {}
}

async function prepareAudio() {
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
}

/** Tiếng bíp sonar của radar cứu hộ. */
export async function playSonarBeep() {
  try {
    triggerHaptic('impact');
    if (!beepSound) {
      await prepareAudio();
      const { sound } = await Audio.Sound.createAsync(BEEP_ASSET, { volume: 1.0 });
      beepSound = sound;
    }
    await beepSound.replayAsync();
  } catch (err) {}
}

/** Hú còi báo vị trí. Tự tắt sau `durationMs` hoặc khi gọi stopAlarmSiren(). */
export async function playAlarmSiren(durationMs = 15000) {
  await stopAlarmSiren();
  const session = sirenSession;
  triggerHaptic('alarm');
  sirenHapticTimer = setInterval(() => triggerHaptic('alarm'), 700);
  sirenStopTimer = setTimeout(() => { stopAlarmSiren(); }, durationMs);
  try {
    await prepareAudio();
    const { sound } = await Audio.Sound.createAsync(SIREN_ASSET, { shouldPlay: true, isLooping: true, volume: 1.0 });
    // Nếu còi đã bị tắt (hoặc bật lại lần khác) trong lúc đang nạp âm thanh thì bỏ bản này.
    if (session !== sirenSession) {
      await sound.unloadAsync().catch(() => {});
      return;
    }
    sirenSound = sound;
  } catch (err) {}
}

export async function stopAlarmSiren() {
  sirenSession += 1;
  clearInterval(sirenHapticTimer);
  clearTimeout(sirenStopTimer);
  sirenHapticTimer = null;
  sirenStopTimer = null;
  const sound = sirenSound;
  sirenSound = null;
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (e) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRẠNG THÁI DÙNG CHUNG: QUÉT, PHÁT TẠM, CHỐNG TRÙNG
// ─────────────────────────────────────────────────────────────────────────────

const citizen = { active: false, sosId: null, startedAt: 0, config: null, hex: '', pulseTimer: null };
const rescuer = { active: false, position: null, signals: new Map(), emitTimer: null, onUpdate: null };

let scanRunning = false;
let autoSyncTimer = null;
const seenEvents = new Map(); // khoá sự kiện → thời điểm, để một lệnh PING / tin nhắn chỉ xử lý một lần

function firstTimeSeen(key) {
  const now = Date.now();
  if (seenEvents.size > 300) {
    seenEvents.forEach((at, k) => { if (now - at > 120000) seenEvents.delete(k); });
  }
  if (seenEvents.has(key)) return false;
  seenEvents.set(key, now);
  return true;
}

async function refreshScan() {
  const shouldRun = citizen.active || rescuer.active;
  if (shouldRun && !scanRunning) {
    scanRunning = true;
    try {
      await getTransport().startScan(handlePacket);
    } catch (e) {
      scanRunning = false;
      throw e;
    }
  } else if (!shouldRun && scanRunning) {
    scanRunning = false;
    await getTransport().stopScan().catch(() => {});
  }
  if (shouldRun && !autoSyncTimer) {
    autoSyncTimer = setInterval(() => { syncOfflineQueueToBackend(); }, AUTO_SYNC_INTERVAL_MS);
    syncOfflineQueueToBackend();
  } else if (!shouldRun && autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
}

let txChain = Promise.resolve();

/** Phát tạm một gói tin trong vài giây. Promise hoàn tất ngay khi bắt đầu phát được. */
function transmit(hex, durationMs = TX_DURATION_MS) {
  return new Promise((resolve, reject) => {
    txChain = txChain.then(async () => {
      const transport = getTransport();
      try {
        await transport.advertise('tx', hex, { fast: true });
        resolve();
      } catch (e) {
        reject(e);
        return;
      }
      await sleep(durationMs);
      await transport.stopAdvertise('tx').catch(() => {});
    });
  });
}

function handlePacket({ hex, rssi }) {
  const packet = decodePacket(hex);
  if (!packet.isValid) return;

  if (packet.type === PACKET_TYPE.SOS) {
    if (citizen.active && packet.sosId === citizen.sosId) return;
    if (rescuer.active) trackSignal(packet, rssi);
    rememberForRelay(packet, rssi);
    return;
  }

  if (packet.type === PACKET_TYPE.PING) {
    if (!citizen.active || packet.senderRole !== SENDER_ROLE.RESCUER) return;
    if (!isAddressedTo(packet, citizen.sosId)) return;
    if (!firstTimeSeen(`ping:${packet.targetId}:${packet.nonce}`)) return;
    let rescuerDistanceM = null;
    if (packet.hasLocation && citizen.config) {
      rescuerDistanceM = Math.round(haversineMeters(citizen.config.lat, citizen.config.lng, packet.lat, packet.lng));
    }
    playAlarmSiren();
    emit(listeners.onPing, { targetId: packet.targetId, timestamp: Date.now(), rescuerDistanceM });
    return;
  }

  if (packet.type === PACKET_TYPE.MSG) {
    const fromRescuer = packet.senderRole === SENDER_ROLE.RESCUER;
    const wanted = fromRescuer
      ? citizen.active && isAddressedTo(packet, citizen.sosId)
      : rescuer.active && packet.senderRole === SENDER_ROLE.CITIZEN;
    if (!wanted) return;
    if (!firstTimeSeen(`msg:${packet.senderRole}:${packet.targetId}:${packet.code}:${packet.nonce}`)) return;
    triggerHaptic('warning');
    storeChatMessage({
      id: `rx-${packet.senderRole}-${packet.targetId}-${packet.code}-${packet.nonce}`,
      senderRole: fromRescuer ? 'RESCUER' : 'CITIZEN',
      code: packet.code,
      text: packet.text,
      sosId: packet.targetId === BROADCAST_ID ? null : packet.targetId,
      mine: false,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN HỆ 1: PHAO CỨU SINH (NGƯỜI DÂN)
// ─────────────────────────────────────────────────────────────────────────────

function buildCitizenPacket() {
  const minutesActive = Math.floor((Date.now() - citizen.startedAt) / 60000);
  return encodeSOSPacket({ ...citizen.config, sosId: citizen.sosId, minutesActive });
}

async function persistCitizenState() {
  await AsyncStorage.setItem(STORAGE_KEYS.MY_BEACON, JSON.stringify({
    isActive: citizen.active,
    sosId: citizen.sosId,
    startedAt: citizen.startedAt,
    config: citizen.config,
    packetHex: citizen.hex,
  })).catch(() => {});
}

function citizenSnapshot() {
  return {
    isActive: citizen.active,
    sosId: citizen.sosId,
    startedAt: citizen.startedAt,
    packetHex: citizen.hex,
    config: citizen.config,
    elapsedSec: citizen.active ? Math.floor((Date.now() - citizen.startedAt) / 1000) : 0,
    transport: getTransportInfo(),
  };
}

async function advertiseCitizenPacket() {
  const packet = buildCitizenPacket();
  await getTransport().advertise('sos', packet.hexString, { fast: false });
  citizen.hex = packet.hexString;
  // Máy của chính nạn nhân cũng tự gửi SOS lên máy chủ nếu bắt được mạng.
  rememberForRelay(packet.decodedSummary, null);
}

/**
 * Bật phao cứu sinh. Ném Error (có message tiếng Việt) nếu không phát được sóng.
 * `resume` dùng để phát lại phao cũ (giữ nguyên ID và thời điểm bật) sau khi mở lại app.
 */
export async function startCitizenBeacon(config, resume = null) {
  const transport = getTransport();
  const ready = await transport.prepare();
  if (!ready.ok) throw new Error(ready.reason);

  await stopCitizenBeacon();
  citizen.config = {
    peopleCount: config.peopleCount || 1,
    hasElderly: !!config.hasElderly,
    hasChildren: !!config.hasChildren,
    hasInjury: !!config.hasInjury,
    severity: config.severity || 2,
    lat: Number(config.lat) || 0,
    lng: Number(config.lng) || 0,
  };
  citizen.sosId = resume?.sosId || generateBeaconId();
  citizen.startedAt = resume?.startedAt || Date.now();

  await advertiseCitizenPacket();
  citizen.active = true;
  await persistCitizenState();

  let lastMinute = Math.floor((Date.now() - citizen.startedAt) / 60000);
  citizen.pulseTimer = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - citizen.startedAt) / 1000);
    const minute = Math.floor(elapsedSec / 60);
    if (minute !== lastMinute) {
      lastMinute = minute;
      advertiseCitizenPacket().then(persistCitizenState).catch(() => {});
    }
    emit(listeners.onPulse, { elapsedSec, hex: citizen.hex });
  }, 1000);

  // Không quét được thì phao vẫn phát; chỉ mất khả năng nhận PING / tin nhắn.
  await refreshScan().catch(() => {});
  return citizenSnapshot();
}

export async function stopCitizenBeacon() {
  const wasActive = citizen.active;
  clearInterval(citizen.pulseTimer);
  citizen.pulseTimer = null;
  citizen.active = false;
  if (wasActive) {
    await getTransport().stopAdvertise('sos').catch(() => {});
    await persistCitizenState();
    await stopAlarmSiren();
  }
  await refreshScan().catch(() => {});
}

/** Cập nhật toạ độ GPS mới vào gói SOS đang phát. */
export async function updateCitizenLocation(lat, lng) {
  if (!citizen.active || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  citizen.config = { ...citizen.config, lat, lng };
  await advertiseCitizenPacket().then(persistCitizenState).catch(() => {});
}

/**
 * Trạng thái phao hiện tại. Nếu app vừa được mở lại trong khi phao đang bật trước đó,
 * tự phát lại phao cũ.
 */
export async function restoreCitizenBeacon() {
  if (citizen.active) return citizenSnapshot();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MY_BEACON);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved?.isActive && saved.config && saved.sosId) {
      return await startCitizenBeacon(saved.config, { sosId: saved.sosId, startedAt: saved.startedAt });
    }
  } catch (e) {}
  return citizenSnapshot();
}

export function getCitizenBeaconState() {
  return citizenSnapshot();
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN HỆ 2: RADAR TẦM SOÁT (CỨU HỘ)
// ─────────────────────────────────────────────────────────────────────────────

function trackSignal(packet, rssi) {
  const previous = rescuer.signals.get(packet.sosId);
  rescuer.signals.set(packet.sosId, {
    packet,
    rawRSSI: typeof rssi === 'number' ? rssi : null,
    smoothedRSSI: smoothRSSI(previous?.smoothedRSSI, rssi),
    lastSeen: Date.now(),
  });
}

function buildSignalList() {
  const now = Date.now();
  const list = [];
  rescuer.signals.forEach((entry, sosId) => {
    if (now - entry.lastSeen > SIGNAL_DROP_MS) {
      rescuer.signals.delete(sosId);
      return;
    }
    const queued = relayQueue[sosId];
    if (queued?.status === 'RESOLVED') return; // đã cứu xong thì ẩn khỏi radar

    const { packet } = entry;
    const rssiDistanceM = calculateDistance(entry.smoothedRSSI);
    let gpsDistanceM = null;
    let bearing = null;
    if (rescuer.position && packet.hasLocation) {
      gpsDistanceM = Math.round(haversineMeters(rescuer.position.lat, rescuer.position.lng, packet.lat, packet.lng) * 10) / 10;
      bearing = Math.round(bearingDegrees(rescuer.position.lat, rescuer.position.lng, packet.lat, packet.lng));
    }
    const resolved = resolveDistance(gpsDistanceM, rssiDistanceM);
    list.push({
      id: `sos-${sosId}`,
      sosId,
      hex: packet.hexString,
      rawRSSI: entry.rawRSSI,
      smoothedRSSI: entry.smoothedRSSI,
      rssiDistanceM,
      gpsDistanceM,
      bearing,
      distanceM: resolved.distanceM,
      distanceSource: resolved.source,
      peopleCount: packet.peopleCount,
      hasElderly: packet.hasElderly,
      hasChildren: packet.hasChildren,
      hasInjury: packet.hasInjury,
      severity: packet.severity,
      lat: packet.lat,
      lng: packet.lng,
      hasLocation: packet.hasLocation,
      minutesActive: packet.minutesActive,
      lastSeen: entry.lastSeen,
      isStale: now - entry.lastSeen > SIGNAL_STALE_MS,
    });
  });
  const far = Number.MAX_SAFE_INTEGER;
  list.sort((a, b) => (a.distanceM ?? far) - (b.distanceM ?? far));
  return list;
}

function emitSignals() {
  const list = buildSignalList();
  if (rescuer.onUpdate) rescuer.onUpdate(list);
  emit(listeners.onDiscovered, list);
}

/** Bắt đầu quét phao cứu sinh. Ném Error nếu không quét được. */
export async function startRescuerScanner(onUpdate) {
  const ready = await getTransport().prepare();
  if (!ready.ok) throw new Error(ready.reason);
  await ensureQueueLoaded();
  rescuer.onUpdate = onUpdate || null;
  rescuer.active = true;
  try {
    await refreshScan();
  } catch (e) {
    rescuer.active = false;
    rescuer.onUpdate = null;
    throw new Error(e?.message || 'Không bắt đầu quét BLE được.');
  }
  clearInterval(rescuer.emitTimer);
  rescuer.emitTimer = setInterval(emitSignals, 1000);
  emitSignals();
}

export async function stopRescuerScanner() {
  clearInterval(rescuer.emitTimer);
  rescuer.emitTimer = null;
  rescuer.active = false;
  rescuer.onUpdate = null;
  rescuer.signals.clear();
  await refreshScan().catch(() => {});
}

/** Vị trí GPS hiện tại của cứu hộ, dùng để tính cự ly và hướng tới nạn nhân. */
export function setRescuerPosition(position) {
  rescuer.position = position && Number.isFinite(position.lat) && Number.isFinite(position.lng) ? position : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN HỆ 3: PING ĐỊNH VỊ & TIN NHẮN SOẠN SẴN
// ─────────────────────────────────────────────────────────────────────────────

/** Cứu hộ phát lệnh PING: máy nạn nhân hú còi và chớp đèn. */
export async function sendRemotePing(targetSosId) {
  triggerHaptic('alarm');
  const packet = encodePingPacket({
    targetId: targetSosId ?? BROADCAST_ID,
    senderRole: SENDER_ROLE.RESCUER,
    lat: rescuer.position?.lat,
    lng: rescuer.position?.lng,
  });
  await transmit(packet.hexString);
  return { success: true, targetId: targetSosId };
}

let chatCache = null;

async function loadChat() {
  if (chatCache) return chatCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
    chatCache = raw ? JSON.parse(raw) : [];
  } catch (e) {
    chatCache = [];
  }
  return chatCache;
}

async function storeChatMessage(message) {
  const item = {
    ...message,
    sentAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
  const list = await loadChat();
  if (list.some((m) => m.id === item.id)) return item;
  chatCache = [item, ...list].slice(0, 30);
  AsyncStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(chatCache)).catch(() => {});
  emit(listeners.onChatMessage, item);
  return item;
}

/**
 * Gửi một tin nhắn soạn sẵn (theo mã).
 * - CITIZEN: phải đang bật phao; tin gắn với ID phao của mình.
 * - RESCUER: gửi tới một phao cụ thể, hoặc tất cả nếu bỏ trống targetSosId.
 */
export async function sendQuickChatMessage(senderRole, code, targetSosId = null) {
  const isCitizen = senderRole === 'CITIZEN';
  if (isCitizen && !citizen.active) {
    throw new Error('Hãy kích hoạt phao cứu sinh trước khi gửi tin nhắn.');
  }
  const targetId = isCitizen ? citizen.sosId : (targetSosId ?? BROADCAST_ID);
  const position = isCitizen ? citizen.config : rescuer.position;
  const packet = encodeMessagePacket({
    targetId,
    code,
    senderRole: isCitizen ? SENDER_ROLE.CITIZEN : SENDER_ROLE.RESCUER,
    lat: position?.lat,
    lng: position?.lng,
  });
  await transmit(packet.hexString);
  triggerHaptic('impact');
  return storeChatMessage({
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    senderRole,
    code,
    text: messageTextForCode(code),
    sosId: targetId === BROADCAST_ID ? null : targetId,
    mine: true,
  });
}

export async function getQuickChatHistory() {
  return [...(await loadChat())];
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN HỆ 4: BỒ CÂU ĐƯA THƯ (STORE-AND-FORWARD)
// ─────────────────────────────────────────────────────────────────────────────
// relayQueue: { [sosId]: { sosId, hex_packet, rssi, status, note, heardAt, syncedStatus } }
// Một mục "chờ đồng bộ" khi status khác syncedStatus.

let relayQueue = {};
let queueLoaded = false;
let queueLoading = null;
let syncInFlight = null;

async function ensureQueueLoaded() {
  if (queueLoaded) return;
  if (!queueLoading) {
    queueLoading = (async () => {
      let stored = {};
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.RELAY_QUEUE);
        stored = raw ? JSON.parse(raw) : {};
      } catch (e) {}
      const cutoff = Date.now() - QUEUE_MAX_AGE_MS;
      Object.values(stored).forEach((entry) => {
        // Gói nghe được trước khi nạp xong bộ nhớ thì giữ bản mới hơn.
        if (entry?.heardAt > cutoff && !relayQueue[entry.sosId]) relayQueue[entry.sosId] = entry;
      });
      queueLoaded = true;
      emit(listeners.onQueueChange, pendingCount());
    })();
  }
  await queueLoading;
}

function persistQueue() {
  AsyncStorage.setItem(STORAGE_KEYS.RELAY_QUEUE, JSON.stringify(relayQueue)).catch(() => {});
  emit(listeners.onQueueChange, pendingCount());
}

function pendingCount() {
  return Object.values(relayQueue).filter((e) => e.status !== e.syncedStatus).length;
}

/** Ghi nhớ một gói SOS đã nghe được để chuyển tiếp lên máy chủ. */
function rememberForRelay(packet, rssi) {
  const existing = relayQueue[packet.sosId];
  if (existing?.status === 'RESOLVED') return;
  const isNew = !existing;
  relayQueue[packet.sosId] = {
    sosId: packet.sosId,
    hex_packet: packet.hexString,
    rssi: typeof rssi === 'number' ? rssi : existing?.rssi ?? null,
    status: 'PENDING',
    note: existing?.note || '',
    heardAt: Date.now(),
    syncedStatus: existing?.syncedStatus || null,
  };
  // Gói SOS tới vài lần mỗi giây: chỉ ghi xuống bộ nhớ máy khi có phao mới.
  if (isNew) {
    ensureQueueLoaded().then(persistQueue);
  }
}

export async function getOfflineQueueCount() {
  await ensureQueueLoaded();
  return pendingCount();
}

/** Cứu hộ đánh dấu đã cứu xong một nạn nhân (lưu cục bộ, đồng bộ sau). */
export async function markVictimResolvedOffline(sosSignal, note = 'Đã đưa lên ca-nô an toàn') {
  triggerHaptic('warning');
  await ensureQueueLoaded();
  const existing = relayQueue[sosSignal.sosId];
  relayQueue[sosSignal.sosId] = {
    sosId: sosSignal.sosId,
    hex_packet: sosSignal.hex,
    rssi: typeof sosSignal.smoothedRSSI === 'number' ? Math.round(sosSignal.smoothedRSSI) : null,
    status: 'RESOLVED',
    note: `[Cứu hộ Ngoại tuyến] ${note}`,
    heardAt: Date.now(),
    syncedStatus: existing?.syncedStatus || null,
  };
  rescuer.signals.delete(sosSignal.sosId);
  persistQueue();
  return pendingCount();
}

/**
 * Đẩy các gói SOS đang chờ lên máy chủ. An toàn khi gọi lặp lại: máy chủ chống trùng
 * theo ID phao. Trả về { success, syncedCount, ... } và không bao giờ ném lỗi.
 */
export function syncOfflineQueueToBackend() {
  if (!syncInFlight) {
    syncInFlight = runSync().finally(() => { syncInFlight = null; });
  }
  return syncInFlight;
}

async function runSync() {
  try {
    await ensureQueueLoaded();
    const batch = Object.values(relayQueue)
      .filter((e) => e.status !== e.syncedStatus)
      .slice(0, SYNC_BATCH_SIZE)
      .map((e) => ({ ...e }));
    if (batch.length === 0) return { success: true, syncedCount: 0, empty: true };

    const data = await apiClient('/rescue_operations/sos/bulk-offline-sync/', {
      method: 'POST',
      body: JSON.stringify({
        device_id: await getDeviceId(),
        packets: batch.map(({ hex_packet, rssi, status, note }) => ({ hex_packet, rssi, status, note })),
      }),
    });

    const retryIndexes = new Set((data.rejected || []).filter((r) => r.retry).map((r) => r.index));
    const invalidIndexes = new Set((data.rejected || []).filter((r) => !r.retry).map((r) => r.index));
    const resolveIgnored = (data.synced_items || []).filter((i) => i.resolve_ignored).length;

    batch.forEach((sent, index) => {
      const current = relayQueue[sent.sosId];
      if (!current || retryIndexes.has(index)) return;
      if (invalidIndexes.has(index)) {
        delete relayQueue[sent.sosId]; // gói hỏng: bỏ hẳn, không gửi lại mãi
        return;
      }
      // Nếu trong lúc gửi mục này đã đổi trạng thái (vd. vừa đánh dấu đã cứu) thì lần sau gửi tiếp.
      current.syncedStatus = sent.status;
    });
    persistQueue();

    return {
      success: true,
      syncedCount: data.synced_count || 0,
      rejectedCount: invalidIndexes.size,
      resolveIgnored,
      remaining: pendingCount(),
    };
  } catch (err) {
    return { success: false, error: err?.message || 'Lỗi kết nối', offline: err?.status === 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SỰ KIỆN & SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

const subscribe = (set) => (callback) => {
  set.add(callback);
  return () => set.delete(callback);
};

export const subscribeToPing = subscribe(listeners.onPing);
export const subscribeToPulse = subscribe(listeners.onPulse);
export const subscribeToDiscovered = subscribe(listeners.onDiscovered);
export const subscribeToChatMessage = subscribe(listeners.onChatMessage);
export const subscribeToQueueChange = subscribe(listeners.onQueueChange);
