/**
 * src/services/bleProtocol.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Giao thức nhị phân 0xGP v2 cho cứu nạn ngoại tuyến qua BLE Advertising.
 * File này chỉ chứa logic thuần (không phụ thuộc React Native) để test được bằng Node.
 *
 * Mọi gói tin dài 20 bytes, nằm vừa trong Service Data của gói quảng bá BLE 31 bytes:
 * [0..1]   Magic: 0x47 0x50 ('G','P')
 * [2]      4 bit cao = phiên bản (2), 4 bit thấp = loại gói (1 SOS, 2 PING, 3 MSG)
 * [3..6]   ID phao cứu sinh (uint32 BE). Với PING/MSG: ID phao đích, 0xFFFFFFFF = tất cả
 * [7]      SOS: nhân khẩu (bit0 già, bit1 trẻ, bit2 thương tích, bit3..7 số người)
 *          PING: hành động (1 = còi + đèn)      MSG: mã tin nhắn soạn sẵn
 * [8]      SOS: mức độ 1..3                     PING/MSG: vai trò người gửi (1 dân, 2 cứu hộ)
 * [9..12]  Vĩ độ người gửi  Float32 BE
 * [13..16] Kinh độ người gửi Float32 BE
 * [17..18] Bộ đếm uint16 BE. SOS: số phút từ lúc bật phao. PING/MSG: số ngẫu nhiên chống trùng
 * [19]     CRC-8 (đa thức 0x07) của byte 0..18
 *
 * Gói 16 bytes đời cũ (v1, không CRC) vẫn giải mã được để tương thích dữ liệu đã lưu.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const BLE_MAGIC_HEADER = [0x47, 0x50];
export const PROTOCOL_VERSION = 2;
export const PACKET_LENGTH = 20;
export const LEGACY_PACKET_LENGTH = 16;
export const BROADCAST_ID = 0xffffffff;

// UUID 16-bit dùng làm khoá Service Data (dạng đầy đủ để truyền cho Android).
export const GP_SERVICE_UUID = '00004750-0000-1000-8000-00805f9b34fb';

export const PACKET_TYPE = { SOS: 1, PING: 2, MSG: 3 };
export const SENDER_ROLE = { CITIZEN: 1, RESCUER: 2 };

export const DEFAULT_TX_POWER = -59; // RSSI kỳ vọng ở 1 mét
export const DEFAULT_PATH_LOSS_EXPONENT = 3.0; // môi trường nhiều vật cản / mặt nước

// Tin nhắn soạn sẵn: chỉ truyền 1 byte mã, hai phía tự tra ra câu chữ.
export const CITIZEN_MESSAGES = [
  { code: 1, text: 'Đang ở gác lửng sau nhà' },
  { code: 2, text: 'Cửa cuốn kẹt không mở được' },
  { code: 3, text: 'Có trẻ nhỏ bị sốt cao' },
  { code: 4, text: 'Đã hết sạch nước uống' },
  { code: 5, text: 'Gia đình an toàn, đang chờ ca-nô' },
];

export const RESCUER_MESSAGES = [
  { code: 101, text: 'Ca-nô đã tới đầu ngõ' },
  { code: 102, text: 'Hãy giơ cao đèn flash / vẫy khăn' },
  { code: 103, text: 'Giữ nguyên vị trí, đang tiếp cận gác lửng' },
  { code: 104, text: 'Đã đưa phao cứu sinh vào cửa sổ' },
  { code: 105, text: 'Toàn bộ gia đình bình tĩnh, ưu tiên trẻ em' },
];

const MESSAGE_TEXT = {};
[...CITIZEN_MESSAGES, ...RESCUER_MESSAGES].forEach((m) => { MESSAGE_TEXT[m.code] = m.text; });

export function messageTextForCode(code) {
  return MESSAGE_TEXT[code] || `Tin nhắn mã #${code}`;
}

// ─── Tiện ích byte ───────────────────────────────────────────────────────────

export function crc8(bytes, length = bytes.length) {
  let crc = 0;
  for (let i = 0; i < length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

export function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

export function hexToBytes(hex) {
  const clean = String(hex || '').replace(/[^0-9A-Fa-f]/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

/** Sinh ID phao 32-bit ngẫu nhiên, tránh 0 và giá trị "tất cả". */
export function generateBeaconId() {
  return 1 + Math.floor(Math.random() * (BROADCAST_ID - 1));
}

export function generateNonce() {
  return Math.floor(Math.random() * 0x10000);
}

function toUint32(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), BROADCAST_ID) >>> 0;
}

function buildPacket(type, id, byte7, byte8, lat, lng, counter) {
  const buffer = new ArrayBuffer(PACKET_LENGTH);
  const view = new DataView(buffer);
  view.setUint8(0, BLE_MAGIC_HEADER[0]);
  view.setUint8(1, BLE_MAGIC_HEADER[1]);
  view.setUint8(2, ((PROTOCOL_VERSION & 0x0f) << 4) | (type & 0x0f));
  view.setUint32(3, toUint32(id), false);
  view.setUint8(7, byte7 & 0xff);
  view.setUint8(8, byte8 & 0xff);
  view.setFloat32(9, Number(lat) || 0, false);
  view.setFloat32(13, Number(lng) || 0, false);
  view.setUint16(17, Math.min(Math.max(Math.floor(Number(counter) || 0), 0), 0xffff), false);
  const bytes = new Uint8Array(buffer);
  bytes[19] = crc8(bytes, 19);
  return bytes;
}

// ─── Mã hoá ──────────────────────────────────────────────────────────────────

export function encodeSOSPacket({
  sosId,
  peopleCount = 1,
  hasElderly = false,
  hasChildren = false,
  hasInjury = false,
  severity = 2,
  lat = 0,
  lng = 0,
  minutesActive = 0,
}) {
  const id = toUint32(sosId) || generateBeaconId();
  const count = Math.min(Math.max(parseInt(peopleCount, 10) || 1, 1), 31);
  const sev = Math.min(Math.max(parseInt(severity, 10) || 2, 1), 3);
  let demo = (count & 0x1f) << 3;
  if (hasElderly) demo |= 0x01;
  if (hasChildren) demo |= 0x02;
  if (hasInjury) demo |= 0x04;

  const bytes = buildPacket(PACKET_TYPE.SOS, id, demo, sev, lat, lng, minutesActive);
  const hexString = bytesToHex(bytes);
  return { uint8Array: bytes, hexString, byteLength: PACKET_LENGTH, decodedSummary: decodePacket(bytes) };
}

export function encodePingPacket({ targetId = BROADCAST_ID, senderRole = SENDER_ROLE.RESCUER, lat = 0, lng = 0, nonce }) {
  const bytes = buildPacket(PACKET_TYPE.PING, targetId, 1, senderRole, lat, lng, nonce ?? generateNonce());
  return { uint8Array: bytes, hexString: bytesToHex(bytes) };
}

export function encodeMessagePacket({ targetId = BROADCAST_ID, code, senderRole, lat = 0, lng = 0, nonce }) {
  const bytes = buildPacket(PACKET_TYPE.MSG, targetId, code, senderRole, lat, lng, nonce ?? generateNonce());
  return { uint8Array: bytes, hexString: bytesToHex(bytes) };
}

// ─── Giải mã ─────────────────────────────────────────────────────────────────

function toBytes(input) {
  if (typeof input === 'string') return hexToBytes(input);
  if (input instanceof Uint8Array) return input;
  if (Array.isArray(input)) return new Uint8Array(input);
  return null;
}

function round6(value) {
  return Math.round(value * 1000000) / 1000000;
}

export function isValidCoordinate(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function decodeDemographics(byte) {
  return {
    hasElderly: (byte & 0x01) !== 0,
    hasChildren: (byte & 0x02) !== 0,
    hasInjury: (byte & 0x04) !== 0,
    peopleCount: Math.max((byte >> 3) & 0x1f, 1),
  };
}

/**
 * Giải mã một gói 0xGP (v2 20 bytes hoặc v1 16 bytes).
 * Luôn trả về object có `isValid`; gói hỏng không ném lỗi.
 */
export function decodePacket(input) {
  const bytes = toBytes(input);
  if (!bytes) return { isValid: false, error: 'Dữ liệu đầu vào không hợp lệ' };
  if (bytes.length < LEGACY_PACKET_LENGTH) return { isValid: false, error: 'Gói tin ngắn hơn 16 bytes' };
  if (bytes[0] !== BLE_MAGIC_HEADER[0] || bytes[1] !== BLE_MAGIC_HEADER[1]) {
    return { isValid: false, error: 'Sai header định danh 0xGP' };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // v1: 16 bytes, chỉ có SOS, không CRC.
  if (bytes.length < PACKET_LENGTH) {
    const lat = round6(view.getFloat32(8, false));
    const lng = round6(view.getFloat32(12, false));
    return {
      isValid: true,
      version: 1,
      type: PACKET_TYPE.SOS,
      sosId: view.getUint32(2, false),
      ...decodeDemographics(bytes[6]),
      severity: Math.min(Math.max(bytes[7], 1), 3),
      lat,
      lng,
      hasLocation: isValidCoordinate(lat, lng),
      minutesActive: 0,
      hexString: bytesToHex(bytes.subarray(0, LEGACY_PACKET_LENGTH)),
    };
  }

  const version = bytes[2] >> 4;
  const type = bytes[2] & 0x0f;
  if (version !== PROTOCOL_VERSION) return { isValid: false, error: `Phiên bản giao thức ${version} không hỗ trợ` };
  if (crc8(bytes, 19) !== bytes[19]) return { isValid: false, error: 'Sai CRC (gói tin bị nhiễu)' };

  const lat = round6(view.getFloat32(9, false));
  const lng = round6(view.getFloat32(13, false));
  const base = {
    isValid: true,
    version,
    type,
    lat,
    lng,
    hasLocation: isValidCoordinate(lat, lng),
    hexString: bytesToHex(bytes.subarray(0, PACKET_LENGTH)),
  };
  const id = view.getUint32(3, false);
  const counter = view.getUint16(17, false);

  if (type === PACKET_TYPE.SOS) {
    return {
      ...base,
      sosId: id,
      ...decodeDemographics(bytes[7]),
      severity: Math.min(Math.max(bytes[8], 1), 3),
      minutesActive: counter,
    };
  }
  if (type === PACKET_TYPE.PING) {
    return { ...base, targetId: id, action: bytes[7], senderRole: bytes[8], nonce: counter };
  }
  if (type === PACKET_TYPE.MSG) {
    return {
      ...base,
      targetId: id,
      code: bytes[7],
      text: messageTextForCode(bytes[7]),
      senderRole: bytes[8],
      nonce: counter,
    };
  }
  return { isValid: false, error: `Loại gói ${type} không hỗ trợ` };
}

/** Giữ tên cũ: chỉ chấp nhận gói SOS. */
export function decodeSOSPacket(input) {
  const packet = decodePacket(input);
  if (packet.isValid && packet.type !== PACKET_TYPE.SOS) {
    return { isValid: false, error: 'Không phải gói SOS' };
  }
  return packet;
}

/** Gói PING/MSG có nhắm tới phao `myId` không. */
export function isAddressedTo(packet, myId) {
  return packet.targetId === BROADCAST_ID || (myId != null && packet.targetId === myId);
}

// ─── RSSI & hình học ─────────────────────────────────────────────────────────

/** Ước lượng cự ly (mét) từ RSSI. Trả về null khi không có RSSI thật. */
export function calculateDistance(rssi, txPower = DEFAULT_TX_POWER, n = DEFAULT_PATH_LOSS_EXPONENT) {
  if (typeof rssi !== 'number' || Number.isNaN(rssi) || rssi >= 0) return null;
  const dist = Math.pow(10, (txPower - rssi) / (10 * n));
  return Math.min(Math.max(Math.round(dist * 10) / 10, 0.5), 100.0);
}

/** Trung bình động hàm mũ để làm mượt RSSI. */
export function smoothRSSI(currentSmoothed, newRSSI, alpha = 0.35) {
  if (typeof newRSSI !== 'number' || Number.isNaN(newRSSI)) return currentSmoothed ?? null;
  if (currentSmoothed === null || currentSmoothed === undefined || Number.isNaN(currentSmoothed)) {
    return newRSSI;
  }
  return Math.round((alpha * newRSSI + (1 - alpha) * currentSmoothed) * 10) / 10;
}

const toRad = (deg) => (deg * Math.PI) / 180;

/** Khoảng cách Haversine giữa hai toạ độ, tính bằng mét. */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Góc phương vị từ điểm 1 tới điểm 2: 0° = Bắc, tăng theo chiều kim đồng hồ. */
export function bearingDegrees(lat1, lng1, lat2, lng2) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_LABELS = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];

export function compassLabel(bearing) {
  if (typeof bearing !== 'number' || Number.isNaN(bearing)) return '';
  return COMPASS_LABELS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/**
 * Gộp hai nguồn đo cự ly thành số hiển thị.
 * GPS (sai số 5–10m) đáng tin ở xa; RSSI đáng tin hơn ở chặng cuối dưới ~15m.
 */
export function resolveDistance(gpsDistanceM, rssiDistanceM, nearThresholdM = 15) {
  const hasGps = typeof gpsDistanceM === 'number';
  const hasRssi = typeof rssiDistanceM === 'number';
  if (hasGps && hasRssi) {
    return gpsDistanceM <= nearThresholdM || rssiDistanceM <= nearThresholdM
      ? { distanceM: rssiDistanceM, source: 'RSSI' }
      : { distanceM: gpsDistanceM, source: 'GPS' };
  }
  if (hasGps) return { distanceM: gpsDistanceM, source: 'GPS' };
  if (hasRssi) return { distanceM: rssiDistanceM, source: 'RSSI' };
  return { distanceM: null, source: null };
}
