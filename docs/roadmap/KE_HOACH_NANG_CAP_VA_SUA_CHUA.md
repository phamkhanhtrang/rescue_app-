# ĐẶC TẢ CHI TIẾT KẾ HOẠCH NÂNG CẤP & SỬA ĐỔI HỆ THỐNG
## Dự án: Guardian Pulse - Hệ thống Điều phối Cứu hộ & Quản lý Thiên tai
**Ngày lập:** 18/09/2026  
**Căn cứ:** Rà soát hiện trạng mã nguồn `D:\rescue_app-` và mô hình thực chiến từ `nuoclen.com`

---

## MỤC LỤC
1. [TỔNG QUAN VÀ MỤC TIÊU](#1-tổng-quan-và-mục-tiêu)
2. [PHẦN I: CHI TIẾT CÁC CHỨC NĂNG CẦN SỬA](#phần-i-chi-tiết-các-chức-năng-cần-sửa)
   * [S1. Động cơ Dẫn đường Cứu hộ (Pathfinding)](#s1-động-cơ-dẫn-đường-cứu-hộ-pathfinding)
   * [S2. Luồng Cập nhật Trạng thái & Yêu cầu Chi viện của Cứu hộ](#s2-luồng-cập-nhật-trạng-thái--yêu-cầu-chi-viện-của-cứu-hộ)
   * [S3. Tối ưu Luồng gửi SOS & Nén ảnh Hiện trường](#s3-tối-ưu-luồng-gửi-sos--nén-ảnh-hiện-trường)
   * [S4. Thẻ Trạng thái Thông minh trên Trang chủ Người dân](#s4-thẻ-trạng-thái-thông-minh-trên-trang-chủ-người-dân)
   * [S5. Vòng đời Tự động Đóng dữ liệu (SOS → Mission → Zone)](#s5-vòng-đời-tự-động-đóng-dữ-liệu-sos--mission--zone)
   * [S6. Cơ chế Xác minh Cảnh báo bằng Lượt Vote (AlertVote)](#s6-cơ-chế-xác-minh-cảnh-báo-bằng-lượt-vote-alertvote)
   * [S7. Hoàn thiện Xác thực & Phân quyền Bảo mật](#s7-hoàn-thiện-xác-thực--phân-quyền-bảo-mật)
3. [PHẦN II: CHI TIẾT CÁC CHỨC NĂNG CẦN THÊM](#phần-ii-chi-tiết-các-chức-năng-cần-thêm)
   * [T1. Tính năng Dẫn đường Mở ứng dụng Google Maps né Vùng nguy hiểm](#t1-tính-năng-dẫn-đường-mở-ứng-dụng-google-maps-né-vùng-nguy-hiểm)
   * [T2. Lớp Bản đồ Radar Mưa & Cảnh báo Dông sét VNMHA](#t2-lớp-bản-đồ-radar-mưa--cảnh-báo-dông-sét-vnmha)
   * [T3. Lớp Dữ liệu Mực nước Sông hồ & Trạm đo Mưa](#t3-lớp-dữ-liệu-mực-nước-sông-hồ--trạm-đo-mưa)
   * [T4. Báo cáo Tình hình Hiện trường từ Người dân (Field Reporting)](#t4-báo-cáo-tình-hình-hiện-trường-từ-người-dân-field-reporting)
   * [T5. Cơ chế Xác minh Chéo Cộng đồng (Corroboration)](#t5-cơ-chế-xác-minh-chéo-cộng-đồng-corroboration)
   * [T6. Báo tín hiệu "Đã được cứu an toàn / Nước đã rút" (Clear Signal)](#t6-báo-tín-hiệu-đã-được-cứu-an-toàn--nước-đã-rút-clear-signal)
   * [T7. Phòng Chat Điều phối Vi mô theo Vùng (Zone Incident Chat)](#t7-phòng-chat-điều-phối-vi-mô-theo-vùng-zone-incident-chat)
   * [T8. Kênh Báo động Tức thì Real-time (Server-Sent Events)](#t8-kênh-báo-động-tức-thì-real-time-server-sent-events)
   * [T9. Kênh Thông báo Khẩn cấp qua Telegram Bot cho Chỉ huy](#t9-kênh-thông-báo-khẩn-cấp-qua-telegram-bot-cho-chỉ-huy)
   * [T10. Đặt Theo dõi Bán kính & Thông báo Đẩy (Push Notifications)](#t10-đặt-theo-dõi-bán-kính--thông-báo-đẩy-push-notifications)
   * [T11. Tích hợp Geocoding ngõ ngách chi tiết Việt Nam (Goong API)](#t11-tích-hợp-geocoding-ngõ-ngách-chi-tiết-việt-nam-goong-api)
4. [PHẦN III: MA TRẬN LIÊN THÔNG VÀ TRẢI NGHIỆM NGƯỜI DÙNG](#phần-iii-ma-trận-liên-thông-và-trải-nghiệm-người-dùng)
5. [PHẦN IV: KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN (SPRINT PLAN)](#phần-iv-kế-hoạch-triển-khai-theo-giai-đoạn-sprint-plan)

---

## 1. TỔNG QUAN VÀ MỤC TIÊU

### 1.1. Hiện trạng dự án Guardian Pulse
Hệ thống gồm 3 phân hệ chính:
* **Backend:** Django Framework, Django REST Framework (DRF), PostgreSQL (Supabase).
* **FE-web:** React (Vite) + Tailwind CSS dành cho Ban chỉ huy/Admin.
* **FE-app:** React Native (Expo) chia làm 2 luồng: Citizen (Người dân) và Rescuer (Đội cứu hộ).

### 1.2. Mục tiêu nâng cấp
1. **Khơi thông các luồng logic bị tắc nghẽn:** Sửa các lỗi gọi sai API, nén ảnh chống sập app khi mạng yếu, liên kết vòng đời dữ liệu.
2. **Nâng cấp năng lực thực chiến:** Áp dụng bài học từ `nuoclen.com`: tích hợp bản đồ thời tiết radar, định tuyến né ngập/vùng nguy hiểm, dẫn đường qua Google Maps.
3. **Chuyển đổi vai trò của Người dân:** Biến người dân từ "nạn nhân thụ động" thành "cảm biến sống" báo cáo tình hình nước ngập, cây đổ, sạt lở để tự cứu nhau và hỗ trợ đội cứu hộ.
4. **Hạ tầng thời gian thực:** Đưa phản xạ của hệ thống về tức thời (Real-time SSE, Telegram Bot, Phòng chat theo vùng).

---

## PHẦN I: CHI TIẾT CÁC CHỨC NĂNG CẦN SỬA

### S1. Động cơ Dẫn đường Cứu hộ (Pathfinding)
* **Vị trí liên quan:** `backend/rescue_operations/pathfinding.py` & `FE-app/src/screens/rescuer/missions/MissionNavScreen.js`.
* **Hiện trạng lỗi:**
  * Thuật toán $A^*$ đang chạy trên đồ thị hardcode tọa độ đường phố tại Đà Nẵng. Khi cứu hộ ở tỉnh khác, hệ thống không chạy được.
  * Dữ liệu điểm nguy hiểm đang là mảng giả lập.
  * Khi API dẫn đường lỗi, code app tự vẽ một **đường thẳng** nối từ vị trí xe đến điểm đích. Trong thực tế lũ lụt, điều này cực kỳ nguy hiểm vì tài xế có thể lao xuống sông hoặc vùng ngập sâu.
* **Kịch bản hoạt động mới:**
  1. Loại bỏ đồ thị Đà Nẵng thủ công. Tích hợp động cơ định tuyến mở toàn quốc: **OSRM (Open Source Routing Machine)** hoặc **Valhalla Engine**.
  2. Khi đội cứu hộ bấm *"Bắt đầu di chuyển đến điểm SOS / Zone"*, hệ thống gửi tọa độ xuất phát và đích đến cho Backend.
  3. Backend quét tất cả các `Zone` đang ngập sâu hoặc các điểm sạt lở nằm trên hành lang di chuyển. Dựng các hàng rào ảo bao quanh vùng nguy hiểm (`exclude_polygons`).
  4. Trả về lộ trình uốn lượn an toàn, đi qua các trục đường chính còn thông suốt.
  5. Nếu mất mạng hoặc API lỗi: Hiển thị cảnh báo *"Không thể tính toán đường tránh lũ an toàn, vui lòng quan sát thực địa"*, tuyệt đối không vẽ đường thẳng qua sông hồ.

---

### S2. Luồng Cập nhật Trạng thái & Yêu cầu Chi viện của Cứu hộ
* **Vị trí liên quan:** `FE-app/src/screens/rescuer/missions/StatusUpdateScreen.js:101` & `backend/reporting/views.py`.
* **Hiện trạng lỗi:**
  * Màn hình cập nhật trạng thái cho phép chọn: `ON_MY_WAY` (Đang đến), `ACTIVE` (Đang xử lý), `NEEDS_HELP` (Cần chi viện), `COMPLETED` (Hoàn thành).
  * Tuy nhiên, code bên dưới luôn gọi cố định vào endpoint `/complete/`. Do đó, dù bấm "Cần chi viện", hệ thống vẫn ghi nhận là nhiệm vụ đã "Hoàn thành", làm đứt toàn bộ nghiệp vụ xin chi viện.
* **Kịch bản hoạt động mới:**
  1. Khi đội cứu hộ gặp nguy hiểm (ca-nô hỏng máy, nước chảy xiết, số lượng nạn nhân vượt quá sức chứa): Bấm nút **"Cần chi viện khẩn cấp" (`NEEDS_HELP`)**.
  2. App gửi `PATCH /api/missions/{id}/status/` với payload `{ "status": "NEEDS_HELP", "reason": "Thuyền hỏng, cần 1 ca-nô hỗ trợ kéo 5 người già" }`.
  3. Trên Dashboard Admin (`FE-web`): Vùng đó lập tức phát chuông báo động, nhấp nháy màu đỏ cảnh báo *"Đội A cần chi viện gấp!"*.
  4. Các đội cứu hộ khác đang rảnh trong bán kính 5km nhận được thông báo đẩy: *"Đội A tại Zone X đang yêu cầu hỗ trợ"*.

---

### S3. Tối ưu Luồng gửi SOS & Nén ảnh Hiện trường
* **Vị trí liên quan:** `FE-app/src/screens/citizen/sos/SendSOSScreen.js` & Backend upload.
* **Hiện trạng lỗi:**
  * Luồng gửi SOS tách làm 2 bước độc lập: Gửi dữ liệu chữ trước -> Tải ảnh sau. Nếu ảnh tải lỗi thì SOS vẫn tạo hoặc màn hình báo lỗi khiến dân tưởng chưa gửi được nên bấm liên tục tạo SOS trùng.
  * Ảnh chụp trực tiếp từ camera điện thoại nặng 10MB – 20MB. Khi ở vùng lũ sóng 3G/4G chập chờn, việc tải ảnh gốc gần như chắc chắn thất bại hoặc đơ máy.
* **Kịch bản hoạt động mới:**
  1. Người dân chụp ảnh hiện trường (ảnh ngập nước, người mắc kẹt).
  2. **Xử lý nén ảnh ngay tại máy điện thoại (Client-side Resize):** Dùng thư viện Canvas hoặc `expo-image-manipulator` co ảnh lại tối đa chiều dài 1280px, chất lượng JPEG 80%. Dung lượng ảnh giảm từ 15MB xuống còn khoảng **300KB - 500KB** (giảm 97% dung lượng).
  3. Đóng gói cả tọa độ GPS, nội dung văn bản và ảnh đã nén vào cùng **1 request duy nhất** (Multipart form-data).
  4. Gửi thành công chỉ trong 2-3 giây dù mạng yếu. Màn hình chuyển sang trạng thái chờ với mã SOS rõ ràng.

---

### S4. Thẻ Trạng thái Thông minh trên Trang chủ Người dân
* **Vị trí liên quan:** `FE-app/src/screens/citizen/home/HomeScreen.js`.
* **Hiện trạng lỗi:**
  * Trang chủ hiện tại gắn cứng một dòng chữ tĩnh: *"Bạn đang an toàn"*. Đây là thông tin giả lập, không dựa trên dữ liệu địa lý thực tế.
* **Kịch bản hoạt động mới (Học từ Nước Lên Status Card):**
  * Khi người dân mở app, app lấy tọa độ GPS hiện tại và gọi API `/api/citizen/status-summary/?lat=...&lng=...`.
  * Hệ thống tự động quét dữ liệu trong bán kính 1km và hiển thị một tấm thẻ trạng thái hành động rõ ràng trên đầu màn hình:
    * **Màu Xanh (An toàn):** *"Khu vực quanh bạn đang an toàn. Không có cảnh báo ngập hay điểm sạt lở trong 2km."*
    * **Màu Vàng (Cảnh giác):** *"Khu vực đang có mưa to. Có 2 điểm ngập nhẹ cách bạn 500m."*
    * **Màu Đỏ (Nguy hiểm):** *"Cảnh báo nguy cấp: Bạn đang ở gần vùng ngập sâu quá bánh xe (cách 300m). Đội cứu hộ đang hoạt động tại khu vực. Bấm SOS nếu cần sơ tán!"*

---

### S5. Vòng đời Tự động Đóng dữ liệu (SOS → Mission → Zone)
* **Vị trí liên quan:** `backend/rescue_operations/services.py` & Django Signals.
* **Hiện trạng lỗi:**
  * Các thực thể SOS, Nhiệm vụ (Mission) và Vùng sự cố (Zone) hoạt động rời rạc. Đội cứu hộ xử lý xong các SOS nhưng Mission vẫn mở; Admin phải vào đóng Zone thủ công.
* **Kịch bản hoạt động mới:**
  * Xây dựng máy trạng thái tự động (State Machine):
    1. Khi Đội cứu hộ đánh dấu SOS cuối cùng trong một Zone thành `RESOLVED`.
    2. Hệ thống kiểm tra: Nếu tất cả SOS trong Zone đã giải quyết xong -> Tự động gợi ý hoàn thành Mission cho các đội đang tham gia.
    3. Chuyển trạng thái của Zone từ `ACTIVE` (Đang cứu hộ) sang `STABILIZING` (Đang ổn định) và cuối cùng là `RESOLVED` (Đã an toàn).
    4. Trả trạng thái của các đội cứu hộ về `AVAILABLE` (Sẵn sàng nhận nhiệm vụ mới).

---

### S6. Cơ chế Xác minh Cảnh báo bằng Lượt Vote (AlertVote)
* **Vị trí liên quan:** `backend/communications/models.py` & Views.
* **Hiện trạng lỗi:**
  * Người dân có thể vote *"Còn nguy hiểm / Đã có cứu trợ / Tin giả"*, nhưng backend chỉ tăng biến đếm số mà không tạo ra bất kỳ hành động nào tiếp theo.
* **Kịch bản hoạt động mới:**
  * Thiết lập ngưỡng tác động dựa trên cộng đồng:
    * Nếu một cảnh báo có **từ 3 lượt vote "Tin giả"** trở lên từ các tài khoản công dân độc lập trong cùng khu vực: Hệ thống tự động hạ độ ưu tiên của cảnh báo và gửi cờ (Flag) cho Admin kiểm tra.
    * Nếu một điểm ngập/sạt lở có **từ 3 lượt vote "Nước đã rút / Đã an toàn"**: Hệ thống tự động chuyển màu ghim cảnh báo trên bản đồ sang màu xám mờ và chuẩn bị đóng cảnh báo.

---

### S7. Hoàn thiện Xác thực & Phân quyền Bảo mật
* **Vị trí liên quan:** `FE-web/src/App.tsx`, `CitizenLoginScreen.js`, `backend/settings.py`.
* **Hiện trạng lỗi:**
  * App Citizen gán cứng `role = CITIZEN` trên giao diện thay vì đọc role từ Token; Web Admin chưa có Route Protection (gõ trực tiếp URL vẫn vào được trang trong); Backend thiếu cấu hình JWT xác thực đồng bộ.
* **Kịch bản hoạt động mới:**
  1. App và Web giải mã JWT Token (lấy từ backend) để xác minh role (`ADMIN`, `RESCUER`, `CITIZEN`).
  2. Bọc toàn bộ các trang Admin bằng component `<ProtectedRoute allowedRoles={['ADMIN']} />`. Nếu người lạ truy cập, tự động đẩy về màn hình Đăng nhập.
  3. Cấu hình chặt chẽ `REST_FRAMEWORK` trong Django với `DEFAULT_AUTHENTICATION_CLASSES = ['rest_framework_simplejwt.authentication.JWTAuthentication']` để bảo vệ các API nhạy cảm.

---

## PHẦN II: CHI TIẾT CÁC CHỨC NĂNG CẦN THÊM

### T1. Tính năng Dẫn đường Mở ứng dụng Google Maps né Vùng nguy hiểm
* **Mục đích:** Tài xế xe cứu thương, ca-nô, xe tải cứu trợ ngoài đời thực quen thuộc với giao diện chỉ đường của Google Maps. Tận dụng Google Maps giúp họ rảnh tay lái xe mà vẫn đi theo lộ trình né lũ do Guardian Pulse tính toán.
* **Giao diện & Trải nghiệm:**
  * Trên màn hình chi tiết nhiệm vụ của app Cứu hộ (`FE-app`), cạnh nút "Dẫn đường nội bộ", thêm nút bấm nổi bật: **"Mở chỉ đường Google Maps (Né lũ)"**.
* **Luồng hoạt động kỹ thuật:**
  1. Backend tính toán tuyến đường an toàn né các Zone ngập sâu bằng Valhalla.
  2. Thuật toán trích xuất từ 2 đến 3 điểm ngoặt quan trọng nhất (Waypoints) trên đường vòng tránh lũ.
  3. Ứng dụng kích hoạt URL Scheme mở ứng dụng Google Maps có sẵn trên điện thoại:
     ```
     https://www.google.com/maps/dir/?api=1&origin={lat_hien_tai},{lng_hien_tai}&destination={lat_sos},{lng_sos}&waypoints={lat_tranh_1},{lng_tranh_1}|{lat_tranh_2},{lng_tranh_2}&travelmode=driving
     ```
  4. Google Maps tự động bật chế độ dẫn đường Turn-by-Turn bằng giọng nói, hướng dẫn tài xế đi vòng qua đúng các điểm an toàn mà hệ thống đã chỉ định.

---

### T2. Lớp Bản đồ Radar Mưa & Cảnh báo Dông sét VNMHA
* **Mục đích:** Ban chỉ huy và Đội cứu hộ cần biết thời tiết thực tế: *Mây bão có đang tràn tới không? Có sét đánh hay lốc xoáy không để quyết định cho xuồng ca-nô xuất kích?*
* **Giao diện & Trải nghiệm:**
  * Trên thanh công cụ bản đồ (cả Web Admin và App), bổ sung nút chọn lớp:
    * `[x] Radar mưa (VNMHA)`
    * `[x] Cảnh báo dông sét 60 phút tới`
  * Dưới đáy bản đồ xuất hiện thanh trượt thời gian 2 giờ qua và nút Play ▶ để xem mây mưa di chuyển.
* **Luồng hoạt động kỹ thuật:**
  1. Backend kéo dữ liệu định kỳ từ **Tổng cục Khí tượng Thủy văn (VNMHA)** hoặc nguồn dự phòng **RainViewer API**.
  2. Vẽ ảnh radar phản hồi mây (dBZ) dạng lớp phủ mờ (`L.imageOverlay` hoặc `TileLayer`) nằm dưới các ghim SOS.
  3. Lấy dữ liệu cảnh báo dông sét cấp xã/phường: Vẽ các vòng tròn viền đứt màu vàng có biểu tượng tia sét ⚡ tại các xã được cảnh báo trong 10–60 phút tới. Đội cứu hộ nhìn thấy sẽ không cho thuyền ra sông lúc nguy hiểm.

---

### T3. Lớp Dữ liệu Mực nước Sông hồ & Trạm đo Mưa
* **Mục đích:** Cung cấp thông tin quan trắc khoa học từ cơ quan chức năng để phát hiện sớm nguy cơ vỡ đê, nước tràn bờ.
* **Giao diện & Trải nghiệm:**
  * Bản đồ hiển thị các chấm tròn màu xanh ngọc: Con số bên trong là số mm lượng mưa đo được tại trạm quan trắc (ví dụ: `45mm`). Trạm đang có mưa trong 1 giờ qua có vòng tròn viền đen nhấp nháy.
  * Bảng điều khiển phụ: Bảng hiển thị mực nước các hồ chứa và cống trạm bơm (báo động mức 1, mức 2, mức 3).
* **Luồng hoạt động kỹ thuật:**
  1. Backend thu thập dữ liệu tự động từ các trạm đo tự động của Công ty Thoát nước / Trạm Thủy văn.
  2. Khi lượng mưa tại một trạm vượt quá 50mm/giờ hoặc mực nước hồ chạm mức báo động đỏ, hệ thống tự động sinh cảnh báo khẩn cấp trên Dashboard Admin để phát lệnh di dân sớm.

---

### T4. Báo cáo Tình hình Hiện trường từ Người dân (Field Reporting)
* **Mục đích:** Người dân không chỉ gửi SOS khi sắp đuối nước, mà còn đóng vai trò thông tin viên hiện trường: báo đường ngập, cầu sập, cây đổ chắn đường cho cộng đồng cùng biết.
* **Giao diện & Trải nghiệm:**
  * Trên app người dân, cạnh nút đỏ "Cầu cứu khẩn cấp SOS", bổ sung nút màu xanh: **"Báo tình hình đường sá"**.
  * Bảng chọn trực quan:
    1. **Mức nước (ký hiệu sóng):** Ngang mắt cá chân 🟢 | Ngang gối 🟡 | Quá bánh xe / Nóc nhà 🔴 | Đã rút nước ⚪.
    2. **Loại sự cố:** Ngập sâu | Cây đổ | Cầu gãy / Đường sạt lở | Dây điện đứt nguy hiểm | Đóng đường cô lập.
    3. **Tùy chọn:** Chấm 1 điểm hoặc chạm 2 điểm để báo ngập *cả một đoạn đường*.
    4. Ghi chú ngắn và chụp ảnh đính kèm.
* **Luồng hoạt động kỹ thuật:**
  * Thông tin gửi lên lưu vào bảng `CrowdReport`. Ngay lập tức xuất hiện trên bản đồ của tất cả người dân khác và bản đồ Admin dưới dạng biểu tượng sóng nước hoặc chướng ngại vật màu tương ứng.

---

### T5. Cơ chế Xác minh Chéo Cộng đồng (Corroboration)
* **Mục đích:** Giải quyết triệt để vấn đề tin giả, tin báo đùa, hoặc thông tin chưa được kiểm chứng.
* **Giao diện & Trải nghiệm:**
  * **Tin mới gửi (1 người báo):** Ghim trên bản đồ hiển thị ở trạng thái mờ (`lone`), có chữ *"Chờ xác minh"*.
  * **Tin có xác minh (từ 2 người trở lên):** Ghim chuyển sang màu đỏ đậm, góc trên có huy hiệu số người cùng xác nhận: `+2`, `+5`.
* **Luồng hoạt động kỹ thuật:**
  1. Khi một người dân A gửi SOS hoặc báo sạt lở tại tọa độ $(lat_A, lng_A)$.
  2. Nếu có người dân B (tài khoản khác, máy khác) gửi SOS hoặc bấm nút *"Tôi xác nhận chỗ này nguy hiểm"* trong bán kính **150 mét** tính từ điểm A:
  3. Thuật toán tự động liên kết hai báo cáo vào cùng một cụm. Điểm ưu tiên (`priority_score`) của Zone đó tự động nhân đôi. Ban chỉ huy nhìn vào là biết đây là sự cố có thật 100% để lập tức điều động quân.

---

### T6. Báo tín hiệu "Đã được cứu an toàn / Nước đã rút" (Clear Signal)
* **Mục đích:** Dọn dẹp hiện trường bản đồ, tránh tình trạng cứu hộ xong rồi nhưng ghim đỏ vẫn còn khiến các đội cứu hộ khác chạy đến ứng cứu lần hai gây lãng phí nguồn lực.
* **Giao diện & Trải nghiệm:**
  * Khi nạn nhân đã được đưa lên xuồng hoặc nước đã rút, người dân (hoặc Đội cứu hộ tại chỗ) mở lại thẻ SOS của mình và bấm nút: **"Tôi đã an toàn / Đã hết ngập"**.
* **Luồng hoạt động kỹ thuật:**
  1. Ghim đỏ chuyển ngay lập tức sang màu xám/xanh ngọc kèm dấu tích xanh `✓` (nhãn *"Vừa hết ngập 15 phút trước"*).
  2. Hệ thống tự động gỡ bỏ các cảnh báo nguy hiểm trong bán kính 300m xung quanh điểm đó.
  3. Lộ trình của các xe cứu hộ khác đang trên đường đến sẽ tự động cập nhật giảm tải.

---

### T7. Phòng Chat Điều phối Vi mô theo Vùng (Zone Incident Chat)
* **Mục đích:** Tạo kênh giao tiếp trực tiếp giữa Người dân trong vùng ngập lụt với nhau (để tự tương trợ) và giữa Người dân với Đội cứu hộ đang phụ trách vùng đó.
* **Giao diện & Trải nghiệm:**
  * Khi một `Zone` được tạo ra, một phòng chat tương ứng xuất hiện trên app của những người thuộc vùng đó:
    * **Tab 1: Thông báo chính thức từ Đội cứu hộ** (Được ghim trên cùng: vị trí phát lương thực, số điện thoại đội trưởng).
    * **Tab 2: Trao đổi cộng đồng** (Bà con nhắn tin hỏi han, tương trợ).
* **Quy tắc vận hành nghiêm ngặt (Chống biến thành bãi rác tin giả):**
  1. **Điều kiện vào phòng:** Chỉ người có GPS thực tế nằm trong Zone, hoặc người đã gửi SOS trong Zone, và Đội cứu hộ được phân công mới nhắn được. Người ngoài tỉnh không được vào bình luận.
  2. **Chống trôi tin & Chống spam:** Người dân chỉ được nhắn tối đa 150 ký tự; mỗi tin cách nhau tối thiểu 30 giây (Rate-limit).
  3. **Quyền Ghim (PIN):** Chỉ Đội cứu hộ và Admin có quyền ghim tin nhắn khẩn cấp lên đầu phòng chat.
  4. **Nút ngắt khẩn cấp (Emergency Mute):** Nếu phát hiện có kẻ tung tin đồn thất thiệt (như đồn vỡ đập gây hoảng loạn), Admin bấm 1 nút là phòng chat chuyển sang chế độ **"Chỉ đọc" (Read-only)**, chỉ đội cứu hộ được phát tin.
  5. **Tự động đóng:** Khi Zone chuyển sang `RESOLVED` (An toàn), phòng chat tự động lưu trữ và đóng lại sau 24 giờ.
* **Giải pháp kỹ thuật:** Sử dụng tính năng **Supabase Realtime (Postgres Changes & Broadcast)** có sẵn trong kiến trúc hiện tại, triển khai cực nhanh mà không cần dựng cụm WebSocket phức tạp.

---

### T8. Kênh Báo động Tức thì Real-time (Server-Sent Events)
* **Mục đích:** Loại bỏ việc trình duyệt Web Admin phải gọi API liên tục mỗi 15 giây (Polling) gây chậm máy và nghẽn cơ sở dữ liệu.
* **Giao diện & Trải nghiệm:**
  * Màn hình Dashboard Admin luôn ở trạng thái trực tiếp. Bất cứ khi nào ở thực địa có người dân bấm nút gửi SOS, ngay lập tức (độ trễ dưới 1 giây):
    * Một điểm ghim màu đỏ bừng sáng và nhấp nháy trên bản đồ.
    * Hệ thống phát âm thanh cảnh báo "Tít tít!" để trực ban chú ý ngay.
* **Luồng hoạt động kỹ thuật:**
  * Xây dựng endpoint SSE trong Django: `GET /api/feed/stream/`. Trình duyệt Admin lắng nghe qua `EventSource`. Khi có bản ghi SOS mới trong cơ sở dữ liệu, Django bắn sự kiện JSON về client để cập nhật State ngay lập tức.

---

### T9. Kênh Thông báo Khẩn cấp qua Telegram Bot cho Chỉ huy
* **Mục đích:** Ban chỉ huy cứu hộ không thể ngồi nhìn màn hình máy tính 24/24. Cần một kênh báo động di động tức thì đến các cấp lãnh đạo.
* **Giao diện & Trải nghiệm:**
  * Tạo một nhóm Telegram nội bộ của Ban Chỉ huy Cứu hộ.
  * Khi có trường hợp SOS đặc biệt khẩn cấp (nguy kịch, trẻ sơ sinh, người già mắc kẹt trong đêm), Telegram Bot tự động bắn tin nhắn vào nhóm:
    ```
    🚨 BÁO ĐỘNG ĐỎ: YÊU CẦU CỨU HỘ KHẨN CẤP!
    📍 Địa chỉ: Ngõ 86 Nhân Hòa, Thanh Xuân, Hà Nội
    ⚠️ Tình trạng: Nước dâng ngang ngực, có 1 cụ già tai biến và 2 trẻ nhỏ
    ⏰ Thời gian: 23:15:10
    [🗺 Xem Bản Đồ Điều Phối]   [✅ Nhận Điều Động Đội A]
    ```
  * Chỉ huy bấm trực tiếp nút Inline Button trên Telegram để giao nhiệm vụ mà không cần mở laptop.

---

### T10. Đặt Theo dõi Bán kính & Thông báo Đẩy (Push Notifications)
* **Mục đích:** Người dân hoặc người có thân nhân ở vùng bão lũ muốn nhận cảnh báo chủ động trên điện thoại ngay cả khi đang tắt ứng dụng.
* **Giao diện & Trải nghiệm:**
  * Trong app, người dùng có nút: **"🔔 Theo dõi khu vực này (Bán kính 500m)"** (ví dụ: nhà của bố mẹ ở quê).
  * Khi khu vực được ghim đó có cảnh báo ngập sâu, lũ quét hoặc lệnh sơ tán khẩn cấp từ chính quyền, điện thoại sẽ tự động rung chuông và hiện thông báo đẩy ra màn hình khóa (Lock Screen).
* **Luồng hoạt động kỹ thuật:**
  * Sử dụng giao thức **Web Push (chuẩn VAPID)** trên web và **Expo Push Notifications** trên mobile app. Lưu thông tin đăng ký (Subscription) gắn với tọa độ theo dõi vào bảng `WatchZone` trong backend.

---

### T11. Tích hợp Geocoding ngõ ngách chi tiết Việt Nam (Goong API)
* **Mục đích:** Thay thế Nominatim (OpenStreetMap vốn rất kém khi tìm ngõ, ngách, thôn, xóm ở làng quê Việt Nam).
* **Luồng hoạt động kỹ thuật:**
  * Tích hợp **Goong Geocoding & Places API** vào Backend.
  * Khi hệ thống AI cào các bài đăng kêu cứu trên mạng xã hội Facebook (*"Nhà em ở ngách 12/4 thôn Đông, xã Bát Tràng nước ngập tới mái rồi..."*):
  * Goong API sẽ dịch chính xác cụm địa chỉ ngõ ngách thôn xóm này ra tọa độ GPS chuẩn xác để ghim tự động lên bản đồ cứu nạn.

---

## PHẦN III: MA TRẬN LIÊN THÔNG VÀ TRẢI NGHIỆM NGƯỜI DÙNG

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
    S-->>A: Đẩy SSE Stream tức thì -> Nhấp nháy đỏ trên Bản đồ
    S-->>A: Telegram Bot bắn tin khẩn vào nhóm Chỉ huy

    Note over A,R: 2. Điều phối & Nhận nhiệm vụ
    A->>S: Phê duyệt phân công Đội cứu hộ
    S-->>R: Thông báo đẩy nhận nhiệm vụ kèm tọa độ Zone
    R->>R: Mở nút "Dẫn đường Google Maps né ngập" (URL Scheme)
    R->>S: Cập nhật trạng thái ON_MY_WAY

    Note over C,R: 3. Tương tác tại Hiện trường
    C->>R: Vào "Phòng chat Zone": trao đổi mực nước, vị trí dây điện
    R->>C: Ghim thông báo: "Ca-nô đến đầu ngõ sau 10 phút"

    Note over C,R,S: 4. Cứu nạn thành công & Đóng hiện trường
    R->>S: Đánh dấu SOS "RESOLVED"
    C->>S: Bấm nút "Đã an toàn / Nước rút" (Clear Signal)
    S->>S: Đổi màu ghim sang xanh xám, gỡ cảnh báo 300m
    S-->>A: Tự động đóng Zone và chuyển Đội cứu hộ về Sẵn sàng
```

---

## PHẦN IV: KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN (SPRINT PLAN)

### 📌 Giai đoạn 1: Sửa các lỗi nghẽn nghiệp vụ cốt lõi (Làm ngay - 2 ngày)
* [ ] **Sửa S2:** Sửa API cập nhật trạng thái nhiệm vụ của cứu hộ, khơi thông luồng `NEEDS_HELP`.
* [ ] **Sửa S3:** Tích hợp bộ nén ảnh trước khi tải lên trong `FE-app` gửi SOS.
* [ ] **Sửa S7:** Bọc `ProtectedRoute` trên Web Admin và cấu hình xác thực JWT ở Backend.
* [ ] **Thêm T1:** Thêm nút xuất tọa độ mở Google Maps né ngập bằng URL Scheme cho tài xế cứu hộ.

### 📌 Giai đoạn 2: Nâng cấp Năng lực Định vị & Bản đồ (Tuần tiếp theo)
* [ ] **Sửa S1:** Xóa bỏ đồ thị hardcode Đà Nẵng, tích hợp API Valhalla/OSRM né vùng ngập.
* [ ] **Thêm T2 & T3:** Kéo lớp ảnh Radar mưa VNMHA và cảnh báo dông sét đè lên bản đồ Web Admin.
* [ ] **Thêm T11:** Đổi bộ tìm kiếm địa chỉ sang Goong Maps API để hỗ trợ ngõ ngách chi tiết.

### 📌 Giai đoạn 3: Nâng cấp Luồng Người dân & Chat Vùng
* [ ] **Sửa S4:** Chuyển câu tĩnh "Bạn đang an toàn" thành thẻ tóm tắt tình hình theo GPS thực tế.
* [ ] **Thêm T4:** Bổ sung giao diện "Báo cáo tình hình hiện trường" (Mức nước mắt cá/gối/bánh xe, cây đổ, cầu sập).
* [ ] **Thêm T5 & T6:** Cài đặt cơ chế xác minh chéo bán kính 150m và nút báo "Đã được cứu an toàn".
* [ ] **Thêm T7:** Xây dựng tính năng Phòng chat theo Vùng (Zone Incident Chat) bằng Supabase Realtime.

### 📌 Giai đoạn 4: Hoàn thiện Tự động hóa & Kênh Real-time
* [ ] **Thêm T8:** Thay thế cơ chế Polling bằng Server-Sent Events (SSE) trên Dashboard Admin.
* [ ] **Thêm T9:** Viết kịch bản Telegram Bot bắn tin báo động đỏ cho Ban chỉ huy.
* [ ] **Thêm T10:** Tích hợp hệ thống thông báo đẩy (Push Notifications) cho tính năng theo dõi khu vực.
* [ ] **Sửa S5 & S6:** Hoàn thiện máy trạng thái đóng dữ liệu tự động (SOS → Mission → Zone) và xử lý ngưỡng Vote.

---
*Tài liệu này đóng vai trò là bản đặc tả kỹ thuật (Specification Document) chuẩn để đội ngũ phát triển căn cứ triển khai, kiểm thử và nghiệm thu dự án.*
