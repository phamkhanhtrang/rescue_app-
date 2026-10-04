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
        ('PENDING_ACCEPTANCE', 'Chờ đội nhận'),
        ('ACCEPTED', 'Đã nhận'),
        ('ACTIVE', 'Đang thực hiện'),
        ('COMPLETED', 'Hoàn thành'),
        ('CANCELLED', 'Đã hủy'),
        ('ON_MY_WAY', 'Đang di chuyển'),
        ('NEEDS_HELP', 'Cần chi viện khẩn cấp'),
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
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='PENDING_ACCEPTANCE', verbose_name='Trạng thái')
    allocated_staff = models.PositiveIntegerField(default=0)
    allocated_vehicles = models.PositiveIntegerField(default=0)
    outcome_note = models.TextField(blank=True)
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời điểm tham gia')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Thời điểm hoàn thành')

    class Meta:
        verbose_name = 'Nhiệm vụ'
        verbose_name_plural = 'Nhiệm vụ'
        db_table = 'missions'
        ordering = ['-joined_at']
        indexes = [
            models.Index(fields=['rescuer', 'status'], name='idx_mission_resc_status'),
            models.Index(fields=['zone', 'status'], name='idx_mission_zone_status'),
        ]

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
    vehicle_count = models.PositiveIntegerField(default=1)
    specialties = models.JSONField(default=list, blank=True)
    supplies = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    verification_status = models.CharField(max_length=20, default='SELF_DECLARED')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Nguồn lực'
        verbose_name_plural = 'Nguồn lực'
        db_table = 'resources'

    def __str__(self):
        rescuer_name = self.rescuer.full_name if self.rescuer else 'N/A'
        return f"Nguồn lực của {rescuer_name} - {self.vehicle_type or 'Chưa khai báo'}"


class SupportRequest(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name='support_requests')
    resource_type = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField(default=1)
    note = models.TextField()
    status = models.CharField(max_length=15, default='OPEN')
    supporting_mission = models.ForeignKey(Mission, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='supporting_requests')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['status', 'mission'], name='idx_support_status')]


class MissionEvent(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name='events')
    actor = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
