"""
manual_playwright_crawler.py
==========================
Script test thu cong FacebookPlaywrightCrawler.
Chay: python manual_playwright_crawler.py

Khong can Django - doc .env truc tiep.
"""

import os
import sys
import logging
from pathlib import Path

# Fix Unicode console Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Doc .env thu cong (khong qua Django) ──────────────────────────────────────
ENV_FILE = Path(__file__).parent / '.env'

def load_env(path: Path):
    """Parse .env don gian."""
    env = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, val = line.partition('=')
        env[key.strip()] = val.strip()
    return env

_env = load_env(ENV_FILE)

# ── Mock Django settings ───────────────────────────────────────────────────────
class _FakeSettings:
    FB_EMAIL    = _env.get('FB_EMAIL', '')
    FB_PASSWORD = _env.get('FB_PASSWORD', '')
    FB_GROUP_IDS = [
        g.strip() for g in _env.get('FB_GROUP_IDS', '').split(',') if g.strip()
    ]

import types
django_mod   = types.ModuleType('django')
conf_mod     = types.ModuleType('django.conf')
conf_mod.settings = _FakeSettings()
django_mod.conf   = conf_mod
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

# ── Import crawler ────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from ai.crawlers.fb_playwright_crawler import FacebookPlaywrightCrawler

# ── Chay test ─────────────────────────────────────────────────────────────────
def main():
    sep = "=" * 60
    print(sep)
    print("  TEST: FacebookPlaywrightCrawler")
    print(f"  Email  : {_FakeSettings.FB_EMAIL}")
    print(f"  Groups : {_FakeSettings.FB_GROUP_IDS}")
    print(sep)

    crawler = FacebookPlaywrightCrawler(
        headless=False,        # Mo cua so de xem — doi True khi production
        slow_mo=600,
        scroll_times=6,        # Tang scroll de load nhieu bai hon
        max_posts_per_group=50,
        lookback_hours=168,    # 7 ngay de chac chan co bai
    )

    items = crawler.fetch()

    print()
    print(sep)
    print(f"  Ket qua: {len(items)} bai thu thap (chua qua PhoBERT)")
    print(sep)

    if not items:
        print("  [!] Khong thu thap duoc bai nao.")
        print("  Goi y:")
        print("    - Kiem tra fb_login_debug.png neu login that bai")
        print("    - Thu tang scroll_times hoac lookback_hours")
        print("    - Facebook co the da thay doi DOM selector")
        return

    for i, item in enumerate(items, 1):
        author = (item.facebook_author or '(an danh)').encode('utf-8', errors='replace').decode('utf-8')
        title  = item.raw_title.encode('utf-8', errors='replace').decode('utf-8')
        addr   = (item.extracted_address or '--').encode('utf-8', errors='replace').decode('utf-8')
        print(f"\n  [{i}] {author}")
        print(f"      Noi dung : {title[:80]}")
        print(f"      SDT      : {item.extracted_phone or '--'}")
        print(f"      Nguoi    : {item.extracted_people_count or '--'}")
        print(f"      Dia chi  : {addr}")
        print(f"      URL      : {item.source_url}")

if __name__ == '__main__':
    main()
