# BÁO CÁO CHI TIẾT CÁC CHỨC NĂNG AI - GUARDIAN PULSE

> **Dự án:** Guardian Pulse - Hệ thống điều phối cứu hộ thiên tai
> **Ngày:** 26/05/2026 · cập nhật 16/11/2026 (luồng Model A/B, DBSCAN, Hungarian, đánh giá)

---

## MỤC LỤC

1. [Tổng quan kiến trúc AI](#1-tổng-quan-kiến-trúc-ai)
2. [Module 1: PhoBERT SOS Classifier](#2-phobert-sos-classifier)
3. [Module 2: NLP Text Analyzer (Rule-based Fallback)](#3-nlp-text-analyzer)
4. [Module 3: Crawler Pipeline - Thu thập dữ liệu tự động](#4-crawler-pipeline)
5. [Module 4: Deduplicator - Lọc trùng lặp](#5-deduplicator)
6. [Module 5: Geocoder - Xác định vị trí địa lý](#6-geocoder)
7. [Module 6: SOS Clustering - Gom cụm SOS tự động](#7-sos-clustering)
8. [Module 7: Priority Scorer - Chấm điểm ưu tiên Zone](#8-priority-scorer)
9. [Module 8: Assignment Recommender - Gợi ý phân công](#9-assignment-recommender)
10. [API Endpoints](#10-api-endpoints)
11. [Kết quả & Đánh giá](#11-kết-quả-đánh-giá)

---

## 1. Tổng quan kiến trúc AI

### 1.1 Sơ đồ kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                   DỮ LIỆU ĐẦU VÀO                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐ │
│  │ RSS Feed │  │ Facebook │  │ SOS Signal│  │ Người   │ │
│  │ (Báo VN) │  │ Groups   │  │ (App)     │  │ dùng    │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └────┬────┘ │
└───────┼──────────────┼──────────────┼─────────────┼──────┘
        │              │              │             │
        ▼              ▼              │             │
┌───────────────────────────┐         │             │
│    CRAWLER PIPELINE       │         │             │
│  ┌─────────────────────┐  │         │             │
│  │ 1. Crawl (RSS/FB)   │  │         │             │
│  │ 2. Deduplicator     │  │         │             │
│  │ 3. NLP Analyzer     │  │         │             │
│  │ 4. Geocoder         │  │         │             │
│  │ 5. Save to DB       │  │         │             │
│  └─────────────────────┘  │         │             │
└───────────┬───────────────┘         │             │
            │                         │             │
            ▼                         ▼             ▼
┌─────────────────────────────────────────────────────────┐
│                  XỬ LÝ AI CORE                           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  PhoBERT SOS │  │  Clustering  │  │ Priority       │ │
│  │  Classifier  │  │  (DBSCAN)    │  │ Scorer         │ │
│  └──────────────┘  └──────────────┘  └────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Assignment Recommender                    │   │
│  │    (Greedy Matching: Rescuer ↔ Zone)              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Công nghệ sử dụng

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Deep Learning** | PhoBERT Model A + Model B (vinai/phobert-base-v2) | A: nhận diện yêu cầu cứu trợ + nhu cầu. B: trích xuất địa điểm, số người, người yếu thế, vật tư |
| **Guardrails** | Regex (`sos_ml/hybrid_guardrails.py`) | Kiểm tra lại kết quả Model A/B, ghi rõ nguồn quyết định |
| **NLP Rule-based** | Regex + Keyword matching | Phân loại tin báo chí (nhánh tin tức) |
| **Model cũ** | PhoBERT v1 6 nhãn (vinai/phobert-base) | Chỉ còn làm baseline so sánh, mặc định không chạy |
| **Clustering** | DBSCAN (scikit-learn, Haversine) | Gom cụm SOS theo GPS |
| **Scoring** | Weighted Multi-factor (Log scaling) | Chấm điểm ưu tiên Zone |
| **Matching** | Hungarian (scipy `linear_sum_assignment`) | Phân công Rescuer tối ưu toàn cục |
| **Crawling** | feedparser (RSS) + Facebook Graph API v18.0 | Thu thập tin thiên tai |
| **Deduplication** | MD5 Hash + SequenceMatcher (difflib) | Lọc tin trùng lặp |
| **Geocoding** | Từ điển offline 63 tỉnh/thành + Nominatim API | Xác định vị trí |
| **Framework** | Django + DRF | Backend API |

---

## 2. PhoBERT SOS Classifier (v1, model cũ)

> **Trạng thái:** model 6 nhãn này không chạy trong luồng chính. Tin cầu cứu đi qua
> Model A/B (mục 2A); tin báo chí dùng luật từ khóa (mục 3). Model v1 chỉ được nạp khi bật
> `AI_LEGACY_PHOBERT_V1=True` hoặc khi chạy `ai_evaluate --with-v1` để so sánh.

### 2.1 Mô tả bài toán
Phân loại văn bản SOS tiếng Việt thành **6 nhãn** chuyên biệt cho tình huống cứu hộ thiên tai.

### 2.2 Mô hình

- **Base model:** `vinai/phobert-base` (RobertaForSequenceClassification)
- **Kiến trúc:** Transformer Encoder (12 layers, 12 attention heads, hidden_size=768)
- **Vocab size:** 64,001 tokens
- **Max sequence length:** 256 tokens
- **Model size:** ~540MB (model.safetensors)
- **Problem type:** Single-label classification

### 2.3 Nhãn phân loại (6 classes)

| ID | Nhãn | Ý nghĩa | Severity | Ví dụ |
|---|---|---|---|---|
| 0 | EVACUATION | Sơ tán khẩn cấp | HIGH | "Cần sơ tán dân khỏi khu vực lũ" |
| 1 | INFO | Thông tin cảnh báo | LOW | "Cảnh báo đường vào Tam Kỳ bị ngập" |
| 2 | MEDICAL | Y tế khẩn cấp | HIGH | "Cần thuốc cho bà cụ bệnh tim" |
| 3 | RESCUE | Cứu hộ khẩn cấp | CRITICAL | "3 người mắc kẹt trên mái nhà cần thuyền" |
| 4 | SPAM | Không phải SOS | LOW | "Bán áo mưa giá rẻ mùa lũ" |
| 5 | SUPPLY | Nhu yếu phẩm | MEDIUM | "Xóm em thiếu nước uống và mì tôm" |

### 2.4 Dữ liệu huấn luyện

**Nguồn:** Dataset giả lập (synthetic) được tạo từ templates tiếng Việt, mô phỏng ngữ cảnh thực tế mùa lũ miền Trung.

| Thông số | Giá trị |
|---|---|
| Tổng số mẫu | 620 |
| Tập train | 496 (80%) |
| Tập test | 124 (20%) |
| Stratified split | Có (đảm bảo tỷ lệ nhãn) |
| Random seed | 42 |

**Phân bố nhãn:**

| Nhãn | Số mẫu |
|---|---|
| RESCUE | 120 |
| MEDICAL | 100 |
| SUPPLY | 100 |
| EVACUATION | 100 |
| INFO | 100 |
| SPAM | 100 |

**Đặc điểm dữ liệu:**
- Hỗ trợ cả **tiếng Việt có dấu** và **không dấu** (Telex/VNI)
- Mô phỏng viết tắt đời thường: "ko" → "không", "ng" → "người"
- Địa danh miền Trung: Tam Kỳ, Hội An, Đà Nẵng, Quảng Nam...
- Số điện thoại Việt Nam thực tế (10 số, đầu 0xx)

### 2.5 Quá trình Training

**Hyperparameters:**

| Tham số | Giá trị |
|---|---|
| Learning rate | 2e-5 |
| Batch size (train/eval) | 8 |
| Epochs | 3 |
| Weight decay | 0.01 |
| Optimizer | AdamW |
| Best model metric | F1 Macro |
| Load best model at end | True |

**Môi trường:** Google Colab (GPU CUDA)

### 2.6 Inference Pipeline

```python
# Singleton Lazy Loading Pattern
text → Tokenizer (max_length=256, padding, truncation)
     → PhoBERT Model (eval mode, no_grad)
     → Softmax → argmax → Predicted Label + Confidence
     → Map to (incident_type, severity)
```

**Tối ưu hiệu năng:**
- Model chỉ load **1 lần** vào RAM/VRAM (Singleton pattern)
- Hỗ trợ cả **single inference** và **batch inference**
- Tự động phát hiện GPU (CUDA) hoặc CPU
- Fallback thông minh: nếu model/torch chưa cài → dùng rule-based

### 2.7 Tích hợp hệ thống

File: `backend/ai/nlp/phobert_analyzer.py`

- Hàm `classify(text)` → trả về `PhoBERTResult`
- Hàm `classify_batch(texts)` → batch inference
- Hàm `is_available()` → kiểm tra model sẵn sàng

---

## 2A. Model A/B (luồng chính cho tin cầu cứu)

Code: `backend/ai/sos_ml/`, trọng số: `backend/ai/nlp/sos_two_model_v1/`, huấn luyện: `backend/ai/training/`.

| Model | Kiến trúc | Đầu ra |
|---|---|---|
| A | PhoBERT-base-v2 + 2 đầu phân loại (1 encoder dùng chung) | `is_request` và đa nhãn nhu cầu RESCUE / MEDICAL / EVACUATION / SUPPLY |
| B | PhoBERT-base-v2 token classification (BIO) | Cụm LOCATION, PEOPLE_COUNT, VULNERABLE_GROUP, RESOURCE |

Sau hai model là lớp luật `hybrid_guardrails.py`: ép thành yêu cầu khi có dấu hiệu nguy hiểm
tính mạng, chặn tin quyên góp/bán hàng/thời tiết, và sửa/bổ sung thực thể. Mỗi kết quả ghi
`decision_source` (MODEL / RULE_FALLBACK / RULE_FILTER) cùng dự đoán gốc của model.

**Nơi sử dụng:**

| Nguồn | Cách dùng |
|---|---|
| Bài Facebook | Phân tích khi crawl → admin sửa và duyệt → tạo SOS |
| Ghi chú SOS từ app | Chạy nền sau khi SOS đã lưu. Chỉ bổ sung thông tin và gắn cờ (lệch loại, lệch số người, có người yếu thế); **không** loại bỏ hay hạ ưu tiên SOS |
| Trang test của admin | `POST /ai/analyze-sos/` |

**Dữ liệu:** Model A train trên 1.001 câu (960 tổng hợp + 41 thực), Model B trên 1.051 câu
(1.032 tổng hợp + 19 thực); Validation 176 và Test 160 câu đều là câu tổng hợp theo mẫu.
Xem kết quả và giới hạn ở mục 11.

---

## 3. NLP Text Analyzer (luật từ khóa cho nhánh tin tức)

### 3.1 Mô tả
Phân tích bài báo (RSS) bằng keyword matching để lấy loại sự cố, mức độ và điểm tin cậy. Bài báo là tin cảnh báo chứ không phải lời cầu cứu nên không cần model phân loại SOS.

File: `backend/ai/nlp/text_analyzer.py`

### 3.2 Chiến lược

```
Bài báo → Rule-based → AnalysisResult (method='rule_based')
          (PhoBERT v1 chỉ chạy khi bật AI_LEGACY_PHOBERT_V1)
```

### 3.3 Rule-based: Phân loại sự cố

12 loại sự cố được nhận diện qua từ khóa (Việt + Anh):

| Loại sự cố | Từ khóa chính |
|---|---|
| Lũ lụt | lũ, lụt, ngập, nước dâng, vỡ đê |
| Bão | bão, áp thấp nhiệt đới, siêu bão |
| Sạt lở | sạt lở, đất đá, núi lở |
| Cứu hộ khẩn cấp | cứu, mắc kẹt, sos, ngập sâu |
| Y tế khẩn cấp | dịch bệnh, y tế, epidemic |
| ... | (tổng 12 danh mục) |

### 3.4 Rule-based: Chấm điểm Severity

4 mức: CRITICAL → HIGH → MEDIUM → LOW, dựa trên từ khóa mức độ nghiêm trọng.

### 3.5 Rule-based: Confidence Score

```
Base = 0.40
+ 0.20 nếu xác định được loại sự cố
+ 0.20 nếu severity = CRITICAL/HIGH (hoặc +0.10 nếu MEDIUM)
+ 0.05 × (số booster keyword: "xác nhận", "chính thức"...)
- 0.05 × (số dampener keyword: "có thể", "dự báo"...)
→ Clamp [0.0, 1.0]
```

---

## 4. Crawler Pipeline - Thu thập dữ liệu tự động

### 4.1 Kiến trúc Crawler

File: `backend/ai/crawler_pipeline.py`, `backend/ai/crawlers/`

```
BaseCrawler (Abstract)
├── RSSCrawler       → Báo chí Việt Nam (VnExpress, Tuổi Trẻ, Thanh Niên)
└── FacebookSOSCrawler → Nhóm Facebook cộng đồng
```

### 4.2 RSS Crawler

**Nguồn RSS (miễn phí, không cần API key):**

| Nguồn | Feed URLs |
|---|---|
| VnExpress | Tin tối, Thời sự, Xã hội |
| Tuổi Trẻ | Thời sự |
| Thanh Niên | Thời sự |

**Quy trình:** Đọc RSS → Lọc bài liên quan thiên tai (30+ từ khóa Việt/Anh) → Tạo CrawledItem

### 4.3 Facebook SOS Crawler

**API:** Facebook Graph API v18.0

**Quy trình lọc SOS:**
1. **Mandatory keywords** (23 từ khóa): sos, cứu, mắc kẹt, ngập, chìm...
2. **Trích xuất địa chỉ** qua regex patterns
3. **Trích xuất số người** cần cứu
4. **Trích xuất SĐT** liên hệ
5. **Tính pre-confidence** (0.3 base + bonus theo thông tin có được)

### 4.4 Pipeline tổng hợp

```
[Crawlers] → CrawledItem list
    ↓
[Deduplicator] → Loại bài trùng (URL/hash/similarity)
    ↓
[NLP Analyzer] → Trích xuất incident_type, severity, confidence
    ↓
[Geocoder] → Tên địa danh → GPS (lat, lng)
    ↓
[Filter] → CHỈ giữ bài có nhắc tỉnh/thành Việt Nam
    ↓
[Save to DB] → CrawledArticle (status='ANALYZED')
    ↓
[Admin Review] → Duyệt thủ công → Tạo Alert
```

**Lưu ý:** Hệ thống **BẮT BUỘC** qua Admin duyệt, không tạo Alert tự động.

---

## 5. Deduplicator - Lọc trùng lặp

File: `backend/ai/nlp/deduplicator.py`

### 5.1 Kiến trúc 3 tầng

| Tầng | Phương pháp | Độ phức tạp | Mô tả |
|---|---|---|---|
| 0 | URL matching | O(1) | Trùng URL gốc → loại |
| 1 | MD5 Hash | O(1) | Hash (title+content đã normalize) → bắt copy nguyên văn |
| 2 | SequenceMatcher | O(n) | So sánh nội dung với bài trong 24h | Ngưỡng ≥85% → trùng |

### 5.2 Facebook: Tầng bổ sung
- **Tầng đặc biệt:** Kiểm tra `facebook_post_id` trước cả 3 tầng trên

---

## 6. Geocoder - Xác định vị trí địa lý

File: `backend/ai/nlp/geocoder.py`

### 6.1 Chiến lược 2 bước

**Bước 1 — Từ điển offline (nhanh):**
- **63 tỉnh/thành** + các tên phổ biến/tiếng Anh
- Ví dụ: "hồ chí minh", "tp.hcm", "sài gòn", "ho chi minh" → (10.8231, 106.6297)

**Bước 2 — Nominatim API (online):**
- Regex trích xuất cụm từ sau "tại", "ở", "tỉnh", "huyện"...
- Gọi OpenStreetMap Nominatim API (miễn phí, giới hạn Việt Nam)

---

## 7. SOS Clustering - Gom cụm SOS tự động

File: `backend/ai/clustering.py`

### 7.1 Thuật toán

**DBSCAN** (scikit-learn, `metric='haversine'`, `algorithm='ball_tree'`):

| Tham số | Giá trị |
|---|---|
| eps (bán kính lân cận) | 300m |
| Khoảng cách | Haversine (GPS) |
| min_samples | 2 |

- Hai SOS cách nhau ≤ 300m thuộc cùng cụm; cụm lan theo chuỗi các SOS kề nhau.
- Kết quả không phụ thuộc thứ tự duyệt SOS.
- SOS không có SOS nào khác trong 300m là điểm nhiễu → giữ là SOS đơn lẻ.
- Cách gom tham lam cũ (`greedy_cluster_sos_signals`) chỉ còn là phương án dự phòng khi thiếu scikit-learn.

### 7.2 Quy trình

```
1. Lấy SOS chưa gán zone (PENDING/ACKNOWLEDGED), sắp theo thời gian gửi
2. DBSCAN → các cụm + các SOS đơn lẻ
3. Tính centroid (trung bình lat/lng)
4. Suy ra severity từ people_count + emergency_type
5. Có Zone cũ trong 300m quanh tâm → cập nhật Zone đó
   Không có → tạo Zone mới nếu cụm ≥ 2 SOS hoặc ≥ 10 người; SOS đơn lẻ giữ zone = None
6. Gán zone_id cho mỗi SOS, trả về danh sách Zone vừa thay đổi để chấm điểm lại
```

Gom cụm và chấm điểm chạy trong luồng nền (`ai/background.py`, `ai/sos_pipeline.py`):
request gửi SOS được trả ngay sau khi lưu.

### 7.3 Map Severity

```
people ≥ 20 HOẶC (≥10 + có y tế)  → CRITICAL
people ≥ 10 HOẶC SOS ≥ 5          → HIGH
people ≥ 3  HOẶC SOS ≥ 2          → MEDIUM
Còn lại                            → LOW
```

---

## 8. Priority Scorer - Chấm điểm ưu tiên Zone

File: `backend/ai/priority_scorer.py`

### 8.1 Công thức

```
score = W_SOS        × f_sos(sos_count)
      + W_PEOPLE     × f_people(people_affected)
      + W_SEV        × severity_weight
      + W_WAIT       × f_wait(hours_waiting)
      + W_RESCUE     × f_rescuer_deficit(needed, assigned)
      + W_VULNERABLE × f_vulnerable(SOS còn mở trong zone)

→ Chuẩn hóa [0.00 – 100.00]
```

### 8.2 Trọng số

| Yếu tố | Trọng số | Hàm chuẩn hóa |
|---|---|---|
| Số SOS trong zone | 20% | log1p(count)/log1p(50) |
| Số nạn nhân | 25% | log1p(people)/log1p(100) |
| Mức nghiêm trọng | 20% | CRITICAL=1.0, HIGH=0.75, MEDIUM=0.45, LOW=0.20 |
| Thời gian chờ | 15% | hours/24 (tối đa 1.0 sau 24h) |
| Thiếu hụt cứu hộ | 10% | deficit/needed |
| Người yếu thế / y tế | 10% | 0.6 nếu có SOS nêu người yếu thế + 0.4 nếu có SOS cần y tế |

Yếu tố cuối lấy từ `SOSSignal.ai_analysis` (Model A/B đọc ghi chú, hoặc thông tin admin đã duyệt
với SOS từ Facebook).

Trọng số là lựa chọn thiết kế, không học từ dữ liệu. Độ ổn định của thứ hạng khi trọng số lệch
được kiểm tra bằng `python manage.py ai_priority_sensitivity`; kết quả lưu ở
`backend/ai/reports/priority_sensitivity.md`.

### 8.3 Phân loại theo điểm

| Điểm | Mức độ | Hành động |
|---|---|---|
| 80–100 | CRITICAL | Cần điều phối ngay |
| 60–79 | HIGH | Ưu tiên cao |
| 40–59 | MEDIUM | Theo dõi |
| 0–39 | LOW | Bình thường |

---

## 9. Assignment Recommender - Gợi ý phân công

File: `backend/ai/assignment_recommender.py`

### 9.1 Công thức match score

```
score = W_DIST     × f_distance(rescuer → zone)
      + W_SPECIALTY × f_specialty_match(rescuer, zone)
      + W_PRIORITY  × f_zone_priority(ai_score)
      + W_DEFICIT   × f_rescuer_deficit(zone)
```

### 9.2 Trọng số

| Yếu tố | Trọng số | Mô tả |
|---|---|---|
| Khoảng cách GPS | 35% | 0m→1.0, 5km→0.0 (tuyến tính) |
| Chuyên môn | 30% | Bảng khớp Specialty↔Incident |
| Ưu tiên Zone | 25% | ai_priority_score / 100 |
| Thiếu hụt nhân lực | 10% | deficit / needed |

### 9.3 Bảng khớp chuyên môn

| Specialty | Phù hợp cao (≥0.8) | Phù hợp (≥0.5) |
|---|---|---|
| MEDICAL | y tế, thương vong | lũ, lụt, sạt lở, bão |
| SEARCH_RESCUE | sạt lở, mất tích, chìm | lũ, lụt, bão, cháy |
| LOGISTICS | hậu cần, di tản, nhu yếu phẩm | lũ, bão |
| COMMAND | — | mặc định (0.7) |

### 9.4 Ghép cặp bằng thuật toán Hungarian

```
1. Tính ma trận score: |Rescuers| × |Zones|
2. Zone thiếu k người được nhân thành k cột (mỗi cột là một chỗ trống)
3. scipy.optimize.linear_sum_assignment(maximize=True) → tập cặp có TỔNG điểm lớn nhất,
   mỗi Rescuer tối đa một Zone, mỗi Zone không quá số chỗ còn thiếu
4. Sắp theo điểm giảm dần, trả về top_n
```

API trả thêm `optimization.total_score` và `optimization.greedy_total_score` để so sánh với
cách ghép tham lam cũ (vẫn giữ làm phương án dự phòng).

---

## 10. API Endpoints

| Method | Endpoint | Chức năng |
|---|---|---|
| POST | `/ai/cluster/` | Gom cụm SOS → tạo/cập nhật Zone |
| POST | `/ai/score/` | Tính lại ai_priority_score |
| GET | `/ai/priority-zones/` | Danh sách Zone theo ưu tiên |
| POST | `/ai/run/` | Pipeline đầy đủ (cluster + score) |
| POST | `/ai/crawl/` | Crawl tin thiên tai từ báo chí |
| GET | `/ai/crawled/` | Danh sách bài đã crawl |
| POST | `/ai/crawled/<id>/review/` | Duyệt/từ chối bài crawl |
| GET | `/ai/recommend/` | Gợi ý phân công Rescuer → Zone |
| POST | `/ai/crawl/facebook/` | Crawl Facebook SOS |
| POST | `/ai/classify/` | Phân loại text bằng luật từ khóa (PhoBERT v1 nếu bật `AI_LEGACY_PHOBERT_V1`) |
| POST | `/ai/analyze-sos/` | Phân tích text bằng Model A/B + guardrails |
| POST | `/ai/crawled/<id>/analyze/` | Phân tích lại một bài Facebook bằng Model A/B |

---

## 11. Kết quả & Đánh giá

### 11.1 Cách đo

```
python manage.py ai_evaluate --with-v1          # tập test tổng hợp đi kèm repo
python manage.py ai_export_reviewed             # xuất bài admin đã duyệt thành dữ liệu thực
python manage.py ai_evaluate --task a --excel-a ai/reports/real_model_a.xlsx --name real
```

Báo cáo đầy đủ nằm ở `backend/ai/reports/eval_<tên>.md`.

### 11.2 Kết quả trên tập test tổng hợp (16/11/2026)

**Đây là điểm trên 160 câu tổng hợp theo mẫu, không phải độ chính xác trên tin thực.**

Bài toán A (nhận diện yêu cầu + nhu cầu):

| Phương pháp | Yêu cầu F1 | Nhu cầu macro-F1 |
|---|---:|---:|
| Luật từ khóa | 0.353 | 0.301 |
| TF-IDF + Logistic Regression | 0.966 | 0.881 |
| PhoBERT v1 (6 nhãn, model cũ) | 0.876 | 0.193 |
| PhoBERT Model A (chỉ model) | 0.978 | 0.983 |
| PhoBERT Model A + guardrails (đang dùng) | 0.978 | 0.983 |

Trên tập này luật guardrails không can thiệp vào câu nào (160/160 do model tự quyết).

Bài toán B (trích xuất thông tin, so khớp theo nhãn + nội dung cụm):

| Phương pháp | P | R | F1 |
|---|---:|---:|---:|
| Chỉ luật regex | 0.532 | 0.578 | 0.554 |
| PhoBERT Model B (chỉ model) | 0.873 | 0.992 | 0.929 |
| PhoBERT Model B + luật (đang dùng) | 0.692 | 0.992 | 0.815 |

Nhận xét: trên dữ liệu tổng hợp, lớp luật bổ sung thực thể làm giảm precision của Model B
(thêm cụm không có trong nhãn). Cần đo lại trên dữ liệu thực trước khi kết luận nên giữ hay
thu hẹp các luật này.

### 11.3 Giới hạn

| Hạng mục | Giới hạn |
|---|---|
| Dữ liệu đánh giá | Validation/Test đều là câu tổng hợp; chưa có tập test thực đủ lớn. `ai_export_reviewed` tạo tập này từ các bài admin đã duyệt |
| Model A/B | Câu phủ định ("đã an toàn, không cần hỗ trợ") từng bị nhận nhầm là yêu cầu ở bản model tháng 9 |
| Điểm ưu tiên | Trọng số đặt tay; chỉ có phân tích độ nhạy, chưa có đánh giá của chuyên gia |
| Phân công | Khoảng cách tính theo đường chim bay, chưa tính đường ngập |
| Geocoder | Nominatim giới hạn 1 request/giây; từ điển offline chỉ tới cấp tỉnh/thành |

### 11.4 Độ tin cậy khi AI lỗi

| Tình huống | Hành vi |
|---|---|
| Model A/B chưa nạp được | SOS vẫn được lưu, gom cụm và chấm điểm; `ai_analysis.status = 'unavailable'` |
| Gom cụm / chấm điểm lỗi | Ghi log, SOS không bị ảnh hưởng |
| Thiếu scikit-learn / scipy | Tự chuyển sang gom tham lam / ghép tham lam |
| Bài Facebook không phân tích được | Vẫn lưu bài để admin duyệt tay |

---

## 12. Cấu trúc thư mục AI

```
backend/ai/
├── models.py                    # Model CrawledArticle (Django ORM)
├── views.py, urls.py            # API endpoints
├── apps.py                      # Nạp sẵn Model A/B khi server khởi động
├── background.py                # Hàng đợi chạy nền cho tác vụ AI
├── sos_pipeline.py              # SOS mới → gom cụm → chấm điểm → đọc ghi chú
├── sos_note_analysis.py         # Model A/B đọc ghi chú SOS từ app
├── sos_article_analysis.py      # Model A/B cho bài Facebook + xếp mức khẩn
├── sos_service.py               # Bộ nạp Model A/B dùng chung
├── clustering.py                # Gom cụm SOS → Zone (DBSCAN + Haversine)
├── priority_scorer.py           # Chấm điểm ưu tiên Zone
├── assignment_recommender.py    # Gợi ý phân công Rescuer (Hungarian)
├── crawler_pipeline.py          # Pipeline Crawl → NLP → DB
├── evaluation.py                # Đo model + baseline + thống kê guardrails
├── dataset_export.py            # Xuất bài admin đã duyệt thành dữ liệu thực
├── management/commands/         # ai_evaluate, ai_export_reviewed, ai_priority_sensitivity
├── reports/                     # Kết quả đánh giá (sinh bằng lệnh)
├── sos_ml/                      # Tiền xử lý, kiến trúc, suy luận, guardrails của Model A/B
├── training/                    # Notebook Colab + Excel huấn luyện
├── crawlers/                    # RSS, Facebook (Graph API, Playwright), GDACS
└── nlp/
    ├── text_analyzer.py         # Luật từ khóa cho nhánh tin tức
    ├── phobert_analyzer.py      # PhoBERT v1 (model cũ, baseline)
    ├── deduplicator.py          # Lọc trùng bài crawl
    ├── event_matcher.py         # Gộp trùng theo sự kiện (SĐT, vị trí, nội dung)
    ├── geocoder.py              # Geocoding (ghép địa chỉ + Nominatim + từ điển tỉnh)
    ├── sos_two_model_v1/        # Trọng số Model A/B
    └── sos_phobert_model/       # Trọng số PhoBERT v1
```

---

_Báo cáo được tạo tự động từ mã nguồn dự án Guardian Pulse._
_Cập nhật: 16/11/2026_
