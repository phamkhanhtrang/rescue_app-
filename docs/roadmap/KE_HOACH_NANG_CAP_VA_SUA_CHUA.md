# 📋 ĐẶC TẢ CHI TIẾT KẾ HOẠCH NÂNG CẤP & SỬA ĐỔI HỆ THỐNG
## Dự án: Guardian Pulse — Hệ thống Điều phối Cứu hộ & Quản lý Thiên tai
**Phiên bản:** 2.1 (Bản chuẩn hóa phục vụ Đồ án Tốt nghiệp)  
**Ngày cập nhật:** 06/10/2026  
**Căn cứ:** Rà soát hiện trạng mã nguồn `D:\rescue_app-`, mô hình thực chiến từ `nuoclen.com` và thực tiễn cứu hộ bão lũ Việt Nam.

---

## 🧭 BẢNG MA TRẬN TỔNG QUAN (EXECUTIVE DASHBOARD)

> Giúp người đọc, giảng viên và hội đồng nắm bắt toàn bộ 18 hạng mục công việc trong 1 phút trước khi đi vào chi tiết kỹ thuật.

### 1. Phân nhóm Sửa lỗi Hệ thống Cốt lõi (S1 – S7)
| Mã | Tên hạng mục | Phân hệ | Mức độ | Mục tiêu cốt lõi |
| :---: | :--- | :---: | :---: | :--- |
| **S1** | Động cơ Dẫn đường Né ngập (Pathfinding) | Backend / App | 🔴 Khẩn cấp | Thay thế đồ thị giả lập Đà Nẵng bằng OSRM né ngập an toàn. |
| **S2** | Luồng Yêu cầu Chi viện (`NEEDS_HELP`) | Backend / App | 🔴 Khẩn cấp | Sửa lỗi endpoint `/complete/`, cho phép cứu hộ xin chi viện thực tế. |
| **S3** | Nén ảnh SOS Hiện trường (Client Resize) | App (Citizen) | 🔴 Khẩn cấp | Nén ảnh từ 15MB xuống ~300KB trước khi upload, chống sập khi sóng 3G yếu. |
| **S4** | Thẻ Trạng thái GPS Thông minh | App (Citizen) | 🟡 Quan trọng | Chuyển câu tĩnh "Bạn đang an toàn" thành đánh giá nguy cơ theo GPS thật. |
| **S5** | Vòng đời Đóng Dữ liệu Tự động | Backend | 🟡 Quan trọng | Tự động cập nhật trạng thái liên hoàn: SOS ➔ Nhiệm vụ ➔ Zone cứu hộ. |
| **S6** | Xác minh Cảnh báo bằng Lượt Vote | Backend / App | 🟡 Quan trọng | Ngưỡng tin cậy cộng đồng (AlertVote) để lọc cảnh báo rác. |
| **S7** | Hoàn thiện Phân quyền & JWT | Web / Backend | 🟡 Quan trọng | Bọc `ProtectedRoute` trên Web Admin và cấu hình JWT bảo vệ API nhạy cảm. |

### 2. Phân nhóm Tính năng Nâng cấp & Đổi mới Sáng tạo (T1 – T11)
| Mã | Tên hạng mục | Phân hệ | Mức độ | Mục tiêu cốt lõi |
| :---: | :--- | :---: | :---: | :--- |
| **T1** | Mở Google Maps né Vùng nguy hiểm | App (Rescuer) | 🟢 Tiện ích | Xuất Waypoints né ngập sang Google Maps ngoài để tài xế rảnh tay. |
| **T2** | Lớp Bản đồ Radar Mưa Động | Web / App | 🟢 Tiện ích | Tích hợp lớp phủ mây mưa thời gian thực (RainViewer API) lên bản đồ. |
| **T3** | Báo cáo Hiện trường từ Người dân | App (Citizen) | 🌟 Đổi mới | Biến người dân thành cảm biến: báo mực nước, cây đổ, sạt lở có cấu trúc. |
| **T4** | Xác minh Chéo Cộng đồng (150m) | Backend | 🌟 Đổi mới | Tự động gom cụm các báo cáo gần nhau trong 150m để phát hiện sự cố thật. |
| **T5** | Báo Tín hiệu An toàn / Nước rút | App / Backend | 🟢 Tiện ích | Dọn dẹp hiện trường bản đồ khi nước rút, tránh cứu trợ trùng lặp. |
| **T6** | Phòng Chat Điều phối Vi mô theo Vùng | Web / App | 🟢 Tiện ích | Kênh giao tiếp có kiểm duyệt giữa Đội cứu hộ và Dân trong cùng 1 Zone. |
| **T7** | Báo động Tức thì Real-time (SSE) | Backend / Web | 🟡 Quan trọng | Loại bỏ Polling 15s; Web Admin nhận tín hiệu SOS nhảy điểm tức thì (<1s). |
| **T8** | Telegram Bot Báo động Đỏ Chỉ huy | Backend | 🟡 Quan trọng | Bắn tin khẩn và phân công đội cứu hộ trực tiếp qua Telegram của Chỉ huy. |
| **T9** | Theo dõi Bán kính & Thông báo Đẩy | App / Backend | 🟢 Tiện ích | Nhận Push Notification khi khu vực nhà người thân có lệnh sơ tán. |
| **T10**| Geocoding Ngõ ngách VN (Goong API) | Backend | 🟡 Quan trọng | Dịch chính xác địa chỉ ngõ/ngách/thôn/xóm cào từ Facebook ra tọa độ GPS. |
| **T11**| ⭐ **Cứu Nạn Ngoại Tuyến Bluetooth** | **Mobile App** | 👑 **Đột phá** | **Cứu hộ tầm gần không cần Internet: Radar Sonar, còi/flash, chat BLE.** |

---

## 📑 MỤC LỤC CHI TIẾT

1. [PHẦN I: CHI TIẾT 7 HẠNG MỤC SỬA LỖI CỐT LÕI (S1 – S7)](#phần-i-chi-tiết-7-hạng-mục-sửa-lỗi-cốt-lõi-s1--s7)
   * [Trụ cột A: Điều hướng Cứu hộ & Nghiệp vụ Tác chiến (S1, S2)](#trụ-cột-a-điều-hướng-cứu-hộ--nghiệp-vụ-tác-chiến)
   * [Trụ cột B: Tối ưu Hiện trường & Người dân (S3, S4)](#trụ-cột-b-tối-ưu-hiện-trường--người-dân)
   * [Trụ cột C: Toàn vẹn Dữ liệu & Bảo mật (S5, S6, S7)](#trụ-cột-c-toàn-vẹn-dữ-liệu--bảo-mật)
2. [PHẦN II: CHI TIẾT 11 TÍNH NĂNG NÂNG CẤP & ĐMST (T1 – T11)](#phần-ii-chi-tiết-11-tính-năng-nâng-cấp--đmst-t1--t11)
   * [Trụ cột 1: Tác chiến Hiện trường & Dẫn đường (T1, T2)](#trụ-cột-1-tác-chiến-hiện-trường--dẫn-đường)
   * [Trụ cột 2: Cảm biến Cộng đồng & Hiện trường (T3, T4, T5, T6)](#trụ-cột-2-cảm-biến-cộng-đồng--hiện-trường)
   * [Trụ cột 3: Thời gian thực & Hạ tầng Báo động (T7, T8, T9, T10)](#trụ-cột-3-thời-gian-thực--hạ-tầng-báo-động)
   * [Trụ cột 4: ⭐ Đột phá Công nghệ — Cứu nạn Ngoại tuyến Bluetooth (T11)](#trụ-cột-4--đột-phá-công-nghệ--cứu-nạn-ngoại-tuyến-bluetooth-t11)
3. [PHẦN III: MA TRẬN LIÊN THÔNG VÀ TRẢI NGHIỆM NGƯỜI DÙNG](#phần-iii-ma-trận-liên-thông-và-trải-nghiệm-người-dùng)
4. [PHẦN IV: KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN (SPRINT PLAN)](#phần-iv-kế-hoạch-triển-khai-theo-giai-đoạn-sprint-plan)

---

# PHẦN I: CHI TIẾT 7 HẠNG MỤC SỬA LỖI CỐT LÕI (S1 – S7)

### Trụ cột A: Điều hướng Cứu hộ & Nghiệp vụ Tác chiến

#### 🔹 S1. Động cơ Dẫn đường Cứu hộ Né ngập (Pathfinding)
* **Vị trí code:** `backend/rescue_operations/pathfinding.py` & `FE-app/src/screens/rescuer/missions/MissionNavScreen.js`.
* **Hiện trạng lỗi:**
  * Thuật toán $A^*$ đang chạy trên đồ thị hardcode tọa độ thủ công tại Đà Nẵng; cứu hộ ở tỉnh khác sẽ lỗi.
  * Khi API lỗi, code app tự vẽ một **đường thẳng** nối từ xe đến đích (rất nguy hiểm vì xe có thể lao xuống sông).
* **Giải pháp & Kịch bản mới:**
  1. Tích hợp động cơ định tuyến mở toàn quốc: **OSRM (Open Source Routing Machine)**.
  2. Backend quét tất cả các `Zone` đang ngập sâu nằm trên hành lang di chuyển, dựng rào cản ảo (`exclude_polygons`).
  3. Trả về lộ trình an toàn đi qua các trục đường còn thông suốt.
  4. Nếu mất mạng: Hiện cảnh báo an toàn rõ ràng, tuyệt đối không vẽ đường thẳng qua sông hồ.

#### 🔹 S2. Luồng Cập nhật Trạng thái & Yêu cầu Chi viện (`NEEDS_HELP`)
* **Vị trí code:** `FE-app/src/screens/rescuer/missions/StatusUpdateScreen.js` & `backend/reporting/views.py`.
* **Hiện trạng lỗi:** Màn hình cho chọn `NEEDS_HELP` (Cần chi viện), nhưng code luôn gọi cố định vào endpoint `/complete/`, biến yêu cầu chi viện thành "Hoàn thành nhiệm vụ", làm gãy nghiệp vụ cứu nạn.
* **Giải pháp & Kịch bản mới:**
  1. Khi ca-nô hỏng máy hoặc nước chảy xiết: Cứu hộ bấm **"Cần chi viện khẩn cấp" (`NEEDS_HELP`)**.
  2. Gửi `PATCH /api/missions/{id}/status/` với payload `{ "status": "NEEDS_HELP", "reason": "Thuyền hỏng máy..." }`.
  3. Dashboard Admin Web lập tức phát chuông báo động, nhấp nháy đỏ cảnh báo: *"Đội A cần chi viện gấp!"*.

---

### Trụ cột B: Tối ưu Hiện trường & Người dân

#### 🔹 S3. Tối ưu Luồng gửi SOS & Nén ảnh Hiện trường (Client-side Resize)
* **Vị trí code:** `FE-app/src/screens/citizen/sos/SendSOSScreen.js` & Backend upload.
* **Hiện trạng lỗi:** Ảnh chụp camera nặng 10MB–20MB; vùng lũ sóng yếu tải ảnh sẽ đơ app hoặc rớt mạng khiến người dân bấm liên tục tạo SOS trùng lặp.
* **Giải pháp & Kịch bản mới:**
  1. Tích hợp thư viện `expo-image-manipulator` co ảnh lại tối đa chiều dài 1280px, nén JPEG 80%.
  2. Dung lượng ảnh giảm từ **15MB xuống còn ~300KB – 500KB** (giảm 97%).
  3. Đóng gói cả tọa độ GPS, nội dung văn bản và ảnh đã nén vào cùng 1 request duy nhất (Multipart form-data) gửi thành công trong 2–3 giây.

#### 🔹 S4. Thẻ Trạng thái Thông minh trên Trang chủ Người dân
* **Vị trí code:** `FE-app/src/screens/citizen/home/HomeScreen.js`.
* **Hiện trạng lỗi:** Trang chủ gắn cứng chữ tĩnh: *"Bạn đang an toàn"*, không dựa trên thực tế.
* **Giải pháp & Kịch bản mới:**
  1. Khi mở app, hệ thống lấy GPS hiện tại và gọi API `/api/citizen/status-summary/?lat=...&lng=...`.
  2. Quét dữ liệu bán kính 1km và hiển thị thẻ hành động trực quan trên đầu trang chủ:
     * 🟢 *An toàn:* "Khu vực của bạn hiện chưa có cảnh báo ngập lụt."
     * 🟡 *Cảnh giác:* "Có điểm ngập sâu cách bạn 400m. Hãy theo dõi sát."
     * 🔴 *Khẩn cấp:* "Bạn đang nằm trong vùng nguy cơ cao! Hãy di chuyển lên vị trí cao hoặc gửi SOS."

---

### Trụ cột C: Toàn vẹn Dữ liệu & Bảo mật

#### 🔹 S5. Vòng đời Tự động Đóng Dữ liệu (SOS ➔ Mission ➔ Zone)
* **Vị trí code:** `backend/rescue_operations/models.py` & Django Signals.
* **Hiện trạng lỗi:** Khi cứu hộ hoàn thành nhiệm vụ, SOS đã cứu nhưng Zone vẫn mở vĩnh viễn, khiến bản đồ ngập tràn các vùng sự cố cũ.
* **Giải pháp & Kịch bản mới:**
  * Cài đặt máy trạng thái tự động qua Django Signals:
    $$\text{Tất cả SOS trong Zone đã RESOLVED} \implies \text{Zone tự chuyển sang RESOLVED} \implies \text{Đội cứu hộ chuyển về SẴN SÀNG}$$

#### 🔹 S6. Cơ chế Xác minh Cảnh báo bằng Lượt Vote (AlertVote)
* **Vị trí code:** `FE-app/src/screens/citizen/alerts/AlertsScreen.js` & `backend/communications/views.py`.
* **Hiện trạng lỗi:** Cảnh báo có nút "Xác nhận tin này đúng/sai" nhưng bấm vào chưa cập nhật độ tin cậy.
* **Giải pháp & Kịch bản mới:**
  * Mỗi cảnh báo tính điểm tin cậy: $\text{Confidence} = \text{Vote\_Đúng} - \text{Vote\_Sai}$.
  * Nếu $\text{Confidence} \ge 3$: Cảnh báo gắn huy hiệu *"Đã xác thực bởi cộng đồng"*.
  * Nếu $\text{Confidence} \le -3$: Tự động ẩn khỏi bản đồ để tránh tin đồn giả mạo.

#### 🔹 S7. Hoàn thiện Xác thực & Phân quyền Bảo mật
* **Vị trí code:** `FE-web/src/App.tsx`, `CitizenLoginScreen.js`, `backend/settings.py`.
* **Hiện trạng lỗi:** Web Admin chưa có Route Protection (gõ link trực tiếp vẫn vào được trang trong); Backend thiếu xác thực JWT đồng bộ.
* **Giải pháp & Kịch bản mới:**
  * Bọc toàn bộ các trang Admin bằng component `<ProtectedRoute allowedRoles={['ADMIN']} />`.
  * Cấu hình `DEFAULT_AUTHENTICATION_CLASSES = ['rest_framework_simplejwt.authentication.JWTAuthentication']` trong Django để khóa các API nhạy cảm.

---

# PHẦN II: CHI TIẾT 11 TÍNH NĂNG NÂNG CẤP & ĐMST (T1 – T11)

### Trụ cột 1: Tác chiến Hiện trường & Dẫn đường

#### 🔹 T1. Mở Ứng dụng Google Maps né Vùng nguy hiểm (Waypoints)
* **Mục đích:** Tận dụng Google Maps ngoài đời để tài xế cứu hộ nghe chỉ đường Turn-by-Turn bằng giọng nói quen thuộc mà vẫn né được đường ngập.
* **Cách thực hiện:**
  1. Backend tính toán tuyến đường an toàn né ngập bằng OSRM, trích xuất 2–3 điểm ngoặt quan trọng (Waypoints).
  2. App mở URL Scheme Google Maps:
     ```text
     https://www.google.com/maps/dir/?api=1&origin={lat1},{lng1}&destination={lat2},{lng2}&waypoints={lat_w1},{lng_w1}|{lat_w2},{lng_w2}&travelmode=driving
     ```
  3. Google Maps tự động dẫn đường tài xế đi vòng qua đúng các điểm an toàn đã chỉ định.

#### 🔹 T2. Lớp Bản đồ Radar Mưa Động (RainViewer API)
* **Mục đích:** Chỉ huy và Đội cứu hộ quan sát mây bão thời gian thực trước khi quyết định cho xuồng xuất kích.
* **Cách thực hiện:**
  * Tích hợp lớp phủ mây mưa động từ **RainViewer API** lên bản đồ Leaflet.
  * Hiển thị thanh trượt thời gian 2 giờ qua kèm nút Play ▶ để xem hướng di chuyển của cơn bão.

---

### Trụ cột 2: Cảm biến Cộng đồng & Hiện trường

#### 🔹 T3. Báo cáo Hiện trường từ Người dân (Field Reporting)
* **Mục đích:** Biến người dân thành cảm biến sống báo cáo tình hình đường sá (ngập nước, sạt lở, cây đổ).
* **Giao diện & Dữ liệu:**
  * Nút xanh trên app: **"Báo tình hình đường sá"**.
  * Bảng chọn trực quan:
    1. *Mức nước:* Mắt cá chân 🟢 | Ngang gối 🟡 | Quá bánh xe / Nóc nhà 🔴 | Đã rút nước ⚪.
    2. *Loại sự cố:* Ngập sâu | Cây đổ | Cầu gãy | Dây điện đứt | Đường bị cô lập.
    3. *Tùy chọn:* Chấm 1 điểm hoặc chạm 2 điểm báo ngập cả một đoạn đường.

#### 🔹 T4. Cơ chế Xác minh Chéo Cộng đồng (Corroboration)
* **Mục đích:** Lọc tin báo đùa, tự động khẳng định sự cố thật khi có nhiều người cùng báo cáo.
* **Cách thực hiện:**
  * Khi người dân B gửi báo cáo trong bán kính **150 mét** của người dân A:
  * Thuật toán tự động gom vào cùng 1 cụm, nhân đôi điểm ưu tiên (`priority_score`). Ghim trên bản đồ chuyển sang màu đỏ đậm kèm huy hiệu `+2`, `+5` người xác nhận.

#### 🔹 T5. Báo Tín hiệu An toàn / Nước rút (Clear Signal)
* **Mục đích:** Dọn dẹp hiện trường bản đồ, tránh cứu hộ lần hai gây lãng phí nguồn lực.
* **Cách thực hiện:**
  * Nạn nhân hoặc cứu hộ bấm nút: **"Tôi đã an toàn / Nước đã rút"**.
  * Ghim đỏ lập tức đổi thành màu xám/xanh kèm dấu tích xanh `✓` (nhãn *"Vừa hết ngập 15 phút trước"*). Tự động gỡ cảnh báo bán kính 300m xung quanh.

#### 🔹 T6. Phòng Chat Điều phối Vi mô theo Vùng (Zone Incident Chat)
* **Mục đích:** Kênh giao tiếp vi mô có kiểm soát giữa Đội cứu hộ và Dân trong cùng 1 Zone ngập lụt.
* **Quy tắc vận hành nghiêm ngặt chống spam:**
  1. Chỉ người có GPS thực tế nằm trong Zone hoặc Đội cứu hộ phụ trách mới được vào nhắn tin.
  2. Giới hạn 150 ký tự/tin, mỗi tin cách nhau 30 giây (Rate-limit).
  3. Đội cứu hộ có quyền Ghim (PIN) thông báo quan trọng lên đầu phòng chat.
  4. Nút ngắt khẩn cấp (Emergency Mute): Admin có quyền khóa chat về chế độ "Chỉ đọc" khi có kẻ tung tin đồn vỡ đập gây hoảng loạn.

---

### Trụ cột 3: Thời gian thực & Hạ tầng Báo động

#### 🔹 T7. Kênh Báo động Tức thì Real-time (Server-Sent Events)
* **Mục đích:** Loại bỏ việc Web Admin phải gọi API liên tục mỗi 15 giây (Polling) gây chậm máy.
* **Cách thực hiện:**
  * Backend Django cung cấp endpoint SSE: `GET /api/feed/stream/`.
  * Khi thực địa có SOS mới, Django bắn sự kiện JSON về trình duyệt tức thì: Điểm ghim nhấp nháy đỏ trên bản đồ Web và phát chuông báo động trong vòng **< 1 giây**.

#### 🔹 T8. Kênh Thông báo Khẩn cấp qua Telegram Bot cho Chỉ huy
* **Mục đích:** Báo động di động tức thì đến các cấp lãnh đạo mà không cần mở laptop.
* **Cách thực hiện:**
  * Khi có ca SOS đặc biệt nguy kịch, Telegram Bot tự động bắn tin vào nhóm Chỉ huy:
    ```text
    🚨 BÁO ĐỘNG ĐỎ: YÊU CẦU CỨU HỘ KHẨN CẤP!
    📍 Địa chỉ: Ngõ 86 Nhân Hòa, Thanh Xuân, Hà Nội
    ⚠️ Tình trạng: Nước ngập ngực, 1 cụ già tai biến, 2 trẻ nhỏ
    [🗺 Xem Bản Đồ Điều Phối]   [✅ Nhận Điều Động Đội A]
    ```
  * Chỉ huy bấm nút duyệt ngay trên Telegram để giao nhiệm vụ cho đội cơ động.

#### 🔹 T9. Đặt Theo dõi Bán kính & Thông báo Đẩy (Push Notifications)
* **Mục đích:** Người dân nhận cảnh báo chủ động khi vắng nhà hoặc theo dõi người thân ở vùng lũ.
* **Cách thực hiện:**
  * Bấm nút *"🔔 Theo dõi khu vực này (Bán kính 500m)"* trên app.
  * Khi khu vực đó có cảnh báo ngập sâu hoặc lệnh di dân khẩn cấp, máy tự động phát chuông và hiện thông báo đẩy ra màn hình khóa qua **Expo Push Notifications**.

#### 🔹 T10. Tích hợp Geocoding Ngõ ngách Chi tiết (Goong API)
* **Mục đích:** Khắc phục nhược điểm của OpenStreetMap vốn rất kém khi tìm ngõ, ngách, thôn, xóm ở làng quê Việt Nam.
* **Cách thực hiện:**
  * Tích hợp **Goong Geocoding API** ở tầng Backend.
  * Khi AI cào bài Facebook (*"Ngách 12/4 thôn Đông..."*), Goong dịch chính xác cụm địa chỉ này ra tọa độ GPS để ghim lên bản đồ cứu nạn.

---

### Trụ cột 4: ⭐ Đột phá Công nghệ — Cứu nạn Ngoại tuyến Bluetooth (T11)

> 🌟 **TÍNH NĂNG CỐT LÕI ĐỘT PHÁ CHO ĐỒ ÁN TỐT NGHIỆP (ĐỊNH HƯỚNG ĐỔI MỚI SÁNG TẠO & KHỞI NGHIỆP)**  
> **Giải quyết nút thắt sống còn:** Khi bão lũ làm sập cột sóng 4G/BTS, cắt điện, đứt cáp viễn thông toàn vùng, hệ thống chuyển sang chế độ cứu nạn cự ly gần độc lập hoàn toàn với Internet.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               MÔ HÌNH HOẠT ĐỘNG NGOẠI TUYẾN BLUETOOTH (OFFLINE BLE GRID)               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [ NGƯỜI GẶP NẠN (CITIZEN) ]                         [ ĐỘI CỨU HỘ (RESCUER) ]        │
│   • GPS Vệ tinh độc lập (0đ, không cần mạng)          • Ca-nô / Xuồng tuần tra trong đêm│
│   • Nén gói tin SOS thành 16 bytes                    • Bật màn hình Radar tầm soát    │
│   • Phát xung BLE Advertising (mỗi 800ms)             • Quét và lọc header '0xGP'      │
│                     │                                              │                   │
│                     │ 📡 Sóng Bluetooth BLE (Bán kính 30m - 70m)  │                   │
│                     └──────────────────────────────────────────────┘                   │
│                                            │                                           │
│         ┌──────────────────────────────────┴──────────────────────────────────┐        │
│         ▼                                                                     ▼        │
│  [ DÒ TÌM & DẪN ĐƯỜNG ]                                              [ TƯƠNG TÁC TẦM GẦN ]     │
│  • Tính cự ly từ RSSI (30m ➔ 15m ➔ 5m)                                • Cứu hộ gửi lệnh Ping   │
│  • Còi Sonar bíp nhanh dần + Rung Haptics                            • Máy dân chớp Flash SOS │
│  • Hiện chấm mục tiêu trên Radar Sonar 360°                           • Tự hú còi âm lượng max │
│                                                                       • Bộ đàm chat BLE 1-chạm │
│                                                                                        │
│         ┌─────────────────────────────────────────────────────────────────────┐        │
│         │  KẾT THÚC: Bắt tay đổi trạng thái "Đã Cứu" ➔ Ra vùng có 4G tự đồng bộ│        │
│         └─────────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Chi tiết 4 Phân hệ Kỹ thuật:

##### 1. Phao Cứu Sinh Kỹ Thuật Số (BLE SOS Beacon & Compact Protocol)
* **Vị trí code:** `FE-app/src/screens/citizen/alerts/OfflineModeScreen.js`.
* **Cơ chế:** Khi mất mạng, người dân bật *"KÍCH HOẠT PHAO CỨU SINH BLE"*. Điện thoại phát xung quảng bá mỗi 800ms.
* **Gói tin siêu nén 16 bytes (Compact Hex Protocol):**
  ```text
  [0xGP (2B)] [SOS_ID (4B)] [Nhân_khẩu (1B)] [Mức_nguy_cấp (1B)] [GPS_Lat (4B)] [GPS_Lng (4B)]
  ```
  * `0xGP`: Header nhận diện của hệ thống để lọc bỏ các thiết bị Bluetooth khác.
  * Tọa độ GPS lấy trực tiếp từ chip vệ tinh điện thoại (miễn phí, không cần 4G).
  * Tiêu thụ dòng cực nhỏ (~10-15 mA), phát liên tục **24 – 48 giờ**.

##### 2. Radar Tầm Soát Cự Ly Gần (Proximity Sonar Radar & RSSI Filter)
* **Vị trí code:** Màn hình `RadarProximityScreen.js` trong tab Cứu hộ.
* **Cơ chế:** Ca-nô tuần tra trong đêm mở màn hình Radar. Khi vào cự ly **30m – 70m**, app bắt được sóng và vẽ chấm mục tiêu.
* **Công thức ước tính khoảng cách theo RSSI:**
  $$\text{Distance (m)} = 10^{\left(\frac{\text{TxPower} - \text{RSSI}}{10 \cdot n}\right)}$$
  *(Với $\text{TxPower} \approx -59\text{ dBm}$, $n \approx 3.0$).*
* **Bộ lọc trung bình động (Moving Average Filter) chống nhiễu sóng nước:**
  $$\overline{\text{RSSI}}_t = 0.7 \cdot \overline{\text{RSSI}}_{t-1} + 0.3 \cdot \text{RSSI}_{\text{mới}}$$
* **Âm thanh & Rung:** Càng lại gần mục tiêu, tiếng bíp Sonar càng dồn dập, máy rung mạnh dần.

##### 3. Kích Hoạt Còi Hú & Đèn Flash Từ Xa (Remote Flash Strobe & Buzzer)
* **Bài toán:** Đến cự ly 15m nhưng ban đêm mưa bão không biết người ở nóc nhà nào trong dãy nhà san sát.
* **Cơ chế:** Cứu hộ bấm nút **"ĐỊNH VỊ MỤC TIÊU (PING)"**. Máy nạn nhân tự động:
  1. Chớp đèn Flash camera nhấp nháy theo nhịp SOS giúp rọi sáng vị trí trong đêm.
  2. Hú còi báo động âm lượng 100% (cưỡng chế bỏ qua chế độ im lặng của máy).

##### 4. Bộ Đàm Tin Nhắn Nhanh & Bồ Câu Đưa Thư (BLE Quick Chat & Data Muling)
* **Bộ đàm văn bản 1-chạm:** Hai máy trao đổi tin nhắn nhanh qua Bluetooth không cần Internet: `[Cửa cuốn kẹt]`, `[Đang ở tầng 2]`, `[Ca-nô đã ở đầu ngõ]`.
* **Bồ câu đưa thư số (Store-and-Forward):** Ca-nô "nhặt" các gói tin cứu nạn vào máy. Khi xuồng chạy về trạm có sóng 4G/Wi-Fi, app **tự động đẩy toàn bộ dữ liệu lên Backend Django** để cập nhật lên bản đồ Ban chỉ huy.

---

# PHẦN III: MA TRẬN LIÊN THÔNG VÀ TRẢI NGHIỆM NGƯỜI DÙNG

```mermaid
sequenceDiagram
    autonumber
    actor C as Người dân (Citizen App)
    actor R as Đội cứu hộ (Rescuer App)
    actor A as Ban chỉ huy (Admin Web)
    participant S as Máy chủ Backend & DB

    Note over C,S: 1. Phát hiện sự cố & Báo tin
    C->>C: Nén ảnh chụp hiện trường (Canvas 1280px)
    C->>S: Gửi SOS khẩn cấp (GPS + Nhu cầu + Ảnh nén)
    S-->>A: Đẩy SSE Stream tức thì -> Nhấp nháy đỏ trên Bản đồ (<1s)
    S-->>A: Telegram Bot bắn tin khẩn vào nhóm Chỉ huy

    Note over A,R: 2. Điều phối & Nhận nhiệm vụ
    A->>S: Phê duyệt phân công Đội cứu hộ
    S-->>R: Thông báo đẩy nhận nhiệm vụ kèm tọa độ Zone
    R->>R: Mở nút "Dẫn đường Google Maps né ngập" (URL Scheme)
    R->>S: Cập nhật trạng thái ON_MY_WAY

    Note over C,R: 3. Tác chiến Ngoại tuyến (Khi mất mạng 4G)
    C->>C: Kích hoạt Phao cứu sinh BLE (Gói tin 16B)
    R->>R: Mở Radar Sonar quét sóng BLE (RSSI 30m -> 5m)
    R->>C: Bấm "Ping" -> Máy dân hú còi + chớp Flash SOS
    R->>C: Bộ đàm BLE Quick Chat trao đổi vị trí tầng 2

    Note over C,R,S: 4. Cứu nạn thành công & Đóng hiện trường
    R->>S: Đánh dấu SOS "RESOLVED" (Đã cứu)
    C->>S: Bấm nút "Đã an toàn / Nước rút" (Clear Signal)
    S->>S: Đổi màu ghim sang xanh xám, gỡ cảnh báo 300m
    S-->>A: Tự động đóng Zone và chuyển Đội cứu hộ về Sẵn sàng
```

---

# PHẦN IV: KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN (SPRINT PLAN)

### 📌 Giai đoạn 1: Sửa các lỗi nghẽn nghiệp vụ cốt lõi (2 ngày)
* [ ] **Sửa S2:** Sửa API cập nhật trạng thái nhiệm vụ của cứu hộ, khơi thông luồng `NEEDS_HELP`.
* [ ] **Sửa S3:** Tích hợp bộ nén ảnh trước khi tải lên trong `FE-app` gửi SOS.
* [ ] **Sửa S7:** Bọc `ProtectedRoute` trên Web Admin và cấu hình xác thực JWT ở Backend.
* [ ] **Thêm T1:** Thêm nút xuất tọa độ mở Google Maps né ngập bằng URL Scheme cho tài xế cứu hộ.

### 📌 Giai đoạn 2: Nâng cấp Năng lực Định vị & Bản đồ (Tuần tiếp theo)
* [ ] **Sửa S1:** Xóa bỏ đồ thị hardcode Đà Nẵng, tích hợp API OSRM né vùng ngập.
* [ ] **Thêm T2:** Tích hợp lớp ảnh Radar mưa động RainViewer lên bản đồ Web Admin và App.
* [ ] **Thêm T10:** Tích hợp Goong Maps API để hỗ trợ dịch địa chỉ ngõ ngách chi tiết.

### 📌 Giai đoạn 3: Nâng cấp Luồng Người dân & Chat Vùng
* [ ] **Sửa S4:** Chuyển câu tĩnh "Bạn đang an toàn" thành thẻ tóm tắt tình hình theo GPS thực tế.
* [ ] **Thêm T3:** Bổ sung giao diện "Báo cáo tình hình đường sá" (Mức nước, cây đổ, cầu sập).
* [ ] **Thêm T4 & T5:** Cài đặt cơ chế xác minh chéo bán kính 150m và nút báo "Đã được cứu an toàn".
* [ ] **Thêm T6:** Xây dựng tính năng Phòng chat theo Vùng (Zone Incident Chat) có phân quyền.

### 📌 Giai đoạn 4: Hoàn thiện Tự động hóa & Kênh Real-time
* [ ] **Thêm T7:** Thay thế cơ chế Polling bằng Server-Sent Events (SSE) trên Dashboard Admin.
* [ ] **Thêm T8:** Viết kịch bản Telegram Bot bắn tin báo động đỏ cho Ban chỉ huy.
* [ ] **Thêm T9:** Tích hợp hệ thống thông báo đẩy (Push Notifications) cho tính năng theo dõi khu vực.
* [ ] **Sửa S5 & S6:** Hoàn thiện máy trạng thái đóng dữ liệu tự động (SOS → Mission → Zone) và xử lý ngưỡng Vote.

### 📌 Giai đoạn 5: ⭐ Hệ Thống Cứu Nạn Ngoại Tuyến Bluetooth (Đột phá ĐATN)
* [ ] **T11.1 - PoC Cốt lõi:** Cấu hình Expo Development Build với `react-native-ble-plx` & BLE Peripheral, thử nghiệm phát và quét gói tin 16 bytes giữa 2 điện thoại khi tắt hoàn toàn Wi-Fi/4G.
* [ ] **T11.2 - Radar Tầm Soát & Đo Cự Ly:** Xây dựng màn hình `RadarProximityScreen.js`, hiển thị vòng quét Sonar 360°, ước tính khoảng cách mượt bằng Moving Average RSSI, tích hợp âm thanh bíp Sonar (`expo-av`) và rung phản hồi (`expo-haptics`).
* [ ] **T11.3 - Định Vị Khẩn Cấp (Ping):** Thêm nút lệnh Ping từ xa kích hoạt chớp đèn Flash camera SOS (`expo-camera`) và hú còi 100% âm lượng trên máy nạn nhân trong đêm tối.
* [ ] **T11.4 - Quick Chat & Đồng Bộ:** Xây dựng bộ đàm tin nhắn nhanh 1-chạm qua BLE GATT; cơ chế Store-and-Forward tự động gom dữ liệu và đồng bộ lên Django Backend khi ra vùng có sóng.

---
*Tài liệu này đóng vai trò là bản đặc tả kỹ thuật (Specification Document) chuẩn để đội ngũ phát triển căn cứ triển khai, kiểm thử và nghiệm thu dự án.*
