"""
ai/nlp/deduplicator.py
======================
Lọc trùng lặp bài viết crawl theo 2 tầng:

  Tầng 1 — Hash (O(1)):
    So sánh MD5 hash của nội dung đã chuẩn hóa.
    → Bắt được bài copy nguyên văn / repost.

  Tầng 2 — Similarity (O(n), chỉ khi Tầng 1 qua):
    Dùng difflib.SequenceMatcher để so sánh nội dung với các bài
    đã lưu trong 24h gần đây.
    Ngưỡng mặc định: 85% tương đồng → coi là trùng.
"""

import hashlib
import logging
from difflib import SequenceMatcher
from datetime import timedelta
from django.utils import timezone

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.85    # 85% giống nhau → trùng
RECENT_HOURS         = 24      # Chỉ so sánh với bài trong 24h gần đây


def normalize(text: str) -> str:
    """Chuẩn hóa văn bản: lowercase, bỏ khoảng trắng thừa."""
    return ' '.join(text.lower().split())


def compute_hash(title: str, content: str) -> str:
    """Tính MD5 hash của (title + content) đã chuẩn hóa."""
    text = normalize(f"{title} {content}")
    return hashlib.md5(text.encode('utf-8')).hexdigest()


def is_duplicate(source_url: str, content_hash: str,
                 title: str, content: str) -> tuple[bool, str]:
    """
    Kiểm tra bài viết có bị trùng với dữ liệu trong DB không.

    Args:
        source_url:   URL gốc bài viết.
        content_hash: MD5 hash nội dung (tính sẵn từ CrawledItem).
        title:        Tiêu đề.
        content:      Nội dung.

    Returns:
        (is_dup: bool, reason: str)
        reason ví dụ: 'url_exists', 'hash_match', 'similar_content', ''
    """
    from ai.models import CrawledArticle

    # ── Tầng 0: Trùng URL ────────────────────────────────────────────────────
    if CrawledArticle.objects.filter(source_url=source_url).exists():
        return True, 'url_exists'

    # ── Tầng 1: Trùng hash ───────────────────────────────────────────────────
    if CrawledArticle.objects.filter(content_hash=content_hash).exists():
        return True, 'hash_match'

    # ── Tầng 2: So sánh nội dung tương tự (trong 24h gần đây) ───────────────
    cutoff    = timezone.now() - timedelta(hours=RECENT_HOURS)
    recent    = CrawledArticle.objects.filter(crawled_at__gte=cutoff)\
                                      .values_list('raw_title', 'raw_content')

    new_text  = normalize(f"{title} {content}")
    for old_title, old_content in recent:
        old_text = normalize(f"{old_title or ''} {old_content or ''}")
        ratio    = SequenceMatcher(None, new_text, old_text).ratio()
        if ratio >= SIMILARITY_THRESHOLD:
            logger.debug(f"[Dedup] Similarity {ratio:.2f} vượt ngưỡng → từ chối")
            return True, f'similar_content({ratio:.0%})'

    return False, ''
