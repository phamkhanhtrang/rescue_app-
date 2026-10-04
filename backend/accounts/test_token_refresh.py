from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


class TokenRefreshTests(TestCase):
    def test_refresh_then_access_protected_endpoint(self):
        user = User.objects.create_user(username='refresh-admin', phone='refresh-test', role='ADMIN')
        client = APIClient()
        response = client.post('/accounts/token/refresh/', {'refresh': str(RefreshToken.for_user(user))})
        self.assertEqual(response.status_code, 200)
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + response.data['access'])
        self.assertEqual(client.get('/accounts/profiles/').status_code, 200)

    def test_invalid_refresh_rejected(self):
        self.assertEqual(APIClient().post('/accounts/token/refresh/', {'refresh': 'invalid'}).status_code, 401)
