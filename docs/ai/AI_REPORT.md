# BÁO CÁO CHI TIẾT CÁC CHỨC NĂNG AI - GUARDIAN PULSE

> **Dự án:** Guardian Pulse - Hệ thống điều phối cứu hộ thiên tai
> **Ngày:** 26/05/2026

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
| **Deep Learning** | PhoBERT (vinai/phobert-base) | Phân loại văn bản SOS tiếng Việt |
| **NLP Rule-based** | Regex + Keyword matching | Fallback khi chưa có model |
| **Clustering** | DBSCAN-like (Greedy + Haversine) | Gom cụm SOS theo GPS |
| **Scoring** | Weighted Multi-factor (Log scaling) | Chấm điểm ưu tiên Zone |
| **Matching** | Greedy Matching Algorithm | Phân công Rescuer tối ưu |
| **Crawling** | feedparser (RSS) + Facebook Graph API v18.0 | Thu thập tin thiên tai |
| **Deduplication** | MD5 Hash + SequenceMatcher (difflib) | Lọc tin trùng lặp |
| **Geocoding** | Từ điển offline 63 tỉnh/thành + Nominatim API | Xác định vị trí |
| **Framework** | Django + DRF | Backend API |

---

## 2. PhoBERT SOS Classifier

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

## 3. NLP Text Analyzer (Rule-based Fallback)

### 3.1 Mô tả
Hệ thống phân tích văn bản dự phòng khi PhoBERT chưa được cài đặt. Sử dụng keyword matching để trích xuất thông tin.

File: `backend/ai/nlp/text_analyzer.py`

### 3.2 Chiến lược 2 tầng

```
Văn bản → [PhoBERT available?]
              ├── YES → PhoBERT classify → AnalysisResult (method='phobert')
              └── NO  → Rule-based → AnalysisResult (method='rule_based')
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

**Greedy Clustering (DBSCAN-like):**

| Tham số | Giá trị |
|---|---|
| Bán kính gom cụm | 300m |
| Khoảng cách | Haversine (GPS) |
| Min samples | 1 |
| Độ phức tạp | O(n²) — phù hợp n < 10k |

### 7.2 Quy trình

```
1. Lấy SOS chưa gán zone (PENDING/ACKNOWLEDGED)
2. Greedy cluster: SOS đầu tiên → hạt nhân cụm → thêm mọi SOS trong 300m
3. Tính centroid (trung bình lat/lng)
4. Suy ra severity từ people_count + emergency_type
5. Tìm Zone cũ gần tâm → cập nhật hoặc tạo Zone mới
6. Gán zone_id cho mỗi SOS
```

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
score = W_SOS    × f_sos(sos_count)
      + W_PEOPLE × f_people(people_affected)
      + W_SEV    × severity_weight
      + W_WAIT   × f_wait(hours_waiting)
      + W_RESCUE × f_rescuer_deficit(needed, assigned)

→ Chuẩn hóa [0.00 – 100.00]
```

### 8.2 Trọng số

| Yếu tố | Trọng số | Hàm chuẩn hóa |
|---|---|---|
| Số SOS trong zone | 25% | log1p(count)/log1p(50) |
| Số nạn nhân | 30% | log1p(people)/log1p(100) |
| Mức nghiêm trọng | 20% | CRITICAL=1.0, HIGH=0.75, MEDIUM=0.45, LOW=0.20 |
| Thời gian chờ | 15% | hours/24 (tối đa 1.0 sau 24h) |
| Thiếu hụt cứu hộ | 10% | deficit/needed |

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

### 9.4 Greedy Matching

```
1. Tính ma trận score: |Rescuers| × |Zones|
2. Sắp xếp giảm dần theo score
3. Lần lượt chọn cặp (Rescuer, Zone) score cao nhất
4. Loại Rescuer đã gán khỏi pool
5. Dừng khi đạt top_n hoặc hết
```

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
| POST | `/ai/classify/` | Phân loại text bằng PhoBERT |

---

## 11. Kết quả & Đánh giá

### 11.1 PhoBERT Training Results

- **Môi trường:** Google Colab (GPU CUDA)
- **Epochs:** 3
- **Metric chọn best model:** F1 Macro
- **Training strategy:** Load best model at end

### 11.2 Kiến trúc Fallback đảm bảo độ tin cậy

| Tình huống | Hành vi |
|---|---|
| PhoBERT sẵn sàng | Dùng AI (method='phobert') |
| torch/transformers chưa cài | Log warning → Rule-based |
| Model directory không tồn tại | Log warning → Rule-based |
| Lỗi inference | Log error → Rule-based |
| **Kết quả:** Hệ thống **không bao giờ crash** vì lỗi AI |

### 11.3 Đánh giá tổng thể hệ thống AI

| Module | Điểm mạnh | Hạn chế |
|---|---|---|
| PhoBERT Classifier | Hiểu ngữ cảnh tiếng Việt, phân loại 6 nhãn | Dataset còn nhỏ (620 mẫu) |
| Clustering | Nhanh, tự động tạo Zone | O(n²), chưa tối ưu cho dữ liệu lớn |
| Priority Scorer | Công thức đa yếu tố, cân bằng | Trọng số cố định, chưa học từ dữ liệu |
| Assignment Recommender | Greedy matching nhanh, có giải thích lý do | Chưa tối ưu toàn cục (Hungarian) |
| Crawler Pipeline | Đa nguồn, lọc trùng 3 tầng | Phụ thuộc RSS feed format |
| Geocoder | Offline nhanh cho 63 tỉnh/thành | Nominatim có rate limit |

### 11.4 Hướng phát triển

1. **Mở rộng dataset** PhoBERT lên 5,000+ mẫu thực tế
2. **Nâng cấp Clustering** sang DBSCAN/HDBSCAN thực sự
3. **Học trọng số** Priority Scorer từ feedback Admin
4. **Hungarian Algorithm** cho Assignment (tối ưu toàn cục)
5. **Real-time WebSocket** để push kết quả AI tức thì

---

## 12. Cấu trúc thư mục AI

```
backend/ai/
├── models.py                    # Model CrawledArticle (Django ORM)
├── views.py                     # 10 API endpoints
├── urls.py                      # URL routing
├── clustering.py                # Gom cụm SOS → Zone (Haversine + Greedy)
├── priority_scorer.py           # Chấm điểm ưu tiên Zone
├── assignment_recommender.py    # Gợi ý phân công Rescuer
├── crawler_pipeline.py          # Pipeline tổng hợp Crawl → NLP → DB
├── train_sos_phobert.ipynb      # Notebook training PhoBERT trên Colab
├── crawlers/
│   ├── base_crawler.py          # Abstract BaseCrawler + CrawledItem
│   ├── rss_crawler.py           # Crawl RSS báo chí VN
│   └── fb_crawler.py            # Crawl Facebook SOS Groups
└── nlp/
    ├── text_analyzer.py         # NLP phân tích + Fallback rule-based
    ├── phobert_analyzer.py      # PhoBERT inference (Singleton)
    ├── deduplicator.py          # Lọc trùng 3 tầng
    ├── geocoder.py              # Geocoding (offline + Nominatim)
    └── sos_phobert_model/       # Model weights (~540MB)
        ├── config.json
        ├── model.safetensors
        ├── tokenizer_config.json
        ├── vocab.txt
        ├── bpe.codes
        ├── label_mapping.json
        └── metadata.json
```

---

_Báo cáo được tạo tự động từ mã nguồn dự án Guardian Pulse._
_Cập nhật: 26/05/2026_
