import sys, json, time
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ENV_FILE = Path(__file__).parent / '.env'
env = {}
for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, _, v = line.partition('=')
    env[k.strip()] = v.strip()

GROUP_ID = env.get('FB_GROUP_IDS', '').split(',')[0].strip()
COOKIE_FILE = Path(__file__).parent / 'ai/crawlers/fb_session_cookies.json'

from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, slow_mo=200)
    context = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='vi-VN')
    if COOKIE_FILE.exists():
        context.add_cookies(json.loads(COOKIE_FILE.read_text(encoding='utf-8')))

    page = context.new_page()
    url = f"https://www.facebook.com/groups/{GROUP_ID}/?sorting_setting=RECENT_ACTIVITY"
    print(f"Loading {url} ...")
    page.goto(url, timeout=30000)
    page.wait_for_load_state('domcontentloaded')
    page.wait_for_timeout(5000)

    # In ra cac the truoc khi scroll
    count_before = page.locator('div[role="article"]').count()
    print(f"TRUOC KHI SCROLL: Thay {count_before} bai viet (role='article')")

    seen = set()
    print("Bat dau scroll 6 lan...")
    for i in range(6):
        page.keyboard.press('End')
        page.wait_for_timeout(3000)
        articles = page.locator('div[role="article"]')
        c = articles.count()
        print(f"  - Lan {i+1}: Hien co {c} bai viet tren man hinh")
        for j in range(c):
            art = articles.nth(j)
            text = ''
            for sel in [
                '[data-ad-comet-preview="message"]',
                '[data-ad-preview="message"]',
                'div[dir="auto"][style*="text-align"]',
                'div[dir="auto"]'
            ]:
                try:
                    el = art.locator(sel).first
                    if el.count() > 0:
                        t = el.inner_text(timeout=500).strip()
                        if t and len(t) > len(text):
                            text = t
                except:
                    pass
            if text and text not in seen:
                seen.add(text)
                print(f"    -> TIM THAY BAI MOI: {text[:80]}...")

    print(f"\nTong so bai DOC DUOC duy nhat: {len(seen)}")
    browser.close()

