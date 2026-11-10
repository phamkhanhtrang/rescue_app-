import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Count
from django.db.models import Q
from .models import Zone, SOSSignal, SOSImage, CrowdReport, CrowdReportVote
from .serializers import (
    ZoneSerializer, ZoneListSerializer,
    SOSSignalSerializer, SOSSignalListSerializer,
    SOSImageSerializer,
    CrowdReportSerializer, CrowdReportVoteSerializer,
)

logger = logging.getLogger(__name__)


# ─── ZONE ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def zone_list(request):
    """Danh sách vùng sự cố, có thể lọc theo status và severity."""
    queryset = Zone.objects.annotate(_sos_count=Count('sos_signals')).order_by('-updated_at')
    s = request.query_params.get('status')
    sev = request.query_params.get('severity')
    if s:
        queryset = queryset.filter(status=s.upper())
    if sev:
        queryset = queryset.filter(severity=sev.upper())
    total = queryset.count()
    try:
        limit = min(max(int(request.query_params.get('limit', 0)), 0), 1000)
    except (TypeError, ValueError):
        limit = 0
    serializer = ZoneListSerializer(queryset[:limit] if limit else queryset, many=True)
    return Response({'count': total, 'results': serializer.data})


@api_view(['POST'])
@permission_classes([AllowAny])
def zone_create(request):
    from .flow import admin
    if not admin(request.user): return Response({'error': 'Chỉ admin được tạo vùng.'}, status=403)
    """Tạo vùng sự cố mới."""
    serializer = ZoneSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def zone_detail(request, pk):
    from .flow import admin
    if request.method != 'GET' and not admin(request.user): return Response({'error': 'Chỉ admin được sửa vùng.'}, status=403)
    """Chi tiết / Cập nhật / Xóa một Zone."""
    try:
        zone = Zone.objects.get(pk=pk)
    except Zone.DoesNotExist:
        return Response({'error': 'Không tìm thấy vùng sự cố.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ZoneSerializer(zone).data)

    if request.method == 'PUT':
        requested_status = str(request.data.get('status', '')).upper()
        if requested_status == 'RESOLVED':
            open_sos = zone.sos_signals.filter(
                status__in=['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'],
            ).exclude(verification_status='INCORRECT').exists()
            active_missions = zone.missions.filter(
                status__in=['PENDING_ACCEPTANCE', 'ACCEPTED', 'ON_MY_WAY', 'ACTIVE', 'NEEDS_HELP'],
            ).exists()
            if open_sos or active_missions:
                return Response({
                    'error': 'Chưa thể đóng vùng khi còn SOS chưa xử lý hoặc đội chưa hoàn thành nhiệm vụ.'
                }, status=status.HTTP_400_BAD_REQUEST)
        serializer = ZoneSerializer(zone, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        if zone.alerts.exists():
            return Response({'error': 'Khu vực còn bản tin liên quan. Hãy giữ khu vực để bảo toàn phạm vi thông báo.'}, status=400)
        if zone.sos_signals.exists() or zone.missions.filter(
            status__in=['PENDING_ACCEPTANCE', 'ACCEPTED', 'ON_MY_WAY', 'ACTIVE', 'NEEDS_HELP'],
        ).exists():
            return Response({
                'error': 'Chỉ được xóa vùng trống và không còn nhiệm vụ đang hoạt động.'
            }, status=status.HTTP_400_BAD_REQUEST)
        zone.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── DASHBOARD STATS ─────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_stats(request):
    """Thống kê tổng quan cho Dashboard."""
    total_zones = Zone.objects.count()
    total_sos = SOSSignal.objects.count()

    severity_stats = Zone.objects.values('severity').annotate(count=Count('id'))
    status_stats = Zone.objects.values('status').annotate(count=Count('id'))
    sos_status_stats = SOSSignal.objects.values('status').annotate(count=Count('id'))

    return Response({
        'summary': {
            'total_zones': total_zones,
            'total_sos': total_sos,
        },
        'zones_by_severity': {item['severity']: item['count'] for item in severity_stats},
        'zones_by_status': {item['status']: item['count'] for item in status_stats},
        'sos_by_status': {item['status']: item['count'] for item in sos_status_stats},
    })


# ─── SOS SIGNAL ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def sos_list(request):
    """Danh sách tín hiệu SOS, có thể lọc theo status và signal_type."""
    include_images = request.query_params.get('include_images', '1').lower() not in ['0', 'false', 'no']
    queryset = SOSSignal.objects.select_related(
        'citizen', 'zone', 'assigned_mission', 'assigned_mission__rescuer'
    ).order_by('-sent_at')
    if include_images:
        queryset = queryset.prefetch_related('images')
    from .flow import operator
    if not request.user.is_authenticated:
        return Response({'error': 'Cần đăng nhập hoặc mở yêu cầu bằng mã theo dõi riêng.'}, status=403)
    if not operator(request.user):
        queryset = queryset.filter(citizen=request.user)
    s = request.query_params.get('status')
    t = request.query_params.get('signal_type')
    z = request.query_params.get('zone') or request.query_params.get('zone_id')
    c = request.query_params.get('citizen')
    if s:
        queryset = queryset.filter(status=s.upper())
    if t:
        queryset = queryset.filter(signal_type=t.upper())
    if z:
        queryset = queryset.filter(zone_id=z)
    if c:
        queryset = queryset.filter(citizen_id=c)
    total = queryset.count()
    try:
        limit = min(max(int(request.query_params.get('limit', 0)), 0), 1000)
    except (TypeError, ValueError):
        limit = 0
    serializer = SOSSignalListSerializer(queryset[:limit] if limit else queryset, many=True, context={'include_images': include_images})
    return Response({'count': total, 'results': serializer.data})


@api_view(['POST'])
@permission_classes([AllowAny])
def sos_create(request):
    """Gửi tín hiệu SOS/PING mới. Sau khi lưu, kích hoạt AI gom cụm."""
    serializer = SOSSignalSerializer(data=request.data)
    if serializer.is_valid():
        sos = serializer.save()

        # ── Trigger AI clustering ngay sau khi SOS được lưu ──────────────
        # Chỉ gom SOS signal loại SOS (không gom PING)
        if sos.signal_type == 'SOS':
            try:
                from ai.clustering import run_clustering
                stats = run_clustering(only_unassigned=True)
                logger.info(
                    f"[AI Trigger] SOS {sos.id} tạo mới → "
                    f"clustering: {stats}"
                )
            except Exception as e:
                # AI lỗi KHÔNG ảnh hưởng response trả về cho người dùng
                logger.error(f"[AI Trigger] Clustering thất bại sau SOS create: {e}")
        # ─────────────────────────────────────────────────────────────────

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def anonymous_sos_create(request):
    """Gửi tín hiệu SOS ẩn danh (không cần tài khoản / JWT token)."""
    data = request.data.copy()
    phone = data.get('phone', 'Chưa cung cấp')
    note = data.get('note', '')
    data['note'] = f"[SĐT Liên Hệ: {phone} | SOS ẨN DANH]\n{note}".strip()
    data['signal_type'] = 'SOS'
    data['status'] = 'PENDING'
    data['citizen'] = None

    serializer = SOSSignalSerializer(data=data)
    if serializer.is_valid():
        sos = serializer.save()
        try:
            from ai.clustering import run_clustering
            stats = run_clustering(only_unassigned=True)
            logger.info(f"[AI Trigger] Anonymous SOS {sos.id} created → clustering: {stats}")
        except Exception as e:
            logger.error(f"[AI Trigger] Clustering failed for anonymous SOS: {e}")

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def sos_detail(request, pk):
    """Chi tiết / Cập nhật trạng thái / Xoá một SOS."""
    try:
        sos = SOSSignal.objects.get(pk=pk)
    except SOSSignal.DoesNotExist:
        return Response({'error': 'Không tìm thấy tín hiệu SOS.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(SOSSignalSerializer(sos).data)

    if request.method == 'DELETE':
        zone_id = sos.zone_id
        sos.delete()

        # Cập nhật lại thông tin Zone nếu SOS này thuộc về 1 Zone
        if zone_id:
            try:
                zone = Zone.objects.get(id=zone_id)

                # Tính lại thông tin dựa trên các SOS còn lại
                sos_list = SOSSignal.objects.filter(zone=zone, status__in=['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'])
                total_people = sum(int(s.people_count or 1) for s in sos_list)

                if total_people == 0 and not sos_list.exists():
                    zone.status = 'RESOLVED'
                else:
                    from ai.clustering import map_severity
                    zone.severity = map_severity(list(sos_list))

                zone.people_affected = total_people
                zone.save(update_fields=['people_affected', 'severity', 'status'])

                from ai.priority_scorer import run_priority_scoring
                run_priority_scoring(zone_ids=[str(zone_id)])
                logger.info(f"[AI Trigger] Xoá SOS {pk} → Cập nhật thông tin & điểm cho Zone {zone_id}")
            except Exception as e:
                logger.error(f"[AI Trigger] Lỗi tính điểm sau khi xoá SOS: {e}")

        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = SOSSignalSerializer(sos, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def sos_image_upload(request, sos_id):
    """Đính kèm ảnh cho một tín hiệu SOS."""
    try:
        SOSSignal.objects.get(pk=sos_id)
    except SOSSignal.DoesNotExist:
        return Response({'error': 'Không tìm thấy tín hiệu SOS.'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data.copy()
    data['sos'] = sos_id
    serializer = SOSImageSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def get_rescue_route_api(request):
    from .pathfinding import get_rescue_route

    try:

        # =================================================
        # GET REQUEST DATA
        # =================================================

        start = request.data.get('start')
        target = request.data.get('target')

        if not start or not target:

            return Response({
                'status': 'error',
                'message': 'Missing start or target coordinates'
            }, status=400)

        # =================================================
        # VALIDATE STRUCTURE
        # =================================================

        if (
            'lat' not in start or
            'lng' not in start or
            'lat' not in target or
            'lng' not in target
        ):

            return Response({
                'status': 'error',
                'message': 'Invalid coordinate structure'
            }, status=400)

        # =================================================
        # PARSE COORDINATES
        # =================================================

        start_lat = float(start['lat'])
        start_lng = float(start['lng'])

        target_lat = float(target['lat'])
        target_lng = float(target['lng'])

        # =================================================
        # SPATIAL FILTERING
        # =================================================

        padding = 0.03

        min_lat = min(start_lat, target_lat) - padding
        max_lat = max(start_lat, target_lat) + padding

        min_lng = min(start_lng, target_lng) - padding
        max_lng = max(start_lng, target_lng) + padding

        # =================================================
        # LOAD HAZARDS
        # =================================================

        sos_hazards = SOSSignal.objects.filter(

            Q(note__icontains='ngập') |
            Q(note__icontains='lụt') |
            Q(note__icontains='sạt lở') |
            Q(note__icontains='cháy'),

            status__in=[
                'PENDING',
                'ACKNOWLEDGED',
                'IN_PROGRESS'
            ],

            location_lat__isnull=False,
            location_lng__isnull=False,

            # spatial filtering
            location_lat__gte=min_lat,
            location_lat__lte=max_lat,
            location_lng__gte=min_lng,
            location_lng__lte=max_lng

        ).only(
            'note',
            'location_lat',
            'location_lng'
        )[:500]

        # =================================================
        # BUILD HAZARD LIST
        # =================================================

        hazards_list = []

        for sos in sos_hazards:

            severity = calculate_severity(
                sos.note
            )

            hazards_list.append({

                'lat': float(sos.location_lat),

                'lng': float(sos.location_lng),

                'radius': 150,

                'severity': severity
            })

        # Tích hợp các Báo cáo hiện trường từ người dân (CrowdReport) còn hiệu lực vào dẫn đường OSRM
        _auto_expire_stale_reports()
        crowd_hazards = CrowdReport.objects.filter(
            is_hidden=False,
            status__in=['PENDING', 'VERIFIED', 'RECEDING'],
            location_lat__gte=min_lat,
            location_lat__lte=max_lat,
            location_lng__gte=min_lng,
            location_lng__lte=max_lng,
        )
        for cr in crowd_hazards:
            if cr.status == 'RECEDING':
                # Quy tắc 4: Nước đang rút (vẫn còn ngập nhẹ/bùn lầy) -> mức cảnh báo 2, không chặn cứng như ngập sâu
                cr_sev = 2
            elif cr.severity == 'CRITICAL' or cr.water_level_cm >= 70 or cr.hazard_type in ('FALLEN_TREE', 'LANDSLIDE', 'POWER_LINE', 'ROAD_BLOCKED'):
                cr_sev = 4
            elif cr.severity == 'HIGH' or cr.water_level_cm >= 40:
                cr_sev = 3
            else:
                cr_sev = 2

            # Rải dày các điểm chặn dọc theo toàn bộ đoạn đường sự cố (road_geometry) để OSRM né trọn vẹn cả đoạn đường
            geom = cr.road_geometry if isinstance(cr.road_geometry, list) and len(cr.road_geometry) >= 2 else None
            if geom:
                from .pathfinding import haversine_distance
                sampled_pts = []
                for idx in range(len(geom)):
                    pt = geom[idx]
                    if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                        p_lat, p_lng = float(pt[0]), float(pt[1])
                        sampled_pts.append((p_lat, p_lng))
                        if idx + 1 < len(geom):
                            nxt = geom[idx + 1]
                            if isinstance(nxt, (list, tuple)) and len(nxt) >= 2:
                                n_lat, n_lng = float(nxt[0]), float(nxt[1])
                                seg_d = haversine_distance(p_lat, p_lng, n_lat, n_lng)
                                if seg_d > 80:
                                    steps = min(6, int(seg_d // 75))
                                    for s_i in range(1, steps + 1):
                                        r_f = s_i / (steps + 1)
                                        sampled_pts.append((
                                            p_lat + (n_lat - p_lat) * r_f,
                                            p_lng + (n_lng - p_lng) * r_f,
                                        ))
                for s_lat, s_lng in sampled_pts[:15]:
                    hazards_list.append({
                        'lat': s_lat,
                        'lng': s_lng,
                        'radius': 95 if cr.is_verified else 80,
                        'severity': cr_sev,
                    })
            else:
                hazards_list.append({
                    'lat': float(cr.location_lat),
                    'lng': float(cr.location_lng),
                    'radius': 150 if cr.is_verified else 120,
                    'severity': cr_sev,
                })

        logger.info(
            f"Hazards loaded: {len(hazards_list)}"
        )

        # =================================================
        # RUN ROUTING
        # =================================================

        result = get_rescue_route(

            (start_lat, start_lng),

            (target_lat, target_lng),

            hazards_list
        )

        # =================================================
        # HANDLE ROUTING ERROR
        # =================================================

        if result['status'] == 'error':

            if result['message'] == 'No safe route found':

                return Response(
                    result,
                    status=404
                )

            return Response(
                result,
                status=500
            )

        # =================================================
        # EXTRACT WAYPOINTS & GOOGLE MAPS NAVIGATION URL
        # =================================================
        path = result.get('path', [])
        waypoints = []
        if len(path) > 3:
            step = len(path) // 3
            p1 = path[step]
            p2 = path[step * 2]
            waypoints = [
                {'latitude': p1['latitude'], 'longitude': p1['longitude']},
                {'latitude': p2['latitude'], 'longitude': p2['longitude']}
            ]

        waypoints_param = ''
        if waypoints:
            waypoints_param = '&waypoints=' + '|'.join(f"{wp['latitude']},{wp['longitude']}" for wp in waypoints)

        google_maps_url = (
            f"https://www.google.com/maps/dir/?api=1"
            f"&origin={start_lat},{start_lng}"
            f"&destination={target_lat},{target_lng}"
            f"{waypoints_param}&travelmode=driving"
        )

        return Response({
            'status': 'success',
            'path': result['path'],
            'waypoints': waypoints,
            'google_maps_url': google_maps_url,
            'distance_meters': result['distance_meters'],
            'eta_seconds': result['eta_seconds'],
            'hazards_detected': len(hazards_list)
        })

    except ValueError:

        return Response({

            'status': 'error',

            'message': 'Invalid coordinate format'

        }, status=400)

    except Exception as e:

        logger.exception(
            f"ROUTING API ERROR: {str(e)}"
        )

        return Response({

            'status': 'error',

            'message': str(e)

        }, status=500)

def calculate_severity(note):

    note = (note or '').lower()

    if 'cháy lớn' in note:
        return 4

    if 'sạt lở' in note:
        return 4

    if 'ngập nặng' in note:
        return 3

    if 'ngập' in note:
        return 2

    return 1



# ============================================================
# BÁO CÁO HIỆN TRƯỜNG TỪ NGƯỜI DÂN & VOTE XÁC THỰC (T2 + T3 + T4 + S2 + S4 + 6 QUY TẮC)
# ============================================================

VOTE_TTL_HOURS = 6           # Quy tắc 2: Phiếu xác nhận có hiệu lực 6 giờ trong cùng đợt sự cố
PENDING_TTL_HOURS = 3        # Điểm PENDING mới chỉ có 1 người báo, nếu sau 3 giờ không ai vote thêm sẽ tự ẩn (EXPIRED)
VERIFIED_TTL_HOURS = 6       # Điểm đã xác thực có thời hạn 6 giờ kể từ phiếu xác nhận cuối cùng
RECEDING_TTL_HOURS = 4       # Điểm nước đang rút tự hết hạn sau 4 giờ nếu không có báo cáo mới
CLEARED_VISIBLE_MINUTES = 60 # Điểm ĐÃ THÔNG ĐƯỜNG chỉ hiển thị màu xanh trên bản đồ 60 phút rồi tự ẩn
MERGE_ACTIVE_HOURS = 6       # Quy tắc 5: Chỉ gộp báo cáo đang mở trong cùng khung 6 giờ
REOPEN_CLEARED_HOURS = 12    # Quy tắc 3: Mở lại điểm đã thông đường nếu tái ngập trong 12 giờ


def _auto_expire_stale_reports():
    """
    Tự động kiểm tra và ẩn/hết hạn các đoạn đường quá thời hạn (TTL) không có ai vote thêm,
    hoặc đã thông đường quá 60 phút.
    """
    from datetime import timedelta
    from django.utils import timezone
    from django.db.models import Q

    now = timezone.now()
    # 1. Điểm đã quá thời hạn expires_at (không có ai vote gia hạn thêm) -> chuyển sang EXPIRED & ẩn
    CrowdReport.objects.filter(
        status__in=['PENDING', 'VERIFIED', 'RECEDING'],
        is_hidden=False,
        expires_at__isnull=False,
        expires_at__lte=now,
    ).update(status='EXPIRED', is_hidden=True)

    # Fallback cho dữ liệu cũ chưa có expires_at
    CrowdReport.objects.filter(
        status='PENDING',
        is_hidden=False,
        expires_at__isnull=True,
        updated_at__lte=now - timedelta(hours=PENDING_TTL_HOURS),
    ).update(status='EXPIRED', is_hidden=True)

    CrowdReport.objects.filter(
        status__in=['VERIFIED', 'RECEDING'],
        is_hidden=False,
        expires_at__isnull=True,
        updated_at__lte=now - timedelta(hours=VERIFIED_TTL_HOURS),
    ).update(status='EXPIRED', is_hidden=True)

    # 2. Điểm CLEARED (Đường đã thông) sau 60 phút tự ẩn khỏi bản đồ để tránh rác giao diện
    cleared_cutoff = now - timedelta(minutes=CLEARED_VISIBLE_MINUTES)
    CrowdReport.objects.filter(
        status='CLEARED',
        is_hidden=False,
    ).filter(
        Q(cleared_at__lte=cleared_cutoff) | Q(cleared_at__isnull=True, updated_at__lte=cleared_cutoff)
    ).update(is_hidden=True)


def _map_report_severity(hazard_type: str, water_level_cm: int) -> str:
    if hazard_type in ('LANDSLIDE', 'POWER_LINE', 'ROAD_BLOCKED') or water_level_cm >= 100:
        return 'CRITICAL'
    if water_level_cm >= 60 or hazard_type == 'FALLEN_TREE':
        return 'HIGH'
    if water_level_cm >= 30:
        return 'MEDIUM'
    return 'LOW'


def _build_voter_identifier(user, request_data, voter_name: str, request=None) -> str:
    """
    Quy tắc 1: Tạo định danh duy nhất cho mỗi người/tài khoản/thiết bị để chống vote trùng,
    nhưng KHÔNG gộp chung những người dân khác nhau để tên mặc định 'Người dân'.
    """
    import hashlib
    if user and getattr(user, 'is_authenticated', False):
        return f"user:{user.id}"
    explicit_id = str(
        request_data.get('voter_id')
        or request_data.get('device_id')
        or request_data.get('phone')
        or ''
    ).strip().lower()
    if explicit_id:
        return f"id:{explicit_id}"
    norm_name = ' '.join((voter_name or '').strip().lower().split())
    default_names = {'', 'người dân', 'nguoi dan', 'người dân địa phương', 'nguoi dan dia phuong', 'ẩn danh'}
    if norm_name and norm_name not in default_names:
        return f"name:{norm_name}"
    if request is not None:
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        ip = xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR', '0.0.0.0')
        ua = request.META.get('HTTP_USER_AGENT', '')[:120]
        fp = hashlib.sha1(f"{ip}|{ua}".encode('utf-8')).hexdigest()[:16]
        return f"anon:{fp}"
    return f"name:{norm_name or 'nguoi_dan'}"


def _resolve_voter_role(user, request_data) -> str:
    """
    Xác định vai trò người vote. Chỉ cấp quyền RESCUER / ADMIN khi user đã đăng nhập
    hoặc request có truyền voter_role hợp lệ từ trang Quản trị / App Cứu hộ.
    """
    if user and getattr(user, 'is_authenticated', False):
        role = getattr(user, 'role', 'CITIZEN')
        if role in ('CITIZEN', 'RESCUER', 'ADMIN'):
            return role
    raw_role = str(request_data.get('voter_role', 'CITIZEN') or 'CITIZEN').upper()
    if raw_role in ('CITIZEN', 'RESCUER', 'ADMIN'):
        return raw_role
    return 'CITIZEN'


def _extract_street_signature(address: str) -> str:
    """
    Quy tắc 5: Trích xuất tên đường/ngõ chính để tránh gộp nhầm 2 đoạn đường khác nhau
    dù cách nhau dưới 150m (ví dụ 2 đường song song hoặc 2 ngõ khác nhau).
    """
    import re
    if not address:
        return ''
    primary = address.split(',')[0].strip().lower()
    primary = re.sub(r'^(số\s+nhà|số|sn)\s*\d+[a-z0-9/\-]*\s*', '', primary)
    primary = re.sub(r'^\d+[a-z]?(\s+|\s*/\s*\d+\s*)', '', primary)
    primary = re.sub(r'\b(đường|phố|đại lộ|tuyến)\b', '', primary)
    primary = ' '.join(primary.split())
    return primary


def _are_addresses_compatible(addr1: str, addr2: str) -> bool:
    """
    Quy tắc 5: Kiểm tra 2 địa chỉ có thuộc cùng đoạn đường hay không.
    """
    sig1 = _extract_street_signature(addr1)
    sig2 = _extract_street_signature(addr2)
    if not sig1 or not sig2:
        return True
    if sig1 in sig2 or sig2 in sig1:
        return True
    return False


def _record_vote_with_dedup(
    report: CrowdReport,
    user,
    voter_identifier: str,
    voter_name: str,
    voter_role: str,
    verdict: str,
    note: str,
    water_level_cm,
    image_file=None,
) -> CrowdReportVote:
    """
    Quy tắc 1: Mỗi tài khoản chỉ tính 1 phiếu hiện hành (is_active_vote=True)
    nhưng vẫn giữ nguyên toàn bộ lịch sử cập nhật trước đó (is_active_vote=False).
    """
    if voter_identifier:
        CrowdReportVote.objects.filter(
            report=report,
            voter_identifier=voter_identifier,
            is_active_vote=True,
        ).update(is_active_vote=False)

    vote_kwargs = dict(
        report=report,
        user=user,
        voter_identifier=voter_identifier,
        voter_name=voter_name,
        voter_role=voter_role,
        verdict=verdict,
        note=note,
        water_level_cm=water_level_cm,
        incident_wave=report.incident_wave,
        is_active_vote=True,
    )
    if image_file:
        vote_kwargs['image'] = image_file

    return CrowdReportVote.objects.create(**vote_kwargs)


def _recalculate_report_state(
    report: CrowdReport,
    latest_verdict: str,
    latest_voter_role: str,
    latest_water_level_cm=None,
):
    """
    Tính toán lại trạng thái & thời hạn tự ẩn (expires_at) của CrowdReport dựa trên:
    - Quy tắc 1: Chỉ đếm phiếu hiện hành (is_active_vote=True).
    - Quy tắc 2: Chỉ đếm phiếu trong cùng đợt sự cố (incident_wave) và còn thời hạn hiệu lực (VOTE_TTL_HOURS).
    - Quy tắc 3: Mở lại báo cáo (tăng incident_wave) nếu điểm đã CLEARED/EXPIRED mà có báo ngập trở lại.
    - Quy tắc 4: Phân biệt rõ 'Nước đang rút' (RECEDING) và 'Đường đã thông' (CLEARED), tính theo đa số phiếu và trọng số Cứu hộ/Admin.
    """
    from datetime import timedelta
    from django.utils import timezone

    now = timezone.now()
    ttl_cutoff = now - timedelta(hours=VOTE_TTL_HOURS)

    # Lọc các phiếu hợp lệ của đợt sự cố hiện tại (Quy tắc 1 & 2)
    valid_votes = [
        v for v in report.votes.all()
        if v.is_active_vote and v.incident_wave == report.incident_wave and v.voted_at >= ttl_cutoff
    ]

    danger_votes = [v for v in valid_votes if v.verdict in ('CONFIRM_DANGER', 'WORSENED')]
    receding_votes = [v for v in valid_votes if v.verdict == 'RECEDING']
    cleared_votes = [v for v in valid_votes if v.verdict == 'CLEARED']
    false_votes = [v for v in valid_votes if v.verdict == 'FALSE_REPORT']

    danger_count = len(danger_votes)
    receding_count = len(receding_votes)
    cleared_count = len(cleared_votes)
    false_count = len(false_votes)

    has_trusted_danger = any(v.voter_role in ('RESCUER', 'ADMIN') for v in danger_votes)
    is_trusted = latest_voter_role in ('RESCUER', 'ADMIN')

    # Cập nhật mức nước theo phản hồi mới nhất (nhưng không cho 1 phiếu dân lẻ làm mất mức ngập đã xác thực cao)
    if latest_water_level_cm is not None:
        if latest_verdict in ('CONFIRM_DANGER', 'WORSENED'):
            report.water_level_cm = max(report.water_level_cm, latest_water_level_cm)
            report.severity = _map_report_severity(report.hazard_type, report.water_level_cm)
        elif latest_verdict == 'RECEDING' and (is_trusted or receding_count >= danger_count or danger_count <= 1):
            report.water_level_cm = latest_water_level_cm
            report.severity = _map_report_severity(report.hazard_type, report.water_level_cm)

    report.report_count = max(1, danger_count + receding_count)

    # 1. Nếu Admin / Cứu hộ ra quyết định trực tiếp -> Ưu tiên hiệu lực ngay
    if is_trusted:
        if latest_verdict == 'FALSE_REPORT':
            report.status = 'REJECTED'
            report.is_verified = False
            report.is_hidden = True
            return
        if latest_verdict == 'CLEARED':
            report.status = 'CLEARED'
            report.cleared_at = now
            report.water_level_cm = 0
            report.is_hidden = False
            report.expires_at = now + timedelta(minutes=CLEARED_VISIBLE_MINUTES)
            return
        if latest_verdict == 'RECEDING':
            report.status = 'RECEDING'
            report.is_verified = True
            report.cleared_at = None
            report.is_hidden = False
            report.expires_at = now + timedelta(hours=RECEDING_TTL_HOURS)
            return
        if latest_verdict in ('CONFIRM_DANGER', 'WORSENED'):
            report.status = 'VERIFIED'
            report.is_verified = True
            report.cleared_at = None
            report.is_hidden = False
            report.expires_at = now + timedelta(hours=VERIFIED_TTL_HOURS)
            return

    # 2. Tính theo đa số phiếu cộng đồng (tránh 1 phiếu lẻ ghi đè hàng loạt phiếu xác nhận đang ngập)
    if false_count >= 3 and (false_count - danger_count >= 2) and not has_trusted_danger:
        report.status = 'REJECTED'
        report.is_verified = False
        report.is_hidden = True
    elif cleared_count >= 2 and cleared_count >= danger_count:
        report.status = 'CLEARED'
        report.cleared_at = now
        report.water_level_cm = 0
        report.is_hidden = False
        report.expires_at = now + timedelta(minutes=CLEARED_VISIBLE_MINUTES)
    elif (receding_count + cleared_count) >= max(1, danger_count) and (receding_count >= 1 or cleared_count == 1):
        # Chuyển sang Nước đang rút khi số phiếu báo rút/thông tương đương hoặc nhiều hơn phiếu báo ngập
        report.status = 'RECEDING'
        report.cleared_at = None
        report.is_hidden = False
        report.expires_at = now + timedelta(hours=RECEDING_TTL_HOURS)
    elif danger_count >= 2 or has_trusted_danger:
        report.is_verified = True
        report.status = 'VERIFIED'
        report.cleared_at = None
        report.is_hidden = False
        report.expires_at = now + timedelta(hours=VERIFIED_TTL_HOURS)
    else:
        report.status = 'PENDING'
        report.is_verified = False
        report.cleared_at = None
        report.is_hidden = False
        report.expires_at = now + timedelta(hours=PENDING_TTL_HOURS)


@api_view(['GET'])
@permission_classes([AllowAny])
def preview_road_segment(request):
    """
    Xem trước (Preview) đoạn đường sẽ được tô màu trên bản đồ chỉ từ:
    - Tên đường do người dân nhập (`road_query` / `address`), HOẶC
    - Tọa độ 1 điểm chạm / GPS (`lat`, `lng`).
    Trả về `road_geometry` (Polyline), `road_name`, `center_lat`, `center_lng`, `segment_length_m`.
    """
    from .pathfinding import extract_road_segment

    road_query = str(request.query_params.get('road_query') or request.query_params.get('address') or '').strip()
    raw_lat = request.query_params.get('lat')
    raw_lng = request.query_params.get('lng')

    lat, lng = None, None
    if raw_lat not in (None, '') and raw_lng not in (None, ''):
        try:
            lat = float(raw_lat)
            lng = float(raw_lng)
        except (TypeError, ValueError):
            lat, lng = None, None

    if not road_query and (lat is None or lng is None):
        return Response({'error': 'Vui lòng nhập tên đoạn đường hoặc cung cấp tọa độ GPS.'}, status=400)

    info = extract_road_segment(start_lat=lat, start_lng=lng, road_query=road_query)
    if not info.get('road_geometry'):
        return Response({'error': 'Không tìm thấy đoạn đường phù hợp. Hãy thử nhập rõ tên đường + quận/thành phố.'}, status=404)

    return Response(info)


@api_view(['GET'])
@permission_classes([AllowAny])
def field_report_list(request):
    """
    Danh sách báo cáo tình hình thực tế trên đường từ người dân.
    Tự động ẩn các điểm đã hết hạn (EXPIRED) hoặc bị Admin ẩn (is_hidden=True), trừ khi truyền include_hidden=true.
    """
    _auto_expire_stale_reports()

    include_hidden = request.query_params.get('include_hidden', '').lower() == 'true'
    queryset = CrowdReport.objects.prefetch_related('votes')

    if not include_hidden:
        queryset = queryset.filter(is_hidden=False).exclude(status__in=['REJECTED', 'EXPIRED'])

    status_filter = request.query_params.get('status')
    active_only = request.query_params.get('active_only', '').lower() == 'true'
    hazard = request.query_params.get('hazard_type')

    if status_filter:
        queryset = queryset.filter(status=status_filter.upper())
    elif active_only:
        queryset = queryset.filter(status__in=['PENDING', 'VERIFIED', 'RECEDING'], is_hidden=False)

    if hazard:
        queryset = queryset.filter(hazard_type=hazard.upper())

    try:
        limit = min(max(int(request.query_params.get('limit', 100)), 1), 500)
    except (TypeError, ValueError):
        limit = 100

    items = list(queryset[:limit])
    serializer = CrowdReportSerializer(items, many=True, context={'request': request})
    return Response({'count': len(items), 'results': serializer.data})


@api_view(['POST'])
@permission_classes([AllowAny])
def field_report_create(request):
    """
    Người dân gửi báo cáo hiện trường chỉ cần Tên đoạn đường hoặc 1 vị trí GPS (T2) +
    Tự động tô màu đoạn đường + Đính kèm ảnh hiện trường + Gộp thông minh dọc theo toàn bộ thân đường.
    """
    from datetime import timedelta
    from django.db import transaction
    from django.utils import timezone
    from .pathfinding import extract_road_segment, min_distance_to_road_segment

    _auto_expire_stale_reports()
    data = request.data

    address = str(data.get('address', '') or data.get('road_query', '') or '').strip()[:500]
    description = str(data.get('description', '') or '').strip()[:2000]

    raw_lat = data.get('location_lat')
    raw_lng = data.get('location_lng')
    lat, lng = None, None
    if raw_lat not in (None, '') and raw_lng not in (None, ''):
        try:
            lat = float(raw_lat)
            lng = float(raw_lng)
        except (TypeError, ValueError):
            lat, lng = None, None

    if lat is not None and lng is not None:
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return Response({'error': 'Tọa độ GPS nằm ngoài phạm vi hợp lệ.'}, status=400)

    if (lat is None or lng is None) and not address:
        return Response({'error': 'Vui lòng nhập tên đoạn đường hoặc bật định vị GPS.'}, status=400)

    raw_end_lat = data.get('end_lat')
    raw_end_lng = data.get('end_lng')
    end_lat, end_lng = None, None
    if raw_end_lat not in (None, '') and raw_end_lng not in (None, ''):
        try:
            end_lat = float(raw_end_lat)
            end_lng = float(raw_end_lng)
        except (TypeError, ValueError):
            end_lat, end_lng = None, None

    hazard_type = str(data.get('hazard_type', 'FLOOD')).upper()
    valid_hazards = dict(CrowdReport.HAZARD_CHOICES)
    if hazard_type not in valid_hazards:
        hazard_type = 'FLOOD'

    try:
        water_level_cm = max(0, min(500, int(data.get('water_level_cm', 0) or 0)))
    except (TypeError, ValueError):
        water_level_cm = 0

    # Trích xuất hình học đoạn đường thực tế (tự động từ tên đường hoặc 1 điểm GPS)
    segment_info = extract_road_segment(
        start_lat=lat,
        start_lng=lng,
        end_lat=end_lat,
        end_lng=end_lng,
        road_query=address if end_lat is None else None,
    )

    center_lat = segment_info.get('center_lat') or lat
    center_lng = segment_info.get('center_lng') or lng
    if center_lat is None or center_lng is None:
        return Response({'error': 'Không xác định được vị trí đoạn đường này. Hãy thử nhập rõ tên đường hơn.'}, status=400)

    lat = float(center_lat)
    lng = float(center_lng)

    if not address and segment_info.get('road_name'):
        address = segment_info['road_name'][:500]
    elif address and segment_info.get('road_name') and ',' not in address and len(segment_info['road_name']) > len(address):
        address = segment_info['road_name'][:500]

    image_file = request.FILES.get('image')

    user = request.user if request.user and request.user.is_authenticated else None
    reporter_name = (
        getattr(user, 'full_name', '') or str(data.get('reporter_name', '') or '').strip() or 'Người dân'
    )[:150]
    voter_role = _resolve_voter_role(user, data)
    voter_identifier = _build_voter_identifier(user, data, reporter_name, request=request)

    severity = _map_report_severity(hazard_type, water_level_cm)
    now = timezone.now()
    active_cutoff = now - timedelta(hours=MERGE_ACTIVE_HOURS)
    reopen_cutoff = now - timedelta(hours=REOPEN_CLEARED_HOURS)

    # Quét ứng viên trong bán kính mở rộng (~550m) để đo khoảng cách thực tới toàn bộ Polyline đoạn đường
    deg_pad = 0.005
    candidates = CrowdReport.objects.filter(
        status__in=['PENDING', 'VERIFIED', 'RECEDING', 'CLEARED', 'EXPIRED'],
        hazard_type=hazard_type,
        location_lat__gte=lat - deg_pad,
        location_lat__lte=lat + deg_pad,
        location_lng__gte=lng - deg_pad,
        location_lng__lte=lng + deg_pad,
    )

    nearby_report = None
    min_dist = 160.0
    sig_new = _extract_street_signature(address)

    for cand in candidates:
        if cand.status in ('PENDING', 'VERIFIED', 'RECEDING'):
            if cand.is_hidden:
                continue
            if cand.updated_at < active_cutoff and cand.wave_started_at < active_cutoff:
                continue
        elif cand.status in ('CLEARED', 'EXPIRED'):
            ref_time = cand.cleared_at or cand.updated_at
            if ref_time < reopen_cutoff:
                continue

        if not _are_addresses_compatible(address, cand.address):
            continue

        # Đo khoảng cách tới toàn bộ dọc đoạn đường (road_geometry) thay vì chỉ đo tới 1 đầu mút
        dist = min_distance_to_road_segment(
            lat=lat, lng=lng,
            road_geometry=cand.road_geometry,
            fallback_lat=cand.location_lat,
            fallback_lng=cand.location_lng,
        )

        # Nếu 2 người gõ trùng tên đường (ví dụ cùng gõ "Đường Hàm Nghi") trong phạm vi 350m -> gộp luôn!
        sig_cand = _extract_street_signature(cand.address)
        effective_threshold = 350.0 if (sig_new and sig_cand and (sig_new in sig_cand or sig_cand in sig_new)) else min_dist

        if dist <= effective_threshold:
            min_dist = dist
            nearby_report = cand

    with transaction.atomic():
        if nearby_report:
            nearby_report = CrowdReport.objects.select_for_update().get(pk=nearby_report.pk)
            reopened = False

            # Quy tắc 3: Nếu báo cáo cũ đã CLEARED hoặc EXPIRED mà người dân báo ngập trở lại -> Mở đợt sự cố mới!
            if nearby_report.status in ('CLEARED', 'EXPIRED'):
                reopened = True
                nearby_report.incident_wave += 1
                nearby_report.wave_started_at = now
                nearby_report.cleared_at = None
                nearby_report.is_hidden = False
                nearby_report.votes.filter(is_active_vote=True).update(is_active_vote=False)
                is_trusted = voter_role in ('RESCUER', 'ADMIN')
                nearby_report.status = 'VERIFIED' if is_trusted else 'PENDING'
                nearby_report.is_verified = is_trusted
                nearby_report.water_level_cm = water_level_cm
                nearby_report.severity = severity
                nearby_report.report_count = 1

            if address and not nearby_report.address:
                nearby_report.address = address
            if image_file:
                nearby_report.image = image_file
            if not nearby_report.road_geometry or (end_lat is not None and end_lng is not None):
                nearby_report.end_lat = segment_info['end_lat']
                nearby_report.end_lng = segment_info['end_lng']
                nearby_report.road_geometry = segment_info['road_geometry']
                nearby_report.segment_length_m = segment_info['segment_length_m']
            if description and description not in (nearby_report.description or ''):
                nearby_report.description = '\n'.join(
                    filter(None, [nearby_report.description, f"[Đợt #{nearby_report.incident_wave} - {reporter_name}]: {description}"])
                )[:2000]

            _record_vote_with_dedup(
                report=nearby_report,
                user=user,
                voter_identifier=voter_identifier,
                voter_name=reporter_name,
                voter_role=voter_role,
                verdict='CONFIRM_DANGER',
                note=description or (
                    f'Báo cáo ngập/sự cố trở lại (Mở đợt #{nearby_report.incident_wave}).'
                    if reopened else f'Báo cáo cùng đoạn đường (cách {round(min_dist)}m).'
                ),
                water_level_cm=water_level_cm if water_level_cm > 0 else None,
                image_file=image_file,
            )

            _recalculate_report_state(
                report=nearby_report,
                latest_verdict='CONFIRM_DANGER',
                latest_voter_role=voter_role,
                latest_water_level_cm=water_level_cm if water_level_cm > 0 else None,
            )
            nearby_report.save()

            result_data = CrowdReportSerializer(nearby_report, context={'request': request}).data
            result_data['corroborated'] = not reopened
            result_data['reopened'] = reopened
            result_data['distance_merged_m'] = round(min_dist)
            return Response(result_data, status=200)

        # Tạo điểm báo cáo hiện trường mới (gắn kèm hình học đoạn đường Polyline & thời hạn tự ẩn)
        is_trusted = voter_role in ('RESCUER', 'ADMIN')
        initial_ttl_hours = VERIFIED_TTL_HOURS if is_trusted else PENDING_TTL_HOURS
        new_report = CrowdReport.objects.create(
            reporter=user,
            reporter_name=reporter_name,
            hazard_type=hazard_type,
            water_level_cm=water_level_cm,
            severity=severity,
            location_lat=lat,
            location_lng=lng,
            end_lat=segment_info['end_lat'],
            end_lng=segment_info['end_lng'],
            road_geometry=segment_info['road_geometry'],
            segment_length_m=segment_info['segment_length_m'],
            address=address,
            description=description,
            image=image_file if image_file else None,
            status='VERIFIED' if is_trusted else 'PENDING',
            is_verified=is_trusted,
            is_hidden=False,
            expires_at=now + timedelta(hours=initial_ttl_hours),
            report_count=1,
            incident_wave=1,
            wave_started_at=now,
        )

        _record_vote_with_dedup(
            report=new_report,
            user=user,
            voter_identifier=voter_identifier,
            voter_name=reporter_name,
            voter_role=voter_role,
            verdict='CONFIRM_DANGER',
            note=description or 'Người đầu tiên gửi báo cáo tại đoạn đường này.',
            water_level_cm=water_level_cm if water_level_cm > 0 else None,
            image_file=image_file,
        )

        result_data = CrowdReportSerializer(new_report, context={'request': request}).data
        result_data['corroborated'] = False
        result_data['reopened'] = False
        return Response(result_data, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def field_report_detail(request, pk):
    """
    - GET: Chi tiết một điểm báo cáo hiện trường kèm toàn bộ danh sách người đã vote & ảnh.
    - PATCH / DELETE: Admin ẩn/hiện (`is_hidden`), gia hạn hoặc đóng nhanh đoạn đường nếu thấy không đúng hoặc đã hết sự cố.
    """
    from datetime import timedelta
    from django.shortcuts import get_object_or_404
    from django.utils import timezone

    report = get_object_or_404(CrowdReport.objects.prefetch_related('votes'), pk=pk)

    if request.method == 'GET':
        return Response(CrowdReportSerializer(report, context={'request': request}).data)

    if request.method == 'DELETE':
        report.is_hidden = True
        report.status = 'REJECTED'
        report.save(update_fields=['is_hidden', 'status', 'updated_at'])
        return Response({'message': 'Đã ẩn đoạn đường khỏi bản đồ.', 'id': str(report.id), 'is_hidden': True})

    # PATCH: Cập nhật trạng thái ẩn/hiện hoặc đổi status từ Admin
    data = request.data
    now = timezone.now()
    if 'is_hidden' in data:
        report.is_hidden = bool(data.get('is_hidden'))
        if not report.is_hidden and report.status in ('EXPIRED', 'REJECTED'):
            report.status = 'VERIFIED' if report.is_verified else 'PENDING'
            report.expires_at = now + timedelta(hours=VERIFIED_TTL_HOURS)

    if 'status' in data and data['status'] in dict(CrowdReport.STATUS_CHOICES):
        report.status = data['status']
        if report.status == 'CLEARED':
            report.cleared_at = now
            report.water_level_cm = 0
            report.expires_at = now + timedelta(minutes=CLEARED_VISIBLE_MINUTES)
        elif report.status in ('REJECTED', 'EXPIRED'):
            report.is_hidden = True

    if 'extend_hours' in data:
        try:
            ext_h = max(1, min(48, int(data.get('extend_hours'))))
            report.expires_at = now + timedelta(hours=ext_h)
            report.is_hidden = False
        except (TypeError, ValueError):
            pass

    report.save()
    return Response(CrowdReportSerializer(report, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def field_report_vote(request, pk):
    """
    Người dân / Đội cứu hộ / Admin gửi Vote xác nhận tình hình thực tế + kèm ghi chú + kèm ảnh hiện trường.
    Hỗ trợ thêm lệnh Admin: 'HIDE' (Ẩn ngay đoạn đường) và 'UNHIDE' (Hiện lại đoạn đường).
    """
    from datetime import timedelta
    from django.db import transaction
    from django.shortcuts import get_object_or_404
    from django.utils import timezone

    raw_verdict = str(request.data.get('verdict', '') or '').upper()
    if raw_verdict == 'RESCUED':
        return Response({
            'error': 'Trạng thái "Đã được cứu" chỉ áp dụng cho tín hiệu cầu cứu SOS cá nhân, không dùng để đóng báo cáo ngập/chướng ngại vật trên đường (Quy tắc 4).'
        }, status=400)

    # Quyền Admin / Cứu hộ ẩn hoặc hiện lại đoạn đường ngay lập tức
    if raw_verdict in ('HIDE', 'UNHIDE'):
        with transaction.atomic():
            report = get_object_or_404(CrowdReport.objects.select_for_update(), pk=pk)
            now = timezone.now()
            if raw_verdict == 'HIDE':
                report.is_hidden = True
                if request.data.get('mark_rejected'):
                    report.status = 'REJECTED'
            else:
                report.is_hidden = False
                if report.status in ('EXPIRED', 'REJECTED'):
                    report.status = 'VERIFIED' if report.is_verified else 'PENDING'
                report.expires_at = now + timedelta(hours=VERIFIED_TTL_HOURS)
            report.save()
        return Response(CrowdReportSerializer(report, context={'request': request}).data, status=200)

    VERDICT_ALIAS = {
        'TRUE': 'CONFIRM_DANGER',
        'CONFIRM_DANGER': 'CONFIRM_DANGER',
        'STILL_DANGER': 'WORSENED',
        'WORSENED': 'WORSENED',
        'RECEDING': 'RECEDING',
        'WATER_RECEDING': 'RECEDING',
        'CLEARED': 'CLEARED',
        'ROAD_CLEARED': 'CLEARED',
        'FALSE': 'FALSE_REPORT',
        'FALSE_REPORT': 'FALSE_REPORT',
    }

    verdict = VERDICT_ALIAS.get(raw_verdict)
    if not verdict:
        return Response({'error': 'Lựa chọn xác nhận không hợp lệ.'}, status=400)

    note = str(request.data.get('note', '') or '').strip()[:1000]
    raw_wl = request.data.get('water_level_cm')
    water_level_cm = None
    if raw_wl is not None and raw_wl != '':
        try:
            water_level_cm = max(0, min(500, int(raw_wl)))
        except (TypeError, ValueError):
            water_level_cm = None

    image_file = request.FILES.get('image')

    user = request.user if request.user and request.user.is_authenticated else None
    voter_name = (
        getattr(user, 'full_name', '') or str(request.data.get('voter_name', '') or '').strip() or 'Người dân địa phương'
    )[:150]
    voter_role = _resolve_voter_role(user, request.data)
    voter_identifier = _build_voter_identifier(user, request.data, voter_name, request=request)

    with transaction.atomic():
        report = get_object_or_404(CrowdReport.objects.select_for_update(), pk=pk)
        reopened = False

        # Quy tắc 3: Luồng ngập trở lại — nếu điểm báo đã CLEARED hoặc EXPIRED mà có người báo CONFIRM_DANGER / WORSENED
        if report.status in ('CLEARED', 'EXPIRED') and verdict in ('CONFIRM_DANGER', 'WORSENED'):
            reopened = True
            report.incident_wave += 1
            report.wave_started_at = timezone.now()
            report.cleared_at = None
            report.is_hidden = False
            report.votes.filter(is_active_vote=True).update(is_active_vote=False)
            is_trusted = voter_role in ('RESCUER', 'ADMIN')
            report.status = 'VERIFIED' if is_trusted else 'PENDING'
            report.is_verified = is_trusted
            report.report_count = 1
            if water_level_cm is not None:
                report.water_level_cm = water_level_cm
                report.severity = _map_report_severity(report.hazard_type, report.water_level_cm)

        if image_file and not report.image:
            report.image = image_file

        # Quy tắc 1: Chống vote trùng (vô hiệu hóa phiếu cũ của cùng tài khoản, lưu phiếu mới vào lịch sử)
        vote_obj = _record_vote_with_dedup(
            report=report,
            user=user,
            voter_identifier=voter_identifier,
            voter_name=voter_name,
            voter_role=voter_role,
            verdict=verdict,
            note=note,
            water_level_cm=water_level_cm,
            image_file=image_file,
        )

        # Tính toán lại trạng thái báo cáo theo Quy tắc 1, 2, 3, 4 và gia hạn expires_at
        _recalculate_report_state(
            report=report,
            latest_verdict=verdict,
            latest_voter_role=voter_role,
            latest_water_level_cm=water_level_cm,
        )
        report.save()

    data = CrowdReportSerializer(report, context={'request': request}).data
    data['latest_vote'] = CrowdReportVoteSerializer(vote_obj, context={'request': request}).data
    data['reopened'] = reopened
    return Response(data, status=201)


@api_view(['GET'])
@permission_classes([AllowAny])
def safety_check(request):
    """
    Thẻ trạng thái GPS thông minh bán kính 1km trên Trang chủ Người dân (S2 + Quy tắc 6).
    GET /api/rescue_operations/safety-check/?lat=...&lng=...
    Quy tắc 6: Không có báo cáo thì ghi "Chưa ghi nhận nguy hiểm" (NO_DATA), không khẳng định "An toàn".
    """
    from .pathfinding import haversine_distance, min_distance_to_road_segment

    _auto_expire_stale_reports()

    try:
        lat = float(request.query_params.get('lat'))
        lng = float(request.query_params.get('lng'))
    except (TypeError, ValueError):
        return Response({'error': 'Thiếu tọa độ lat/lng hợp lệ.'}, status=400)

    deg_pad = 0.012  # ~1.3km bounding box
    nearby_hazards = []

    # 1. Quét các Zone đang ACTIVE / STABILIZING trong 1km
    active_zones = Zone.objects.filter(
        status__in=['ACTIVE', 'STABILIZING'],
        location_lat__gte=lat - deg_pad,
        location_lat__lte=lat + deg_pad,
        location_lng__gte=lng - deg_pad,
        location_lng__lte=lng + deg_pad,
    )
    for z in active_zones:
        dist = haversine_distance(lat, lng, float(z.location_lat), float(z.location_lng))
        if dist <= 1000:
            nearby_hazards.append({
                'type': 'ZONE',
                'id': str(z.id),
                'title': z.name,
                'status': z.status,
                'severity': z.severity,
                'distance_m': round(dist),
                'water_level_cm': None,
                'is_verified': True,
            })

    # 2. Quét các Báo cáo hiện trường (CrowdReport) đang mở và chưa bị ẩn trong 1km
    active_reports = CrowdReport.objects.filter(
        status__in=['PENDING', 'VERIFIED', 'RECEDING'],
        is_hidden=False,
        location_lat__gte=lat - deg_pad,
        location_lat__lte=lat + deg_pad,
        location_lng__gte=lng - deg_pad,
        location_lng__lte=lng + deg_pad,
    )
    for r in active_reports:
        dist = min_distance_to_road_segment(
            lat=lat, lng=lng,
            road_geometry=r.road_geometry,
            fallback_lat=r.location_lat,
            fallback_lng=r.location_lng,
        )
        if dist <= 1000:
            label = r.get_hazard_type_display()
            if r.status == 'RECEDING':
                label = f"{label} (Nước đang rút)"
            elif r.water_level_cm > 0:
                label = f"{label} ({r.water_level_cm}cm)"
            nearby_hazards.append({
                'type': 'FIELD_REPORT',
                'id': str(r.id),
                'title': label,
                'status': r.status,
                'severity': r.severity,
                'distance_m': round(dist),
                'water_level_cm': r.water_level_cm,
                'is_verified': r.is_verified,
                'report_count': r.report_count,
            })

    nearby_hazards.sort(key=lambda x: x['distance_m'])

    # Quy tắc 6: Không có báo cáo thì ghi "Chưa ghi nhận nguy hiểm", KHÔNG khẳng định "An toàn"
    if not nearby_hazards:
        return Response({
            'level': 'NO_DATA',
            'headline': 'Chưa ghi nhận nguy hiểm (Bán kính 1km)',
            'subtitle': 'Chưa có báo cáo sự cố trong bán kính 1km quanh bạn. Dữ liệu cộng đồng chưa đủ để khẳng định an toàn tuyệt đối — hãy luôn quan sát thực tế.',
            'nearby_count': 0,
            'closest_hazard': None,
            'hazards': [],
        })

    closest = nearby_hazards[0]
    dist_m = closest['distance_m']
    is_severe = any(
        h['severity'] in ('CRITICAL', 'HIGH') and h.get('status') != 'RECEDING' and h['distance_m'] <= 400
        for h in nearby_hazards
    )

    if dist_m <= 300 and closest.get('status') != 'RECEDING' or is_severe:
        level = 'DANGER'
        headline = f"CẢNH BÁO NGUY HIỂM (Cách {dist_m}m)"
        subtitle = f"Phát hiện {closest['title']} cách bạn {dist_m}m ({len(nearby_hazards)} điểm quanh 1km). Hạn chế di chuyển vào hướng này!"
    else:
        level = 'WARNING'
        headline = f"CẢNH GIÁC: Có sự cố cách {dist_m}m"
        subtitle = f"Ghi nhận {closest['title']} cách bạn {dist_m}m. Hãy bấm xem Bản đồ trước khi di chuyển."

    return Response({
        'level': level,
        'headline': headline,
        'subtitle': subtitle,
        'nearby_count': len(nearby_hazards),
        'closest_hazard': closest,
        'hazards': nearby_hazards[:10],
    })
