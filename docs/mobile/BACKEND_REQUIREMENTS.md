# Yêu Cầu Backend (API) Theo Từng Vai Trò

Dưới đây là danh sách các API (chức năng Backend) cần xây dựng, được trình bày đơn giản, dễ hiểu và chia theo từng đối tượng sử dụng trong hệ thống SENTINEL.

---

## 👨‍👩‍👧‍👦 1. Dành cho NGƯỜI DÂN (Citizen)

*Người dân là người dùng bình thường, cần các chức năng để báo cáo khẩn cấp, tìm đường an toàn và cập nhật tình hình.*

### 🛡️ Chức năng Cứu nạn (SOS)
*   **API Gửi tín hiệu SOS:** Nhận thông tin từ app (Tọa độ GPS hiện tại, loại khẩn cấp, số điện thoại) và phát cảnh báo lên hệ thống.
*   **API Hủy/Kết thúc SOS:** Cập nhật trạng thái sự cố thành "Đã an toàn" hoặc "Hủy do bấm nhầm".

### 🗺️ Chức năng Bản đồ an toàn
*   **API Lấy dữ liệu bản đồ:** Trả về danh sách các vùng ngập lụt, vùng an toàn, và vị trí các trạm y tế xung quanh người dùng (dựa trên GPS).

### 🔔 Chức năng Cảnh báo & Cộng đồng
*   **API Lấy danh sách cảnh báo (Bảng tin):** Trả về các thông báo khẩn cấp ở gần người dùng (ví dụ: bão đang tới, đường bị ngập).
*   **API Xác nhận sự cố cộng đồng:** Cho phép người dân vote (Đúng / Sai / Vẫn nguy hiểm / Đã có cứu trợ) cho một sự cố để hệ thống AI đánh giá độ tin cậy.

### 📋 Chức năng Cá nhân
*   **API Đăng ký / Đăng nhập:** Tạo tài khoản và xác thực (Login).
*   **API Lấy Lịch sử tín hiệu:** Trả về danh sách các lần người dùng đã bấm nút SOS trong quá khứ.
*   **API Cập nhật Hồ sơ:** Lưu thông tin người thân (Emergency contacts) và thông tin y tế cơ bản của người dùng.

---

## ⛑️ 2. Dành cho ĐỘI CỨU TRỢ (Rescuer)

*Đội cứu trợ là nhân sự chuyên môn, cần giao diện điều hành, nhận nhiệm vụ và cập nhật tiến độ công việc.*

### 📊 Chức năng Điều hành (Dashboard)
*   **API Lấy Thống kê Tổng quan:** Trả về số liệu tổng (Số vùng đang gặp nạn, số nhân viên đang trực, mức độ cảnh báo hiện tại).
*   **API Lấy Danh sách Vùng Ưu tiên:** Trả về các khu vực đang cần cứu trợ gấp nhất do AI phân tích để hiển thị lên bảng điều khiển.

### 🎯 Chức năng Quản lý Nhiệm vụ
*   **API Lấy danh sách Điểm nóng (Zone List):** Trả về toàn bộ các khu vực đang có sự cố để đội cứu trợ xem xét.
*   **API Xem chi tiết Khu vực:** Trả về thông tin một khu vực cụ thể (Cần bao nhiêu người, cần thuốc men hay xe cộ gì, tình trạng nước ngập bao nhiêu).
*   **API Đăng ký nhận Nhiệm vụ:** Đội cứu trợ bấm "Tham gia", Backend sẽ ghi nhận nhân sự này đang phụ trách khu vực đó.
*   **API Cập nhật Trạng thái Hiện trường:** Nhận thông tin báo cáo từ đội cứu trợ (ví dụ: "Đã cứu được người", "Đang thiếu oxy") và cập nhật lên hệ thống.

### 🚁 Chức năng Quản lý Nguồn lực
*   **API Khai báo Nguồn lực:** Lưu thông tin đội cứu trợ đang mang theo những gì vào ca trực (Ví dụ: 1 xe tải, 2 xuồng cao su, 50 thùng nước).

### 📍 Chức năng Bản đồ Tác chiến
*   **API Dẫn đường & Cảnh báo vật cản:** Trả về lộ trình tối ưu đến khu vực cứu trợ. Nếu đường đi có sự cố (sạt lở, ngập sâu), API phải trả về cảnh báo để app vẽ đường vòng.

### 📶 Chức năng Offline (Khi mất mạng)
*   **API Đồng bộ dữ liệu (Sync):** Khi app có mạng trở lại, app sẽ gửi một gói dữ liệu lớn (những báo cáo đội cứu trợ đã làm lúc rớt mạng), Backend cần nhận, bóc tách và lưu cập nhật vào Database.

---

## ⚙️ 3. Hệ thống Lõi Backend tự xử lý (Core)
*Đây là những logic Backend phải làm ngầm bên dưới, không cần giao diện trực tiếp nhưng bắt buộc phải có.*

*   **Tích hợp Blockchain:** Mỗi khi có sự kiện quan trọng (Người dân bấm SOS, Cứu trợ báo cáo tình trạng), Backend phải tạo mã Hash bảo mật và lưu lại để chống làm giả dữ liệu.
*   **AI Engine (Trí tuệ nhân tạo):** 
    *   **Lọc tin giả:** Tự động phát hiện nếu nhiều người dân cùng bấm "Sai" cho một cảnh báo ảo.
    *   **Điều phối thông minh (Matching):** Khi có một khu vực báo cáo "Thiếu Thuyền cứu sinh", AI tự quét vị trí và gọi API thông báo cho đội cứu trợ đang có Thuyền ở gần nhất.
