from django.db import IntegrityError, transaction
from django.db.models import Case, When, Value, IntegerField, Exists, OuterRef
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rescue_operations.flow import admin
from .access import coordinates, visible_alerts
from .models import Alert, AlertVote, AlertRead, PushDevice
from .serializers import AlertSerializer, AlertListSerializer, AlertVoteSerializer


def feed(request, management=False):
    queryset = visible_alerts(request.user, coordinates(request.query_params), management=management)
    if request.user.is_authenticated:
        queryset = queryset.annotate(is_read=Exists(AlertRead.objects.filter(
            alert_id=OuterRef('pk'), user=request.user, publication=OuterRef('publication'))))
    queryset = queryset.prefetch_related('votes__user')
    if admin(request.user):
        queryset = queryset.prefetch_related('reads', 'deliveries')
    return queryset


@api_view(['GET'])
@permission_classes([AllowAny])
def alert_list(request):
    queryset = feed(request, management=True)
    source = request.query_params.get('source')
    if source:
        queryset = queryset.filter(source=source.upper())
    active = request.query_params.get('is_active')
    if active is not None:
        if active.lower() not in ('true', 'false'):
            raise ValidationError({'is_active': 'Chỉ nhận true hoặc false.'})
        queryset = queryset.filter(is_active=active.lower() == 'true')
    if request.query_params.get('tab') == 'national':
        queryset = queryset.filter(zone__isnull=True)
    # tab=all never bypasses recipient access for an ordinary user.
    queryset = queryset.annotate(priority=Case(
        When(message_type='EMERGENCY', then=Value(1)),
        default=Value(2), output_field=IntegerField(),
    )).order_by('priority', '-published_at')
    data = AlertListSerializer(queryset, many=True, context={'request': request}).data
    return Response({'count': len(data), 'results': data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def alert_create(request):
    if not admin(request.user):
        return Response({'error': 'Chỉ quản trị viên được phát tin.'}, status=403)
    serializer = AlertSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def alert_detail(request, pk):
    if request.method == 'GET':
        alert = get_object_or_404(feed(request, management=True), pk=pk)
        return Response(AlertSerializer(alert, context={'request': request}).data)
    if not admin(request.user):
        return Response({'error': 'Chỉ quản trị viên được sửa cảnh báo.'}, status=403)
    with transaction.atomic():
        alert = get_object_or_404(Alert.objects.select_for_update(), pk=pk)
        if request.method == 'DELETE':
            alert.delete()
            return Response(status=204)
        serializer = AlertSerializer(alert, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def alert_read(request, pk):
    alert = get_object_or_404(feed(request), pk=pk)
    if request.data.get('publication') != alert.publication:
        return Response({'error': 'Bản tin đã thay đổi. Vui lòng tải lại.'}, status=409)
    AlertRead.objects.get_or_create(alert=alert, user=request.user, publication=alert.publication)
    return Response({'is_read': True, 'publication': alert.publication})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def alert_vote(request, alert_id):
    alert = get_object_or_404(feed(request), pk=alert_id)
    data = {'alert': alert.pk, 'user': request.user.pk, 'verdict': request.data.get('verdict')}
    if AlertVote.objects.filter(alert=alert, user=request.user).exists():
        return Response({'error': 'Bạn đã phản hồi cảnh báo này rồi.'}, status=400)
    serializer = AlertVoteSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            serializer.save()
    except IntegrityError:
        return Response({'error': 'Bạn đã phản hồi cảnh báo này rồi.'}, status=400)
    return Response(serializer.data, status=201)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def push_device(request):
    import re
    token = request.data.get('token', '')
    if not isinstance(token, str) or not re.fullmatch(r'(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]', token) or len(token) > 255:
        raise ValidationError({'token': 'Expo push token không hợp lệ.'})
    if request.method == 'DELETE':
        PushDevice.objects.filter(user=request.user, token=token).update(is_active=False)
        return Response(status=204)
    location = coordinates(request.data)
    with transaction.atomic():
        device, created = PushDevice.objects.select_for_update().get_or_create(token=token, defaults={'user': request.user})
        if device.user_id != request.user.pk or not device.is_active:
            device.registered_at = timezone.now()
            device.latitude = device.longitude = None
            device.location_updated_at = None
        device.user = request.user
        device.is_active = True
        device.last_seen = timezone.now()
        if location:
            device.latitude, device.longitude = location
            device.location_updated_at = timezone.now()
        device.save()
    return Response({'registered': True}, status=201 if created else 200)
