"""One recipient policy shared by feeds, details, read receipts and push delivery."""
import math
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from rescue_operations.flow import admin
from .models import Alert, PushDevice


def coordinates(params):
    lat, lng = params.get('lat'), params.get('lng')
    if lat is None and lng is None:
        return None
    try:
        lat, lng = float(lat), float(lng)
        if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError({'location': 'Tọa độ không hợp lệ.'})
    return lat, lng


def nearby_zone_ids(location):
    from rescue_operations.models import Zone
    lat, lng = map(math.radians, location)
    result = []
    for pk, zone_lat, zone_lng in Zone.objects.values_list('pk', 'location_lat', 'location_lng'):
        if zone_lat is None or zone_lng is None:
            continue
        zlat, zlng = math.radians(float(zone_lat)), math.radians(float(zone_lng))
        hav = math.sin((zlat - lat) / 2) ** 2 + math.cos(lat) * math.cos(zlat) * math.sin((zlng - lng) / 2) ** 2
        distance = 6371 * 2 * math.asin(math.sqrt(max(0, min(1, hav))))
        if distance <= 20:
            result.append(pk)
    return result


def recipient_zone_ids(user, location=None):
    from reporting.models import Mission
    from rescue_operations.models import Zone
    authenticated = bool(user and user.is_authenticated and user.is_active)
    if authenticated and user.role == 'RESCUER':
        zones = list(Mission.objects.filter(rescuer=user, status__in=[
            'PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP',
        ], zone__isnull=False).values_list('zone_id', flat=True))
        if zones:
            return zones
    if location is None and authenticated:
        device = PushDevice.objects.filter(user=user, is_active=True, latitude__isnull=False,
            longitude__isnull=False, location_updated_at__gte=timezone.now() - timedelta(hours=24)).order_by('-location_updated_at').first()
        if device:
            location = (device.latitude, device.longitude)
    if location:
        return nearby_zone_ids(location)
    if authenticated:
        address = (user.address or '').strip().casefold()
        if address:
            return [pk for pk, name in Zone.objects.values_list('pk', 'name')
                    if name and (name.strip().casefold() in address or address in name.strip().casefold())]
    return []


def visible_alerts(user, location=None, *, management=False):
    queryset = Alert.objects.select_related('zone')
    if management and admin(user):
        return queryset
    queryset = queryset.filter(is_active=True).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))
    roles = ['ALL']
    if user and user.is_authenticated and user.is_active and user.role in ('CITIZEN', 'RESCUER'):
        roles.append(user.role)
    return queryset.filter(audience__in=roles).filter(Q(zone__isnull=True) | Q(zone_id__in=recipient_zone_ids(user, location)))
