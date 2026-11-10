/**
 * src/services/bleGridService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Dịch vụ Tác chiến Cứu nạn Ngoại tuyến BLE (Guardian Pulse Offline Mesh Grid).
 * Quản lý vòng đời Phao cứu sinh (Citizen Beacon) và Radar tầm soát (Rescuer Radar).
 *
 * Hỗ trợ Dual-Mode:
 *  - Offline hoàn toàn (Local Storage / P2P Simulation).
 *  - Virtual RF Relay (khi test giữa Điện thoại thật và Trình duyệt Web trên máy tính).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { BASE_URL } from './apiClient';
import {
  encodeSOSPacket,
  decodeSOSPacket,
  calculateDistance,
  smoothRSSI,
} from './bleProtocol';

// Khóa lưu trữ cục bộ
const STORAGE_KEYS = {
  MY_BEACON: 'gp_ble_my_beacon_v1',
  BROADCAST_STATE: 'gp_ble_broadcast_active_v1',
  DISCOVERED_LIST: 'gp_ble_discovered_signals_v1',
  OFFLINE_QUEUE: 'gp_ble_offline_sync_queue_v1',
  CHAT_MESSAGES: 'gp_ble_quick_chat_v1',
  PING_EVENT: 'gp_ble_remote_ping_trigger_v1',
};

// Listeners lưu trữ trong bộ nhớ
const listeners = {
  onPulse: new Set(),
  onDiscovered: new Set(),
  onPing: new Set(),
  onChatMessage: new Set(),
};

let broadcastTimer = null;
let scanTimer = null;
let currentPulseCount = 0;
let soundInstance = null;
let lastHandledPingTime = 0;

/**
 * Phát rung phản hồi xúc giác (Haptics)
 */
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

/**
 * Phát tiếng bíp Sonar (cho Radar cứu hộ)
 */
export async function playSonarBeep() {
  try {
    triggerHaptic('impact');
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true, volume: 1.0 }
    );
    soundInstance = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (err) {
    triggerHaptic('alarm');
  }
}

/**
 * Phát còi hú báo động khẩn cấp khi nhận lệnh PING
 */
export async function playAlarmSiren(durationMs = 6000) {
  try {
    triggerHaptic('alarm');
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/emergency/siren_whistle.ogg' },
      { shouldPlay: true, isLooping: true, volume: 1.0 }
    );
    soundInstance = sound;

    const hapticInterval = setInterval(() => {
      triggerHaptic('alarm');
    }, 700);

    setTimeout(async () => {
      clearInterval(hapticInterval);
      try {
        if (soundInstance) {
          await soundInstance.stopAsync();
          await soundInstance.unloadAsync();
        }
      } catch (e) {}
    }, durationMs);
  } catch (err) {
    triggerHaptic('alarm');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN HỆ 1: PHAO CỨU SINH BLE (CITIZEN BEACON)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bắt đầu phát phao cứu sinh BLE
 */
export async function startCitizenBeacon(config) {
  stopCitizenBeacon();

  const packet = encodeSOSPacket({
    sosId: config.sosId || Math.floor(100000 + Math.random() * 900000),
    peopleCount: config.peopleCount || 1,
    hasElderly: !!config.hasElderly,
    hasChildren: !!config.hasChildren,
    hasInjury: !!config.hasInjury,
    severity: config.severity || 2,
    lat: config.lat || 16.0544,
    lng: config.lng || 108.2022,
  });

  const state = {
    isActive: true,
    startedAt: new Date().toISOString(),
    config,
    packetHex: packet.hexString,
    summary: packet.decodedSummary,
  };

  await AsyncStorage.setItem(STORAGE_KEYS.MY_BEACON, JSON.stringify(state));
  await AsyncStorage.setItem(STORAGE_KEYS.BROADCAST_STATE, 'ACTIVE');

  // Đăng ký lên virtual mesh relay backend (cho kịch bản test Web + Phone)
  try {
    fetch(`${BASE_URL}/rescue_operations/ble-grid/beacon/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sos_id: packet.decodedSummary.sosId,
        hex: packet.hexString,
        lat: packet.decodedSummary.lat,
        lng: packet.decodedSummary.lng,
        people_count: packet.decodedSummary.peopleCount,
        has_elderly: packet.decodedSummary.hasElderly,
        has_children: packet.decodedSummary.hasChildren,
        has_injury: packet.decodedSummary.hasInjury,
        severity: packet.decodedSummary.severity,
      }),
    }).catch(() => {});
  } catch (e) {}

  currentPulseCount = 0;

  // Vòng lặp phát xung quảng bá (mỗi 800ms)
  broadcastTimer = setInterval(async () => {
    currentPulseCount += 1;
    const pulseInfo = {
      pulseNumber: currentPulseCount,
      hex: packet.hexString,
      timestamp: Date.now(),
      summary: packet.decodedSummary,
    };

    // 1. Kiểm tra lệnh PING từ local storage
    const pendingPing = await AsyncStorage.getItem(STORAGE_KEYS.PING_EVENT);
    if (pendingPing) {
      await AsyncStorage.removeItem(STORAGE_KEYS.PING_EVENT);
      const pingData = JSON.parse(pendingPing);
      if (pingData.targetId === packet.decodedSummary.sosId || pingData.targetId === 'ALL') {
        listeners.onPing.forEach((fn) => fn(pingData));
        playAlarmSiren(6000);
      }
    }

    // 2. Kiểm tra lệnh PING từ virtual mesh relay (nếu test qua mạng LAN giữa Web và Phone)
    try {
      const resp = await fetch(
        `${BASE_URL}/rescue_operations/ble-grid/ping/?target_id=${packet.decodedSummary.sosId}`
      );
      if (resp.ok) {
        const pingJson = await resp.json();
        if (Array.isArray(pingJson.pings) && pingJson.pings.length > 0) {
          const lastPing = pingJson.pings[pingJson.pings.length - 1];
          if (!lastHandledPingTime || lastPing.timestamp > lastHandledPingTime) {
            lastHandledPingTime = lastPing.timestamp;
            listeners.onPing.forEach((fn) => fn(lastPing));
            playAlarmSiren(6000);
          }
        }
      }
    } catch (e) {}

    listeners.onPulse.forEach((fn) => fn(pulseInfo));
  }, 800);

  return state;
}

/**
 * Dừng phát phao cứu sinh
 */
export async function stopCitizenBeacon() {
  if (broadcastTimer) {
    clearInterval(broadcastTimer);
    broadcastTimer = null;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.BROADCAST_STATE, 'IDLE');
}

/**
 * Lấy trạng thái phao cứu sinh hiện tại
 */
export async function getCitizenBeaconState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MY_BEACON);
    const active = await AsyncStorage.getItem(STORAGE_KEYS.BROADCAST_STATE);
    return {
      isActive: active === 'ACTIVE',
      data: raw ? JSON.parse(raw) : null,
      pulseCount: currentPulseCount,
    };
  } catch (e) {
    return { isActive: false, data: null, pulseCount: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN HỆ 2: RADAR TẦM SOÁT SONAR (RESCUER RADAR)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bắt đầu quét sóng BLE Sonar xung quanh
 */
export async function startRescuerScanner(options = {}, onUpdate) {
  stopRescuerScanner();

  const scanInterval = options.interval || 1200;
  let simulatedDistance = options.initialDist || 32.0;

  scanTimer = setInterval(async () => {
    const discoveredSignals = [];

    // 1. Kiểm tra phao cứu sinh lưu cục bộ trong máy (test 1 máy)
    const myBeaconRaw = await AsyncStorage.getItem(STORAGE_KEYS.MY_BEACON);
    const isBeaconActive = (await AsyncStorage.getItem(STORAGE_KEYS.BROADCAST_STATE)) === 'ACTIVE';

    if (myBeaconRaw && isBeaconActive) {
      const beaconData = JSON.parse(myBeaconRaw);
      const decoded = decodeSOSPacket(beaconData.packetHex);

      if (decoded.isValid) {
        if (simulatedDistance > 3.0) {
          simulatedDistance = Math.max(simulatedDistance - (Math.random() * 2.5 + 0.5), 2.5);
        }

        const calcRssi = Math.round(
          -59 - 10 * 3.0 * Math.log10(Math.max(simulatedDistance, 0.5)) + (Math.random() * 4 - 2)
        );

        discoveredSignals.push({
          id: `sos-${decoded.sosId}`,
          sosId: decoded.sosId,
          hex: decoded.hexString,
          rawRSSI: calcRssi,
          smoothedRSSI: calcRssi,
          distanceM: Math.round(simulatedDistance * 10) / 10,
          peopleCount: decoded.peopleCount,
          hasElderly: decoded.hasElderly,
          hasChildren: decoded.hasChildren,
          hasInjury: decoded.hasInjury,
          severity: decoded.severity,
          lat: decoded.lat,
          lng: decoded.lng,
          lastSeen: Date.now(),
          radarAngle: 45,
        });
      }
    }

    // 2. Kiểm tra phao cứu sinh từ virtual mesh relay (test giữa Web và Phone)
    try {
      const relayResp = await fetch(`${BASE_URL}/rescue_operations/ble-grid/beacon/`);
      if (relayResp.ok) {
        const relayData = await relayResp.json();
        if (Array.isArray(relayData.beacons)) {
          for (const b of relayData.beacons) {
            if (!discoveredSignals.some((s) => s.sosId === b.sos_id)) {
              if (simulatedDistance > 3.0) {
                simulatedDistance = Math.max(simulatedDistance - (Math.random() * 2.0 + 0.5), 2.5);
              }
              const calcRssi = Math.round(
                -59 - 10 * 3.0 * Math.log10(Math.max(simulatedDistance, 0.5)) + (Math.random() * 3 - 1.5)
              );

              discoveredSignals.push({
                id: `sos-${b.sos_id}`,
                sosId: b.sos_id,
                hex: b.hex,
                rawRSSI: calcRssi,
                smoothedRSSI: calcRssi,
                distanceM: Math.round(simulatedDistance * 10) / 10,
                peopleCount: b.people_count,
                hasElderly: b.has_elderly,
                hasChildren: b.has_children,
                hasInjury: b.has_injury,
                severity: b.severity,
                lat: b.lat,
                lng: b.lng,
                lastSeen: Date.now(),
                radarAngle: 60,
              });
            }
          }
        }
      }
    } catch (e) {}

    // 3. Fallback: Nếu không có phao nào, tự sinh 1 mục tiêu dã chiến để luôn test được
    if (discoveredSignals.length === 0) {
      const demoPacket = encodeSOSPacket({
        sosId: 77291,
        peopleCount: 3,
        hasElderly: true,
        hasChildren: true,
        hasInjury: false,
        severity: 3,
        lat: 16.0562,
        lng: 108.2045,
      });
      const dist = Math.round((simulatedDistance + 4.5) * 10) / 10;
      discoveredSignals.push({
        id: 'sos-77291',
        sosId: 77291,
        hex: demoPacket.hexString,
        rawRSSI: -68,
        smoothedRSSI: -68,
        distanceM: dist,
        peopleCount: 3,
        hasElderly: true,
        hasChildren: true,
        hasInjury: false,
        severity: 3,
        lat: 16.0562,
        lng: 108.2045,
        lastSeen: Date.now(),
        radarAngle: 135,
      });
    }

    if (onUpdate) {
      onUpdate(discoveredSignals);
    }
    listeners.onDiscovered.forEach((fn) => fn(discoveredSignals));
  }, scanInterval);
}

/**
 * Dừng quét radar
 */
export function stopRescuerScanner() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN HỆ 3: PING ĐỊNH VỊ TỪ XA & BỘ ĐÀM 1-CHẠM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cứu hộ gửi lệnh PING kích hoạt còi hú & đèn Flash trên máy người dân
 */
export async function sendRemotePing(targetSosId = 'ALL') {
  triggerHaptic('alarm');
  const pingEvent = {
    targetId: targetSosId,
    timestamp: Date.now(),
    action: 'STROBE_AND_SIREN',
  };
  await AsyncStorage.setItem(STORAGE_KEYS.PING_EVENT, JSON.stringify(pingEvent));

  // Bắn lệnh qua virtual mesh relay
  try {
    fetch(`${BASE_URL}/rescue_operations/ble-grid/ping/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetSosId }),
    }).catch(() => {});
  } catch (e) {}

  return { success: true, targetId: targetSosId };
}

/**
 * Gửi tin nhắn nhanh bộ đàm BLE 1-chạm
 */
export async function sendQuickChatMessage(senderRole, messageText, targetSosId = 'ALL') {
  triggerHaptic('impact');
  const chatItem = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    senderRole,
    text: messageText,
    targetSosId,
    sentAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };

  const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
  const list = raw ? JSON.parse(raw) : [];
  list.unshift(chatItem);
  await AsyncStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(list.slice(0, 30)));

  // Bắn qua virtual relay
  try {
    fetch(`${BASE_URL}/rescue_operations/ble-grid/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_role: senderRole,
        text: messageText,
        target_sos_id: targetSosId,
        sent_at: chatItem.sentAt,
      }),
    }).catch(() => {});
  } catch (e) {}

  listeners.onChatMessage.forEach((fn) => fn(chatItem));
  return chatItem;
}

/**
 * Lấy lịch sử chat bộ đàm
 */
export async function getQuickChatHistory() {
  try {
    const resp = await fetch(`${BASE_URL}/rescue_operations/ble-grid/chat/`);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        return data.messages;
      }
    }
  } catch (e) {}

  const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
  return raw ? JSON.parse(raw) : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN HỆ 4: BỒ CÂU ĐƯA THƯ SỐ (STORE-AND-FORWARD & BULK SYNC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đánh dấu một nạn nhân đã được cứu (lưu vào hàng đợi đồng bộ offline)
 */
export async function markVictimResolvedOffline(sosSignal, note = 'Đã đưa lên ca-nô an toàn') {
  triggerHaptic('warning');
  const queueRaw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
  const queue = queueRaw ? JSON.parse(queueRaw) : [];

  const offlineEntry = {
    hex_packet: sosSignal.hex,
    rssi: sosSignal.smoothedRSSI || -60,
    status: 'RESOLVED',
    note: `[Cứu hộ Ngoại tuyến] ${note}`,
    resolvedAt: new Date().toISOString(),
    sosId: sosSignal.sosId,
  };

  queue.push(offlineEntry);
  await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  return queue.length;
}

/**
 * Đồng bộ hàng loạt gói tin offline lên Django Backend khi có lại 4G/Wi-Fi
 */
export async function syncOfflineQueueToBackend(apiClient, deviceId = 'CANO_RESCUER_DEFAULT') {
  try {
    const queueRaw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    if (!queueRaw) return { syncedCount: 0, message: 'Hàng đợi rỗng' };

    const queue = JSON.parse(queueRaw);
    if (!Array.isArray(queue) || queue.length === 0) {
      return { syncedCount: 0, message: 'Không có dữ liệu chờ đồng bộ' };
    }

    const payload = {
      device_id: deviceId,
      packets: queue,
    };

    const resp = await apiClient.post('/rescue_operations/sos/bulk-offline-sync/', payload);
    if (resp.status === 200 && resp.data?.status === 'SUCCESS') {
      await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return {
        syncedCount: resp.data.synced_count,
        items: resp.data.synced_items,
        success: true,
      };
    }
    return { success: false, error: 'Phản hồi không hợp lệ từ máy chủ' };
  } catch (err) {
    return { success: false, error: err.message || 'Lỗi kết nối' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SỰ KIỆN & SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToPing(callback) {
  listeners.onPing.add(callback);
  return () => listeners.onPing.delete(callback);
}

export function subscribeToPulse(callback) {
  listeners.onPulse.add(callback);
  return () => listeners.onPulse.delete(callback);
}

export function subscribeToDiscovered(callback) {
  listeners.onDiscovered.add(callback);
  return () => listeners.onDiscovered.delete(callback);
}

export function subscribeToChatMessage(callback) {
  listeners.onChatMessage.add(callback);
  return () => listeners.onChatMessage.delete(callback);
}
