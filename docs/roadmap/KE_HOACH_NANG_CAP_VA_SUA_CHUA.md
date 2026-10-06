# 📋 ĐẶC TẢ CHI TIẾT KẾ HOẠCH NÂNG CẤP & SỬA ĐỔI HỆ THỐNG
## Dự án: Guardian Pulse — Hệ thống Điều phối Cứu hộ & Quản lý Thiên tai
**Phiên bản:** 2.3 (Bản tinh gọn thực tế — Đã loại bỏ Telegram Bot và các phần đã xong)  
**Ngày cập nhật:** 06/10/2026  
**Căn cứ:** Rà soát trực tiếp mã nguồn `backend/`, `FE-web/`, `FE-app/` và định hướng tinh giản cho Đồ án Tốt nghiệp.

---

## ✅ CÁC HẠNG MỤC ĐÃ HOÀN THÀNH XONG TRONG MÃ NGUỒN
> Các hạng mục dưới đây đã được lập trình hoàn chỉnh và hoạt động tốt trong mã nguồn, **được loại khỏi danh sách cần làm** để tránh nhầm lẫn:

| Mã cũ | Tên hạng mục | Trạng thái hiện tại trong Codebase |
| :---: | :--- | :--- |
| **S2** | Luồng Yêu cầu Chi viện (`NEEDS_HELP`) | ✅ **Đã xong:** Giao diện `ActiveMissionScreen.js` có nút báo động chi viện; backend `reporting/flow.py` đã xử lý luồng `NEEDS_HELP` chuẩn xác. |
| **S3** | Nén ảnh SOS (Client-side Resize) | ✅ **Đã xong:** `SOSScreen.js` đã dùng `expo-image-manipulator` nén ảnh xuống width 1280px (~300KB), gửi gộp 1 request multipart duy nhất. |
| **S7** | Phân quyền Bảo mật JWT & Route Guard | ✅ **Đã xong:** Web Admin bọc `<AdminRoutes>` chặn truy cập trái phép; Backend cấu hình `AccountJWTAuthentication`. |
| **T1** | Nút Mở Chỉ đường Google Maps né lũ | ✅ **Đã xong:** `MissionNavScreen.js` đã có nút *"🧭 MỞ CHỈ ĐƯỜNG GOOGLE MAPS (NÉ LŨ)"* mở trực tiếp URL Scheme ngoài. |

---

## 🧭 BẢNG MA TRẬN CÔNG VIỆC CÒN LẠI (PENDING WORK)

### 1. Hạng mục Cốt lõi Cần Sửa Chữa (S1 – S4)
| Mã | Tên hạng mục | Phân hệ | Mức độ | Mục tiêu cốt lõi |
| :---: | :--- | :---: | :---: | :--- |
| **S1** | Động cơ Dẫn đường OSRM Né ngập | Backend / App | 🔴 Khẩn cấp | Thay thế đồ thị hardcode Đà Nẵng bằng động cơ OSRM né ngập toàn quốc. |
| **S2** | Thẻ Trạng thái GPS Thông minh | App (Citizen) | 🟡 Quan trọng | Gọi API phân tích nguy cơ trong bán kính 1km thay vì câu chữ cố định. |
| **S3** | Vòng đời Đóng Dữ liệu Tự động | Backend | 🟡 Quan trọng | Tự động chuyển Zone sang `RESOLVED` khi toàn bộ SOS bên trong đã được cứu. |
| **S4** | Xác minh Cảnh báo bằng Lượt Vote | Backend / App | 🟡 Quan trọng | Cài đặt ngưỡng Vote tin cậy (AlertVote) để tự động ẩn các cảnh báo rác. |

### 2. Tính năng Nâng cấp & Đổi mới Sáng tạo (T1 – T9)
| Mã | Tên hạng mục | Phân hệ | Mức độ | Mục tiêu cốt lõi |
| :---: | :--- | :---: | :---: | :--- |
| **T1** | Lớp Bản đồ Radar Mưa Động | Web / App | 🟢 Tiện ích | Tích hợp lớp phủ radar mây mưa thời gian thực (RainViewer API) lên bản đồ. |
| **T2** | Báo cáo Hiện trường từ Người dân | App (Citizen) | 🌟 Đổi mới | Biến người dân thành cảm biến: báo mực nước, cây đổ, sạt lở có cấu trúc. |
| **T3** | Xác minh Chéo Cộng đồng (150m) | Backend | 🌟 Đổi mới | Tự động gom cụm các báo cáo gần nhau trong 150m để phát hiện sự cố thật. |
| **T4** | Báo Tín hiệu An toàn / Nước rút | App / Backend | 🟢 Tiện ích | Dọn dẹp hiện trường bản đồ khi nước rút (Clear Signal), tránh cứu hộ trùng. |
| **T5** | Phòng Chat Điều phối Vi mô theo Vùng | Web / App | 🟢 Tiện ích | Kênh giao tiếp có kiểm duyệt giữa Đội cứu hộ và Dân trong cùng 1 Zone. |
| **T6** | Báo động Tức thì Real-time (SSE) | Backend / Web | 🟡 Quan trọng | Loại bỏ Polling 15s; Web Admin nhận tín hiệu SOS nhảy điểm tức thì (<1s). |
| **T7** | Theo dõi Bán kính & Thông báo Đẩy | App / Backend | 🟢 Tiện ích | Nhận Push Notification khi khu vực nhà người thân có lệnh sơ tán. |
| **T8** | Geocoding Ngõ ngách VN (Goong API) | Backend | 🟡 Quan trọng | Dịch chính xác địa chỉ ngõ/ngách/thôn/xóm cào từ Facebook ra tọa độ GPS. |
| **T9** | ⭐ **Cứu Nạn Ngoại Tuyến Bluetooth** | **Mobile App** | 👑 **Đột phá** | **Cứu hộ tầm gần không cần Internet: Radar Sonar, còi/flash, chat BLE.** |

---

## 📑 MỤC LỤC CHI TIẾT

1. [PHẦN I: CHI TIẾT 4 HẠNG MỤC SỬA LỖI CỐT LÕI (S1 – S4)](#phần-i-chi-tiết-4-hạng-mục-sửa-lỗi-cốt-lõi-s1--s4)
   * [S1. Động cơ Dẫn đường Cứu hộ Né ngập (Pathfinding)](#s1-động-cơ-dẫn-đường-cứu-hộ-né-ngập-pathfinding)
   * [S2. Thẻ Trạng thái Thông minh trên Trang chủ Người dân](#s2-thẻ-trạng-thái-thông-minh-trên-trang-chủ-người-dân)
   * [S3. Vòng đời Tự động Đóng Dữ liệu (SOS ➔ Mission ➔ Zone)](#s3-vòng-đời-tự-động-đóng-dữ-liệu-sos--mission--zone)
   * [S4. Cơ chế Xác minh Cảnh báo bằng Lượt Vote (AlertVote)](#s4-cơ-chế-xác-minh-cảnh-báo-bằng-lượt-vote-alertvote)
2. [PHẦN II: CHI TIẾT 9 TÍNH NĂNG NÂNG CẤP & ĐMST (T1 – T9)](#phần-ii-chi-tiết-9-tính-năng-nâng-cấp--đmst-t1--t9)
   * [T1. Lớp Bản đồ Radar Mưa Động (RainViewer API)](#t1-lớp-bản-đồ-radar-mưa-động-rainviewer-api)
   * [T2. Báo cáo Hiện trường từ Người dân (Field Reporting)](#t2-báo-cáo-hiện-trường-từ-người-dân-field-reporting)
   * [T3. Cơ chế Xác minh Chéo Cộng đồng (Corroboration)](#t3-cơ-chế-xác-minh-chéo-cộng-đồng-corroboration)
   * [T4. Báo Tín hiệu An toàn / Nước rút (Clear Signal)](#t4-báo-tín-hiệu-an-toàn--nước-rút-clear-signal)
   * [T5. Phòng Chat Điều phối Vi mô theo Vùng (Zone Incident Chat)](#t5-phòng-chat-điều-phối-vi-mô-theo-vùng-zone-incident-chat)
   * [T6. Kênh Báo động Tức thì Real-time (Server-Sent Events)](#t6-kênh-báo-động-tức-thì-real-time-server-sent-events)
   * [T7. Đặt Theo dõi Bán kính & Thông báo Đẩy (Push Notifications)](#t7-đặt-theo-dõi-bán-kính--thông-báo-đẩy-push-notifications)
   * [T8. Tích hợp Geocoding Ngõ ngách Chi tiết (Goong API)](#t8-tích-hợp-geocoding-ngõ-ngách-chi-tiết-goong-api)
   * [T9. ⭐ Hệ Thống Cứu Nạn Ngoại Tuyến Qua Bluetooth (BLE Offline Rescue)](#t9--hệ-thống-cứu-nạn-ngoại-tuyến-qua-bluetooth-ble-offline-rescue)
3. [PHẦN III: MA TRẬN LIÊN THÔNG VÀ TRẢI NGHIỆM NGƯỜI DÙNG](#phần-iii-ma-trận-liên-thông-và-trải-nghiệm-người-dùng)
4. [PHẦN IV: KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN (SPRINT PLAN)](#phần-iv-kế-hoạch-triển-khai-theo-giai-đoạn-sprint-plan)

---

# PHẦN I: CHI TIẾT 4 HẠNG MỤC SỬA LỖI CỐT LÕI (S1 – S4)

### 🔹 S1. Động cơ Dẫn đường Cứu hộ Né ngập (Pathfinding)
* **Vị trí code:** `backend/rescue_operations/pathfinding.py` & `FE-app/src/screens/rescuer/map/MissionNavScreen.js`.
* **Hiện trạng lỗi:**
  * Thuật toán $A^*$ hiện tại vẫn đang tải đồ thị tĩnh `danang.graphml` (chỉ chạy được tại Đà Nẵng).
  * Khi gặp sự cố mạng hoặc lỗi tọa độ ngoài Đà Nẵng, hệ thống không tính được đường đi.
* **Giải pháp & Kịch bản mới:**
  1. Loại bỏ đồ thị file cứng `danang.graphml`. Tích hợp động cơ định tuyến mở toàn quốc: **OSRM (Open Source Routing Machine)**.
  2. Backend quét tất cả các `Zone` đang ngập sâu nằm trên hành lang di chuyển, dựng rào cản ảo (`exclude_polygons`).
  3. Trả về lộ trình an toàn uốn lượn đi qua các trục đường còn thông suốt.
  4. Nếu mất mạng: Hiện cảnh báo an toàn rõ ràng, tuyệt đối không vẽ đường thẳng cắt qua sông hồ.

---

### 🔹 S2. Thẻ Trạng thái Thông minh trên Trang chủ Người dân
* **Vị trí code:** `FE-app/src/screens/citizen/home/HomeScreen.js`.
* **Hiện trạng lỗi:** Trang chủ hiện tại đang hiển thị một dòng thông tin đơn giản: *"📍 Vị trí GPS: Đã xác định & sẵn sàng"*, chưa thực sự đánh giá mức độ nguy hiểm xung quanh người dùng.
* **Giải pháp & Kịch bản mới:**
  1. Khi mở app, hệ thống lấy GPS hiện tại và gọi API `/api/citizen/status-summary/?lat=...&lng=...`.
  2. Backend quét dữ liệu các điểm ngập và Zone trong bán kính 1km và trả về thẻ trạng thái hành động rõ ràng:
     * 🟢 *An toàn:* "Khu vực của bạn hiện chưa có cảnh báo ngập lụt."
     * 🟡 *Cảnh giác:* "Có điểm ngập sâu cách bạn 400m. Hãy theo dõi sát."
     * 🔴 *Khẩn cấp:* "Bạn đang nằm trong vùng nguy cơ cao! Hãy di chuyển lên vị trí cao hoặc gửi SOS."

---

### 🔹 S3. Vòng đời Tự động Đóng Dữ liệu (SOS ➔ Mission ➔ Zone)
* **Vị trí code:** `backend/rescue_operations/flow.py` & Django Signals.
* **Hiện trạng lỗi:** Hàm `recount(zone_id)` hiện tại mới chỉ cập nhật lại số người và số cứu hộ cần thiết, chưa tự động chuyển trạng thái của `Zone` sang `RESOLVED` khi tất cả SOS bên trong đã được cứu xong.
* **Giải pháp & Kịch bản mới:**
  * Bổ sung logic tự động đóng dữ liệu:
    $$\text{Tất cả SOS trong Zone đã RESOLVED} \implies \text{Zone tự chuyển sang RESOLVED} \implies \text{Đội cứu hộ chuyển về SẴN SÀNG}$$

---

### 🔹 S4. Cơ chế Xác minh Cảnh báo bằng Lượt Vote (AlertVote)
* **Vị trí code:** `FE-app/src/screens/citizen/alerts/AlertsScreen.js` & `backend/communications/views.py`.
* **Hiện trạng lỗi:** API `alert_vote` mới chỉ ghi nhận lượt vote của người dùng vào bảng `AlertVote`, chưa có cơ chế tính ngưỡng để đổi giao diện hoặc tự ẩn tin rác.
* **Giải pháp & Kịch bản mới:**
  * Mỗi cảnh báo tính điểm tin cậy: $\text{Confidence} = \text{Vote\_Đúng} - \text{Vote\_Sai}$.
  * Nếu $\text{Confidence} \ge 3$: Cảnh báo gắn huy hiệu *"Đã xác thực bởi cộng đồng"*.
  * Nếu $\text{Confidence} \le -3$: Tự động ẩn khỏi bản đồ để loại bỏ các tin đồn giả mạo.

---

# PHẦN II: CHI TIẾT 9 TÍNH NĂNG NÂNG CẤP & ĐMST (T1 – T9)

### 🔹 T1. Lớp Bản đồ Radar Mưa Động (RainViewer API)
* **Mục đích:** Chỉ huy và Đội cứu hộ quan sát mây bão thời gian thực trước khi quyết định cho xuồng xuất kích.
* **Cách thực hiện:**
  * Tích hợp lớp phủ mây mưa động từ **RainViewer Tile Layer API** lên bản đồ Leaflet (`FE-web`) và bản đồ Mobile (`FE-app`).
  * Bổ sung thanh trượt thời gian 2 giờ qua kèm nút Play ▶ để xem hướng di chuyển của cơn bão.

---

### 🔹 T2. Báo cáo Hiện trường từ Người dân (Field Reporting)
* **Mục đích:** Biến người dân thành cảm biến sống báo cáo tình hình đường sá (ngập nước, sạt lở, cây đổ).
* **Giao diện & Dữ liệu:**
  * Nút xanh trên app: **"Báo tình hình đường sá"**.
  * Bảng chọn trực quan:
    1. *Mức nước:* Mắt cá chân 🟢 | Ngang gối 🟡 | Quá bánh xe / Nóc nhà 🔴 | Đã rút nước ⚪.
    2. *Loại sự cố:* Ngập sâu | Cây đổ | Cầu gãy | Dây điện đứt | Đường bị cô lập.
    3. *Tùy chọn:* Chấm 1 điểm hoặc chạm 2 điểm báo ngập cả một đoạn đường.

---

### 🔹 T3. Cơ chế Xác minh Chéo Cộng đồng (Corroboration)
* **Mục đích:** Lọc tin báo đùa, tự động khẳng định sự cố thật khi có nhiều người cùng báo cáo.
* **Cách thực hiện:**
  * Khi người dân B gửi báo cáo trong bán kính **150 mét** của người dân A:
  * Thuật toán tự động gom vào cùng 1 cụm, nhân đôi điểm ưu tiên (`priority_score`). Ghim trên bản đồ chuyển sang màu đỏ đậm kèm huy hiệu `+2`, `+5` người xác nhận.

---

### 🔹 T4. Báo Tín hiệu An toàn / Nước rút (Clear Signal)
* **Mục đích:** Dọn dẹp hiện trường bản đồ, tránh cứu hộ lần hai gây lãng phí nguồn lực.
* **Cách thực hiện:**
  * Nạn nhân hoặc cứu hộ bấm nút: **"Tôi đã an toàn / Nước đã rút"**.
  * Ghim đỏ lập tức đổi thành màu xám/xanh kèm dấu tích xanh `✓` (nhãn *"Vừa hết ngập 15 phút trước"*). Tự động gỡ cảnh báo bán kính 300m xung quanh.

---

### 🔹 T5. Phòng Chat Điều phối Vi mô theo Vùng (Zone Incident Chat)
* **Mục đích:** Kênh giao tiếp vi mô có kiểm soát giữa Đội cứu hộ và Dân trong cùng 1 Zone ngập lụt.
* **Quy tắc vận hành nghiêm ngặt chống spam:**
  1. Chỉ người có GPS thực tế nằm trong Zone hoặc Đội cứu hộ phụ trách mới được vào nhắn tin.
  2. Giới hạn 150 ký tự/tin, mỗi tin cách nhau 30 giây (Rate-limit).
  3. Đội cứu hộ có quyền Ghim (PIN) thông báo quan trọng lên đầu phòng chat.
  4. Nút ngắt khẩn cấp (Emergency Mute): Admin có quyền khóa chat về chế độ "Chỉ đọc" khi có kẻ tung tin đồn vỡ đập gây hoảng loạn.

---

### 🔹 T6. Kênh Báo động Tức thì Real-time (Server-Sent Events)
* **Mục đích:** Loại bỏ việc Web Admin phải gọi API liên tục mỗi 15 giây (Polling) gây chậm máy.
* **Cách thực hiện:**
  * Backend Django cung cấp endpoint SSE: `GET /api/feed/stream/`.
  * Khi thực địa có SOS mới, Django bắn sự kiện JSON về trình duyệt tức thì: Điểm ghim nhấp nháy đỏ trên bản đồ Web và phát chuông báo động trong vòng **< 1 giây**.

---

### 🔹 T7. Đặt Theo dõi Bán kính & Thông báo Đẩy (Push Notifications)
* **Mục đích:** Người dân nhận cảnh báo chủ động khi vắng nhà hoặc theo dõi người thân ở vùng lũ.
* **Cách thực hiện:**
  * Bấm nút *"🔔 Theo dõi khu vực này (Bán kính 500m)"* trên app.
  * Khi khu vực đó có cảnh báo ngập sâu hoặc lệnh di dân khẩn cấp, máy tự động phát chuông và hiện thông báo đẩy ra màn hình khóa qua **Expo Push Notifications**.

---

### 🔹 T8. Tích hợp Geocoding Ngõ ngách Chi tiết (Goong API)
* **Mục đích:** Khắc phục nhược điểm của OpenStreetMap vốn rất kém khi tìm ngõ, ngách, thôn, xóm ở làng quê Việt Nam.
* **Cách thực hiện:**
  * Tích hợp **Goong Geocoding API** ở tầng Backend.
  * Khi AI cào bài Facebook (*"Ngách 12/4 thôn Đông..."*), Goong dịch chính xác cụm địa chỉ này ra tọa độ GPS để ghim lên bản đồ cứu nạn.

---

### 🔹 T9. ⭐ Hệ Thống Cứu Nạn Ngoại Tuyến Qua Bluetooth (BLE Offline Rescue)

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
    C->>C: Nén ảnh chụp hiện trường (1280px)
    C->>S: Gửi SOS khẩn cấp (GPS + Nhu cầu + Ảnh nén)
    S-->>A: Đẩy SSE Stream tức thì -> Nhấp nháy đỏ trên Bản đồ (<1s)

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

### 📌 Giai đoạn 1: Sửa các lỗi dẫn đường & Vòng đời dữ liệu (Tuần 1)
* [ ] **Sửa S1:** Xóa bỏ đồ thị hardcode Đà Nẵng, tích hợp API OSRM né vùng ngập.
* [ ] **Sửa S3:** Cài đặt tín hiệu Django Signal tự động đóng Zone khi tất cả SOS chuyển sang `RESOLVED`.
* [ ] **Sửa S4:** Hoàn thiện cơ chế ngưỡng Vote cộng đồng để lọc cảnh báo rác trên Mobile.

### 📌 Giai đoạn 2: Trải nghiệm Hiện trường & Bản đồ Thời tiết (Tuần 2)
* [ ] **Sửa S2:** Chuyển câu tĩnh "Vị trí GPS sẵn sàng" thành thẻ đánh giá nguy cơ bán kính 1km.
* [ ] **Thêm T1:** Tích hợp lớp ảnh Radar mưa động RainViewer lên bản đồ Web Admin và Mobile App.
* [ ] **Thêm T2:** Bổ sung giao diện "Báo cáo tình hình đường sá" (Field Reporting).
* [ ] **Thêm T3 & T4:** Cơ chế xác minh chéo trong 150m và nút báo an toàn (Clear Signal).

### 📌 Giai đoạn 3: Hạ tầng Thời gian thực & Định vị Nâng cao (Tuần 3)
* [ ] **Thêm T5:** Xây dựng tính năng Phòng chat theo Vùng (Zone Incident Chat) có phân quyền.
* [ ] **Thêm T6:** Thay thế cơ chế Polling bằng Server-Sent Events (SSE) trên Dashboard Admin.
* [ ] **Thêm T7:** Tích hợp hệ thống thông báo đẩy (Push Notifications) cho tính năng theo dõi khu vực.
* [ ] **Thêm T8:** Tích hợp Goong Maps API để hỗ trợ dịch địa chỉ ngõ ngách thôn xóm từ Facebook.

### 📌 Giai đoạn 4: ⭐ Hệ Thống Cứu Nạn Ngoại Tuyến Bluetooth (Tuần 4 - Đột phá ĐATN)
* [ ] **T9.1 - PoC Cốt lõi:** Cấu hình Expo Development Build với `react-native-ble-plx` & BLE Peripheral, thử nghiệm phát và quét gói tin 16 bytes giữa 2 điện thoại khi tắt hoàn toàn Wi-Fi/4G.
* [ ] **T9.2 - Radar Tầm Soát & Đo Cự Ly:** Xây dựng màn hình `RadarProximityScreen.js`, hiển thị vòng quét Sonar 360°, ước tính khoảng cách mượt bằng Moving Average RSSI, tích hợp âm thanh bíp Sonar (`expo-av`) và rung phản hồi (`expo-haptics`).
* [ ] **T9.3 - Định Vị Khẩn Cấp (Ping):** Thêm nút lệnh Ping từ xa kích hoạt chớp đèn Flash camera SOS (`expo-camera`) và hú còi 100% âm lượng trên máy nạn nhân trong đêm tối.
* [ ] **T9.4 - Quick Chat & Đồng Bộ:** Xây dựng bộ đàm tin nhắn nhanh 1-chạm qua BLE GATT; cơ chế Store-and-Forward tự động gom dữ liệu và đồng bộ lên Django Backend khi ra vùng có sóng.

---
*Tài liệu này đóng vai trò là bản đặc tả kỹ thuật (Specification Document) chuẩn để đội ngũ phát triển căn cứ triển khai, kiểm thử và nghiệm thu dự án.*
