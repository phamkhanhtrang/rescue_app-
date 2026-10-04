"""
ai/views.py
===========
API endpoints cho module AI của Guardian Pulse.

Endpoints:
    POST /ai/cluster/          → Gom cụm SOS → tạo/cập nhật Zone
    POST /ai/score/            → Tính lại ai_priority_score cho các Zone
    GET  /ai/priority-zones/   → Danh sách Zone sắp xếp theo điểm ưu tiên
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.db.models import Q

from .clustering import run_clustering
from .priority_scorer import run_priority_scoring, score_label
from rescue_operations.models import Zone
from rescue_operations.serializers import ZoneListSerializer


# ─── 1. Gom cụm SOS ──────────────────────────────────────────────────────────

@api_view(['POST'])
def cluster_sos(request):
    from rescue_operations.flow import admin, operator
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Kích hoạt AI gom cụm SOS → tạo/cập nhật Zone.

    Body (JSON, tuỳ chọn):
        {
            "only_unassigned": true   // true = chỉ SOS chưa có zone (mặc định)
                                      // false = chạy lại toàn bộ PENDING SOS
        }

    Response 200:
        {
            "message": "...",
            "stats": {
                "zones_created": 3,
                "zones_updated": 1,
                "sos_assigned":  12
            }
        }
    """
    only_unassigned = request.data.get('only_unassigned', True)

    try:
        stats = run_clustering(only_unassigned=bool(only_unassigned))
    except Exception as e:
        return Response(
            {'error': f'Lỗi khi gom cụm SOS: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    msg = (
        f"Gom cụm hoàn tất: "
        f"tạo {stats['zones_created']} zone mới, "
        f"cập nhật {stats['zones_updated']} zone, "
        f"gán {stats['sos_assigned']} SOS."
    )
    return Response({'message': msg, 'stats': stats})


# ─── 2. Tính điểm ưu tiên ────────────────────────────────────────────────────

@api_view(['POST'])
def score_zones(request):
    from rescue_operations.flow import admin, operator
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Tính lại ai_priority_score cho các Zone đang hoạt động.

    Body (JSON, tuỳ chọn):
        {
            "zone_ids": ["uuid1", "uuid2"]   // Nếu bỏ qua → tính lại tất cả
        }

    Response 200:
        {
            "message": "Đã tính điểm 5 zone.",
            "result": {
                "updated": 5,
                "scores": [
                    {"id": "...", "name": "Zone A", "score": 87.5, "label": "CRITICAL"},
                    ...
                ]
            }
        }
    """
    zone_ids = request.data.get('zone_ids', None)

    try:
        result = run_priority_scoring(zone_ids=zone_ids)
    except Exception as e:
        return Response(
            {'error': f'Lỗi khi tính điểm ưu tiên: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Gắn nhãn label vào từng phần tử
    for item in result['scores']:
        item['label'] = score_label(item['score'])

    msg = f"Đã tính điểm ưu tiên cho {result['updated']} zone."
    return Response({'message': msg, 'result': result})


# ─── 3. Danh sách Zone ưu tiên ───────────────────────────────────────────────

@api_view(['GET'])
def priority_zones(request):
    from rescue_operations.flow import admin, operator
    if not operator(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Trả về danh sách Zone sắp xếp theo ai_priority_score giảm dần.

    Query params:
        limit   (int, mặc định 20)  — số zone trả về tối đa
        min_score (float, mặc định 0) — lọc zone có score >= giá trị này

    Response 200:
        {
            "count": 5,
            "results": [ ZoneListSerializer data... ]
        }
    """
    limit = int(request.query_params.get('limit', 20))
    min_score = float(request.query_params.get('min_score', 0))

    qs = (
        Zone.objects
        .filter(
            status__in=['ACTIVE', 'STABILIZING'],
            ai_priority_score__isnull=False,
            ai_priority_score__gte=min_score,
        )
        .order_by('-ai_priority_score')[:limit]
    )

    serializer = ZoneListSerializer(qs, many=True)

    # Thêm label vào từng zone
    data = serializer.data
    for item in data:
        score = float(item.get('ai_priority_score') or 0)
        item['priority_label'] = score_label(score)

    return Response({'count': len(data), 'results': data})


# ─── 4. Chạy pipeline đầy đủ (cluster + score) ───────────────────────────────

@api_view(['POST'])
def run_ai_pipeline(request):
    from rescue_operations.flow import admin, operator
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Chạy toàn bộ AI pipeline một lần:
        1. Gom cụm SOS → tạo/cập nhật Zone
        2. Tính lại ai_priority_score cho tất cả zone vừa được tạo/cập nhật

    Dùng cho cronjob hoặc trigger thủ công từ Admin dashboard.

    Response 200:
        {
            "message": "...",
            "clustering": { stats },
            "scoring":    { result }
        }
    """
    only_unassigned = request.data.get('only_unassigned', True)

    try:
        cluster_stats = run_clustering(only_unassigned=bool(only_unassigned))
    except Exception as e:
        return Response(
            {'error': f'Lỗi gom cụm: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    try:
        score_result = run_priority_scoring()
    except Exception as e:
        return Response(
            {'error': f'Lỗi tính điểm: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    for item in score_result['scores']:
        item['label'] = score_label(item['score'])

    return Response({
        'message': (
            f"Pipeline hoàn tất: "
            f"{cluster_stats['zones_created']} zone tạo mới, "
            f"{cluster_stats['sos_assigned']} SOS được gán, "
            f"{score_result['updated']} zone được tính điểm."
        ),
        'clustering': cluster_stats,
        'scoring':    score_result,
    })


# ─── 5. Chạy pipeline Crawl ──────────────────────────────────────────────────

@api_view(['POST'])
def run_crawl(request):
    from rescue_operations.flow import admin, operator
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Kích hoạt pipeline crawl tin thiên tai từ báo chí (bỏ GDACS).

    Body (JSON, tuỳ chọn):
        {
            "platforms": ["VNEXPRESS", "TUOITRE"]  // None = tất cả
        }

    Response 200:
        {
            "message": "...",
            "stats": { ... }
        }
    """
    platforms = request.data.get('platforms', None)

    try:
        from .crawler_pipeline import run_crawl_pipeline
        stats = run_crawl_pipeline(
            platforms=platforms
        )
    except Exception as e:
        return Response(
            {'error': f'Lỗi pipeline crawl: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    msg = (
        f"Crawl hoàn tất: {stats['crawled']} bài thu thập, "
        f"{stats['duplicates']} trùng bỏ qua, "
        f"{stats['saved']} lưu mới."
    )
    return Response({'message': msg, 'stats': stats})


# ─── 6. Danh sách bài đã Crawl ───────────────────────────────────────────────

@api_view(['GET'])
def crawled_list(request):
    from rescue_operations.flow import admin, operator
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Danh sách CrawledArticle. Hỗ trợ lọc và phân trang.

    Query params:
        status   — lọc theo trạng thái: RAW, ANALYZED, ALERT_CREATED, REJECTED
        platform — lọc theo nguồn: VNEXPRESS, TUOITRE, GDACS, ...
        limit    — số lượng (mặc định 50)
    """
    from django.db.models import Count, Max, Q
    from .models import CrawledArticle

    base_qs = CrawledArticle.objects.all()

    s      = request.query_params.get('status')
    plt    = request.query_params.get('platform')
    query  = request.query_params.get('q', '').strip()
    try:
        lim = max(1, min(int(request.query_params.get('limit', 20)), 100))
        offset = max(0, int(request.query_params.get('offset', 0)))
    except (TypeError, ValueError):
        return Response({'error': 'limit và offset phải là số nguyên.'}, status=400)

    # Summary follows the selected source so the counters remain useful while
    # an operator switches between news and Facebook queues.
    summary_qs = base_qs
    if plt:
        if plt.upper() == 'NEWS':
            summary_qs = summary_qs.exclude(source_platform='FACEBOOK')
        else:
            summary_qs = summary_qs.filter(source_platform=plt.upper())
    summary = summary_qs.aggregate(
        total=Count('id'),
        pending=Count('id', filter=Q(status='ANALYZED')),
        approved=Count('id', filter=Q(is_published=True)),
        created=Count('id', filter=Q(linked_alert__isnull=False) | Q(linked_sos__isnull=False)),
        rejected=Count('id', filter=Q(status='REJECTED')),
        latest_crawled_at=Max('crawled_at'),
    )

    qs = base_qs

    if s == 'PUBLISHED':
        qs = qs.filter(is_published=True)
    elif s == 'UNPUBLISHED':
        qs = qs.filter(is_published=False, status__in=['APPROVED', 'ALERT_CREATED']).exclude(source_platform='FACEBOOK')
    elif s == 'LINKED':
        qs = qs.filter(linked_alert__isnull=False)
    elif s:
        qs = qs.filter(status=s.upper())
    if plt:
        if plt.upper() == 'NEWS':
            # "NEWS" đại diện cho tất cả trừ FACEBOOK (Báo chính thống & GDACS)
            qs = qs.exclude(source_platform='FACEBOOK')
        else:
            qs = qs.filter(source_platform=plt.upper())
    if query:
        qs = qs.filter(
            Q(raw_title__icontains=query)
            | Q(extracted_location__icontains=query)
            | Q(extracted_address__icontains=query)
            | Q(facebook_author__icontains=query)
            | Q(extracted_phone__icontains=query)
        )

    total = qs.count()
    qs = qs[offset:offset + lim]

    data = list(qs.values(
        'id', 'source_platform', 'source_url', 'raw_title',
        'extracted_location', 'extracted_lat', 'extracted_lng',
        'extracted_severity', 'extracted_incident_type',
        'confidence_score', 'status', 'crawled_at', 'analyzed_at',
        'facebook_author', 'extracted_people_count', 'extracted_phone',
        'extracted_address', 'has_media', 'fb_reactions_count',
        'linked_alert_id', 'linked_sos_id', 'reject_reason',
        'is_published', 'published_at', 'unpublished_at', 'linked_alert__is_active', 'linked_alert__expires_at',
    ))
    return Response({
        'count': len(data),
        'total': total,
        'limit': lim,
        'offset': offset,
        'summary': summary,
        'results': data,
    })


@api_view(['GET', 'DELETE'])
def crawled_detail(request, pk):
    """Return full evidence only when the operator opens a review item, or delete article."""
    from rescue_operations.flow import admin
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)

    from .models import CrawledArticle
    try:
        article = CrawledArticle.objects.get(pk=pk)
    except CrawledArticle.DoesNotExist:
        return Response({'error': 'Không tìm thấy bài crawl.'}, status=404)

    if request.method == 'DELETE':
        if article.source_platform != 'FACEBOOK' and (article.status in ('APPROVED', 'ALERT_CREATED') or article.publication_events.exists()):
            return Response({'error': 'Bài đã duyệt được giữ lịch sử. Dùng Gỡ xuất bản để ẩn khỏi app; cảnh báo liên quan được quản lý riêng.'}, status=409)
        article.delete()
        return Response({'message': 'Đã xóa bài viết thành công.'}, status=status.HTTP_200_OK)

    # GET
    data = CrawledArticle.objects.values(
        'id', 'source_platform', 'source_url', 'raw_title', 'raw_content',
        'extracted_location', 'extracted_lat', 'extracted_lng',
        'extracted_severity', 'extracted_incident_type', 'confidence_score',
        'facebook_post_id', 'facebook_author', 'extracted_people_count',
        'extracted_phone', 'extracted_address', 'has_media',
        'fb_reactions_count', 'status', 'linked_alert_id', 'linked_sos_id',
        'reject_reason', 'crawled_at', 'analyzed_at',
        'is_published', 'published_at', 'unpublished_at',
        'linked_alert__title', 'linked_alert__is_active', 'linked_alert__expires_at',
    ).get(pk=pk)
    data['publication_events'] = list(article.publication_events.values('action', 'created_at', 'actor__full_name', 'alert_id_snapshot'))
    data['ai_analysis'] = article.ai_analysis
    data['reviewed_analysis'] = article.reviewed_analysis
    return Response(data)



# ─── 7. Duyệt / Từ chối bài Crawl ───────────────────────────────────────────

@api_view(['POST'])
@transaction.atomic
def crawled_review(request, pk):
    from rescue_operations.flow import admin, operator
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Cho phép Admin duyệt hoặc từ chối thủ công một bài crawl.

    Body:
        { "action": "approve" }   → Tạo Alert từ bài này
        { "action": "reject",
          "reason": "Tin cũ"  }   → Đánh dấu REJECTED
    """
    from .models import CrawledArticle
    from communications.models import Alert
    from decimal import Decimal

    try:
        article = CrawledArticle.objects.select_for_update().get(pk=pk)
    except CrawledArticle.DoesNotExist:
        return Response({'error': 'Không tìm thấy bài crawl.'}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get('action', '').lower()

    if action == 'approve':
        if article.status != 'ANALYZED':
            return Response(
                {'error': 'Tin này không còn ở trạng thái chờ duyệt.'},
                status=status.HTTP_409_CONFLICT,
            )
        if article.source_platform == 'FACEBOOK':
            if article.linked_sos_id:
                return Response({'error': 'Bài này đã có SOS liên kết.'}, status=status.HTTP_400_BAD_REQUEST)

            from rescue_operations.models import SOSSignal
            from django.utils import timezone
            from datetime import timedelta
            from difflib import SequenceMatcher
            from ai.nlp.deduplicator import normalize

            # Cho phép Admin sửa phần AI trích xuất ngay trong hồ sơ duyệt.
            corrections = request.data.get('corrections') or {}
            if not isinstance(corrections, dict):
                return Response({'error': 'corrections phải là đối tượng.'}, status=400)
            from .sos_article_analysis import NEED_NAMES
            if corrections.get('is_request') is not True:
                return Response({'error': 'Cần xác nhận đây là yêu cầu đang cần hỗ trợ trước khi tạo SOS.'}, status=400)
            needs = corrections.get('needs', [])
            resources = corrections.get('resources', [])
            vulnerable = corrections.get('vulnerable_groups', [])
            if (not isinstance(needs, list) or any(not isinstance(n, str) or n not in NEED_NAMES for n in needs)
                    or len(needs) != len(set(needs))):
                return Response({'error': 'Danh sách nhu cầu không hợp lệ.'}, status=400)
            for values in [resources, vulnerable]:
                if not isinstance(values, list) or len(values) > 50 or any(not isinstance(v, str) or not v.strip() or len(v) > 200 for v in values):
                    return Response({'error': 'Thông tin vật tư/nhóm dễ tổn thương không hợp lệ.'}, status=400)
            try:
                lat_raw = corrections.get('extracted_lat', article.extracted_lat)
                lng_raw = corrections.get('extracted_lng', article.extracted_lng)
                lat = Decimal(str(lat_raw)) if lat_raw not in (None, '') else None
                lng = Decimal(str(lng_raw)) if lng_raw not in (None, '') else None
                people_count = int(corrections.get(
                    'extracted_people_count', article.extracted_people_count
                ))
            except (ValueError, TypeError, ArithmeticError):
                return Response({'error': 'Tọa độ hoặc số người không hợp lệ.'}, status=400)

            if (
                lat is None or lng is None
                or not lat.is_finite() or not lng.is_finite()
                or not (-90 <= lat <= 90) or not (-180 <= lng <= 180)
                or (lat == 0 and lng == 0)
            ):
                return Response(
                    {'error': 'Cần xác nhận tọa độ thực tế trước khi tạo SOS.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if people_count < 1 or people_count > 10000 or str(corrections.get('extracted_people_count', article.extracted_people_count)).strip() != str(people_count):
                return Response({'error': 'Số người cần cứu phải từ 1 đến 10.000.'}, status=400)

            editable = {
                'extracted_location': 200,
                'extracted_address': None,
                'extracted_phone': 20,
                'facebook_author': 200,
                'extracted_incident_type': 100,
            }
            for field, limit in [('extracted_address', 500), ('facebook_author', 150)]:
                value = str(corrections.get(field, getattr(article, field)) or '').strip()
                if len(value) > limit:
                    return Response({'error': f'{field} chỉ được tối đa {limit} ký tự.'}, status=400)
            for field, max_length in editable.items():
                if field in corrections:
                    value = str(corrections[field] or '').strip()
                    setattr(article, field, value[:max_length] if max_length else value)
            article.extracted_lat = lat
            article.extracted_lng = lng
            article.extracted_people_count = people_count
            article.extracted_incident_type = ', '.join(NEED_NAMES[n] for n in needs) or 'Yêu cầu hỗ trợ'
            article.reviewed_analysis = {'is_request': True, 'needs': needs, 'resources': resources,
                'vulnerable_groups': vulnerable, 'reviewer_id': str(request.user.pk),
                'reviewed_at': timezone.now().isoformat()}
            article.save(update_fields=[
                *editable.keys(), 'extracted_lat', 'extracted_lng',
                'extracted_people_count', 'reviewed_analysis',
            ])

            # Lọc trùng với các SOS đã có (gửi từ app hoặc crawl) trong 24h qua
            recent_cutoff = timezone.now() - timedelta(hours=24)
            recent_sos_qs = SOSSignal.objects.filter(sent_at__gte=recent_cutoff)
            
            new_text = normalize(f"{article.raw_title or ''} {article.raw_content or ''}")
            existing_sos = None
            
            for r_sos in recent_sos_qs:
                old_text = normalize((r_sos.note or '').split('\nNhu cầu đã duyệt:', 1)[0].removeprefix('[Facebook] '))
                ratio = SequenceMatcher(None, new_text, old_text).ratio()
                if ratio >= 0.85:
                    existing_sos = r_sos
                    break

            if existing_sos:
                article.linked_sos = existing_sos
                article.status     = 'ALERT_CREATED'
                article.save(update_fields=['linked_sos', 'status'])
                return Response({'message': 'Phát hiện SOS trùng lặp, đã gộp vào SOS hiện có.', 'sos_id': str(existing_sos.id)})

            sos = SOSSignal.objects.create(
                signal_type    = 'SOS',
                status         = 'PENDING',
                location_lat   = article.extracted_lat,
                location_lng   = article.extracted_lng,
                emergency_type = article.extracted_incident_type or 'Cứu hộ khẩn cấp',
                people_count   = article.extracted_people_count or 1,
                note           = (f"[Facebook] {article.raw_title or ''}\n{article.raw_content}\n"
                                  f"Nhu cầu đã duyệt: {article.extracted_incident_type}\n"
                                  f"Nhóm dễ tổn thương: {'; '.join(vulnerable)}\nVật tư cần: {'; '.join(resources)}"),
                contact_name   = article.facebook_author or '',
                contact_phone  = article.extracted_phone or '',
                address        = article.extracted_address or article.extracted_location or '',
                location_source = 'AI_CRAWL',
                verification_status = 'UNVERIFIED',
            )
            article.linked_sos = sos
            article.status     = 'ALERT_CREATED'
            article.save(update_fields=['linked_sos', 'status'])

            from rescue_operations.models import SOSEvent
            SOSEvent.objects.create(sos=sos, kind='AI_REVIEW_APPROVED', actor=request.user,
                message=f'Admin duyệt bài Facebook {article.id}; nhu cầu: {article.extracted_incident_type}.')

            try:
                from .clustering import run_clustering
                run_clustering(only_unassigned=True)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Lỗi gom cụm sau khi duyệt bài: {e}")

            return Response({'message': 'Đã duyệt và tạo SOS.', 'sos_id': str(sos.id)})
        else:
            if request.data.get('create_alert') not in (None, False):
                return Response({'error': 'Duyệt bài chỉ xuất bản tin tức. Hãy dùng form Tạo cảnh báo từ bài đã xuất bản.'}, status=400)
            from .news import publish
            article.status = 'APPROVED'
            article.save(update_fields=['status'])
            publish(article, request.user)
            return Response({'message': 'Đã duyệt và xuất bản bài báo vào mục Tin tức.'})

    elif action == 'reject':
        if article.status != 'ANALYZED':
            return Response(
                {'error': 'Tin này không còn ở trạng thái chờ duyệt.'},
                status=status.HTTP_409_CONFLICT,
            )
        reason = str(request.data.get('reason') or '').strip()
        if not reason:
            return Response({'error': 'Cần nhập lý do từ chối.'}, status=400)
        article.status        = 'REJECTED'
        article.reject_reason = reason[:200]
        article.save(update_fields=['status', 'reject_reason'])
        return Response({'message': f'Đã từ chối: {reason}'})

    return Response(
        {'error': 'action phải là "approve" hoặc "reject".'},
        status=status.HTTP_400_BAD_REQUEST
    )




# ─── 8. Gợi ý Phân công Rescuer → Zone ──────────────────────────────────────

@api_view(['GET'])
def recommend_assignments(request):
    from rescue_operations.flow import admin, operator
    if not operator(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Trả về bảng gợi ý phân công Rescuer rảnh → Zone đang thiếu người,
    sắp xếp theo điểm phù hợp AI (cao → thấp).

    Query params:
        zone_ids — UUID, có thể lặp nhiều lần: ?zone_ids=xxx&zone_ids=yyy
        top_n    — Số đề xuất tối đa (mặc định 10)

    Response 200:
        {
            "rescuers_available": 5,
            "zones_needing_help": 3,
            "recommendations": [
                {
                    "rescuer_id":    "uuid...",
                    "rescuer_name":  "Nguyễn Văn A",
                    "zone_id":       "uuid...",
                    "zone_name":     "Zone Lũ Hải Châu",
                    "zone_severity": "CRITICAL",
                    "match_score":   87.5,
                    "reasons": ["Khoảng cách 1.2 km", "Chuyên môn Y tế phù hợp cao"]
                },
                ...
            ]
        }
    """
    zone_ids = request.query_params.getlist('zone_ids') or None
    top_n    = int(request.query_params.get('top_n', 10))

    try:
        from .assignment_recommender import run_assignment_recommendation
        result = run_assignment_recommendation(zone_ids=zone_ids, top_n=top_n)
    except Exception as e:
        return Response(
            {'error': f'Lỗi khi tính toán gợi ý phân công: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response(result)


# ─── 9. Crawl Facebook SOS ─────────────────────────────────────────────

@api_view(['POST'])
def run_facebook_crawl(request):
    from rescue_operations.flow import admin, operator
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Kích hoạt pipeline crawl bài viết SOS từ các nhóm Facebook.

    Request Body (tùy chọn):
        {
            "group_ids":      ["111...", "222..."],  // ID nhóm cụ thể
            "lookback_hours": 6                      // Quét bao nhiêu giờ trước
        }

    Response 200:
        {
            "message": "Crawl Facebook hoàn tất",
            "stats": {
                "crawled":             15,
                "duplicates":          4,
                "saved":               8,
                "skipped_spam":        1,
                "skipped_no_location": 2,
                "errors":              0
            }
        }
    """
    group_ids      = request.data.get('group_ids', None)
    lookback_hours = int(request.data.get('lookback_hours', 6))
    headless       = bool(request.data.get('headless', True))
    scroll_times   = int(request.data.get('scroll_times', 8))
    max_posts      = int(request.data.get('max_posts_per_group', 60))

    try:
        from .crawler_pipeline import run_facebook_crawl_pipeline
        stats = run_facebook_crawl_pipeline(
            group_ids=group_ids,
            lookback_hours=lookback_hours,
            headless=headless,
            scroll_times=scroll_times,
            max_posts_per_group=max_posts,
        )
    except Exception as e:
        return Response(
            {'error': f'Lỗi khi crawl Facebook: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response({'message': 'Crawl Facebook hoàn tất', 'stats': stats})



# ─── 10. PhoBERT Classify ──────────────────────────────────────────────────────

@api_view(['POST'])
def classify_text(request):
    from rescue_operations.flow import admin, operator
    if not admin(request.user):
        return Response({'error': 'Không có quyền truy cập.'}, status=403)
    """
    Phân loại văn bản SOS bằng model PhoBERT đã fine-tune.
    Fallback sang rule-based nếu model chưa sẵn sàng.

    Request Body:
        {
            "text": "Nha em mac ket o Tam Ky, co 3 nguoi can thuyen gap"
        }

    Response 200:
        {
            "text":          "...",
            "method":        "phobert",          // hoặc "rule_based"
            "is_sos":        true,
            "label":         "RESCUE",           // chỉ có khi dùng PhoBERT
            "incident_type": "Cứu hộ khẩn cấp",
            "severity":      "CRITICAL",
            "confidence":    0.9231,
            "all_scores": {                      // chỉ có khi dùng PhoBERT
                "RESCUE": 0.9231,
                "SPAM":   0.0312,
                ...
            }
        }
    """
    text = request.data.get('text', '').strip()
    if not text:
        return Response({'error': 'Thiếu trường "text"'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Thử PhoBERT ────────────────────────────────────────────────────────
    try:
        from .nlp.phobert_analyzer import classify, is_available
        if is_available():
            result = classify(text)
            if result:
                return Response({
                    'text':          text,
                    'method':        'phobert',
                    'is_sos':        result.is_sos,
                    'label':         result.label,
                    'incident_type': result.incident_type,
                    'severity':      result.severity,
                    'confidence':    result.confidence,
                    'all_scores':    result.all_scores,
                })
    except Exception as e:
        pass  # Fall through to rule-based

    # ── Fallback: Rule-based ───────────────────────────────────────────────
    from .nlp.text_analyzer import analyze
    result = analyze('', text)

    return Response({
        'text':          text,
        'method':        'rule_based',
        'is_sos':        result.incident_type != 'Thiên tai',
        'label':         None,
        'incident_type': result.incident_type,
        'severity':      result.severity,
        'confidence':    result.confidence_score,
        'all_scores':    None,
    })
