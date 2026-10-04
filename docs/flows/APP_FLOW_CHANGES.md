# Các thay đổi luồng app

## Đã triển khai

- SOS dùng chung cho khách và người đã đăng nhập: chọn vị trí GPS, địa chỉ hoặc bản đồ, khai báo nhu cầu và ảnh tùy chọn. Không lấy tọa độ tham khảo làm vị trí người gửi.
- Khách nhận quyền theo dõi riêng, lưu bằng SecureStore trên thiết bị. Gửi lại cùng bản nháp không tạo SOS trùng; có thể khôi phục kết quả nếu mất phản hồi sau khi máy chủ lưu. Bản web chỉ giữ quyền trong phiên tab.
- Danh sách yêu cầu đã gửi và theo dõi dữ liệu thật: trạng thái cứu trợ, trạng thái xác minh riêng, đội phụ trách, nhật ký, bổ sung thông tin/ảnh, báo tình hình xấu đi, hủy có lý do, xác nhận kết quả hoặc báo vẫn cần giúp.
- Sửa đăng nhập người dân. Backend kiểm tra người thực hiện; người gửi không tự sửa trạng thái xác minh hoặc quyền tài khoản.
- Nguồn lực dùng một bản khai hiện tại; lưu nhân lực, phương tiện, chuyên môn, vật tư và thời điểm đội xác nhận. Bản khai hiển thị là tự khai, chưa được coi là admin kiểm chứng. Không cộng dồn các bản khai cũ. Khóa sửa khi đội đang có nhiệm vụ.
- Nhiệm vụ: admin giao → chờ đội nhận → đã nhận → đang đi → đến hiện trường → xử lý từng SOS → báo cáo hoàn thành. Đội tự nhận bắt đầu ở bước đã nhận. Mỗi đội nhận tối đa một nhiệm vụ mở; dành toàn bộ nguồn lực hiện tại cho nhiệm vụ đó.
- Không cho hoàn thành khi còn SOS mở hoặc nhu cầu chi viện chưa đóng. Bàn giao có lý do đưa SOS chưa xử lý về hàng chờ.
- Chi viện là yêu cầu riêng, không thay thế trạng thái nhiệm vụ chính. Đội hỗ trợ không chiếm SOS của đội chính. Đội hỗ trợ rút lui thì mở lại yêu cầu; nhiệm vụ nguồn hủy thì đóng nhu cầu của nhiệm vụ đó.
- Bảng điều hành đội ưu tiên nhiệm vụ đang mở. Bỏ số liệu giả trong màn theo dõi SOS và bỏ vận tốc/cảnh báo giả lập, đường thẳng thay tuyến đường khi lỗi ở màn dẫn đường.

## Chạy lại

Chạy từ thư mục dự án bằng PowerShell. Backend cần cấu hình môi trường và cơ sở dữ liệu như trước.

```powershell
cd D:\rescue_app-\backend
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

Mở cửa sổ khác:

```powershell
cd D:\rescue_app-\FE-app
npm install
npx expo start --clear
```

Địa chỉ backend nằm ở `FE-app/src/services/apiClient.js`. Điện thoại cần truy cập được địa chỉ này. Đã thêm `expo-secure-store`; nếu dùng development build riêng, cần tạo lại build để có module native mới.

Hai migration mới là `reporting/0004` và `rescue_operations/0003`. Chúng chưa được áp dụng lên cơ sở dữ liệu đang sử dụng trong lần sửa này; kiểm thử chỉ dùng SQLite tạm. Kiểm tra đúng cấu hình cơ sở dữ liệu trước khi chạy migrate.

## Dữ liệu cũ và giới hạn

- Đội có nguồn lực cũ phải mở khai báo và xác nhận lại trước khi nhận nhiệm vụ mới.
- Nhiệm vụ cũ chưa gắn SOS cần dùng nút nhận SOS chưa phân công trong vùng, hoặc bàn giao có lý do. Không tự phân lại nhiệm vụ cũ hay tự gộp các nhiệm vụ trùng.
- SOS khách cũ chỉ lưu ID không thể tự cấp lại quyền theo dõi; cần admin hỗ trợ. Không dùng ID làm bằng chứng sở hữu.
- API đã hỗ trợ admin xác minh và yêu cầu bổ sung thông tin; giao diện admin cho xác minh, chi viện mới, kiểm chứng nguồn lực và luồng gộp/tách vùng chưa được hoàn thiện trong đợt sửa app này. Web chỉ được cập nhật nhận biết trạng thái nhiệm vụ mới.
- Việc nhận chi viện kiểm tra đội sẵn sàng nhưng chưa tự đối chiếu loại/số lượng nguồn lực với yêu cầu; đội cần xác nhận khả năng đáp ứng trước khi nhận.
- Đây chưa phải cơ chế gửi SOS ngoại tuyến hoặc thông báo đẩy. Theo dõi tải lại khi app đang hoạt động; chia sẻ GPS chưa phải dịch vụ nền.
- Chưa kiểm thử thao tác trên điện thoại thật, quyền GPS/camera thực tế, máy chủ bản đồ, cơ sở dữ liệu PostgreSQL và tranh chấp nhiều thiết bị. Đóng gói Android thành công không thay thế kiểm thử này.

## Kiểm chứng

```powershell
cd D:\rescue_app-\backend
.\venv\Scripts\python.exe manage.py test rescue_operations.test_flow --settings=sentinel.test_settings --noinput
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run --settings=sentinel.test_settings
```

13 bài kiểm thử API bao phủ các quyền truy cập, chống tạo trùng SOS, phản hồi xác minh, khai báo nguồn lực, chuyển bước nhiệm vụ, bàn giao và chi viện. Migration không còn thay đổi thiếu. App được kiểm tra đóng gói Android bằng Expo export.
