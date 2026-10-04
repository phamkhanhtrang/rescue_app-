"""
ai/crawler_pipeline.py
======================
Pipeline tổng hợp: Crawl → Lọc trùng → PhoBERT phân loại → Geocode → Lưu DB.

Luồng xử lý FB (Facebook SOS) — dùng Playwright (lấy bài của TẤT CẢ thành viên):
    [FacebookPlaywrightCrawler]
        ↓ Tự động login, scroll feed, parse DOM từ nhóm Facebook
        ↓ Lấy bài của TẤT CẢ thành viên (không chỉ admin/token owner)
    [Deduplicator]  ← Loại bỏ bài trùng (post_id / hash / similarity)
        ↓ unique items
    [Model A + B]   ← Nhận diện yêu cầu, đa nhãn nhu cầu và trích xuất thông tin
        ↓ Giữ cả dự đoán âm tính và lỗi để admin kiểm tra
    [Geocoder]      ← Gợi ý GPS từ địa điểm của B; không có vẫn giữ bài
    [Save to DB]    ← Lưu CrawledArticle với status='ANALYZED'
        ↓
    [Admin duyệt]   ← Sửa thông tin + xác nhận tọa độ/số người → tạo SOS | Từ chối → REJECTED

Luồng xử lý RSS/Báo chí:
    [RSS Crawler] → [Deduplicator] → [NLP Analyzer] → [Geocoder] → [Save DB]
"""

import logging
from decimal import Decimal
from django.utils import timezone

from .crawlers.rss_crawler  import RSSCrawler
from .nlp.text_analyzer     import analyze
from .nlp.geocoder          import geocode_from_text
from .nlp.deduplicator      import is_duplicate, compute_hash

logger = logging.getLogger(__name__)

# Ngưỡng tin cậy tối thiểu để tự động tạo Alert
MIN_CONFIDENCE = 0.55


def run_crawl_pipeline(platforms: list[str] = None) -> dict:
    """
    Chạy toàn bộ pipeline crawl (chỉ lấy nguồn báo chí VN).

    Args:
        platforms:          Danh sách platform RSS ['VNEXPRESS', 'TUOITRE', ...].
                            None = tất cả.

    Returns:
        dict thống kê: crawled, duplicates, saved, alerts_created, errors
    """
    from .models import CrawledArticle
    from communications.models import Alert

    stats = {
        'crawled':         0,
        'duplicates':      0,
        'saved':           0,
        'alerts_created':  0,
        'errors':          0,
        'skipped_no_location': 0,
    }

    # ── Bước 1: Thu thập dữ liệu từ các nguồn ───────────────────────────────
    all_items = []

    rss = RSSCrawler(platforms=platforms)
    all_items.extend(rss.fetch())

    stats['crawled'] = len(all_items)
    logger.info(f"[Pipeline] Crawl xong: {stats['crawled']} bài thô")

    if not all_items:
        return stats

    # ── Bước 2: Lọc trùng + Phân tích + Lưu DB ──────────────────────────────
    for item in all_items:
        try:
            c_hash = compute_hash(item.raw_title, item.raw_content)

            # Kiểm tra trùng
            dup, reason = is_duplicate(
                source_url=item.source_url,
                content_hash=c_hash,
                title=item.raw_title,
                content=item.raw_content,
            )
            if dup:
                stats['duplicates'] += 1
                logger.debug(f"[Pipeline] Bỏ qua trùng ({reason}): {item.source_url[:60]}")
                continue

            # Phân tích NLP
            analysis = analyze(item.raw_title, item.raw_content)

            # Geocode
            full_text = f"{item.raw_title} {item.raw_content}"
            lat, lng, location_name = geocode_from_text(full_text)

            # YÊU CẦU MỚI: CHỈ LẤY CÁC BÀI VIẾT CÓ NHẮC ĐẾN TỈNH/THÀNH VIỆT NAM
            if not location_name:
                stats['skipped_no_location'] += 1
                logger.debug(f"[Pipeline] Bỏ qua vì không xác định được tỉnh/thành: {item.source_url[:60]}")
                continue

            # Lưu vào DB với trạng thái chờ duyệt
            article = CrawledArticle.objects.create(
                source_platform        = item.source_platform,
                source_url             = item.source_url,
                raw_title              = item.raw_title,
                raw_content            = item.raw_content,
                content_hash           = c_hash,
                extracted_location     = location_name,
                extracted_lat          = Decimal(str(lat)) if lat else None,
                extracted_lng          = Decimal(str(lng)) if lng else None,
                extracted_severity     = analysis.severity,
                extracted_incident_type= analysis.incident_type,
                confidence_score       = Decimal(str(analysis.confidence_score)),
                status                 = 'ANALYZED',
                analyzed_at            = timezone.now(),
            )
            stats['saved'] += 1

            # YÊU CẦU MỚI: BẮT BUỘC QUA ADMIN DUYỆT. Bỏ logic tạo Alert tự động.
            # (Đoạn code auto create alert đã bị xóa hoàn toàn để tuân thủ quy trình)

        except Exception as e:
            stats['errors'] += 1
            logger.error(f"[Pipeline] Lỗi xử lý {item.source_url[:60]}: {e}")

    logger.info(
        f"[Pipeline] Hoàn tất: "
        f"{stats['saved']} lưu, "
        f"{stats['duplicates']} trùng, "
        f"{stats['skipped_no_location']} không rõ tỉnh/thành, "
        f"{stats['errors']} lỗi"
    )
    return stats


def run_facebook_crawl_pipeline(
    group_ids: list = None,
    lookback_hours: int = 6,
    headless: bool = True,
    scroll_times: int = 8,
    max_posts_per_group: int = 60,
) -> dict:
    """
    Pipeline riêng cho Facebook SOS Crawler (Playwright).

    Sử dụng FacebookPlaywrightCrawler — tự động login Facebook và lấy bài
    của TẤT CẢ thành viên trong group (không chỉ admin/token owner).

    Args:
        group_ids:           Danh sách Facebook Group ID cần quét. None = đọc từ settings.
        lookback_hours:      Chỉ lấy bài trong N giờ gần đây (mặc định 6h).
        headless:            True = chạy ngầm (production). False = mở cửa sổ (debug).
        scroll_times:        Số lần scroll để load thêm bài.
        max_posts_per_group: Số bài tối đa mỗi group.

    Returns:
        dict thống kê: crawled, duplicates, saved, skipped_no_location, skipped_spam, errors
    """
    from .models import CrawledArticle
    from .crawlers.fb_playwright_crawler import FacebookPlaywrightCrawler

    stats = {
        'crawled':             0,
        'duplicates':          0,
        'saved':               0,
        'skipped_no_location': 0,
        'skipped_spam':        0,
        'errors':              0,
    }

    # ── Bước 1: Crawl Facebook Groups bằng Playwright ────────────────────────
    fb = FacebookPlaywrightCrawler(
        group_ids=group_ids,
        lookback_hours=lookback_hours,
        headless=headless,
        scroll_times=scroll_times,
        max_posts_per_group=max_posts_per_group,
    )
    items = fb.fetch()
    stats['crawled'] = len(items)
    logger.info(f"[FB Pipeline] Thu thập được {stats['crawled']} bài SOS thô")

    if not items:
        return stats

    # ── Bước 2: Lọc trùng + Phân tích (PhoBERT) + Geocode + Lưu DB ──────────
    for item in items:
        try:
            c_hash = compute_hash(item.raw_title, item.raw_content)

            # Kiểm tra trùng
            if getattr(item, 'facebook_post_id', None):
                if CrawledArticle.objects.filter(facebook_post_id=item.facebook_post_id).exists():
                    stats['duplicates'] += 1
                    continue
            
            dup, reason = is_duplicate(item.source_url, c_hash, item.raw_title, item.raw_content)
            if dup:
                stats['duplicates'] += 1
                continue

            # Both models propose data; every unique post remains available for human review.
            from .sos_article_analysis import predict_article, suggested_fields, geocode_prediction
            try:
                prediction = predict_article(item.raw_title, item.raw_content)
                fields = suggested_fields(prediction)
                fields['extracted_lat'], fields['extracted_lng'] = geocode_prediction(prediction)
            except Exception:
                logger.exception('[FB Pipeline] Two-model analysis failed; retaining article for review')
                prediction = {'method': 'unavailable', 'requires_review': True,
                              'error': 'Chưa phân tích được bằng hai model. Hãy phân tích lại hoặc nhập thông tin khi duyệt.'}
                fields = {}
                stats['errors'] += 1
            CrawledArticle.objects.create(
                source_platform='FACEBOOK', source_url=item.source_url,
                raw_title=item.raw_title, raw_content=item.raw_content, content_hash=c_hash,
                ai_analysis=prediction, **fields,
                facebook_post_id=getattr(item, 'facebook_post_id', None),
                facebook_author=getattr(item, 'facebook_author', ''),
                extracted_phone=getattr(item, 'extracted_phone', ''),
                has_media=getattr(item, 'has_media', False),
                fb_reactions_count=getattr(item, 'fb_reactions_count', 0),
                status='ANALYZED', analyzed_at=timezone.now(),
            )
            stats['saved'] += 1

        except Exception as e:
            stats['errors'] += 1
            logger.error(f"[FB Pipeline] Lỗi xử lý {item.source_url[:60]}: {e}")

    logger.info(
        f"[FB Pipeline] Hoàn tất: "
        f"{stats['saved']} lưu, {stats['duplicates']} trùng, "
        f"{stats['skipped_spam']} SPAM, "
        f"{stats['skipped_no_location']} không rõ tỉnh/thành, "
        f"{stats['errors']} lỗi"
    )
    return stats
