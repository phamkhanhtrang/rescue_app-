"""
Test script: Chạy full Facebook crawl pipeline + kiểm tra DB
  python manual_crawl_fb.py
"""
import sys, io, logging
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

logging.basicConfig(level=logging.INFO, format='%(levelname)s  %(name)s  %(message)s')

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinel.settings')
import django; django.setup()

from django.conf import settings
print("=== CẤU HÌNH ===")
print(f"FB_EMAIL    : {getattr(settings, 'FB_EMAIL', None)}")
print(f"FB_PASSWORD : {'***' if getattr(settings, 'FB_PASSWORD', None) else None}")
print(f"FB_GROUP_IDS: {getattr(settings, 'FB_GROUP_IDS', None)}")

print("\n=== BƯỚC 1: CRAWL TRỰC TIẾP ===")
from ai.crawlers.fb_playwright_crawler import FacebookPlaywrightCrawler

crawler = FacebookPlaywrightCrawler(
    headless=True,
    slow_mo=800,
    scroll_times=3,
    max_posts_per_group=10
)
items = crawler.fetch()
print(f"→ Thu thập được {len(items)} bài thô từ Facebook")
for it in items:
    print(f"  [{it.facebook_author}] {it.raw_title[:80]}")

print("\n=== BƯỚC 2: CHẠY PIPELINE ĐẦY ĐỦ (Dedup + PhoBERT + Geocode + Lưu DB) ===")
from ai.crawler_pipeline import run_facebook_crawl_pipeline

stats = run_facebook_crawl_pipeline(
    headless=True,
    scroll_times=3,
    max_posts_per_group=10
)
print("Stats:", stats)

print("\n=== BƯỚC 3: KIỂM TRA DỮ LIỆU ĐÃ LƯU VÀO DB ===")
from ai.models import CrawledArticle

fb_articles = CrawledArticle.objects.filter(source_platform='FACEBOOK').order_by('-crawled_at')[:10]
print(f"→ Tổng bài Facebook trong DB: {CrawledArticle.objects.filter(source_platform='FACEBOOK').count()}")
for a in fb_articles:
    print(f"\n  ID: {a.id}")
    print(f"  Title   : {a.raw_title[:80]}")
    print(f"  Status  : {a.status}")
    print(f"  Location: {a.extracted_location}")
    print(f"  Severity: {a.extracted_severity}")
    print(f"  Confidence: {a.confidence_score}")
    print(f"  Author  : {a.facebook_author}")
    print(f"  Phone   : {a.extracted_phone}")

print("\n=== XONG ===")
