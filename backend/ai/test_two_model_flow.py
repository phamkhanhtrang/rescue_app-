from types import SimpleNamespace
from unittest.mock import patch
from django.test import TestCase, SimpleTestCase
from rest_framework.test import APIClient
from accounts.models import User
from rescue_operations.models import SOSSignal, SOSEvent
from .models import CrawledArticle
from .sos_article_analysis import suggested_fields, predict_article


def prediction(request=True):
    return {'method':'phobert_two_model_v1', 'is_request':request, 'request_score':.8,
        'needs':['RESCUE','SUPPLY'] if request else [],
        'need_scores':{'RESCUE':.8,'SUPPLY':.8,'MEDICAL':.1,'EVACUATION':.1},
        'entities':[{'label':'RESOURCE','text':'nước uống','start':4,'end':13}],
        'model_versions':['a-test','b-test'],'evaluation_domains':['synthetic','synthetic']}


class TwoModelFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='review-admin', phone='model-admin', role='ADMIN')
        self.client.force_authenticate(self.admin)
        self.article = CrawledArticle.objects.create(source_platform='FACEBOOK',source_url='https://example.org/post/1',
            raw_title='',raw_content='Cần nước uống và cứu gia đình đang bị cô lập.', content_hash='test-1',
            status='ANALYZED', ai_analysis=prediction())

    def review(self, corrections):
        return self.client.post(f'/ai/crawled/{self.article.pk}/review/', {'action':'approve','corrections':corrections},format='json')

    @patch('ai.clustering.run_clustering')
    def test_review_corrects_saves_and_prevents_double_creation(self, cluster):
        corrections = {'is_request':True, 'needs':['SUPPLY'], 'resources':['nước sạch'],
            'vulnerable_groups':['2 trẻ em'], 'extracted_people_count':'5',
            'extracted_lat':'16.1','extracted_lng':'108.2','extracted_address':'Địa chỉ đã xác minh'}
        response = self.review(corrections)
        self.assertEqual(response.status_code,200,response.data)
        self.article.refresh_from_db()
        sos = SOSSignal.objects.get(pk=response.data['sos_id'])
        self.assertEqual(sos.people_count,5)
        self.assertIn('nước sạch',sos.note)
        self.assertIn('2 trẻ em',sos.note)
        self.assertEqual(sos.emergency_type,'Nhu yếu phẩm')
        self.assertEqual(self.article.ai_analysis, prediction())
        self.assertEqual(self.article.reviewed_analysis['needs'],['SUPPLY'])
        self.assertTrue(SOSEvent.objects.filter(sos=sos,actor=self.admin,kind='AI_REVIEW_APPROVED').exists())
        cluster.assert_called_once()
        self.assertEqual(self.review(corrections).status_code,409)
        self.assertEqual(SOSSignal.objects.count(),1)

    def test_requires_confirmation_coordinates_and_count(self):
        base = {'is_request':True, 'extracted_lat':'16', 'extracted_lng':'108', 'extracted_people_count':'3'}
        for update in [{'is_request':False}, {'extracted_lat':'NaN'}, {'extracted_people_count':''}, {'extracted_people_count':1.5}, {'needs':['BAD']}]:
            response = self.review(dict(base, **update))
            self.assertEqual(response.status_code,400,response.data)
        self.assertFalse(SOSSignal.objects.exists())

    @patch('ai.sos_article_api.geocode_prediction', return_value=(None,None))
    @patch('ai.sos_article_api.predict_article', return_value=prediction(False))
    def test_reanalysis_retains_negative_and_does_not_create_sos(self, predict, geo):
        result=self.client.post(f'/ai/crawled/{self.article.pk}/analyze/')
        self.assertEqual(result.status_code,200,result.data)
        self.article.refresh_from_db()
        self.assertFalse(self.article.ai_analysis['is_request'])
        self.assertEqual(self.article.status,'ANALYZED')
        self.assertFalse(SOSSignal.objects.exists())
        data=self.client.get(f'/ai/crawled/{self.article.pk}/').data
        self.assertIn('ai_analysis',data)

    @patch('ai.sos_article_api.predict_article', side_effect=RuntimeError('offline'))
    def test_reanalysis_error_keeps_old_prediction(self, predict):
        result=self.client.post(f'/ai/crawled/{self.article.pk}/analyze/')
        self.assertEqual(result.status_code,503)
        self.article.refresh_from_db()
        self.assertEqual(self.article.ai_analysis,prediction())

    def test_citizen_cannot_analyze_or_review(self):
        citizen=User.objects.create_user(username='reader',phone='model-reader',role='CITIZEN')
        self.client.force_authenticate(citizen)
        self.assertEqual(self.client.post(f'/ai/crawled/{self.article.pk}/analyze/').status_code,403)
        self.assertEqual(self.review({}).status_code,403)

    @patch('ai.nlp.deduplicator.is_duplicate', return_value=(False,''))
    @patch('ai.sos_article_analysis.predict_article', side_effect=RuntimeError('offline'))
    @patch('ai.crawlers.fb_playwright_crawler.FacebookPlaywrightCrawler')
    def test_crawler_preserves_article_on_model_failure(self, crawler, predict, duplicate):
        from .crawler_pipeline import run_facebook_crawl_pipeline
        crawler.return_value.fetch.return_value=[SimpleNamespace(source_url='https://example.org/new',raw_title='',
            raw_content='Một bài chưa xác định',facebook_post_id='post-2')]
        result=run_facebook_crawl_pipeline()
        self.assertEqual(result['saved'],1)
        article=CrawledArticle.objects.get(source_url='https://example.org/new')
        self.assertEqual(article.status,'ANALYZED')
        self.assertIn('error',article.ai_analysis)
        self.assertFalse(SOSSignal.objects.exists())


class AggregationTests(SimpleTestCase):
    def test_ambiguous_people_count_not_guessed(self):
        result=prediction()
        result['entities']=[{'label':'PEOPLE_COUNT','text':'3 người'}, {'label':'PEOPLE_COUNT','text':'5 người'}]
        self.assertIsNone(suggested_fields(result)['extracted_people_count'])
        result['entities']=result['entities'][:1]
        self.assertEqual(suggested_fields(result)['extracted_people_count'],3)

    @patch('ai.sos_article_analysis.get_predictor')
    def test_long_article_is_fully_covered_with_global_offsets(self, get):
        class Tokenizer:
            def encode(self, text, **kwargs): return [1]
        class Predictor:
            ta=tb=Tokenizer()
            def predict(self,text):
                result=prediction()
                result['entities']=[{'label':'LOCATION','text':text[:1],'start':0,'end':1}]
                return result
        get.return_value=Predictor()
        text='a ' * 600
        with patch('ai.sos_ml.preprocess.segmented_words', return_value=[('a',i,i+1) for i in range(0,len(text.strip()),2)]):
            result=predict_article('',text)
        self.assertEqual(len(result['chunks']),3)
        self.assertEqual(''.join(result['text'][c['start']:c['end']] for c in result['chunks']),result['text'])
        for entity in result['entities']:
            self.assertEqual(result['text'][entity['start']:entity['end']],entity['text'])
