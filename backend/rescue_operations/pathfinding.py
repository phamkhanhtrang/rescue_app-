"""
rescue_operations/pathfinding.py
=================================
Động cơ Dẫn đường Cứu hộ Né ngập (Nationwide OSRM Routing Engine).
Hỗ trợ định tuyến toàn quốc với cơ chế né các điểm ngập sâu và chướng ngại vật thời gian thực.
"""

import os
import math
import logging
import requests

logger = logging.getLogger(__name__)

# =========================================================
# CONSTANTS & CONFIGURATION
# =========================================================

EARTH_RADIUS = 6371000  # meters

SEVERITY_MULTIPLIER = {
    1: 1.2,
    2: 1.5,
    3: 2.5,
    4: float("inf"),  # Đập/ngập nóc/cháy lớn/sạt lở: cấm tuyệt đối
}

# Danh sách URL máy chủ OSRM:
# Nếu người dùng cấu hình OSRM_URL (ví dụ Docker local http://localhost:5000) thì ưu tiên.
# Mặc định dùng Public OSRM Server để phản hồi tức thì (<500ms) trên toàn quốc.
custom_osrm = os.environ.get("OSRM_URL")
if custom_osrm:
    OSRM_SERVERS = [custom_osrm.rstrip("/"), "https://router.project-osrm.org"]
else:
    OSRM_SERVERS = ["https://router.project-osrm.org"]

OSRM_TIMEOUT = 5  # seconds


# =========================================================
# VALIDATION
# =========================================================

def validate_coordinates(coords):
    if not isinstance(coords, (tuple, list)):
        raise ValueError("Coordinates must be tuple/list")
    if len(coords) != 2:
        raise ValueError("Coordinates must have 2 values (lat, lng)")

    lat, lng = coords
    if not (-90 <= lat <= 90):
        raise ValueError(f"Invalid latitude: {lat}")
    if not (-180 <= lng <= 180):
        raise ValueError(f"Invalid longitude: {lng}")


def validate_hazards(hazards):
    if not isinstance(hazards, list):
        raise ValueError("Hazards must be a list")

    required_fields = ["lat", "lng"]
    for hazard in hazards:
        for field in required_fields:
            if field not in hazard:
                raise ValueError(f"Missing hazard field: {field}")


# =========================================================
# HAVERSINE DISTANCE
# =========================================================

def haversine_distance(lat1, lon1, lat2, lon2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# =========================================================
# HAZARD RISK EVALUATION
# =========================================================

def evaluate_route_risk(geojson_coords, hazards):
    """
    Đánh giá độ rủi ro của lộ trình so với danh sách điểm nguy hiểm.
    geojson_coords: list of [lng, lat]
    hazards: list of {'lat': float, 'lng': float, 'radius': float, 'severity': int}
    
    Returns:
        (total_penalty: float, blocked: bool, collisions: list)
    """
    if not hazards or not geojson_coords:
        return 1.0, False, []

    total_penalty = 1.0
    is_blocked = False
    collisions = []

    for hazard in hazards:
        h_lat = float(hazard["lat"])
        h_lng = float(hazard["lng"])
        h_radius = float(hazard.get("radius", 150))
        h_sev = int(hazard.get("severity", 1))
        multiplier = SEVERITY_MULTIPLIER.get(h_sev, 1.2)

        # Tìm khoảng cách ngắn nhất từ bất kỳ điểm nào trên lộ trình tới điểm nguy hiểm
        min_dist = float("inf")
        for pt in geojson_coords:
            dist = haversine_distance(pt[1], pt[0], h_lat, h_lng)
            if dist < min_dist:
                min_dist = dist
                if min_dist <= h_radius:
                    break

        # Nếu tuyến đường đi thẳng vào tâm vùng nguy cấp
        if min_dist <= h_radius:
            if multiplier == float("inf"):
                is_blocked = True
                collisions.append(hazard)
                return float("inf"), True, collisions
            total_penalty += multiplier * 2.0
            collisions.append(hazard)

        # Nếu tuyến đường đi sát mép vùng nguy hiểm (cận nguy)
        elif min_dist <= h_radius * 2.0:
            total_penalty += multiplier * 0.5
            collisions.append(hazard)

    return total_penalty, is_blocked, collisions


# =========================================================
# OSRM CLIENT & DETOUR GENERATOR
# =========================================================

def fetch_osrm_routes(waypoints, alternatives=True):
    """
    Gọi OSRM API tìm đường qua danh sách waypoints [(lat, lng), ...]
    Hỗ trợ fallback tuần tự từ Local OSRM sang Public OSRM.
    """
    coords_str = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in waypoints)
    alt_param = "true" if alternatives else "false"

    for base_url in OSRM_SERVERS:
        url = (
            f"{base_url.rstrip('/')}/route/v1/driving/{coords_str}"
            f"?overview=full&geometries=geojson&alternatives={alt_param}&steps=false"
        )
        try:
            resp = requests.get(url, timeout=OSRM_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    return data["routes"]
        except Exception as e:
            logger.warning(f"OSRM server [{base_url}] unavailable: {e}")
            continue

    return None


def calculate_bypass_waypoints(hazard, start_coords, target_coords):
    """
    Tạo điểm né (detour waypoints) theo phương vuông góc với vector di chuyển.
    Đẩy xa khỏi tâm ngập thêm (radius + 200m).
    """
    h_lat, h_lng = float(hazard["lat"]), float(hazard["lng"])
    h_rad = float(hazard.get("radius", 150)) + 200  # meters

    s_lat, s_lng = start_coords
    t_lat, t_lng = target_coords

    d_lat = t_lat - s_lat
    d_lng = (t_lng - s_lng) * math.cos(math.radians(h_lat))
    length = math.hypot(d_lat, d_lng)

    if length == 0:
        return []

    # Vector pháp tuyến (vuông góc)
    n_lat = -d_lng / length
    n_lng = (d_lat / length) / math.cos(math.radians(h_lat))

    # Đổi offset mét sang độ
    deg_per_meter = 1.0 / 111320.0
    offset_lat = n_lat * h_rad * deg_per_meter
    offset_lng = n_lng * h_rad * deg_per_meter

    # 2 phương án né: sang trái hoặc sang phải
    pt_left = (round(h_lat + offset_lat, 6), round(h_lng + offset_lng, 6))
    pt_right = (round(h_lat - offset_lat, 6), round(h_lng - offset_lng, 6))

    return [pt_left, pt_right]


# =========================================================
# MAIN ROUTING ENTRYPOINT
# =========================================================

def get_rescue_route(start_coords, target_coords, hazards=None):
    """
    Tính lộ trình cứu hộ tối ưu toàn quốc né các điểm nguy hiểm.

    Args:
        start_coords: (lat, lng) của đội cứu hộ
        target_coords: (lat, lng) của nạn nhân hoặc Zone
        hazards: danh sách [{'lat': ..., 'lng': ..., 'radius': ..., 'severity': ...}]

    Returns:
        dict: {
            'status': 'success' | 'error',
            'path': [{'latitude': lat, 'longitude': lng}, ...],
            'distance_meters': int,
            'eta_seconds': int,
            'hazards_avoided': int,
            'engine': 'OSRM'
        }
    """
    if hazards is None:
        hazards = []

    try:
        validate_coordinates(start_coords)
        validate_coordinates(target_coords)
        validate_hazards(hazards)

        # 1. Gọi OSRM lấy các tuyến đường ứng viên (Candidates)
        routes = fetch_osrm_routes([start_coords, target_coords], alternatives=True)

        selected_route = None
        best_score = float("inf")
        blocked_hazards = []

        if routes:
            # 2. Đánh giá rủi ro từng phương án tuyến đường OSRM đề xuất
            for r in routes:
                coords = r["geometry"]["coordinates"]  # [[lng, lat], ...]
                penalty, blocked, collisions = evaluate_route_risk(coords, hazards)
                
                route_dist = r.get("distance", 1)
                score = route_dist * penalty

                if not blocked and score < best_score:
                    best_score = score
                    selected_route = r

                if blocked:
                    blocked_hazards.extend(collisions)

            # 3. Nếu TẤT CẢ các đường chính đều bị chặn bởi ngập cấp 4:
            #    Tự động tính lộ trình đi vòng (Detour) qua các điểm né
            if selected_route is None and blocked_hazards:
                logger.info(f"Tất cả lộ trình trực tiếp bị ngập sâu. Tìm đường vòng né {len(blocked_hazards)} chướng ngại...")
                detour_candidate = None
                detour_best_score = float("inf")

                for h in blocked_hazards[:3]:  # Xử lý tối đa 3 điểm chặn chính
                    bypasses = calculate_bypass_waypoints(h, start_coords, target_coords)
                    for bypass_pt in bypasses:
                        detour_routes = fetch_osrm_routes([start_coords, bypass_pt, target_coords], alternatives=False)
                        if detour_routes:
                            d_route = detour_routes[0]
                            d_coords = d_route["geometry"]["coordinates"]
                            d_penalty, d_blocked, _ = evaluate_route_risk(d_coords, hazards)
                            
                            if not d_blocked:
                                d_score = d_route.get("distance", 1) * d_penalty
                                if d_score < detour_best_score:
                                    detour_best_score = d_score
                                    detour_candidate = d_route

                if detour_candidate:
                    selected_route = detour_candidate
                    logger.info("Đã tìm thấy lộ trình vòng tránh ngập thành công!")

            # 4. Nếu vẫn không có đường an toàn tuyệt đối, dùng phương án ít rủi ro nhất
            if selected_route is None:
                selected_route = min(routes, key=lambda r: r.get("distance", 1))
                logger.warning("Không tìm thấy đường an toàn tuyệt đối. Chọn tuyến đường ngắn nhất kèm cảnh báo.")

        # =====================================================
        # 5. ĐÓNG GÓI KẾT QUẢ ĐẦU RA
        # =====================================================
        if selected_route:
            coords = selected_route["geometry"]["coordinates"]
            path = [{"latitude": round(lat, 6), "longitude": round(lng, 6)} for lng, lat in coords]
            distance = round(selected_route.get("distance", 0))
            duration = round(selected_route.get("duration", distance / 9.7))  # fallback 35 km/h

            return {
                "status": "success",
                "path": path,
                "distance_meters": distance,
                "eta_seconds": duration,
                "hazards_avoided": len(hazards),
                "engine": "OSRM"
            }

        # =====================================================
        # 6. FALLBACK NỘI BỘ (Khi hoàn toàn mất mạng OSRM)
        # =====================================================
        logger.error("OSRM unreachable. Sử dụng lộ trình nội suy đường thẳng khẩn cấp.")
        direct_dist = haversine_distance(start_coords[0], start_coords[1], target_coords[0], target_coords[1])
        steps = max(5, int(direct_dist // 100))
        fallback_path = []
        for i in range(steps + 1):
            ratio = i / steps
            lat = start_coords[0] + ratio * (target_coords[0] - start_coords[0])
            lng = start_coords[1] + ratio * (target_coords[1] - start_coords[1])
            fallback_path.append({"latitude": round(lat, 6), "longitude": round(lng, 6)})

        return {
            "status": "success",
            "path": fallback_path,
            "distance_meters": round(direct_dist),
            "eta_seconds": round(direct_dist / 9.7),
            "warning": "Lộ trình dự phòng khẩn cấp do mất kết nối máy chủ bản đồ.",
            "engine": "FALLBACK"
        }

    except Exception as e:
        logger.exception(f"Pathfinding Exception: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }


# =========================================================
# SNAP TO ROAD SEGMENT (CHO BÁO CÁO ĐOẠN ĐƯỜNG SỰ CỐ)
# =========================================================

def _polyline_length_m(coords):
    """Tính tổng chiều dài (mét) của chuỗi điểm [[lat, lng], ...]."""
    if not coords or len(coords) < 2:
        return 0
    total = 0.0
    for i in range(len(coords) - 1):
        total += haversine_distance(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
    return round(total)


def _clip_polyline_around_point(coords, ref_lat=None, ref_lng=None, max_len_m=300):
    """
    Cắt một đoạn đường vừa vặn (~150m - 300m) từ một tuyến đường dài (LineString)
    quanh vị trí tham chiếu (ref_lat, ref_lng) hoặc quanh tâm tuyến đường.
    """
    if not coords or len(coords) < 2:
        return coords

    total_len = _polyline_length_m(coords)
    if total_len <= max_len_m:
        return coords

    if ref_lat is not None and ref_lng is not None:
        best_idx = min(
            range(len(coords)),
            key=lambda i: haversine_distance(ref_lat, ref_lng, coords[i][0], coords[i][1]),
        )
    else:
        best_idx = len(coords) // 2

    half_target = max_len_m / 2.0
    left_idx = best_idx
    acc_left = 0.0
    while left_idx > 0 and acc_left < half_target:
        step_d = haversine_distance(
            coords[left_idx][0], coords[left_idx][1],
            coords[left_idx - 1][0], coords[left_idx - 1][1],
        )
        acc_left += step_d
        left_idx -= 1

    right_idx = best_idx
    acc_right = 0.0
    while right_idx < len(coords) - 1 and acc_right < half_target:
        step_d = haversine_distance(
            coords[right_idx][0], coords[right_idx][1],
            coords[right_idx + 1][0], coords[right_idx + 1][1],
        )
        acc_right += step_d
        right_idx += 1

    clipped = coords[left_idx : right_idx + 1]
    if len(clipped) < 2:
        return coords[:2]
    return clipped


def _fetch_osm_road_by_query(road_query, ref_lat=None, ref_lng=None):
    """
    Tìm con đường theo tên (VD: 'Đường Hàm Nghi, Đà Nẵng', 'Nguyễn Hữu Thọ')
    qua OpenStreetMap Nominatim (kèm polygon_geojson=1) để lấy đúng LineString mặt đường.
    """
    if not road_query or not str(road_query).strip():
        return None

    q = str(road_query).strip()
    params = {
        "q": q,
        "format": "jsonv2",
        "polygon_geojson": 1,
        "addressdetails": 1,
        "countrycodes": "vn",
        "limit": 5,
    }
    if ref_lat is not None and ref_lng is not None:
        # Ưu tiên kết quả gần vị trí người dùng (~15km viewbox)
        pad = 0.15
        params["viewbox"] = f"{ref_lng - pad:.5f},{ref_lat + pad:.5f},{ref_lng + pad:.5f},{ref_lat - pad:.5f}"

    headers = {"User-Agent": "GuardianPulseRescueSystem/2.0 (contact@guardianpulse.vn)"}
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params=params,
            headers=headers,
            timeout=4,
        )
        if resp.status_code != 200:
            return None
        items = resp.json()
        if not isinstance(items, list) or not items:
            return None

        # Ưu tiên kết quả có geojson là LineString / MultiLineString (đường giao thông)
        best_item = None
        best_coords = None
        for item in items:
            geojson = item.get("geojson") or {}
            gtype = geojson.get("type")
            raw_c = geojson.get("coordinates") or []
            if gtype == "LineString" and len(raw_c) >= 2:
                best_item = item
                best_coords = [[round(float(pt[1]), 6), round(float(pt[0]), 6)] for pt in raw_c]
                break
            elif gtype == "MultiLineString" and raw_c:
                longest = max(raw_c, key=lambda seg: len(seg) if isinstance(seg, list) else 0)
                if isinstance(longest, list) and len(longest) >= 2:
                    best_item = item
                    best_coords = [[round(float(pt[1]), 6), round(float(pt[0]), 6)] for pt in longest]
                    break

        if best_item and best_coords:
            # Nếu người dùng không đứng ngay trên con đường đó (>600m), lấy tâm con đường tìm được
            anchor_lat, anchor_lng = ref_lat, ref_lng
            if anchor_lat is not None and anchor_lng is not None:
                min_d = min(haversine_distance(anchor_lat, anchor_lng, pt[0], pt[1]) for pt in best_coords)
                if min_d > 600:
                    anchor_lat, anchor_lng = None, None
            clipped = _clip_polyline_around_point(best_coords, anchor_lat, anchor_lng, max_len_m=300)
            addr_obj = best_item.get("address") or {}
            road_title = (
                addr_obj.get("road")
                or best_item.get("name")
                or (best_item.get("display_name") or "").split(",")[0]
                or q
            )
            suburb = addr_obj.get("suburb") or addr_obj.get("quarter") or addr_obj.get("city_district") or ""
            city = addr_obj.get("city") or addr_obj.get("state") or addr_obj.get("province") or ""
            full_label = ", ".join(filter(None, [road_title, suburb, city]))
            return {
                "geometry": clipped,
                "road_name": full_label or road_title,
                "lat": float(best_item.get("lat", clipped[len(clipped) // 2][0])),
                "lng": float(best_item.get("lon", clipped[len(clipped) // 2][1])),
            }

        # Nếu Nominatim trả về Point (địa chỉ/đầu đường), trả tọa độ để OSRM bắt mặt đường
        first = items[0]
        return {
            "geometry": None,
            "road_name": (first.get("display_name") or "").split(",")[0] or q,
            "lat": float(first["lat"]),
            "lng": float(first["lon"]),
        }
    except Exception as e:
        logger.warning(f"Nominatim road search warning: {e}")
        return None


def min_distance_to_road_segment(lat, lng, road_geometry=None, fallback_lat=None, fallback_lng=None):
    """
    Tính khoảng cách ngắn nhất (mét) từ điểm (lat, lng) tới toàn bộ đoạn đường road_geometry.
    Hỗ trợ linh hoạt cả 2 thứ tự tham số:
    - min_distance_to_road_segment(lat, lng, road_geometry, fallback_lat, fallback_lng)
    - min_distance_to_road_segment(lat, lng, fallback_lat, fallback_lng, road_geometry)
    Hỗ trợ nội suy điểm giữa của từng đoạn thẳng để không bị lọt khe trên đoạn đường dài.
    """
    try:
        t_lat, t_lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return float("inf")

    # Kiểm tra nếu tham số thứ 3 là số và tham số thứ 5 là list -> người gọi truyền theo thứ tự (lat, lng, fb_lat, fb_lng, geom)
    if not isinstance(road_geometry, (list, tuple)) and isinstance(fallback_lng, (list, tuple)):
        actual_geom = fallback_lng
        actual_fb_lat = road_geometry
        actual_fb_lng = fallback_lat
        road_geometry = actual_geom
        fallback_lat = actual_fb_lat
        fallback_lng = actual_fb_lng

    pts = []
    if isinstance(road_geometry, (list, tuple)) and len(road_geometry) >= 2:
        for i in range(len(road_geometry)):
            pt = road_geometry[i]
            p_lat, p_lng = None, None
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                try:
                    p_lat, p_lng = float(pt[0]), float(pt[1])
                except (TypeError, ValueError):
                    pass
            elif isinstance(pt, dict):
                try:
                    p_lat = float(pt.get("lat", pt.get("latitude")))
                    p_lng = float(pt.get("lng", pt.get("longitude")))
                except (TypeError, ValueError):
                    pass

            if p_lat is not None and p_lng is not None:
                pts.append((p_lat, p_lng))
                if i + 1 < len(road_geometry):
                    nxt = road_geometry[i + 1]
                    n_lat, n_lng = None, None
                    if isinstance(nxt, (list, tuple)) and len(nxt) >= 2:
                        try:
                            n_lat, n_lng = float(nxt[0]), float(nxt[1])
                        except (TypeError, ValueError):
                            pass
                    elif isinstance(nxt, dict):
                        try:
                            n_lat = float(nxt.get("lat", nxt.get("latitude")))
                            n_lng = float(nxt.get("lng", nxt.get("longitude")))
                        except (TypeError, ValueError):
                            pass
                    if n_lat is not None and n_lng is not None:
                        pts.append(((p_lat + n_lat) / 2.0, (p_lng + n_lng) / 2.0))

    if not pts and fallback_lat is not None and fallback_lng is not None:
        try:
            pts.append((float(fallback_lat), float(fallback_lng)))
        except (TypeError, ValueError):
            pass

    if not pts:
        return float("inf")

    return min(haversine_distance(t_lat, t_lng, p[0], p[1]) for p in pts)


def extract_road_segment(start_lat=None, start_lng=None, end_lat=None, end_lng=None, road_query=None):
    """
    Trích xuất hình học đoạn đường thực tế (Polyline [[lat, lng], ...]) tự động:
    1. Nếu người dân nhập tên đường (`road_query`): Tự động tìm đúng con đường đó trên
       OpenStreetMap / OSRM và tô màu đoạn đường bám sát thực tế (không cần chọn điểm A-B).
    2. Nếu người dân chỉ gửi 1 điểm GPS (`start_lat, start_lng`): Dùng OSRM /nearest bắt vào
       tim đường đang đứng, lấy tên đường và tìm đúng trục đường đó để tô màu ~160m-250m.
    3. Tương thích ngược nếu có truyền `end_lat, end_lng`.
    """
    s_lat = float(start_lat) if start_lat is not None else None
    s_lng = float(start_lng) if start_lng is not None else None
    road_name = ""
    geometry = []

    # Bước 0: Nếu có nhập tên đường (road_query), ưu tiên tìm hình học con đường theo tên
    if road_query and str(road_query).strip():
        osm_match = _fetch_osm_road_by_query(road_query, s_lat, s_lng)
        if osm_match:
            road_name = osm_match.get("road_name") or str(road_query).strip()
            if osm_match.get("geometry") and len(osm_match["geometry"]) >= 2:
                geometry = osm_match["geometry"]
                seg_len = max(50, _polyline_length_m(geometry))
                mid_pt = geometry[len(geometry) // 2]
                return {
                    "center_lat": mid_pt[0],
                    "center_lng": mid_pt[1],
                    "start_lat": geometry[0][0],
                    "start_lng": geometry[0][1],
                    "end_lat": geometry[-1][0],
                    "end_lng": geometry[-1][1],
                    "road_geometry": geometry,
                    "segment_length_m": seg_len,
                    "road_name": road_name,
                }
            # Nếu Nominatim trả về 1 tọa độ trên đường đó, dùng tọa độ đó làm tâm để OSRM dò mặt đường
            s_lat = osm_match.get("lat", s_lat)
            s_lng = osm_match.get("lng", s_lng)

    if s_lat is None or s_lng is None:
        s_lat, s_lng = 16.0544, 108.2022

    has_end = end_lat is not None and end_lng is not None
    if has_end:
        e_lat, e_lng = float(end_lat), float(end_lng)
        if haversine_distance(s_lat, s_lng, e_lat, e_lng) < 15:
            has_end = False

    if not has_end:
        # Bước 1A: Bắt chính xác vào tim đường gần nhất qua OSRM /nearest?number=1
        snapped_road_name = ""
        for base_url in OSRM_SERVERS:
            url = f"{base_url.rstrip('/')}/nearest/v1/driving/{s_lng:.6f},{s_lat:.6f}?number=1"
            try:
                resp = requests.get(url, timeout=3)
                if resp.status_code == 200:
                    wps = resp.json().get("waypoints", [])
                    if wps:
                        loc0 = wps[0].get("location", [s_lng, s_lat])
                        s_lng, s_lat = float(loc0[0]), float(loc0[1])
                        snapped_road_name = (wps[0].get("name") or "").strip()
                        if snapped_road_name and not road_name:
                            road_name = snapped_road_name
                        break
            except Exception:
                continue

        # Bước 1B: Nếu lấy được tên đường từ GPS, thử lấy trực tiếp LineString của đường đó quanh GPS
        if snapped_road_name:
            osm_by_gps_name = _fetch_osm_road_by_query(snapped_road_name, s_lat, s_lng)
            if osm_by_gps_name and osm_by_gps_name.get("geometry") and len(osm_by_gps_name["geometry"]) >= 2:
                cand_geom = osm_by_gps_name["geometry"]
                if min_distance_to_road_segment(s_lat, s_lng, cand_geom) <= 80:
                    geometry = cand_geom
                    if osm_by_gps_name.get("road_name"):
                        road_name = osm_by_gps_name["road_name"]

        # Bước 1C: Nếu chưa có geometry từ OSM, dò 4 phương trục đường qua OSRM để tìm đúng trục của con đường hiện tại
        if len(geometry) < 2:
            # 4 cặp hướng đối xứng cách tâm ~85m (Bắc-Nam, Đông-Tây, ĐB-TN, TB-ĐN)
            step_deg = 0.00076  # ~85m
            direction_Axes = [
                (step_deg, 0.0),
                (0.0, step_deg),
                (step_deg * 0.707, step_deg * 0.707),
                (step_deg * 0.707, -step_deg * 0.707),
            ]
            best_axis_geom = None
            best_axis_score = float("inf")

            for d_lat, d_lng in direction_Axes:
                p1 = (round(s_lat - d_lat, 6), round(s_lng - d_lng, 6))
                p2 = (round(s_lat + d_lat, 6), round(s_lng + d_lng, 6))
                coords_str = f"{p1[1]:.6f},{p1[0]:.6f};{s_lng:.6f},{s_lat:.6f};{p2[1]:.6f},{p2[0]:.6f}"
                for base_url in OSRM_SERVERS:
                    url = f"{base_url.rstrip('/')}/route/v1/driving/{coords_str}?overview=full&geometries=geojson&steps=true"
                    try:
                        resp = requests.get(url, timeout=2.5)
                        if resp.status_code == 200:
                            data = resp.json()
                            routes = data.get("routes", [])
                            if data.get("code") == "Ok" and routes:
                                r0 = routes[0]
                                dist = float(r0.get("distance", 0))
                                raw_c = r0.get("geometry", {}).get("coordinates", [])
                                direct_d = haversine_distance(p1[0], p1[1], p2[0], p2[1])
                                if raw_c and 60 <= dist <= direct_d * 1.45:
                                    # Ưu tiên phương án đi thẳng dọc theo đúng 1 trục đường (độ lệch nhỏ nhất)
                                    ratio = dist / max(1.0, direct_d)
                                    if ratio < best_axis_score:
                                        best_axis_score = ratio
                                        best_axis_geom = [[round(lat, 6), round(lng, 6)] for lng, lat in raw_c]
                                        if not road_name:
                                            for leg in r0.get("legs", []):
                                                for st in leg.get("steps", []):
                                                    if st.get("name"):
                                                        road_name = st["name"]
                                                        break
                        break
                    except Exception:
                        continue
                if best_axis_score <= 1.08:
                    break

            if best_axis_geom and len(best_axis_geom) >= 2:
                geometry = best_axis_geom

        route_pair = [(round(s_lat - 0.0006, 6), round(s_lng, 6)), (round(s_lat + 0.0006, 6), round(s_lng, 6))]
    else:
        e_lat, e_lng = float(end_lat), float(end_lng)
        route_pair = [(s_lat, s_lng), (e_lat, e_lng)]

    # Bước 2: Nếu có chọn 2 điểm hoặc cần gọi OSRM /route cho cặp điểm
    if len(geometry) < 2:
        coords_str = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in route_pair)
        for base_url in OSRM_SERVERS:
            url = (
                f"{base_url.rstrip('/')}/route/v1/driving/{coords_str}"
                f"?overview=full&geometries=geojson&steps=true"
            )
            try:
                resp = requests.get(url, timeout=4)
                if resp.status_code == 200:
                    data = resp.json()
                    routes = data.get("routes", [])
                    if data.get("code") == "Ok" and routes:
                        r0 = routes[0]
                        raw_coords = r0.get("geometry", {}).get("coordinates", [])
                        dist = round(r0.get("distance", 0))
                        direct_d = max(50, haversine_distance(route_pair[0][0], route_pair[0][1], route_pair[1][0], route_pair[1][1]))
                        if raw_coords and dist <= max(600, direct_d * 2.5):
                            geometry = [[round(lat, 6), round(lng, 6)] for lng, lat in raw_coords]
                        legs = r0.get("legs", [])
                        if legs and not road_name:
                            for step in legs[0].get("steps", []):
                                if step.get("name"):
                                    road_name = step["name"]
                                    break
                        break
            except Exception:
                continue

    # Bước 3: Fallback nội suy nếu hoàn toàn mất kết nối bản đồ
    if len(geometry) < 2:
        p1_lat, p1_lng = route_pair[0]
        p2_lat, p2_lng = route_pair[1]
        geometry = [
            [round(p1_lat, 6), round(p1_lng, 6)],
            [round((p1_lat + p2_lat) / 2, 6), round((p1_lng + p2_lng) / 2, 6)],
            [round(p2_lat, 6), round(p2_lng, 6)],
        ]

    segment_length = max(50, _polyline_length_m(geometry))
    mid_pt = geometry[len(geometry) // 2]

    return {
        "center_lat": mid_pt[0],
        "center_lng": mid_pt[1],
        "start_lat": geometry[0][0],
        "start_lng": geometry[0][1],
        "end_lat": geometry[-1][0],
        "end_lng": geometry[-1][1],
        "road_geometry": geometry,
        "segment_length_m": segment_length,
        "road_name": road_name,
    }

