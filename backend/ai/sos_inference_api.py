"""Versioned, opt-in API for human-reviewed SOS extraction."""
import logging
from time import monotonic
from .sos_service import get_predictor, _lock
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rescue_operations.flow import admin

logger = logging.getLogger(__name__)


@api_view(['POST'])
def analyze_sos(request):
    if not admin(request.user):
        return Response({'error': 'Không có quyền phân tích SOS.'}, status=403)
    text = request.data.get('text') if isinstance(request.data, dict) else None
    if not isinstance(text, str) or not text.strip() or len(text) > 4000:
        return Response({'error': 'text phải là chuỗi không rỗng, tối đa 4000 ký tự.'}, status=400)
    mode = request.data.get('mode', 'both')
    if mode not in ('a', 'b', 'both'):
        return Response({'error': 'mode phải là a, b hoặc both'}, status=400)
    started = monotonic()
    try:
        predictor = get_predictor(mode)
    except Exception:
        logger.exception('Two-model SOS artifacts unavailable')
        return Response({'error': 'Hai model chưa sẵn sàng. Kiểm tra cấu hình và artifact.', 'method': 'unavailable'}, status=503)
    try:
        with _lock:
            result = predictor.predict(text, mode=mode)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=422)
    except Exception:
        logger.exception('Two-model SOS inference failed')
        return Response({'error': 'Không thể phân tích lúc này.'}, status=503)
    result['elapsed_ms'] = round((monotonic() - started) * 1000)
    return Response(result)
