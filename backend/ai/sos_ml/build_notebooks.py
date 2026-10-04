"""Maintainer command: python -m ai.sos_ml.build_notebooks. No Colab code ZIP required."""
import ast
import json
import textwrap
from pathlib import Path

HERE = Path(__file__).parent
OUTPUT = HERE.parent / 'training'


def embedded(filename, stop_before=None):
    source = (HERE / filename).read_text(encoding='utf-8')
    if stop_before:
        source = source.split(stop_before)[0]
    # Remove only package-relative imports, including those inside functions.
    # Their definitions occur in preceding visible notebook cells.
    lines = source.splitlines(keepends=True)
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.ImportFrom) and node.level:
            for index in range(node.lineno - 1, node.end_lineno):
                lines[index] = ''
    return ''.join(lines).strip()


def markdown(text):
    return {'cell_type': 'markdown', 'metadata': {}, 'source': textwrap.dedent(text).strip().splitlines(keepends=True)}


def code(text, title=None):
    source = textwrap.dedent(text).strip() + '\n'
    if title:
        source = '#@title ' + title + '\n' + source
    return {'cell_type': 'code', 'metadata': {}, 'execution_count': None, 'outputs': [], 'source': source.splitlines(keepends=True)}


def build(task):
    name = task.upper()
    cells = [markdown(f'''
    # Model {name}: {'nhận diện yêu cầu và phân loại nhu cầu' if task == 'a' else 'trích xuất thông tin tiếng Việt'}

    **Chỉ cần notebook này và `data_model_{task}.xlsx`.** Toàn bộ code nằm trong các ô bên dưới.
    Không chạy file 00, không upload ZIP code, không cần notebook xuất model riêng.

    {'Đầu vào: câu tiếng Việt. Đầu ra: `is_request`, điểm yêu cầu và nhiều nhãn `RESCUE`, `MEDICAL`, `EVACUATION`, `SUPPLY`. Kiến trúc: PhoBERT + hai đầu sigmoid; fine-tune cả encoder và hai đầu.' if task == 'a' else 'Đầu vào: câu tiếng Việt. Đầu ra: các cụm `LOCATION`, `PEOPLE_COUNT`, `VULNERABLE_GROUP`, `RESOURCE`, cùng vị trí ký tự trong câu. Kiến trúc: PhoBERT + đầu phân loại 9 nhãn BIO; fine-tune cả encoder và đầu BIO.'}

    Backbone: `vinai/phobert-base-v2`. PyVi tách từ tiếng Việt; tokenizer PhoBERT dạng slow.
    Mỗi model có file Excel riêng. Một phần câu nguồn và tập đánh giá của hai bộ hiện tại trùng nhau;
    A có 960 mẫu train, B có 1.032 mẫu train, mỗi bộ có 176 validation và 160 test.

    **Mẫu ban đầu là dữ liệu tổng hợp, chưa được người duyệt độc lập.** Điểm test không chứng minh chất lượng với tin SOS thực tế.
    Baseline lần đầu là encoder đã tiền huấn luyện + đầu tác vụ khởi tạo ngẫu nhiên;
    PhoBERT nguyên bản chưa có khả năng xuất các nhãn SOS này. Đây là đối chiếu trước/sau, không phải so với một model SOS đã huấn luyện.

    Chọn **Runtime → Change runtime type → GPU**, rồi chạy các ô theo thứ tự.
    Lần đầu dùng `new`. Khi thêm dữ liệu, xem bước 12, dùng lại chính notebook này ở chế độ `continue`.
    ''')]
    cells += [markdown('''
    ## 1. Cài thư viện

    Giữ PyTorch/GPU có sẵn của Colab. Tokenizers được cài từ wheel, tránh lỗi build Rust.
    Nếu ô báo cần restart: chọn **Runtime → Restart session**, rồi chạy lại từ ô này một lần.
    Không dùng yêu cầu `transformers==4.44.2` của notebook cũ.
    ''')]
    cells += [code('''
    import os, sys, subprocess, importlib.metadata
    os.environ['USE_TF'] = '0'
    os.environ['USE_FLAX'] = '0'
    wanted = {'transformers': '4.57.6', 'tokenizers': '0.22.2'}
    stale = [name for name, version in wanted.items()
             if name in sys.modules and getattr(sys.modules[name], '__version__', None) != version]
    subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', '--only-binary=tokenizers',
        'transformers==4.57.6', 'tokenizers==0.22.2', 'pyvi==0.1.1', 'openpyxl==3.1.5',
        'safetensors>=0.4.5', 'scikit-learn>=1.5,<2', 'pandas', 'matplotlib', 'tqdm'], check=True)
    if stale:
        raise RuntimeError('Đã cài xong. Chọn Runtime → Restart session rồi chạy lại từ ô 1. Đang nạp bản cũ: ' + ', '.join(stale))
    import torch, transformers, tokenizers
    print('Python:', sys.version.split()[0], '| Torch:', torch.__version__)
    print('Transformers:', transformers.__version__, '| Tokenizers:', tokenizers.__version__)
    print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'Chưa bật GPU')
    if not torch.cuda.is_available():
        raise RuntimeError('Chọn Runtime → Change runtime type → GPU rồi chạy lại. Chưa bắt đầu train.')
    ''')]
    cells += [markdown(f'''
    ## 2. Kết nối Drive và cấu hình

    Lần đầu giữ `TRAIN_MODE=new`, `EPOCHS=5`, `LEARNING_RATE=0.00002`.
    Học tiếp: `TRAIN_MODE=continue`, điền `PARENT_MODEL`, gợi ý `EPOCHS=3`, `LEARNING_RATE=0.000005`.
    Các ô số chỉ nhận số, không nhập biểu thức `if ... else ...`. Notebook giữ đúng giá trị bạn điền.

    `RUN_NAME` trống sẽ tự tạo tên mới. `PARENT_MODEL` là đường dẫn tới thư mục **model_{task}** có `metadata.json`, không phải ZIP.
    `UPLOAD_EXCEL=True` để chọn file từ máy. Lần sau đã lưu trên Drive thì đặt False; muốn dùng Excel vừa sửa thì bật lại True.
    Nếu Drive báo `mount failed`, thử `REMOUNT_DRIVE=True` và chạy lại ô này, hoàn tất hộp thoại cấp quyền.
    Nếu vẫn thất bại, lưu notebook rồi chọn Runtime → Disconnect and delete runtime, kết nối lại GPU và chạy từ bước 1.
    Thao tác xóa runtime làm mất file tạm trong /content; file đã lưu trên Google Drive vẫn được giữ.
    ''')]
    cells += [code(f'''
    from pathlib import Path
    from datetime import datetime
    from google.colab import drive, files
    REMOUNT_DRIVE = False #@param {{type:"boolean"}}
    try:
        drive.mount('/content/drive', force_remount=REMOUNT_DRIVE, timeout_ms=180000)
    except (ValueError, OSError) as exc:
        raise RuntimeError(
            'Chưa kết nối được Google Drive; chưa bắt đầu train. '
            'Thử REMOUNT_DRIVE=True và chạy lại ô này, hoàn tất cấp quyền Google. '
            'Nếu vẫn lỗi: lưu notebook, chọn Runtime → Disconnect and delete runtime, '
            'kết nối GPU rồi chạy từ bước 1. File tạm /content sẽ mất, file đã lưu trên Drive vẫn giữ. '
            'Nếu còn lỗi, gửi toàn bộ thông báo phía trên mount failed. '
            'Chi tiết gốc: ' + str(exc)
        ) from exc
    if not Path('/content/drive/MyDrive').is_dir():
        raise RuntimeError('Drive chưa có MyDrive. Dừng tại đây, không tạo thư mục lưu model trên ổ tạm.')
    WORK = Path('/content/drive/MyDrive/SOS_Thesis')
    WORK.mkdir(parents=True, exist_ok=True)
    TASK = '{task}'
    TRAIN_MODE = 'new' #@param ["new", "continue"]
    EPOCHS = 5 #@param {{type:"integer"}}
    BATCH_SIZE = 8 #@param {{type:"integer"}}
    LEARNING_RATE = 0.00002 #@param {{type:"number"}}
    SEED = 42 #@param {{type:"integer"}}
    RUN_NAME = '' #@param {{type:"string"}}
    PARENT_MODEL = '' #@param {{type:"string"}}
    UPLOAD_EXCEL = True #@param {{type:"boolean"}}
    EVALUATION_DOMAIN = 'synthetic' #@param ["synthetic", "real_vietnamese"]
    EXCEL = WORK / 'data_model_{task}.xlsx'
    resolved_name = RUN_NAME.strip() or ('model_{task}_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
    if Path(resolved_name).name != resolved_name or resolved_name in {{'.', '..'}}:
        raise ValueError('RUN_NAME chỉ là tên, không chứa đường dẫn.')
    RUN = WORK / 'runs' / resolved_name
    if TRAIN_MODE not in {{'new', 'continue'}}:
        raise ValueError('TRAIN_MODE chỉ là new hoặc continue')
    if TRAIN_MODE == 'continue' and not PARENT_MODEL.strip():
        raise ValueError('Điền PARENT_MODEL khi học tiếp.')
    PARENT = Path(PARENT_MODEL.strip()) if TRAIN_MODE == 'continue' else None
    if PARENT and not PARENT.is_absolute():
        PARENT = WORK / PARENT
    if TRAIN_MODE == 'new' and PARENT_MODEL.strip():
        raise ValueError('Bạn đã điền model cha. Chuyển TRAIN_MODE=continue hoặc xóa PARENT_MODEL.')
    print('Dữ liệu:', EXCEL, '\\nRun mới:', RUN, '\\nModel cha:', PARENT)
    ''', 'Cấu hình model ' + name)]
    cells += [markdown(f'''
    ## 3. Nạp file Excel của model {name}

    Chọn **`data_model_{task}.xlsx`**. File được lưu trên Drive để dùng lần sau.
    Nếu cập nhật Excel, bản cũ được giữ trong thư mục `data_history` trên Drive; bản dữ liệu của mỗi lần train cũng nằm trong run đó.
    ''')]
    cells += [code('''
    import shutil
    if UPLOAD_EXCEL:
        uploaded = files.upload()
        if len(uploaded) != 1 or not next(iter(uploaded)).lower().endswith('.xlsx'):
            raise ValueError('Chọn đúng một file .xlsx của model này.')
        payload = next(iter(uploaded.values()))
        if EXCEL.exists() and EXCEL.read_bytes() != payload:
            backup = WORK / 'data_history' / (EXCEL.stem + '_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f') + '.xlsx')
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(EXCEL, backup)
        EXCEL.write_bytes(payload)
    if not EXCEL.is_file():
        raise FileNotFoundError('Chưa có Excel trên Drive. Bật UPLOAD_EXCEL=True ở bước 2 và chạy lại bước 3.')
    print('Đã nạp:', EXCEL)
    ''')]
    cells += [markdown('''
    ## 4. Đọc và kiểm tra nhãn

    Ô dưới định nghĩa cách đọc Excel và chống rò rỉ dữ liệu. Bạn chỉ cần chạy, không cần chỉnh.
    Có lỗi sẽ báo tên sheet, dòng và nguyên nhân trước khi tải model/train.
    ''')]
    # Include only data definitions actually consumed in this workflow.
    cells += [code(embedded('data.py', '\ndef validate_row(')), code(embedded('excel_data.py'))]
    cells += [code('''
    import pandas as pd
    from IPython.display import display
    SPLITS = load_excel_data(EXCEL, TASK, EVALUATION_DOMAIN)
    display(pd.DataFrame([{'Tập': k, 'Số mẫu': len(v)} for k, v in SPLITS.items()]))
    display(pd.DataFrame(SPLITS['train'][:5])[['id', 'text', 'is_request', 'needs'] if TASK == 'a' else ['id', 'text', 'entities']])
    print('Đánh giá trên:', EVALUATION_DOMAIN)
    ''')]
    cells += [markdown('''
    ## 5. Tiền xử lý và định nghĩa mô hình

    Các ô code bên dưới chứa trực tiếp cách tách từ, gắn BIO, mô hình và tính F1.
    Dùng cùng cách tiền xử lý với API của hệ thống. Câu vượt 256 BPE hoặc nhãn cắt giữa từ sẽ được báo để sửa, không tự cắt mất nhãn.
    Ngưỡng A được chọn trên Validation. F1 của B yêu cầu đúng cả loại nhãn và vị trí cụm từ.
    ''')]
    cells += [code(embedded('preprocess.py')), code(embedded('modeling.py')),
              code(embedded('continuation.py')), code(embedded('metrics.py'))]
    cells += [markdown('''
    ## 6. Quy trình train, đánh giá, dự đoán và xuất model

    Đây là code thực thi, được đặt ngay trong notebook để có thể đọc và trình bày.
    Các bước bên dưới gọi từng thao tác riêng. `continue` nạp cả encoder và đầu tác vụ từ model cha, tạo optimizer mới.
    Chỉ Validation được dùng để chọn checkpoint. Trong chế độ học tiếp, model cha vẫn là ứng viên nếu train thêm không cải thiện Validation.
    ''')]
    cells += [code(embedded('notebook_runtime.py')), code('''
    session = NotebookRun(TASK, SPLITS, EXCEL, RUN, parent=PARENT,
        epochs=EPOCHS, batch_size=BATCH_SIZE, lr=LEARNING_RATE, seed=SEED,
        evaluation_domain=EVALUATION_DOMAIN)
    session.prepare()
    ''')]
    cells += [markdown('''
    ## 7. Đánh giá trước fine-tune

    `new`: encoder PhoBERT gốc + đầu tác vụ ngẫu nhiên. `continue`: model của lần trước.
    Lưu `before_metrics.json`. Không dùng kết quả Test này để chọn learning rate, epoch hoặc ngưỡng.
    ''')]
    cells += [code('''
    before = session.measure_before()
    print(json.dumps(before, ensure_ascii=False, indent=2))
    ''')]
    cells += [markdown('''
    ## 8. Fine-tune

    Đây là ô thực sự huấn luyện. Thanh tiến trình hiển thị từng batch; sau mỗi epoch có loss và F1 Validation.
    Checkpoint tốt nhất được lưu vào Drive sau mỗi lần cải thiện.
    Nếu lỗi/mất kết nối: không chạy ô đọc báo cáo để bỏ qua lỗi. Xem hướng dẫn xử lý ở cuối notebook.
    ''')]
    cells += [code('session.train()')]
    cells += [markdown('''
    ## 9. Đánh giá sau fine-tune và so sánh

    Nạp lại checkpoint tốt nhất rồi đo Test với ngưỡng đã chọn trên Validation.
    Bảng dùng thang 0–1. Chênh lệch có thể âm; notebook không tạo hoặc làm đẹp điểm số.
    File `test_metrics.json` có chi tiết từng nhãn, `test_predictions.jsonl` có dự đoán từng mẫu.
    ''')]
    cells += [code('''
    comparison = pd.DataFrame(session.finish()).set_index('Chỉ số')
    display(comparison.style.format('{:.4f}'))
    print('Epoch được chọn:', session.saved['best_epoch'])
    print('Phạm vi đánh giá:', EVALUATION_DOMAIN)
    import matplotlib.pyplot as plt
    ax = comparison[['Trước', 'Sau']].plot.barh(figsize=(9, 4), xlim=(0, 1))
    ax.set_xlabel('F1 (0–1)')
    ax.set_title('Đánh giá ' + EVALUATION_DOMAIN + ' — trước và sau fine-tune')
    plt.tight_layout()
    plt.savefig(RUN / 'comparison.png', dpi=160, bbox_inches='tight')
    plt.show()
    history = pd.DataFrame([{'Epoch': h['epoch'], 'Loss': h['loss'], 'Validation F1': h['validation']['selection_score']} for h in session.history])
    display(history)
    ''')]
    cells += [markdown('## 10. Thử câu mới'), code('''
    TEXT = 'Nhờ cứu 5 người tại xã An Bình, có 2 trẻ em, đang cần nước uống.' #@param {type:"string"}
    print(json.dumps(session.predict(TEXT), ensure_ascii=False, indent=2))
    ''')]
    cells += [markdown(f'''
    ## 11. Xuất model để tích hợp

    Trọng số đã nằm trên Drive trong `runs/<tên run>/model_{task}`.
    Ô này tạo **ZIP model đầu ra** để tải về, không phải ZIP code đầu vào.
    Sau khi có cả A và B, giải nén hai ZIP vào cùng thư mục `sos_two_model_v1`, bên trong có `model_a/` và `model_b/`.
    Cấu hình backend: `SOS_TWO_MODEL_DIR` trỏ tới thư mục đó; `SOS_TWO_MODEL_DEVICE=cpu` hoặc `cuda`.
    API hiện có: `POST /ai/analyze-sos/`, JSON `{{"text": "Nhờ cứu gia đình tôi..."}}`, cần tài khoản có quyền admin.
    API test trả gợi ý và không tạo SOS. Crawler Facebook dùng hai model; admin xác nhận thông tin trước khi tạo SOS. Trên web admin, mở AI Tìm tin → Test model A / B để thử từng model hoặc cả hai. Xem README để kiểm tra tích hợp bằng Python.
    ''')]
    cells += [code('''
    DOWNLOAD_MODEL = False #@param {type:"boolean"}
    archive = session.export()
    if DOWNLOAD_MODEL:
        files.download(archive)
    print('Đường dẫn dùng cho PARENT_MODEL lần sau:', session.checkpoint)
    ''')]
    cells += [markdown(f'''
    ## 12. Thêm dữ liệu và học tiếp bằng chính notebook này

    1. Mở `data_model_{task}.xlsx`, thêm mẫu vào **Train**. Giữ các mẫu cũ để hạn chế quên kiến thức.
    2. Không đổi Validation/Test. Mẫu cùng bài gốc/sự kiện/mẫu câu dùng cùng `group_id`; không đưa mẫu test vào train.
    3. Mở lại notebook. Ở bước 2, chọn `TRAIN_MODE=continue`, dán đường dẫn model_{task} đã xuất vào `PARENT_MODEL`.
    4. Đặt `EPOCHS=3`, `LEARNING_RATE=0.000005` làm điểm bắt đầu. Để `RUN_NAME` trống hoặc chọn tên mới.
    5. Đặt `UPLOAD_EXCEL=True`, upload Excel mới và chạy lần lượt đến bước 11.

    Model dùng lại trọng số cũ, fine-tune trên dữ liệu cũ + mới; **không khởi tạo lại từ PhoBERT gốc**.
    Optimizer được tạo mới, nên đây không phải tiếp tục đúng batch đã bị ngắt. Không thêm loại nhãn mới bằng cách thêm cột.
    Model từ notebook ZIP cũ không có dấu vân tay đánh giá Excel nên không được nhận làm model cha trong quy trình này.

    ## Khi có lỗi

    - **Ô số báo không hợp lệ:** chỉ nhập số, ví dụ `5`, `8`, `0.00002`.
    - **Sai Transformers sau cài:** restart session, chạy từ bước 1. Không sửa assert để bỏ qua.
    - **Excel sai:** sửa đúng dòng được báo, upload lại; chưa cần train lại nếu lỗi ở kiểm tra dữ liệu.
    - **CUDA out of memory:** giảm `BATCH_SIZE` xuống 4 hoặc 2, restart session, dùng tên run mới.
    - **Train gián đoạn:** nếu Drive đã có `model_{task}/metadata.json` cùng trọng số đầy đủ, tạo run mới dùng `continue` từ thư mục đó.
      Nếu chưa lưu được checkpoint hoàn chỉnh, chạy `new` lại. Không xóa run cũ để ép chạy tiếp.
    - **Chưa có test_metrics:** chỉ có sau bước 9 thành công. Sửa lỗi train trước; notebook sẽ báo trạng thái thay vì đọc file chưa có.

    Tài liệu: [PhoBERT](https://github.com/VinAIResearch/PhoBERT),
    [Transformers 4.57.6](https://pypi.org/project/transformers/4.57.6/),
    [Tokenizers 0.22.2](https://pypi.org/project/tokenizers/0.22.2/).
    ''')]
    notebook = {'nbformat':4, 'nbformat_minor':5,
        'metadata':{'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'},
                    'language_info':{'name':'python'}, 'colab':{'name':f'0{1 if task == "a" else 2}_train_model_{task}.ipynb'}, 'accelerator':'GPU'},
        'cells':cells}
    for index, cell in enumerate(cells):
        cell['id'] = f'{task}-cell-{index:02d}'
        if cell['cell_type'] == 'code':
            compile(''.join(cell['source']), f'{task}:{index}', 'exec')
    path = OUTPUT / f'0{1 if task == "a" else 2}_train_model_{task}.ipynb'
    path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(path.name, len(cells), 'cells')


if __name__ == '__main__':
    for task in ['a', 'b']:
        build(task)
