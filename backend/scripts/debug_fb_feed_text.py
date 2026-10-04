import sys, json, time
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

COOKIE_FILE = Path(__file__).parent / 'ai/crawlers/fb_session_cookies.json'
GROUP_ID = "2408015609610931"

from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='vi-VN')
    if COOKIE_FILE.exists():
        context.add_cookies(json.loads(COOKIE_FILE.read_text(encoding='utf-8')))

    page = context.new_page()
    url = f"https://www.facebook.com/groups/{GROUP_ID}/?sorting_setting=RECENT_ACTIVITY"
    page.goto(url, timeout=30000)
    page.wait_for_load_state('domcontentloaded')
    page.wait_for_timeout(5000)

    for i in range(5):
        page.keyboard.press('End')
        page.wait_for_timeout(3000)

    print("ALL TEXT IN FEED:")
    try:
        feed = page.locator('div[role="feed"]').first
        if feed.count() > 0:
            texts = feed.inner_text().split('\n')
            for t in texts:
                t = t.strip()
                if len(t) > 20:
                    print(f"- {t}")
        else:
            print("No role=feed found")
    except Exception as e:
        print("Error:", e)
        
    browser.close()
