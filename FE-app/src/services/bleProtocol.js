/**
 * src/services/bleProtocol.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bộ giao thức nhị phân siêu nén 16-Bytes cho Cứu nạn Ngoại tuyến BLE
 * (Guardian Pulse - BLE Offline Rescue Protocol - 0xGP).
 *
 * Cấu trúc gói tin 16 Bytes:
 * [0..1]   Magic Header: 0x47 0x50 ('G', 'P')
 * [2..5]   SOS ID: 32-bit uint
 * [6]      Demographics: Bit 0=Elderly, Bit 1=Children, Bit 2=Injury, Bits 3..7=People Count (1..31)
 * [7]      Severity: 1=Thường, 2=Ngập sâu/Hết thức ăn, 3=Nguy kịch tính mạng
 * [8..11]  Latitude: IEEE-754 Float32 (sai số ~1.1m)
 * [12..15] Longitude: IEEE-754 Float32 (sai số ~1.1m)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const BLE_MAGIC_HEADER = [0x47, 0x50]; // 'G', 'P'
export const DEFAULT_TX_POWER = -59; // RSSI chuẩn tại khoảng cách 1 mét
export const DEFAULT_PATH_LOSS_EXPONENT = 3.0; // Hệ số tiêu tán trên mặt nước / khu ngập

/**
 * Mã hóa dữ liệu cứu nạn thành gói tin 16 bytes (Uint8Array và Hex string)
 */
export function encodeSOSPacket({
  sosId = Math.floor(Math.random() * 900000) + 100000,
  peopleCount = 1,
  hasElderly = false,
  hasChildren = false,
  hasInjury = false,
  severity = 2, // 1: Alert, 2: High, 3: Critical
  lat = 16.0544,
  lng = 108.2022,
}) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);

  // 1. Magic Header 0x4750 (2 bytes)
  view.setUint8(0, BLE_MAGIC_HEADER[0]);
  view.setUint8(1, BLE_MAGIC_HEADER[1]);

  // 2. SOS ID 32-bit uint (4 bytes)
  const numericId = typeof sosId === 'number' ? sosId : parseInt(String(sosId).replace(/\D/g, '').slice(-8), 10) || 123456;
  view.setUint32(2, numericId, false); // Big endian

  // 3. Demographics bitmask (1 byte)
  const clampedCount = Math.min(Math.max(parseInt(peopleCount, 10) || 1, 1), 31);
  let demoByte = (clampedCount & 0x1F) << 3;
  if (hasElderly) demoByte |= 0x01;
  if (hasChildren) demoByte |= 0x02;
  if (hasInjury) demoByte |= 0x04;
  view.setUint8(6, demoByte);

  // 4. Severity (1 byte)
  const clampedSeverity = Math.min(Math.max(parseInt(severity, 10) || 2, 1), 3);
  view.setUint8(7, clampedSeverity);

  // 5. GPS Latitude & Longitude Float32 (8 bytes)
  view.setFloat32(8, parseFloat(lat) || 0.0, false);
  view.setFloat32(12, parseFloat(lng) || 0.0, false);

  const uint8 = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < uint8.length; i++) {
    hexString += uint8[i].toString(16).padStart(2, '0').toUpperCase();
  }

  return {
    rawBuffer: buffer,
    uint8Array: uint8,
    hexString,
    byteLength: 16,
    decodedSummary: {
      sosId: numericId,
      peopleCount: clampedCount,
      hasElderly: !!hasElderly,
      hasChildren: !!hasChildren,
      hasInjury: !!hasInjury,
      severity: clampedSeverity,
      lat: view.getFloat32(8, false),
      lng: view.getFloat32(12, false),
    },
  };
}

/**
 * Giải mã gói tin 16 bytes (từ Uint8Array, Array, hoặc Hex string)
 */
export function decodeSOSPacket(input) {
  let uint8;
  if (typeof input === 'string') {
    const cleanHex = input.replace(/[^0-9A-Fa-f]/g, '');
    if (cleanHex.length < 32) {
      return { isValid: false, error: 'Chuỗi Hex không đủ 16 bytes (32 ký tự)' };
    }
    uint8 = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      uint8[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
  } else if (input instanceof Uint8Array) {
    if (input.length < 16) {
      return { isValid: false, error: 'Mảng bytes nhỏ hơn 16' };
    }
    uint8 = input.slice(0, 16);
  } else if (Array.isArray(input)) {
    if (input.length < 16) {
      return { isValid: false, error: 'Mảng bytes nhỏ hơn 16' };
    }
    uint8 = new Uint8Array(input.slice(0, 16));
  } else {
    return { isValid: false, error: 'Dữ liệu đầu vào không hợp lệ' };
  }

  const view = new DataView(uint8.buffer, uint8.byteOffset, 16);

  // Kiểm tra Magic Header
  const h0 = view.getUint8(0);
  const h1 = view.getUint8(1);
  if (h0 !== BLE_MAGIC_HEADER[0] || h1 !== BLE_MAGIC_HEADER[1]) {
    return { isValid: false, error: `Sai Header định danh (nhận 0x${h0.toString(16)}${h1.toString(16)}, yêu cầu 0x4750)` };
  }

  const sosId = view.getUint32(2, false);
  const demoByte = view.getUint8(6);
  const hasElderly = (demoByte & 0x01) !== 0;
  const hasChildren = (demoByte & 0x02) !== 0;
  const hasInjury = (demoByte & 0x04) !== 0;
  const peopleCount = (demoByte >> 3) & 0x1F;
  const severity = view.getUint8(7);
  const lat = Math.round(view.getFloat32(8, false) * 1000000) / 1000000;
  const lng = Math.round(view.getFloat32(12, false) * 1000000) / 1000000;

  return {
    isValid: true,
    sosId,
    peopleCount,
    hasElderly,
    hasChildren,
    hasInjury,
    severity,
    lat,
    lng,
    hexString: Array.from(uint8).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(''),
  };
}

/**
 * Tính toán cự ly ước tính (mét) từ chỉ số RSSI
 * Formula: Distance = 10 ^ ((TxPower - RSSI) / (10 * n))
 */
export function calculateDistance(rssi, txPower = DEFAULT_TX_POWER, n = DEFAULT_PATH_LOSS_EXPONENT) {
  if (typeof rssi !== 'number' || isNaN(rssi) || rssi >= 0) {
    return 50.0;
  }
  const ratio = (txPower - rssi) / (10 * n);
  const dist = Math.pow(10, ratio);
  return Math.min(Math.max(Math.round(dist * 10) / 10, 0.5), 100.0);
}

/**
 * Bộ lọc trung bình động làm mượt RSSI (Exponential Moving Average Filter)
 * Khử hiện tượng dội sóng mặt nước và dao động ngẫu nhiên.
 */
export function smoothRSSI(currentSmoothed, newRSSI, alpha = 0.35) {
  if (currentSmoothed === null || currentSmoothed === undefined || isNaN(currentSmoothed)) {
    return newRSSI;
  }
  return Math.round((alpha * newRSSI + (1 - alpha) * currentSmoothed) * 10) / 10;
}
