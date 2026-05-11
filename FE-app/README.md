# SENTINEL - Hệ thống Cứu hộ Thông minh

SENTINEL là một ứng dụng di động được xây dựng bằng **React Native** và **Expo**, được thiết kế để kết nối người dân và đội cứu trợ trong các tình huống khẩn cấp. Ứng dụng tích hợp công nghệ AI và Blockchain để tối ưu hóa việc điều phối và đảm bảo tính minh bạch của dữ liệu.

---

## 📂 Cấu trúc Thư mục & Chi tiết File

### 1. Thư mục Gốc & Cấu hình
- **App.js**: Điểm bắt đầu của ứng dụng. Thiết lập `AuthProvider` để quản lý trạng thái và `RootNavigator` để điều hướng.
- **index.js**: File entry point kỹ thuật của Expo.
- **app.json**: Chứa các cấu hình metadata của ứng dụng (tên, icon, splash screen).
- **package.json**: Quản lý các thư viện (dependencies) và kịch bản lệnh (`scripts`).

### 2. Thư mục `src/context` (Quản lý trạng thái)
- **AuthContext.js**: Chứa logic xác thực, lưu trữ thông tin người dùng và vai trò (`userRole`: CITIZEN/RESCUER).

### 3. Thư mục `src/navigation` (Luồng điều hướng)
- **RootNavigator.js**: Điều phối chính. Nếu chưa đăng nhập -> `AuthStack`. Nếu là Người dân -> `CitizenStack`. Nếu là Cứu trợ -> `RescuerStack`.
- **AuthStack.js**: Quản lý luồng Đăng nhập, Đăng ký và màn hình Chào mừng (`WelcomeScreen`).
- **CitizenStack.js**: Cấu hình Tab Bar cho Người dân (Trang chủ, Bản đồ, Cảnh báo, Hồ sơ).
- **RescuerStack.js**: Cấu hình Tab Bar cho Đội cứu trợ (Điều hành, Nhiệm vụ, Bản đồ, Thông báo).

### 4. Thư mục `src/constants` (Thiết kế hệ thống)
- **citizen/theme.js**: Định nghĩa bảng màu (Light Blue), Typography và Spacing đặc trưng cho Người dân.
- **rescuer/theme.js**: Định nghĩa bảng màu (Dark Navy/Red), Typography và Spacing chuyên nghiệp cho Đội cứu trợ.

### 5. Thư mục `src/screens` (Màn hình chức năng)

#### 🔑 Luồng Xác thực (Auth)
- **auth/WelcomeScreen.js**: Màn hình chào mừng, cho phép chọn vai trò ban đầu.
- **auth/LoginScreen.js**: Màn hình đăng nhập chung.
- **auth/citizen/CitizenLoginScreen.js**: Đăng nhập dành riêng cho Người dân.
- **auth/citizen/CitizenRegisterScreen.js**: Đăng ký tài khoản Người dân mới.
- **auth/rescuer/RescuerLoginScreen.js**: Đăng nhập dành riêng cho Đội cứu trợ.
- **auth/rescuer/RescuerRegisterScreen.js**: Đăng ký tài khoản Cứu trợ (với các yêu cầu chứng chỉ).

#### 🛡 Cho Người dân (Citizen)
- **home/HomeScreen.js**: Giao diện chính với nút SOS khẩn cấp.
- **sos/SOSScreen.js**: Màn hình đếm ngược và kích hoạt tín hiệu cứu trợ.
- **sos/SOSConfirmScreen.js**: Xác nhận tình trạng an toàn và thông tin gửi đi.
- **map/MapScreen.js**: Bản đồ tìm kiếm trạm y tế và vùng an toàn lân cận.
- **alerts/AlertsScreen.js**: Danh sách thông báo cứu trợ và xác thực cộng đồng.
- **profile/ProfileScreen.js**: Quản lý thông tin cá nhân và mã bảo mật Blockchain.
- **history/HistoryScreen.js**: Xem lại lịch sử các yêu cầu cứu trợ đã gửi.

#### ⛑ Cho Đội cứu trợ (Rescuer)
- **dashboard/DashboardScreen.js**: Trung tâm chỉ huy, hiển thị biểu đồ và tóm tắt tình hình.
- **missions/ZoneListScreen.js**: Danh sách các điểm nóng cần triển khai cứu trợ.
- **missions/ZoneDetailScreen.js**: Thông tin chi tiết về nhu cầu (nhân lực, vật lực) của một vùng.
- **missions/JoinConfirmScreen.js**: Màn hình xác nhận tham gia vào một vùng cứu trợ.
- **missions/ActiveMissionScreen.js**: Theo dõi và cập nhật tiến độ các nhiệm vụ đang làm.
- **missions/StatusUpdateScreen.js**: Cập nhật trạng thái hiện trường lên hệ thống Blockchain.
- **map/RescuerMapScreen.js**: Bản đồ tác chiến với chiến lược AI điều phối.
- **resources/ResourceDeclareScreen.js**: Khai báo phương tiện và nhu yếu phẩm mang theo.
- **alerts/RescuerAlertsScreen.js**: Nhận thông báo khẩn cấp từ ban chỉ huy.
- **profile/RescuerProfileScreen.js**: Thông tin tài khoản cứu trợ và chức năng Đăng xuất.
- **offline/RescuerOfflineScreen.js**: Giao diện hoạt động khi mất kết nối mạng.

### 6. Thư mục `src/components` (Thành phần giao diện)
- **citizen/common/SentinelHeader.js**: Header đặc trưng cho Người dân.
- **rescuer/common/RescuerHeader.js**: Header phong cách Command Center cho Cứu trợ.
- **citizen/home/SOSButton.js**: Nút bấm SOS với hiệu ứng sóng âm.
- **citizen/common/MapPlaceholder.js**: Thành phần hiển thị bản đồ giả lập.

---

## 🚀 Hướng dẫn Chạy ứng dụng

### 1. Yêu cầu hệ thống
- Đã cài đặt **Node.js** (LTS).
- Đã cài đặt **Git**.
- (Tùy chọn) Ứng dụng **Expo Go** trên điện thoại (để xem trực tiếp).

### 2. Cài đặt
Mở terminal tại thư mục gốc của dự án (`d:\DACN3`) và chạy lệnh:
```bash
npm install
```

### 3. Khởi chạy
Để bắt đầu quá trình phát triển và xem giao diện:
```bash
# Chạy với Expo
npx expo start
```

Sau khi chạy lệnh trên, bạn có thể:
- Nhấn **`w`** để mở trên trình duyệt web.
- Nhấn **`a`** để mở trên Android Emulator.
- Nhấn **`i`** để mở trên iOS Simulator.
- Quét mã QR bằng ứng dụng **Expo Go** trên điện thoại để chạy thực tế.

---

## 🛠 Công nghệ Sử dụng
- **Core:** React Native, Expo.
- **Navigation:** React Navigation (Stack & Bottom Tabs).
- **Styling:** StyleSheet (Vanilla CSS-in-JS).
- **Icons:** Emoji-based (để tối ưu hóa hiệu năng và tính nhất quán).
- **Design System:** Sentinel Ethos (Hệ thống thiết kế đặc trưng cho cứu hộ).

---

## 🛡 Đặc điểm Nổi bật
- **Phân quyền người dùng:** Logic tự động chuyển đổi giao diện dựa trên vai trò (`CITIZEN` hoặc `RESCUER`).
- **Sentinel Ethos Design:**
    - **Người dân:** Giao diện sáng, nút SOS trực quan, tạo cảm giác an tâm.
    - **Đội cứu trợ:** Giao diện tối chuyên nghiệp, tập trung vào dữ liệu bản đồ và nhiệm vụ.
- **Tính minh bạch:** Giả lập các bước xác thực Blockchain và phân tích dữ liệu AI trên mọi hành động quan trọng.

---
*Dự án được phát triển bởi Antigravity AI.*
