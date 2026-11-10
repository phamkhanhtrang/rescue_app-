import uuid
from django.db import models


# ============================================================
# NHÓM 2: VÙNG SỰ CỐ
# ============================================================

class Zone(models.Model):
    """
    Vùng Sự cố (Rescue Zone).
    location_lat/lng: tọa độ trung tâm vùng
    (TODO: nâng cấp lên PostGIS GEOMETRY(Point) và GEOMETRY(Polygon))
    """
    STATUS_CHOICES = (
        ('ACTIVE', 'Đang xảy ra'),
        ('STABILIZING', 'Đang ổn định'),
        ('RESOLVED', 'Đã giải quyết'),
        ('STANDBY', 'Chờ'),
    )
    SEVERITY_CHOICES = (
        ('CRITICAL', 'Nguy cấp'),
        ('HIGH', 'Cao'),
        ('MEDIUM', 'Trung bình'),
        ('LOW', 'Thấp'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name='Tên khu vực')
    sector_code = models.CharField(max_length=20, blank=True, null=True, verbose_name='Mã khu vực')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='ACTIVE', verbose_name='Trạng thái')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='MEDIUM', verbose_name='Mức độ nghiêm trọng')
    incident_type = models.CharField(max_length=100, blank=True, null=True, verbose_name='Loại sự cố')
    description = models.TextField(blank=True, null=True, verbose_name='Mô tả chi tiết')

    # Vị trí trung tâm (TODO: nâng cấp PostGIS)
    location_lat = models.DecimalField(max_digits=10, decimal_places=7, verbose_name='Vĩ độ trung tâm')
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, verbose_name='Kinh độ trung tâm')

    people_affected = models.IntegerField(default=0, verbose_name='Số nạn nhân ước tính')
    rescuers_needed = models.IntegerField(default=0, verbose_name='Số cứu hộ viên cần')
    ai_priority_score = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        verbose_name='Điểm ưu tiên AI'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Vùng sự cố'
        verbose_name_plural = 'Vùng sự cố'
        db_table = 'zones'

    def __str__(self):
        return f"{self.name} [{self.severity}] - {self.status}"


# ============================================================
# NHÓM 3: SOS & KHẨN CẤP
# ============================================================

class SOSSignal(models.Model):
    """
    Tín hiệu Cầu cứu gửi từ Người dân.
    """
    SIGNAL_TYPE_CHOICES = (
        ('SOS', 'SOS khẩn cấp'),
        ('PING', 'Ping vị trí'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Chờ xử lý'),
        ('ACKNOWLEDGED', 'Đã tiếp nhận'),
        ('IN_PROGRESS', 'Đang xử lý'),
        ('RESOLVED', 'Đã giải quyết'),
        ('CANCELLED', 'Đã hủy'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    citizen = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='sos_signals',
        verbose_name='Người gửi'
    )
    signal_type = models.CharField(max_length=5, choices=SIGNAL_TYPE_CHOICES, default='SOS', verbose_name='Loại tín hiệu')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING', verbose_name='Trạng thái')

    # Vị trí GPS (TODO: nâng cấp PostGIS)
    location_lat = models.DecimalField(max_digits=10, decimal_places=7, verbose_name='Vĩ độ')
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, verbose_name='Kinh độ')

    emergency_type = models.CharField(max_length=100, blank=True, null=True, verbose_name='Loại khẩn cấp')
    people_count = models.IntegerField(default=1, verbose_name='Số người cần cứu')
    note = models.TextField(blank=True, null=True, verbose_name='Ghi chú')
    zone = models.ForeignKey(
        Zone,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sos_signals',
        verbose_name='Vùng sự cố'
    )
    sent_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời điểm gửi')
    request_key = models.UUIDField(null=True, unique=True, editable=False)
    contact_name = models.CharField(max_length=150, blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=500, blank=True)
    location_source = models.CharField(max_length=20, default='GPS')
    verification_status = models.CharField(max_length=20, default='UNVERIFIED', choices=[
        ('UNVERIFIED', 'Chưa xác minh'), ('CHECKING', 'Đang xác minh'),
        ('VERIFIED', 'Đã xác minh'), ('INCORRECT', 'Thông tin không chính xác')])
    assigned_mission = models.ForeignKey('reporting.Mission', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='assigned_sos')
    supplies_needed = models.JSONField(default=dict, blank=True, verbose_name='Nhu cầu cứu trợ')
    supplies_delivered = models.JSONField(default=dict, blank=True, verbose_name='Đã tiếp tế')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tín hiệu SOS'
        verbose_name_plural = 'Tín hiệu SOS'
        db_table = 'sos_signals'
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['zone', 'status'], name='idx_sos_zone_status'),
            models.Index(fields=['status', '-sent_at'], name='idx_sos_status_sent'),
            models.Index(fields=['verification_status', 'status'], name='idx_sos_verify_status'),
        ]

    def __str__(self):
        return f"SOS [{self.signal_type}] - {self.status} tại ({self.location_lat}, {self.location_lng})"


class SOSEvent(models.Model):
    sos = models.ForeignKey(SOSSignal, on_delete=models.CASCADE, related_name='events')
    kind = models.CharField(max_length=40)
    message = models.TextField()
    actor = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']


class SOSImage(models.Model):
    """
    Ảnh đính kèm cho Tín hiệu SOS.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sos = models.ForeignKey(
        SOSSignal,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name='Tín hiệu SOS'
    )
    image = models.ImageField(upload_to='sos_images/%Y/%m/%d/', verbose_name='Ảnh hiện trường', null=True, blank=True)
    caption = models.CharField(max_length=255, blank=True, null=True, verbose_name='Chú thích')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời gian tải lên')

    class Meta:
        verbose_name = 'Ảnh SOS'
        verbose_name_plural = 'Ảnh SOS'
        db_table = 'sos_images'

    def __str__(self):
        return f"Ảnh SOS #{self.sos_id} - {self.caption or 'Không có chú thích'}"



# ============================================================
# NHÓM 4: BÁO CÁO HIỆN TRƯỜNG TỪ NGƯỜI DÂN & VOTE XÁC THỰC
# ============================================================
from django.utils import timezone

class CrowdReport(models.Model):
    """
    Báo cáo tình hình thực tế trên đường từ người dân (T2 + T3 + T4).
    Tách riêng khỏi bảng Alert của hệ thống để không spam Push Notification.
    """
    HAZARD_CHOICES = (
        ('FLOOD', 'Ngập lụt'),
        ('FALLEN_TREE', 'Cây đổ chắn đường'),
        ('LANDSLIDE', 'Sạt lở đất đá'),
        ('POWER_LINE', 'Dây điện đứt / Cột điện đổ'),
        ('ROAD_BLOCKED', 'Đường chia cắt / Cầu hỏng'),
    )
    SEVERITY_CHOICES = (
        ('LOW', 'Nhẹ (Mắt cá ~15cm)'),
        ('MEDIUM', 'Cảnh báo (Ngang gối ~45cm)'),
        ('HIGH', 'Nguy hiểm (Ngang yên xe ~80cm)'),
        ('CRITICAL', 'Nghiêm trọng (>100cm / Chia cắt)'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Chờ xác thực'),
        ('VERIFIED', 'Đã xác thực nguy hiểm'),
        ('RECEDING', 'Nước đang rút (Còn ngập nhẹ)'),
        ('CLEARED', 'Đường đã thông'),
        ('REJECTED', 'Báo cáo sai'),
        ('EXPIRED', 'Đã hết hạn tự động'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='crowd_reports',
        verbose_name='Người báo cáo đầu tiên'
    )
    reporter_name = models.CharField(max_length=150, blank=True, default='Người dân', verbose_name='Tên người báo')
    hazard_type = models.CharField(max_length=30, choices=HAZARD_CHOICES, default='FLOOD', verbose_name='Loại sự cố')
    water_level_cm = models.IntegerField(default=0, verbose_name='Mức nước ước tính (cm)')
    severity = models.CharField(max_length=15, choices=SEVERITY_CHOICES, default='MEDIUM', verbose_name='Mức độ')

    location_lat = models.DecimalField(max_digits=10, decimal_places=7, verbose_name='Vĩ độ (Điểm đầu / Tâm)')
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, verbose_name='Kinh độ (Điểm đầu / Tâm)')
    end_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True, verbose_name='Vĩ độ (Điểm cuối đoạn đường)')
    end_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True, verbose_name='Kinh độ (Điểm cuối đoạn đường)')
    road_geometry = models.JSONField(default=list, blank=True, verbose_name='Chuỗi tọa độ bám theo đoạn đường [[lat, lng], ...]')
    segment_length_m = models.IntegerField(default=150, verbose_name='Chiều dài đoạn đường sự cố (m)')
    address = models.CharField(max_length=500, blank=True, default='', verbose_name='Địa chỉ / Tên đoạn đường')
    description = models.TextField(blank=True, default='', verbose_name='Mô tả hiện trường')
    image = models.ImageField(
        upload_to='field_reports/%Y/%m/%d/',
        null=True, blank=True,
        verbose_name='Ảnh hiện trường'
    )

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING', verbose_name='Trạng thái')
    is_verified = models.BooleanField(default=False, verbose_name='Đã xác thực cộng đồng')
    is_hidden = models.BooleanField(default=False, verbose_name='Đã ẩn khỏi bản đồ (Admin / Hết hạn)')
    report_count = models.PositiveIntegerField(default=1, verbose_name='Số người xác nhận hiện hành (150m)')
    incident_wave = models.PositiveIntegerField(default=1, verbose_name='Đợt sự cố (Wave)')
    wave_started_at = models.DateTimeField(default=timezone.now, verbose_name='Thời điểm bắt đầu đợt sự cố')
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name='Thời điểm tự động hết hạn/ẩn')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời điểm báo')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Cập nhật cuối')
    cleared_at = models.DateTimeField(null=True, blank=True, verbose_name='Thời điểm thông đường')

    class Meta:
        verbose_name = 'Báo cáo hiện trường'
        verbose_name_plural = 'Báo cáo hiện trường'
        db_table = 'field_reports'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at'], name='idx_freport_status_created'),
            models.Index(fields=['hazard_type', 'status'], name='idx_freport_hazard_status'),
        ]

    def __str__(self):
        return f"[{self.hazard_type}] Wave #{self.incident_wave} - {self.water_level_cm}cm - {self.status} ({self.location_lat}, {self.location_lng})"


class CrowdReportVote(models.Model):
    """
    Lưu thông tin người vote xác nhận tình hình thực tế + ghi chú kèm theo.
    Tuân thủ Quy tắc 1 (1 phiếu hiện hành/tài khoản, lưu lịch sử) & Quy tắc 2 (theo đợt sự cố + TTL).
    """
    VERDICT_CHOICES = (
        ('CONFIRM_DANGER', 'Đúng, đang ngập / nguy hiểm'),
        ('WORSENED', 'Mức độ đang nặng thêm'),
        ('RECEDING', 'Nước đang rút (Vẫn còn ngập)'),
        ('CLEARED', 'Đường đã thông (Hết nguy hiểm)'),
        ('FALSE_REPORT', 'Báo cáo sai / Không có sự cố'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(
        CrowdReport,
        on_delete=models.CASCADE,
        related_name='votes',
        verbose_name='Báo cáo hiện trường'
    )
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='crowd_report_votes',
        verbose_name='Tài khoản người vote'
    )
    voter_identifier = models.CharField(
        max_length=180,
        blank=True,
        default='',
        verbose_name='Định danh tài khoản chống vote trùng'
    )
    voter_name = models.CharField(max_length=150, blank=True, default='Người dân', verbose_name='Họ tên người vote')
    voter_role = models.CharField(max_length=20, blank=True, default='CITIZEN', verbose_name='Vai trò người vote')
    verdict = models.CharField(max_length=20, choices=VERDICT_CHOICES, verbose_name='Đánh giá hiện trường')
    note = models.TextField(blank=True, default='', verbose_name='Ghi chú kèm theo')
    water_level_cm = models.IntegerField(null=True, blank=True, verbose_name='Mức nước cập nhật (cm)')
    image = models.ImageField(
        upload_to='field_report_votes/%Y/%m/%d/',
        null=True, blank=True,
        verbose_name='Ảnh minh chứng khi vote'
    )
    incident_wave = models.PositiveIntegerField(default=1, verbose_name='Thuộc đợt sự cố')
    is_active_vote = models.BooleanField(default=True, verbose_name='Phiếu hiện hành (chống trùng)')
    voted_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời gian phản hồi')

    class Meta:
        verbose_name = 'Phản hồi hiện trường'
        verbose_name_plural = 'Phản hồi hiện trường'
        db_table = 'field_report_votes'
        ordering = ['-voted_at']

    def __str__(self):
        active_tag = "ACTIVE" if self.is_active_vote else "HISTORY"
        return f"[{active_tag}|W{self.incident_wave}] {self.voter_name} ({self.voter_role}) -> {self.verdict}: {self.note[:40]}"
