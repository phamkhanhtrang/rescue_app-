"""Durable Expo outbox. Run with `manage.py process_alert_push --watch`."""
import json
from datetime import timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from django.conf import settings
from django.db.models import F
from django.utils import timezone
from .access import visible_alerts
from .models import PushDevice, PushDelivery


def expo_request(endpoint, payload):
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    access_token = getattr(settings, 'EXPO_ACCESS_TOKEN', '')
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    request = Request(f'https://exp.host/--/api/v2/push/{endpoint}',
                      data=json.dumps(payload).encode(), headers=headers, method='POST')
    with urlopen(request, timeout=15) as response:
        return json.load(response)


def enqueue():
    now = timezone.now()
    for device in PushDevice.objects.filter(is_active=True, user__is_active=True,
            last_seen__gte=now - timedelta(days=30)).select_related('user').iterator():
        location = device_location(device)
        # New devices don't receive the backlog. Feed remains available independently.
        for alert in visible_alerts(device.user, location).filter(published_at__gte=max(device.registered_at, now - timedelta(days=1))):
            PushDelivery.objects.get_or_create(alert=alert, device=device, publication=alert.publication,
                                              defaults={'recipient': device.user})


def eligible(delivery):
    device = delivery.device
    return (device.is_active and device.user.is_active and device.user_id == delivery.recipient_id
            and device.last_seen >= timezone.now() - timedelta(days=30)
            and visible_alerts(device.user, device_location(device)).filter(pk=delivery.alert_id, publication=delivery.publication).exists())


def device_location(device):
    if device.latitude is not None and device.longitude is not None and device.location_updated_at and device.location_updated_at >= timezone.now() - timedelta(hours=24):
        return device.latitude, device.longitude
    return None


def fail_or_retry(delivery, code, retry=False):
    delivery.error = code[:255]
    delivery.status = 'PENDING' if retry and delivery.attempts < 5 else 'FAILED'
    delivery.next_attempt_at = timezone.now() + timedelta(seconds=min(3600, 30 * 2 ** delivery.attempts))
    if code == 'DeviceNotRegistered':
        PushDevice.objects.filter(pk=delivery.device_id).update(is_active=False)


def send_pending():
    now = timezone.now()
    # Crash after handoff is ambiguous: do not blindly resend and duplicate a warning.
    PushDelivery.objects.filter(status='SENDING', updated_at__lt=now - timedelta(minutes=5)).update(
        status='UNKNOWN', error='Worker stopped before recording the Expo response')
    ids = list(PushDelivery.objects.filter(status='PENDING', next_attempt_at__lte=now).values_list('pk', flat=True)[:100])
    for pk in ids:
        claimed = PushDelivery.objects.filter(pk=pk, status='PENDING').update(status='SENDING', attempts=F('attempts') + 1, updated_at=timezone.now())
        if not claimed:
            continue
        delivery = PushDelivery.objects.select_related('alert', 'device__user').filter(pk=pk).first()
        if not delivery:
            continue
        if not eligible(delivery):
            delivery.status = 'CANCELLED'
        else:
            try:
                # Content is fetched with current authentication on tap, including after logout/revocation.
                expiry = delivery.alert.expires_at
                ttl = max(0, min(3600, int((expiry - timezone.now()).total_seconds()))) if expiry else 3600
                result = expo_request('send', {
                    'to': delivery.device.token, 'title': 'Guardian Pulse',
                    'body': 'Có bản tin cứu hộ mới. Mở ứng dụng để xem nội dung còn hiệu lực.',
                    'sound': 'default', 'channelId': 'alerts', 'ttl': ttl,
                    'priority': 'high' if delivery.alert.message_type == 'EMERGENCY' else 'normal',
                    'data': {'alertId': str(delivery.alert_id), 'userId': str(delivery.recipient_id)},
                })
                ticket = result.get('data', {})
                if ticket.get('status') == 'ok' and ticket.get('id'):
                    delivery.ticket_id = ticket['id']
                    delivery.status = 'ACCEPTED'
                    delivery.next_attempt_at = timezone.now() + timedelta(minutes=15)
                else:
                    code = ticket.get('details', {}).get('error', 'ExpoRejected')
                    fail_or_retry(delivery, code, code == 'MessageRateExceeded')
            except HTTPError as error:
                fail_or_retry(delivery, f'HTTP {error.code}', error.code == 429 or error.code >= 500)
            except Exception:
                delivery.status = 'UNKNOWN'
                delivery.error = 'Không xác định được Expo đã nhận hay chưa; không tự gửi trùng.'
        # A concurrent deletion must never recreate the delivery row.
        PushDelivery.objects.filter(pk=pk).update(status=delivery.status, error=delivery.error,
            ticket_id=delivery.ticket_id, next_attempt_at=delivery.next_attempt_at, updated_at=timezone.now())


def check_receipts():
    deliveries = list(PushDelivery.objects.filter(status='ACCEPTED', next_attempt_at__lte=timezone.now())[:100])
    if not deliveries:
        return
    try:
        receipts = expo_request('getReceipts', {'ids': [d.ticket_id for d in deliveries]}).get('data', {})
    except Exception:
        receipts = {}
    now = timezone.now()
    for delivery in deliveries:
        receipt = receipts.get(delivery.ticket_id)
        if receipt:
            if receipt.get('status') == 'ok':
                delivery.status = 'RECEIPT_OK'
            else:
                fail_or_retry(delivery, receipt.get('details', {}).get('error', 'ReceiptError'))
        elif now - delivery.updated_at > timedelta(hours=24):
            delivery.status = 'UNKNOWN'
            delivery.error = 'Expo chưa trả kết quả sau 24 giờ.'
        PushDelivery.objects.filter(pk=delivery.pk).update(status=delivery.status, error=delivery.error,
            next_attempt_at=now + timedelta(minutes=15))


def process_push():
    if not getattr(settings, 'EXPO_PUSH_ENABLED', False):
        return False
    enqueue()
    send_pending()
    check_receipts()
    return True
