from unittest.mock import patch
from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from accounts.models import User
from rescue_operations.models import SOSSignal, Zone
from reporting.models import Mission, Resource, SupportRequest


class RescueFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin', phone='100', role='ADMIN')
        self.team = User.objects.create_user(username='team', phone='101', role='RESCUER')
        self.other = User.objects.create_user(username='other', phone='102', role='RESCUER')
        self.citizen = User.objects.create_user(username='citizen', phone='103', role='CITIZEN')
        self.zone = Zone.objects.create(name='Test zone', location_lat=16, location_lng=108,
            rescuers_needed=3, status='ACTIVE')
        self.payload = dict(location_lat='16.0000000', location_lng='108.0000000',
            people_count=2, emergency_type='RESCUE', phone='', note='Need help')

    def submit(self):
        key = self.client.get('/rescue_operations/sos/draft/').data['tracking_key']
        with patch('ai.clustering.run_clustering'):
            result = self.client.post('/rescue_operations/sos/create/', self.payload, format='json', HTTP_X_SOS_KEY=key)
        self.assertEqual(result.status_code, 201, result.data)
        return result.data['id'], key

    def resources(self, team=None):
        self.client.force_authenticate(team or self.team)
        response = self.client.put('/reporting/resources/current/', {
            'vehicle_type': 'Thuyền', 'vehicle_count': 1, 'number_staff': 3,
            'specialties': ['RESCUE'], 'supplies': {'water': 5}, 'is_available': True}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def new_mission(self, actor=None):
        self.resources()
        self.sos = SOSSignal.objects.create(zone=self.zone, citizen=self.citizen, location_lat=16, location_lng=108)
        self.client.force_authenticate(actor or self.team)
        response = self.client.post('/reporting/missions/create/', {'rescuer': str(self.team.pk),
            'zone': str(self.zone.pk), 'sos_ids': [str(self.sos.pk)]}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['id']

    def action(self, mid, action, **kwargs):
        return self.client.post(f'/reporting/missions/{mid}/', {'action': action, **kwargs}, format='json')

    def test_guest_retry_and_private_tracking(self):
        sid, key = self.submit()
        retry = self.client.post('/rescue_operations/sos/create/', self.payload, format='json', HTTP_X_SOS_KEY=key)
        self.assertEqual(retry.data['id'], sid)
        self.assertEqual(SOSSignal.objects.count(), 1)
        self.assertEqual(self.client.get('/rescue_operations/sos/').status_code, 403)
        self.assertEqual(self.client.get(f'/rescue_operations/sos/{sid}/').status_code, 403)
        self.assertEqual(self.client.get(f'/rescue_operations/sos/{sid}/', HTTP_X_SOS_KEY=key).status_code, 200)
        self.assertNotIn('request_key', retry.data)
        restored = self.client.get('/rescue_operations/sos/draft/', HTTP_X_SOS_KEY=key)
        self.assertEqual(restored.data['sos']['id'], sid)

    def test_wrong_guest_key_rejected(self):
        self.assertEqual(self.client.post('/rescue_operations/sos/create/', self.payload).status_code, 403)
        sid, key = self.submit()
        wrong = self.client.get('/rescue_operations/sos/draft/').data['tracking_key']
        self.assertEqual(self.client.get(f'/rescue_operations/sos/{sid}/', HTTP_X_SOS_KEY=wrong).status_code, 403)

    def test_cancel_keeps_history_and_requires_reason(self):
        sid, key = self.submit()
        path = f'/rescue_operations/sos/{sid}/'
        self.assertEqual(self.client.delete(path, HTTP_X_SOS_KEY=key).status_code, 400)
        self.assertEqual(self.client.post(path, {'action': 'cancel'}, HTTP_X_SOS_KEY=key).status_code, 400)
        result = self.client.post(path, {'action': 'cancel', 'message': 'No longer needed'}, HTTP_X_SOS_KEY=key)
        self.assertEqual(result.data['status'], 'CANCELLED')
        self.assertEqual(len(result.data['events']), 2)
        self.assertTrue(SOSSignal.objects.filter(pk=sid).exists())

    def test_verification_and_owner_response(self):
        sid, key = self.submit()
        path = f'/rescue_operations/sos/{sid}/'
        bad = self.client.post(path, {'action': 'verify', 'message': 'fake', 'verification_status': 'VERIFIED'}, HTTP_X_SOS_KEY=key)
        self.assertEqual(bad.status_code, 403)
        self.client.force_authenticate(self.admin)
        response = self.client.post(path, {'action': 'request_info', 'message': 'Please describe access'})
        self.assertEqual(response.status_code, 200)
        self.client.force_authenticate(None)
        response = self.client.post(path, {'action': 'update', 'message': 'Second floor'}, HTTP_X_SOS_KEY=key)
        self.assertEqual(len(response.data['events']), 3)

    def test_citizen_cannot_forge_owner_or_role(self):
        self.client.force_authenticate(self.citizen)
        self.payload['citizen'] = str(self.other.pk)
        sid, key = self.submit()
        self.assertEqual(SOSSignal.objects.get(pk=sid).citizen_id, self.citizen.pk)
        escalation = self.client.put(f'/accounts/profiles/{self.citizen.pk}/', {'role': 'ADMIN'})
        self.assertEqual(escalation.status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f'/rescue_operations/sos/{sid}/', {'action':'cancel', 'message':'forged'}).status_code, 403)

    def test_resources_update_not_sum_and_persist_supplies(self):
        self.resources()
        self.resources()
        self.assertEqual(Resource.objects.filter(rescuer=self.team).count(), 1)
        response = self.client.get('/reporting/resources/current/')
        self.assertEqual(response.data['resource']['supplies'], {'water': 5})
        self.assertEqual(response.data['resource']['specialties'], ['RESCUE'])

    def test_mission_lifecycle_and_sos_events(self):
        mid = self.new_mission(self.admin)
        self.assertEqual(Mission.objects.get(pk=mid).status, 'PENDING_ACCEPTANCE')
        self.client.force_authenticate(self.team)
        self.assertEqual(self.action(mid, 'complete', message='too early').status_code, 400)
        for expected in ['ACCEPTED','ON_MY_WAY','ACTIVE']:
            response = self.action(mid, 'next')
            self.assertEqual(response.data['status'], expected, response.data)
        self.assertEqual(self.action(mid, 'complete', message='still open').status_code, 400)
        self.assertEqual(self.action(mid, 'resolve_sos', sos_id=str(self.sos.pk), message='Helped two people').status_code, 200)
        self.assertEqual(self.action(mid, 'complete', message='Completed rescue').data['status'], 'COMPLETED')
        self.sos.refresh_from_db()
        self.assertEqual(self.sos.status, 'RESOLVED')
        self.assertGreaterEqual(self.sos.events.count(), 4)

    def test_second_mission_and_resource_edits_blocked(self):
        mid = self.new_mission()
        result = self.client.post('/reporting/missions/create/', {'zone':str(self.zone.pk)}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assertEqual(self.client.put('/reporting/resources/current/', {'number_staff':10}, format='json').status_code, 400)
        resource = Resource.objects.get(rescuer=self.team)
        self.assertEqual(self.client.put(f'/reporting/resources/{resource.pk}/', {'number_staff':10}).status_code, 400)

    def test_wrong_team_cannot_change_mission(self):
        mid = self.new_mission()
        self.client.force_authenticate(self.other)
        self.assertEqual(self.action(mid, 'next').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.patch(f'/reporting/missions/{mid}/complete/').status_code, 401)

    def test_handover_returns_unresolved_sos_to_queue(self):
        mid = self.new_mission()
        self.assertEqual(self.action(mid, 'leave').status_code, 400)
        self.assertEqual(self.action(mid, 'leave', message='Vehicle unavailable').status_code, 200)
        self.sos.refresh_from_db()
        self.assertIsNone(self.sos.assigned_mission_id)
        self.assertEqual(self.sos.status, 'PENDING')
        self.assertFalse(self.client.get('/reporting/resources/current/').data['reserved'])

    def test_support_does_not_change_main_status(self):
        mid = self.new_mission()
        self.action(mid, 'next')
        self.action(mid, 'next')
        response = self.action(mid, 'support', resource_type='Thuyền', quantity=1, message='Need another boat')
        self.assertEqual(response.data['status'], 'ACTIVE')
        self.assertEqual(SupportRequest.objects.count(), 1)
        self.resources(self.other)
        sid = SupportRequest.objects.get().pk
        response = self.client.post('/reporting/support/', {'id':sid})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['sos'], [])
        self.sos.refresh_from_db()
        self.assertEqual(str(self.sos.assigned_mission_id), str(mid))
        supporting_id = response.data['id']
        self.sos.supplies_needed = {'water': 1}
        self.sos.save(update_fields=['supplies_needed'])
        self.action(supporting_id, 'next')
        self.action(supporting_id, 'next')
        delivered = self.action(supporting_id, 'deliver_supplies', sos_id=str(self.sos.pk), supplies_delivered={'water': 1})
        self.assertEqual(delivered.status_code, 200, delivered.data)
        self.assertEqual(self.action(supporting_id, 'leave', message='Boat unavailable').status_code, 200)
        support = SupportRequest.objects.get(pk=sid)
        self.assertEqual(support.status, 'OPEN')
        self.assertIsNone(support.supporting_mission_id)
        self.client.force_authenticate(self.team)
        self.assertEqual(self.action(mid, 'leave', message='Hand over rescue').status_code, 200)
        support.refresh_from_db()
        self.assertEqual(support.status, 'CLOSED')

    def test_admin_can_dispatch_a_support_request_to_a_specific_team(self):
        mid = self.new_mission()
        self.action(mid, 'next')
        self.action(mid, 'next')
        self.action(mid, 'support', resource_type='Thuyền', quantity=1, message='Cần thêm một xuồng')
        support = SupportRequest.objects.get()
        self.resources(self.other)
        self.client.force_authenticate(self.admin)
        response = self.client.post('/reporting/support/', {
            'id': str(support.pk), 'rescuer': str(self.other.pk),
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], 'PENDING_ACCEPTANCE')
        self.assertEqual(str(response.data['rescuer']), str(self.other.pk))
        support.refresh_from_db()
        self.assertEqual(support.status, 'ACCEPTED')

    def test_invalid_coordinates_and_counts(self):
        key = self.client.get('/rescue_operations/sos/draft/').data['tracking_key']
        for override in [{'location_lat':91}, {'people_count':0}]:
            response = self.client.post('/rescue_operations/sos/create/', {**self.payload, **override}, format='json', HTTP_X_SOS_KEY=key)
            self.assertEqual(response.status_code, 400)

    def test_still_need_help_reopens_and_preserves_history(self):
        mid = self.new_mission()
        self.action(mid, 'next'); self.action(mid, 'next')
        self.action(mid, 'resolve_sos', sos_id=str(self.sos.pk), message='Helped')
        self.client.force_authenticate(self.citizen)
        response = self.client.post(f'/rescue_operations/sos/{self.sos.pk}/', {'action':'still_need_help','message':'Need more assistance'})
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertIsNone(response.data['assigned_rescuer'])

    def test_multiple_teams_can_join_same_zone(self):
        # Đội 1 tham gia zone
        self.resources(self.team)
        self.client.force_authenticate(self.team)
        res1 = self.client.post('/reporting/missions/create/', {'zone': str(self.zone.pk)}, format='json')
        self.assertEqual(res1.status_code, 201)

        # Đội 2 cũng tham gia cùng zone thành công
        self.resources(self.other)
        self.client.force_authenticate(self.other)
        res2 = self.client.post('/reporting/missions/create/', {'zone': str(self.zone.pk)}, format='json')
        self.assertEqual(res2.status_code, 201)

        # Cả 2 đội đều có mission ACTIVE/ACCEPTED tại zone
        self.assertEqual(Mission.objects.filter(zone=self.zone, status__in=['ACCEPTED', 'ACTIVE']).count(), 2)

    def test_claim_specific_sos_and_locking(self):
        sos1 = SOSSignal.objects.create(zone=self.zone, citizen=self.citizen, location_lat=16, location_lng=108)
        sos2 = SOSSignal.objects.create(zone=self.zone, citizen=self.citizen, location_lat=16, location_lng=108)

        # Đội 1 vào zone và nhận sos1
        self.resources(self.team)
        self.client.force_authenticate(self.team)
        m1_id = self.client.post('/reporting/missions/create/', {'zone': str(self.zone.pk)}, format='json').data['id']
        claim1 = self.action(m1_id, 'claim_sos', sos_id=str(sos1.pk))
        self.assertEqual(claim1.status_code, 200)
        sos1.refresh_from_db()
        self.assertEqual(str(sos1.assigned_mission_id), str(m1_id))

        # Đội 2 vào zone và thử nhận sos1 (đã có đội 1 nhận) -> Phải bị từ chối
        self.resources(self.other)
        self.client.force_authenticate(self.other)
        m2_id = self.client.post('/reporting/missions/create/', {'zone': str(self.zone.pk)}, format='json').data['id']
        claim_blocked = self.action(m2_id, 'claim_sos', sos_id=str(sos1.pk))
        self.assertEqual(claim_blocked.status_code, 400)

        # Nhưng Đội 2 nhận sos2 thì thành công
        claim2 = self.action(m2_id, 'claim_sos', sos_id=str(sos2.pk))
        self.assertEqual(claim2.status_code, 200)
        sos2.refresh_from_db()
        self.assertEqual(str(sos2.assigned_mission_id), str(m2_id))

    def test_claim_requires_explicit_sos(self):
        sos = SOSSignal.objects.create(zone=self.zone, citizen=self.citizen, location_lat=16, location_lng=108)
        self.resources(self.team)
        self.client.force_authenticate(self.team)
        mission_id = self.client.post('/reporting/missions/create/', {'zone': str(self.zone.pk)}, format='json').data['id']
        response = self.action(mission_id, 'claim_sos')
        self.assertEqual(response.status_code, 400)
        sos.refresh_from_db()
        self.assertIsNone(sos.assigned_mission_id)

    def test_zone_cannot_close_while_work_is_open(self):
        self.sos = SOSSignal.objects.create(zone=self.zone, citizen=self.citizen, location_lat=16, location_lng=108)
        self.client.force_authenticate(self.admin)
        response = self.client.put(f'/rescue_operations/zones/{self.zone.pk}/', {'status': 'RESOLVED'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.sos.status = 'RESOLVED'
        self.sos.save(update_fields=['status'])
        response = self.client.put(f'/rescue_operations/zones/{self.zone.pk}/', {'status': 'RESOLVED'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_incorrect_sos_is_removed_from_zone_and_assignment(self):
        mission_id = self.new_mission(self.admin)
        self.client.force_authenticate(self.admin)
        response = self.client.post(f'/rescue_operations/sos/{self.sos.pk}/', {
            'action': 'verify', 'verification_status': 'INCORRECT', 'message': 'Thông tin không chính xác',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.sos.refresh_from_db()
        self.zone.refresh_from_db()
        self.assertEqual(self.sos.status, 'CANCELLED')
        self.assertIsNone(self.sos.zone_id)
        self.assertIsNone(self.sos.assigned_mission_id)
        self.assertEqual(self.zone.people_affected, 0)
        self.assertTrue(Mission.objects.get(pk=mission_id).events.filter(message__icontains='không chính xác').exists())

    def test_deliver_supplies_recording(self):
        self.resources(self.team)
        resource = Resource.objects.get(rescuer=self.team)
        resource.supplies = {'food': 3, 'water': 5}
        resource.save(update_fields=['supplies'])
        self.sos = SOSSignal.objects.create(zone=self.zone, citizen=self.citizen, location_lat=16, location_lng=108,
                                            supplies_needed={'food': 5, 'water': 10})
        self.client.force_authenticate(self.team)
        mid = self.client.post('/reporting/missions/create/', {'zone': str(self.zone.pk), 'sos_ids': [str(self.sos.pk)]}, format='json').data['id']
        self.action(mid, 'next') # ON_MY_WAY
        self.action(mid, 'next') # ACTIVE

        deliver_res = self.action(mid, 'deliver_supplies', sos_id=str(self.sos.pk), supplies_delivered={'food': 2, 'water': 4}, message='Giao lương thực đợt 1')
        self.assertEqual(deliver_res.status_code, 200)
        self.sos.refresh_from_db()
        self.assertEqual(self.sos.supplies_delivered, {'food': 2, 'water': 4})
        resource.refresh_from_db()
        self.assertEqual(resource.supplies, {'food': 1, 'water': 1})

    def test_admin_dispatches_single_sos_without_creating_zone(self):
        self.resources(self.team)
        single = SOSSignal.objects.create(citizen=self.citizen, location_lat=16, location_lng=108)
        self.client.force_authenticate(self.admin)
        response = self.client.post('/reporting/missions/create/', {
            'rescuer': str(self.team.pk), 'sos_ids': [str(single.pk)], 'role': 'Cứu hộ ca đơn lẻ'
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data['zone'])
        single.refresh_from_db()
        self.assertEqual(str(single.assigned_mission_id), str(response.data['id']))

    def test_admin_can_move_and_detach_unassigned_sos(self):
        single = SOSSignal.objects.create(citizen=self.citizen, location_lat=16, location_lng=108)
        self.client.force_authenticate(self.admin)
        moved = self.client.post('/rescue_operations/zones/manage/', {
            'action': 'move_sos', 'target_zone': str(self.zone.pk), 'sos_ids': [str(single.pk)]
        }, format='json')
        self.assertEqual(moved.status_code, 200, moved.data)
        single.refresh_from_db()
        self.assertEqual(single.zone_id, self.zone.pk)
        detached = self.client.post('/rescue_operations/zones/manage/', {
            'action': 'detach_sos', 'sos_ids': [str(single.pk)]
        }, format='json')
        self.assertEqual(detached.status_code, 200, detached.data)
        single.refresh_from_db()
        self.assertIsNone(single.zone_id)

    def test_admin_can_merge_an_idle_zone(self):
        source = Zone.objects.create(name='Source', location_lat=16.01, location_lng=108.01)
        signal = SOSSignal.objects.create(zone=source, citizen=self.citizen, location_lat=16.01, location_lng=108.01)
        self.client.force_authenticate(self.admin)
        response = self.client.post('/rescue_operations/zones/manage/', {
            'action': 'merge_zones', 'source_zone_ids': [str(source.pk)], 'target_zone': str(self.zone.pk)
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        signal.refresh_from_db()
        self.assertEqual(signal.zone_id, self.zone.pk)
        self.assertFalse(Zone.objects.filter(pk=source.pk).exists())

    def test_admin_updates_supply_need_and_overdelivery_is_blocked(self):
        self.sos = SOSSignal.objects.create(zone=self.zone, citizen=self.citizen, location_lat=16, location_lng=108)
        self.client.force_authenticate(self.admin)
        response = self.client.post(f'/rescue_operations/sos/{self.sos.pk}/', {
            'action': 'update_supplies_needed', 'supplies_needed': {'water': 2}, 'message': 'Cần nước'
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.resources(self.team)
        self.client.force_authenticate(self.team)
        mid = self.client.post('/reporting/missions/create/', {'zone': str(self.zone.pk), 'sos_ids': [str(self.sos.pk)]}, format='json').data['id']
        self.action(mid, 'next'); self.action(mid, 'next')
        blocked = self.action(mid, 'deliver_supplies', sos_id=str(self.sos.pk), supplies_delivered={'water': 3})
        self.assertEqual(blocked.status_code, 400)

    def test_zone_and_compact_sos_lists_do_not_add_queries_per_row(self):
        for index in range(12):
            SOSSignal.objects.create(zone=self.zone, citizen=self.citizen,
                location_lat=16, location_lng=108, note=f'SOS {index}')
        self.client.force_authenticate(self.admin)
        with CaptureQueriesContext(connection) as zone_queries:
            zone_response = self.client.get('/rescue_operations/zones/?limit=100')
        with CaptureQueriesContext(connection) as sos_queries:
            sos_response = self.client.get('/rescue_operations/sos/?include_images=0&limit=100')
        self.assertEqual(zone_response.status_code, 200)
        self.assertEqual(sos_response.status_code, 200)
        self.assertLessEqual(len(zone_queries), 3)
        self.assertLessEqual(len(sos_queries), 3)
