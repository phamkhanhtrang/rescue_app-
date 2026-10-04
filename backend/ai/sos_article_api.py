import logging
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rescue_operations.flow import admin
from .models import CrawledArticle
from .sos_article_analysis import predict_article, suggested_fields, geocode_prediction


@api_view(['POST'])
def reanalyze(request, pk):
    if not admin(request.user):
        return Response({'error': 'Không có quyền phân tích bài viết.'}, status=403)
    try:
        article = CrawledArticle.objects.get(pk=pk)
    except CrawledArticle.DoesNotExist:
        return Response({'error': 'Không tìm thấy bài viết.'}, status=404)
    if article.source_platform != 'FACEBOOK' or article.status not in ['RAW', 'ANALYZED']:
        return Response({'error': 'Chỉ phân tích lại bài Facebook chưa duyệt.'}, status=409)
    try:
        result = predict_article(article.raw_title, article.raw_content)
        fields = suggested_fields(result)
        fields['extracted_lat'], fields['extracted_lng'] = geocode_prediction(result)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=422)
    except Exception:
        logging.getLogger(__name__).exception('Article analysis failed')
        return Response({'error': 'Hai model chưa sẵn sàng. Kết quả cũ vẫn được giữ.'}, status=503)
    with transaction.atomic():
        current = CrawledArticle.objects.select_for_update().filter(pk=pk).first()
        if current is None:
            return Response({'error': 'Bài viết đã bị xóa trong lúc phân tích.'}, status=404)
        if current.status not in ['RAW','ANALYZED'] or current.raw_content != article.raw_content or current.raw_title != article.raw_title:
            return Response({'error': 'Bài đã thay đổi trong lúc phân tích. Tải lại hồ sơ.'}, status=409)
        for key, value in fields.items():
            setattr(current, key, value)
        current.ai_analysis, current.status, current.analyzed_at = result, 'ANALYZED', timezone.now()
        current.save(update_fields=[*fields, 'ai_analysis', 'status', 'analyzed_at'])
    return Response({'message': 'Đã phân tích bằng hai model. Cần xác nhận trước khi tạo SOS.'})
