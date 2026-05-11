from django.db import models

# ============================================================
# TRACKING APP
# ============================================================
# Các model GPSHistory và StatusUpdate đã được loại bỏ.
# Vị trí GPS thời gian thực hiện được lưu tại:
#   accounts.RescuerProfile.current_lat / current_lng
#
# App này được giữ lại cho mục đích mở rộng trong tương lai,
# ví dụ: lịch sử di chuyển, log hoạt động của cứu hộ viên.
# ============================================================