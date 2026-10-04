"""
ai/nlp/geocoder.py
==================
Chuyển đổi tên địa danh Việt Nam → tọa độ GPS (lat, lng).

Phương pháp:
  1. Tìm kiếm trong từ điển tỉnh/thành phố nội bộ (nhanh, offline).
  2. Nếu không tìm thấy → gọi Nominatim API (OpenStreetMap, miễn phí, không cần key).

Trả về (lat, lng, location_name) hoặc (None, None, None) nếu không tìm thấy.
"""

import re
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Từ điển tỉnh/thành phố Việt Nam (offline, nhanh) ───────────────────────
# Tọa độ là trung tâm tỉnh/thành. Đủ dùng để xác định vùng.

VN_PROVINCES = {
    # ── Miền Bắc ─────────────────────────────────────────────────────────────
    'hà nội': (21.0285, 105.8542), 'ha noi': (21.0285, 105.8542), 'hanoi': (21.0285, 105.8542),
    'hải phòng': (20.8449, 106.6881), 'hai phong': (20.8449, 106.6881),
    'quảng ninh': (21.0064, 107.2925), 'quang ninh': (21.0064, 107.2925), 'hạ long': (21.0064, 107.2925), 'ha long': (21.0064, 107.2925),
    'bắc giang': (21.2736, 106.1947), 'bac giang': (21.2736, 106.1947),
    'bắc ninh': (21.1861, 106.0763), 'bac ninh': (21.1861, 106.0763),
    'hà nam': (20.5835, 105.9230), 'ha nam': (20.5835, 105.9230),
    'hà tĩnh': (18.3559, 105.8877), 'ha tinh': (18.3559, 105.8877),
    'hải dương': (20.9373, 106.3145), 'hai duong': (20.9373, 106.3145),
    'hưng yên': (20.6461, 106.0511), 'hung yen': (20.6461, 106.0511),
    'nam định': (20.4389, 106.1621), 'nam dinh': (20.4389, 106.1621),
    'ninh bình': (20.2506, 105.9745), 'ninh binh': (20.2506, 105.9745),
    'thái bình': (20.4464, 106.3420), 'thai binh': (20.4464, 106.3420),
    'thái nguyên': (21.5942, 105.8412), 'thai nguyen': (21.5942, 105.8412),
    'tuyên quang': (21.8236, 105.2136), 'tuyen quang': (21.8236, 105.2136),
    'vĩnh phúc': (21.3609, 105.5474), 'vinh phuc': (21.3609, 105.5474),
    'phú thọ': (21.4132, 105.2148), 'phu tho': (21.4132, 105.2148),
    'lào cai': (22.4809, 103.9754), 'lao cai': (22.4809, 103.9754),
    'yên bái': (21.7051, 104.9060), 'yen bai': (21.7051, 104.9060),
    'hòa bình': (20.8132, 105.3388), 'hoa binh': (20.8132, 105.3388),
    'sơn la': (21.3272, 103.9144), 'son la': (21.3272, 103.9144),
    'điện biên': (21.3861, 103.0161), 'dien bien': (21.3861, 103.0161),
    'lai châu': (22.3964, 103.4589), 'lai chau': (22.3964, 103.4589),
    'lạng sơn': (21.8537, 106.7615), 'lang son': (21.8537, 106.7615),
    'cao bằng': (22.6657, 106.2647), 'cao bang': (22.6657, 106.2647),
    'bắc kạn': (22.1477, 105.8348), 'bac kan': (22.1477, 105.8348),
    'hà giang': (22.8026, 104.9784), 'ha giang': (22.8026, 104.9784),

    # ── Miền Trung ───────────────────────────────────────────────────────────
    'thanh hóa': (19.8073, 105.7764), 'thanh hoa': (19.8073, 105.7764),
    'nghệ an': (18.6796, 105.6813), 'nghe an': (18.6796, 105.6813), 'vinh': (18.6796, 105.6813),
    'quảng bình': (17.4765, 106.6228), 'quang binh': (17.4765, 106.6228), 'đồng hới': (17.4765, 106.6228), 'dong hoi': (17.4765, 106.6228),
    'quảng trị': (16.7388, 107.1855), 'quang tri': (16.7388, 107.1855), 'đông hà': (16.7388, 107.1855), 'dong ha': (16.7388, 107.1855),
    'thừa thiên huế': (16.4637, 107.5909), 'thua thien hue': (16.4637, 107.5909),
    'huế': (16.4637, 107.5909), 'hue': (16.4637, 107.5909),
    'đà nẵng': (16.0544, 108.2022), 'da nang': (16.0544, 108.2022),
    # Quận/huyện Đà Nẵng phổ biến
    'liên chiểu': (16.0839, 108.1522), 'lien chieu': (16.0839, 108.1522),
    'thanh khê': (16.0680, 108.1978), 'thanh khe': (16.0680, 108.1978),
    'hải châu': (16.0544, 108.2198), 'hai chau': (16.0544, 108.2198),
    'sơn trà': (16.0949, 108.2422), 'son tra': (16.0949, 108.2422),
    'ngũ hành sơn': (15.9935, 108.2529), 'ngu hanh son': (15.9935, 108.2529),
    'cẩm lệ': (16.0204, 108.1898), 'cam le': (16.0204, 108.1898),
    'hòa vang': (16.0000, 108.1000), 'hoa vang': (16.0000, 108.1000),
    'quảng nam': (15.5394, 108.0191), 'quang nam': (15.5394, 108.0191),
    # Thành phố/huyện Quảng Nam phổ biến
    'tam kỳ': (15.5736, 108.4736), 'tam ky': (15.5736, 108.4736),
    'hội an': (15.8800, 108.3380), 'hoi an': (15.8800, 108.3380),
    'điện bàn': (15.8960, 108.2571), 'dien ban': (15.8960, 108.2571),
    'đại lộc': (15.8669, 107.9100), 'dai loc': (15.8669, 107.9100),
    'duy xuyên': (15.7000, 108.2200), 'duy xuyen': (15.7000, 108.2200),
    'thăng bình': (15.6700, 108.3500), 'thang binh': (15.6700, 108.3500),
    'quảng ngãi': (15.1214, 108.8044), 'quang ngai': (15.1214, 108.8044),
    'bình định': (13.7765, 109.2237), 'binh dinh': (13.7765, 109.2237),
    'quy nhơn': (13.7765, 109.2237), 'quy nhon': (13.7765, 109.2237),
    'phú yên': (13.0881, 109.0929), 'phu yen': (13.0881, 109.0929), 'tuy hòa': (13.0881, 109.0929), 'tuy hoa': (13.0881, 109.0929),
    'khánh hòa': (12.2388, 109.1967), 'khanh hoa': (12.2388, 109.1967),
    'nha trang': (12.2388, 109.1967),
    'ninh thuận': (11.5639, 108.9882), 'ninh thuan': (11.5639, 108.9882), 'phan rang': (11.5639, 108.9882),
    'bình thuận': (10.9265, 108.1007), 'binh thuan': (10.9265, 108.1007),
    'phan thiết': (10.9265, 108.1007), 'phan thiet': (10.9265, 108.1007),
    'kon tum': (14.3497, 108.0004),
    'gia lai': (13.9833, 108.0000), 'pleiku': (13.9833, 108.0000),
    'đắk lắk': (12.7100, 108.2378), 'dak lak': (12.7100, 108.2378),
    'buôn ma thuột': (12.7100, 108.2378), 'buon ma thuot': (12.7100, 108.2378),
    'đắk nông': (12.0000, 107.6976), 'dak nong': (12.0000, 107.6976),
    'lâm đồng': (11.5753, 108.1429), 'lam dong': (11.5753, 108.1429),
    'đà lạt': (11.9465, 108.4419), 'da lat': (11.9465, 108.4419),

    # ── Miền Nam ─────────────────────────────────────────────────────────────
    'hồ chí minh': (10.8231, 106.6297), 'ho chi minh': (10.8231, 106.6297),
    'tp.hcm': (10.8231, 106.6297), 'tphcm': (10.8231, 106.6297),
    'sài gòn': (10.8231, 106.6297), 'sai gon': (10.8231, 106.6297),
    'bình phước': (11.7512, 106.9057), 'binh phuoc': (11.7512, 106.9057),
    'bình dương': (11.3254, 106.4770), 'binh duong': (11.3254, 106.4770),
    'đồng nai': (10.9453, 106.8243), 'dong nai': (10.9453, 106.8243),
    'biên hòa': (10.9453, 106.8243), 'bien hoa': (10.9453, 106.8243),
    'bà rịa vũng tàu': (10.5418, 107.2428), 'ba ria vung tau': (10.5418, 107.2428),
    'vũng tàu': (10.3460, 107.0843), 'vung tau': (10.3460, 107.0843),
    'tây ninh': (11.3351, 106.0985), 'tay ninh': (11.3351, 106.0985),
    'long an': (10.5354, 106.4121),
    'tiền giang': (10.3600, 106.3651), 'tien giang': (10.3600, 106.3651),
    'mỹ tho': (10.3600, 106.3651), 'my tho': (10.3600, 106.3651),
    'bến tre': (10.2434, 106.3756), 'ben tre': (10.2434, 106.3756),
    'trà vinh': (9.9477, 106.3429), 'tra vinh': (9.9477, 106.3429),
    'vĩnh long': (10.2537, 105.9722), 'vinh long': (10.2537, 105.9722),
    'đồng tháp': (10.4934, 105.6882), 'dong thap': (10.4934, 105.6882), 'cao lãnh': (10.4934, 105.6882), 'cao lanh': (10.4934, 105.6882),
    'an giang': (10.5216, 105.1259), 'long xuyên': (10.3862, 105.4353), 'long xuyen': (10.3862, 105.4353), 'châu đốc': (10.7005, 105.1148), 'chau doc': (10.7005, 105.1148),
    'kiên giang': (10.0125, 105.0809), 'kien giang': (10.0125, 105.0809),
    'rạch giá': (10.0125, 105.0809), 'rach gia': (10.0125, 105.0809), 'phú quốc': (10.2899, 103.9840), 'phu quoc': (10.2899, 103.9840),
    'cần thơ': (10.0452, 105.7469), 'can tho': (10.0452, 105.7469),
    'hậu giang': (9.7762, 105.4701), 'hau giang': (9.7762, 105.4701),
    'sóc trăng': (9.6025, 105.9740), 'soc trang': (9.6025, 105.9740),
    'bạc liêu': (9.2941, 105.7216), 'bac lieu': (9.2941, 105.7216),
    'cà mau': (9.1770, 105.1500), 'ca mau': (9.1770, 105.1500),
}


def geocode_from_text(text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """
    Tìm tên địa danh trong văn bản và trả về (lat, lng, location_name).
    Thứ tự ưu tiên: từ điển nội bộ → Nominatim API.

    Returns:
        (lat, lng, location_name) hoặc (None, None, None)
    """
    text_lower = text.lower()

    # Bước 1: Tìm trong từ điển nội bộ
    for name, (lat, lng) in VN_PROVINCES.items():
        if name in text_lower:
            return lat, lng, name.title()

    # Bước 2: Dùng Nominatim (OpenStreetMap) — gọi API
    location_candidate = _extract_location_candidate(text)
    if location_candidate:
        result = _nominatim_geocode(location_candidate)
        if result:
            return result

    return None, None, None


def _extract_location_candidate(text: str) -> Optional[str]:
    """
    Trích xuất cụm từ ứng viên có thể là địa danh.
    Tìm các cụm từ sau: 'tại', 'ở', 'tỉnh', 'huyện', 'xã', 'thành phố'
    """
    patterns = [
        r'(?:tại|ở|tỉnh|huyện|thành phố|xã|phường)\s+([A-ZÀ-Ỹa-zà-ỹ\s]{3,30}?)(?:\s*[,.]|$)',
        r'([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})\s+(?:tỉnh|huyện|xã)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
    return None


def _nominatim_geocode(location: str) -> Optional[tuple[float, float, str]]:
    """Gọi Nominatim API để geocode địa danh. Rate limit: 1 req/s."""
    try:
        url    = 'https://nominatim.openstreetmap.org/search'
        params = {
            'q':              f"{location}, Vietnam",
            'format':         'json',
            'limit':          1,
            'countrycodes':   'vn',
        }
        headers = {'User-Agent': 'GuardianPulse-AI/1.0'}
        resp    = requests.get(url, params=params, headers=headers, timeout=5)
        data    = resp.json()
        if data:
            return float(data[0]['lat']), float(data[0]['lon']), location
    except Exception as e:
        logger.debug(f"[Geocoder] Nominatim lỗi cho '{location}': {e}")
    return None
