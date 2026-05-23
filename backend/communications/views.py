from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Alert, AlertVote
from .serializers import AlertSerializer, AlertListSerializer, AlertVoteSerializer

# ─── ALERT ───────────────────────────────────────────────────

from django.db.models import (
    Case, When, Value, IntegerField, Q,
    FloatField, ExpressionWrapper, F,
)
from django.db.models.functions import ACos, Cos, Radians, Sin
import math


def _get_nearby_zone_ids(user_lat: float, user_lng: float, radius_km: float = 20.0):
    """
    Trả về danh sách Zone ID nằm trong bán kính `radius_km` km
    tính từ tọa độ (user_lat, user_lng) dùng công thức Haversine.

    Zone.location_lat / location_lng là toạ độ tâm của từng zone.
    Nếu khoảng cách từ user đến tâm zone <= radius_km → user "trong" zone đó.
    """
    from rescue_operations.models import Zone

    EARTH_RADIUS_KM = 6371.0

    nearby = Zone.objects.annotate(
        distance=ExpressionWrapper(
            EARTH_RADIUS_KM * ACos(
                Cos(Radians(Value(user_lat, output_field=FloatField()))) *
                Cos(Radians(F('location_lat'))) *
                Cos(Radians(F('location_lng')) - Radians(Value(user_lng, output_field=FloatField()))) +
                Sin(Radians(Value(user_lat, output_field=FloatField()))) *
                Sin(Radians(F('location_lat')))
            ),
            output_field=FloatField()
        )
    ).filter(distance__lte=radius_km)

    return list(nearby.values_list('id', flat=True))


@api_view(['GET'])
def alert_list(request):
    """
    Danh sách cảnh báo.

    - Tab 'nearby' (mặc định):
        • Ưu tiên 1: Nếu FE gửi ?lat=&lng= → dùng GPS radius (20km) khớp zone.location_lat/lng
        • Ưu tiên 2: Nếu user đăng nhập (JWT) và không có GPS → dùng user.address khớp zone.name
        • Luôn kèm alerts toàn quốc (zone=null)
    - Tab 'national': chỉ alerts không gắn zone
    """
    queryset = Alert.objects.all()

    # 1. Lọc theo source & is_active
    source    = request.query_params.get('source')
    is_active = request.query_params.get('is_active')
    if source:
        queryset = queryset.filter(source=source.upper())
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active.lower() == 'true')

    tab = request.query_params.get('tab', 'nearby')

    # 2. Lấy tọa độ GPS từ query params (AlertsScreen gửi ?lat=&lng=)
    try:
        user_lat = float(request.query_params.get('lat', ''))
        user_lng = float(request.query_params.get('lng', ''))
        has_gps = True
    except (ValueError, TypeError):
        has_gps = False

    # 3. Lấy địa chỉ từ JWT token (fallback khi không có GPS)
    user_address = None
    if request.user and request.user.is_authenticated:
        user_address = (getattr(request.user, 'address', None) or '').strip()

    # 4. Lọc theo tab
    if tab == 'national':
        # Toàn quốc: chỉ alert không gắn zone
        queryset = queryset.filter(zone__isnull=True)
    elif tab == 'all':
        # Trả về tất cả, không lọc theo vị trí
        pass
    else:
        # Lân cận (nearby): luôn kèm alert toàn quốc (zone=null)
        q_filter = Q(zone__isnull=True)

        if has_gps:
            # Ưu tiên 1: GPS — tính khoảng cách Haversine đến tâm zone, bán kính 20km
            nearby_zone_ids = _get_nearby_zone_ids(user_lat, user_lng, radius_km=20.0)
            if nearby_zone_ids:
                q_filter |= Q(zone__in=nearby_zone_ids)
        elif user_address:
            # Ưu tiên 2: text matching địa chỉ
            q_filter |= Q(zone__name__icontains=user_address)

        queryset = queryset.filter(q_filter)

    # 5. Sắp xếp: Critical → Warning → Rescue → Info → mới nhất
    queryset = queryset.annotate(
        priority=Case(
            When(severity__iexact='critical', then=Value(1)),
            When(severity__iexact='warning',  then=Value(2)),
            When(severity__iexact='rescue',   then=Value(3)),
            When(severity__iexact='info',     then=Value(4)),
            default=Value(99),
            output_field=IntegerField(),
        )
    ).order_by('priority', '-created_at')

    serializer = AlertListSerializer(queryset, many=True)
    return Response({'count': queryset.count(), 'results': serializer.data})


@api_view(['POST'])
def alert_create(request):
    """Tạo cảnh báo mới."""
    serializer = AlertSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
def alert_detail(request, pk):
    """Chi tiết / Cập nhật / Xóa một Alert."""
    try:
        alert = Alert.objects.get(pk=pk)
    except Alert.DoesNotExist:
        return Response({'error': 'Không tìm thấy cảnh báo.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(AlertSerializer(alert).data)

    if request.method == 'PUT':
        serializer = AlertSerializer(alert, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        alert.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── ALERT VOTE ──────────────────────────────────────────────

@api_view(['POST'])
def alert_vote(request, alert_id):
    """
    Xác nhận cộng đồng cho một cảnh báo.
    Mỗi người chỉ vote được 1 lần.
    """
    try:
        Alert.objects.get(pk=alert_id)
    except Alert.DoesNotExist:
        return Response({'error': 'Không tìm thấy cảnh báo.'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data.copy()
    data['alert'] = alert_id

    # Kiểm tra đã vote chưa
    user_id = data.get('user')
    if AlertVote.objects.filter(alert_id=alert_id, user_id=user_id).exists():
        return Response({'error': 'Bạn đã vote cho cảnh báo này rồi.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = AlertVoteSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)