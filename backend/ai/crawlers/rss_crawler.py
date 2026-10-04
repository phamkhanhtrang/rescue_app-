"""
ai/crawlers/rss_crawler.py
==========================
Crawler đọc RSS feed từ các báo Việt Nam để lấy tin thiên tai.

Các nguồn RSS (miễn phí, không cần API key):
  - VnExpress: Thời sự, Xã hội
  - Tuổi Trẻ:  Thời sự
  - Thanh Niên: Thời sự

Mỗi nguồn được crawl, lọc qua từ khóa thiên tai, rồi trả về CrawledItem.
"""

import logging
# pyrefly: ignore [missing-import]
import feedparser
from .base_crawler import BaseCrawler, CrawledItem

logger = logging.getLogger(__name__)

# ─── Danh sách RSS feed ──────────────────────────────────────────────────────

RSS_SOURCES = {
    'VNEXPRESS': [
        'https://vnexpress.net/rss/tin-tuc-toi.rss',
        'https://vnexpress.net/rss/thoi-su.rss',
        'https://vnexpress.net/rss/xa-hoi.rss',
    ],
    'TUOITRE': [
        'https://tuoitre.vn/rss/thoi-su.rss',
    ],
    'THANHNIEN': [
        'https://thanhnien.vn/rss/thoi-su.rss',
    ],
}


class RSSCrawler(BaseCrawler):
    """
    Crawl tin thiên tai từ RSS feed của các báo Việt Nam.
    Lọc bài chỉ liên quan đến thiên tai/cứu hộ trước khi trả về.
    """

    def __init__(self, platforms: list[str] = None):
        """
        Args:
            platforms: Danh sách platform cần crawl. None = crawl tất cả.
                       Ví dụ: ['VNEXPRESS', 'TUOITRE']
        """
        self.platforms = platforms or list(RSS_SOURCES.keys())

    def fetch(self) -> list[CrawledItem]:
        """Crawl tất cả RSS feed đã cấu hình, trả về CrawledItem liên quan thiên tai."""
        results = []
        for platform in self.platforms:
            urls = RSS_SOURCES.get(platform, [])
            for url in urls:
                items = self._fetch_one_feed(platform, url)
                results.extend(items)
        logger.info(f"[RSSCrawler] Tổng: {len(results)} bài liên quan thiên tai")
        return results

    def _fetch_one_feed(self, platform: str, feed_url: str) -> list[CrawledItem]:
        """Đọc một RSS feed, lọc bài thiên tai, trả về CrawledItem."""
        items = []
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                title   = getattr(entry, 'title',   '') or ''
                summary = getattr(entry, 'summary', '') or ''
                link    = getattr(entry, 'link',    '') or ''

                if not link:
                    continue

                combined = f"{title} {summary}"
                if not self.is_disaster_related(combined):
                    continue

                items.append(CrawledItem(
                    source_platform=platform,
                    source_url=link,
                    raw_title=title.strip(),
                    raw_content=summary.strip(),
                ))

            logger.debug(f"[RSSCrawler] {platform} {feed_url}: {len(items)} bài lọc được")
        except Exception as e:
            logger.error(f"[RSSCrawler] Lỗi feed {feed_url}: {e}")
        return items
