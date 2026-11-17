# Độ nhạy của điểm ưu tiên Zone theo trọng số

Tạo lúc 16/11/2026 07:53 bằng `python manage.py ai_priority_sensitivity`.

- Dữ liệu: 500 Zone giả lập (seed=42)
- Mỗi lần đổi một trọng số ±20%, các trọng số khác co giãn để tổng vẫn là 100.
- Spearman = 1.000 nghĩa là thứ hạng không đổi. Top-5 giữ nguyên = tỷ lệ Zone trong top-5 gốc vẫn còn trong top-5 mới.

| Trọng số | Giá trị gốc | Spearman (−20%) | Spearman (+20%) | Top-5 giữ nguyên (−) | Top-5 giữ nguyên (+) |
|---|---:|---:|---:|---:|---:|
| Số SOS | 20 | 0.995 | 0.996 | 80% | 80% |
| Số nạn nhân | 25 | 0.993 | 0.995 | 80% | 80% |
| Mức nghiêm trọng | 20 | 0.995 | 0.996 | 60% | 100% |
| Thời gian chờ | 15 | 0.998 | 0.998 | 80% | 100% |
| Thiếu cứu hộ | 10 | 0.998 | 0.998 | 100% | 80% |
| Người yếu thế / y tế | 10 | 0.998 | 0.998 | 80% | 60% |

Spearman thấp nhất: 0.993.
