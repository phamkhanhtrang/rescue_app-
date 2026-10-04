from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from .models import RevokedSession


def issue_session(user):
    refresh = RefreshToken.for_user(user)
    refresh['role'] = user.role
    refresh['session_version'] = user.session_version
    refresh['sid'] = refresh['jti']
    access = refresh.access_token
    access['role'] = user.role
    access['session_version'] = user.session_version
    access['sid'] = refresh['jti']
    return {'access': str(access), 'refresh': str(refresh)}


class AccountJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if validated_token.get('session_version', 0) != user.session_version:
            raise AuthenticationFailed('Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')
        if RevokedSession.objects.filter(sid=validated_token.get('sid', '')).exists():
            raise AuthenticationFailed('Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')
        return user
