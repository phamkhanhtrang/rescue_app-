"""
manual_full_pipeline.py
=====================
Test toan bo pipeline tu crawler → PhoBERT → Geocode → ket qua.
KHONG luu vao DB, chi in ket qua.
Chay: python -X utf8 manual_full_pipeline.py
"""

import sys, json, types, logging
from pathlib import Path

# Fix Unicode console Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ── Load .env ──────────────────────────────────────────────────────────────────
ENV_FILE = Path(__file__).parent / '.env'
env = {}
for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, _, v = line.partition('=')
    env[k.strip()] = v.strip()

# ── Mock Django settings ───────────────────────────────────────────────────────
class _FakeSettings:
    FB_EMAIL    = env.get('FB_EMAIL', '')
    FB_PASSWORD = env.get('FB_PASSWORD', '')
    FB_GROUP_IDS = [g.strip() for g in env.get('FB_GROUP_IDS', '').split(',') if g.strip()]

django_mod = types.ModuleType('django')
conf_mod   = types.ModuleType('django.conf')
conf_mod.settings = _FakeSettings()
django_mod.conf = conf_mod
sys.modules.setdefault('django', django_mod)
sys.modules.setdefault('django.conf', conf_mod)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-7s  %(message)s',
    datefmt='%H:%M:%S',
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))

sep = '=' * 65

# ─── BƯỚC 1: Crawl ────────────────────────────────────────────────────────────
print(sep)
print("  BUOC 1: Playwright Crawler")
print(sep)

from ai.crawlers.fb_playwright_crawler import FacebookPlaywrightCrawler

crawler = FacebookPlaywrightCrawler(
    headless=False,
    slow_mo=500,
    scroll_times=6,
    max_posts_per_group=50,
    lookback_hours=168,
)
items = crawler.fetch()
print(f"\n  -> Thu thap: {len(items)} bai\n")

if not items:
    print("  [!] Khong co bai nao. Kiem tra lai cookie / selector.")
    sys.exit(0)

for i, it in enumerate(items, 1):
    print(f"  [{i}] {it.facebook_author or '(an danh)'}")
    print(f"       {it.raw_title[:80]}")

# ─── BƯỚC 2: PhoBERT / NLP ────────────────────────────────────────────────────
print(f"\n{sep}")
print("  BUOC 2: PhoBERT / NLP Analyzer")
print(sep)

# Thuc su load Django de dung NLP
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'sentinel.settings'

try:
    import django
    django.setup()
    from ai.nlp.text_analyzer import analyze
    print("  -> NLP analyzer: OK")
    nlp_ok = True
except Exception as e:
    print(f"  -> NLP analyzer: FAILED ({e})")
    nlp_ok = False

if nlp_ok:
    for i, it in enumerate(items, 1):
        try:
            result = analyze(it.raw_title, it.raw_content)
            print(f"\n  [{i}] {it.raw_title[:60]}")
            print(f"       severity={result.severity} | type={result.incident_type} | conf={result.confidence_score:.3f}")
        except Exception as e:
            print(f"  [{i}] NLP ERROR: {e}")

# ─── BƯỚC 3: Geocode ──────────────────────────────────────────────────────────
print(f"\n{sep}")
print("  BUOC 3: Geocoder")
print(sep)

try:
    from ai.nlp.geocoder import geocode_from_text
    print("  -> Geocoder: OK")
    geo_ok = True
except Exception as e:
    print(f"  -> Geocoder: FAILED ({e})")
    geo_ok = False

if geo_ok:
    for i, it in enumerate(items, 1):
        try:
            geo_text = f"{getattr(it, 'extracted_address', '')} {it.raw_content}"
            lat, lng, location = geocode_from_text(geo_text)
            print(f"\n  [{i}] {it.raw_title[:60]}")
            print(f"       location={location!r} | lat={lat} | lng={lng}")
        except Exception as e:
            print(f"  [{i}] GEO ERROR: {e}")

print(f"\n{sep}")
print("  DONE")
print(sep)
