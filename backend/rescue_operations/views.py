import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Count
from django.db.models import Q
from .models import Zone, SOSSignal, SOSImage
from .serializers import (
    ZoneSerializer, ZoneListSerializer,
    SOSSignalSerializer, SOSSignalListSerializer,
    SOSImageSerializer,
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
