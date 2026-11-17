# Kết quả đánh giá luồng NLP (synthetic)

Tạo lúc 16/11/2026 07:56 bằng `python manage.py ai_evaluate`.

## Bài toán A: nhận diện yêu cầu cứu trợ và nhu cầu

- Tập test: `ai\training\data_model_a.xlsx [Test]` (160 câu: 160 câu tổng hợp)
- Phiên bản model: model_a_20261005_023738_749428
- TF-IDF + LR huấn luyện trên 1001 câu train.
- **Lưu ý: toàn bộ tập test là câu tổng hợp theo mẫu. Điểm dưới đây KHÔNG phải độ chính xác trên tin thực.**

| Phương pháp | Yêu cầu: P | Yêu cầu: R | Yêu cầu: F1 | Accuracy | Nhu cầu: macro-F1 | Nhu cầu: micro-F1 |
|---|---:|---:|---:|---:|---:|---:|
| Luật từ khóa | 1.000 | 0.214 | 0.353 | 0.450 | 0.301 | 0.320 |
| TF-IDF + Logistic Regression | 0.933 | 1.000 | 0.966 | 0.950 | 0.881 | 0.871 |
| PhoBERT v1 (6 nhãn, model cũ) | 0.791 | 0.982 | 0.876 | 0.806 | 0.193 | 0.261 |
| PhoBERT Model A (chỉ model) | 0.957 | 1.000 | 0.978 | 0.969 | 0.983 | 0.979 |
| PhoBERT Model A + guardrails (đang dùng) | 0.957 | 1.000 | 0.978 | 0.969 | 0.983 | 0.979 |

F1 theo từng nhu cầu:

| Phương pháp | RESCUE | MEDICAL | EVACUATION | SUPPLY |
|---|---:|---:|---:|---:|
| Luật từ khóa | 0.667 | 0.286 | 0.000 | 0.250 |
| TF-IDF + Logistic Regression | 1.000 | 0.808 | 0.857 | 0.857 |
| PhoBERT v1 (6 nhãn, model cũ) | 0.423 | 0.091 | 0.061 | 0.197 |
| PhoBERT Model A (chỉ model) | 1.000 | 0.980 | 1.000 | 0.953 |
| PhoBERT Model A + guardrails (đang dùng) | 1.000 | 0.980 | 1.000 | 0.953 |

### Model hay luật ra quyết định?

| Chỉ số | Số câu |
|---|---:|
| Model tự quyết, luật không can thiệp | 160 (100.0%) |
| Luật có can thiệp | 0 (0.0%) |
| Luật làm đổi kết luận "có phải yêu cầu" | 0 (0.0%) |
| … trong đó sửa thành ĐÚNG | 0 |
| … trong đó sửa thành SAI | 0 |

## Bài toán B: trích xuất thông tin

- Tập test: `ai\training\data_model_b.xlsx [Test]` (160 câu: 160 câu tổng hợp)
- Phiên bản model: model_b_20261005_040803_258370
- **Lưu ý: toàn bộ tập test là câu tổng hợp theo mẫu. Điểm dưới đây KHÔNG phải độ chính xác trên tin thực.**
- So khớp theo nhãn + nội dung cụm từ (sau chuẩn hóa), không so vị trí ký tự.

| Phương pháp | P | R | F1 | LOCATION F1 | PEOPLE_COUNT F1 | VULNERABLE_GROUP F1 | RESOURCE F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Chỉ luật regex | 0.532 | 0.578 | 0.554 | 0.481 | 0.667 | 0.500 | 0.635 |
| PhoBERT Model B (chỉ model) | 0.873 | 0.992 | 0.929 | 0.961 | 1.000 | 0.857 | 0.901 |
| PhoBERT Model B + luật (đang dùng) | 0.692 | 0.992 | 0.815 | 0.806 | 0.800 | 0.857 | 0.810 |
