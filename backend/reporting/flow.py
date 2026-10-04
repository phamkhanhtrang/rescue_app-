"""State transitions and ownership checks for rescue teams."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from accounts.models import User
from rescue_operations.models import SOSSignal, Zone
from rescue_operations.flow import admin, operator, event, recount, serialize as sos_data, OPEN
from .models import Mission, Resource, SupportRequest, MissionEvent
from .serializers import MissionSerializer, ResourceSerializer

BUSY = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ON_MY_WAY', 'ACTIVE', 'NEEDS_HELP']
NEXT = {'PENDING_ACCEPTANCE': 'ACCEPTED', 'ACCEPTED': 'ON_MY_WAY', 'ON_MY_WAY': 'ACTIVE', 'NEEDS_HELP': 'ACTIVE'}


def team_check(request, mission):
    if not operator(request.user) or (not admin(request.user) and mission.rescuer_id != request.user.pk):
        raise PermissionDenied('Bạn không phụ trách nhiệm vụ này.')


def mission_data(m):
    data = dict(MissionSerializer(m).data)
    data['sos'] = [sos_data(s) for s in m.assigned_sos.all()]
    data['events'] = list(m.events.values('id', 'message', 'created_at'))
    data['support_requests'] = list(m.support_requests.values('id', 'resource_type', 'quantity', 'note', 'status'))
    data['supporting_requests'] = list(m.supporting_requests.values('id', 'resource_type', 'quantity', 'note', 'status'))
    support_targets = SOSSignal.objects.none()
    if m.supporting_requests.exists():
        primary_ids = m.supporting_requests.values_list('mission_id', flat=True)
        support_targets = SOSSignal.objects.filter(assigned_mission_id__in=primary_ids, status__in=OPEN)
    data['support_target_sos'] = [sos_data(s) for s in support_targets]
    data['allocated_staff'] = m.allocated_staff
    data['allocated_vehicles'] = m.allocated_vehicles
    data['outcome_note'] = m.outcome_note
    return data


def log(m, user, message):
    MissionEvent.objects.create(mission=m, actor=user, message=message)


def do_create(request, zone_id, target_id, sos_ids=None, role='', supporting=None):
    # Consistent ordering: team -> zone -> requests. Team row protects cross-zone races.
    team = get_object_or_404(User.objects.select_for_update(), pk=target_id, role='RESCUER', is_active=True)
    if not admin(request.user) and team.pk != request.user.pk:
        raise PermissionDenied('Không được nhận việc thay đội khác.')
    zone = get_object_or_404(Zone.objects.select_for_update(), pk=zone_id) if zone_id else None
    if zone and zone.status not in ['ACTIVE', 'STABILIZING']:
        raise ValidationError('Vùng không còn mở nhận nhiệm vụ.')
    if not zone and supporting:
        raise ValidationError('Yêu cầu chi viện phải thuộc một vùng cứu hộ.')
    if not zone and not sos_ids:
        raise ValidationError('Nhiệm vụ ngoài vùng phải chỉ định SOS đơn lẻ.')
    if Mission.objects.filter(rescuer=team, status__in=BUSY).exists():
        raise ValidationError('Đội đang có nhiệm vụ chưa kết thúc.')
    resource = Resource.objects.filter(rescuer=team).order_by('-created_at').first()
    if not resource or not resource.is_available or not resource.confirmed_at:
        raise ValidationError('Đội cần xác nhận nguồn lực sẵn sàng trước khi nhận việc.')
    
    targets = []
    if sos_ids:
        qs = SOSSignal.objects.select_for_update().filter(status__in=OPEN,
            assigned_mission__isnull=True).exclude(verification_status='INCORRECT')
        qs = qs.filter(zone=zone) if zone else qs.filter(zone__isnull=True)
        qs = qs.filter(pk__in=sos_ids)
        targets = list(qs)
        if len(targets) != len(set(sos_ids)):
            raise ValidationError('Một số SOS đã có đội nhận, đã kết thúc hoặc không thuộc phạm vi đã chọn.')
    elif not supporting and sos_ids is not None:
        targets = []

    m = Mission.objects.create(zone=zone, rescuer=team, role=role,
        status='PENDING_ACCEPTANCE' if admin(request.user) else 'ACCEPTED',
        allocated_staff=resource.number_staff, allocated_vehicles=resource.vehicle_count)
    if not supporting and targets:
        for sos in targets:
            sos.assigned_mission = m
            if m.status == 'ACCEPTED':
                sos.status = 'ACKNOWLEDGED'
            sos.save()
            event(sos, 'ASSIGNED', 'Đã giao cho đội; ' + ('chờ xác nhận nhận việc.' if m.status == 'PENDING_ACCEPTANCE' else 'đội đã nhận.'), request.user)
    log(m, request.user, 'Đã giao nhiệm vụ.' if admin(request.user) else 'Đội xác nhận nhận nhiệm vụ.')
    return m


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create(request):
    if not operator(request.user):
        raise PermissionDenied('Chỉ admin và cứu hộ được tạo nhiệm vụ.')
    with transaction.atomic():
        m = do_create(request, request.data.get('zone'),
            request.data.get('rescuer') if admin(request.user) else request.user.pk,
            request.data.get('sos_ids'), request.data.get('role', '')[:100])
        return Response(mission_data(m), status=201)


def _detail(request, pk, forced_action=None):
    with transaction.atomic():
        # Lock the team first, matching create/resource operations.
        probe = get_object_or_404(Mission, pk=pk)
        if probe.rescuer_id:
            User.objects.select_for_update().get(pk=probe.rescuer_id)
        m = get_object_or_404(Mission.objects.select_for_update(), pk=pk)
        team_check(request, m)
        if request.method == 'GET':
            return Response(mission_data(m))
        action = forced_action or request.data.get('action')
        target = request.data.get('status')
        note = str(request.data.get('message', '')).strip()[:4000]
        if action == 'next':
            target = NEXT.get(m.status)
        if action in ['leave', 'decline']:
            if m.status not in BUSY or not note:
                raise ValidationError('Cần nhiệm vụ đang mở và lý do bàn giao/từ chối.')
            for sos in m.assigned_sos.select_for_update().filter(status__in=OPEN):
                sos.assigned_mission = None
                sos.status = 'PENDING'
                sos.save()
                event(sos, 'HANDOVER', f'Chờ phân công lại. Lý do: {note}', request.user)
            m.status = 'CANCELLED'
            m.completed_at = timezone.now()
            m.outcome_note = note
            # A withdrawing support team releases the request for another team.
            for support in m.supporting_requests.select_for_update().filter(status='ACCEPTED'):
                support.status = 'OPEN' if support.mission.status in BUSY else 'CLOSED'
                support.supporting_mission = None
                support.save()
            # Requests from a cancelled primary mission no longer accept teams.
            m.support_requests.exclude(status='CLOSED').update(status='CLOSED')
        elif action == 'claim_sos':
            if m.status not in BUSY or not m.zone_id:
                raise ValidationError('Nhiệm vụ đã kết thúc hoặc chưa có vùng.')
            if m.supporting_requests.exists():
                raise ValidationError('Đội chi viện phối hợp với đội chính, không tự nhận thêm SOS chính.')
            target_sos_id = request.data.get('sos_id')
            target_sos_ids = request.data.get('sos_ids')
            if not target_sos_id and not target_sos_ids:
                raise ValidationError('Hãy chọn ít nhất một SOS cụ thể cần tiếp cận.')
            qs = SOSSignal.objects.select_for_update().filter(zone_id=m.zone_id,
                assigned_mission__isnull=True, status__in=OPEN).exclude(verification_status='INCORRECT')
            if target_sos_id:
                qs = qs.filter(pk=target_sos_id)
            elif target_sos_ids:
                qs = qs.filter(pk__in=target_sos_ids)
            candidates = list(qs)
            if not candidates:
                raise ValidationError('SOS đã có đội khác tiếp cận, đã kết thúc hoặc không thuộc vùng này.')
            for sos in candidates:
                sos.assigned_mission = m
                sos.status = 'IN_PROGRESS' if m.status in ['ACTIVE', 'NEEDS_HELP'] else 'ACKNOWLEDGED'
                sos.save()
                event(sos, 'ASSIGNED', 'Đội đã nhận phụ trách yêu cầu.', request.user)
        elif action == 'resolve_sos':
            if m.status not in ['ACTIVE', 'NEEDS_HELP'] or not note:
                raise ValidationError('Cần đến hiện trường và ghi kết quả trước khi đóng SOS.')
            sos = get_object_or_404(m.assigned_sos.select_for_update(), pk=request.data.get('sos_id'))
            if sos.status not in OPEN:
                raise ValidationError('SOS không còn cần xử lý.')
            sos.status = 'RESOLVED'
            delivered = request.data.get('supplies_delivered')
            if delivered:
                raise ValidationError('Hãy ghi nhận tiếp tế trước, sau đó xác nhận hoàn thành SOS.')
            sos.save()
            event(sos, 'RESOLVED', f'Đội báo kết quả: {note}', request.user)
            recount(sos.zone_id)
        elif action == 'deliver_supplies':
            if m.status not in ['ACTIVE', 'NEEDS_HELP']:
                raise ValidationError('Cần đến hiện trường trước khi ghi nhận tiếp tế.')
            allowed = m.assigned_sos.all()
            if m.supporting_requests.exists():
                primary_ids = m.supporting_requests.values_list('mission_id', flat=True)
                allowed = SOSSignal.objects.filter(assigned_mission_id__in=primary_ids)
            sos = get_object_or_404(allowed.select_for_update(), pk=request.data.get('sos_id'))
            delivered = request.data.get('supplies_delivered', {})
            if not delivered or not isinstance(delivered, dict):
                raise ValidationError('Dữ liệu hàng tiếp tế không hợp lệ.')
            clean = {}
            for item, qty in delivered.items():
                try:
                    qty = int(qty)
                except (ValueError, TypeError):
                    raise ValidationError(f'Số lượng {item} không hợp lệ.')
                if qty <= 0:
                    raise ValidationError('Số lượng giao phải lớn hơn 0.')
                clean[str(item)[:50]] = qty
            resource_probe = Resource.objects.filter(rescuer=m.rescuer).order_by('-created_at').first()
            if not resource_probe:
                raise ValidationError('Đội chưa có hồ sơ nguồn lực.')
            resource = Resource.objects.select_for_update().get(pk=resource_probe.pk)
            inventory = dict(resource.supplies or {})
            needed = dict(sos.supplies_needed or {})
            curr = sos.supplies_delivered or {}
            for item, qty in clean.items():
                if int(inventory.get(item, 0) or 0) < qty:
                    raise ValidationError(f'Nguồn lực của đội không đủ {item}.')
                remaining = max(0, int(needed.get(item, 0) or 0) - int(curr.get(item, 0) or 0))
                if item in needed and qty > remaining:
                    raise ValidationError(f'{item} chỉ còn thiếu {remaining}.')
                inventory[item] = int(inventory.get(item, 0) or 0) - qty
                curr[item] = int(curr.get(item, 0) or 0) + qty
            sos.supplies_delivered = curr
            sos.save(update_fields=['supplies_delivered'])
            resource.supplies = inventory
            resource.save(update_fields=['supplies', 'updated_at'])
            item_summary = ', '.join(f'{k}: {v}' for k, v in clean.items())
            event(sos, 'SUPPLIES', f'Đội đã tiếp tế: {item_summary}. {note}'.strip(), request.user)
        elif action == 'support':
            if m.status not in ['ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP'] or not note:
                raise ValidationError('Cần nhiệm vụ đang thực hiện và lý do chi viện.')
            try:
                qty = int(request.data.get('quantity', 1))
            except (ValueError, TypeError):
                raise ValidationError('Số lượng không hợp lệ.')
            resource_type = str(request.data.get('resource_type', '')).strip()[:100]
            if qty < 1 or qty > 1000 or not resource_type:
                raise ValidationError('Cần loại nguồn lực và số lượng từ 1 đến 1000.')
            SupportRequest.objects.create(mission=m, quantity=qty, resource_type=resource_type, note=note)
        elif action == 'close_support':
            support = get_object_or_404(SupportRequest, pk=request.data.get('support_id'), mission=m)
            if not note:
                raise ValidationError('Cần ghi kết quả chi viện.')
            support.status = 'CLOSED'
            support.save()
        elif action == 'complete' or target == 'COMPLETED':
            if m.status not in ['ACTIVE', 'NEEDS_HELP']:
                raise ValidationError('Đội phải tới hiện trường trước khi báo hoàn thành.')
            if m.assigned_sos.filter(status__in=OPEN).exists():
                raise ValidationError('Còn SOS chưa xử lý. Hãy xử lý hoặc bàn giao.')
            if not m.assigned_sos.exists() and not m.supporting_requests.exists():
                raise ValidationError('Đội chưa nhận SOS nào. Hãy chọn SOS cần xử lý hoặc rời vùng có lý do.')
            if m.support_requests.exclude(status='CLOSED').exists():
                raise ValidationError('Cần đóng các yêu cầu chi viện trước khi hoàn thành.')
            if not note:
                raise ValidationError('Cần ghi báo cáo kết quả.')
            m.status = 'COMPLETED'
            m.completed_at = timezone.now()
            m.outcome_note = note
        elif action == 'needs_help' or target == 'NEEDS_HELP':
            if m.status not in ['ON_MY_WAY', 'ACTIVE']:
                raise ValidationError('Chỉ nhiệm vụ đang di chuyển hoặc ở hiện trường mới có thể xin chi viện.')
            if not note:
                raise ValidationError('Vui lòng nêu rõ lý do hoặc tình huống cần chi viện.')
            m.status = 'NEEDS_HELP'
            m.outcome_note = f"[CẦN CHI VIỆN KHẨN CẤP]: {note}"
        elif action in ['resume', 'active'] or (target == 'ACTIVE' and m.status == 'NEEDS_HELP'):
            m.status = 'ACTIVE'
            if note:
                m.outcome_note = f"[TIẾP TỤC XỬ LÝ]: {note}"
        elif target and target == NEXT.get(m.status):
            m.status = target
            for sos in m.assigned_sos.select_for_update().filter(status__in=OPEN):
                sos.status = 'ACKNOWLEDGED' if target in ['ACCEPTED', 'ON_MY_WAY'] else 'IN_PROGRESS'
                sos.save()
                event(sos, target, {'ACCEPTED': 'Đội đã nhận nhiệm vụ.', 'ON_MY_WAY': 'Đội bắt đầu di chuyển.', 'ACTIVE': 'Đội đã đến, đang hỗ trợ.'}[target], request.user)
        else:
            raise ValidationError('Không được chuyển trạng thái theo thứ tự này.')
        m.save()
        labels = {'leave': 'Đã bàn giao/rút khỏi nhiệm vụ', 'decline': 'Đã từ chối nhiệm vụ',
            'claim_sos': 'Đã nhận SOS chưa phân công', 'resolve_sos': 'Đã ghi kết quả xử lý SOS',
            'deliver_supplies': 'Đã ghi nhận tiếp tế hàng hóa',
            'support': 'Đã yêu cầu chi viện', 'close_support': 'Đã đóng nhu cầu chi viện',
            'complete': 'Đã hoàn thành nhiệm vụ', 'ACCEPTED': 'Đã nhận nhiệm vụ',
            'ON_MY_WAY': 'Đang di chuyển', 'ACTIVE': 'Đã đến hiện trường', 'COMPLETED': 'Đã hoàn thành nhiệm vụ',
            'needs_help': 'Báo động cần chi viện khẩn cấp', 'NEEDS_HELP': 'Cần chi viện khẩn cấp',
            'resume': 'Đã nhận hỗ trợ, tiếp tục xử lý'}
        key = target if action == 'next' or not action else action
        log(m, request.user, f'{labels.get(key, key)}: {note}'.rstrip(': '))
        return Response(mission_data(m))


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def complete(request, pk):
    return _detail(request, pk, 'complete')


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def leave(request, pk):
    return _detail(request, pk, 'leave')


@api_view(['GET', 'POST', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def detail(request, pk):
    return _detail(request, pk)


@api_view(['GET', 'PUT', 'POST'])
@permission_classes([IsAuthenticated])
def resource_current(request):
    if not operator(request.user):
        raise PermissionDenied('Chỉ đội cứu hộ và admin được truy cập.')
    target_id = (request.query_params.get('rescuer_id') or request.data.get('rescuer')) if admin(request.user) else request.user.pk
    with transaction.atomic():
        team = get_object_or_404(User.objects.select_for_update(), pk=target_id, role='RESCUER')
        current = Resource.objects.filter(rescuer=team).order_by('-created_at').first()
        busy = Mission.objects.filter(rescuer=team, status__in=BUSY)
        if request.method in ['PUT', 'POST']:
            if busy.exists():
                raise ValidationError('Nguồn lực đang được dành cho nhiệm vụ. Kết thúc/bàn giao trước khi thay đổi.')
            payload = {k: v for k, v in request.data.items() if k in [
                'vehicle_type', 'vehicle_count', 'number_staff', 'specialties', 'supplies', 'is_available']}
            serializer = ResourceSerializer(current, data=payload, partial=bool(current))
            serializer.is_valid(raise_exception=True)
            current = serializer.save(rescuer=team, confirmed_at=timezone.now(), verification_status='SELF_DECLARED')
        data = dict(ResourceSerializer(current).data) if current else None
        return Response({'resource': data, 'reserved': busy.exists(),
            'allocated_staff': sum(m.allocated_staff for m in busy),
            'allocated_vehicles': sum(m.allocated_vehicles for m in busy),
            'legacy_records': max(0, Resource.objects.filter(rescuer=team).count() - 1),
            'needs_confirmation': current is None or current.confirmed_at is None})


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def resource_legacy(request, pk):
    resource = get_object_or_404(Resource, pk=pk)
    if not admin(request.user) and resource.rescuer_id != request.user.pk:
        raise PermissionDenied('Không có quyền truy cập nguồn lực này.')
    if request.method != 'GET':
        raise ValidationError('Hãy cập nhật hồ sơ nguồn lực hiện tại; không sửa/xóa bản khai cũ.')
    return Response(ResourceSerializer(resource).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def support_list(request):
    if not operator(request.user):
        raise PermissionDenied('Chỉ đội cứu hộ và admin được truy cập.')
    if request.method == 'POST':
        with transaction.atomic():
            target_id = request.data.get('rescuer') if admin(request.user) else request.user.pk
            if not target_id:
                raise ValidationError('Admin cần chọn đội nhận chi viện.')
            # Acquire team before locking support to maintain a single order.
            User.objects.select_for_update().get(pk=target_id, role='RESCUER', is_active=True)
            s = get_object_or_404(SupportRequest.objects.select_for_update(), pk=request.data.get('id'), status='OPEN')
            if s.mission.rescuer_id == target_id:
                raise ValidationError('Không thể nhận chi viện cho chính mình.')
            if s.mission.status not in BUSY:
                raise ValidationError('Nhiệm vụ nguồn đã kết thúc; cần admin điều phối lại.')
            m = do_create(request, s.mission.zone_id, target_id, role='Hỗ trợ', supporting=s)
            s.status = 'ACCEPTED'
            s.supporting_mission = m
            s.save()
            return Response(mission_data(m), status=201)
    rows = SupportRequest.objects.exclude(status='CLOSED').select_related(
        'mission', 'mission__zone', 'mission__rescuer', 'supporting_mission__rescuer'
    )
    zone_id = request.query_params.get('zone') or request.query_params.get('zone_id')
    if zone_id:
        rows = rows.filter(mission__zone_id=zone_id)
    return Response({'results': [{'id': s.pk, 'zone': s.mission.zone_id,
        'zone_name': s.mission.zone.name if s.mission.zone else '', 'rescuer': s.mission.rescuer_id,
        'rescuer_name': s.mission.rescuer.full_name if s.mission.rescuer else '',
        'supporting_rescuer': s.supporting_mission.rescuer_id if s.supporting_mission else None,
        'supporting_rescuer_name': s.supporting_mission.rescuer.full_name if s.supporting_mission and s.supporting_mission.rescuer else '',
        'resource_type': s.resource_type, 'quantity': s.quantity, 'note': s.note,
        'status': s.status, 'created_at': s.created_at}
        for s in rows]})
