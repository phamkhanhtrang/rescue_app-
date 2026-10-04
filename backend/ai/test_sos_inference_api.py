from types import SimpleNamespace
from unittest.mock import patch, Mock
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from .sos_inference_api import analyze_sos


class SOSInferenceAPITests(SimpleTestCase):
    @patch('ai.sos_inference_api.get_predictor')
    def test_mode_is_validated_and_forwarded(self, get):
        for mode in ['a','b','both']:
            get.return_value.predict.return_value = {'mode': mode}
            self.assertEqual(self.call({'text':'Cứu với','mode':mode}).status_code,200)
            get.assert_called_with(mode)
            get.return_value.predict.assert_called_with('Cứu với',mode=mode)
        get.reset_mock()
        self.assertEqual(self.call({'text':'Cứu với','mode':'invalid'}).status_code,400)
        get.assert_not_called()

    def call(self, payload, role='ADMIN'):
        request = APIRequestFactory().post('/ai/analyze-sos/', payload, format='json')
        user = SimpleNamespace(is_authenticated=True, is_active=True, role=role)
        force_authenticate(request, user=user)
        return analyze_sos(request)

    @patch('ai.sos_inference_api.get_predictor')
    def test_citizen_cannot_load_model(self, get):
        self.assertEqual(self.call({'text': 'Cứu với'}, 'CITIZEN').status_code, 403)
        get.assert_not_called()

    @patch('ai.sos_inference_api.get_predictor')
    def test_reject_invalid_input_before_loading(self, get):
        for payload in [{'text': 123}, {'text': ''}, {'text': 'a' * 4001}, []]:
            self.assertEqual(self.call(payload).status_code, 400)
        get.assert_not_called()

    @patch('ai.sos_inference_api.get_predictor', side_effect=RuntimeError('not configured'))
    def test_missing_model_is_explicit(self, get):
        result = self.call({'text': 'Cứu với'})
        self.assertEqual(result.status_code, 503)
        self.assertEqual(result.data['method'], 'unavailable')

    @patch('ai.sos_inference_api.get_predictor')
    def test_returns_predictions_without_creating_sos(self, get):
        get.return_value.predict.return_value = {'method': 'phobert_two_model_v1', 'requires_review': True}
        result = self.call({'text': 'Cứu với'})
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.data['requires_review'])

    @patch('ai.sos_inference_api.get_predictor')
    def test_alignment_or_length_problem(self, get):
        get.return_value.predict.side_effect = ValueError('Too many BPE tokens')
        self.assertEqual(self.call({'text': 'Cứu với'}).status_code, 422)
