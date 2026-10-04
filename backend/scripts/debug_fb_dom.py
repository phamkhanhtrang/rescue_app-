"""
debug_fb_dom.py
===============
Debug xem Facebook đang render bài viết thế nào.
Chay: python -X utf8 debug_fb_dom.py
"""

import sys, json
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

EMAIL    = env.get('FB_EMAIL', '')
PASSWORD = env.get('FB_PASSWORD', '')
GROUP_ID = env.get('FB_GROUP_IDS', '').split(',')[0].strip()
COOKIE_FILE = Path(__file__).parent / 'ai/crawlers/fb_session_cookies.json'

print(f"Group: {GROUP_ID}")
print(f"Cookie: {COOKIE_FILE.exists()}")

from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=False, slow_mo=400)
    context = browser.new_context(
        viewport={'width': 1280, 'height': 900},
        locale='vi-VN',
    )

    # Load cookie
    if COOKIE_FILE.exists():
        context.add_cookies(json.loads(COOKIE_FILE.read_text(encoding='utf-8')))
        print("Cookie loaded")

    page = context.new_page()
    url = f"https://www.facebook.com/groups/{GROUP_ID}/?sorting_setting=RECENT_ACTIVITY"
    page.goto(url, timeout=30000)
    page.wait_for_load_state('domcontentloaded')
    page.wait_for_timeout(4000)

    # Scroll 3 lan
    for i in range(3):
        page.keyboard.press('End')
        page.wait_for_timeout(2500)

    # ── Thử các selector và in số lượng tìm được ──────────────────────────────
    selectors_to_try = [
        '[data-pagelet^="GroupFeed"] [role="article"]',
        '[role="feed"] [role="article"]',
        'div[role="article"]',
        '[role="article"]',
        'div[data-ad-comet-preview]',
    ]

    print("\n=== SELECTOR TEST ===")
    for sel in selectors_to_try:
        count = page.locator(sel).count()
        print(f"  {sel!r:60s} → {count} found")

    # ── Lấy article đầu tiên và dump HTML ─────────────────────────────────────
    print("\n=== ARTICLE[0] TEXT SELECTORS ===")
    articles = page.locator('div[role="article"]')
    if articles.count() > 0:
        art = articles.first
        text_sels = [
            '[data-ad-comet-preview="message"]',
            '[data-ad-preview="message"]',
            'div[dir="auto"][style*="text-align"]',
            'div[dir="auto"]',
            'div[data-testid="post_message"]',
            'span[dir="auto"]',
        ]
        for sel in text_sels:
            els = art.locator(sel)
            count = els.count()
            text_preview = ''
            if count > 0:
                try:
                    text_preview = els.first.inner_text(timeout=2000)[:80].replace('\n', ' ')
                except Exception:
                    text_preview = '[timeout]'
            print(f"  {sel!r:55s} count={count:2d}  text={text_preview!r}")

        # Dump inner HTML để xem cấu trúc thật
        print("\n=== ARTICLE[0] INNER HTML (500 chars) ===")
        try:
            html = art.inner_html(timeout=3000)[:500]
            print(html)
        except Exception as e:
            print(f"Error: {e}")

    page.wait_for_timeout(3000)
    browser.close()
