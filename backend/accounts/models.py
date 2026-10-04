from django.contrib.auth.models import AbstractUser
import uuid
from django.db import models


# ============================================================
# NHÓM 1: NGƯỜI DÙNG & XÁC THỰC
# ============================================================

class User(AbstractUser):
    """
    Bảng thông tin chung người dùng.
    id là UUID được đồng bộ từ Supabase Auth (auth.users).
    """
    ROLE_CHOICES = (
        ('CITIZEN', 'Người dân'),
        ('RESCUER', 'Cứu hộ'),
        ('ADMIN', 'Admin')
    )

    id = models.UUIDField(
        primary_key=True, 
        default=uuid.uuid4,
        editable=False
    )   
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='CITIZEN', verbose_name='Vai trò')
    full_name = models.CharField(max_length=150, verbose_name='Họ và tên')
    phone = models.CharField(max_length=20, unique=True, verbose_name='Số điện thoại')
    email = models.EmailField(blank=True, null=True, verbose_name='Email')
    address = models.CharField(max_length=100, blank=True, null=True, verbose_name='Vị trí')
    avatar_url = models.TextField(blank=True, null=True, verbose_name='Link ảnh đại diện')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')
    account_reason = models.TextField(blank=True, default='')
    session_version = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Hồ sơ người dùng'
        verbose_name_plural = 'Hồ sơ người dùng'
        db_table = 'profiles'

    def __str__(self):
        return f"{self.full_name} ({self.role})"

class CitizenProfile(models.Model):
    """
    Hồ sơ chi tiết cho Người dân - bảng con của Profile.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='citizen_profile',
        verbose_name='Người dùng'
    )
    id_number = models.CharField(max_length=20, blank=True, null=True, verbose_name='Số CCCD/CMND')
    medical_notes = models.TextField(blank=True, null=True, verbose_name='Bệnh nền / Dị ứng')
    emergency_contact_name = models.CharField(max_length=100, blank=True, null=True, verbose_name='Tên người thân')
    
    emergency_contact_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='SĐT người thân')
    location_sharing = models.BooleanField(default=True, verbose_name='Cho phép chia sẻ vị trí')

    class Meta:
        verbose_name = 'Hồ sơ Người dân'
        verbose_name_plural = 'Hồ sơ Người dân'
        db_table = 'citizen_profiles'

    def __str__(self):
        return f"CitizenProfile - {self.user.full_name}"


class RescuerProfile(models.Model):
    """
    Hồ sơ chi tiết cho Đội cứu trợ - bảng con của Profile.
    current_lat / current_lng lưu vị trí GPS thời gian thực.
    (TODO: Nâng cấp lên PostGIS GEOMETRY(Point) khi sẵn sàng)
    """
    SPECIALTY_CHOICES = (
        ('SEARCH_RESCUE', 'Tìm kiếm & Cứu nạn'),
        ('MEDICAL', 'Y tế'),
        ('LOGISTICS', 'Hậu cần'),
        ('COMMAND', 'Chỉ huy'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Chờ duyệt'),
        ('ACTIVE', 'Đang hoạt động'),
        ('BANNED', 'Đã bị khóa'),
        ('REJECTED', 'Bị từ chối'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='rescuer_profile',
        verbose_name='Người dùng'
    )
    id_number = models.CharField(max_length=20, blank=True, null=True, verbose_name='Số CCCD/CMND')
    unit_name = models.CharField(max_length=200, blank=True, null=True, verbose_name='Tên đơn vị / Tổ chức')
    team_code = models.CharField(max_length=50, blank=True, default='')
    rank = models.CharField(max_length=100, blank=True, null=True, verbose_name='Cấp bậc')
    specialty = models.CharField(
        max_length=20,
        choices=SPECIALTY_CHOICES,
        blank=True,
        null=True,
        verbose_name='Chuyên môn'
    )
    is_on_duty = models.BooleanField(default=False, verbose_name='Đang trực / Sẵn sàng')
    # Vị trí GPS thời gian thực (TODO: nâng cấp PostGIS)
    current_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True, verbose_name='Vĩ độ hiện tại')
    current_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True, verbose_name='Kinh độ hiện tại')
    status = models.CharField(choices=STATUS_CHOICES, default="PENDING", verbose_name='Trạng thái')
    
    class Meta:
        verbose_name = 'Hồ sơ Cứu hộ'
        verbose_name_plural = 'Hồ sơ Cứu hộ'
        db_table = 'rescuer_profiles'

    def __str__(self):
        return f"RescuerProfile - {self.user.full_name} ({self.unit_name})"


class AccountEvent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='account_events')
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='+')
    action = models.CharField(max_length=20)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RevokedSession(models.Model):
    sid = models.CharField(max_length=64, primary_key=True)
    expires_at = models.DateTimeField()
