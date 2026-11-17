"""
ai/priority_scorer.py
=====================
Tính điểm ưu tiên AI (ai_priority_score) cho từng Zone.

Công thức (mỗi f trong [0, 1], tổng trọng số = 100):
    score = w_sos        * f_sos(sos_count)
          + w_people     * f_people(people_affected)
          + w_severity   * severity_weight
          + w_wait       * f_wait(hours_waiting)
          + w_deficit    * f_rescuer_deficit(needed, assigned)
          + w_vulnerable * f_vulnerable(SOS trong zone)

    Kết quả chuẩn hoá về [0.00 – 100.00].

`f_vulnerable` lấy từ thông tin Model A/B đọc được trong ghi chú SOS (hoặc admin
đã duyệt với SOS từ Facebook): có người yếu thế, có nhu cầu y tế.

Trọng số là lựa chọn thiết kế, không học từ dữ liệu. Độ ổn định của thứ hạng
khi trọng số thay đổi được kiểm tra bằng lệnh:
    python manage.py ai_priority_sensitivity

Ý nghĩa điểm:
    80–100  → CRITICAL  (cần điều phối ngay)
    60–79   → HIGH
    40–59   → MEDIUM
    0–39    → LOW
"""

import math
from decimal import Decimal
from django.utils import timezone

# ─── Trọng số (tổng = 100) ───────────────────────────────────────────────────

WEIGHTS = {
    'sos':        20.0,   # Số lượng SOS trong zone
    'people':     25.0,   # Số nạn nhân
    'severity':   20.0,   # Mức độ nghiêm trọng khai báo
    'wait':       15.0,   # Thời gian chờ (zone càng lâu chưa giải quyết → càng ưu tiên)
    'deficit':    10.0,   # Thiếu hụt cứu hộ viên
    'vulnerable': 10.0,   # Có người yếu thế / nhu cầu y tế (từ phân tích ghi chú)
}

# Giữ tên cũ cho mã bên ngoài còn tham chiếu.
W_SOS_COUNT, W_PEOPLE, W_SEVERITY = WEIGHTS['sos'], WEIGHTS['people'], WEIGHTS['severity']
W_WAIT_TIME, W_RESCUER_DEF, W_VULNERABLE = WEIGHTS['wait'], WEIGHTS['deficit'], WEIGHTS['vulnerable']

# ─── Bảng severity → điểm ────────────────────────────────────────────────────

SEVERITY_SCORES = {
    'CRITICAL': 1.0,
    'HIGH':     0.75,
    'MEDIUM':   0.45,
    'LOW':      0.20,
}

ACTIVE_MISSION_STATUSES = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP']
OPEN_SOS_STATUSES = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS']

# ─── Hàm thành phần ──────────────────────────────────────────────────────────

def _f_sos(count: int) -> float:
    """
    Chuẩn hoá số SOS về [0, 1].
    Dùng log để tránh zone có 100 SOS áp đảo zone có 10 SOS quá mức.
    Tham chiếu: 1 SOS → ~0.18 | 10 SOS → ~0.61 | 50 SOS → 1.0
    """
    if count <= 0:
        return 0.0
    return min(1.0, math.log1p(count) / math.log1p(50))


def _f_people(people: int) -> float:
    """
    Chuẩn hoá số nạn nhân về [0, 1].
    Tham chiếu: 5 người → ~0.39 | 20 người → ~0.66 | 100 người → 1.0
    """
    if people <= 0:
        return 0.0
    return min(1.0, math.log1p(people) / math.log1p(100))


def _f_wait(created_at) -> float:
    """
    Điểm theo thời gian chờ, tăng tuyến tính.
    Tham chiếu: 6h → 0.25 | 12h → 0.50 | 24h trở lên → 1.0
    """
    hours = (timezone.now() - created_at).total_seconds() / 3600
    return min(1.0, max(0.0, hours / 24.0))


def _f_rescuer_deficit(needed: int, assigned: int) -> float:
    """
    Điểm thiếu hụt cứu hộ viên.
    deficit = max(0, needed - assigned) / max(1, needed)
    """
    if needed <= 0:
        return 0.0
    deficit = max(0, needed - assigned)
    return min(1.0, deficit / needed)


def _is_medical(sos) -> bool:
    kind = (sos.emergency_type or '').casefold()
    return ('medical' in kind or 'y tế' in kind
            or 'MEDICAL' in ((sos.ai_analysis or {}).get('needs') or []))


def _f_vulnerable(sos_list) -> float:
    """
    Mức dễ tổn thương của zone từ các SOS còn mở.
    0.6 nếu có SOS nêu người yếu thế (người già, trẻ nhỏ, bà bầu, người bệnh...),
    cộng 0.4 nếu có SOS cần y tế.
    """
    has_vulnerable = any((s.ai_analysis or {}).get('vulnerable_groups') for s in sos_list)
    has_medical = any(_is_medical(s) for s in sos_list)
    return 0.6 * has_vulnerable + 0.4 * has_medical


# ─── Tính điểm cho một Zone ──────────────────────────────────────────────────

def zone_features(zone) -> dict:
    """Các thành phần đã chuẩn hoá về [0, 1] của một Zone."""
    from reporting.models import Mission

    assigned = Mission.objects.filter(zone=zone, status__in=ACTIVE_MISSION_STATUSES).count()
    open_sos = list(zone.sos_signals.filter(status__in=OPEN_SOS_STATUSES)
                    .only('emergency_type', 'ai_analysis'))
    return {
        'sos':        _f_sos(zone.sos_signals.count()),
        'people':     _f_people(zone.people_affected or 0),
        'severity':   SEVERITY_SCORES.get(zone.severity, 0.45),
        'wait':       _f_wait(zone.created_at),
        'deficit':    _f_rescuer_deficit(zone.rescuers_needed or 0, assigned),
        'vulnerable': _f_vulnerable(open_sos),
    }


def score_from_features(features: dict, weights: dict = None) -> float:
    """Điểm [0, 100] từ các thành phần đã chuẩn hoá và bộ trọng số (mặc định WEIGHTS)."""
    weights = weights or WEIGHTS
    raw = sum(weights[name] * features.get(name, 0.0) for name in weights)
    return round(min(100.0, max(0.0, raw)), 2)


def compute_zone_score(zone, weights: dict = None) -> float:
    """
    Tính ai_priority_score cho một Zone object.
    Trả về float trong [0.00, 100.00].
    """
    return score_from_features(zone_features(zone), weights)


# ─── Main entrypoint: chạy lại toàn bộ zone ─────────────────────────────────

def run_priority_scoring(zone_ids: list = None) -> dict:
    """
    Tính lại ai_priority_score cho các zone.

    Args:
        zone_ids: list UUID str. Nếu None → tính lại tất cả zone ACTIVE/STABILIZING.

    Returns:
        dict: {'updated': int, 'scores': [{id, name, score}, ...]}
    """
    from rescue_operations.models import Zone

    qs = Zone.objects.filter(status__in=['ACTIVE', 'STABILIZING'])
    if zone_ids:
        qs = qs.filter(id__in=zone_ids)

    results = []
    for zone in qs:
        score = compute_zone_score(zone)
        Zone.objects.filter(pk=zone.pk).update(ai_priority_score=Decimal(str(score)))
        results.append({
            'id':    str(zone.id),
            'name':  zone.name,
            'score': score,
        })

    # Sắp xếp kết quả theo score giảm dần
    results.sort(key=lambda x: x['score'], reverse=True)
    return {'updated': len(results), 'scores': results}


def score_label(score: float) -> str:
    """Nhãn mức độ ưu tiên theo điểm số."""
    if score >= 80:
        return 'CRITICAL'
    elif score >= 60:
        return 'HIGH'
    elif score >= 40:
        return 'MEDIUM'
    else:
        return 'LOW'
