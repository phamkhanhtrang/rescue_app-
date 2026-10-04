from uuid import UUID
from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.db import transaction
from django.core.cache import cache
from django.utils.crypto import salted_hmac
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .models import User, RevokedSession
from .validation import password_value
import logging

logger = logging.getLogger(__name__)


def disable_push(user):
    from communications.models import PushDevice
    PushDevice.objects.filter(user=user).update(is_active=False)


class PasswordThrottle(AnonRateThrottle):
    rate = '5/min'


class ResetTokens(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        return super()._make_hash_value(user, timestamp) + str(user.session_version)


tokens = ResetTokens()


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([PasswordThrottle])
def request_reset(request):
    email = serializers.EmailField().run_validation(request.data.get('email')).lower()
    # Identical response for unknown/duplicate email; do not disclose account existence.
    users = User.objects.filter(email__iexact=email)
    key = 'password-email:' + salted_hmac('reset-email', email).hexdigest()
    if users.count() == 1 and cache.add(key, True, timeout=60):
        user = users.first()
        code = str(user.pk) + '.' + tokens.make_token(user)
        try:
            send_mail('Khôi phục mật khẩu SENTINEL',
                      'Dán toàn bộ mã dưới đây vào màn hình Quên mật khẩu. Mã dùng một lần, hết hạn sau 15 phút.\n\n'
                      + code + '\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.',
                      settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        except Exception:
            cache.delete(key)
            logger.warning('Không gửi được email khôi phục; kiểm tra cấu hình SMTP.')
            # Same generic response avoids exposing whether this email has an account.
    return Response({'message': 'Nếu email khớp một tài khoản, mã khôi phục sẽ được gửi. Kiểm tra hộp thư và thư rác; có thể gửi lại sau 60 giây.'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([PasswordThrottle])
def confirm_reset(request):
    code = str(request.data.get('code', '')).strip()
    try:
        uid, token = code.split('.', 1)
        uid = UUID(uid)
    except (ValueError, TypeError):
        return Response({'error': 'Mã khôi phục không hợp lệ hoặc đã hết hạn.'}, status=400)
    with transaction.atomic():
        user = User.objects.select_for_update().filter(pk=uid).first()
        if not user or not tokens.check_token(user, token):
            return Response({'error': 'Mã khôi phục không hợp lệ hoặc đã hết hạn.'}, status=400)
        password = serializers.CharField(trim_whitespace=False).run_validation(request.data.get('new_password'))
        password_value(password, user)
        user.set_password(password)
        user.session_version += 1
        user.save(update_fields=['password', 'session_version'])
        disable_push(user)
    return Response({'message': 'Đã đặt lại mật khẩu. Vui lòng đăng nhập lại; trạng thái duyệt/khóa tài khoản không thay đổi.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if not user.check_password(str(request.data.get('current_password', ''))):
            return Response({'error': 'Mật khẩu hiện tại không đúng.'}, status=400)
        password = serializers.CharField(trim_whitespace=False).run_validation(request.data.get('new_password'))
        password_value(password, user)
        user.set_password(password)
        user.session_version += 1
        user.save(update_fields=['password', 'session_version'])
        disable_push(user)
    return Response({'message': 'Đã đổi mật khẩu. Vui lòng đăng nhập lại trên các thiết bị.'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def refresh_session(request):
    try:
        token = RefreshToken(request.data.get('refresh', ''))
        user = User.objects.filter(pk=token.get('user_id')).first()
        if (not user or not user.is_active or token.get('session_version', 0) != user.session_version
                or RevokedSession.objects.filter(sid=token.get('sid', token['jti'])).exists()):
            raise TokenError()
    except (TokenError, ValueError, TypeError):
        return Response({'error': 'Phiên đăng nhập đã kết thúc hoặc tài khoản bị khóa. Vui lòng đăng nhập lại.'}, status=401)
    return Response({'access': str(token.access_token)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    from datetime import datetime, timezone
    from django.utils import timezone as django_timezone
    try:
        token = RefreshToken(request.data.get('refresh', ''))
        if str(token.get('user_id')) != str(request.user.pk):
            raise TokenError()
    except (TokenError, TypeError, ValueError):
        return Response({'error': 'Phiên đăng xuất không hợp lệ.'}, status=400)
    RevokedSession.objects.filter(expires_at__lt=django_timezone.now()).delete()
    from rest_framework_simplejwt.settings import api_settings
    expires_at = max(datetime.fromtimestamp(token['exp'], timezone.utc),
                     django_timezone.now() + api_settings.ACCESS_TOKEN_LIFETIME)
    RevokedSession.objects.get_or_create(sid=token.get('sid', token['jti']),
        defaults={'expires_at': expires_at})
    if not token.get('sid'):
        from django.db.models import F
        User.objects.filter(pk=request.user.pk).update(session_version=F('session_version') + 1)
    return Response({'message': 'Đã đăng xuất.'})
