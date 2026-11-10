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

    def test_bulk_offline_sync_ble_packets(self):
        # 16-bytes packet: Header 0x4750, SOS_ID: 88412, 4 people (elderly + injury), sev 3, lat 16.0544, lng 108.2022
        # Hex: 47500001595C250341806F6D42D86788
        payload = {
            'device_id': 'cano_rescuer_03',
            'packets': [
                {
                    'hex_packet': '47500001595C250341806F6D42D86788',
                    'rssi': -64,
                    'status': 'RESOLVED',
                    'note': 'Đã cứu hộ an toàn bằng ca-nô số 03',
                }
            ]
        }
        resp = self.client.post('/rescue_operations/sos/bulk-offline-sync/', data=payload, content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['status'], 'SUCCESS')
        self.assertEqual(data['synced_count'], 1)
        item = data['synced_items'][0]
        self.assertEqual(item['ble_sos_id'], 88412)
        self.assertEqual(item['status'], 'RESOLVED')
        self.assertEqual(item['people_count'], 4)

