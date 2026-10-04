from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError
from rest_framework.test import APIClient
from rescue_operations.models import Zone
from reporting.models import Mission
from .models import Alert, AlertRead, PushDevice, PushDelivery
from .push import process_push, send_pending, check_receipts


class AlertFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.admin = User.objects.create_user(username='admin', phone='100', role='ADMIN')
        self.citizen = User.objects.create_user(username='citizen', phone='101', role='CITIZEN', address='Quận Hải Châu, Đà Nẵng')
        self.rescuer = User.objects.create_user(username='rescuer', phone='102', role='RESCUER', address='Hải Châu')
        self.local = Zone.objects.create(name='Hải Châu', location_lat=16.06, location_lng=108.22)
        self.remote = Zone.objects.create(name='Hà Nội', location_lat=21.02, location_lng=105.83)

    def alert(self, **kwargs):
        return Alert.objects.create(**{'title': 'Bản tin', 'description': 'Hướng dẫn hành động', **kwargs})

    def ids(self, user=None, **params):
        self.client.force_authenticate(user)
        response = self.client.get('/communications/alerts/', params)
        self.assertEqual(response.status_code, 200, response.data)
        return {row['id'] for row in response.data['results']}

    def test_emergency_rescuer_scope_is_preserved_and_protected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/communications/alerts/create/', {
            'title': 'Sơ tán', 'description': 'Đội cứu hộ triển khai', 'message_type': 'EMERGENCY',
            'audience': 'RESCUER', 'zone': None, 'is_active': True,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        pk = response.data['id']
        self.assertIn(pk, self.ids(self.rescuer))
        self.assertNotIn(pk, self.ids(self.citizen, tab='all'))
        self.assertEqual(self.client.get(f'/communications/alerts/{pk}/').status_code, 404)
        self.assertEqual(self.client.post(f'/communications/alerts/{pk}/read/', {'publication': 1}).status_code, 404)
        self.assertEqual(self.client.post(f'/communications/alerts/{pk}/vote/', {'verdict': 'TRUE'}).status_code, 404)
        self.assertNotIn(pk, self.ids())

    def test_citizen_only_does_not_reach_rescuer(self):
        item = self.alert(audience='CITIZEN')
        self.assertIn(str(item.pk), self.ids(self.citizen))
        self.assertNotIn(str(item.pk), self.ids(self.rescuer))
        self.assertNotIn(str(item.pk), self.ids())

    def test_mission_zone_overrides_rescuer_home_and_gps(self):
        Mission.objects.create(rescuer=self.rescuer, zone=self.remote, status='ACTIVE')
        home = self.alert(zone=self.local)
        mission = self.alert(zone=self.remote, message_type='BROADCAST')
        results = self.ids(self.rescuer, lat=16.06, lng=108.22, tab='all')
        self.assertIn(str(mission.pk), results)
        self.assertNotIn(str(home.pk), results)
        self.assertEqual(self.client.get(f'/communications/alerts/{mission.pk}/').status_code, 200)

    def test_gps_and_address_fallback_and_no_location(self):
        local = self.alert(zone=self.local)
        remote = self.alert(zone=self.remote)
        self.assertIn(str(local.pk), self.ids(self.citizen))
        ids = self.ids(self.citizen, lat=21.02, lng=105.83)
        self.assertIn(str(remote.pk), ids)
        self.assertNotIn(str(local.pk), ids)
        self.assertNotIn(str(local.pk), self.ids(tab='all'))
        response = self.client.get('/communications/alerts/', {'lat': 'nan', 'lng': 10})
        self.assertEqual(response.status_code, 400)

    def test_revoked_expired_and_deleted_are_not_readable(self):
        revoked = self.alert(is_active=False)
        expired = self.alert(expires_at=timezone.now() - timedelta(seconds=1))
        for user in [self.citizen, self.rescuer, None]:
            ids = self.ids(user, tab='all')
            for item in [revoked, expired]:
                self.assertNotIn(str(item.pk), ids)
                self.assertEqual(self.client.get(f'/communications/alerts/{item.pk}/').status_code, 404)
        self.assertIn(str(revoked.pk), self.ids(self.admin, tab='all'))
        self.client.force_authenticate(self.citizen)
        self.assertEqual(self.client.post(f'/communications/alerts/{expired.pk}/read/', {'publication': 1}).status_code, 404)

    def test_write_permissions_and_validation(self):
        item = self.alert()
        self.client.force_authenticate(self.citizen)
        self.assertEqual(self.client.put(f'/communications/alerts/{item.pk}/', {'is_active': False}).status_code, 403)
        self.assertEqual(self.client.delete(f'/communications/alerts/{item.pk}/').status_code, 403)
        self.client.force_authenticate(self.admin)
        response = self.client.post('/communications/alerts/create/', {
            'title': 'Tin', 'description': 'Nội dung', 'audience': 'INVALID',
        })
        self.assertEqual(response.status_code, 400)
        response = self.client.put(f'/communications/alerts/{item.pk}/', {
            'expires_at': (timezone.now() - timedelta(days=1)).isoformat(),
        })
        self.assertEqual(response.status_code, 400)

    def test_read_is_idempotent_and_republish_requires_new_read(self):
        item = self.alert()
        self.client.force_authenticate(self.citizen)
        url = f'/communications/alerts/{item.pk}/read/'
        for _ in range(2):
            self.assertEqual(self.client.post(url, {'publication': 1}, format='json').status_code, 200)
        self.assertEqual(AlertRead.objects.count(), 1)
        response = self.client.get('/communications/alerts/')
        self.assertTrue(response.data['results'][0]['is_read'])
        self.assertIsNone(response.data['results'][0]['delivery_status'])
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/communications/alerts/{item.pk}/')
        self.assertEqual(response.data['delivery_status']['read_count'], 1)
        self.client.put(f'/communications/alerts/{item.pk}/', {'is_active': False}, format='json')
        self.client.put(f'/communications/alerts/{item.pk}/', {'is_active': True}, format='json')
        self.client.force_authenticate(self.citizen)
        self.assertEqual(self.client.post(url, {'publication': 1}, format='json').status_code, 409)
        self.assertFalse(self.client.get(f'/communications/alerts/{item.pk}/').data['is_read'])

    def test_zone_delete_cannot_turn_local_alert_into_global(self):
        self.alert(zone=self.local)
        with self.assertRaises(ProtectedError):
            self.local.delete()

    def test_old_ai_category_survives_revocation(self):
        item = self.alert(source='AI', category='FLOOD', severity='HIGH', description='')
        self.client.force_authenticate(self.admin)
        response = self.client.put(f'/communications/alerts/{item.pk}/', {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.category, 'FLOOD')
        self.assertFalse(item.is_active)

    def test_stale_device_location_does_not_override_address(self):
        device = PushDevice.objects.create(user=self.citizen, token='ExpoPushToken[stale]',
            latitude=21.02, longitude=105.83, location_updated_at=timezone.now() - timedelta(days=2))
        home = self.alert(zone=self.local)
        remote = self.alert(zone=self.remote)
        results = self.ids(self.citizen)
        self.assertIn(str(home.pk), results)
        self.assertNotIn(str(remote.pk), results)
        self.client.post('/communications/push-devices/', {'token': device.token})
        device.refresh_from_db()
        self.assertLess(device.location_updated_at, timezone.now() - timedelta(days=1))

    def test_device_registration_reassignment_and_logout(self):
        token = 'ExponentPushToken[test-token]'
        self.client.force_authenticate(self.citizen)
        response = self.client.post('/communications/push-devices/', {'token': token, 'lat': 16.06, 'lng': 108.22})
        self.assertEqual(response.status_code, 201)
        self.client.force_authenticate(self.rescuer)
        self.assertEqual(self.client.post('/communications/push-devices/', {'token': token}).status_code, 200)
        device = PushDevice.objects.get(token=token)
        self.assertEqual(device.user, self.rescuer)
        self.assertIsNone(device.latitude)
        self.client.force_authenticate(self.citizen)
        self.client.delete('/communications/push-devices/', {'token': token}, format='json')
        device.refresh_from_db()
        self.assertTrue(device.is_active)
        self.client.force_authenticate(self.rescuer)
        self.client.delete('/communications/push-devices/', {'token': token}, format='json')
        device.refresh_from_db()
        self.assertFalse(device.is_active)

    @override_settings(EXPO_PUSH_ENABLED=True)
    @patch('communications.push.expo_request')
    def test_push_enforces_scope_deduplicates_and_records_receipts(self, send):
        send.return_value = {'data': {'status': 'ok', 'id': 'ticket-1'}}
        PushDevice.objects.create(user=self.citizen, token='ExpoPushToken[citizen]')
        device = PushDevice.objects.create(user=self.rescuer, token='ExpoPushToken[rescuer]')
        item = self.alert(audience='RESCUER', message_type='EMERGENCY')
        process_push()
        process_push()
        self.assertEqual(send.call_count, 1)
        delivery = PushDelivery.objects.get()
        self.assertEqual(delivery.device, device)
        self.assertEqual(delivery.status, 'ACCEPTED')
        self.assertNotIn(item.description, send.call_args.args[1]['body'])
        PushDelivery.objects.filter(pk=delivery.pk).update(next_attempt_at=timezone.now())
        send.return_value = {'data': {'ticket-1': {'status': 'ok'}}}
        check_receipts()
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'RECEIPT_OK')

    @patch('communications.push.expo_request')
    def test_queued_push_cancelled_on_revocation_or_account_change(self, send):
        device = PushDevice.objects.create(user=self.rescuer, token='ExpoPushToken[rescuer]')
        item = self.alert(is_active=False)
        delivery = PushDelivery.objects.create(alert=item, device=device, recipient=self.rescuer, publication=1)
        send_pending()
        send.assert_not_called()
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'CANCELLED')
        item.is_active = True
        item.save()
        PushDelivery.objects.filter(pk=delivery.pk).update(status='PENDING')
        device.user = self.citizen
        device.save()
        send_pending()
        send.assert_not_called()

    @patch('communications.push.expo_request')
    def test_dead_device_disabled_and_network_timeout_not_reported_delivered(self, send):
        device = PushDevice.objects.create(user=self.rescuer, token='ExpoPushToken[rescuer]')
        item = self.alert()
        delivery = PushDelivery.objects.create(alert=item, device=device, recipient=self.rescuer, publication=1)
        send.side_effect = TimeoutError()
        send_pending()
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'UNKNOWN')
        send.side_effect = None
        send.return_value = {'data': {'status': 'error', 'details': {'error': 'DeviceNotRegistered'}}}
        PushDelivery.objects.filter(pk=delivery.pk).update(status='PENDING')
        send_pending()
        device.refresh_from_db()
        self.assertFalse(device.is_active)
