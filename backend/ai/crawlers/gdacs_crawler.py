"""
ai/crawlers/gdacs_crawler.py
============================
Crawler lấy dữ liệu thiên tai quốc tế từ GDACS (Global Disaster Alert and Coordination System).
API miễn phí, không cần API key.

Endpoint: https://www.gdacs.org/xml/rss.xml  (RSS toàn cầu)
Docs: https://www.gdacs.org/Alerts/
"""

import logging
# pyrefly: ignore [missing-import]
import feedparser
from .base_crawler import BaseCrawler, CrawledItem

logger = logging.getLogger(__name__)

GDACS_RSS_URL = 'https://www.gdacs.org/xml/rss.xml'

# Các quốc gia / khu vực quan tâm (lọc bớt tin không liên quan)
RELEVANT_COUNTRIES = [
    'vietnam', 'viet nam', 'philippines', 'thailand', 'laos', 'cambodia',
    'myanmar', 'indonesia', 'malaysia', 'china', 'taiwan',
]


class GDACSCrawler(BaseCrawler):
    """
    Crawl cảnh báo thiên tai từ GDACS RSS feed.
    Lọc theo khu vực Đông Nam Á / Châu Á.
    """

    def fetch(self) -> list[CrawledItem]:
        items = []
        try:
            feed = feedparser.parse(GDACS_RSS_URL)
            for entry in feed.entries:
                title   = getattr(entry, 'title',   '') or ''
                summary = getattr(entry, 'summary', '') or ''
                link    = getattr(entry, 'link',    '') or ''

                if not link:
                    continue

                combined = f"{title} {summary}".lower()

                # Lọc theo khu vực liên quan
                if not any(c in combined for c in RELEVANT_COUNTRIES):
                    continue

                # GDACS luôn là tin thiên tai nên không cần lọc keyword
                items.append(CrawledItem(
                    source_platform='GDACS',
                    source_url=link,
                    raw_title=title.strip(),
                    raw_content=summary.strip(),
                ))

            logger.info(f"[GDACSCrawler] {len(items)} cảnh báo khu vực ĐNA")
        except Exception as e:
            logger.error(f"[GDACSCrawler] Lỗi: {e}")
        return items
