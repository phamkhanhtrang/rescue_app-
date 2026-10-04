"""
ai/priority_scorer.py
=====================
Tính điểm ưu tiên AI (ai_priority_score) cho từng Zone.

Công thức:
    score = w_sos    * f_sos(sos_count)
          + w_people * f_people(people_affected)
          + w_sev    * severity_weight
          + w_wait   * f_wait(hours_waiting)
          + w_rescue * f_rescuer_deficit(needed, assigned)

    Kết quả chuẩn hoá về [0.00 – 100.00].

Ý nghĩa điểm:
    80–100  → CRITICAL  (cần điều phối ngay)
    60–79   → HIGH
    40–59   → MEDIUM
    0–39    → LOW
"""

import math
from decimal import Decimal
from django.utils import timezone

# ─── Trọng số ─────────────────────────────────────────────────────────────────

W_SOS_COUNT   = 25.0   # Số lượng SOS trong zone
W_PEOPLE      = 30.0   # Số nạn nhân
W_SEVERITY    = 20.0   # Mức độ nghiêm trọng khai báo
W_WAIT_TIME   = 15.0   # Thời gian chờ (zone càng lâu chưa giải quyết → càng ưu tiên)
W_RESCUER_DEF = 10.0   # Thiếu hụt cứu hộ viên

# ─── Bảng severity → điểm ────────────────────────────────────────────────────

SEVERITY_SCORES = {
    'CRITICAL': 1.0,
    'HIGH':     0.75,
    'MEDIUM':   0.45,
    'LOW':      0.20,
}

# ─── Hàm thành phần ──────────────────────────────────────────────────────────

def _f_sos(count: int) -> float:
    """
    Chuẩn hoá số SOS về [0, 1].
    Dùng log để tránh zone có 100 SOS áp đảo zone có 10 SOS quá mức.
    Tham chiếu: 10 SOS → ~0.5 | 50 SOS → ~0.85 | 1 SOS → ~0.15
    """
    if count <= 0:
        return 0.0
    return min(1.0, math.log1p(count) / math.log1p(50))


def _f_people(people: int) -> float:
    """
    Chuẩn hoá số nạn nhân về [0, 1].
    Tham chiếu: 5 người → ~0.35 | 20 người → ~0.65 | 100 người → ~1.0
    """
    if people <= 0:
        return 0.0
    return min(1.0, math.log1p(people) / math.log1p(100))


def _f_wait(created_at) -> float:
    """
    Điểm theo thời gian chờ.
    Tham chiếu: 1h → 0.25 | 6h → 0.70 | 24h → 1.0
    """
    hours = (timezone.now() - created_at).total_seconds() / 3600
    return min(1.0, hours / 24.0)


def _f_rescuer_deficit(needed: int, assigned: int) -> float:
    """
    Điểm thiếu hụt cứu hộ viên.
    deficit = max(0, needed - assigned) / max(1, needed)
    """
    if needed <= 0:
        return 0.0
    deficit = max(0, needed - assigned)
    return min(1.0, deficit / needed)


# ─── Tính điểm cho một Zone ──────────────────────────────────────────────────

def compute_zone_score(zone) -> float:
    """
    Tính ai_priority_score cho một Zone object.
    Trả về float trong [0.00, 100.00].
    """
    from reporting.models import Mission

    sos_count  = zone.sos_signals.count()
    people     = zone.people_affected or 0
    needed     = zone.rescuers_needed or 0
    sev_score  = SEVERITY_SCORES.get(zone.severity, 0.45)

    # Số cứu hộ viên đang tham gia (ACTIVE missions)
    assigned = Mission.objects.filter(
        zone=zone,
        status__in=['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP']
    ).count()

    raw = (
        W_SOS_COUNT   * _f_sos(sos_count) +
        W_PEOPLE      * _f_people(people) +
        W_SEVERITY    * sev_score +
        W_WAIT_TIME   * _f_wait(zone.created_at) +
        W_RESCUER_DEF * _f_rescuer_deficit(needed, assigned)
    )

    # Tổng max lý thuyết = W_SOS+W_PEOPLE+W_SEVERITY+W_WAIT+W_RESCUER = 100
    return round(min(100.0, raw), 2)


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
