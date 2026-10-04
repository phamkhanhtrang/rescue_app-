# Luồng thông báo web và app

## Sử dụng ngay với Expo Go

Web chọn độc lập **loại tin**, **người nhận** (tất cả/người dân/cứu hộ), **khu vực** và thời điểm **hết hạn** tùy chọn. Bản tin có hiệu lực ngay khi đăng thành công.

- Backend kiểm tra vai trò và phạm vi tại danh sách, chi tiết, phản hồi và ghi nhận đã đọc. `tab=all` không bỏ qua quyền của tài khoản thông thường.
- Người dân nhận tin toàn hệ thống và khu vực trong bán kính 20 km tính từ tâm vùng theo GPS; khi không có GPS, dùng địa chỉ tài khoản. Đây là phạm vi theo bán kính, chưa phải ranh giới hành chính.
- Cứu hộ ưu tiên các khu vực nhiệm vụ chưa hoàn thành/chưa hủy, kể cả nhiệm vụ đang chờ nhận. Nếu chưa có nhiệm vụ, dùng vị trí thiết bị còn mới hoặc địa chỉ tài khoản.
- Hai màn hình thông báo tải lại khi được mở, khi app trở lại foreground, mỗi 15 giây khi màn hình đang được xem và khi kéo xuống. Không polling khi màn hình mất focus hoặc app ở nền. Phản hồi từ lần tải trước không ghi đè dữ liệu của màn hình/vị trí mới.
- Mở chi tiết mới ghi nhận đã đọc. Đọc lại cùng phiên bản không tăng lượt đọc. Kích hoạt lại hoặc sửa nội dung/phạm vi tạo phiên bản mới và cần đọc lại.
- Thu hồi hoặc hết hạn làm bản tin biến mất khỏi danh sách app; chi tiết cũng kiểm tra lại mỗi 15 giây. Nếu mất mạng, app báo lỗi thay vì khẳng định khu vực an toàn.
- Thông báo theo khu vực không tự biến thành thông báo toàn hệ thống khi xóa khu vực: vùng có bản tin liên quan được bảo vệ khỏi xóa.
- Số tiếp cận cố định đã được bỏ. Web hiển thị hiệu lực, số người đã mở chi tiết và kết quả push thực tế nếu có.

Khởi động lại ba tiến trình đang chạy sau khi cập nhật mã:

```powershell
# Terminal backend
cd D:\rescue_app-\backend
.\venv\Scripts\python.exe manage.py migrate communications
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

```powershell
# Terminal web
cd D:\rescue_app-\FE-web
npm run dev
```

```powershell
# Terminal app
cd D:\rescue_app-\FE-app
npx expo start --clear
```

## Push khi app đóng: mã đã có, cần cấu hình khi đóng gói

Push **mặc định tắt** ở backend. Expo Go trên Android SDK 54 không hỗ trợ remote push. Phần đọc/cập nhật thông báo trong app vẫn hoạt động mà không cần EAS/FCM.

Khi sẵn sàng đóng gói:

1. Liên kết dự án với EAS; cấu hình FCM v1 cho Android, APNs nếu phát hành iOS, và định danh ứng dụng. Không lưu khóa dịch vụ vào Git.
2. Cung cấp EAS project ID qua cấu hình `extra.eas.projectId` hoặc `EXPO_PUBLIC_EAS_PROJECT_ID` trong môi trường build. Plugin `expo-notifications` và các thư viện tương thích SDK 54 đã được thêm.
3. Tạo/cài bản development hoặc production có native module thông báo, đăng nhập và cấp quyền nhận thông báo trên thiết bị thật. Expo Go/web bỏ qua đăng ký push.
4. Trong môi trường backend đặt `EXPO_PUSH_ENABLED=True`. Nếu bật bảo vệ Expo Push Service bằng access token, cấu hình `EXPO_ACCESS_TOKEN` tương ứng ở backend.
5. Khởi động lại backend và chạy thêm một worker:

```powershell
cd D:\rescue_app-\backend
.\venv\Scripts\python.exe manage.py process_alert_push --watch
```

Worker tạo các lượt gửi bền vững trong database, kiểm tra lại người nhận/hiệu lực trước khi gửi, chống gửi lặp theo bản tin + phiên bản + thiết bị. Thiết bị mới không nhận dồn bản tin cũ; worker chỉ xét bản tin được phát trong 24 giờ gần nhất và thiết bị hoạt động trong 30 ngày qua. GPS lưu trên thiết bị chỉ được dùng khi được cập nhật trong 24 giờ.

Push chỉ có lời nhắc chung. Khi nhấn, app mở đúng bản tin và lấy nội dung với phiên đăng nhập hiện tại. Thông báo đã thu hồi không mở được nội dung cũ. Việc thu hồi không thể bảo đảm xóa banner đã được hệ điều hành hiển thị.

Các trạng thái trên web không đồng nghĩa với nhau:

- **Đã đăng**: bản tin lưu thành công trong hệ thống.
- **Chờ push**: đã có lượt gửi chờ worker xử lý.
- **Expo tiếp nhận**: Expo trả về ticket thành công.
- **Dịch vụ push xác nhận**: receipt xác nhận chuyển giao tới dịch vụ push; không chứng minh người dùng đã nhìn thấy banner.
- **Đã đọc**: tài khoản mở chi tiết phiên bản hiện tại.
- **Lỗi / Chưa rõ kết quả**: có lỗi xác định hoặc không xác định được lần gửi đã được nhận chưa. Timeout không tự gửi lại để tránh gửi trùng. HTTP 429/5xx và lỗi tốc độ được thử lại có giới hạn.

Đăng xuất sẽ hủy đăng ký thiết bị trước khi xóa phiên. Nếu mất mạng trong lúc đăng xuất, máy chủ chưa chắc nhận được yêu cầu hủy; push còn sót chỉ chứa lời nhắc chung và app kiểm tra lại người dùng/hiệu lực trước khi mở.

Tài liệu chính thức: [Thiết lập Expo push](https://docs.expo.dev/push-notifications/push-notifications-setup/), [SDK 54 notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/), [Tickets và receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

## Migration dữ liệu cũ

Migration suy ra loại tin từ severity/category và chuyển `category=teams` sang đối tượng cứu hộ. Những cảnh báo khẩn cấp cũ đã lưu `category=emergency, zone=null` không còn thông tin để xác định chúng từng được chọn “đội cứu hộ” hay “toàn dân”; cần người quản trị rà soát, thu hồi và đăng lại đúng phạm vi nếu cần. Không tự đoán lại đối tượng nhận.

## Kiểm thử

```powershell
cd D:\rescue_app-\backend
.\venv\Scripts\python.exe manage.py test communications accounts.test_token_refresh rescue_operations.test_flow --settings=sentinel.test_settings
```

```powershell
cd D:\rescue_app-\FE-app
node --test tests/alerts.cjs
npx expo export --platform android --output-dir dist-alert-check
```

```powershell
cd D:\rescue_app-\FE-web
npx tsc --noEmit
npm run build
```

Backend test dùng SQLite tách biệt, không ghi vào Supabase. Push trong test được giả lập; kiểm chứng nhận banner thật khi app đóng vẫn cần bản cài và cấu hình thiết bị ở trên.
