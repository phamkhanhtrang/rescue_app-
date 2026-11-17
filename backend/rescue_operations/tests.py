from django.test import TestCase, Client
from django.utils import timezone
from datetime import timedelta
from .models import CrowdReport, CrowdReportVote
from .views import _auto_expire_stale_reports


class RoadVoteUpgradeTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_preview_road_segment_api(self):
        # Test preview road endpoint with lat/lng
        resp = self.client.get('/rescue_operations/field-reports/preview-road/?lat=16.0678&lng=108.2208')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('road_geometry', data)
        self.assertGreaterEqual(len(data['road_geometry']), 2)
        self.assertIn('center_lat', data)
        self.assertIn('center_lng', data)

    def test_field_report_create_auto_road_and_ttl(self):
        # Create a report with single GPS coordinate and address
        payload = {
            'reporter_name': 'Nguyễn Văn A',
            'voter_id': 'dev_test_citizen_1',
            'hazard_type': 'FLOOD',
            'water_level_cm': 50,
            'location_lat': 16.0678,
            'location_lng': 108.2208,
            'address': 'Đường Hàm Nghi, Đà Nẵng',
            'description': 'Đoạn ngập sâu ngang gối',
        }
        resp = self.client.post('/rescue_operations/field-reports/create/', data=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data['status'], 'PENDING')
        self.assertFalse(data['is_hidden'])
        self.assertIsNotNone(data['expires_at'])
        self.assertIsNotNone(data['remaining_minutes'])
        self.assertGreater(data['remaining_minutes'], 0)
        self.assertGreaterEqual(len(data['road_geometry']), 2)

    def test_auto_expire_stale_reports(self):
        # Create a PENDING report that expired 4 hours ago
        rep = CrowdReport.objects.create(
            reporter_name='Người dân cũ',
            hazard_type='FLOOD',
            location_lat=16.06,
            location_lng=108.22,
            status='PENDING',
            is_hidden=False,
            expires_at=timezone.now() - timedelta(minutes=10),
        )
        self.assertFalse(rep.is_hidden)

        # Run auto-expire check
        _auto_expire_stale_reports()
        rep.refresh_from_db()
        self.assertTrue(rep.is_hidden)
        self.assertEqual(rep.status, 'EXPIRED')

    def test_admin_hide_and_unhide(self):
        rep = CrowdReport.objects.create(
            reporter_name='Người dân',
            hazard_type='FLOOD',
            location_lat=16.0678,
            location_lng=108.2208,
            status='VERIFIED',
            is_verified=True,
            is_hidden=False,
            expires_at=timezone.now() + timedelta(hours=5),
        )

        # Admin sends HIDE
        resp_hide = self.client.post(f'/rescue_operations/field-reports/{rep.id}/vote/', data={
            'verdict': 'HIDE',
            'voter_role': 'ADMIN',
        })
        self.assertEqual(resp_hide.status_code, 200)
        rep.refresh_from_db()
        self.assertTrue(rep.is_hidden)

        # Hidden reports should not be in default field_report_list
        list_resp = self.client.get('/rescue_operations/field-reports/')
        self.assertEqual(list_resp.status_code, 200)
        ids = [item['id'] for item in list_resp.json()['results']]
        self.assertNotIn(str(rep.id), ids)

        # Admin sends UNHIDE
        resp_unhide = self.client.post(f'/rescue_operations/field-reports/{rep.id}/vote/', data={
            'verdict': 'UNHIDE',
            'voter_role': 'ADMIN',
        })
        self.assertEqual(resp_unhide.status_code, 200)
        rep.refresh_from_db()
        self.assertFalse(rep.is_hidden)

    def test_vote_deduplication_and_majority_logic(self):
        # Create a report with 3 danger votes
        rep = CrowdReport.objects.create(
            reporter_name='Dân 1',
            hazard_type='FLOOD',
            location_lat=16.0678,
            location_lng=108.2208,
            status='VERIFIED',
            is_verified=True,
            is_hidden=False,
            expires_at=timezone.now() + timedelta(hours=6),
        )
        # 3 different citizens vote danger
        for i in range(1, 4):
            self.client.post(f'/rescue_operations/field-reports/{rep.id}/vote/', data={
                'verdict': 'CONFIRM_DANGER',
                'voter_name': f'Dân {i}',
                'voter_id': f'dev_citizen_{i}',
            })
        rep.refresh_from_db()
        self.assertEqual(rep.status, 'VERIFIED')

        # 1 single citizen voting CLEARED should NOT flip 3 danger votes to CLEARED
        self.client.post(f'/rescue_operations/field-reports/{rep.id}/vote/', data={
            'verdict': 'CLEARED',
            'voter_name': 'Dân 99',
            'voter_id': 'dev_citizen_99',
        })
        rep.refresh_from_db()
        # 3 danger votes > 1 cleared vote -> should remain VERIFIED or not abruptly CLEARED
        self.assertNotEqual(rep.status, 'CLEARED')


def _ble_sos_hex(sos_id, people=4, elderly=True, injury=True, severity=3, lat=16.0544, lng=108.2022, minutes=0):
    """Dựng gói SOS 0xGP v2 (20 bytes) giống hệt app di động."""
    import struct
    from .ble_protocol import crc8
    demo = (people << 3) | (1 if elderly else 0) | (4 if injury else 0)
    body = b'GP' + bytes([0x21]) + struct.pack('>I', sos_id) + bytes([demo, severity]) \
        + struct.pack('>ff', lat, lng) + struct.pack('>H', minutes)
    return (body + bytes([crc8(body)])).hex().upper()


class BleOfflineSyncTests(TestCase):
    URL = '/rescue_operations/sos/bulk-offline-sync/'
    LEGACY_HEX = '47500001595C250341806F6D42D86788'  # v1 16 bytes, SOS_ID 88412, 4 người

    def setUp(self):
        from rest_framework.test import APIClient
        from accounts.models import User
        from .models import SOSSignal
        self.SOSSignal = SOSSignal
        self.client = APIClient()
        self.rescuer = User.objects.create_user(username='ble-rescuer', phone='0900000901', role='RESCUER')
        self.citizen = User.objects.create_user(username='ble-citizen', phone='0900000902', role='CITIZEN')

    def sync(self, packets, user=None):
        self.client.force_authenticate(user=user)
        return self.client.post(self.URL, data={'device_id': 'test-device', 'packets': packets}, format='json')

    def test_anonymous_relay_creates_pending_unverified_and_cannot_resolve(self):
        resp = self.sync([{'hex_packet': _ble_sos_hex(700001), 'rssi': -64, 'status': 'RESOLVED'}])
        self.assertEqual(resp.status_code, 200)
        item = resp.json()['synced_items'][0]
        self.assertEqual(item['action'], 'CREATED')
        self.assertEqual(item['status'], 'PENDING')
        self.assertTrue(item['resolve_ignored'])
        self.assertEqual(item['people_count'], 4)
        sos = self.SOSSignal.objects.get(id=item['sos_id'])
        self.assertEqual(sos.verification_status, 'UNVERIFIED')
        self.assertEqual(sos.location_source, 'BLE_OFFLINE')
        self.assertAlmostEqual(float(sos.location_lat), 16.0544, places=4)

    def test_citizen_account_cannot_resolve(self):
        resp = self.sync([{'hex_packet': _ble_sos_hex(700002), 'status': 'RESOLVED'}], user=self.citizen)
        self.assertEqual(resp.json()['synced_items'][0]['status'], 'PENDING')

    def test_rescuer_resolves_existing_beacon_without_duplicating(self):
        self.sync([{'hex_packet': _ble_sos_hex(700003)}])
        resp = self.sync([{'hex_packet': _ble_sos_hex(700003, minutes=12), 'status': 'RESOLVED', 'note': 'Đã đưa lên ca-nô'}],
                         user=self.rescuer)
        item = resp.json()['synced_items'][0]
        self.assertEqual(item['action'], 'UPDATED')
        self.assertEqual(item['status'], 'RESOLVED')
        self.assertEqual(self.SOSSignal.objects.filter(location_source='BLE_OFFLINE').count(), 1)
        # Gói cũ tới sau không được mở lại SOS đã đóng.
        again = self.sync([{'hex_packet': _ble_sos_hex(700003)}])
        self.assertEqual(again.json()['synced_items'][0]['action'], 'UNCHANGED')
        self.assertEqual(again.json()['synced_items'][0]['status'], 'RESOLVED')

    def test_ids_sharing_a_prefix_are_distinct_beacons(self):
        resp = self.sync([{'hex_packet': _ble_sos_hex(123)}, {'hex_packet': _ble_sos_hex(1234)}])
        actions = [i['action'] for i in resp.json()['synced_items']]
        self.assertEqual(actions, ['CREATED', 'CREATED'])
        self.assertEqual(self.SOSSignal.objects.count(), 2)

    def test_corrupt_packets_are_rejected_without_blocking_valid_ones(self):
        good = _ble_sos_hex(700004)
        flipped = good[:-2] + ('00' if good[-2:] != '00' else '01')
        resp = self.sync([{'hex_packet': flipped}, {'hex_packet': 'ZZ'}, {'hex_packet': good}, 'not-a-dict'])
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['synced_count'], 1)
        self.assertEqual([r['index'] for r in data['rejected']], [0, 1, 3])
        # Toàn gói hỏng vẫn trả 200 để máy khách xoá chúng khỏi hàng đợi.
        only_bad = self.sync([{'hex_packet': flipped}])
        self.assertEqual(only_bad.status_code, 200)
        self.assertEqual(only_bad.json()['synced_count'], 0)

    def test_legacy_16_byte_packet_still_accepted(self):
        resp = self.sync([{'hex_packet': self.LEGACY_HEX, 'status': 'RESOLVED'}], user=self.rescuer)
        item = resp.json()['synced_items'][0]
        self.assertEqual(item['ble_sos_id'], 88412)
        self.assertEqual(item['status'], 'RESOLVED')
        self.assertEqual(item['people_count'], 4)

    def test_empty_or_oversized_batch_is_rejected(self):
        self.assertEqual(self.sync([]).status_code, 400)
        self.assertEqual(self.sync([{'hex_packet': 'x'}] * 201).status_code, 400)


class BleVirtualRelayTests(TestCase):
    URL = '/rescue_operations/ble-grid/packets/'

    def setUp(self):
        from django.core.cache import cache
        from rest_framework.test import APIClient
        cache.clear()
        self.client = APIClient()

    def test_disabled_outside_debug(self):
        self.assertEqual(self.client.get(self.URL, {'device_id': 'a'}).status_code, 404)

    def test_packets_are_visible_to_other_devices_only(self):
        from django.test import override_settings
        hex_packet = _ble_sos_hex(800001)
        with override_settings(BLE_VIRTUAL_RELAY_ENABLED=True):
            resp = self.client.post(self.URL, {'device_id': 'phone-a', 'slot': 'sos', 'hex': hex_packet}, format='json')
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(self.client.get(self.URL, {'device_id': 'phone-a'}).json()['packets'], [])
            seen = self.client.get(self.URL, {'device_id': 'phone-b'}).json()['packets']
            self.assertEqual([p['hex'] for p in seen], [hex_packet])
            bad = self.client.post(self.URL, {'device_id': 'phone-a', 'slot': 'tx', 'hex': 'DEADBEEF'}, format='json')
            self.assertEqual(bad.status_code, 400)
            self.client.delete(self.URL, {'device_id': 'phone-a', 'slot': 'sos'}, format='json')
            self.assertEqual(self.client.get(self.URL, {'device_id': 'phone-b'}).json()['packets'], [])

