"""
ai/assignment_recommender.py
============================
AI Gợi ý Phân công Rescuer Tối Ưu cho Zone.

Thuật toán:
    Với mỗi cặp (Rescuer rảnh, Zone đang thiếu người), tính điểm phù hợp:

        score = w_dist     * f_distance(rescuer → zone)
              + w_specialty * f_specialty_match(rescuer.specialty, zone.incident_type)
              + w_priority  * f_zone_priority(zone.ai_priority_score)
              + w_deficit   * f_rescuer_deficit(zone)

    Sau đó ghép cặp bằng thuật toán Hungarian (tối ưu toàn cục): chọn tập cặp
    (Rescuer, Zone) có tổng điểm lớn nhất. Cách ghép tham lam cũ được giữ làm
    phương án dự phòng và để so sánh tổng điểm.

Trả về danh sách đề xuất dạng:
    [
        {
            'rescuer_id':   ...,
            'rescuer_name': ...,
            'zone_id':      ...,
            'zone_name':    ...,
            'match_score':  85.3,       # 0–100
            'reasons':      ['Gần zone nhất (1.2km)', 'Chuyên môn Y tế phù hợp'],
        },
        ...
    ]
"""

import logging
from .clustering import haversine_m          # Tái sử dụng Haversine đã có

logger = logging.getLogger(__name__)

# ─── Trọng số ─────────────────────────────────────────────────────────────────

W_DISTANCE  = 35.0   # Khoảng cách GPS
W_SPECIALTY = 30.0   # Chuyên môn phù hợp
W_PRIORITY  = 25.0   # Điểm ưu tiên Zone (ai_priority_score)
W_DEFICIT   = 10.0   # Mức thiếu hụt nhân lực Zone

# Khoảng cách tham chiếu: 0m → điểm 1.0 | 5000m → ~0.0
MAX_DIST_M = 5000.0

# Bảng khớp Chuyên môn ↔ Loại sự cố
SPECIALTY_MATCH = {
    'MEDICAL': {
        'y tế': 1.0, 'medical': 1.0,
        'thương vong': 0.9, 'nạn nhân': 0.8,
        'lũ': 0.5, 'lụt': 0.5, 'sạt lở': 0.5, 'bão': 0.5,
        'cháy': 0.4, 'mặc định': 0.3,
    },
    'SEARCH_RESCUE': {
        'sạt lở': 1.0, 'mất tích': 1.0, 'chìm': 0.9,
        'lũ': 0.8, 'lụt': 0.8, 'bão': 0.7,
        'cháy': 0.6, 'y tế': 0.3, 'mặc định': 0.5,
    },
    'LOGISTICS': {
        'hậu cần': 1.0, 'di tản': 0.9, 'sơ tán': 0.9,
        'lương thực': 0.9, 'nhu yếu phẩm': 0.8,
        'lũ': 0.6, 'lụt': 0.6, 'bão': 0.6,
        'sạt lở': 0.5, 'mặc định': 0.4,
    },
    'COMMAND': {
        'mặc định': 0.7,   # Chỉ huy phù hợp với mọi loại
    },
}


# ─── Các hàm thành phần ──────────────────────────────────────────────────────

def _f_distance(rescuer_lat: float, rescuer_lng: float,
                zone_lat: float, zone_lng: float) -> tuple[float, str]:
    """Điểm khoảng cách [0, 1] và chuỗi mô tả."""
    dist_m = haversine_m(rescuer_lat, rescuer_lng, zone_lat, zone_lng)
    score  = max(0.0, 1.0 - dist_m / MAX_DIST_M)
    km     = round(dist_m / 1000, 1)
    return score, f"Khoảng cách {km} km"


def _f_specialty(specialty: str, incident_type: str) -> tuple[float, str]:
    """Điểm khớp chuyên môn [0, 1] và chuỗi mô tả."""
    if not specialty:
        return 0.3, "Chưa có thông tin chuyên môn"

    mapping = SPECIALTY_MATCH.get(specialty, {})
    incident_lower = (incident_type or '').lower()

    best_score = mapping.get('mặc định', 0.3)
    for keyword, score in mapping.items():
        if keyword != 'mặc định' and keyword in incident_lower:
            if score > best_score:
                best_score = score

    specialty_label = {
        'MEDICAL': 'Y tế', 'SEARCH_RESCUE': 'Tìm kiếm & Cứu nạn',
        'LOGISTICS': 'Hậu cần', 'COMMAND': 'Chỉ huy',
    }.get(specialty, specialty)

    if best_score >= 0.8:
        reason = f"Chuyên môn {specialty_label} phù hợp cao"
    elif best_score >= 0.5:
        reason = f"Chuyên môn {specialty_label} phù hợp"
    else:
        reason = f"Chuyên môn {specialty_label} phù hợp một phần"

    return best_score, reason


def _f_priority(ai_score) -> float:
    """Chuẩn hoá ai_priority_score (0–100) về [0, 1]."""
    if ai_score is None:
        return 0.4
    return float(ai_score) / 100.0


def _f_deficit(zone, active_missions: int) -> float:
    """Điểm thiếu hụt: zone thiếu nhiều người → ưu tiên hơn."""
    needed = zone.rescuers_needed or 0
    if needed <= 0:
        return 0.0
    deficit = max(0, needed - active_missions)
    return min(1.0, deficit / needed)


# ─── Tính điểm một cặp (Rescuer, Zone) ──────────────────────────────────────

def _compute_match_score(rescuer, zone, active_missions: int) -> tuple[float, list[str]]:
    """
    Tính điểm phù hợp giữa một Rescuer và một Zone.
    Trả về: (score 0–100, danh sách lý do)
    """
    profile = getattr(rescuer, 'rescuer_profile', None)

    r_lat = float(profile.current_lat) if profile and profile.current_lat else None
    r_lng = float(profile.current_lng) if profile and profile.current_lng else None
    z_lat = float(zone.location_lat)
    z_lng = float(zone.location_lng)

    reasons = []

    # 1. Khoảng cách
    if r_lat and r_lng:
        d_score, d_reason = _f_distance(r_lat, r_lng, z_lat, z_lng)
        reasons.append(d_reason)
    else:
        d_score = 0.5   # Không có GPS → điểm trung bình
        reasons.append("Chưa có vị trí GPS")

    # 2. Chuyên môn
    specialty = profile.specialty if profile else None
    s_score, s_reason = _f_specialty(specialty, zone.incident_type)
    reasons.append(s_reason)

    # 3. Ưu tiên Zone
    p_score = _f_priority(zone.ai_priority_score)

    # 4. Thiếu hụt nhân lực
    def_score = _f_deficit(zone, active_missions)

    raw = (
        W_DISTANCE  * d_score +
        W_SPECIALTY * s_score +
        W_PRIORITY  * p_score +
        W_DEFICIT   * def_score
    )
    return round(min(100.0, raw), 1), reasons


# ─── Main entrypoint ─────────────────────────────────────────────────────────

def run_assignment_recommendation(
    zone_ids: list = None,
    top_n: int = 10,
) -> dict:
    """
    Sinh bảng đề xuất phân công Rescuer → Zone tối ưu.

    Args:
        zone_ids:   Giới hạn tính toán cho các Zone cụ thể. None = tất cả.
        top_n:      Số đề xuất tối đa trả về.

    Returns:
        {
            'recommendations': [ {rescuer_id, rescuer_name, zone_id, zone_name,
                                   match_score, reasons}, ... ],
            'rescuers_available': int,
            'zones_needing_help': int,
        }
    """
    from accounts.models import User
    from rescue_operations.models import Zone
    from reporting.models import Mission

    # ── Lấy Rescuer đang rảnh (is_on_duty=True, không có mission ACTIVE) ──────
    active_mission_rescuers = Mission.objects.filter(
        status__in=['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP']
    ).values_list('rescuer_id', flat=True)

    available_rescuers = User.objects.filter(
        role='RESCUER',
        is_active=True,
    ).exclude(id__in=active_mission_rescuers).select_related('rescuer_profile')

    from reporting.models import Resource
    eligible_ids = []
    for team in available_rescuers:
        latest = Resource.objects.filter(rescuer=team).order_by('-created_at').first()
        if latest and latest.is_available and latest.confirmed_at and latest.number_staff > 0:
            eligible_ids.append(team.pk)
    available_rescuers = available_rescuers.filter(pk__in=eligible_ids)

    # ── Lấy Zone đang cần người ───────────────────────────────────────────────
    zone_qs = Zone.objects.filter(status__in=['ACTIVE', 'STABILIZING'])
    if zone_ids:
        zone_qs = zone_qs.filter(id__in=zone_ids)
    # Chỉ Zone còn thiếu người
    zones_needing = []
    zone_active_missions = {}
    for zone in zone_qs:
        active = Mission.objects.filter(
            zone=zone, status__in=['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP']
        ).count()
        zone_active_missions[str(zone.id)] = active
        if active < (zone.rescuers_needed or 0):
            zones_needing.append(zone)

    if not available_rescuers or not zones_needing:
        return {
            'recommendations': [],
            'rescuers_available': available_rescuers.count() if available_rescuers else 0,
            'zones_needing_help': len(zones_needing),
            'message': (
                'Không có Rescuer rảnh.' if not available_rescuers.exists()
                else 'Tất cả Zone đã đủ nhân lực.'
            ),
        }

    # ── Tính ma trận điểm ────────────────────────────────────────────────────
    candidates = []
    for rescuer in available_rescuers:
        for zone in zones_needing:
            active_m = zone_active_missions.get(str(zone.id), 0)
            score, reasons = _compute_match_score(rescuer, zone, active_m)
            candidates.append({
                'rescuer_id':   str(rescuer.id),
                'rescuer_name': rescuer.full_name,
                'zone_id':      str(zone.id),
                'zone_name':    zone.name,
                'zone_severity': zone.severity,
                'match_score':  score,
                'reasons':      reasons,
            })

    # Số chỗ còn thiếu của từng Zone
    slots = {
        str(z.id): max(0, (z.rescuers_needed or 0) - zone_active_missions[str(z.id)])
        for z in zones_needing
    }

    greedy = greedy_matching(candidates, slots)
    try:
        matched, method = optimal_matching(candidates, slots), 'hungarian'
    except Exception as exc:
        # Thiếu scipy hoặc lỗi bất ngờ: vẫn phải trả được gợi ý.
        logger.warning('[Assignment] Hungarian không chạy được (%s); dùng ghép tham lam.', exc)
        matched, method = greedy, 'greedy'

    matched.sort(key=lambda x: x['match_score'], reverse=True)

    return {
        'recommendations':    matched[:top_n],
        'rescuers_available': available_rescuers.count(),
        'zones_needing_help': len(zones_needing),
        # Tổng điểm của toàn bộ phương án (trước khi cắt top_n) để so sánh hai cách ghép.
        'optimization': {
            'method':             method,
            'pairs':              len(matched),
            'total_score':        round(sum(c['match_score'] for c in matched), 1),
            'greedy_total_score': round(sum(c['match_score'] for c in greedy), 1),
        },
    }


# ─── Hai cách ghép cặp ───────────────────────────────────────────────────────

def greedy_matching(candidates: list, slots: dict) -> list:
    """
    Ghép tham lam: lần lượt lấy cặp điểm cao nhất còn hợp lệ.
    Nhanh nhưng không bảo đảm tổng điểm lớn nhất. Giữ để dự phòng và so sánh.
    """
    assigned_rescuers, assigned_per_zone, result = set(), {}, []
    for c in sorted(candidates, key=lambda x: x['match_score'], reverse=True):
        if c['rescuer_id'] in assigned_rescuers:
            continue
        if assigned_per_zone.get(c['zone_id'], 0) >= slots.get(c['zone_id'], 0):
            continue
        assigned_per_zone[c['zone_id']] = assigned_per_zone.get(c['zone_id'], 0) + 1
        assigned_rescuers.add(c['rescuer_id'])
        result.append(c)
    return result


def optimal_matching(candidates: list, slots: dict) -> list:
    """
    Ghép tối ưu toàn cục bằng thuật toán Hungarian (scipy linear_sum_assignment):
    chọn tập cặp (Rescuer, Zone) có TỔNG điểm phù hợp lớn nhất, mỗi Rescuer tối đa
    một Zone, mỗi Zone không quá số chỗ còn thiếu.

    Zone thiếu k người được nhân thành k cột, nên bài toán trở về dạng ghép 1-1.
    """
    import numpy as np
    from scipy.optimize import linear_sum_assignment

    rescuer_ids = list(dict.fromkeys(c['rescuer_id'] for c in candidates))
    # Một Zone không thể nhận nhiều hơn số Rescuer đang rảnh.
    columns = [zone_id for zone_id, n in slots.items() for _ in range(min(n, len(rescuer_ids)))]
    if not rescuer_ids or not columns:
        return []

    by_pair = {(c['rescuer_id'], c['zone_id']): c for c in candidates}
    scores = np.zeros((len(rescuer_ids), len(columns)))
    for i, rescuer_id in enumerate(rescuer_ids):
        for j, zone_id in enumerate(columns):
            pair = by_pair.get((rescuer_id, zone_id))
            scores[i, j] = pair['match_score'] if pair else 0.0

    rows, cols = linear_sum_assignment(scores, maximize=True)
    return [by_pair[(rescuer_ids[i], columns[j])] for i, j in zip(rows, cols)
            if (rescuer_ids[i], columns[j]) in by_pair]
