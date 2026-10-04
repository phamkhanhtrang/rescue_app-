"""
ai/models.py
============
Model lưu trữ dữ liệu crawl thô từ các nguồn bên ngoài.
Bảng này là "kho đệm" trước khi dữ liệu được duyệt và tạo Alert chính thức.
"""

import uuid
from django.db import models


class CrawledArticle(models.Model):
    """
    Lưu trữ raw data từ quá trình crawl.
    Trạng thái (status) theo vòng đời: RAW → ANALYZED → APPROVED → ALERT_CREATED
    """

    STATUS_CHOICES = (
        ('RAW',           'Thô - Chưa phân tích'),
        ('ANALYZED',      'Đã phân tích NLP'),
        ('APPROVED',      'Đã duyệt'),
        ('ALERT_CREATED', 'Đã tạo Alert'),
        ('REJECTED',      'Bị từ chối (Tin giả / Trùng)'),
    )

    PLATFORM_CHOICES = (
        ('VNEXPRESS',  'VnExpress'),
        ('TUOITRE',    'Tuổi Trẻ'),
        ('THANHNIEN',  'Thanh Niên'),
        ('GDACS',      'GDACS (Quốc tế)'),
        ('FACEBOOK',   'Facebook Groups'),
        ('OTHER',      'Nguồn khác'),
    )

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ── Thông tin nguồn ──────────────────────────────────────────────────────
    source_platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='OTHER',
                                       verbose_name='Nền tảng nguồn')
    source_url      = models.TextField(unique=True, verbose_name='URL gốc')
    raw_title       = models.TextField(blank=True, null=True, verbose_name='Tiêu đề gốc')
    raw_content     = models.TextField(verbose_name='Nội dung thô')
    content_hash    = models.CharField(max_length=64, db_index=True,
                                       verbose_name='MD5 hash nội dung')

    # ── Kết quả phân tích NLP ─────────────────────────────────────────────────
    extracted_location      = models.CharField(max_length=200, blank=True, null=True,
                                               verbose_name='Địa danh trích xuất')
    extracted_lat           = models.DecimalField(max_digits=10, decimal_places=7,
                                                  null=True, blank=True, verbose_name='Vĩ độ')
    extracted_lng           = models.DecimalField(max_digits=10, decimal_places=7,
                                                  null=True, blank=True, verbose_name='Kinh độ')
    extracted_severity      = models.CharField(max_length=10, blank=True, null=True,
                                               verbose_name='Mức độ nghiêm trọng')
    extracted_incident_type = models.CharField(max_length=100, blank=True, null=True,
                                               verbose_name='Loại sự cố')
    confidence_score        = models.DecimalField(max_digits=4, decimal_places=2,
                                                  null=True, blank=True,
                                                  verbose_name='Độ tin cậy (0-1)')

    # ── Trường đặc thù cho Facebook SOS ─────────────────────────────────────
    ai_analysis = models.JSONField(default=dict, blank=True)
    reviewed_analysis = models.JSONField(default=dict, blank=True)
    facebook_post_id        = models.CharField(max_length=100, blank=True, null=True,
                                               db_index=True, verbose_name='Facebook Post ID')
    facebook_author         = models.CharField(max_length=200, blank=True, null=True,
                                               verbose_name='Người đăng (Facebook)')
    extracted_people_count  = models.IntegerField(null=True, blank=True,
                                                  verbose_name='Số người cần cứu (trích xuất)')
    extracted_phone         = models.CharField(max_length=20, blank=True, null=True,
                                               verbose_name='SĐT liên hệ (trích xuất)')
    extracted_address       = models.TextField(blank=True, null=True,
                                               verbose_name='Địa chỉ chi tiết (trích xuất)')
    has_media               = models.BooleanField(default=False,
                                                  verbose_name='Có đính kèm ảnh/video')
    fb_reactions_count      = models.IntegerField(null=True, blank=True,
                                                  verbose_name='Số lượt react Facebook')

    # ── Trạng thái & liên kết ─────────────────────────────────────────────────
    status          = models.CharField(max_length=15, choices=STATUS_CHOICES,
                                       default='RAW', verbose_name='Trạng thái')
    linked_alert    = models.ForeignKey(
        'communications.Alert',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='crawled_sources',
        verbose_name='Alert đã tạo'
    )
    linked_sos      = models.ForeignKey(
        'rescue_operations.SOSSignal',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='crawled_sources',
        verbose_name='SOS đã tạo'
    )
    reject_reason   = models.CharField(max_length=200, blank=True, null=True,
                                       verbose_name='Lý do từ chối')

    crawled_at      = models.DateTimeField(auto_now_add=True, verbose_name='Thời gian crawl')
    analyzed_at     = models.DateTimeField(null=True, blank=True, verbose_name='Thời gian phân tích')
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    unpublished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name          = 'Bài viết đã crawl'
        verbose_name_plural   = 'Bài viết đã crawl'
        db_table              = 'crawled_articles'
        ordering              = ['-crawled_at']

    def __str__(self):
        return f"[{self.source_platform}] {self.raw_title or self.source_url[:60]} ({self.status})"


class NewsPublicationEvent(models.Model):
    article = models.ForeignKey(CrawledArticle, on_delete=models.CASCADE, related_name='publication_events')
    actor = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=20, choices=(('PUBLISHED', 'Xuất bản'), ('UNPUBLISHED', 'Gỡ xuất bản'), ('ALERT_CREATED', 'Tạo cảnh báo')))
    alert_id_snapshot = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
