"""
ai/crawlers/fb_crawler.py
=========================
Crawler thu thập bài viết SOS từ các nhóm Facebook cộng đồng.

Yêu cầu cấu hình (trong settings.py hoặc .env):
    FB_PAGE_ACCESS_TOKEN = "EAAGx0B..."
    FB_GROUP_IDS         = ["123456789", "987654321"]

Quyền Facebook Graph API v25.0 cần có:
    - groups_access_member_info
    - public_groups (đối với nhóm công khai)

Lưu ý:
    - Nếu FB_PAGE_ACCESS_TOKEN chưa cấu hình, crawler sẽ bỏ qua và log warning.
    - Rate limit: 200 request/giờ/token.
"""

import re
import logging
import requests
from datetime import datetime, timedelta, timezone

from .base_crawler import BaseCrawler, CrawledItem

logger = logging.getLogger(__name__)

# ─── Cấu hình ────────────────────────────────────────────────────────────────

GRAPH_API_VERSION = 'v25.0'
GRAPH_BASE_URL    = f'https://graph.facebook.com/{GRAPH_API_VERSION}'

# Từ khóa SOS bắt buộc (phải có ít nhất 1)
MANDATORY_KEYWORDS = [
    'sos', 'cứu', 'giúp với', 'cứu với', 'cấp cứu', 'khẩn cấp',
    'mắc kẹt', 'kẹt', 'ngập', 'chìm', 'sập', 'bị kẹt',
    'cứu hộ', 'cứu nạn', 'xin cứu', 'ai cứu', 'cứu giúp',
    'nước dâng', 'nước lên', 'bị trôi', 'lũ cuốn',
    'cần giúp', 'đang chìm', 'không ra được',
]

# Từ khóa bổ trợ (tăng Confidence Score)
SUPPORTING_KEYWORDS = [
    'địa chỉ', 'số nhà', 'đường', 'phường', 'quận', 'huyện', 'xã', 'thôn',
    'người', 'gia đình', 'trẻ em', 'người già', 'bà bầu', 'cụ già',
    'tầng', 'mái nhà', 'nóc nhà', 'sân thượng',
    'điện thoại', 'liên hệ', 'số dt', 'số điện thoại', 'gọi cho',
]

# Regex trích xuất địa chỉ
ADDRESS_PATTERNS = [
    r'(?:địa chỉ|ở tại|đang ở|tại nhà số)\s*:?\s*(.{10,80}?)(?:\.|,|\n|$)',
    r'số\s+\d+[\s,]*(?:đường|ngõ|hẻm|kiệt|phố)\s+[\w\s]+',
    r'(?:phường|xã|thôn|ấp)\s+[\w\s]+[,\s]+(?:quận|huyện|tp)\s+[\w\s]+',
]

# Regex trích xuất số người
PEOPLE_PATTERNS = [
    r'(\d+)\s*(?:người|hộ dân|gia đình|thành viên|nhân khẩu)',
    r'(?:cả nhà|gia đình)\s*(?:có)?\s*(\d+)',
    r'(?:khoảng|gần)\s*(\d+)\s*người',
]

# Regex trích xuất số điện thoại
PHONE_PATTERNS = [
    r'(?:sdt|số dt|điện thoại|liên hệ|gọi|tel)\s*:?\s*(0\d{9,10})',
    r'\b(0[35789]\d{8})\b',
    r'\b(0[3-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{4})\b',
]


class FacebookSOSCrawler(BaseCrawler):
    """
    Crawler bài viết SOS từ các nhóm Facebook cộng đồng.
    Sử dụng Facebook Graph API v18.0.
    """

    PLATFORM = 'FACEBOOK'

    def __init__(self, group_ids: list = None, access_token: str = None,
                 lookback_hours: int = 6):
        """
        Args:
            group_ids:      Danh sách Group ID Facebook cần quét.
                            None → đọc từ settings.FB_GROUP_IDS
            access_token:   Page Access Token.
                            None → đọc từ settings.FB_PAGE_ACCESS_TOKEN
            lookback_hours: Chỉ lấy bài viết trong N giờ gần đây (mặc định 6h).
        """
        from django.conf import settings
        self.access_token   = access_token or getattr(settings, 'FB_PAGE_ACCESS_TOKEN', None)
        self.group_ids      = group_ids    or getattr(settings, 'FB_GROUP_IDS', [])
        self.lookback_hours = lookback_hours

    def fetch(self) -> list[CrawledItem]:
        if not self.access_token:
            logger.warning("[FB Crawler] FB_PAGE_ACCESS_TOKEN chưa được cấu hình. Bỏ qua Facebook.")
            return []

        if not self.group_ids:
            logger.warning("[FB Crawler] FB_GROUP_IDS trống. Bỏ qua Facebook.")
            return []

        results = []
        since_ts = int((datetime.now(timezone.utc) - timedelta(hours=self.lookback_hours)).timestamp())

        for group_id in self.group_ids:
            try:
                url = f"{GRAPH_BASE_URL}/{group_id}/feed"
                params = {
                    'fields':       'id,message,created_time,from,attachments,permalink_url,reactions.summary(true)',
                    'access_token': self.access_token,
                    'limit':        50,
                    'since':        since_ts,
                }
                resp = requests.get(url, params=params, timeout=15)
                data = resp.json()

                # Kiểm tra các lỗi API → chuyển sang DEMO mode khi không thể lấy dữ liệu thật
                if not resp.ok:
                    err_info = data.get('error', {})
                    code     = err_info.get('code', 0)
                    subcode  = err_info.get('error_subcode', 0)

                    # subcode 33  : thiếu quyền groups_access_member_info
                    # subcode 463 : access token hết hạn (session expired)
                    # subcode 467 : token bị thu hồi / không hợp lệ
                    # code 190    : OAuthException chung (token lỗi)
                    DEMO_SUBCODES = {33, 463, 467}
                    DEMO_CODES    = {190}

                    if subcode in DEMO_SUBCODES or code in DEMO_CODES:
                        reason_map = {
                            33:  'Thiếu quyền groups_access_member_info',
                            463: 'Access token đã hết hạn',
                            467: 'Access token bị thu hồi',
                        }
                        reason = reason_map.get(subcode, f'OAuthException code={code}')
                        logger.warning(
                            f"[FB Crawler] Nhóm {group_id}: {reason}. "
                            f"Chạy DEMO mode để tiếp tục kiểm thử hệ thống."
                        )
                        results.extend(self._get_demo_items(group_id))
                    else:
                        logger.error(f"[FB Crawler] Lỗi API nhóm {group_id}: {err_info}")
                    continue

                posts = data.get('data', [])
                logger.info(f"[FB Crawler] Nhóm {group_id}: {len(posts)} bài viết → chuyển hết sang PhoBERT phân loại")

                for post in posts:
                    message = post.get('message', '')
                    if not message:
                        continue   # Bỏ bài không có text (bài ảnh/video thuần)
                    results.append(self._build_item(post, group_id))

            except requests.exceptions.RequestException as e:
                logger.error(f"[FB Crawler] Lỗi kết nối nhóm {group_id}: {e}")
            except Exception as e:
                logger.error(f"[FB Crawler] Lỗi xử lý nhóm {group_id}: {e}")

        logger.info(f"[FB Crawler] Tổng cộng {len(results)} bài SOS phát hiện")
        return results

    # ─── Private methods ──────────────────────────────────────────────────────

    def _fetch_group_posts(self, group_id: str, since_ts: int) -> list:
        """Gọi Facebook Graph API lấy bài viết mới trong nhóm."""
        url    = f"{GRAPH_BASE_URL}/{group_id}/feed"
        params = {
            'fields':       'id,message,created_time,from,attachments,permalink_url,reactions.summary(true)',
            'access_token': self.access_token,
            'limit':        50,
            'since':        since_ts,
        }
        resp = requests.get(url, params=params, timeout=15)
        # Raise HTTPError để fetch() bắt được lỗi quyền (subcode 33)
        if not resp.ok:
            err = requests.exceptions.HTTPError(response=resp)
            raise err
        return resp.json().get('data', [])

    def _is_sos(self, text: str) -> bool:
        """Kiểm tra bài viết có nội dung kêu cứu SOS không."""
        text_lower = text.lower()
        return any(kw in text_lower for kw in MANDATORY_KEYWORDS)

    def _extract_address(self, text: str) -> str:
        """Trích xuất địa chỉ chi tiết từ nội dung bài viết."""
        for pattern in ADDRESS_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0).strip()[:200]
        return ''

    def _extract_people_count(self, text: str) -> int:
        """Trích xuất số người cần cứu."""
        for pattern in PEOPLE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return int(match.group(1))
                except (IndexError, ValueError):
                    pass
        return 0

    def _extract_phone(self, text: str) -> str:
        """Trích xuất số điện thoại liên hệ."""
        for pattern in PHONE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                phone = re.sub(r'[\s.-]', '', match.group(1))
                return phone
        return ''


    def _build_item(self, post: dict, group_id: str) -> CrawledItem:
        """
        Chuyển đổi bài viết Facebook thành CrawledItem.

        Trích xuất metadata đặc thù bằng Regex:
            - extracted_address     : địa chỉ chi tiết
            - extracted_phone       : SĐT liên hệ
            - extracted_people_count: số người cần cứu
            - has_media             : có ảnh/video đính kèm không
            - fb_reactions_count    : số lượt react

        Confidence score sẽ được tính bởi PhoBERT trong pipeline,
        không tính sơ bộ ở đây.
        """
        post_id      = post.get('id', '')
        message      = post.get('message', '')
        from_user    = post.get('from', {})
        attachments  = post.get('attachments', {}).get('data', [])
        reactions    = post.get('reactions', {}).get('summary', {}).get('total_count', 0)
        permalink    = post.get('permalink_url', f'https://facebook.com/groups/{group_id}/posts/{post_id}')

        # Trích xuất metadata bằng Regex (thông tin cấu trúc đặc thù FB)
        address      = self._extract_address(message)
        people_count = self._extract_people_count(message)
        phone        = self._extract_phone(message)

        # Tạo CrawledItem chuẩn
        item = CrawledItem(
            source_platform = self.PLATFORM,
            source_url      = permalink,
            raw_title       = (message[:100] + '...') if len(message) > 100 else message,
            raw_content     = message,
        )

        # Gắn metadata đặc thù Facebook — confidence sẽ do PhoBERT quyết định
        item.facebook_post_id       = post_id
        item.facebook_author        = from_user.get('name', '')
        item.extracted_people_count = people_count
        item.extracted_phone        = phone
        item.extracted_address      = address
        item.has_media              = len(attachments) > 0
        item.fb_reactions_count     = reactions

        return item

    def _get_demo_items(self, group_id: str) -> list[CrawledItem]:
        """
        Trả về dữ liệu mô phỏng (demo) khi Facebook API không khả dụng.
        Dùng cho mục đích trình diễn và kiểm thử hệ thống.

        Bài demo sử dụng tiếng Việt có dấu đầy đủ để:
          - Geocoder nhận diện được tỉnh/thành
          - Regex trích xuất được địa chỉ, SĐT, số người
          - PhoBERT phân loại đúng nhãn SOS
        """
        demo_posts = [
            {
                'id': f'demo_{group_id}_001',
                'message': (
                    'SOS khẩn cấp! Nhà em tại số 12 đường Nguyễn Tất Thành, phường Tam Kỳ, '
                    'tỉnh Quảng Nam có 4 người đang mắc kẹt trên mái nhà. '
                    'Nước ngập đến cổ rồi, cần thuyền cứu hộ gấp! '
                    'Số điện thoại liên hệ: 0905123456'
                ),
                'created_time': datetime.now(timezone.utc).isoformat(),
                'from': {'name': 'Nguyễn Văn A (DEMO)'},
                'permalink_url': f'https://facebook.com/groups/{group_id}/posts/demo_001',
                'reactions': {'summary': {'total_count': 87}},
            },
            {
                'id': f'demo_{group_id}_002',
                'message': (
                    'Cần cứu hộ gấp! Khu dân cư Cẩm Châu, thành phố Hội An, Quảng Nam '
                    'có 7 người bị cô lập, trong đó có 2 trẻ em và 1 người già. '
                    'Địa chỉ: 45 đường Cửa Đại, phường Cẩm Châu. '
                    'Liên hệ: 0912345678'
                ),
                'created_time': datetime.now(timezone.utc).isoformat(),
                'from': {'name': 'Trần Thị B (DEMO)'},
                'permalink_url': f'https://facebook.com/groups/{group_id}/posts/demo_002',
                'reactions': {'summary': {'total_count': 134}},
            },
            {
                'id': f'demo_{group_id}_003',
                'message': (
                    'Bà con xóm em ở phường Hòa Hiệp Bắc, quận Liên Chiểu, Đà Nẵng '
                    'bị ngập nặng, khoảng 15 hộ dân thiếu nước uống và lương thực. '
                    'Mực nước đã ngập 1 mét, cần hỗ trợ gấp. '
                    'SĐT: 0934567890'
                ),
                'created_time': datetime.now(timezone.utc).isoformat(),
                'from': {'name': 'Lê Văn C (DEMO)'},
                'permalink_url': f'https://facebook.com/groups/{group_id}/posts/demo_003',
                'reactions': {'summary': {'total_count': 56}},
            },
        ]
        items = []
        for post in demo_posts:
            item = self._build_item(post, group_id)
            item.raw_title = '[DEMO] ' + item.raw_title
            items.append(item)
        logger.info(f"[FB Crawler] DEMO mode: tạo {len(items)} bài mô phỏng cho nhóm {group_id} → PhoBERT phân loại")
        return items
