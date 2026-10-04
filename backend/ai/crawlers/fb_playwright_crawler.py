"""
ai/crawlers/fb_playwright_crawler.py
=====================================
Crawler thu thập bài viết từ Facebook Group bằng Playwright.

KHÔNG dùng Graph API → lấy được bài của TẤT CẢ thành viên.

Yêu cầu cấu hình (trong .env hoặc settings.py):
    FB_EMAIL        = "your_email@gmail.com"
    FB_PASSWORD     = "your_password"
    FB_GROUP_IDS    = ["2408015609610931"]

Cách hoạt động:
    1. Khởi động Chromium ở chế độ headless (hoặc headed để debug).
    2. Tự động đăng nhập Facebook bằng tài khoản cấu hình.
    3. Mở từng group URL, scroll feed để load thêm bài.
    4. Parse TẤT CẢ bài viết có text từ DOM (không lọc từ khóa).
    5. Trả về CrawledItem → PhoBERT phân loại SOS/SPAM/INFO...

Lưu ý:
    - Facebook có thể yêu cầu OTP/2FA → lần đầu chạy nên bật headed=True.
    - Cookie session được lưu vào file JSON để tái sử dụng (tránh login lại).
    - Sử dụng playwright-stealth để bypass bot-detection.
    - Tuân thủ robots.txt và điều khoản sử dụng của Facebook.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .base_crawler import BaseCrawler, CrawledItem

logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────
# Lưu cookie session cạnh file này
_DIR = Path(__file__).parent
COOKIE_FILE = _DIR / "fb_session_cookies.json"

# ─── Keywords (giữ nguyên từ fb_crawler.py) ──────────────────────────────────
MANDATORY_KEYWORDS = [
    'sos', 'cứu', 'giúp với', 'cứu với', 'cấp cứu', 'khẩn cấp',
    'mắc kẹt', 'kẹt', 'ngập', 'chìm', 'sập', 'bị kẹt',
    'cứu hộ', 'cứu nạn', 'xin cứu', 'ai cứu', 'cứu giúp',
    'nước dâng', 'nước lên', 'bị trôi', 'lũ cuốn',
    'cần giúp', 'đang chìm', 'không ra được',
]

ADDRESS_PATTERNS = [
    r'(?:địa chỉ|ở tại|đang ở|tại nhà số)\s*:?\s*(.{10,80}?)(?:\.|,|\n|$)',
    r'số\s+\d+[\s,]*(?:đường|ngõ|hẻm|kiệt|phố)\s+[\w\s]+',
    r'(?:phường|xã|thôn|ấp)\s+[\w\s]+[,\s]+(?:quận|huyện|tp)\s+[\w\s]+',
]
PEOPLE_PATTERNS = [
    r'(\d+)\s*(?:người|hộ dân|gia đình|thành viên|nhân khẩu)',
    r'(?:cả nhà|gia đình)\s*(?:có)?\s*(\d+)',
    r'(?:khoảng|gần)\s*(\d+)\s*người',
]
PHONE_PATTERNS = [
    r'(?:sdt|số dt|điện thoại|liên hệ|gọi|tel)\s*:?\s*(0\d{9,10})',
    r'\b(0[35789]\d{8})\b',
    r'\b(0[3-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{4})\b',
]


# ─── CSS Selectors (cập nhật khi Facebook thay đổi DOM) ─────────────────────
class FBSelectors:
    """
    Tập trung selector Facebook để dễ bảo trì.
    Facebook hay thay class → chỉnh sửa tại đây.
    """
    # Login form
    EMAIL_INPUT    = '#email'
    PASSWORD_INPUT = '#pass'
    LOGIN_BTN      = '[name="login"]'

    # Feed post containers — thứ tự ưu tiên từ cụ thể → tổng quát
    POST_CONTAINERS = [
        '[data-pagelet^="GroupFeed"] [role="article"]',
        '[role="feed"] [role="article"]',
        'div[role="article"]',
    ]

    # Nội dung text của bài viết
    POST_TEXT_SELECTORS = [
        '[data-ad-comet-preview="message"]',
        '[data-ad-preview="message"]',
        'div[dir="auto"][style*="text-align"]',
        'div[dir="auto"]',
    ]

    # Nút "See more" / "Xem thêm"
    SEE_MORE = 'div[role="button"]:has-text("See more"), div[role="button"]:has-text("Xem thêm")'

    # Tên tác giả
    AUTHOR = 'h2 a, h3 a, strong a'

    # Thời gian đăng
    TIMESTAMP = 'a[role="link"] abbr, abbr[data-utime]'

    # Link bài viết
    POST_LINK = 'a[href*="/posts/"], a[href*="story_fbid"], a[href*="permalink"]'

    # Nút đóng popup (nếu có)
    CLOSE_POPUP = '[aria-label="Close"], [aria-label="Đóng"]'

    # Cookie consent
    ACCEPT_COOKIES = '[data-cookiebanner="accept_button"], button:has-text("Allow essential")'


class FacebookPlaywrightCrawler(BaseCrawler):
    """
    Crawler Facebook Group dùng Playwright.
    Lấy bài của TẤT CẢ thành viên, không chỉ admin/token-owner.
    """

    PLATFORM = 'FACEBOOK'

    def __init__(
        self,
        email: str = None,
        password: str = None,
        group_ids: list[str] = None,
        lookback_hours: int = 6,
        max_posts_per_group: int = 50,
        scroll_times: int = 8,
        headless: bool = True,
        slow_mo: int = 500,
    ):
        """
        Args:
            email:               Tài khoản Facebook (email/số điện thoại).
                                 None → đọc từ settings.FB_EMAIL
            password:            Mật khẩu Facebook.
                                 None → đọc từ settings.FB_PASSWORD
            group_ids:           Danh sách Group ID cần crawl.
                                 None → đọc từ settings.FB_GROUP_IDS
            lookback_hours:      Chỉ lấy bài trong N giờ gần đây.
            max_posts_per_group: Số bài tối đa mỗi group.
            scroll_times:        Số lần scroll để load thêm bài.
            headless:            True = chạy ngầm, False = mở cửa sổ trình duyệt.
            slow_mo:             Độ trễ giữa các thao tác (ms). Tăng nếu bị detect.
        """
        from django.conf import settings

        self.email    = email    or getattr(settings, 'FB_EMAIL',    None)
        self.password = password or getattr(settings, 'FB_PASSWORD', None)
        self.group_ids = (
            group_ids
            or getattr(settings, 'FB_GROUP_IDS', [])
        )
        self.lookback_hours      = lookback_hours
        self.max_posts_per_group = max_posts_per_group
        self.scroll_times        = scroll_times
        self.headless            = headless
        self.slow_mo             = slow_mo

    # ─── Public ───────────────────────────────────────────────────────────────

    def fetch(self) -> list[CrawledItem]:
        if not self.email or not self.password:
            logger.warning("[FB-PW] FB_EMAIL / FB_PASSWORD chưa cấu hình. Bỏ qua.")
            return []
        if not self.group_ids:
            logger.warning("[FB-PW] FB_GROUP_IDS trống. Bỏ qua.")
            return []

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.error("[FB-PW] Playwright chưa cài. Chạy: pip install playwright && python -m playwright install chromium")
            return []

        results: list[CrawledItem] = []

        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=self.headless,
                slow_mo=self.slow_mo,
                args=[
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                ],
            )

            context = browser.new_context(
                viewport={'width': 1280, 'height': 900},
                user_agent=(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/120.0.0.0 Safari/537.36'
                ),
                locale='vi-VN',
                timezone_id='Asia/Ho_Chi_Minh',
            )

            # Áp dụng stealth để bypass bot detection
            self._apply_stealth(context)

            # Khôi phục session hoặc đăng nhập mới
            if not self._restore_session(context):
                if not self._login(context):
                    browser.close()
                    logger.error("[FB-PW] Đăng nhập thất bại.")
                    return []
                self._save_session(context)

            # Crawl từng group
            page = context.new_page()
            for group_id in self.group_ids:
                try:
                    posts = self._crawl_group(page, group_id)
                    results.extend(posts)
                    logger.info(f"[FB-PW] Group {group_id}: {len(posts)} bài → PhoBERT phân loại")
                except Exception as exc:
                    logger.error(f"[FB-PW] Lỗi crawl group {group_id}: {exc}", exc_info=True)

            page.close()
            browser.close()

        logger.info(f"[FB-PW] Tổng {len(results)} bài thu thập → chuyển sang PhoBERT phân loại")
        return results

    # ─── Session management ───────────────────────────────────────────────────

    def _apply_stealth(self, context) -> None:
        """Thêm script stealth để tránh bị Facebook detect là bot."""
        try:
            from playwright_stealth import stealth_sync
            # stealth_sync áp dụng lên page, không phải context
            # → sẽ áp dụng khi tạo page
            self._stealth_fn = stealth_sync
        except ImportError:
            self._stealth_fn = None
            logger.warning("[FB-PW] playwright-stealth chưa cài. Bot detection có thể xảy ra.")

        # Inject script để ẩn webdriver flag
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['vi-VN', 'vi', 'en-US', 'en'],
            });
        """)

    def _restore_session(self, context) -> bool:
        """Load cookie từ file để bỏ qua bước login."""
        if not COOKIE_FILE.exists():
            return False
        try:
            cookies = json.loads(COOKIE_FILE.read_text(encoding='utf-8'))
            context.add_cookies(cookies)
            logger.info(f"[FB-PW] Session khôi phục từ {COOKIE_FILE}")
            # Kiểm tra session còn hợp lệ không
            page = context.new_page()
            page.goto('https://www.facebook.com/', timeout=20000)
            page.wait_for_load_state('domcontentloaded')
            is_logged = self._is_logged_in(page)
            page.close()
            if not is_logged:
                logger.warning("[FB-PW] Session cookie đã hết hạn → sẽ login lại.")
                COOKIE_FILE.unlink(missing_ok=True)
                return False
            return True
        except Exception as exc:
            logger.warning(f"[FB-PW] Không thể khôi phục session: {exc}")
            return False

    def _save_session(self, context) -> None:
        """Lưu cookie hiện tại ra file."""
        try:
            cookies = context.cookies()
            COOKIE_FILE.write_text(
                json.dumps(cookies, ensure_ascii=False, indent=2),
                encoding='utf-8',
            )
            logger.info(f"[FB-PW] Session đã lưu vào {COOKIE_FILE}")
        except Exception as exc:
            logger.warning(f"[FB-PW] Không thể lưu session: {exc}")

    def _is_logged_in(self, page) -> bool:
        """Kiểm tra đang đăng nhập chưa dựa vào URL/DOM."""
        url = page.url
        return 'login' not in url and 'checkpoint' not in url

    # ─── Login flow ───────────────────────────────────────────────────────────

    def _login(self, context) -> bool:
        """
        Tự động đăng nhập Facebook.
        Trả về True nếu thành công.
        """
        page = context.new_page()
        if self._stealth_fn:
            self._stealth_fn(page)

        try:
            logger.info("[FB-PW] Dang dang nhap Facebook...")

            # Vào trang chủ trước, chờ load xong rồi mới điền form
            page.goto('https://www.facebook.com/', timeout=30000)
            page.wait_for_load_state('domcontentloaded')
            page.wait_for_timeout(2000)

            # Chấp nhận cookie nếu có popup
            self._dismiss_cookie_banner(page)
            page.wait_for_timeout(1000)

            # Thử nhiều selector cho ô email (Facebook hay thay đổi)
            EMAIL_SELECTORS = [
                '#email',
                'input[name="email"]',
                'input[type="email"]',
                'input[aria-label*="email"]',
                'input[aria-label*="Email"]',
                'input[data-testid="royal_email"]',
            ]
            email_filled = False
            for sel in EMAIL_SELECTORS:
                try:
                    page.wait_for_selector(sel, timeout=5000, state='visible')
                    page.fill(sel, self.email)
                    email_filled = True
                    logger.info(f"[FB-PW] Filled email with selector: {sel}")
                    break
                except Exception:
                    continue

            if not email_filled:
                # Chụp screenshot để debug
                page.screenshot(path='fb_login_debug.png')
                logger.error("[FB-PW] Khong tim thay o nhap email. Da luu fb_login_debug.png")
                page.close()
                return False

            page.wait_for_timeout(500)

            # Password
            PASS_SELECTORS = [
                '#pass',
                'input[name="pass"]',
                'input[type="password"]',
                'input[data-testid="royal_pass"]',
            ]
            for sel in PASS_SELECTORS:
                try:
                    page.fill(sel, self.password)
                    break
                except Exception:
                    continue

            page.wait_for_timeout(500)

            # Click nút login
            LOGIN_SELECTORS = [
                '[name="login"]',
                'button[type="submit"]',
                '[data-testid="royal_login_button"]',
            ]
            for sel in LOGIN_SELECTORS:
                try:
                    page.click(sel, timeout=5000)
                    break
                except Exception:
                    continue

            # Chờ redirect sau login
            page.wait_for_load_state('networkidle', timeout=20000)

            current_url = page.url

            # Xử lý 2FA / checkpoint
            if 'checkpoint' in current_url or 'two_step' in current_url:
                logger.warning(
                    "[FB-PW] Facebook yêu cầu xác minh (2FA/checkpoint). "
                    "Hãy chạy lại với headless=False và hoàn tất xác minh thủ công."
                )
                # Chờ người dùng xác minh thủ công (nếu headed)
                if not self.headless:
                    logger.info("[FB-PW] Đợi 60s để hoàn tất xác minh 2FA...")
                    page.wait_for_timeout(60000)
                    if self._is_logged_in(page):
                        logger.info("[FB-PW] Xác minh 2FA thành công!")
                        page.close()
                        return True
                page.close()
                return False

            if self._is_logged_in(page):
                logger.info("[FB-PW] Đăng nhập thành công!")
                page.close()
                return True

            logger.error(f"[FB-PW] Đăng nhập thất bại. URL hiện tại: {current_url}")
            page.close()
            return False

        except Exception as exc:
            logger.error(f"[FB-PW] Lỗi trong quá trình đăng nhập: {exc}")
            page.close()
            return False

    def _dismiss_cookie_banner(self, page) -> None:
        """Đóng popup cookie consent nếu xuất hiện."""
        try:
            btn = page.locator(FBSelectors.ACCEPT_COOKIES).first
            if btn.is_visible(timeout=3000):
                btn.click()
                page.wait_for_timeout(500)
        except Exception:
            pass

    # ─── Group crawling ───────────────────────────────────────────────────────

    def _crawl_group(self, page, group_id: str) -> list[CrawledItem]:
        """
        Vào trang group, scroll feed và lấy bài viết.
        """
        url = f"https://www.facebook.com/groups/{group_id}/?sorting_setting=RECENT_ACTIVITY"
        logger.info(f"[FB-PW] Mo group: {url}")

        page.goto(url, timeout=30000)
        page.wait_for_load_state('domcontentloaded')

        # Headless cần thêm thời gian để render đủ JS
        page.wait_for_timeout(5000)

        # Đóng popup nếu có
        self._dismiss_popups(page)

        # Chờ bài viết xuất hiện trong DOM trước khi scroll
        try:
            page.wait_for_selector('div[role="article"]', timeout=10000)
            logger.info("[FB-PW] Feed da load, bat dau scroll...")
        except Exception:
            logger.warning("[FB-PW] Khong tim thay article sau 10s, van tiep tuc scroll...")

        # Scroll để load thêm bài
        self._scroll_feed(page)

        # Chờ thêm sau khi scroll xong
        page.wait_for_timeout(2000)

        # Chụp screenshot để debug nếu cần
        try:
            page.screenshot(path='fb_group_debug.png')
            logger.debug("[FB-PW] Screenshot saved: fb_group_debug.png")
        except Exception:
            pass

        # Parse bài viết
        return self._parse_posts(page, group_id)


    def _dismiss_popups(self, page) -> None:
        """Đóng các popup như "Turn on notifications", "See More"."""
        try:
            close_btns = page.locator(FBSelectors.CLOSE_POPUP)
            for i in range(close_btns.count()):
                try:
                    close_btns.nth(i).click(timeout=1000)
                    page.wait_for_timeout(300)
                except Exception:
                    pass
        except Exception:
            pass

    def _scroll_feed(self, page) -> None:
        """Scroll trang xuống để lazy-load thêm bài viết."""
        logger.debug(f"[FB-PW] Scrolling {self.scroll_times} lần...")
        for i in range(self.scroll_times):
            page.keyboard.press('End')
            page.wait_for_timeout(2000 + i * 200)   # Tăng dần để tránh rate-limit

            # Bấm "See more" trong các bài để lấy full text
            try:
                see_more_btns = page.locator(FBSelectors.SEE_MORE)
                count = min(see_more_btns.count(), 10)
                for j in range(count):
                    try:
                        see_more_btns.nth(j).click(timeout=1000)
                        page.wait_for_timeout(300)
                    except Exception:
                        pass
            except Exception:
                pass

    def _parse_posts(self, page, group_id: str) -> list[CrawledItem]:
        """
        Parse DOM để lấy TẤT CẢ bài viết từ trang group.
        KHÔNG lọc từ khóa SOS — để PhoBERT phân loại trong pipeline.
        Chỉ bỏ qua bài không có text hoặc text quá ngắn (<10 ký tự).
        """
        results: list[CrawledItem] = []
        seen_texts: set[str] = set()

        # Tìm container phù hợp
        articles = None
        for selector in FBSelectors.POST_CONTAINERS:
            try:
                locator = page.locator(selector)
                count = locator.count()
                if count > 0:
                    articles = locator
                    logger.debug(f"[FB-PW] Selector '{selector}' tìm được {count} bài")
                    break
            except Exception:
                continue

        if articles is None:
            logger.warning("[FB-PW] Không tìm được bài viết nào trong DOM.")
            return results

        total = min(articles.count(), self.max_posts_per_group)
        logger.info(f"[FB-PW] Đang parse {total} bài trong group {group_id} → tất cả sẽ qua PhoBERT...")

        for i in range(total):
            try:
                article = articles.nth(i)
                post_data = self._extract_post_data(article, group_id)

                if not post_data:
                    continue

                text = post_data.get('text', '')
                if not text or len(text) < 10:
                    continue

                # Dedup theo nội dung
                sig = text[:100].lower()
                if sig in seen_texts:
                    continue
                seen_texts.add(sig)

                # Không lọc SOS ở đây — PhoBERT sẽ phân loại trong pipeline
                item = self._build_item(post_data, group_id)
                results.append(item)

            except Exception as exc:
                logger.debug(f"[FB-PW] Bỏ qua bài {i}: {exc}")

        return results

    def _extract_post_data(self, article, group_id: str) -> Optional[dict]:
        """Trích xuất dữ liệu thô từ một article element."""
        # --- Text ---
        text = ''
        for sel in FBSelectors.POST_TEXT_SELECTORS:
            try:
                el = article.locator(sel).first
                if el.count() > 0:
                    t = el.inner_text(timeout=2000).strip()
                    if t and len(t) > len(text):
                        text = t
            except Exception:
                continue

        if not text:
            return None

        # --- Author ---
        author = ''
        try:
            author_el = article.locator(FBSelectors.AUTHOR).first
            if author_el.count() > 0:
                author = author_el.inner_text(timeout=1000).strip()
        except Exception:
            pass

        # --- Timestamp ---
        timestamp = datetime.now(timezone.utc).isoformat()
        try:
            ts_el = article.locator(FBSelectors.TIMESTAMP).first
            if ts_el.count() > 0:
                # data-utime = Unix timestamp
                utime = ts_el.get_attribute('data-utime', timeout=1000)
                if utime:
                    timestamp = datetime.fromtimestamp(
                        int(utime), tz=timezone.utc
                    ).isoformat()
        except Exception:
            pass

        # --- Post URL ---
        post_url = f'https://www.facebook.com/groups/{group_id}'
        try:
            link_el = article.locator(FBSelectors.POST_LINK).first
            if link_el.count() > 0:
                href = link_el.get_attribute('href', timeout=1000)
                if href:
                    if href.startswith('/'):
                        post_url = 'https://www.facebook.com' + href
                    else:
                        post_url = href
        except Exception:
            pass

        return {
            'text':      text,
            'author':    author,
            'timestamp': timestamp,
            'url':       post_url,
            'id':        f'pw_{group_id}_{hash(text) & 0xFFFFFFFF:08x}',
        }

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _is_sos(self, text: str) -> bool:
        text_lower = text.lower()
        return any(kw in text_lower for kw in MANDATORY_KEYWORDS)

    def _extract_address(self, text: str) -> str:
        for pattern in ADDRESS_PATTERNS:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                return m.group(0).strip()[:200]
        return ''

    def _extract_people_count(self, text: str) -> int:
        for pattern in PEOPLE_PATTERNS:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                try:
                    return int(m.group(1))
                except (IndexError, ValueError):
                    pass
        return 0

    def _extract_phone(self, text: str) -> str:
        for pattern in PHONE_PATTERNS:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                return re.sub(r'[\s.-]', '', m.group(1))
        return ''

    def _build_item(self, post_data: dict, group_id: str) -> CrawledItem:
        """Chuyển đổi raw post data → CrawledItem chuẩn."""
        text   = post_data['text']
        author = post_data.get('author', '')
        url    = post_data.get('url', '')
        pid    = post_data.get('id', '')

        item = CrawledItem(
            source_platform = self.PLATFORM,
            source_url      = url,
            raw_title       = (text[:100] + '...') if len(text) > 100 else text,
            raw_content     = text,
        )

        # Metadata đặc thù Facebook
        item.facebook_post_id       = pid
        item.facebook_author        = author
        item.extracted_address      = self._extract_address(text)
        item.extracted_phone        = self._extract_phone(text)
        item.extracted_people_count = self._extract_people_count(text)
        item.has_media              = False   # TODO: check hình ảnh trong bài
        item.fb_reactions_count     = 0       # Chưa parse reactions

        return item


# ─── Quick test ───────────────────────────────────────────────────────────────

def _manual_test():
    """
    Chạy thử trực tiếp (không qua Django):
        python -m ai.crawlers.fb_playwright_crawler
    """
    import sys, os
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinel.settings')

    import django
    django.setup()

    logging.basicConfig(level=logging.INFO, format='%(levelname)s  %(message)s')

    crawler = FacebookPlaywrightCrawler(
        headless=False,   # Bật cửa sổ để debug
        slow_mo=800,
        scroll_times=5,
        max_posts_per_group=30,
    )
    items = crawler.fetch()
    print(f"\n{'='*60}")
    print(f"Tổng bài SOS: {len(items)}")
    for it in items:
        print(f"  [{it.facebook_author}] {it.raw_title[:80]}")
        print(f"    Phone: {it.extracted_phone} | People: {it.extracted_people_count}")
        print(f"    URL: {it.source_url}")


if __name__ == '__main__':
    _manual_test()
