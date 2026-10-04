# Tích hợp PhoBERT SOS Classifier vào Hệ thống Cứu hộ

Tài liệu này mô tả chi tiết quá trình nâng cấp hệ thống nhận diện và phân loại tin tức cứu hộ (SOS Crawler) từ phương pháp dựa trên luật (Rule-based) sang trí tuệ nhân tạo (AI NLP) thực thụ, sử dụng mô hình ngôn ngữ **PhoBERT** đã được fine-tune trên tập dữ liệu SOS tiếng Việt.

---

## 1. Mục tiêu tích hợp
- Loại bỏ sự phụ thuộc vào từ khóa tĩnh (Regex, Keyword matching) vốn có độ chính xác thấp và dễ bị bypass bởi tin giả, tin rác (SPAM).
- Sử dụng mô hình PhoBERT (thuộc họ BERT, được train riêng cho tiếng Việt) để hiểu ngữ nghĩa câu, văn cảnh.
- Phân loại bài đăng thành 6 nhãn chuyên sâu: `RESCUE` (Cứu hộ), `MEDICAL` (Y tế), `EVACUATION` (Sơ tán), `SUPPLY` (Nhu yếu phẩm), `INFO` (Tin tức/Cảnh báo), và `SPAM` (Rác/Bán hàng).
- Trích xuất điểm tin cậy (Confidence Score) cho từng quyết định của AI.

---

## 2. Các thay đổi về cấu trúc kỹ thuật (Backend)

### 2.1. Module Inference chuyên dụng (`backend/ai/nlp/phobert_analyzer.py`)
- **Tạo mới module Inference:** Sử dụng thư viện `torch` và `transformers` để load mô hình PhoBERT.
- **Pattern Singleton & Lazy Loading:** Vì mô hình PhoBERT khá nặng (~1.5GB VRAM/RAM), hệ thống được thiết kế để chỉ load model vào bộ nhớ ở lần phân tích đầu tiên. Các Request tiếp theo sẽ dùng lại model đã load, giúp tăng tốc độ phản hồi từ hàng chục giây xuống chỉ còn vài chục mili-giây.
- **Label Mapping:** Ánh xạ 6 nhãn đầu ra của PhoBERT thành các cấp độ `severity` (CRITICAL, HIGH, MEDIUM, LOW) và tên loại sự cố của hệ thống Guardian Pulse để tương thích ngược với Database cũ.

### 2.2. Cơ chế Fallback Thông minh (`backend/ai/nlp/text_analyzer.py`)
- **Nâng cấp `analyze()`:** Sửa đổi logic của hàm phân tích cũ. Giờ đây, khi có bài báo mới được cào về, pipeline sẽ gọi thẳng vào PhoBERT.
- **Tính năng Fallback (Dự phòng rủi ro):** Nếu server chưa kịp cài đặt `torch` hoặc không tìm thấy thư mục chứa model, hệ thống sẽ log một cảnh báo (`Warning`) và **tự động chuyển về dùng thuật toán Rule-based cũ**. Nhờ vậy, tiến trình crawl tin tức của hệ thống không bao giờ bị sập (crash) vì lỗi AI.

### 2.3. Mở rộng API (`backend/ai/views.py` & `urls.py`)
- Mở một endpoint mới: `POST /ai/classify/`
- Chức năng: Nhận đầu vào là một chuỗi văn bản (text), trả về kết quả JSON chi tiết bao gồm nhãn dán, độ tin cậy và mảng điểm xác suất (all scores) cho toàn bộ 6 nhãn. Phục vụ cho việc test model realtime từ Front-end.

---

## 3. Các thay đổi về Giao diện (Frontend)

### 3.1. Dịch vụ API (`FE-web/src/services/api.ts`)
- Khai báo hàm `classifyText` để gọi tới endpoint mới trên backend.

### 3.2. Bảng Thử nghiệm AI Trực tiếp (PhoBERT Test Panel)
- Tại trang quản lý **AI Thu Thập Tin Tức (AICrawler)**, thêm một vùng giao diện (Panel) mang phong cách AI / Không gian mạng ở ngay dưới phần bộ lọc.
- **Tính năng:** 
  - Ô text để Admin nhập một câu hoặc một đoạn văn bản SOS bất kỳ.
  - Nút "Phân tích" gọi API Realtime.
  - Khu vực kết quả hiển thị rực rỡ với:
    - **Nhãn phân loại (Label):** Kèm Emoji sinh động (🚨, 🏥, 🚁, 📦...).
    - **Độ nghiêm trọng (Severity):** Mức độ cảnh báo (CRITICAL, HIGH...).
    - **Độ tin cậy (Confidence):** % AI chắc chắn về phán đoán của mình.
    - **Thanh tiến trình (Progress Bar):** Trực quan hóa điểm số của tất cả các nhãn khác để Admin thấy được quá trình mô hình "phân vân" như thế nào giữa các lựa chọn.

---

## 4. Hướng dẫn Triển khai (Deploy)

Để hệ thống hoạt động với sức mạnh cao nhất (dùng PhoBERT thay vì Rule-based), môi trường Backend cần được thiết lập như sau:

**Bước 1: Cài đặt thư viện ML/AI**
```bash
pip install torch transformers numpy
```

**Bước 2: Chuẩn bị Model**
- Tải toàn bộ thư mục model PhoBERT đã được train (trong Notebook trên Google Drive, thư mục `saved_sos_phobert`).
- Copy và đặt vào bên trong mã nguồn Backend theo cấu trúc:
  ```
  backend/
    ├── ai/
    │    └── nlp/
    │         └── sos_phobert_model/
    │              ├── config.json
    │              ├── model.safetensors (hoặc pytorch_model.bin)
    │              ├── tokenizer_config.json
    │              └── ...
  ```

**Bước 3: Chạy hệ thống**
- Khởi động lại Django Server (`python manage.py runserver`).
- Truy cập Web Admin -> Mở trang AI Crawler -> Gõ thử văn bản vào ô "Thử nghiệm PhoBERT" và nhấn Phân tích để kiểm tra trạng thái kích hoạt của AI.
