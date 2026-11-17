"""Giải mã gói tin 0xGP của tính năng cứu nạn ngoại tuyến BLE.

Phải khớp với FE-app/src/services/bleProtocol.js:
- v2: 20 bytes, có byte loại gói và CRC-8 ở cuối.
- v1: 16 bytes đời cũ, chỉ có SOS, không CRC.
"""
import math
import struct
import uuid

MAGIC = b'GP'
PACKET_LENGTH = 20
LEGACY_PACKET_LENGTH = 16
PROTOCOL_VERSION = 2
TYPE_SOS, TYPE_PING, TYPE_MSG = 1, 2, 3

# Không gian tên cố định để suy ra request_key (UUID) từ ID phao 32-bit.
_BLE_NAMESPACE = uuid.UUID('6f1d2c1e-4750-4b1e-9c0a-0b1e5a5e4750')


class PacketError(ValueError):
    """Gói tin không hợp lệ; thông điệp hiển thị được cho người dùng."""


def crc8(data: bytes) -> int:
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc


def request_key_for(sos_id: int) -> uuid.UUID:
    """Khoá duy nhất của một phao cứu sinh, dùng để chống tạo trùng SOS."""
    return uuid.uuid5(_BLE_NAMESPACE, f'ble-sos:{sos_id}')


def _demographics(byte: int) -> dict:
    return {
        'has_elderly': bool(byte & 0x01),
        'has_children': bool(byte & 0x02),
        'has_injury': bool(byte & 0x04),
        'people_count': max((byte >> 3) & 0x1F, 1),
    }


def _coordinates(raw: bytes) -> tuple:
    lat, lng = struct.unpack('>ff', raw)
    if not (math.isfinite(lat) and math.isfinite(lng)) or abs(lat) > 90 or abs(lng) > 180:
        raise PacketError('Toạ độ GPS trong gói tin không hợp lệ.')
    if lat == 0 and lng == 0:
        raise PacketError('Gói tin không có toạ độ GPS.')
    return round(lat, 6), round(lng, 6)


def decode_sos_packet(hex_str: str) -> dict:
    """Giải mã một gói SOS từ chuỗi hex. Ném PacketError nếu gói hỏng."""
    try:
        raw = bytes.fromhex(str(hex_str or '').strip())
    except ValueError:
        raise PacketError('Chuỗi hex không hợp lệ.')
    if len(raw) < LEGACY_PACKET_LENGTH:
        raise PacketError('Độ dài nhị phân < 16 bytes.')
    if raw[:2] != MAGIC:
        raise PacketError('Sai header định danh 0xGP.')

    if len(raw) < PACKET_LENGTH:
        lat, lng = _coordinates(raw[8:16])
        return {
            'version': 1,
            'sos_id': struct.unpack('>I', raw[2:6])[0],
            **_demographics(raw[6]),
            'severity': min(max(raw[7], 1), 3),
            'lat': lat,
            'lng': lng,
            'minutes_active': 0,
            'hex': raw[:LEGACY_PACKET_LENGTH].hex().upper(),
        }

    raw = raw[:PACKET_LENGTH]
    version, packet_type = raw[2] >> 4, raw[2] & 0x0F
    if version != PROTOCOL_VERSION:
        raise PacketError(f'Phiên bản giao thức {version} không hỗ trợ.')
    if crc8(raw[:19]) != raw[19]:
        raise PacketError('Sai CRC (gói tin bị nhiễu).')
    if packet_type != TYPE_SOS:
        raise PacketError('Không phải gói SOS.')
    lat, lng = _coordinates(raw[9:17])
    return {
        'version': version,
        'sos_id': struct.unpack('>I', raw[3:7])[0],
        **_demographics(raw[7]),
        'severity': min(max(raw[8], 1), 3),
        'lat': lat,
        'lng': lng,
        'minutes_active': struct.unpack('>H', raw[17:19])[0],
        'hex': raw.hex().upper(),
    }
