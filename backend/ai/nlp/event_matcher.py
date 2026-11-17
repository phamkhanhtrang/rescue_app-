"""
ai/nlp/event_matcher.py
=======================
Gộp trùng theo SỰ KIỆN: nhận ra một bài Facebook và một SOS đã có (gửi từ app
hoặc từ bài khác) là của cùng một hộ, để liên kết thay vì tạo hai SOS.

So khớp theo thứ tự tin cậy giảm dần:
  1. Cùng số điện thoại liên hệ, SOS còn mở.
  2. Nội dung giống nhau ≥ 85% (cách cũ, bắt bài đăng lại).
  3. Cách nhau ≤ 100 m và nội dung giống nhau ≥ 60%, SOS còn mở.
"""

import re
from datetime import timedelta
from difflib import SequenceMatcher

from django.utils import timezone

from .deduplicator import normalize

OPEN_STATUSES = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS']
TEXT_THRESHOLD = 0.85
NEAR_DISTANCE_M = 100
NEAR_TEXT_THRESHOLD = 0.60

_PHONE_PATTERN = re.compile(r'(?:\+?84|0)(?:[\s.\-]?\d){9,10}')


def normalize_phone(value) -> str:
    """Đưa số điện thoại Việt Nam về dạng 0xxxxxxxxx; trả về '' nếu không hợp lệ."""
    digits = re.sub(r'\D', '', str(value or ''))
    if digits.startswith('84') and len(digits) in (11, 12):
        digits = '0' + digits[2:]
    return digits if len(digits) in (10, 11) and digits.startswith('0') else ''


def phones_in(text) -> set:
    return {p for p in (normalize_phone(m.group()) for m in _PHONE_PATTERN.finditer(text or '')) if p}


def sos_phones(sos) -> set:
    """Mọi số điện thoại gắn với một SOS: ô liên hệ, tài khoản người gửi, và trong ghi chú."""
    phones = {normalize_phone(sos.contact_phone)} | phones_in(sos.note)
    if sos.citizen_id and getattr(sos.citizen, 'phone', None):
        phones.add(normalize_phone(sos.citizen.phone))
    return phones - {''}


def sos_text(sos) -> str:
    """Lời kể trong ghi chú, bỏ phần hệ thống tự thêm khi tạo SOS từ bài Facebook."""
    return normalize((sos.note or '').split('\nNhu cầu đã duyệt:', 1)[0].removeprefix('[Facebook] '))


def find_matching_sos(text: str, phone=None, lat=None, lng=None, hours: int = 24):
    """
    Tìm SOS trong `hours` giờ gần đây có vẻ cùng sự kiện với bài viết.

    Returns:
        (sos, reason) với reason ∈ {'phone', 'text', 'nearby_text'}, hoặc (None, '').
    """
    from rescue_operations.models import SOSSignal
    from ai.clustering import haversine_m

    recent = list(SOSSignal.objects.filter(sent_at__gte=timezone.now() - timedelta(hours=hours))
                  .select_related('citizen').order_by('-sent_at'))
    new_text = normalize(text or '')
    phones = phones_in(text) | ({normalize_phone(phone)} - {''})

    if phones:
        for sos in recent:
            if sos.status in OPEN_STATUSES and phones & sos_phones(sos):
                return sos, 'phone'

    ratios = {sos.pk: SequenceMatcher(None, new_text, sos_text(sos)).ratio() for sos in recent}
    for sos in recent:
        if ratios[sos.pk] >= TEXT_THRESHOLD:
            return sos, 'text'

    if lat is not None and lng is not None:
        for sos in recent:
            if sos.status in OPEN_STATUSES and ratios[sos.pk] >= NEAR_TEXT_THRESHOLD and haversine_m(
                    float(lat), float(lng), float(sos.location_lat), float(sos.location_lng)) <= NEAR_DISTANCE_M:
                return sos, 'nearby_text'

    return None, ''
