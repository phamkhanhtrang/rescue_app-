"""
ai/clustering.py
================
Thuật toán gom cụm SOS → Zone theo khoảng cách địa lý (Haversine).

Logic:
  - Lấy tất cả SOS chưa được gán zone (zone=None) hoặc chỉ SOS trong zone cụ thể.
  - Gom cụm bằng DBSCAN (scikit-learn, khoảng cách Haversine):
      * eps = CLUSTER_RADIUS_M, min_samples = MIN_SAMPLES.
      * Hai SOS cách nhau ≤ eps thuộc cùng cụm; cụm lan theo chuỗi các điểm kề nhau.
      * Kết quả không phụ thuộc thứ tự duyệt SOS (khác với cách gom tham lam cũ).
      * SOS không có láng giềng trong eps là "nhiễu" → giữ thành SOS đơn lẻ.
  - Tâm zone = trung bình kinh/vĩ độ các điểm trong cụm.
  - KHÔNG thêm trường DB mới — chỉ dùng trường zone FK sẵn có trên SOSSignal.
"""

import logging
import math
from decimal import Decimal
from django.utils import timezone

logger = logging.getLogger(__name__)

# ─── Hằng số ─────────────────────────────────────────────────────────────────

CLUSTER_RADIUS_M = 300      # Bán kính gom cụm (mét) — 300m theo spec
MIN_SAMPLES      = 2        # Số SOS tối thiểu để tạo zone mới (>=2 SOS cụm mới tạo zone; 1 SOS đơn giữ là SOS điểm)
EARTH_RADIUS_M   = 6_371_000  # Bán kính Trái Đất (mét)


# ─── Haversine distance ───────────────────────────────────────────────────────

def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Khoảng cách (mét) giữa hai điểm GPS theo công thức Haversine."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


# ─── Centroid ────────────────────────────────────────────────────────────────

def centroid(points: list[tuple[float, float]]) -> tuple[float, float]:
    """Tính tâm (trung bình) của danh sách điểm (lat, lng)."""
    avg_lat = sum(p[0] for p in points) / len(points)
    avg_lng = sum(p[1] for p in points) / len(points)
    return round(avg_lat, 7), round(avg_lng, 7)


# ─── Clustering ───────────────────────────────────────────────────────────────

def cluster_sos_signals(sos_queryset) -> list[list]:
    """
    Gom danh sách SOS thành các cụm theo khoảng cách bằng DBSCAN.

    Returns:
        Danh sách các cụm, mỗi cụm là list các SOSSignal objects. SOS "nhiễu"
        (không có SOS nào khác trong CLUSTER_RADIUS_M) trả về thành cụm 1 phần tử.
        Thứ tự cụm theo SOS xuất hiện sớm nhất trong đầu vào.
    """
    sos_list = list(sos_queryset)
    if not sos_list:
        return []
    try:
        labels = _dbscan_labels(sos_list)
    except Exception as exc:
        # Thiếu scikit-learn hoặc lỗi bất ngờ: vẫn phải gom được cụm.
        logger.warning('[Clustering] DBSCAN không chạy được (%s); dùng gom tham lam.', exc)
        return greedy_cluster_sos_signals(sos_list)

    clusters, by_label = [], {}
    for sos, label in zip(sos_list, labels):
        if label == -1:
            clusters.append([sos])
        elif label in by_label:
            by_label[label].append(sos)
        else:
            by_label[label] = [sos]
            clusters.append(by_label[label])
    return clusters


def _dbscan_labels(sos_list: list) -> list[int]:
    """Nhãn cụm DBSCAN cho từng SOS; -1 là điểm nhiễu."""
    import numpy as np
    from sklearn.cluster import DBSCAN

    coords = np.radians([[float(s.location_lat), float(s.location_lng)] for s in sos_list])
    model = DBSCAN(eps=CLUSTER_RADIUS_M / EARTH_RADIUS_M, min_samples=MIN_SAMPLES,
                   metric='haversine', algorithm='ball_tree')
    return model.fit_predict(coords).tolist()


def greedy_cluster_sos_signals(sos_queryset) -> list[list]:
    """
    Thuật toán gom tham lam cũ (O(n²)), giữ làm phương án dự phòng và để so sánh.

      1. Lấy SOS chưa gán đầu tiên làm hạt nhân cụm mới.
      2. Thêm mọi SOS chưa gán trong bán kính CLUSTER_RADIUS_M quanh hạt nhân.
      3. Lặp đến khi hết SOS. Kết quả phụ thuộc thứ tự duyệt.
    """
    sos_list = list(sos_queryset)
    assigned = set()
    clusters = []

    for i, sos_i in enumerate(sos_list):
        if i in assigned:
            continue

        lat_i = float(sos_i.location_lat)
        lng_i = float(sos_i.location_lng)

        cluster = [sos_i]
        assigned.add(i)

        for j, sos_j in enumerate(sos_list):
            if j in assigned:
                continue
            dist = haversine_m(lat_i, lng_i,
                               float(sos_j.location_lat),
                               float(sos_j.location_lng))
            if dist <= CLUSTER_RADIUS_M:
                cluster.append(sos_j)
                assigned.add(j)

        clusters.append(cluster)

    return clusters


# ─── Map emergency_type → Zone severity ──────────────────────────────────────

def map_severity(sos_list: list) -> str:
    """
    Suy ra severity của zone dựa trên nội dung SOS trong cụm.
    Dùng people_count và emergency_type để quyết định.
    """
    total_people = sum(int(s.people_count or 1) for s in sos_list)
    has_medical = any('y tế' in (s.emergency_type or '').lower() or
                      'medical' in (s.emergency_type or '').lower()
                      for s in sos_list)

    if total_people >= 20 or (total_people >= 10 and has_medical):
        return 'CRITICAL'
    elif total_people >= 10 or len(sos_list) >= 5:
        return 'HIGH'
    elif total_people >= 3 or len(sos_list) >= 2:
        return 'MEDIUM'
    else:
        return 'LOW'


# ─── Main entrypoint ─────────────────────────────────────────────────────────

def run_clustering(only_unassigned: bool = True) -> dict:
    """
    Chạy toàn bộ pipeline gom cụm:
      1. Lấy SOS cần xử lý.
      2. Gom cụm.
      3. Tạo Zone mới (nếu cụm không có zone) hoặc cập nhật zone cũ.
      4. Gán zone_id vào từng SOS.

    Args:
        only_unassigned: True → chỉ gom SOS chưa có zone (mặc định).
                         False → gom lại toàn bộ PENDING/ACKNOWLEDGED SOS.

    Returns:
        dict thống kê: zones_created, zones_updated, sos_assigned, zone_ids
        (zone_ids = các Zone vừa tạo/cập nhật, để chấm điểm lại).
    """
    # Import ở đây để tránh circular import
    from rescue_operations.models import Zone, SOSSignal

    # Lấy SOS cần gom cụm
    base_qs = SOSSignal.objects.filter(status__in=['PENDING', 'ACKNOWLEDGED'])
    if only_unassigned:
        base_qs = base_qs.filter(zone__isnull=True)

    stats = {'zones_created': 0, 'zones_updated': 0, 'sos_assigned': 0, 'zone_ids': []}
    if not base_qs.exists():
        return stats

    # Thứ tự cố định để kết quả lặp lại được giữa các lần chạy.
    clusters = cluster_sos_signals(base_qs.order_by('sent_at', 'id'))

    for cluster in clusters:
        if not cluster:
            continue

        lats_lngs = [(float(s.location_lat), float(s.location_lng)) for s in cluster]
        center_lat, center_lng = centroid(lats_lngs)
        severity = map_severity(cluster)
        total_people = sum(int(s.people_count or 1) for s in cluster)

        # Tên zone tự động
        zone_name = _auto_zone_name(center_lat, center_lng, len(cluster))

        # Tìm zone cũ gần trung tâm trong bán kính CLUSTER_RADIUS_M
        existing_zone = _find_nearby_zone(Zone, center_lat, center_lng)

        if existing_zone:
            # Cập nhật zone hiện có
            existing_zone.people_affected = max(existing_zone.people_affected, total_people)
            existing_zone.severity = severity
            existing_zone.updated_at = timezone.now()
            existing_zone.save(update_fields=['people_affected', 'severity', 'updated_at'])
            zone = existing_zone
            stats['zones_updated'] += 1
        elif len(cluster) >= MIN_SAMPLES or total_people >= 10:
            # Tạo zone mới khi cụm có >= MIN_SAMPLES hoặc quy mô người bị nạn lớn (>= 10)
            zone = Zone.objects.create(
                name=zone_name,
                status='ACTIVE',
                severity=severity,
                incident_type=_dominant_incident_type(cluster),
                location_lat=Decimal(str(center_lat)),
                location_lng=Decimal(str(center_lng)),
                people_affected=total_people,
                rescuers_needed=max(1, total_people // 5),
            )
            stats['zones_created'] += 1
        else:
            # SOS đơn lẻ (1 SOS) đứng độc lập và không gần zone nào -> Giữ nguyên zone=None (SOS phản ứng nhanh)
            continue

        if str(zone.id) not in stats['zone_ids']:
            stats['zone_ids'].append(str(zone.id))

        # Gán zone cho từng SOS trong cụm
        for sos in cluster:
            if sos.zone_id != zone.id:
                sos.zone = zone
                sos.save(update_fields=['zone'])
                stats['sos_assigned'] += 1

    return stats


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _find_nearby_zone(Zone, lat: float, lng: float):
    """Tìm Zone ACTIVE gần tâm cụm trong vòng CLUSTER_RADIUS_M."""
    for zone in Zone.objects.filter(status__in=['ACTIVE', 'STABILIZING']):
        dist = haversine_m(lat, lng,
                           float(zone.location_lat),
                           float(zone.location_lng))
        if dist <= CLUSTER_RADIUS_M:
            return zone
    return None


def _dominant_incident_type(sos_list: list) -> str:
    """Lấy loại sự cố xuất hiện nhiều nhất trong cụm."""
    from collections import Counter
    types = [s.emergency_type for s in sos_list if s.emergency_type]
    if not types:
        return 'Chưa xác định'
    return Counter(types).most_common(1)[0][0]


def _auto_zone_name(lat: float, lng: float, count: int) -> str:
    """Tạo tên zone tự động từ tọa độ + số lượng SOS."""
    now = timezone.now()
    return f"Zone AI {now.strftime('%d/%m %H:%M')} ({count} SOS)"
