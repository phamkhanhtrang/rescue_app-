"""Kiểm thử luồng AI: chạy nền, đọc ghi chú SOS, gom cụm, chấm điểm, phân công, hàng đợi Facebook."""
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from rescue_operations.models import SOSSignal, Zone

from . import clustering, dataset_export, evaluation, priority_scorer
from .assignment_recommender import greedy_matching, optimal_matching
from .models import CrawledArticle
from .nlp import event_matcher, geocoder
from .sos_article_analysis import geocode_prediction, suggested_fields, triage
from .sos_note_analysis import analyze_sos_note, build_analysis, extract_note_text


def sos(lat, lng, **kwargs):
    return SOSSignal.objects.create(location_lat=lat, location_lng=lng, **kwargs)


def note_prediction(**overrides):
    result = {'method': 'phobert_two_model_v1', 'model_versions': ['a', 'b'], 'is_request': True,
              'request_score': 0.9, 'needs': ['MEDICAL'], 'candidate_needs': ['MEDICAL'],
              'need_scores': {}, 'decision_sources': ['MODEL'], 'guardrail_applied': None,
              'emergency_detected': False,
              'entities': [{'label': 'VULNERABLE_GROUP', 'text': 'bà cụ'},
                           {'label': 'PEOPLE_COUNT', 'text': '3 người'}]}
    result.update(overrides)
    return result


# ─── Gom cụm ─────────────────────────────────────────────────────────────────

class ClusteringTests(TestCase):
    def test_dbscan_groups_chain_and_keeps_isolated_sos_single(self):
        # Ba điểm cách nhau ~220 m nối thành chuỗi; điểm thứ tư cách xa hàng km.
        a, b, c = sos(16.0000, 108.0), sos(16.0020, 108.0), sos(16.0040, 108.0)
        far = sos(16.1000, 108.0)
        clusters = clustering.cluster_sos_signals([a, b, c, far])
        self.assertEqual(sorted(len(x) for x in clusters), [1, 3])
        # Cách gom tham lam cũ tách chuỗi này tùy theo điểm bắt đầu.
        self.assertNotEqual(sorted(len(x) for x in clustering.greedy_cluster_sos_signals([a, b, c, far])), [1, 3])

    def test_result_does_not_depend_on_input_order(self):
        points = [sos(16.0000, 108.0), sos(16.0020, 108.0), sos(16.0040, 108.0), sos(16.1, 108.0)]

        def grouping(items):
            return sorted(sorted(str(s.pk) for s in group) for group in clustering.cluster_sos_signals(items))

        self.assertEqual(grouping(points), grouping(points[::-1]))
        self.assertEqual(grouping(points), grouping([points[1], points[3], points[0], points[2]]))

    def test_run_clustering_reports_touched_zones(self):
        sos(16.0, 108.0), sos(16.0005, 108.0)
        lone = sos(17.0, 108.0)
        stats = clustering.run_clustering()
        self.assertEqual(stats['zones_created'], 1)
        self.assertEqual(stats['zone_ids'], [str(Zone.objects.get().pk)])
        lone.refresh_from_db()
        self.assertIsNone(lone.zone_id)


# ─── Chấm điểm ưu tiên ───────────────────────────────────────────────────────

class PriorityTests(TestCase):
    def test_weights_sum_to_100(self):
        self.assertEqual(sum(priority_scorer.WEIGHTS.values()), 100)

    def test_vulnerable_and_medical_notes_raise_zone_score(self):
        zone = Zone.objects.create(name='Z', location_lat=16, location_lng=108, people_affected=4, rescuers_needed=1)
        signal = sos(16, 108, zone=zone)
        before = priority_scorer.compute_zone_score(zone)
        SOSSignal.objects.filter(pk=signal.pk).update(ai_analysis={'vulnerable_groups': ['bà cụ'], 'needs': []})
        with_vulnerable = priority_scorer.compute_zone_score(zone)
        SOSSignal.objects.filter(pk=signal.pk).update(ai_analysis={'vulnerable_groups': ['bà cụ'], 'needs': ['MEDICAL']})
        with_both = priority_scorer.compute_zone_score(zone)
        self.assertAlmostEqual(with_vulnerable - before, 6.0, places=1)
        self.assertAlmostEqual(with_both - before, 10.0, places=1)

    def test_resolved_sos_no_longer_counts_as_vulnerable(self):
        zone = Zone.objects.create(name='Z', location_lat=16, location_lng=108)
        sos(16, 108, zone=zone, status='RESOLVED', ai_analysis={'vulnerable_groups': ['trẻ nhỏ']})
        self.assertEqual(priority_scorer.zone_features(zone)['vulnerable'], 0)


# ─── Phân công ───────────────────────────────────────────────────────────────

class MatchingTests(SimpleTestCase):
    def test_hungarian_beats_greedy_when_best_pair_blocks_others(self):
        def pair(rescuer, zone, score):
            return {'rescuer_id': rescuer, 'zone_id': zone, 'match_score': score}
        # Tham lam lấy (r1, z1)=90 rồi buộc (r2, z2)=10. Tối ưu: 85 + 80.
        candidates = [pair('r1', 'z1', 90), pair('r1', 'z2', 80), pair('r2', 'z1', 85), pair('r2', 'z2', 10)]
        slots = {'z1': 1, 'z2': 1}
        self.assertEqual(sum(c['match_score'] for c in greedy_matching(candidates, slots)), 100)
        best = optimal_matching(candidates, slots)
        self.assertEqual(sum(c['match_score'] for c in best), 165)
        self.assertEqual(len({c['rescuer_id'] for c in best}), 2)

    def test_zone_slots_are_respected(self):
        candidates = [{'rescuer_id': f'r{i}', 'zone_id': 'z1', 'match_score': 50 + i} for i in range(4)]
        self.assertEqual(len(optimal_matching(candidates, {'z1': 2})), 2)
        self.assertEqual(optimal_matching(candidates, {'z1': 0}), [])


# ─── Đọc ghi chú SOS ─────────────────────────────────────────────────────────

class NoteAnalysisTests(TestCase):
    def test_strips_system_prefix(self):
        self.assertEqual(extract_note_text('[Tên: A | SĐT: 0901234567]\nNhà có bà cụ'), 'Nhà có bà cụ')
        self.assertEqual(extract_note_text('[SĐT Liên Hệ: x | SOS ẨN DANH]'), '')

    def test_flags_mismatch_but_never_rejects(self):
        result = build_analysis('Nhà có bà cụ khó thở, 3 người', note_prediction(), 'FOOD', 1)
        self.assertEqual(result['suggested_needs'], ['MEDICAL'])
        self.assertEqual(result['people_count_in_note'], 3)
        self.assertEqual(set(result['flags']), {'TYPE_MISMATCH', 'PEOPLE_COUNT_MISMATCH', 'VULNERABLE_GROUP'})

    def test_low_model_score_alone_is_not_flagged(self):
        result = build_analysis('nhà hai tầng màu xanh', note_prediction(is_request=False, needs=[], entities=[]), 'RESCUE', 1)
        self.assertEqual(result['flags'], [])

    def test_self_declared_test_message_is_flagged_for_checking(self):
        result = build_analysis('em test thử app thôi', note_prediction(is_request=False, needs=[], entities=[]), 'RESCUE', 1)
        self.assertEqual(result['flags'], ['NEEDS_CHECK'])

    @override_settings(SOS_NOTE_ANALYSIS_ENABLED=True)
    def test_saves_analysis_without_touching_status(self):
        signal = sos(16, 108, emergency_type='FOOD', people_count=1, note='Nhà có bà cụ khó thở')
        with patch('ai.sos_article_analysis.predict_article', return_value=note_prediction()):
            analyze_sos_note(signal.pk)
        signal.refresh_from_db()
        self.assertEqual(signal.ai_analysis['vulnerable_groups'], ['bà cụ'])
        self.assertEqual((signal.status, signal.verification_status), ('PENDING', 'UNVERIFIED'))

    @override_settings(SOS_NOTE_ANALYSIS_ENABLED=True)
    def test_empty_note_and_model_failure_are_recorded_not_raised(self):
        empty = sos(16, 108, note='')
        with patch('ai.sos_article_analysis.predict_article') as predict:
            self.assertEqual(analyze_sos_note(empty.pk)['status'], 'empty')
            predict.assert_not_called()
        broken = sos(16, 108, note='Cần giúp đỡ gấp')
        with patch('ai.sos_article_analysis.predict_article', side_effect=RuntimeError('offline')):
            self.assertEqual(analyze_sos_note(broken.pk)['status'], 'unavailable')

    @override_settings(SOS_NOTE_ANALYSIS_ENABLED=True)
    def test_admin_reviewed_and_ble_sos_are_not_reanalysed(self):
        reviewed = sos(16, 108, note='x' * 20, location_source='AI_CRAWL', ai_analysis={'source': 'admin_review'})
        with patch('ai.sos_article_analysis.predict_article') as predict:
            analyze_sos_note(reviewed.pk)
            predict.assert_not_called()


@override_settings(SOS_NOTE_ANALYSIS_ENABLED=True)
class IntakePipelineTests(TestCase):
    def test_new_sos_is_clustered_scored_and_note_analysed(self):
        client = APIClient()
        sos(16.0, 108.0)   # SOS có sẵn gần đó để tạo thành Zone
        key = client.get('/rescue_operations/sos/draft/').data['tracking_key']
        with patch('ai.sos_article_analysis.predict_article', return_value=note_prediction()):
            response = client.post('/rescue_operations/sos/create/', {
                'location_lat': '16.0005000', 'location_lng': '108.0000000', 'people_count': 3,
                'emergency_type': 'MEDICAL', 'note': 'Nhà có bà cụ khó thở'}, format='json', HTTP_X_SOS_KEY=key)
        self.assertEqual(response.status_code, 201, response.data)
        created = SOSSignal.objects.get(pk=response.data['id'])
        self.assertIsNotNone(created.zone_id)
        self.assertEqual(created.ai_analysis['needs'], ['MEDICAL'])
        self.assertIsNotNone(created.zone.ai_priority_score)

    def test_ai_failure_never_blocks_intake(self):
        client = APIClient()
        key = client.get('/rescue_operations/sos/draft/').data['tracking_key']
        with patch('ai.clustering.run_clustering', side_effect=RuntimeError('boom')):
            response = client.post('/rescue_operations/sos/create/', {
                'location_lat': '16.0', 'location_lng': '108.0', 'people_count': 1,
                'emergency_type': 'RESCUE'}, format='json', HTTP_X_SOS_KEY=key)
        self.assertEqual(response.status_code, 201, response.data)


# ─── Luồng Facebook ──────────────────────────────────────────────────────────

class GeocodeTests(SimpleTestCase):
    def test_parts_are_ordered_from_specific_to_broad(self):
        parts = ['huyện Hòa Vang', 'thôn 3', 'xã Hòa Tiến', 'thôn 3', 'Đà Nẵng']
        self.assertEqual(geocoder.combine_location_parts(parts),
                         ['thôn 3', 'xã Hòa Tiến', 'huyện Hòa Vang', 'Đà Nẵng'])

    @patch('ai.nlp.geocoder.time.sleep')
    def test_falls_back_to_broader_address_then_province(self, sleep):
        calls = []

        def search(query, limit=3):
            calls.append(query)
            return [{'lat': 15.9, 'lng': 108.1, 'name': query}] if query.startswith('xã') else []

        with patch('ai.nlp.geocoder._nominatim_search', side_effect=search):
            found = geocoder.geocode_address(['xã Hòa Tiến', 'thôn 3', 'huyện Hòa Vang'])
        self.assertEqual(calls, ['thôn 3, xã Hòa Tiến, huyện Hòa Vang', 'xã Hòa Tiến, huyện Hòa Vang'])
        self.assertEqual((found['precision'], found['matched_query']), ('address', 'xã Hòa Tiến, huyện Hòa Vang'))

        with patch('ai.nlp.geocoder._nominatim_search', return_value=[]):
            found = geocoder.geocode_address(['thôn 3', 'Quảng Nam'])
        self.assertEqual(found['precision'], 'province')

    def test_multiple_location_spans_are_geocoded_as_one_address(self):
        result = {'entities': [{'label': 'LOCATION', 'text': 'xã Hòa Tiến'}, {'label': 'LOCATION', 'text': 'thôn 3'}]}
        self.assertEqual(suggested_fields(dict(result, needs=[]))['extracted_address'], 'thôn 3, xã Hòa Tiến')
        with patch('ai.nlp.geocoder._nominatim_search', return_value=[{'lat': 15.9, 'lng': 108.1, 'name': 'x'}]):
            lat, lng = geocode_prediction(result)
        self.assertEqual((float(lat), float(lng)), (15.9, 108.1))
        self.assertEqual(result['geocode']['query'], 'thôn 3, xã Hòa Tiến')


class TriageTests(SimpleTestCase):
    def test_levels(self):
        self.assertEqual(triage({'emergency_detected': True, 'is_request': False})['level'], 'URGENT')
        self.assertEqual(triage({'is_request': True, 'request_score': 0.9, 'needs': ['RESCUE']})['level'], 'URGENT')
        self.assertEqual(triage({'is_request': True, 'request_score': 0.5, 'needs': ['SUPPLY']})['level'], 'NORMAL')
        self.assertEqual(triage({'is_request': False})['level'], 'LOW')


class EventMatchTests(TestCase):
    def test_phone_formats_are_normalised(self):
        self.assertEqual(event_matcher.normalize_phone('+84 901 234 567'), '0901234567')
        self.assertEqual(event_matcher.phones_in('gọi 0901.234.567 giúp em'), {'0901234567'})
        self.assertEqual(event_matcher.normalize_phone('12345'), '')

    def test_same_phone_links_to_open_sos_only(self):
        open_sos = sos(16, 108, contact_phone='0901234567', note='nhà ngập')
        match, reason = event_matcher.find_matching_sos('Cứu với, sđt 0901 234 567')
        self.assertEqual((match, reason), (open_sos, 'phone'))
        SOSSignal.objects.filter(pk=open_sos.pk).update(status='RESOLVED')
        self.assertEqual(event_matcher.find_matching_sos('Cứu với, sđt 0901 234 567'), (None, ''))

    def test_nearby_similar_text_links_but_nearby_different_text_does_not(self):
        text = 'Nhà em ở thôn 3 nước lên tới nóc, có mẹ già không đi được, cần thuyền gấp'
        target = sos(16.0, 108.0, note=text + ' ạ, mọi người giúp với')
        self.assertEqual(event_matcher.find_matching_sos(text[:60] + ' cứu em với', lat=16.0003, lng=108.0)[0], target)
        self.assertEqual(event_matcher.find_matching_sos('Cần mì tôm và nước uống cho xóm', lat=16.0003, lng=108.0), (None, ''))

    def test_old_sos_is_ignored(self):
        old = sos(16, 108, contact_phone='0901234567')
        SOSSignal.objects.filter(pk=old.pk).update(sent_at=timezone.now() - timedelta(hours=30))
        self.assertEqual(event_matcher.find_matching_sos('sđt 0901234567'), (None, ''))


class FacebookQueueTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user(username='adm', phone='900', role='ADMIN'))

    def article(self, n, level=None, **kwargs):
        analysis = {'triage': {'level': level}} if level else {}
        article = CrawledArticle.objects.create(
            source_platform='FACEBOOK', source_url=f'https://example.org/{n}', raw_content=f'Bài {n}',
            content_hash=f'h{n}', status='ANALYZED', ai_analysis=analysis, **kwargs)
        # Bài số lớn hơn được crawl muộn hơn (auto_now_add có thể trùng mili-giây).
        CrawledArticle.objects.filter(pk=article.pk).update(crawled_at=timezone.now() + timedelta(minutes=n))
        return article

    def test_pending_facebook_queue_puts_urgent_first_and_keeps_low(self):
        low, normal, old, urgent = self.article(1, 'LOW'), self.article(2, 'NORMAL'), self.article(3), self.article(4, 'URGENT')
        data = self.client.get('/ai/crawled/', {'status': 'ANALYZED', 'platform': 'FACEBOOK'}).data
        self.assertEqual([r['id'] for r in data['results']], [urgent.pk, old.pk, normal.pk, low.pk])
        self.assertEqual([r['triage_level'] for r in data['results']], ['URGENT', 'NORMAL', 'NORMAL', 'LOW'])
        newest = self.client.get('/ai/crawled/', {'status': 'ANALYZED', 'platform': 'FACEBOOK', 'sort': 'newest'}).data
        self.assertEqual(newest['results'][0]['id'], urgent.pk)
        self.assertEqual(newest['results'][-1]['id'], low.pk)

    def test_reject_records_negative_label_only_when_confirmed(self):
        plain, negative = self.article(1), self.article(2)
        self.client.post(f'/ai/crawled/{plain.pk}/review/', {'action': 'reject', 'reason': 'Tin cũ'}, format='json')
        self.client.post(f'/ai/crawled/{negative.pk}/review/',
                         {'action': 'reject', 'reason': 'Quảng cáo', 'not_a_request': True}, format='json')
        plain.refresh_from_db(), negative.refresh_from_db()
        self.assertEqual(plain.reviewed_analysis, {})
        self.assertIs(negative.reviewed_analysis['is_request'], False)

    def test_approval_links_to_existing_sos_with_same_phone(self):
        existing = sos(16, 108, contact_phone='0901234567', note='Gia đình tôi cần giúp')
        article = self.article(1, extracted_phone='0901 234 567')
        detail = self.client.get(f'/ai/crawled/{article.pk}/').data
        self.assertEqual(detail['possible_duplicate']['reason'], 'phone')
        response = self.client.post(f'/ai/crawled/{article.pk}/review/', {'action': 'approve', 'corrections': {
            'is_request': True, 'needs': ['RESCUE'], 'extracted_lat': '16.2', 'extracted_lng': '108.2',
            'extracted_people_count': '2'}}, format='json')
        self.assertEqual(response.data['sos_id'], str(existing.pk))
        self.assertEqual(SOSSignal.objects.count(), 1)
        self.assertTrue(existing.events.filter(kind='AI_DUPLICATE_LINKED').exists())

    def test_approved_sos_carries_reviewed_information_for_scoring(self):
        article = self.article(1)
        response = self.client.post(f'/ai/crawled/{article.pk}/review/', {'action': 'approve', 'corrections': {
            'is_request': True, 'needs': ['MEDICAL'], 'vulnerable_groups': ['bà cụ 80 tuổi'],
            'extracted_lat': '16.2', 'extracted_lng': '108.2', 'extracted_people_count': '2'}}, format='json')
        created = SOSSignal.objects.get(pk=response.data['sos_id'])
        self.assertEqual(created.ai_analysis['source'], 'admin_review')
        self.assertEqual(created.ai_analysis['vulnerable_groups'], ['bà cụ 80 tuổi'])


class LegacyModelTests(SimpleTestCase):
    def test_news_branch_uses_rules_unless_legacy_model_enabled(self):
        from .nlp.text_analyzer import analyze
        with patch('ai.nlp.phobert_analyzer.is_available') as available:
            self.assertEqual(analyze('Lũ lớn', 'Nước dâng cao tại Quảng Nam').method, 'rule_based')
            available.assert_not_called()


# ─── Xuất dữ liệu & đánh giá ─────────────────────────────────────────────────

class ExportTests(SimpleTestCase):
    def article(self, n, reviewed, **kwargs):
        from uuid import UUID
        values = dict(id=UUID(int=n), raw_title='', raw_content=f'Cần nước uống cho 5 người ở xã An Bình, bài {n}',
                      facebook_post_id=f'post-{n}', source_url=f'https://example.org/{n}', reviewed_analysis=reviewed,
                      ai_analysis={'entities': [{'label': 'LOCATION', 'text': 'xã An Bình'}]},
                      extracted_address='xã An Bình', extracted_location='', extracted_people_count=5)
        values.update(kwargs)
        return SimpleNamespace(**values)

    def test_only_explicit_admin_labels_are_exported_and_split_is_stable(self):
        positive = {'is_request': True, 'needs': ['SUPPLY'], 'resources': ['nước uống'], 'vulnerable_groups': ['cụ già']}
        articles = [self.article(n, positive) for n in range(40)] + [
            self.article(100, {'is_request': False}), self.article(101, {}),
            self.article(102, positive, raw_content='từ ' * 200)]
        first = dataset_export.build_rows(articles, 30, 20)
        rows = first['a']['Train'] + first['a']['Validation'] + first['a']['Test']
        self.assertEqual(len(rows), 41)
        self.assertTrue(first['a']['Train'] and first['a']['Validation'] and first['a']['Test'])
        self.assertEqual(len(first['skipped']), 1)
        again = dataset_export.build_rows(articles[::-1], 30, 20)
        for name in ['Validation', 'Test']:
            self.assertEqual({r['id'] for r in first['a'][name]}, {r['id'] for r in again['a'][name]})
        self.assertTrue(all(r['origin'] == 'real' and r['reviewed'] == 1 for r in rows))

    def test_model_b_rows_are_drafts_marked_for_human_check(self):
        row = dataset_export.build_rows([self.article(1, {
            'is_request': True, 'needs': ['SUPPLY'], 'resources': ['nước uống'], 'vulnerable_groups': ['cụ già']})], 0, 0)['b']['Train'][0]
        self.assertEqual(row['reviewed'], 0)
        self.assertIn('[RESOURCE|nước uống]', row['text_annotated'])
        self.assertIn('[PEOPLE_COUNT|5 người]', row['text_annotated'])
        self.assertIn('[LOCATION|xã An Bình]', row['text_annotated'])
        self.assertIn('cụ già', row['can_kiem_tra'])   # admin nhập nhưng không có nguyên văn trong bài
        # Bản nháp phải đọc lại được bằng đúng bộ phân tích của notebook.
        text, entities = evaluation.parse_marked_text(row['text_annotated'])
        self.assertEqual({e['label'] for e in entities}, {'RESOURCE', 'PEOPLE_COUNT', 'LOCATION'})


class ExportCommandTests(TestCase):
    def test_exported_workbook_is_readable_by_the_evaluator(self):
        import tempfile
        from io import StringIO
        from pathlib import Path
        from django.core.management import call_command

        for n, reviewed in enumerate([{'is_request': True, 'needs': ['RESCUE', 'SUPPLY']}, {'is_request': False}, {}]):
            CrawledArticle.objects.create(
                source_platform='FACEBOOK', source_url=f'https://example.org/{n}', content_hash=f'h{n}',
                raw_content=f'Bài số {n}: cần thuyền và nước uống', status='ALERT_CREATED', reviewed_analysis=reviewed)
        with tempfile.TemporaryDirectory() as folder:
            output = StringIO()
            call_command('ai_export_reviewed', out=folder, test_percent=100, validation_percent=0, stdout=output)
            rows = evaluation.read_rows(Path(folder) / 'real_model_a.xlsx', 'Test', 'a')
            drafts = evaluation.read_rows(Path(folder) / 'real_model_b_draft.xlsx', 'Nhap_Test', 'b')
        self.assertEqual(sorted((r['is_request'], r['needs']) for r in rows),
                         [(False, []), (True, ['RESCUE', 'SUPPLY'])])
        self.assertTrue(all(r['origin'] == 'real' for r in rows))
        self.assertEqual(len(drafts), 2)
        self.assertIn('2 ', output.getvalue())

    def test_real_workbook_for_notebook_and_checked_drafts_survive_reexport(self):
        import tempfile
        from io import StringIO
        from pathlib import Path
        from django.core.management import call_command
        from openpyxl import load_workbook

        needs = ['RESCUE', 'MEDICAL', 'EVACUATION', 'SUPPLY']
        for n in range(60):
            reviewed = {'is_request': False} if n % 3 == 0 else {'is_request': True, 'needs': [needs[n % 4]]}
            CrawledArticle.objects.create(
                source_platform='FACEBOOK', source_url=f'https://example.org/{n}', content_hash=f'h{n}',
                raw_content=f'Bài thật số {n} cần hỗ trợ', status='ALERT_CREATED', reviewed_analysis=reviewed)
        with tempfile.TemporaryDirectory() as folder:
            call_command('ai_export_reviewed', out=folder, test_percent=30, validation_percent=30, stdout=StringIO())
            draft = Path(folder) / 'real_model_b_draft.xlsx'
            workbook = load_workbook(draft)
            sheet = workbook['Nhap_Train']
            headers = [c.value for c in sheet[1]]
            edited_id = sheet.cell(2, headers.index('id') + 1).value
            sheet.cell(2, headers.index('text_annotated') + 1).value = 'Đã sửa tay [RESOURCE|thuyền]'
            sheet.cell(2, headers.index('reviewed') + 1).value = 1
            workbook.save(draft)

            output = StringIO()
            call_command('ai_export_reviewed', out=folder, test_percent=30, validation_percent=30,
                         merge_train=True, stdout=output)
            kept = {row['id']: row for row in dataset_export.read_sheet_rows(draft, 'Nhap_Train')}
            self.assertEqual(kept[edited_id]['text_annotated'], 'Đã sửa tay [RESOURCE|thuyền]')

            from .sos_ml.excel_data import load_excel_data
            splits = load_excel_data(Path(folder) / 'data_model_a_real.xlsx', 'a', 'real_vietnamese')
            self.assertTrue(all(r['origin'] == 'real' for name in ['validation', 'test'] for r in splits[name]))
            self.assertTrue(any(r['origin'] == 'synthetic' for r in splits['train']))
            self.assertTrue(any(r['origin'] == 'real' and r['id'].startswith('fb-') for r in splits['train']))
            self.assertIn('Hợp lệ', output.getvalue())
            self.assertIn('data_model_b_real.xlsx', output.getvalue())


class EvaluationTests(SimpleTestCase):
    rows = [{'id': '1', 'text': 'Cứu với nhà em ngập tới nóc', 'is_request': True, 'needs': ['RESCUE'], 'origin': 'synthetic'},
            {'id': '2', 'text': 'Shop mình bán áo phao giá rẻ', 'is_request': False, 'needs': [], 'origin': 'synthetic'}]

    def test_scores_and_rule_baseline(self):
        perfect = evaluation.score_a(self.rows, [(True, ['RESCUE']), (False, [])])
        self.assertEqual((perfect['request']['f1'], perfect['needs']['RESCUE']['f1']), (1.0, 1.0))
        missed = evaluation.score_a(self.rows, [(False, []), (False, [])])
        self.assertEqual((missed['request']['recall'], missed['request']['accuracy']), (0.0, 0.5))
        self.assertEqual(evaluation.rule_predict(self.rows[0]['text'])[0], True)
        self.assertEqual(evaluation.rule_predict(self.rows[1]['text']), (False, []))

    def test_entity_scoring_matches_by_label_and_text(self):
        rows = [{'entities': [{'label': 'LOCATION', 'text': 'xã An Bình'}, {'label': 'RESOURCE', 'text': 'nước uống'}]}]
        score = evaluation.score_b(rows, [[{'label': 'LOCATION', 'text': 'Xã  An Bình'}, {'label': 'RESOURCE', 'text': 'mì tôm'}]])
        self.assertEqual((score['LOCATION']['f1'], score['RESOURCE']['f1'], score['micro']['f1']), (1.0, 0.0, 0.5))

    def test_guardrail_stats_separate_model_from_rule_decisions(self):
        records = [
            {'gold': True, 'raw': True, 'final': True, 'source': 'MODEL', 'guardrail': None},
            {'gold': True, 'raw': False, 'final': True, 'source': 'RULE_FALLBACK', 'guardrail': 'EMERGENCY_OVERRIDE'},
            {'gold': True, 'raw': True, 'final': False, 'source': 'RULE_FILTER', 'guardrail': 'NON_REQUEST_FILTER_DONATION'}]
        stats = evaluation.guardrail_stats(records)
        self.assertEqual((stats['model_decided'], stats['rule_intervened'], stats['label_changed']), (1, 2, 2))
        self.assertEqual((stats['changed_to_correct'], stats['changed_to_wrong']), (1, 1))

    def test_full_report_with_fake_predictor(self):
        class Predictor:
            metadata = {'a': {'run_id': 'a-test'}}

            def predict(self, text, mode='a'):
                request = 'Cứu' in text
                return {'raw_model_is_request': request, 'is_request': request, 'decision_source': 'MODEL',
                        'needs': ['RESCUE'] if request else [], 'candidate_needs': ['RESCUE'] if request else []}

        train = self.rows + [{'id': '3', 'text': 'Xin cứu gia đình tôi', 'is_request': True, 'needs': ['RESCUE'], 'origin': 'synthetic'},
                             {'id': '4', 'text': 'Bản tin thời tiết hôm nay', 'is_request': False, 'needs': [], 'origin': 'synthetic'}]
        report = evaluation.evaluate_a(self.rows, train, Predictor())
        self.assertEqual(report['tfidf_train_rows'], 2)   # câu trùng tập test bị loại khỏi train
        self.assertEqual(report['methods']['PhoBERT Model A + guardrails (đang dùng)']['request']['f1'], 1.0)
        markdown = evaluation.to_markdown(report, 'x.xlsx [Test]', self.rows)
        self.assertIn('KHÔNG phải độ chính xác trên tin thực', markdown)
        self.assertIn('Model hay luật ra quyết định?', markdown)
