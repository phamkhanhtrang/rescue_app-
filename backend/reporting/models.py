import uuid
from django.db import models


# ============================================================
# NHÓM 4: NHIỆM VỤ & ĐIỀU PHỐI
# ============================================================

class Mission(models.Model):
    """
    Nhiệm vụ Cứu hộ: gán cứu hộ viên vào một vùng sự cố.
    """
    STATUS_CHOICES = (
        ('ACTIVE', 'Đang thực hiện'),
        ('COMPLETED', 'Hoàn thành'),
        ('CANCELLED', 'Đã hủy'),
        ('ON_MY_WAY', 'Chưa tiếp cận'),
        ('NEEDS_HELP', 'cần hỗ trợ'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone = models.ForeignKey(
        'rescue_operations.Zone',
        on_delete=models.SET_NULL,
        null=True,
        related_name='missions',
        verbose_name='Vùng nhiệm vụ'
    )
    rescuer = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='missions',
        verbose_name='Cứu hộ viên'
    )
    role = models.CharField(max_length=100, blank=True, null=True, verbose_name='Vai trò trong nhiệm vụ')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='ACTIVE', verbose_name='Trạng thái')
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời điểm tham gia')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Thời điểm hoàn thành')

    class Meta:
        verbose_name = 'Nhiệm vụ'
        verbose_name_plural = 'Nhiệm vụ'
        db_table = 'missions'
        ordering = ['-joined_at']

    def __str__(self):
        rescuer_name = self.rescuer.full_name if self.rescuer else 'N/A'
        zone_name = self.zone.name if self.zone else 'N/A'
        return f"Nhiệm vụ: {rescuer_name} → {zone_name} [{self.status}]"


class Resource(models.Model):
    """
    Nguồn lực khai báo bởi cứu hộ viên.
    supplies lưu dưới dạng JSON: {"food": 100, "water": 50, "medicine": 20}
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rescuer = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='resources',
        verbose_name='Chủ sở hữu nguồn lực'
    )
    vehicle_type = models.CharField(max_length=100, blank=True, null=True, verbose_name='Loại phương tiện')
    # specialty_type = models.CharField(max_length=100, blank=True, null=True, verbose_name='Chuyên môn nguồn lực')
    # supplies = models.JSONField(default=dict, blank=True, verbose_name='Chi tiết vật tư (JSON)')
    is_available = models.BooleanField(default=True, verbose_name='Sẵn sàng điều phối')
    number_staff = models.IntegerField(default=1, verbose_name='Số lượng thành viên trong nhóm')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Nguồn lực'
        verbose_name_plural = 'Nguồn lực'
        db_table = 'resources'

    def __str__(self):
        rescuer_name = self.rescuer.full_name if self.rescuer else 'N/A'
        return f"Nguồn lực của {rescuer_name} - {self.vehicle_type or self.specialty_type}"
