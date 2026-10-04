"""
Kiểm tra Facebook Crawler thủ công với thông tin chi tiết từng bài.
Chạy: python manual_fb_check.py
"""
import os, django, requests
from datetime import datetime, timedelta, timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinel.settings')
django.setup()

from django.conf import settings as s
from ai.crawlers.fb_crawler import MANDATORY_KEYWORDS

TOKEN  = s.FB_PAGE_ACCESS_TOKEN
GROUP  = s.FB_GROUP_IDS[0]
BASE   = "https://graph.facebook.com/v25.0"
since  = int((datetime.now(timezone.utc) - timedelta(hours=24)).timestamp())

print(f"Group ID : {GROUP}")
print(f"Since    : {datetime.fromtimestamp(since).strftime('%Y-%m-%d %H:%M')}")
print("=" * 60)

r = requests.get(f"{BASE}/{GROUP}/feed", params={
    'fields': 'id,message,created_time,from,permalink_url',
    'access_token': TOKEN,
    'limit': 20,
    'since': since,
})
data = r.json()
posts = data.get('data', [])
print(f"Total posts in 24h: {len(posts)}")

for i, p in enumerate(posts, 1):
    msg = p.get('message', '')
    has_sos = any(kw in msg.lower() for kw in MANDATORY_KEYWORDS)
    print(f"\n[{i}] {p.get('created_time')}")
    print(f"  has_message: {bool(msg)}")
    print(f"  is_sos     : {has_sos}")
    print(f"  message    : {msg[:100] if msg else '(khong co text)'}")
