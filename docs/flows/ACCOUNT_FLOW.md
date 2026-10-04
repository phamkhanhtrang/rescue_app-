# Luồng tài khoản web và app

## Hành vi

- Người dân đăng ký: tạo hồ sơ và phiên đăng nhập trong cùng luồng, không gọi đăng nhập lần thứ hai.
- Cứu hộ đăng ký: chọn một mã chuyên môn chính (SEARCH_RESCUE, MEDICAL, LOGISTICS, COMMAND), lưu số hiệu đội tự khai, trạng thái PENDING; chưa cấp token.
- Admin mở trang Tài khoản để tìm tên/SĐT/email, lọc vai trò và trạng thái, xem chi tiết rồi duyệt hoặc từ chối. Có thể khóa/mở khóa người dùng; từ chối và khóa bắt buộc có lý do. Lưu lịch sử xử lý.
- Trạng thái: PENDING → ACTIVE hoặc REJECTED; ACTIVE → BANNED; REJECTED/BANNED → ACTIVE khi admin duyệt lại/mở khóa. Không tự khóa tài khoản quản trị hoặc xóa tài khoản có lịch sử qua API hồ sơ.
- Người dùng chỉ xem/sửa hồ sơ riêng. Danh bạ cứu hộ phục vụ bản đồ không trả email, CCCD hoặc hồ sơ y tế; SĐT và tọa độ chỉ trả khi cứu hộ đang trực.
- SĐT được chuẩn hóa và cập nhật cả username. Kiểm tra SĐT/email trùng. Không đổi vai trò/trạng thái thông qua cập nhật hồ sơ.
- App có Email & mật khẩu trong hồ sơ; web có nút tương ứng ở thanh đầu trang. Đổi email của bản thân cần mật khẩu hiện tại. Admin hỗ trợ sửa liên hệ sau khi xác minh chủ tài khoản.
- Quên mật khẩu: nhập email đã lưu, nhận mã dài qua email và dán toàn bộ mã vào form. Mã hết hạn sau 15 phút, chỉ dùng một lần. Tài khoản chưa có email cần admin hỗ trợ bổ sung. Phản hồi gửi mã không tiết lộ email có tài khoản hay không.
- Đổi/khôi phục mật khẩu hủy mọi phiên cũ và ngừng push trên thiết bị cũ; không tự mở khóa hoặc duyệt tài khoản.
- Đăng xuất trực tuyến thu hồi phiên của thiết bị hiện tại. Khi mất mạng vẫn xóa phiên trên máy; không thể xác nhận thu hồi ở máy chủ trong lúc offline.
- Khi khóa rồi mở lại, các token trước lúc khóa vẫn bị từ chối. App kiểm tra hồ sơ khi khôi phục phiên và quay lại foreground; lỗi mạng giữ dữ liệu offline, phiên không hợp lệ yêu cầu đăng nhập lại.

## Cơ sở dữ liệu và email

Migration accounts 0011–0013 đã áp dụng lên cơ sở dữ liệu cấu hình của dự án ngày 12/09/2026.
Migration chuẩn hóa chuyên môn cũ về một mã chính; nếu chuyển đổi từ nhãn cũ, giá trị gốc được lưu trong lịch sử tài khoản. Giá trị không nhận diện để trống để người dùng bổ sung.

Email dùng cấu hình SMTP hiện có trong backend: EMAIL_ADDRESS và EMAIL_PASSWORD. Không ghi mật khẩu/token vào log. Kiểm thử tự động dùng hộp thư giả lập; chưa xác nhận giao email thực tế.

## Kiểm thử

Backend (SQLite riêng, không tạo tài khoản thử trên Supabase):

```powershell
cd D:\rescue_app-\backend
.\venv\Scripts\python.exe manage.py test accounts rescue_operations.test_flow communications.test_flow --settings=sentinel.test_settings
```

Web:

```powershell
cd D:\rescue_app-\FE-web
node --test tests/auth-session.cjs tests/content-links.cjs
npx tsc --noEmit
npm run build
```

Kiểm thử trình duyệt (API giả lập, không gửi email hoặc sửa tài khoản thật): chạy Vite ở port 4179 bằng `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4179 --strictPort`, sau đó từ thư mục dự án chạy `.\backend\venv\Scripts\python.exe FE-web/tests/account-browser.py`.

App:

```powershell
cd D:\rescue_app-\FE-app
node --test tests/auth-session.cjs tests/alerts.cjs
npx expo export --platform android --output-dir dist-alert-check
```

Chưa thao tác trên thiết bị Android/iOS thật trong lần sửa này. Sau cập nhật, tải lại web, reload app và khởi động lại backend nếu tiến trình đang chạy không tự reload.
