"""
ai/crawlers/base_crawler.py
===========================
Abstract base class cho tất cả các crawler.
"""

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CrawledItem:
    """
    Kết quả chuẩn hóa sau khi crawl từ bất kỳ nguồn nào.
    Tất cả crawler phải trả về danh sách CrawledItem.
    """
    source_platform: str          # 'VNEXPRESS', 'TUOITRE', 'GDACS', ...
    source_url:      str          # URL gốc duy nhất
    raw_title:       str          # Tiêu đề bài viết
    raw_content:     str          # Nội dung tóm tắt / mô tả
    content_hash:    str = field(init=False)  # Tự tính sau khi khởi tạo

    def __post_init__(self):
        text = f"{self.raw_title} {self.raw_content}".lower().strip()
        self.content_hash = hashlib.md5(text.encode('utf-8')).hexdigest()


class BaseCrawler(ABC):
    """
    Abstract crawler. Mọi crawler cụ thể phải kế thừa class này
    và implement phương thức `fetch()`.
    """

    DISASTER_KEYWORDS = [
        # Tiếng Việt
        'lũ', 'lụt', 'ngập', 'bão', 'sạt lở', 'sạt', 'hạn hán',
        'động đất', 'sóng thần', 'cứu hộ', 'cứu nạn', 'sos', 'khẩn cấp',
        'thiên tai', 'mưa lớn', 'nước dâng', 'vỡ đê', 'triều cường',
        'lốc xoáy', 'gió mạnh', 'hỏa hoạn', 'cháy rừng',
        # Tiếng Anh (từ GDACS)
        'flood', 'cyclone', 'earthquake', 'tsunami', 'hurricane',
        'landslide', 'storm', 'disaster', 'emergency', 'alert',
    ]

    @abstractmethod
    def fetch(self) -> list[CrawledItem]:
        """Crawl và trả về danh sách CrawledItem."""
        ...

    def is_disaster_related(self, text: str) -> bool:
        """Kiểm tra bài viết có liên quan đến thiên tai không."""
        text_lower = text.lower()
        return any(kw in text_lower for kw in self.DISASTER_KEYWORDS)
