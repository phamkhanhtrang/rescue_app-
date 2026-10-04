"""SOS intake and tracking. A signed, unlisted capability protects guest requests."""
import uuid
from django.core import signing
from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from .models import SOSSignal, SOSEvent, Zone, SOSImage
from .serializers import SOSSignalSerializer, SOSImageSerializer

OPEN = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS']
SALT = 'guardian.sos.guest.v1'


def operator(user):
    return user.is_authenticated and user.is_active and user.role in ['ADMIN', 'RESCUER']


def admin(user):
    return (
        user.is_authenticated
        and user.is_active
        and (
            getattr(user, 'role', None) in ['ADMIN', 'OPERATOR']
            or getattr(user, 'is_staff', False)
            or getattr(user, 'is_superuser', False)
        )
    )


def ticket_key(token):
    if not isinstance(token, str) or not token or len(token) > 500:
        raise PermissionDenied('Mã theo dõi không hợp lệ.')
    try:
        return uuid.UUID(signing.loads(token, salt=SALT))
    except (signing.BadSignature, ValueError, TypeError):
        raise PermissionDenied('Mã theo dõi không hợp lệ.')


def owns(request, sos):
    if request.user.is_authenticated and str(sos.citizen_id) == str(request.user.pk):
        return True
    token = request.headers.get('X-SOS-Key')
    return bool(token and sos.citizen_id is None and sos.request_key == ticket_key(token))


def can_read(request, sos):
    if not (owns(request, sos) or operator(request.user)):
        raise PermissionDenied('Bạn không có quyền xem yêu cầu này.')


def event(sos, kind, message, user=None):
    SOSEvent.objects.create(sos=sos, kind=kind, message=message,
        actor=user if user and user.is_authenticated else None)


def recount(zone_id):
    if not zone_id:
        return
    qs = SOSSignal.objects.filter(zone_id=zone_id, status__in=OPEN).exclude(verification_status='INCORRECT')
    total_people = qs.aggregate(n=Sum('people_count'))['n'] or 0
    updates = {
        'people_affected': total_people,
        'rescuers_needed': max(1, (total_people + 4) // 5) if total_people else 0,
    }
    active_sos = list(qs)
    if active_sos:
        from ai.clustering import map_severity
        updates['severity'] = map_severity(active_sos)
    Zone.objects.filter(pk=zone_id).update(**updates)
    # Completing a request is not sufficient to close its zone.


@api_view(['POST'])
@permission_classes([AllowAny])
def manage_zone(request):
    """Admin moves SOS between zones, detaches them, or merges zones."""
    if not admin(request.user):
        raise PermissionDenied('Chỉ admin được điều chỉnh vùng cứu hộ.')
    action = request.data.get('action')
    sos_ids = [str(value) for value in (request.data.get('sos_ids') or [])]
    target_zone_id = request.data.get('target_zone')
    source_zone_ids = [str(value) for value in (request.data.get('source_zone_ids') or [])]
    if action not in ['move_sos', 'detach_sos', 'merge_zones']:
        raise ValidationError('Thao tác vùng không hợp lệ.')

    with transaction.atomic():
        if action == 'merge_zones':
            if not target_zone_id or not source_zone_ids:
                raise ValidationError('Cần vùng đích và ít nhất một vùng nguồn.')
            if str(target_zone_id) in source_zone_ids:
                raise ValidationError('Vùng đích không thể đồng thời là vùng nguồn.')
            locked = {str(z.pk): z for z in Zone.objects.select_for_update().filter(
                pk__in=sorted(set(source_zone_ids + [str(target_zone_id)]))
            )}
            target = locked.get(str(target_zone_id))
            sources = [locked.get(value) for value in source_zone_ids]
            if not target or any(zone is None for zone in sources):
                raise ValidationError('Không tìm thấy vùng cần gộp.')
            for source in sources:
                if source.missions.filter(status__in=['PENDING_ACCEPTANCE', 'ACCEPTED', 'ON_MY_WAY', 'ACTIVE', 'NEEDS_HELP']).exists():
                    raise ValidationError(f'Vùng {source.name} còn đội đang hoạt động nên chưa thể gộp.')
            SOSSignal.objects.filter(zone__in=sources).update(zone=target)
            for source in sources:
                recount(source.pk)
                if not source.missions.exists():
                    source.delete()
                else:
                    source.status = 'RESOLVED'
                    source.save(update_fields=['status', 'updated_at'])
            recount(target.pk)
            event_message = f'Đã gộp {len(sources)} vùng vào {target.name}.'
            return Response({'message': event_message, 'target_zone': str(target.pk)})

        if not sos_ids:
            raise ValidationError('Hãy chọn ít nhất một SOS.')
        signals = list(SOSSignal.objects.select_for_update().filter(pk__in=sos_ids))
        if len(signals) != len(set(sos_ids)):
            raise ValidationError('Một số SOS không tồn tại.')
        if any(signal.assigned_mission and signal.assigned_mission.status in ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ON_MY_WAY', 'ACTIVE', 'NEEDS_HELP'] for signal in signals):
            raise ValidationError('Không thể chuyển SOS đang có đội phụ trách. Hãy bàn giao nhiệm vụ trước.')
        old_zone_ids = {signal.zone_id for signal in signals if signal.zone_id}
        target = None
        if action == 'move_sos':
            if not target_zone_id:
                raise ValidationError('Hãy chọn vùng đích.')
            target = get_object_or_404(Zone.objects.select_for_update(), pk=target_zone_id)
            if target.status == 'RESOLVED':
                raise ValidationError('Không thể chuyển SOS vào vùng đã đóng.')
        for signal in signals:
            signal.zone = target
            signal.save(update_fields=['zone', 'updated_at'])
            event(signal, 'ZONE_CHANGED',
                f'Admin chuyển yêu cầu vào vùng {target.name}.' if target else 'Admin tách yêu cầu thành SOS đơn lẻ.',
                request.user)
        for zone_id in old_zone_ids:
            recount(zone_id)
        if target:
            recount(target.pk)
        return Response({'message': f'Đã cập nhật vùng cho {len(signals)} SOS.'})


def serialize(sos):
    result = dict(SOSSignalSerializer(sos).data)
    result.update({k: getattr(sos, k) for k in [
        'contact_name', 'contact_phone', 'address', 'location_source', 'verification_status', 'updated_at',
        'supplies_needed', 'supplies_delivered']})
    result['events'] = list(sos.events.values('id', 'kind', 'message', 'created_at'))
    m = sos.assigned_mission
    result['mission_status'] = m.status if m else None
    result['assigned_rescuer'] = ({'id': m.rescuer_id, 'name': m.rescuer.full_name,
        'phone': m.rescuer.phone} if m and m.rescuer else None)
    return result


class IntakeThrottle(AnonRateThrottle):
    rate = '20/hour'


class Intake(serializers.Serializer):
    contact_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    address = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    location_lat = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-90, max_value=90)
    location_lng = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-180, max_value=180)
    location_source = serializers.ChoiceField(choices=['GPS', 'MAP', 'ADDRESS'], default='GPS')
    emergency_type = serializers.ChoiceField(choices=['RESCUE', 'MEDICAL', 'FOOD', 'FIRE', 'OTHER'])
    people_count = serializers.IntegerField(min_value=1, max_value=10000)
    note = serializers.CharField(max_length=4000, required=False, allow_blank=True, default='')


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([IntakeThrottle])
def draft(request):
    token = request.headers.get('X-SOS-Key')
    if token:
        sos = SOSSignal.objects.filter(request_key=ticket_key(token)).first()
        if sos:
            can_read(request, sos)
        return Response({'sos': serialize(sos) if sos else None})
    return Response({'tracking_key': signing.dumps(str(uuid.uuid4()), salt=SALT)})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([IntakeThrottle])
def create(request):
    key = ticket_key(request.headers.get('X-SOS-Key'))
    existing = SOSSignal.objects.filter(request_key=key).first()
    if existing:
        can_read(request, existing)
        return Response(serialize(existing))
    data = Intake(data=request.data)
    data.is_valid(raise_exception=True)
    values = data.validated_data
    values['contact_phone'] = values.pop('phone')
    citizen = request.user if request.user.is_authenticated else None
    try:
        with transaction.atomic():
            sos = SOSSignal.objects.create(request_key=key, citizen=citizen, **values)
            event(sos, 'CREATED', 'Đã tiếp nhận yêu cầu cứu trợ.', citizen)

            # Đính kèm ảnh hiện trường trực tiếp trong cùng 1 request
            uploaded_images = request.FILES.getlist('images')
            if not uploaded_images and request.FILES.get('image'):
                uploaded_images = [request.FILES.get('image')]
            for img in uploaded_images[:10]:
                SOSImage.objects.create(sos=sos, image=img)
            if uploaded_images:
                event(sos, 'IMAGE', f'Đã tải lên {len(uploaded_images)} ảnh hiện trường.', citizen)
    except IntegrityError:
        sos = SOSSignal.objects.get(request_key=key)
        can_read(request, sos)
        return Response(serialize(sos))
    try:
        from ai.clustering import run_clustering
        run_clustering(only_unassigned=True)
        sos.refresh_from_db()
        recount(sos.zone_id)
    except Exception:
        import logging
        logging.getLogger(__name__).exception('Clustering unavailable; SOS saved')
    return Response(serialize(sos), status=201)


@api_view(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def detail(request, pk):
    with transaction.atomic():
        sos = get_object_or_404(SOSSignal.objects.select_for_update(), pk=pk)
        can_read(request, sos)
        if request.method == 'GET':
            return Response(serialize(sos))
        if request.method == 'DELETE':
            raise ValidationError('Yêu cầu được hủy có lý do, không xóa lịch sử.')
        action = request.data.get('action', '')
        note = str(request.data.get('message', '')).strip()[:4000]
        if not action:
            raise ValidationError('Cần chỉ định hành động thay vì sửa trạng thái trực tiếp.')
        owner = owns(request, sos)
        recount_zone_id = sos.zone_id
        if action in ['update', 'worsened', 'cancel', 'confirmed', 'still_need_help']:
            if not owner:
                raise PermissionDenied('Chỉ người gửi được thực hiện thao tác này.')
            if action in ['update', 'worsened', 'cancel'] and sos.status not in OPEN:
                raise ValidationError('Yêu cầu đã kết thúc.')
            if action != 'confirmed' and not note:
                raise ValidationError('Vui lòng nhập nội dung hoặc lý do.')
            if action == 'cancel':
                sos.status = 'CANCELLED'
            if action in ['confirmed', 'still_need_help'] and sos.status != 'RESOLVED':
                raise ValidationError('Chưa có kết quả cứu trợ để xác nhận.')
            if action == 'still_need_help':
                sos.status = 'PENDING'
                sos.assigned_mission = None
            if action == 'update':
                sos.note = '\n'.join(filter(None, [sos.note, note]))[-12000:]
            labels = {'update': 'Bổ sung thông tin', 'worsened': 'Tình hình xấu đi',
                'cancel': 'Không còn cần hỗ trợ', 'confirmed': 'Người gửi xác nhận đã được hỗ trợ',
                'still_need_help': 'Người gửi vẫn cần hỗ trợ; chờ phân công lại'}
            event(sos, action.upper(), f'{labels[action]}: {note}'.rstrip(': '), request.user)
        elif action in ['verify', 'request_info', 'update_supplies_needed']:
            if not admin(request.user):
                raise PermissionDenied('Chỉ admin được xác minh yêu cầu.')
            if action != 'update_supplies_needed' and not note:
                raise ValidationError('Cần ghi nội dung xác minh/yêu cầu bổ sung.')
            if action == 'verify':
                target = request.data.get('verification_status')
                if target not in dict(SOSSignal._meta.get_field('verification_status').choices):
                    raise ValidationError('Trạng thái xác minh không hợp lệ.')
                previous = sos.verification_status
                sos.verification_status = target
                if target == 'INCORRECT':
                    mission = sos.assigned_mission
                    if sos.status in OPEN:
                        sos.status = 'CANCELLED'
                    sos.zone = None
                    sos.assigned_mission = None
                    if mission:
                        from reporting.models import MissionEvent
                        MissionEvent.objects.create(
                            mission=mission,
                            actor=request.user,
                            message=f'SOS {sos.pk} bị loại khỏi nhiệm vụ vì admin xác định thông tin không chính xác.',
                        )
                elif previous == 'INCORRECT' and sos.status == 'CANCELLED':
                    sos.status = 'PENDING'
            elif action == 'update_supplies_needed':
                supplies = request.data.get('supplies_needed')
                if not isinstance(supplies, dict):
                    raise ValidationError('Nhu cầu tiếp tế không hợp lệ.')
                clean = {}
                for item, qty in supplies.items():
                    try:
                        qty = int(qty)
                    except (ValueError, TypeError):
                        raise ValidationError(f'Số lượng {item} không hợp lệ.')
                    if qty < 0 or qty > 100000:
                        raise ValidationError('Số lượng nhu cầu phải từ 0 đến 100000.')
                    if qty:
                        clean[str(item)[:50]] = qty
                sos.supplies_needed = clean
                note = note or 'Admin cập nhật nhu cầu tiếp tế.'
            event(sos, action.upper(), note, request.user)
        else:
            raise ValidationError('Hành động không hợp lệ.')
        sos.save()
        recount(recount_zone_id or sos.zone_id)
        return Response(serialize(sos))


@api_view(['POST'])
@permission_classes([AllowAny])
def image_upload(request, sos_id):
    sos = get_object_or_404(SOSSignal, pk=sos_id)
    if not owns(request, sos):
        raise PermissionDenied('Chỉ người gửi được tải ảnh lên yêu cầu.')
    if sos.images.count() >= 10:
        raise ValidationError('Tối đa 10 ảnh cho mỗi yêu cầu.')
    payload = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
    serializer = SOSImageSerializer(data={**payload, 'sos': sos.pk})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    event(sos, 'IMAGE', 'Người gửi bổ sung ảnh hiện trường.', request.user)
    return Response(serializer.data, status=201)
