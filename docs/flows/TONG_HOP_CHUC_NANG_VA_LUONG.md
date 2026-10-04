# Tổng hợp chức năng và luồng hoạt động Guardian Pulse

Ngày rà soát: 04/09/2026. Căn cứ: mã nguồn web React, app React Native và backend Django trong workspace. Đây là phân tích tĩnh; chưa chạy kiểm thử đầu cuối, kết nối cơ sở dữ liệu, gửi email hay chạy crawler. “Có xử lý” nghĩa là đã thấy đường gọi từ giao diện tới backend, không đồng nghĩa đã xác nhận vận hành thành công.

## 1. Vai trò và dữ liệu trung tâm

| Vai trò | Giao diện | Mục đích |
|---|---|---|
| ADMIN | FE-web | Theo dõi tình hình, quản lý tài khoản/vùng, điều phối và phát tin, duyệt tin AI, báo cáo. |
| CITIZEN — Người dân | FE-app/CitizenStack | Gửi cầu cứu, xem tình hình và đội cứu hộ, xác nhận cảnh báo, quản lý hồ sơ. |
| RESCUER — Cứu hộ | FE-app/RescuerStack | Khai báo nguồn lực, tham gia vùng cứu hộ, thực hiện nhiệm vụ và hỗ trợ đội khác. |

Trong cơ sở dữ liệu, Mission liên kết **một tài khoản cứu hộ với một vùng**. “Đội” trên giao diện thường là tài khoản RESCUER có tên đơn vị và nguồn lực; chưa có mô hình đội gồm nhiều tài khoản thành viên độc lập.

Các dữ liệu chính:

- User + CitizenProfile/RescuerProfile: tài khoản và hồ sơ theo vai trò.
- SOSSignal + SOSImage: yêu cầu cầu cứu và ảnh; mỗi SOS có thể thuộc một Zone.
- Zone: vùng sự cố, tọa độ trung tâm, mức độ nguy hiểm, số người ảnh hưởng, nhu cầu cứu hộ, điểm ưu tiên.
- Mission: nhiệm vụ của cứu hộ tại vùng; một vùng có nhiều nhiệm vụ và nhiều SOS.
- Resource: phương tiện, số thành viên và trạng thái sẵn sàng của tài khoản cứu hộ.
- Alert + AlertVote: cảnh báo và các lượt xác nhận cộng đồng.
- CrawledArticle: bài thu thập, kết quả phân tích, trạng thái duyệt và liên kết tới Alert hoặc SOS.

## 2. Chức năng admin trên web

| Mã | Chức năng | Luồng xử lý và kết quả |
|---|---|---|
| A01 | Đăng nhập, đăng xuất | Nhập email/SĐT/tên đăng nhập và mật khẩu → backend kiểm tra tài khoản đang hoạt động → cấp access/refresh token → web lưu access token và thông tin vai trò → ADMIN vào dashboard. Đăng xuất xóa localStorage. Nhãn OTP trên form chưa có luồng OTP. |
| A02 | Dashboard tổng quan | Tải vùng, cứu hộ, SOS, nhiệm vụ và cảnh báo → web tổng hợp SOS chờ xử lý, vùng đang hoạt động/nguy cấp, đội đang làm nhiệm vụ/rảnh và nhiệm vụ hoàn thành → hiển thị bảng tình hình. Có một số cách tính chưa đúng, xem mục 7. |
| A03 | Bản đồ tổng quan | Tải thống kê, SOS PENDING, cứu hộ và các vùng → hiển thị lớp bản đồ/điểm dữ liệu → tìm địa danh bằng Nominatim → di chuyển bản đồ. Một số nút phụ chỉ hiện thông báo thử nghiệm. |
| A04 | Danh sách và chi tiết vùng | Tải Zone + SOS + Mission → đếm đội theo vùng, thống kê SOS và vùng mới → chọn vùng → xem mức độ, tình trạng, SOS thuộc vùng, nhiệm vụ và đội liên quan. |
| A05 | Tạo vùng thủ công | Nhập tên, mã vùng, mức độ, trạng thái, tọa độ hoặc địa chỉ → nếu có địa chỉ thì tra tọa độ → gửi tạo Zone → tải lại danh sách. Nếu tra địa chỉ thất bại, giao diện thông báo rồi dùng tọa độ mặc định. |
| A06 | Đổi trạng thái/mức độ vùng | Chọn trạng thái hoặc mức nguy hiểm trên danh sách → PUT Zone → lưu và tải lại dữ liệu. Có API xóa vùng nhưng chưa thấy thao tác xóa tương ứng trong luồng giao diện chính. |
| A07 | Theo dõi đội cứu hộ | Tải cứu hộ, vùng, nhiệm vụ và SOS mỗi 15 giây → đặt vị trí đội trên bản đồ, suy ra vùng gần nhất và trạng thái → so với lần tải trước để cảnh báo đứng yên, rời vùng sớm, sai vùng phân công → mở lịch sử nhiệm vụ của đội. Các nhận định bất thường được tính ở trình duyệt, không phải nhật ký GPS lâu dài. |
| A08 | Xem mất cân bằng nguồn lực | Từ số đội, số nạn nhân và mức nguy hiểm của vùng → hiển thị gợi ý vùng thiếu đội, vùng ưu tiên hoặc dư nguồn lực. Đây là các quy tắc trong trang theo dõi đội. |
| A09 | Phân công theo gợi ý AI | Mở “AI gợi ý phân công” trong trang Đội cứu hộ → backend chấm điểm các cặp cứu hộ rảnh/vùng thiếu người → trả gợi ý và lý do → admin chấp nhận → tạo Mission mặc định ACTIVE → tính lại điểm ưu tiên của vùng. Gợi ý chưa tự tạo nhiệm vụ nếu admin chưa chấp nhận. |
| A10 | Tiếp nhận yêu cầu chi viện | Vùng có Mission NEEDS_HELP → admin mở danh sách đội yêu cầu → nhấn Chấp nhận (+1) → tăng rescuers_needed của vùng thêm 1 → đổi nhiệm vụ đang yêu cầu về ACTIVE → tạo Alert khẩn category=teams. Bước này chưa tự chọn và phân công đội bổ sung. |
| A11 | Quản lý tài khoản | Tải danh sách người dân/cứu hộ và thống kê → chuyển tab, phân trang → duyệt hoặc khóa tài khoản → backend cập nhật is_active và trạng thái hồ sơ cứu hộ. Tab tài khoản bị gắn cờ chưa có nguồn dữ liệu riêng. |
| A12 | Duyệt/mở lại tài khoản cứu hộ | Tài khoản đăng ký ở trạng thái PENDING và is_active=false → admin kích hoạt → is_active=true, hồ sơ ACTIVE → thử gửi email → người dùng có thể đăng nhập. Email lỗi không làm hủy kết quả kích hoạt. |
| A13 | Khóa tài khoản | Admin chọn cấm → is_active=false → nếu là cứu hộ thì hồ sơ BANNED và thử gửi email → các lần đăng nhập tiếp theo bị từ chối. Việc kiểm soát quyền API/token hiện còn thiếu, xem mục 7. |
| A14 | Phát thông báo | Chọn phạm vi Toàn dân/Theo khu vực/Đội cứu hộ, nhập tiêu đề, nội dung, mức ưu tiên → tạo Alert nguồn SYSTEM → app lấy danh sách cảnh báo để hiển thị. Chỉ phạm vi vùng thực sự truyền zone ID; lựa chọn đội cụ thể chưa được lưu thành người nhận. |
| A15 | Thu thập tin báo chí/Facebook | Chọn quét báo chí hoặc Facebook, khoảng thời gian Facebook hoặc chu kỳ tự quét → backend thu thập → lọc trùng → phân loại → nhận diện địa điểm → lưu bài ANALYZED → web tải lại danh sách. Tự quét chạy bằng bộ hẹn giờ trong trang web, không phải lịch chạy độc lập ở server. |
| A16 | Duyệt/từ chối tin thu thập | Lọc nguồn/trạng thái → xem kết quả phân tích → duyệt bài báo để tạo Alert nguồn AI; duyệt bài Facebook để tạo SOS và gom vùng → từ chối để lưu REJECTED cùng lý do. Khi duyệt Facebook, có kiểm tra nội dung SOS tương tự trong 24 giờ, ngưỡng 0,85 để liên kết SOS cũ. |
| A17 | Thử phân loại văn bản | Nhập văn bản → gọi classify → nếu PhoBERT sẵn sàng thì trả nhãn, độ tin cậy và điểm các nhãn; nếu không thì trả kết quả dựa trên quy tắc. Việc thử phân loại không đồng nghĩa tạo SOS/cảnh báo. |
| A18 | Thống kê, xuất báo cáo | Tải thống kê và SOS → tính tỷ lệ SOS đã xử lý, vùng đã giải quyết, phân bố mức độ, tiến độ theo vùng → in trang để lưu PDF hoặc tải CSV mở bằng Excel. Chức năng mang nhãn Excel thực tế xuất CSV, không phải XLSX. |

Nguồn đối chiếu: `FE-web/src/App.tsx`, `FE-web/src/components/SliderBar.tsx`, toàn bộ các trang trong `FE-web/src/pages`, `FE-web/src/services/api.ts`; backend tương ứng trong accounts, rescue_operations, reporting, communications và ai.

## 3. Chức năng người dân trên app

| Mã | Chức năng | Luồng xử lý và kết quả |
|---|---|---|
| C01 | Đăng ký | Nhập họ tên, số điện thoại, email, địa chỉ và mật khẩu → form kiểm tra dữ liệu → backend kiểm tra trùng số điện thoại/email → tạo User CITIZEN, băm mật khẩu và tạo CitizenProfile → có thể đăng nhập, không cần bước duyệt như cứu hộ. |
| C02 | Đăng nhập/ghi nhớ phiên | Nhập thông tin → gọi login → app lưu token, vai trò, thông tin vào AsyncStorage → vào CitizenStack. Mở lại app đọc phiên đã lưu. Có nút đăng nhập demo; màn hình citizen hiện gán CITIZEN thay vì xác nhận vai trò trả về. |
| C03 | Trang chủ | Giữ nút SOS 3 giây → mở form SOS; có lối đi tới bản đồ, cảnh báo và hồ sơ. Bản đồ thu nhỏ là MapPlaceholder; lời “Bạn đang an toàn” là nội dung cố định, chưa phải kết quả đánh giá nguy cơ tại GPS. |
| C04 | Gửi SOS kèm vị trí và ảnh | Cấp quyền GPS → lấy vị trí và giải mã địa chỉ → chọn Cứu người/Y tế/Thực phẩm → nhập mô tả → chụp ảnh tùy chọn → tạo SOS PENDING với người gửi, tọa độ, loại nhu cầu, people_count=1 → tải ảnh bằng yêu cầu riêng → mở màn hình xác nhận. Backend bổ sung tên/SĐT/địa chỉ người gửi vào ghi chú và kích hoạt gom vùng. |
| C05 | Xem kết quả gửi | Màn hình xác nhận hiển thị mã/vị trí đã gửi → chọn Xem trạng thái → chuyển sang lịch sử SOS. Thông báo đội gần nhất đã nhận và thanh 87% là nội dung cố định, chưa được kiểm chứng bằng Mission. |
| C06 | Hủy yêu cầu vừa gửi | Chọn Hủy yêu cầu trên màn hình xác nhận → xác nhận thao tác → gọi DELETE SOS → xóa SOS và ảnh liên quan → backend cập nhật số người/mức độ vùng, có thể đóng vùng nếu không còn SOS hoạt động → thử tính lại điểm ưu tiên. Đây là xóa bản ghi, không phải giữ bản ghi CANCELLED. |
| C07 | Xem lịch sử cầu cứu | Mở Lịch sử tín hiệu → lấy SOS lọc theo citizen ID → xem thời điểm, trạng thái, vùng, ghi chú và ảnh → kéo để tải lại. Một số nhãn trạng thái và dữ liệu minh họa còn chưa khớp backend. |
| C08 | Xem bản đồ tình hình | Lấy GPS, vùng, nhiệm vụ, cảnh báo và cứu hộ → hiển thị vùng và cảnh báo nguy hiểm có tọa độ → tải lại mỗi 30 giây → chọn đội/nhiệm vụ để xem đơn vị, người phụ trách, chuyên môn, vùng, số điện thoại, vị trí → bấm số điện thoại để mở cuộc gọi hoặc zoom tới đội. Đây là bản đồ chung; chưa có màn theo dõi riêng một SOS xuyên suốt. |
| C09 | Đọc cảnh báo gần mình/toàn quốc | Chọn Lân cận hoặc Toàn quốc → gửi GPS nếu có → backend lấy cảnh báo gắn vùng trong bán kính 20 km và cảnh báo không gắn vùng, hoặc chỉ cảnh báo không gắn vùng cho tab Toàn quốc → app loại category=teams → hiển thị cảnh báo còn hiệu lực theo ưu tiên. |
| C10 | Xác nhận cộng đồng | Mở cảnh báo → tải chi tiết → chọn Còn nguy hiểm/Tin giả/Vẫn nguy hiểm/Đã có cứu trợ → gửi AlertVote với user ID → backend chỉ cho một lượt mỗi người mỗi cảnh báo. Vote được lưu và đếm; chưa có logic tự đóng vùng hoặc xác minh tin dựa trên ngưỡng vote. |
| C11 | Hồ sơ cá nhân | Xem/chỉnh tên, SĐT, địa chỉ, CCCD, bệnh nền/ghi chú y tế, người liên hệ khẩn cấp → có thể lấy địa chỉ từ GPS → PUT CitizenProfile đồng thời cập nhật thông tin User → thông báo lưu thành công. |
| C12 | Đăng xuất | Xác nhận đăng xuất → xóa dữ liệu phiên khỏi AsyncStorage và bộ nhớ → quay về giao diện xác thực. |
| C13 | Ngoại tuyến | Có màn hình mô tả lưu SOS cục bộ, tự đồng bộ, mesh/blockchain → nút SOS chỉ hiện hộp thoại. Chưa thấy hàng đợi lưu SOS, phát hiện kết nối, gửi lại hay mạng mesh thực tế. |

Lưu ý khi gửi ảnh: tạo SOS và upload ảnh là hai lần gọi riêng. Nếu upload ảnh lỗi thì SOS có thể đã tồn tại dù màn hình báo lỗi gửi; chưa có cơ chế hoàn tác hoặc chống tạo trùng cho lần gửi lại ở luồng này.

Nguồn: `FE-app/src/navigation/CitizenStack.js`, `FE-app/src/screens/citizen`, các màn auth/citizen, `FE-app/src/context/AuthContext.js`, `FE-app/src/services`.

## 4. Chức năng cứu hộ trên app

| Mã | Chức năng | Luồng xử lý và kết quả |
|---|---|---|
| R01 | Đăng ký cứu hộ | Đi qua 3 bước: thông tin cá nhân → đơn vị/địa bàn/chuyên môn → mật khẩu và điều khoản → gửi đăng ký → backend tạo tài khoản RESCUER chưa kích hoạt, hồ sơ PENDING → chờ admin duyệt. |
| R02 | Đăng nhập | Nhập tài khoản/mật khẩu → backend kiểm tra đúng mật khẩu và is_active → báo chờ duyệt/bị khóa nếu tương ứng → app kiểm tra role RESCUER → lưu phiên → vào giao diện cứu hộ. |
| R03 | Dashboard điều hành | Tải thống kê, vùng, nhiệm vụ và nguồn lực → lọc vùng có nhiệm vụ của mình → đếm nhiệm vụ hoàn thành, cộng số nhân sự đã khai báo → xem gợi ý vùng và truy cập nhanh bản đồ/nhiệm vụ/lịch sử/khai báo nguồn lực. |
| R04 | Khai báo nguồn lực | Chọn phương tiện và số người → gửi Resource chứa rescuer, vehicle_type, number_staff, is_available=true → lưu. Mã lựa chọn loại hỗ trợ đã bị comment khỏi giao diện; dữ liệu supplies không còn trong model hiện tại. |
| R05 | Tìm vùng cần cứu hộ | Tải Zone và SOS → loại vùng RESOLVED và vùng không còn SOS cần xử lý → lấy GPS → tính khoảng cách → sắp xếp vùng gần nhất trước → xem mức nguy hiểm, SOS và thông tin vùng. |
| R06 | Xem chi tiết vùng | Chọn vùng → tải chi tiết Zone, SOS thuộc vùng và Mission thuộc vùng → xem ghi chú yêu cầu, số người, mức độ, đội tham gia → chuyển sang xác nhận tham gia. |
| R07 | Tự tham gia nhiệm vụ | Chọn vai trò Đội Y tế/Đội Cứu hộ/Đội Hậu cần → app kiểm tra vùng đủ đội và bản thân còn nhiệm vụ chưa hoàn tất hay không → tạo Mission ACTIVE → backend thử tính lại điểm vùng → vào màn đang thực hiện. Các giới hạn này chưa được bắt buộc tại API tạo nhiệm vụ. |
| R08 | Thực hiện và xử lý từng SOS | Mở vùng đang làm → tải SOS, các đội cùng vùng và chi tiết vùng → xem tiến độ = tỷ lệ SOS đã xử lý → đánh dấu từng SOS thành RESOLVED → tải lại dữ liệu. Đánh dấu SOS xong chưa tự hoàn thành Mission hoặc Zone. |
| R09 | Chia sẻ GPS/cảnh báo rời vùng | Trong vòng đời màn hình ActiveMission, xin quyền vị trí → mỗi 15 giây gửi GPS tới hồ sơ cứu hộ → nếu cách tâm vùng hơn 600 m thì hiện cảnh báo rời vùng. Chưa có dịch vụ theo dõi nền độc lập hay lưu toàn bộ lịch sử di chuyển. |
| R10 | Bản đồ cứu hộ | Lấy GPS, vùng, SOS còn hoạt động, cứu hộ khác và nhiệm vụ → chọn điểm để zoom → mở dẫn đường. Tham số lọc nhiệm vụ hiện gửi rescuer, trong khi backend đòi rescuer_id, nên có thể lấy nhiệm vụ người khác. |
| R11 | Dẫn đường | Nhận tọa độ đích → theo dõi GPS mỗi khi dịch chuyển khoảng 5 m → gửi điểm đầu/đích cho backend → A* trên đồ thị đường Đà Nẵng, tăng chi phí hoặc chặn đoạn gần nguy hiểm suy ra từ ghi chú SOS → trả đường, quãng đường, ETA → vẽ tuyến. ETA dựa trên vận tốc giả định 35 km/h. App còn điểm nguy hiểm giả lập; API lỗi thì vẽ đường thẳng tới đích. |
| R12 | Cập nhật trạng thái đội | Form cho chọn ON_MY_WAY/ACTIVE/COMPLETED/NEEDS_HELP → hiện đang gọi endpoint complete cho tất cả lựa chọn → backend luôn ghi COMPLETED. Luồng cập nhật hiện trường và yêu cầu chi viện từ màn này đang sai. |
| R13 | Rời/hủy nhiệm vụ | Chọn Rời khỏi nhiệm vụ → xác nhận → backend ghi Mission CANCELLED và completed_at → tính lại điểm vùng → quay về màn chính. SOS trong vùng vẫn giữ trạng thái riêng. |
| R14 | Nhận cảnh báo/yêu cầu chi viện | Tải Alerts và Mission NEEDS_HELP → lọc cảnh báo category system/teams, chia khẩn cấp/hệ thống, loại yêu cầu của chính mình → chọn nhận hỗ trợ → tạo Mission mới role=support tại cùng vùng. Nhánh này chưa có bước kiểm tra nhiệm vụ đang làm như nhánh tự tham gia. |
| R15 | Lịch sử nhiệm vụ | Lấy Mission theo rescuer_id → xem trạng thái, vùng, thời gian → có đường mở màn ActiveMission từ thẻ lịch sử. |
| R16 | Hồ sơ | Tải hồ sơ cứu hộ → xem và sửa họ tên, CCCD, đơn vị, cấp bậc, chuyên môn → PUT hồ sơ → quay lại. Lưu chuyên môn còn vấn đề mapping; xem mục 7. |
| R17 | Đăng xuất/ngoại tuyến | Đăng xuất xóa phiên như người dân. Màn ngoại tuyến hiện chứa số liệu/nhiệm vụ minh họa, nút thử lại dùng bộ đếm rồi báo mất kết nối; chưa có bản đồ ngoại tuyến hay đồng bộ nhiệm vụ. |

Nguồn: `FE-app/src/navigation/RescuerStack.js`, `FE-app/src/screens/rescuer`, auth/rescuer, `backend/reporting`, `backend/rescue_operations/pathfinding.py`.

## 5. Các luồng liên thông giữa ba actor

### 5.1. Cầu cứu từ app đến xử lý

1. Người dân đăng nhập và gửi SOS có GPS, nhu cầu, mô tả; ảnh tải sau.
2. Backend lưu SOS PENDING và thông tin liên hệ trong ghi chú.
3. Backend kích hoạt gom cụm: xét SOS PENDING/ACKNOWLEDGED chưa có vùng, gom gần nhau trong ngưỡng 300 m; gán vào vùng đang hoạt động/ổn định gần đó hoặc tạo vùng mới. Gom cụm hiện là thuật toán tham lam, không phải DBSCAN đầy đủ.
4. Admin thấy SOS/vùng trên web sau khi tải dữ liệu; cứu hộ thấy vùng còn SOS chưa xử lý trên app.
5. Cứu hộ tự tham gia, hoặc admin chấp nhận gợi ý để tạo Mission. Mission mới mặc định ACTIVE; không có bước “được giao nhưng chờ cứu hộ nhận” riêng.
6. Cứu hộ mở nhiệm vụ, chia sẻ GPS, dẫn đường, xem SOS và đánh dấu từng SOS RESOLVED.
7. Người dân tải lại lịch sử để xem trạng thái; admin xem chi tiết vùng và báo cáo.
8. Hoàn thành Mission là thao tác riêng; đổi Zone thành RESOLVED cũng là thao tác riêng. Chưa có máy trạng thái tự động đảm bảo SOS → Mission → Zone cùng kết thúc.

### 5.2. Từ tin ngoài hệ thống tới cảnh báo/cầu cứu

1. Admin chạy quét RSS báo chí hoặc Facebook; có tùy chọn tự quét khi trang còn mở.
2. Crawler lấy dữ liệu → loại trùng URL/hash/nội dung; Facebook thêm post ID.
3. Phân tích văn bản bằng PhoBERT nếu tải được, nếu không dùng quy tắc; nhận diện địa điểm/tọa độ. Facebook loại nhãn SPAM. Bài không xác định được địa điểm bị bỏ qua.
4. Lưu bài ANALYZED để admin kiểm tra. Pipeline hiện yêu cầu duyệt, không tự phát tin chỉ vì vượt ngưỡng tin cậy.
5. Duyệt bài báo → Alert nguồn AI. Duyệt Facebook → SOS không gắn tài khoản citizen hoặc liên kết SOS trùng đã có; SOS mới kích hoạt gom vùng.
6. Alert đi vào luồng đọc cảnh báo. SOS đi vào luồng điều phối cứu hộ. Từ chối chỉ đổi trạng thái bài và ghi lý do, không thấy tự xóa Alert/SOS đã tạo trước đó.

### 5.3. Phân công theo gợi ý

1. Xác định cứu hộ được kích hoạt, không có Mission ACTIVE/ON_MY_WAY.
2. Xác định vùng ACTIVE/STABILIZING có số nhiệm vụ ACTIVE/ON_MY_WAY thấp hơn rescuers_needed.
3. Chấm điểm cặp: khoảng cách 35% + chuyên môn 30% + điểm ưu tiên vùng 25% + thiếu hụt 10%.
4. Xếp điểm giảm dần, mỗi cứu hộ chỉ xuất hiện một gợi ý; admin xem và chấp nhận.
5. Tạo Mission → tính lại điểm ưu tiên vùng. Hiện thuật toán chưa giảm số chỗ thiếu của vùng sau mỗi gợi ý, nên danh sách có thể đề xuất nhiều đội hơn nhu cầu.

### 5.4. Yêu cầu chi viện

Luồng nghiệp vụ mà các màn hình đang hướng tới:

`Cứu hộ đặt NEEDS_HELP → admin/đội khác thấy yêu cầu → admin tăng nhu cầu và phát tin hoặc đội khác tham gia hỗ trợ → nhiệm vụ bổ sung được tạo`.

Luồng bị ngắt tại bước đầu do R12 gọi sai endpoint. Nếu dữ liệu NEEDS_HELP đã tồn tại từ một cách cập nhật khác, các màn admin/đội khác vẫn có logic đọc và xử lý nó.

### 5.5. Phát tin và xác nhận cộng đồng

`Admin tạo Alert toàn hệ thống/theo vùng → app lấy cảnh báo theo phạm vi/vị trí → người dân mở chi tiết → gửi một AlertVote → backend lưu lượt xác nhận`.

Chưa có push notification, gửi SMS, phát thanh âm thanh hay chat trong chuỗi này. Thông báo đang là bản ghi được app đọc qua API. Vote không tự đổi trạng thái SOS/Mission/Zone.

## 6. Trạng thái và cách tính AI

| Dữ liệu | Trạng thái định nghĩa |
|---|---|
| Hồ sơ cứu hộ | PENDING — chờ duyệt; ACTIVE — được duyệt; BANNED — bị khóa. Kèm cờ User.is_active. |
| SOS | PENDING; ACKNOWLEDGED; IN_PROGRESS; RESOLVED; CANCELLED. |
| Zone | ACTIVE; STABILIZING; RESOLVED; STANDBY. |
| Mission | ACTIVE; ON_MY_WAY; NEEDS_HELP; COMPLETED; CANCELLED. |
| Tin thu thập | Có RAW, ANALYZED, ALERT_CREATED, REJECTED; pipeline hiện lưu mới ở ANALYZED. ALERT_CREATED cũng được dùng cho Facebook đã tạo SOS. |

Định nghĩa trạng thái không có nghĩa mọi chuyển trạng thái đã được triển khai. Ví dụ nhận Mission không tự đưa SOS qua ACKNOWLEDGED/IN_PROGRESS; hoàn thành SOS không tự đóng vùng.

Điểm ưu tiên vùng 0–100 là tổng có trọng số: số SOS 25, số người 30, mức nguy hiểm 20, thời gian chờ 15 và thiếu cứu hộ 10; có chuẩn hóa từng thành phần. Đây là tính điểm theo công thức, tách biệt mô hình PhoBERT phân loại văn bản.

Tạo SOS hiện chỉ gọi gom cụm, không gọi tính điểm ngay. API `/ai/run/` chạy cả gom cụm và tính điểm; `/ai/score/` tính lại điểm; tạo/hoàn thành/rời Mission và xóa SOS có nhánh kích hoạt tính điểm. Chưa thấy nút trong web gọi `runPipeline` dù service đã định nghĩa.

## 7. Những điểm cần mô tả đúng khi báo cáo/demo

| Điểm | Hiện trạng và ảnh hưởng | Nguồn |
|---|---|---|
| Cập nhật trạng thái nhiệm vụ | App gọi complete với lựa chọn bất kỳ; backend bỏ qua status gửi lên và luôn ghi COMPLETED. | `FE-app/src/screens/rescuer/missions/StatusUpdateScreen.js:101`, `backend/reporting/views.py` |
| Phân quyền chưa hoàn chỉnh | Web chưa bọc route bảo vệ; nhiều API chưa có kiểm tra ADMIN/chủ sở hữu. Settings hiện không có cấu hình REST_FRAMEWORK/JWTAuthentication dù login phát JWT và frontend gửi Bearer. Không nên mô tả là đã phân quyền đầy đủ chỉ vì tách màn hình theo role. | `FE-web/src/App.tsx`, `backend/sentinel/settings.py`, các views |
| Citizen login | Gán cứng vai trò CITIZEN, không kiểm tra role như màn cứu hộ; có nút demo dùng ID/token giả. | `FE-app/src/screens/auth/citizen/CitizenLoginScreen.js` |
| Component thống kê citizen chưa nối vào màn chính | Có DashboardStatsCard và hook, nhưng không thấy được dùng trong HomeScreen hiện tại. Service riêng dùng API.get không tồn tại và endpoint `/rescue/dashboard/` không khớp `/rescue_operations/dashboard/`; không nên liệt kê là chức năng thống kê citizen đã hoàn thiện. | `FE-app/src/services/dashboardApi.js`, `FE-app/src/hooks/useDashboardStats.js`, `FE-app/src/screens/citizen/home/HomeScreen.js` |
| Gộp/tách vùng | Nút xác nhận chỉ hiện alert “Zones updated”, không gọi API thay đổi dữ liệu. | `FE-web/src/pages/RescueZoneManagement/index.tsx` |
| Phát riêng cho một đội | selectedId của đội không có trong payload; category=teams chỉ dùng phân loại giao diện. Chưa có người nhận cụ thể trong Alert. | `FE-web/src/pages/NotificationBroadcast/index.tsx`, `backend/communications/models.py` |
| Cảnh báo cứu hộ theo vùng | Màn cứu hộ không gửi GPS khi lấy cảnh báo; backend mặc định nearby, phụ thuộc xác thực/địa chỉ nếu thiếu GPS. Giao diện còn loại category khác system/teams nên không phải mọi tin AI đều được hiển thị. | `FE-app/src/screens/rescuer/alerts/RescuerAlertsScreen.js`, `backend/communications/views.py` |
| Cảnh báo “toàn quốc” | Backend coi zone=null là toàn quốc. Tin báo chí được duyệt hiện không gán Zone dù có tọa độ, nên cũng thuộc nhóm này. | `backend/ai/views.py`, `backend/communications/views.py` |
| Chuyên môn cứu hộ | Đăng ký gửi chuỗi nhiều lựa chọn, model kỳ vọng một mã chuyên môn. Serializer cập nhật specialty lại trỏ get_specialty_display; sửa chuyên môn có thể không lưu đúng vào trường specialty. Điều này ảnh hưởng gợi ý phân công. | auth/rescuer/RescuerRegisterScreen, `backend/accounts/models.py`, `backend/accounts/serializers.py` |
| Gợi ý “cho tôi” | Dashboard cứu hộ tìm đề xuất của mình trong top 3, nhưng nếu không có thì lấy recs[0], có thể là đề xuất cho người khác. | `FE-app/src/screens/rescuer/dashboard/DashboardScreen.js` |
| Nhiệm vụ trên bản đồ cứu hộ | Gửi rescuer thay vì rescuer_id; backend không lọc theo tham số này, rồi app lấy phần tử đầu. | `FE-app/src/screens/rescuer/map/RescuerMapScreen.js:60`, `backend/reporting/views.py` |
| Tính nhân lực chưa thống nhất | rescuers_needed đôi nơi gọi là số người, nơi khác số đội; điều phối đếm Mission, chưa dùng number_staff để quy đổi sức chứa. Gợi ý không kiểm tra is_on_duty hoặc Resource.is_available, và chưa coi NEEDS_HELP là đang bận. | `backend/ai/assignment_recommender.py`, `backend/ai/priority_scorer.py` |
| Cộng dồn người trong vùng | Gán thêm cụm vào vùng cũ dùng max(số cũ, số cụm mới), không cộng lại toàn bộ SOS thuộc vùng; nhu cầu nhân lực cũng không tính lại trong nhánh này. | `backend/ai/clustering.py` |
| Điểm ưu tiên có thể cũ | Không tự cập nhật theo thời gian, không chạy chấm điểm khi chỉ tạo SOS/gom vùng hoặc sửa trạng thái SOS thông thường. | `backend/rescue_operations/views.py`, `backend/ai/clustering.py` |
| GPS và ngưỡng vùng | Web suy ra vùng gần trong 5 km, app cảnh báo quá 600 m, gom cụm dùng 300 m; đó là ba ngưỡng khác nhau. Không có lịch sử GPS bền vững; tracking app hiện trống. | FollowTheRescueTeam, ActiveMissionScreen, `backend/tracking/models.py` |
| Dẫn đường | Đồ thị hiện là Đà Nẵng; điểm nguy hiểm ở app có giả lập; lỗi API vẽ đường thẳng. Chưa phải định tuyến an toàn đầy đủ mọi địa phương. | MissionNavScreen, `backend/rescue_operations/pathfinding.py` |
| Offline/mesh/blockchain | Các thông báo và dữ liệu minh họa không có triển khai lưu SOS/đồng bộ/mesh/blockchain tương ứng. Có chuỗi hash tạo giả trong mã lịch sử. | hai màn Offline, HistoryScreen |
| Chỉ số minh họa/sai ngữ nghĩa | Xác nhận SOS cố định 87%; ActiveMission đếm ngược từ 42:15; dashboard admin “hoàn thành hôm nay” thực tế đếm mọi Mission COMPLETED, hôm qua cố định 0; vote_count là số nhưng web đọc như object upvotes/downvotes. | SOSConfirmScreen, ActiveMissionScreen, web Dashboard |
| Trang phụ chưa hoàn thiện | RegionStatus route không có id trong khi component cần id và thiếu return giao diện chính; DetailReport có nút tạo báo cáo chỉ hiện thông báo. | `FE-web/src/App.tsx`, RegionStatus, DetailReport |

## 8. Cách trình bày phạm vi sản phẩm

Các nhóm chức năng đã có đường xử lý chính: đăng ký/đăng nhập, duyệt tài khoản, gửi SOS GPS/ảnh, gom vùng, quản lý vùng, tham gia/phân công nhiệm vụ, xử lý từng SOS, bản đồ và vị trí hiện tại, cảnh báo/xác nhận cộng đồng, thu thập và duyệt tin, khai báo phương tiện/nhân sự, hồ sơ và xuất thống kê.

Các nhóm cần ghi rõ chưa hoàn chỉnh: chuyển trạng thái hiện trường/chi viện từ app, liên thông đóng SOS–Mission–Zone, phân quyền API, định tuyến ngoài phạm vi dữ liệu, gộp/tách vùng, gửi riêng từng đội, offline/mesh/blockchain, thống kê và một số gợi ý cá nhân hóa.
