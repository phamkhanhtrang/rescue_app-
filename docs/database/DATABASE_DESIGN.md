# SENTINEL — Thiết kế Database (Supabase)

Tài liệu này mô tả toàn bộ schema database đã được triển khai trên **Supabase** cho dự án SENTINEL.

---

## 🔗 Thông tin Kết nối

| Thông tin | Giá trị |
|---|---|
| **Project Name** | sentinel-rescue |
| **Supabase URL** | `https://frnrsrxlwbphzoeyhtbb.supabase.co` |
| **Anon Key (Public)** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybnJzcnhsd2JwaHpvZXlodGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDI0NzQsImV4cCI6MjA5MzAxODQ3NH0.eDGQj5W8DDzLWfJ-IhnQtsDP99ARQs-jdQUwb8lHLBY` |
| **Region** | ap-southeast-1 (Singapore) |
| **Database** | PostgreSQL 17 + PostGIS |

---

## 🗂️ Sơ đồ Các Bảng (Chi tiết Trường dữ liệu)

### Nhóm 1: Người dùng & Xác thực

#### `profiles` (Thông tin chung)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, FK (`auth.users`) | ID liên kết với Supabase Auth |
| `role` | TEXT | `IN ('CITIZEN', 'RESCUER')` | Phân quyền (Người dân / Đội cứu trợ) |
| `full_name` | TEXT | NOT NULL | Họ và tên đầy đủ |
| `phone` | TEXT | UNIQUE | Số điện thoại đăng nhập/liên hệ |
| `avatar_url` | TEXT | | Link ảnh đại diện |
| `blockchain_id` | TEXT | UNIQUE | Mã định danh người dùng trên Blockchain |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo tài khoản |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật gần nhất |

#### `citizen_profiles` (Hồ sơ Người dân)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID của hồ sơ citizen |
| `user_id` | UUID | UNIQUE, FK (`profiles.id`) | ID người dùng |
| `blood_type` | TEXT | | Nhóm máu |
| `medical_notes` | TEXT | | Ghi chú y tế (dị ứng, bệnh nền) |
| `id_number` | TEXT | | Số CCCD/CMND |
| `location_sharing` | BOOLEAN | DEFAULT TRUE | Trạng thái cho phép chia sẻ vị trí tự động |

#### `rescuer_profiles` (Hồ sơ Đội cứu trợ)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID hồ sơ rescuer |
| `user_id` | UUID | UNIQUE, FK (`profiles.id`) | ID người dùng |
| `unit_name` | TEXT | | Tên đơn vị trực thuộc |
| `rank` | TEXT | | Cấp bậc |
| `specialty` | TEXT | `IN ('SEARCH_RESCUE', 'MEDICAL', 'LOGISTICS', 'COMMAND')` | Chuyên môn cứu hộ |
| `is_on_duty` | BOOLEAN | DEFAULT FALSE | Trạng thái đang làm nhiệm vụ/trực |
| `current_location` | GEOMETRY(Point) | | Vị trí hiện tại (GPS thời gian thực) |

#### `emergency_contacts` (Liên hệ Khẩn cấp)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID liên hệ |
| `user_id` | UUID | FK (`profiles.id`) | ID người dân sở hữu liên hệ này |
| `name` | TEXT | NOT NULL | Tên người liên hệ |
| `phone` | TEXT | NOT NULL | Số điện thoại liên hệ |
| `relation` | TEXT | | Mối quan hệ (Cha mẹ, Vợ/chồng...) |

---

### Nhóm 2: Sự cố & Cảnh báo

#### `zones` (Vùng Sự cố)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID vùng sự cố |
| `name` | TEXT | NOT NULL | Tên định danh (Vùng 7G, Khu Lam...) |
| `sector_code` | TEXT | | Mã khu vực/quản lý |
| `status` | TEXT | `IN ('ACTIVE', 'STABILIZING', 'RESOLVED', 'STANDBY')` | Trạng thái vùng |
| `severity` | TEXT | `IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')` | Mức độ nghiêm trọng |
| `incident_type` | TEXT | `IN ('FLOOD', 'STORM', 'FIRE', 'EARTHQUAKE', 'MEDICAL', 'OTHER')` | Loại sự cố |
| `description` | TEXT | | Mô tả chi tiết |
| `location` | GEOMETRY(Point) | NOT NULL | Tọa độ trung tâm vùng |
| `affected_area` | GEOMETRY(Polygon) | | Đa giác mô tả toàn bộ diện tích bị ảnh hưởng |
| `people_affected` | INT | DEFAULT 0 | Số người bị ảnh hưởng ước tính |
| `rescuers_needed` | INT | DEFAULT 0 | Số lượng cứu hộ viên cần thiết |
| `water_level_cm` | INT | | Mực nước ngập (nếu là ngập lụt) |
| `ai_priority_score` | NUMERIC(5,2) | | Điểm ưu tiên do AI tính toán |

#### `alerts` (Cảnh báo & Phát thanh)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID cảnh báo |
| `zone_id` | UUID | FK (`zones.id`) | (Tùy chọn) Vùng sự cố liên quan |
| `title` | TEXT | NOT NULL | Tiêu đề cảnh báo |
| `category` | TEXT | | Loại cảnh báo (Lũ lụt, Cháy, Y tế...) |
| `severity` | TEXT | | Mức độ nghiêm trọng |
| `source` | TEXT | `IN ('SYSTEM', 'COMMUNITY', 'AUTHORITY', 'AI')` | Nguồn phát cảnh báo |
| `location` | GEOMETRY(Point) | | Vị trí sự cố cảnh báo |
| `is_active` | BOOLEAN | DEFAULT TRUE | Trạng thái còn hiệu lực |
| `verify_true_count` | INT | DEFAULT 0 | Lượt vote "Xác nhận đúng" từ cộng đồng |
| `verify_false_count` | INT | DEFAULT 0 | Lượt vote "Tin giả" từ cộng đồng |
| `blockchain_hash` | TEXT | | Chuỗi hash xác thực blockchain (nếu có) |

#### `alert_verifications` (Lịch sử Vote Cộng đồng)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `alert_id` | UUID | FK (`alerts.id`) | Cảnh báo được vote |
| `user_id` | UUID | FK (`profiles.id`) | Người dùng thực hiện vote |
| `verdict` | TEXT | `IN ('TRUE', 'FALSE', 'STILL_DANGER', 'RESCUED')` | Kết quả người dùng xác nhận |
| *(UNIQUE)* | | `(alert_id, user_id)` | Ràng buộc 1 người/1 vote cho mỗi alert |

---

### Nhóm 3: SOS & Khẩn cấp

#### `sos_signals` (Tín hiệu Cầu cứu)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID SOS |
| `citizen_id` | UUID | FK (`profiles.id`) | ID người dân phát SOS |
| `signal_type` | TEXT | `IN ('SOS', 'PING', 'TEST')` | Loại tín hiệu |
| `status` | TEXT | `IN ('PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')` | Trạng thái tiếp nhận SOS |
| `location` | GEOMETRY(Point) | NOT NULL | Tọa độ lúc phát tín hiệu |
| `emergency_type` | TEXT | | Phân loại khẩn cấp (Ngập lụt, Mắc kẹt...) |
| `people_count` | INT | DEFAULT 1 | Số lượng nạn nhân |
| `zone_id` | UUID | FK (`zones.id`) | Vùng ảnh hưởng (gắn tự động) |
| `assigned_rescuer_id` | UUID | FK (`profiles.id`) | Rescuer được phân công xử lý SOS này |
| `blockchain_hash` | TEXT | | Hash lưu vết SOS trên blockchain |
| `sent_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời điểm gửi |

#### `sos_status_logs` (Nhật ký Xử lý SOS)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `sos_id` | UUID | FK (`sos_signals.id`) | ID SOS |
| `updated_by` | UUID | FK (`profiles.id`) | Người thực hiện cập nhật (thường là Rescuer) |
| `old_status` | TEXT | | Trạng thái trước đó |
| `new_status` | TEXT | NOT NULL | Trạng thái mới |
| `note` | TEXT | | Ghi chú cập nhật |

---

### Nhóm 4: Nhiệm vụ & Nguồn lực

#### `missions` (Nhiệm vụ Cứu hộ)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID nhiệm vụ |
| `zone_id` | UUID | FK (`zones.id`) | Khu vực cần xử lý |
| `rescuer_id` | UUID | FK (`profiles.id`) | Cứu hộ viên nhận nhiệm vụ |
| `role` | TEXT | | Vai trò trong nhiệm vụ (Y tế, Hậu cần...) |
| `status` | TEXT | `IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'TRANSFERRED')` | Trạng thái nhiệm vụ |
| `joined_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời điểm tham gia |
| `people_rescued` | INT | DEFAULT 0 | Số nạn nhân đã cứu thành công |

#### `mission_status_updates` (Cập nhật Hiện trường)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `mission_id` | UUID | FK (`missions.id`) | Nhiệm vụ liên quan |
| `zone_id` | UUID | FK (`zones.id`) | Vùng liên quan |
| `rescuer_id` | UUID | FK (`profiles.id`) | Người báo cáo |
| `field_status` | TEXT | `IN ('STABLE', 'CRITICAL', 'IMPROVING', 'DETERIORATING', 'LOST_CONTACT')` | Đánh giá tổng quan hiện trường |
| `victim_status` | TEXT | | Tình trạng nạn nhân (An toàn, Bị thương...) |
| `report_text` | TEXT | NOT NULL | Mô tả chi tiết bằng chữ |
| `blockchain_hash` | TEXT | | Ghi log blockchain (Chống chối bỏ) |

#### `resources` (Nguồn lực khai báo)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID nguồn lực |
| `rescuer_id` | UUID | FK (`profiles.id`) | Người mang theo |
| `vehicle_type` | TEXT | | Loại phương tiện (Xe tải, Xuồng, Trực thăng...) |
| `specialty_type` | TEXT | | Chuyên môn nguồn lực (Y tế, Kỹ thuật...) |
| `supplies` | JSONB | DEFAULT '{}' | Chi tiết vật tư (Nước, Bông băng, Thức ăn...) |
| `is_available` | BOOLEAN | DEFAULT TRUE | Trạng thái rảnh rỗi, có thể điều phối |

---

### Nhóm 5: Hỗ trợ & Hạ tầng

#### `blockchain_logs` (Nhật ký Bất biến)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_v4() | ID log |
| `entity_type` | TEXT | | Loại thao tác (SOS, UPDATE, VERIFY...) |
| `entity_id` | UUID | | ID bản ghi gốc |
| `action_summary` | TEXT | NOT NULL | Tóm tắt hành động tiếng Việt |
| `data_snapshot` | JSONB | | Lưu trữ ảnh chụp dữ liệu lúc đó để đối chiếu |
| `block_hash` | TEXT | NOT NULL | Mã Hash hiện tại của block |
| `previous_hash` | TEXT | | Hash của block phía trước (tạo thành chuỗi) |
| `is_verified` | BOOLEAN | DEFAULT FALSE | Trạng thái đồng thuận |

#### `offline_sync_queue` (Hàng đợi Offline)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `user_id` | UUID | FK (`profiles.id`) | Chủ sở hữu thao tác |
| `operation_type` | TEXT | | Loại API cần gọi bù (Vd: Gửi SOS, Gửi Cập nhật) |
| `payload` | JSONB | NOT NULL | Dữ liệu gốc cần gửi |
| `status` | TEXT | `IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')` | Trạng thái đồng bộ mạng |
| `captured_at` | TIMESTAMPTZ | NOT NULL | Thời gian thực lúc bấm nút khi mất mạng |

#### `nav_routes` (Lộ trình Di chuyển)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `mission_id` | UUID | FK (`missions.id`) | Nhiệm vụ của lộ trình này |
| `origin_location` | GEOMETRY(Point) | NOT NULL | Điểm bắt đầu |
| `target_location` | GEOMETRY(Point) | NOT NULL | Điểm đến |
| `distance_km` | NUMERIC(8,2) | | Khoảng cách (km) |
| `eta_minutes` | INT | | Thời gian dự kiến (phút) |
| `has_obstruction` | BOOLEAN | DEFAULT FALSE | Có vật cản/ngập lụt trên tuyến không |
| `is_ai_optimized` | BOOLEAN | DEFAULT TRUE | Đã qua tối ưu AI hay chưa |

#### `dashboard_stats` (Thống kê Tổng hợp Rescuer)
| Trường | Kiểu dữ liệu | Ràng buộc / Khóa | Mô tả |
|---|---|---|---|
| `total_zones_active` | INT | DEFAULT 0 | Tổng số Vùng nguy hiểm đang diễn ra |
| `total_sos_pending` | INT | DEFAULT 0 | Số SOS chờ xử lý |
| `system_alert_level` | TEXT | | Cảnh báo toàn hệ thống (Đỏ/Vàng...) |
| `ai_prediction_text` | TEXT | | Văn bản khuyến nghị từ AI cho Chỉ huy |
-

## 🔐 Bảo mật (Row Level Security)

Tất cả các bảng đều bật **RLS (Row Level Security)**. Quy tắc chính:
- **Người dân:** Chỉ đọc/ghi dữ liệu của chính mình.
- **Đội cứu trợ:** Đọc được SOS và Zone của người dân, quản lý nhiệm vụ riêng.
- **Dữ liệu công khai:** `zones`, `alerts`, `safe_locations` cho phép đọc công khai.

---

## ⚡ Extensions đã cài

- **`uuid-ossp`:** Tự động sinh UUID cho Primary Keys.
- **`postgis`:** Xử lý dữ liệu không gian (bản đồ, tọa độ GPS, tính khoảng cách).

 