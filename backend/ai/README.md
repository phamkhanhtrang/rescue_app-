# 🧠 Tài liệu Kiến trúc Module AI (Guardian Pulse)

Thư mục `backend/ai/` là trái tim của hệ thống **Guardian Pulse**, chịu trách nhiệm cho mọi tác vụ tự động hóa, xử lý ngôn ngữ tự nhiên (NLP) và ra quyết định thông minh.

Dưới đây là mô tả chi tiết nhiệm vụ và ý nghĩa của từng file, thư mục bên trong.

---

## 📁 1. Các file cấu trúc Django cốt lõi
*Nhóm này đóng vai trò giao tiếp giữa module AI với toàn bộ hệ thống Web/App.*

- **`models.py`**: Định nghĩa cấu trúc cơ sở dữ liệu (Database Schema) cho phần AI. Ví dụ: Bảng lưu trữ bài viết đã cào về (`CrawledArticle`), bảng lưu lịch sử dự đoán của mô hình, hoặc thông số cấu hình AI.
- **`views.py`**: Chứa các API Endpoints (Controller) để Frontend (Web/App) gọi lên. Ví dụ: API kích hoạt cào dữ liệu, API gom cụm bản đồ, API lấy gợi ý phân công.
- **`urls.py`**: Định tuyến các đường dẫn (Routes) kết nối API từ `views.py` ra ngoài (vd: `/api/ai/trigger-crawl/`).
- **`__init__.py`**: File bắt buộc để Python hiểu thư mục `ai` là một package.

---

## ⚙️ 2. Nhóm Thuật toán Điều phối & Xử lý (Core Algorithms)
*Nhóm này chứa các logic tính toán thông minh trên dữ liệu đã có.*

- **`clustering.py`**: Gom cụm bằng DBSCAN (scikit-learn, khoảng cách Haversine, bán kính 300m). Nó lấy các điểm SOS rời rạc trên bản đồ và gom những điểm gần nhau lại thành một **Vùng sự cố (Zone)** lớn, giúp Admin không bị rối mắt.
- **`priority_scorer.py`**: Thuật toán chấm điểm ưu tiên cho một Zone. Dựa vào các chỉ số: Số người bị nạn, từ khóa khẩn cấp, độ nghiêm trọng... để tính ra một con số từ 0 đến 100. Điểm càng cao, Zone hiển thị càng đỏ để ưu tiên cứu trước.
- **`assignment_recommender.py`**: Thuật toán gợi ý đội cứu hộ. Tính điểm phù hợp từ khoảng cách (Haversine), chuyên môn, ưu tiên zone, rồi ghép cặp tối ưu bằng thuật toán Hungarian; nó sẽ trả về danh sách các Cứu hộ viên phù hợp nhất cho Admin giao việc.
- **`crawler_pipeline.py`**: Đóng vai trò là "Tổng tư lệnh" (Orchestrator). Nó quy định quy trình chuẩn: Gọi Crawler chạy -> Đẩy text qua NLP xử lý -> Gọi Geocoder lấy tọa độ -> Lưu vào Database.

---

## 🕸️ 3. Thư mục `crawlers/` (Thu thập dữ liệu)
*Chịu trách nhiệm đi vòng quanh Internet để gom thông tin về.*

- **`base_crawler.py`**: Class nền tảng (Abstract/Base class). Định nghĩa các hàm chuẩn mà mọi crawler đều phải có (vd: `fetch()`, `parse()`), giúp code đồng nhất.
- **`fb_playwright_crawler.py`**: (Đặc vụ hạng nặng) Dùng thư viện Playwright để giả lập trình duyệt y như người thật. Vượt qua lớp bảo vệ của Facebook để cuộn trang, cào dữ liệu từ các hội nhóm kín/mở.
- **`fb_crawler.py`**: (Đặc vụ hạng nhẹ) Crawler Facebook thông thường (có thể dùng request cơ bản hoặc Graph API cũ), tốc độ nhanh nhưng dễ bị chặn hơn Playwright.
- **`rss_crawler.py`**: Cào tin tức thời tiết, cảnh báo thiên tai từ các trang báo chính thống thông qua công nghệ RSS Feeds (VnExpress, cơ quan khí tượng...).
- **`fb_session_cookies.json`**: File lưu trữ "phiên đăng nhập" (Cookies) của Facebook. Giúp `fb_playwright_crawler.py` không cần phải đăng nhập lại từ đầu mỗi khi chạy, tránh bị checkpoint/khóa acc.

---

## 📝 4. Thư mục `nlp/` (Xử lý Ngôn ngữ Tự nhiên & Không gian)
*Chịu trách nhiệm "đọc hiểu" đống dữ liệu văn bản rác mà Crawler mang về.*

- **`phobert_analyzer.py`**: PhoBERT v1 (6 nhãn). Model cũ, mặc định không chạy; chỉ còn dùng làm baseline so sánh (`AI_LEGACY_PHOBERT_V1`, `ai_evaluate --with-v1`).
- **`text_analyzer.py`**: Luật từ khóa cho nhánh tin tức: phân loại loại sự cố, mức độ và điểm tin cậy của bài báo.
- **`event_matcher.py`**: Gộp trùng theo sự kiện: nhận ra bài Facebook và SOS đã có là của cùng một hộ (cùng số điện thoại, cùng vị trí, nội dung tương tự).
- **`geocoder.py`**: Chuyển chữ thành số. Nó quét văn bản tìm tên địa danh (vd: "Tôn Đức Thắng, Liên Chiểu"), sau đó đẩy lên API (như Nominatim/Google) để lấy về tọa độ GPS (Vĩ độ, Kinh độ) gắn lên bản đồ.
- **`deduplicator.py`**: Thuật toán chống trùng lặp dữ liệu. Nếu nhiều người cùng share 1 bài viết SOS trên Facebook, file này sẽ dùng thuật toán so sánh độ giống nhau (Text Similarity) để gộp chúng lại, tránh tạo ra 10 cái SOS giống nhau.
- **📁 `sos_phobert_model/`**: Thư mục chứa các tệp trọng số (weights) của mô hình PhoBERT đã được nhóm huấn luyện.

---

## 🔁 5. Luồng xử lý SOS và công cụ đánh giá

- **`sos_pipeline.py`** + **`background.py`**: sau khi SOS được lưu, chạy nền chuỗi gom cụm → chấm điểm → đọc ghi chú. Người gửi không phải chờ.
- **`sos_note_analysis.py`**: Model A/B đọc ghi chú của SOS từ app. Chỉ bổ sung thông tin và gắn cờ cho admin, không loại bỏ SOS.
- **`sos_article_analysis.py`**: Model A/B cho bài Facebook, xếp mức khẩn để sắp hàng đợi duyệt.
- **`evaluation.py`** (`python manage.py ai_evaluate`): đo Model A/B, so với luật từ khóa, TF-IDF + Logistic Regression, PhoBERT v1; thống kê luật guardrails can thiệp bao nhiêu lần.
- **`dataset_export.py`** (`python manage.py ai_export_reviewed`): xuất các bài admin đã duyệt thành Excel dữ liệu thực (tập test thực + dòng train để học tiếp).
- **`python manage.py ai_priority_sensitivity`**: kiểm tra thứ hạng ưu tiên Zone ổn định thế nào khi trọng số thay đổi.
- **`reports/`**: kết quả do ba lệnh trên sinh ra.

---

## 🔬 6. File Nghiên cứu & Huấn luyện (Research)

- **`training/`**: Hai notebook Colab độc lập và hai Excel riêng cho model A (yêu cầu/nhu cầu) và B (trích xuất thông tin). Bắt đầu từ `training/README.md`.
- **`sos_ml/`**: Code tiền xử lý, kiến trúc, nạp model và kiểm thử dùng chung với notebook; không cần upload thư mục này lên Colab.

---
*Tài liệu này được tạo ra để giúp các thành viên và giám khảo dễ dàng nắm bắt cấu trúc của bộ não AI trong Guardian Pulse.*
