import logging
from .pathfinding import get_rescue_route
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Count
from django.db.models import Q
from .models import Zone, SOSSignal, SOSImage
from .serializers import (
    ZoneSerializer, ZoneListSerializer,
    SOSSignalSerializer, SOSSignalListSerializer,
    SOSImageSerializer,
)


# ─── ZONE ────────────────────────────────────────────────────

@api_view(['GET'])
def zone_list(request):
    """Danh sách vùng sự cố, có thể lọc theo status và severity."""
    queryset = Zone.objects.all().order_by('-updated_at')
    s = request.query_params.get('status')
    sev = request.query_params.get('severity')
    if s:
        queryset = queryset.filter(status=s.upper())
    if sev:
        queryset = queryset.filter(severity=sev.upper())
    serializer = ZoneListSerializer(queryset, many=True)
    return Response({'count': queryset.count(), 'results': serializer.data})


@api_view(['POST'])
def zone_create(request):
    """Tạo vùng sự cố mới."""
    serializer = ZoneSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
def zone_detail(request, pk):
    """Chi tiết / Cập nhật / Xóa một Zone."""
    try:
        zone = Zone.objects.get(pk=pk)
    except Zone.DoesNotExist:
        return Response({'error': 'Không tìm thấy vùng sự cố.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ZoneSerializer(zone).data)

    if request.method == 'PUT':
        serializer = ZoneSerializer(zone, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        zone.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── DASHBOARD STATS ─────────────────────────────────────────

@api_view(['GET'])
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
def sos_list(request):
    """Danh sách tín hiệu SOS, có thể lọc theo status và signal_type."""
    queryset = SOSSignal.objects.all().order_by('-sent_at')
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
    serializer = SOSSignalListSerializer(queryset, many=True)
    return Response({'count': queryset.count(), 'results': serializer.data})


@api_view(['POST'])
def sos_create(request):
    """Gửi tín hiệu SOS/PING mới."""
    serializer = SOSSignalSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH'])
def sos_detail(request, pk):
    """Chi tiết / Cập nhật trạng thái một SOS."""
    try:
        sos = SOSSignal.objects.get(pk=pk)
    except SOSSignal.DoesNotExist:
        return Response({'error': 'Không tìm thấy tín hiệu SOS.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(SOSSignalSerializer(sos).data)

    serializer = SOSSignalSerializer(sos, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
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
def get_rescue_route_api(request):

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
        # SUCCESS RESPONSE
        # =================================================

        return Response({

            'status': 'success',

            'path': result['path'],

            'distance_meters': result[
                'distance_meters'
            ],

            'eta_seconds': result[
                'eta_seconds'
            ],

            'hazards_detected': len(
                hazards_list
            )
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