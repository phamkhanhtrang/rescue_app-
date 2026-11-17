/**
 * src/services/bleTransport.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tầng truyền tải gói tin 0xGP. Hai bản cài đặt có cùng giao diện:
 *
 *   prepare()                       → { ok, reason }   xin quyền, kiểm tra Bluetooth
 *   advertise(slot, hex, { fast })  → phát lặp lại một gói tin cho tới khi dừng
 *   stopAdvertise(slot)
 *   startScan(onPacket)             → onPacket({ hex, rssi })   rssi = null khi mô phỏng
 *   stopScan()
 *
 * - NativeBleTransport: sóng BLE thật qua module modules/gp-ble (Android, bản build riêng).
 * - SimulatedTransport: giả lập "không gian vô tuyến" qua máy chủ, dùng cho Expo Go,
 *   web và iOS. Cần mạng tới backend và KHÔNG có RSSI thật.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GpBle from '../../modules/gp-ble';
import { BASE_URL } from './apiClient';

const DEVICE_ID_KEY = 'gp_ble_device_id_v1';
let cachedDeviceId = null;

/** Mã định danh ngẫu nhiên của bản cài đặt này (không chứa thông tin cá nhân). */
export async function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    cachedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  } catch (e) {}
  if (!cachedDeviceId) {
    cachedDeviceId = `gp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    AsyncStorage.setItem(DEVICE_ID_KEY, cachedDeviceId).catch(() => {});
  }
  return cachedDeviceId;
}

// ─── BLE thật (Android) ──────────────────────────────────────────────────────

const STATE_MESSAGES = {
  OFF: 'Bluetooth đang tắt. Hãy bật Bluetooth rồi thử lại.',
  NO_ADVERTISER: 'Điện thoại này không hỗ trợ phát tín hiệu BLE.',
  NO_PERMISSION: 'Ứng dụng chưa được cấp quyền Bluetooth.',
  UNSUPPORTED: 'Điện thoại này không có Bluetooth năng lượng thấp (BLE).',
};

const NativeBleTransport = {
  name: 'BLE',
  isSimulated: false,
  scanSubscription: null,

  async prepare() {
    try {
      const P = PermissionsAndroid.PERMISSIONS;
      const wanted = Platform.Version >= 31
        ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_ADVERTISE, P.ACCESS_FINE_LOCATION]
        : [P.ACCESS_FINE_LOCATION];
      const result = await PermissionsAndroid.requestMultiple(wanted);
      const denied = wanted.some((p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED);
      if (denied) {
        return { ok: false, reason: 'Cần cấp quyền Bluetooth ("Thiết bị ở gần") và Vị trí để phát / quét tín hiệu cứu nạn.' };
      }
      const state = GpBle.getState();
      if (state !== 'READY') return { ok: false, reason: STATE_MESSAGES[state] || 'Bluetooth chưa sẵn sàng.' };
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e?.message || 'Không khởi tạo được Bluetooth.' };
    }
  },

  async advertise(slot, hex, { fast = false } = {}) {
    await GpBle.startAdvertising(slot, hex, fast);
  },

  async stopAdvertise(slot) {
    await GpBle.stopAdvertising(slot);
  },

  async startScan(onPacket) {
    await this.stopScan();
    this.scanSubscription = GpBle.addListener('onPacket', (event) => {
      onPacket({ hex: event.hex, rssi: typeof event.rssi === 'number' ? event.rssi : null });
    });
    try {
      await GpBle.startScan();
    } catch (e) {
      this.scanSubscription.remove();
      this.scanSubscription = null;
      throw e;
    }
  },

  async stopScan() {
    if (this.scanSubscription) {
      this.scanSubscription.remove();
      this.scanSubscription = null;
    }
    await GpBle.stopScan();
  },
};

// ─── Mô phỏng qua máy chủ ────────────────────────────────────────────────────

const RELAY_URL = `${BASE_URL}/rescue_operations/ble-grid/packets/`;
const RELAY_TTL_SECONDS = 15;
const RELAY_HEARTBEAT_MS = 5000;
const RELAY_POLL_MS = 1500;

async function relayFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Relay trả về ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const SimulatedTransport = {
  name: 'SIM',
  isSimulated: true,
  heartbeats: {},
  pollTimer: null,
  polling: false,

  async prepare() {
    return { ok: true };
  },

  async advertise(slot, hex) {
    const deviceId = await getDeviceId();
    const post = () => relayFetch(RELAY_URL, {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, slot, hex, ttl: RELAY_TTL_SECONDS }),
    });
    clearInterval(this.heartbeats[slot]);
    delete this.heartbeats[slot];
    try {
      await post();
    } catch (e) {
      throw new Error('Chế độ mô phỏng cần kết nối tới máy chủ, nhưng hiện không kết nối được.');
    }
    this.heartbeats[slot] = setInterval(() => { post().catch(() => {}); }, RELAY_HEARTBEAT_MS);
  },

  async stopAdvertise(slot) {
    clearInterval(this.heartbeats[slot]);
    delete this.heartbeats[slot];
    const deviceId = await getDeviceId();
    await relayFetch(RELAY_URL, {
      method: 'DELETE',
      body: JSON.stringify({ device_id: deviceId, slot }),
    }).catch(() => {});
  },

  async startScan(onPacket) {
    await this.stopScan();
    const deviceId = await getDeviceId();
    const poll = async () => {
      if (this.polling) return;
      this.polling = true;
      try {
        const data = await relayFetch(`${RELAY_URL}?device_id=${encodeURIComponent(deviceId)}`);
        (data.packets || []).forEach((p) => onPacket({ hex: p.hex, rssi: null }));
      } catch (e) {
        // Mất kết nối tới relay: coi như không nghe thấy gì trong nhịp này.
      } finally {
        this.polling = false;
      }
    };
    this.pollTimer = setInterval(poll, RELAY_POLL_MS);
    poll();
  },

  async stopScan() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },
};

/** BLE thật khi có module native trên Android; ngược lại là mô phỏng. */
export function getTransport() {
  return Platform.OS === 'android' && GpBle ? NativeBleTransport : SimulatedTransport;
}
