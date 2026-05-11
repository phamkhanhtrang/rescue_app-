import uuid
from django.db import models


# ============================================================
# NHÓM 2: CẢNH BÁO & XÁC NHẬN CỘNG ĐỒNG
# ============================================================

class Alert(models.Model):
    """
    Cảnh báo & Phát thanh từ nhiều nguồn khác nhau.
    """
    SOURCE_CHOICES = (
        ('SYSTEM', 'Hệ thống'),
        ('COMMUNITY', 'Cộng đồng'),
        ('AUTHORITY', 'Cơ quan chức năng'),
        ('AI', 'AI'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone = models.ForeignKey(
        'rescue_operations.Zone',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='alerts',
        verbose_name='Vùng sự cố liên quan'
    )
    title = models.CharField(max_length=255, verbose_name='Tiêu đề cảnh báo')
    description = models.TextField(blank=True, null=True, verbose_name='Nội dung chi tiết')
    category = models.CharField(max_length=100, blank=True, null=True, verbose_name='Loại cảnh báo')
    severity = models.CharField(max_length=20, blank=True, null=True, verbose_name='Mức độ nghiêm trọng')
    source = models.CharField(max_length=15, choices=SOURCE_CHOICES, default='SYSTEM', verbose_name='Nguồn phát tin')

    # Vị trí sự cố (TODO: nâng cấp PostGIS)
    location_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True, verbose_name='Vĩ độ')
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True, verbose_name='Kinh độ')

    is_active = models.BooleanField(default=True, verbose_name='Còn hiệu lực')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Cảnh báo'
        verbose_name_plural = 'Cảnh báo'
        db_table = 'alerts'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.source}] {self.title}"


class AlertVote(models.Model):
    """
    Xác nhận cộng đồng cho Cảnh báo.
    Mỗi người chỉ được vote 1 lần cho 1 cảnh báo.
    """
    VERDICT_CHOICES = (
        ('TRUE', 'Đúng / Còn nguy hiểm'),
        ('FALSE', 'Sai / Tin giả'),
        ('STILL_DANGER', 'Vẫn còn nguy hiểm'),
        ('RESCUED', 'Đã được cứu hộ'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert = models.ForeignKey(
        Alert,
        on_delete=models.CASCADE,
        related_name='votes',
        verbose_name='Cảnh báo'
    )
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='alert_votes',
        verbose_name='Người vote'
    )
    verdict = models.CharField(max_length=15, choices=VERDICT_CHOICES, verbose_name='Kết quả xác nhận')
    voted_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời gian vote')

    class Meta:
        verbose_name = 'Xác nhận cảnh báo'
        verbose_name_plural = 'Xác nhận cảnh báo'
        db_table = 'alert_votes'
        unique_together = ('alert', 'user')  # Mỗi người chỉ vote 1 lần

    def __str__(self):
        return f"{self.user.full_name} vote [{self.verdict}] cho: {self.alert.title}"