# 📋 Guardian Pulse — Luồng Hoạt Động Dễ Hiểu

> **Guardian Pulse** là hệ thống điều phối cứu hộ và quản lý thiên tai cho 3 nhóm: **Người dân (Citizen)**, **Đội cứu hộ (Rescuer)**, **Quản trị viên (Admin)**.

---

## 1) Bức tranh tổng quan (đọc 1 phút là hiểu)

**Dòng chảy chính:**

1. **Citizen gửi SOS** kèm GPS, loại sự cố, số người, ghi chú, ảnh.
2. **Backend ghi nhận** → **AI chấm điểm ưu tiên** → **Admin nhìn thấy trên Dashboard**.
3. **Admin tạo/điều chỉnh Zone** và **phát cảnh báo** cho khu vực liên quan.
4. **Rescuer nhận nhiệm vụ**, cập nhật tiến độ và vị trí GPS.
5. **Citizen theo dõi trạng thái** và nhận thông báo kết quả.

---

## 2) Luồng theo vai trò

### 2.1. Citizen — Người dân

**Mục tiêu:** Gửi SOS nhanh, theo dõi tình trạng, nhận cảnh báo.

**Luồng sử dụng chính:**

1. **Đăng ký/Đăng nhập** (hoặc **Demo** trong môi trường dev).
2. **Nhấn SOS** → điền **loại khẩn cấp** → **số người** → **ghi chú** → **ảnh**.
3. **Xác nhận gửi SOS** → hệ thống trả **mã SOS + trạng thái**.
4. **Theo dõi trên bản đồ**: xem vùng sự cố, vùng an toàn, trạm y tế.
5. **Nhận cảnh báo** và **vote xác nhận cộng đồng**.
6. **Kết thúc SOS** khi đã an toàn (hoặc hủy nếu nhầm).

**Màn hình chính:** Trang chủ → Bản đồ → Cảnh báo → Hồ sơ.

---

### 2.2. Rescuer — Đội cứu hộ

**Mục tiêu:** Nhận nhiệm vụ, điều phối nguồn lực, cập nhật tiến độ.

**Luồng sử dụng chính:**

1. **Đăng ký** + **nhập mã kích hoạt** do Admin cấp → **Đăng nhập**.
2. **Bật trạng thái trực** (Ready/On Duty).
3. **Xem danh sách Zone ưu tiên** (theo điểm AI).
4. **Nhận nhiệm vụ** → chọn vai trò (Cứu nạn/Y tế/Hậu cần).
5. **Cập nhật tiến độ**: Đang di chuyển → Đã đến → Hoàn thành / Cần hỗ trợ.
6. **Gửi GPS liên tục** để Admin theo dõi.
7. **Khai báo nguồn lực** (phương tiện, nhân sự).
8. **Offline**: lưu dữ liệu, tự đồng bộ khi có mạng.

**Màn hình chính:** Dashboard → Bản đồ tác chiến → Nhiệm vụ → Nguồn lực → Offline → Hồ sơ.

---

### 2.3. Admin — Quản trị viên

**Mục tiêu:** Giám sát toàn hệ thống, điều phối zone, quản lý tài khoản.

**Luồng sử dụng chính:**

1. **Đăng nhập Web Dashboard**.
2. **Dashboard tổng quan**: số SOS, số zone, mức độ nghiêm trọng.
3. **Quản lý Zone**: tạo mới, cập nhật trạng thái, chỉnh điểm ưu tiên AI.
4. **Quản lý tài khoản**: kích hoạt Rescuer, khóa tài khoản vi phạm.
5. **Theo dõi đội cứu hộ**: vị trí GPS, trạng thái di chuyển.
6. **Phát cảnh báo** theo khu vực hoặc toàn hệ thống.
7. **Báo cáo & thống kê** theo thời gian.

---

## 3) Luồng dữ liệu quan trọng

### 3.1. Luồng SOS

Citizen gửi SOS → Backend tạo SOS → AI chấm điểm → Admin xem trên Dashboard →
Admin tạo/ghép Zone → Rescuer nhận nhiệm vụ → Rescuer cập nhật tiến độ →
Citizen nhận thông báo trạng thái.

### 3.2. Luồng cảnh báo

Admin/AI tạo cảnh báo → Backend phân phối theo khu vực → Citizen/Rescuer nhận thông báo →
Citizen vote xác nhận → AI dùng dữ liệu để lọc tin giả.

### 3.3. Luồng theo dõi GPS

Rescuer gửi GPS liên tục → Backend lưu lại → Admin xem bản đồ tổng hợp.

---

## 4) Chức năng cốt lõi (tóm tắt)

- **AI Priority Scoring**: ưu tiên zone theo mức độ rủi ro.
- **AI Lọc tin giả**: dựa trên vote cộng đồng.
- **JWT Authentication**: phân quyền Citizen/Rescuer/Admin.
- **Theo dõi GPS realtime**: phục vụ điều phối và giám sát.

---

_Cập nhật lần cuối: 26/05/2026_
