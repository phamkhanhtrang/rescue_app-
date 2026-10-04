"""Publication is independent from article review and from alert delivery."""
from django.core import signing
from django.db import transaction
from django.db.models import Q
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from communications.access import coordinates, visible_alerts
from communications.serializers import AlertSerializer
from rescue_operations.flow import admin
from .models import CrawledArticle, NewsPublicationEvent

REVIEWED = ('APPROVED', 'ALERT_CREATED')


def publish(article, actor):
    if not article.is_published:
        article.is_published = True
        article.published_at = timezone.now()
        article.unpublished_at = None
        article.save(update_fields=['is_published', 'published_at', 'unpublished_at'])
        NewsPublicationEvent.objects.create(article=article, actor=actor, action='PUBLISHED')


def public_news():
    return CrawledArticle.objects.filter(is_published=True, status__in=REVIEWED).exclude(source_platform='FACEBOOK')


def news_data(article, *, detail=False):
    content = article.raw_content or ''
    result = {
        'id': str(article.pk), 'title': article.raw_title or '',
        'summary': content[:280] + ('…' if len(content) > 280 else ''),
        'source_platform': article.source_platform, 'source_url': article.source_url,
        'location': article.extracted_location or '', 'severity': article.extracted_severity or 'LOW',
        'incident_type': article.extracted_incident_type or '',
        'published_at': article.published_at, 'crawled_at': article.crawled_at,
    }
    if detail:
        result['content'] = content
    return result


@api_view(['GET'])
@permission_classes([AllowAny])
def news_list(request):
    try:
        limit = min(max(int(request.query_params.get('limit', 20)), 1), 50)
    except (ValueError, TypeError):
        raise ValidationError({'limit': 'Số bài phải là số nguyên.'})
    qs = public_news().annotate(sort_time=Coalesce('published_at', 'crawled_at')).order_by('-sort_time', '-pk')
    query = str(request.query_params.get('q') or '').strip()
    if query:
        qs = qs.filter(Q(raw_title__icontains=query) | Q(extracted_location__icontains=query) | Q(raw_content__icontains=query))
    cursor = request.query_params.get('cursor')
    if cursor:
        try:
            position = signing.loads(cursor, salt='news.cursor', max_age=86400)
            timestamp = parse_datetime(position['time'])
            import uuid
            pk = uuid.UUID(position['id'])
            if not timestamp:
                raise ValueError
        except (signing.BadSignature, KeyError, ValueError, TypeError):
            raise ValidationError({'cursor': 'Trang tin đã hết hạn hoặc không hợp lệ. Hãy làm mới danh sách.'})
        qs = qs.filter(Q(sort_time__lt=timestamp) | Q(sort_time=timestamp, pk__lt=pk))
    items = list(qs[:limit + 1])
    has_more = len(items) > limit
    items = items[:limit]
    next_cursor = signing.dumps({'time': items[-1].sort_time.isoformat(), 'id': str(items[-1].pk)}, salt='news.cursor') if has_more else None
    return Response({'count': len(items), 'results': [news_data(item) for item in items], 'next_cursor': next_cursor})


@api_view(['GET'])
@permission_classes([AllowAny])
def news_detail(request, pk):
    article = get_object_or_404(public_news(), pk=pk)
    result = news_data(article, detail=True)
    alert = visible_alerts(request.user, coordinates(request.query_params)).filter(pk=article.linked_alert_id).first() if article.linked_alert_id else None
    result['related_alert'] = {'id': str(alert.pk), 'title': alert.title, 'message_type': alert.message_type} if alert else None
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def publication(request, pk):
    if not admin(request.user):
        return Response({'error': 'Chỉ quản trị viên được xuất bản/gỡ bài.'}, status=403)
    article = get_object_or_404(CrawledArticle.objects.select_for_update(), pk=pk)
    if article.source_platform == 'FACEBOOK' or article.status not in REVIEWED:
        return Response({'error': 'Chỉ xuất bản bài báo đã duyệt.'}, status=409)
    action = request.data.get('action')
    if action == 'publish':
        publish(article, request.user)
    elif action == 'unpublish':
        if article.is_published:
            article.is_published = False
            article.unpublished_at = timezone.now()
            article.save(update_fields=['is_published', 'unpublished_at'])
            NewsPublicationEvent.objects.create(article=article, actor=request.user, action='UNPUBLISHED')
    else:
        raise ValidationError({'action': 'Chọn publish hoặc unpublish.'})
    return Response({'is_published': article.is_published, 'published_at': article.published_at, 'unpublished_at': article.unpublished_at})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_news_alert(request, pk):
    if not admin(request.user):
        return Response({'error': 'Chỉ quản trị viên được phát cảnh báo.'}, status=403)
    article = get_object_or_404(CrawledArticle.objects.select_for_update(), pk=pk)
    if article.source_platform == 'FACEBOOK' or article.status not in REVIEWED or not article.is_published:
        return Response({'error': 'Bài báo cần được duyệt và đang xuất bản trước khi tạo cảnh báo.'}, status=409)
    if article.linked_alert_id:
        return Response({'error': 'Bài đã có cảnh báo liên quan. Mở trang Phát tin để quản lý.', 'alert_id': str(article.linked_alert_id)}, status=409)
    # Explicit inputs prevent old one-click clients from broadcasting globally.
    required = ('message_type', 'audience', 'zone', 'expires_at', 'title', 'description')
    if any(field not in request.data for field in required):
        raise ValidationError({'error': 'Hãy chọn loại tin, người nhận, khu vực, hạn dùng và nhập hướng dẫn trước khi phát.'})
    payload = {field: request.data[field] for field in required}
    payload.update(source='AUTHORITY', is_active=True)
    serializer = AlertSerializer(data=payload, context={'request': request})
    serializer.is_valid(raise_exception=True)
    alert = serializer.save()
    article.linked_alert = alert
    article.save(update_fields=['linked_alert'])
    NewsPublicationEvent.objects.create(article=article, actor=request.user, action='ALERT_CREATED', alert_id_snapshot=alert.pk)
    return Response(serializer.data, status=201)
