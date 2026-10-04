from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction, IntegrityError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes, authentication_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework import serializers
from .models import CitizenProfile, RescuerProfile, User, AccountEvent
from .serializers import (ProfileSerializer, ProfileListSerializer, CitizenProfileSerializer,
                          RescuerProfileSerializer, CitizenRegisterSerializer, RescuerRegisterSerializer, account_status)
from .authentication import issue_session
from rescue_operations.flow import admin


class LoginThrottle(AnonRateThrottle):
    rate = '20/min'


def account_denied(request, target=None, admin_only=False):
    if admin(request.user):
        return None
    if (admin_only or not request.user.is_authenticated or not request.user.is_active
            or target is None or str(request.user.pk) != str(target)):
        return Response({'error': 'Không có quyền thực hiện thao tác này.'}, status=403)
    return None


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_api(request):
    login_input = str(request.data.get('login_input', '')).strip()
    password = request.data.get('password')
    if not login_input or not isinstance(password, str):
        return Response({'error': 'Vui lòng nhập tài khoản và mật khẩu.'}, status=400)
    # Prefer phone/username; legacy duplicate emails cannot select an arbitrary account.
    users = User.objects.filter(Q(phone=login_input) | Q(username=login_input))
    if not users.exists():
        users = User.objects.filter(email__iexact=login_input)
    if users.count() != 1:
        return Response({'error': 'Thông tin đăng nhập không đúng. Bạn có thể dùng số điện thoại.'}, status=401)
    user = users.first()
    if not user.check_password(password):
        return Response({'error': 'Thông tin đăng nhập hoặc mật khẩu không đúng.'}, status=401)
    state = account_status(user)
    if state != 'ACTIVE':
        messages = {'PENDING': 'Tài khoản đang chờ quản trị viên duyệt.',
                    'REJECTED': 'Hồ sơ đăng ký đã bị từ chối.', 'BANNED': 'Tài khoản đã bị khóa.'}
        return Response({'error': messages[state] + (' Lý do: ' + user.account_reason if user.account_reason else ''),
                         'account_status': state}, status=403)
    return Response({'message': 'Đăng nhập thành công', **issue_session(user), 'user': ProfileSerializer(user).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(ProfileSerializer(request.user).data)


@api_view(['GET'])
def profile_list(request):
    if not admin(request.user):
        # Operational directory excludes private citizen/identity/medical information.
        if not request.user.is_authenticated or not request.user.is_active or request.query_params.get('role', '').upper() != 'RESCUER':
            return Response({'error': 'Không có quyền xem danh sách tài khoản.'}, status=403)
        users = User.objects.filter(role='RESCUER', is_active=True).select_related('rescuer_profile')
        return Response({'count': users.count(), 'results': [
            {'id': str(u.pk), 'full_name': u.full_name, 'role': u.role, 'is_active': True,
             'phone': u.phone if u.rescuer_profile.is_on_duty else None,
             'rescuer_profile': {'unit_name': u.rescuer_profile.unit_name,
                                 'specialty': u.rescuer_profile.specialty,
                                 'current_lat': u.rescuer_profile.current_lat if u.rescuer_profile.is_on_duty else None,
                                 'current_lng': u.rescuer_profile.current_lng if u.rescuer_profile.is_on_duty else None,
                                 'is_on_duty': u.rescuer_profile.is_on_duty}}
            for u in users if hasattr(u, 'rescuer_profile')]})
    users = User.objects.select_related('citizen_profile', 'rescuer_profile').order_by('-created_at')
    role = request.query_params.get('role', '').upper()
    if role:
        users = users.filter(role=role)
    search = request.query_params.get('search', '').strip()
    if search:
        users = users.filter(Q(full_name__icontains=search) | Q(phone__icontains=search) | Q(email__icontains=search))
    state = request.query_params.get('status', '').upper()
    if state == 'ACTIVE':
        users = users.filter(is_active=True)
    elif state in ['PENDING', 'REJECTED']:
        users = users.filter(is_active=False, role='RESCUER', rescuer_profile__status=state)
    elif state == 'BANNED':
        users = users.filter(is_active=False).exclude(role='RESCUER', rescuer_profile__status__in=['PENDING', 'REJECTED'])
    elif state:
        return Response({'error': 'Trạng thái không hợp lệ.'}, status=400)
    return Response({'count': users.count(), 'results': ProfileSerializer(users, many=True).data})


def change_account(request, pk, action):
    denied = account_denied(request, admin_only=True)
    if denied is not None:
        return denied
    reason = str(request.data.get('reason', '')).strip()
    if action in ['ban', 'reject'] and not reason:
        return Response({'error': 'Vui lòng nhập lý do.'}, status=400)
    if len(reason) > 2000:
        return Response({'error': 'Lý do tối đa 2000 ký tự.'}, status=400)
    with transaction.atomic():
        user = get_object_or_404(User.objects.select_for_update(), pk=pk)
        if user.pk == request.user.pk or admin(user) or user.role == 'ADMIN':
            return Response({'error': 'Không thay đổi trạng thái tài khoản quản trị tại đây.'}, status=403)
        previous = account_status(user)
        allowed = {'activate': ['PENDING', 'REJECTED', 'BANNED'], 'ban': ['ACTIVE'], 'reject': ['PENDING']}
        if previous not in allowed[action]:
            return Response({'error': 'Trạng thái đã thay đổi. Vui lòng tải lại danh sách.'}, status=409)
        rp = None
        if user.role == 'RESCUER':
            rp = RescuerProfile.objects.filter(user=user).first()
            if not rp:
                return Response({'error': 'Tài khoản thiếu hồ sơ cứu hộ; cần bổ sung trước khi duyệt.'}, status=409)
        new_state = {'activate': 'ACTIVE', 'ban': 'BANNED', 'reject': 'REJECTED'}[action]
        user.is_active = new_state == 'ACTIVE'
        user.account_reason = reason
        user.session_version += 1
        user.save(update_fields=['is_active', 'account_reason', 'session_version'])
        if not user.is_active:
            from .passwords import disable_push
            disable_push(user)
        if rp:
            rp.status = new_state
            if not user.is_active:
                rp.is_on_duty = False
            rp.save(update_fields=['status', 'is_on_duty'])
        AccountEvent.objects.create(user=user, actor=request.user, action=action, reason=reason)
    message = {'activate': 'Tài khoản đã được duyệt/mở khóa.', 'ban': 'Tài khoản đã bị khóa.',
               'reject': 'Hồ sơ đăng ký đã bị từ chối.'}[action]
    email_sent = False
    if user.email:
        try:
            email_sent = bool(send_mail('Cập nhật tài khoản SENTINEL', message + (' Lý do: ' + reason if reason else ''),
                                       settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False))
        except Exception:
            pass
    return Response({'message': message + (' Chưa gửi được email thông báo.' if user.email and not email_sent else ''),
                     'account_status': new_state, 'email_sent': email_sent})


@api_view(['POST'])
def activate_account(request, pk):
    return change_account(request, pk, 'activate')


@api_view(['POST'])
def ban_account(request, pk):
    return change_account(request, pk, 'ban')


@api_view(['POST'])
def reject_account(request, pk):
    return change_account(request, pk, 'reject')


def save_serializer(serializer):
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            return serializer.save()
    except IntegrityError:
        raise serializers.ValidationError({'error': 'Số điện thoại hoặc tài khoản đã được sử dụng. Vui lòng kiểm tra lại.'})


@api_view(['POST'])
def profile_create(request):
    denied = account_denied(request, admin_only=True)
    if denied is not None:
        return denied
    role = request.data.get('role', 'CITIZEN')
    if role not in ['CITIZEN', 'RESCUER']:
        return Response({'error': 'Chỉ tạo tài khoản người dân hoặc cứu hộ tại đây.'}, status=400)
    serializer = (RescuerRegisterSerializer if role == 'RESCUER' else CitizenRegisterSerializer)(data=request.data)
    user = save_serializer(serializer)
    return Response(ProfileSerializer(user).data, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
def profile_detail(request, pk):
    denied = account_denied(request, pk)
    if denied is not None:
        return denied
    profile = get_object_or_404(User, pk=pk)
    if request.method == 'DELETE':
        return Response({'error': 'Hãy khóa tài khoản để giữ lịch sử cứu hộ.'}, status=409)
    if request.method == 'GET':
        data = ProfileSerializer(profile).data
        if admin(request.user):
            data['history'] = list(profile.account_events.order_by('-created_at').values('action', 'reason', 'created_at', 'actor__full_name')[:50])
        return Response(data)
    if any(key in request.data for key in ['role', 'is_active', 'is_staff', 'is_superuser', 'account_reason', 'session_version']):
        return Response({'error': 'Dùng thao tác duyệt/khóa riêng; không đổi quyền trong hồ sơ.'}, status=403)
    if request.data.get('email') is not None and not isinstance(request.data['email'], str):
        return Response({'error': 'Email không hợp lệ.'}, status=400)
    if 'email' in request.data and (request.data['email'] or '').strip().lower() != (profile.email or '').lower():
        if request.user.pk == profile.pk and not profile.check_password(str(request.data.get('current_password', ''))):
            return Response({'error': 'Nhập mật khẩu hiện tại để đổi email.'}, status=400)
    serializer = ProfileSerializer(profile, data=request.data, partial=True)
    save_serializer(serializer)
    return Response(serializer.data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def citizen_profile_create(request):
    user = save_serializer(CitizenRegisterSerializer(data=request.data))
    return Response({'message': 'Đăng ký thành công', **issue_session(user), 'user': ProfileSerializer(user).data}, status=201)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def rescuer_profile_create(request):
    user = save_serializer(RescuerRegisterSerializer(data=request.data))
    return Response({'message': 'Đăng ký thành công. Vui lòng chờ quản trị viên duyệt.',
                     'user': ProfileSerializer(user).data}, status=201)


def child_profile(request, user_id, model, serializer_class):
    denied = account_denied(request, user_id)
    if denied is not None:
        return denied
    profile = get_object_or_404(model, user_id=user_id)
    if request.method == 'GET':
        return Response(serializer_class(profile).data)
    if any(k in request.data for k in ['status', 'role', 'is_active', 'user', 'user_id']):
        return Response({'error': 'Không được tự thay đổi trạng thái hoặc chủ hồ sơ.'}, status=403)
    serializer = serializer_class(profile, data=request.data, partial=True)
    save_serializer(serializer)
    return Response(serializer.data)


@api_view(['GET', 'PUT'])
def citizen_profile_detail(request, user_id):
    return child_profile(request, user_id, CitizenProfile, CitizenProfileSerializer)


@api_view(['GET', 'PUT'])
def rescuer_profile_detail(request, user_id):
    return child_profile(request, user_id, RescuerProfile, RescuerProfileSerializer)


@api_view(['PATCH'])
def rescuer_update_location(request, user_id):
    denied = account_denied(request, user_id)
    if denied is not None:
        return denied
    profile = get_object_or_404(RescuerProfile, user_id=user_id)
    from decimal import Decimal, InvalidOperation
    try:
        lat = Decimal(str(request.data.get('current_lat', request.data.get('latitude'))))
        lng = Decimal(str(request.data.get('current_lng', request.data.get('longitude'))))
        if not lat.is_finite() or not lng.is_finite() or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise ValueError()
    except (InvalidOperation, ValueError, TypeError):
        return Response({'error': 'Tọa độ không hợp lệ.'}, status=400)
    profile.current_lat, profile.current_lng = lat, lng
    profile.save(update_fields=['current_lat', 'current_lng'])
    return Response({'message': 'Cập nhật vị trí thành công.', 'current_lat': lat, 'current_lng': lng})


@api_view(['GET'])
def accounts_summary(request):
    denied = account_denied(request, admin_only=True)
    if denied is not None:
        return denied
    users = User.objects.select_related('rescuer_profile')
    by_status = {key: 0 for key in ['PENDING', 'ACTIVE', 'REJECTED', 'BANNED']}
    for user in users:
        by_status[account_status(user)] += 1
    return Response({'total_users': users.count(),
                     'by_role': {r['role']: r['count'] for r in User.objects.values('role').annotate(count=Count('id'))},
                     'by_status': by_status,
                     'rescuers_on_duty': RescuerProfile.objects.filter(user__is_active=True, is_on_duty=True).count()})

