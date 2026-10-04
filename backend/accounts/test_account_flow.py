from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient
from .models import User, CitizenProfile, RescuerProfile
from .authentication import issue_session
from .passwords import tokens


class AccountFlowTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin', phone='0900000001', role='ADMIN', password='StrongPass!39')
        self.citizen = User.objects.create_user(username='0900000002', phone='0900000002', email='citizen@example.com', role='CITIZEN', password='StrongPass!39')
        CitizenProfile.objects.create(user=self.citizen, id_number='private-id', medical_notes='private-medical')

    def auth(self, user):
        session = issue_session(user)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + session['access'])
        return session

    def register_rescuer(self):
        response = self.client.post('/accounts/rescuers/create/', {'full_name': 'Đội cứu hộ', 'phone': '0900000003',
            'password': 'StrongPass!39', 'email': 'team@example.com', 'unit_name': 'Đội A',
            'team_code': 'TEAM-01', 'specialty': 'MEDICAL'})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn('access', response.data)
        return User.objects.get(pk=response.data['user']['id'])

    def test_citizen_cannot_list_private_profiles_or_summary(self):
        self.auth(self.citizen)
        self.assertEqual(self.client.get('/accounts/profiles/?role=CITIZEN').status_code, 403)
        self.assertEqual(self.client.get('/accounts/profiles/').status_code, 403)
        self.assertEqual(self.client.get('/accounts/summary/').status_code, 403)
        self.assertEqual(self.client.get('/accounts/profiles/' + str(self.admin.pk) + '/').status_code, 403)

    def test_directory_excludes_private_fields(self):
        rescuer = self.register_rescuer()
        rescuer.is_active = True; rescuer.save()
        self.auth(self.citizen)
        result = self.client.get('/accounts/profiles/?role=RESCUER')
        self.assertEqual(result.status_code, 200)
        row = result.data['results'][0]
        self.assertIsNone(row['phone'])
        self.assertNotIn('email', row)
        self.assertNotIn('id_number', row['rescuer_profile'])

    def test_rescuer_review_reject_activate_ban_and_revoke(self):
        rescuer = self.register_rescuer()
        self.assertEqual(rescuer.rescuer_profile.team_code, 'TEAM-01')
        login = {'login_input': rescuer.phone, 'password': 'StrongPass!39'}
        self.assertEqual(self.client.post('/accounts/login/', login).data['account_status'], 'PENDING')
        self.auth(self.admin)
        url = '/accounts/profiles/' + str(rescuer.pk) + '/'
        self.assertEqual(self.client.post(url + 'reject/', {}).status_code, 400)
        self.assertEqual(self.client.post(url + 'reject/', {'reason': 'Thiếu xác minh'}).status_code, 200)
        self.assertEqual(self.client.post('/accounts/login/', login).data['account_status'], 'REJECTED')
        self.assertEqual(self.client.post(url + 'activate/').status_code, 200)
        session = self.client.post('/accounts/login/', login).data
        self.assertEqual(self.client.post(url + 'ban/', {'reason': 'Tạm khóa'}).status_code, 200)
        self.assertEqual(self.client.post(url + 'activate/').status_code, 200)
        self.assertEqual(self.client.post('/accounts/token/refresh/', {'refresh': session['refresh']}).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + session['access'])
        self.assertEqual(self.client.get('/accounts/me/').status_code, 401)
        self.assertEqual(rescuer.account_events.count(), 4)

    def test_owner_cannot_change_role_or_status(self):
        self.auth(self.citizen)
        self.assertEqual(self.client.put('/accounts/profiles/' + str(self.citizen.pk) + '/', {'role': 'ADMIN'}).status_code, 403)
        self.assertEqual(self.client.put('/accounts/citizens/' + str(self.citizen.pk) + '/', {'user_id': str(self.admin.pk)}).status_code, 403)

    def test_phone_update_syncs_login_and_email_is_unique(self):
        self.auth(self.citizen)
        response = self.client.put('/accounts/citizens/' + str(self.citizen.pk) + '/', {'phone': '090 000 0099'})
        self.assertEqual(response.status_code, 200, response.data)
        self.citizen.refresh_from_db()
        self.assertEqual(self.citizen.username, '0900000099')
        self.assertEqual(self.client.post('/accounts/login/', {'login_input': '0900000099', 'password': 'StrongPass!39'}).status_code, 200)
        self.assertEqual(self.client.post('/accounts/login/', {'login_input': '0900000002', 'password': 'StrongPass!39'}).status_code, 401)
        self.admin.email = 'admin@example.com'; self.admin.save()
        response = self.client.put('/accounts/profiles/' + str(self.citizen.pk) + '/', {'email': 'ADMIN@example.com', 'current_password': 'StrongPass!39'})
        self.assertEqual(response.status_code, 400)

    def test_registration_validation(self):
        for extra in [{'password': 'a'}, {'phone': 'x'}, {'specialty': 'Y tế, Hậu cần'}]:
            data = {'full_name': 'Test', 'phone': '0900000003', 'password': 'StrongPass!39', 'unit_name': 'A', 'specialty': 'MEDICAL', **extra}
            self.assertEqual(self.client.post('/accounts/rescuers/create/', data).status_code, 400)
        self.assertFalse(User.objects.filter(phone='0900000003').exists())

    def test_reset_email_single_use_and_preserves_ban(self):
        self.citizen.is_active = False; self.citizen.save()
        old = issue_session(self.citizen)
        response = self.client.post('/accounts/password/reset/', {'email': self.citizen.email})
        self.assertEqual(response.status_code, 200)
        code = mail.outbox[-1].body.split('\n\n')[1]
        payload = {'code': code, 'new_password': 'NewStrongPass!57'}
        self.assertEqual(self.client.post('/accounts/password/reset/confirm/', payload).status_code, 200)
        self.assertEqual(self.client.post('/accounts/password/reset/confirm/', payload).status_code, 400)
        self.citizen.refresh_from_db()
        self.assertFalse(self.citizen.is_active)
        self.assertTrue(self.citizen.check_password(payload['new_password']))
        self.assertEqual(self.client.post('/accounts/token/refresh/', {'refresh': old['refresh']}).status_code, 401)

    def test_reset_expired_and_unknown_email(self):
        unknown = self.client.post('/accounts/password/reset/', {'email': 'nobody@example.com'})
        known = self.client.post('/accounts/password/reset/', {'email': self.citizen.email})
        self.assertEqual(unknown.data, known.data)
        with patch.object(tokens, '_now', return_value=tokens._now() - timedelta(minutes=16)):
            code = str(self.citizen.pk) + '.' + tokens.make_token(self.citizen)
        self.assertEqual(self.client.post('/accounts/password/reset/confirm/', {'code': code, 'new_password': 'NewStrongPass!57'}).status_code, 400)

    def test_password_change_revokes_old_sessions(self):
        from communications.models import PushDevice
        device = PushDevice.objects.create(user=self.citizen, token='ExponentPushToken[account-test]')
        old = self.auth(self.citizen)
        self.assertEqual(self.client.post('/accounts/password/change/', {'current_password': 'wrong', 'new_password': 'NewStrongPass!57'}).status_code, 400)
        self.assertEqual(self.client.post('/accounts/password/change/', {'current_password': 'StrongPass!39', 'new_password': 'NewStrongPass!57'}).status_code, 200)
        self.assertEqual(self.client.get('/accounts/me/').status_code, 401)
        self.assertEqual(self.client.post('/accounts/token/refresh/', {'refresh': old['refresh']}).status_code, 401)
        device.refresh_from_db()
        self.assertFalse(device.is_active)

    def test_logout_revokes_only_current_session(self):
        old = self.auth(self.citizen)
        other = issue_session(self.citizen)
        self.assertEqual(self.client.post('/accounts/logout/', {'refresh': old['refresh']}).status_code, 200)
        self.assertEqual(self.client.get('/accounts/me/').status_code, 401)
        self.assertEqual(self.client.post('/accounts/token/refresh/', {'refresh': old['refresh']}).status_code, 401)
        self.assertEqual(self.client.post('/accounts/token/refresh/', {'refresh': other['refresh']}).status_code, 200)

    def test_admin_protection_and_status_filter(self):
        self.auth(self.admin)
        self.assertEqual(self.client.post('/accounts/profiles/' + str(self.admin.pk) + '/ban/', {'reason': 'x'}).status_code, 403)
        self.assertEqual(self.client.delete('/accounts/profiles/' + str(self.citizen.pk) + '/').status_code, 409)
        self.assertEqual(self.client.get('/accounts/profiles/?status=ACTIVE&search=citizen@example.com').data['count'], 1)

    def test_email_change_needs_current_password(self):
        self.auth(self.citizen)
        url = '/accounts/profiles/' + str(self.citizen.pk) + '/'
        self.assertEqual(self.client.put(url, {'email': 'new@example.com'}).status_code, 400)
        self.assertEqual(self.client.put(url, {'email': 'new@example.com', 'current_password': 'StrongPass!39'}).status_code, 200)
