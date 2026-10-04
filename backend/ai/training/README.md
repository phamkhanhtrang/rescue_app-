# Hai model PhoBERT trên Google Colab

Chỉ cần 5 file trong thư mục này:

| Notebook | Dữ liệu riêng | Nhiệm vụ |
|---|---|---|
| 01_train_model_a.ipynb | data_model_a.xlsx | Nhận diện yêu cầu hỗ trợ và phân loại bốn nhóm nhu cầu |
| 02_train_model_b.ipynb | data_model_b.xlsx | Trích xuất bốn loại thông tin |
| README.md | | Hướng dẫn đang đọc |

Mỗi notebook chứa toàn bộ code từ đọc Excel đến xuất model và học tiếp.
Không cần ZIP code, notebook 00 hay notebook xuất model riêng.

## 1. Bắt đầu với model A

1. Vào [Google Colab](https://colab.research.google.com/), chọn **File → Upload notebook**.
2. Chọn **bản mới 01_train_model_a.ipynb** trong thư mục này. Không chạy tiếp tab notebook cũ.
3. Chọn **Runtime → Change runtime type → GPU**, lưu cấu hình.
4. Chạy ô **1 – Cài thư viện**. Nếu ô yêu cầu restart, chọn **Runtime → Restart session** rồi chạy lại từ ô 1.
5. Chạy ô **2 – Kết nối Drive và cấu hình**, cấp quyền Drive của bạn.
6. Lần đầu giữ các giá trị sau:

| Tham số | Giá trị lần đầu |
|---|---|
| TRAIN_MODE | new |
| EPOCHS | 5 |
| BATCH_SIZE | 8 |
| LEARNING_RATE | 0.00002 |
| SEED | 42 |
| RUN_NAME | Để trống, tự tạo tên mới |
| PARENT_MODEL | Để trống |
| UPLOAD_EXCEL | True |
| EVALUATION_DOMAIN | synthetic |

7. Chạy ô **3 – Nạp Excel**, chọn **data_model_a.xlsx**.
8. Chạy lần lượt các ô **4–6**: kiểm tra dữ liệu, xem số mẫu, tải PhoBERT và chuẩn bị model.
9. Chạy ô **7** để đánh giá trước fine-tune.
10. Chạy ô **8** để fine-tune. Chờ thanh tiến trình chạy hết các epoch.
11. Chạy ô **9** để đánh giá và xem bảng F1 trước/sau cùng đồ thị.
12. Chạy ô **10** để thử dự đoán một câu mới.
13. Chạy ô **11** để xuất model. Bật DOWNLOAD_MODEL=True nếu muốn tải ZIP về máy ngay.

Ô số chỉ nhận số trực tiếp, ví dụ 5, 8, 0.00002. Không nhập biểu thức “if ... else ...”.
Notebook giữ đúng epoch/learning rate bạn điền.

## 2. Chạy model B

Làm tương tự với **02_train_model_b.ipynb + data_model_b.xlsx**.
Chạy lần lượt A rồi B để dễ theo dõi và tránh tranh tài nguyên GPU.
B có notebook, dữ liệu và thư mục model riêng; không cần model A đã train để bắt đầu.

| Model | Đầu vào khi dự đoán | Đầu ra |
|---|---|---|
| A | Câu tiếng Việt | is_request, điểm dự đoán, danh sách nhiều nhu cầu |
| B | Câu tiếng Việt | Các cụm thông tin có label, text, start, end |

A: RESCUE (cứu hộ), MEDICAL (y tế), EVACUATION (sơ tán), SUPPLY (tiếp tế).
B: LOCATION (địa điểm), PEOPLE_COUNT (tổng số người), VULNERABLE_GROUP (nhóm dễ tổn thương), RESOURCE (vật tư cần).
Cả hai fine-tune riêng từ vinai/phobert-base-v2, gồm encoder và đầu tác vụ.

## 3. Sửa hoặc bổ sung dữ liệu Excel

Mỗi file Excel có Train, Validation, Test và Huong_dan.

| File | Train | Validation | Test |
|---|---:|---:|---:|
| data_model_a.xlsx | 960 | 176 | 160 |
| data_model_b.xlsx | 1.032 | 176 | 160 |

Hai bộ giữ một phần câu nguồn chung và cùng các câu đánh giá, nhưng nhãn sử dụng
và các mẫu train bổ sung khác nhau. Không có một file train chung được nạp cho cả hai.

**A:** điền nội dung vào text, is_request là 0/1, needs ngăn cách bằng dấu chấm phẩy.
Ví dụ: text = “Xin cứu gia đình tôi và mang giúp nước uống.”, is_request = 1, needs = RESCUE;SUPPLY.
Khi is_request=0, để needs trống. Yêu cầu mơ hồ có thể là 1 nhưng chưa xác định nhóm nhu cầu.

**B:** sửa một cột text_annotated. Đánh dấu ngay trong câu:

> Nhờ hỗ trợ [PEOPLE_COUNT|5 người] tại [LOCATION|xã An Bình], có [VULNERABLE_GROUP|2 trẻ em], đang cần [RESOURCE|nước uống].

Notebook tự tạo văn bản sạch và vị trí ký tự. Không cần nhập JSON, start/end hay BIO.
Không lồng/chồng nhãn. Cụm “2 trẻ em” gắn toàn cụm VULNERABLE_GROUP.
Chỉ đánh dấu thông tin của yêu cầu còn hiệu lực; không đánh dấu vật tư đã nhận, nhu cầu phủ định hoặc yêu cầu đã xử lý xong.
Mẫu không có thông tin cần trích xuất chỉ chứa văn bản bình thường.

Các cột nguồn:

- id: mã duy nhất của từng dòng.
- group_id: các câu cùng bài gốc, sự kiện hoặc mẫu câu phải cùng nhóm và cùng một tập.
- origin: synthetic (tự tạo), real (văn bản thực tiếng Việt), translated (dịch).
- reviewed: 1 chỉ khi người gắn nhãn đã kiểm tra nội dung và nhãn. Mẫu ban đầu là 0.
- source: URL bài gốc hoặc mô tả nguồn nội bộ. Các chuỗi local:generate_synthetic.py/... ghi nguồn tạo dữ liệu ban đầu, không phải file cần chạy.

Thêm dòng vào cuối **Train**, giữ các mẫu cũ. Notebook đọc cả dòng thêm ngoài vùng bảng Excel,
nhưng vẫn phải điền đủ cột bắt buộc. Không đổi tên cột/sheet.
Giữ nguyên Validation/Test khi học tiếp. Sắp xếp lại dòng hoặc đổi định dạng Excel không đổi dấu vân tay đánh giá.
Đọc sheet Huong_dan của từng Excel để tra cách gắn nhãn.

## 4. Học tiếp khi có dữ liệu mới

1. Thêm mẫu vào **Train của Excel đúng model**, giữ dữ liệu cũ.
2. Mở lại chính notebook model đó.
3. Chọn TRAIN_MODE=continue.
4. Điền PARENT_MODEL là thư mục model lần trước, ví dụ:
   /content/drive/MyDrive/SOS_Thesis/runs/model_a_20260914_.../model_a
5. Đặt EPOCHS=3, LEARNING_RATE=0.000005 làm cấu hình khởi đầu.
6. Để RUN_NAME trống hoặc dùng tên mới, bật UPLOAD_EXCEL=True.
7. Upload Excel đã bổ sung và chạy đến bước 11.

Notebook nạp **cả trọng số PhoBERT và đầu tác vụ đã học**, không khởi tạo lại từ PhoBERT gốc.
Optimizer tạo mới: đây là continued fine-tuning, không phải resume đúng batch bị ngắt.
Không bảo đảm train thêm luôn tăng điểm; model cha vẫn là ứng viên nếu epoch mới kém hơn trên Validation.

Không đổi Validation/Test hoặc thêm loại nhãn mới trong cùng lần học tiếp.
Checkpoint từ notebook ZIP cũ chưa có dấu vân tay đánh giá Excel nên không được dùng làm model cha ở quy trình mới.
A chỉ nhận model cha A, B chỉ nhận model cha B.

## 5. Kết quả nằm ở đâu?

Trên Drive: **MyDrive/SOS_Thesis/runs/<tên run>/**.
Notebook in đường dẫn chính xác. Mỗi lần chạy có thư mục riêng:

- model_a/ hoặc model_b/: trọng số tốt nhất, tokenizer, nhãn và metadata.
- before_metrics.json, test_metrics.json: kết quả trước/sau.
- comparison.json, comparison.png: bảng và hình so sánh.
- history.json: loss và F1 Validation từng epoch.
- before_predictions.jsonl, test_predictions.jsonl: dự đoán từng mẫu để phân tích lỗi.
- File Excel dùng trong run: phục vụ tái lập thí nghiệm.
- model_a.zip hoặc model_b.zip: tạo ở bước 11 để đưa model về hệ thống.

Đây là kết quả tự sinh trên Drive, không phải các file bạn cần chuẩn bị/upload trước khi train.
Mỗi Excel được lưu riêng tại MyDrive/SOS_Thesis/data_model_a.xlsx hoặc data_model_b.xlsx.
Nếu upload bản khác, Excel cũ được giữ trong data_history trên Drive.

## 6. Tích hợp vào hệ thống

Sau khi train cả hai model, tải hai ZIP ở bước 11 và giải nén cùng vào:
**backend/ai/nlp/sos_two_model_v1/**.

Bên trong phải có:

- model_a/metadata.json, model_a/encoder/, model_a/heads.safetensors và các file tokenizer.
- model_b/metadata.json, model_b/config.json, model_b/model.safetensors và các file tokenizer.

Không lồng thành model_a/model_a/.
Từ thư mục backend, dùng Python của backend cài:
`pip install -r ai/sos_ml/requirements.txt`.

Kiểm tra bằng Python từ thư mục backend:

```python
from ai.sos_ml.inference import SOSPredictor
predictor = SOSPredictor('ai/nlp/sos_two_model_v1', device='cpu')
print(predictor.predict('Nhờ cứu 5 người tại xã An Bình, đang cần nước uống.'))
```

Trong PowerShell dùng để khởi chạy backend:

```powershell
$env:SOS_TWO_MODEL_DIR = 'ai/nlp/sos_two_model_v1'
$env:SOS_TWO_MODEL_DEVICE = 'cpu'
python manage.py runserver
```

Dùng cuda khi backend có GPU và PyTorch CUDA phù hợp.
API hiện có: **POST /ai/analyze-sos/**, JSON `{"text":"..."}`, cần đăng nhập tài khoản có quyền admin.
API test trả dự đoán A/B và requires_review=true, không tạo SOS. Crawler Facebook dùng cả hai model, lưu bài chờ admin xác nhận trước khi tạo SOS. Crawler tin tức giữ luồng duyệt tin riêng.

### Sử dụng trên web admin

1. Đăng nhập admin, mở **AI Tìm tin** → **Test model A / B**.
2. Chọn model A, model B hoặc cả hai, nhập nội dung và bấm phân tích. A trả nhận diện yêu cầu và nhóm nhu cầu; B trả các thông tin trích xuất. Test không lưu bài hoặc tạo SOS.
3. Ở tab Facebook, chạy crawler rồi mở hồ sơ bài viết. Có thể bấm phân tích lại bằng hai model.
4. Đối chiếu dự đoán với nội dung gốc. Xác nhận đây là yêu cầu đang cần hỗ trợ; sửa nhu cầu, địa chỉ, tọa độ, số người, liên hệ, vật tư và nhóm dễ tổn thương.
5. Duyệt tạo SOS hoặc từ chối. SOS mới ở trạng thái chờ xử lý, chưa xác minh. Dự đoán gốc và thông tin đã duyệt được lưu riêng để đối chiếu.

Model đang được đánh giá trên dữ liệu tổng hợp. Điểm tin cậy của một câu không phải độ chính xác thực tế; admin cần kiểm tra, đặc biệt bài phủ định hoặc đã được cứu.
Trọng số cũ đang được hệ thống dùng không bị xóa trong lần dọn này.

## 7. Đọc kết quả và xử lý lỗi

**Baseline lần new:** encoder đã tiền huấn luyện + đầu tác vụ ngẫu nhiên.
PhoBERT gốc chưa có đầu SOS/NER theo nhãn của đồ án. Không trình bày đây là một model SOS mạnh đã huấn luyện.
Lần continue so với model cha. Checkpoint/ngưỡng chỉ chọn trên Validation, không dùng Test để chọn.

**Toàn bộ dữ liệu ban đầu là tổng hợp theo mẫu câu**, chưa có người duyệt độc lập.
Điểm hiện tại chỉ phản ánh miền tổng hợp. Để báo cáo thực nghiệm trên tin thực,
cần một tập thực tiếng Việt đã duyệt, đủ nhãn, tách theo bài/sự kiện và một thí nghiệm mới
với EVALUATION_DOMAIN=real_vietnamese. Notebook kiểm tra origin, không chỉ đổi nhãn báo cáo.

| Lỗi | Cách xử lý |
|---|---|
| tokenizers build wheel | Dùng notebook mới; bước 1 cài wheel của tokenizers 0.22.2 |
| Transformers vẫn bản cũ | Restart session, chạy lại từ bước 1 |
| Drive báo mount failed | Bật REMOUNT_DRIVE=True ở bước 2, chạy lại và hoàn tất cấp quyền Google. Nếu vẫn lỗi: lưu notebook, chọn Runtime → Disconnect and delete runtime, kết nối GPU rồi chạy từ bước 1. File tạm /content bị xóa; file đã lưu trên Drive vẫn giữ. |
| integer/number không hợp lệ | Chỉ nhập số trực tiếp |
| Excel sai | Sửa sheet/dòng được báo, upload lại |
| Câu quá dài hoặc nhãn cắt giữa từ | Chia câu/gắn lại nhãn, tối đa 256 BPE |
| GPU hết bộ nhớ | Giảm batch size xuống 4 hoặc 2, restart, dùng run mới |
| Run đã tồn tại | Đổi RUN_NAME hoặc để trống; không xóa kết quả cũ để ép chạy |
| Train gián đoạn | Tạo run mới, continue từ checkpoint đã lưu đầy đủ; chưa có checkpoint thì chạy new |
| Chưa có test_metrics.json | Hoàn thành train và bước 9; xem lỗi ô train trước |
| Validation/Test khác model cha | Khôi phục các sheet đánh giá từ Excel trong run cha |

Code được kiểm tra cục bộ; huấn luyện PhoBERT và kiểm chứng GPU Colab do bạn thực hiện.
Đã bỏ notebook 00/03, notebook train một model cũ, ZIP code, JSONL lặp và các công cụ đóng gói cũ
sau khi kiểm tra chuyển đổi dữ liệu. Code bảo trì/kiểm thử ở ../sos_ml, không phải upload lên Colab.

Tài liệu: [PhoBERT](https://github.com/VinAIResearch/PhoBERT),
[Transformers 4.57.6](https://pypi.org/project/transformers/4.57.6/),
[Tokenizers 0.22.2](https://pypi.org/project/tokenizers/0.22.2/).
