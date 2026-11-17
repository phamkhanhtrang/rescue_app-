"""
ai/dataset_export.py
====================
Biến các bài Facebook admin đã duyệt thành dữ liệu THỰC cho Model A/B, theo đúng
định dạng Excel của notebook huấn luyện.

Nguồn nhãn:
  - Duyệt tạo SOS          → is_request = 1, needs = nhu cầu admin đã chọn.
  - Từ chối + xác nhận "không phải yêu cầu cứu trợ" → is_request = 0.
  - Từ chối vì lý do khác (tin cũ, trùng…) KHÔNG dùng, vì không nói lên nhãn.

Chia tập theo mã băm của group_id nên một bài luôn rơi vào cùng một tập ở mọi
lần xuất: bài đã vào Test không bao giờ lọt sang Train ở lần xuất sau.

Model A: nhãn là quyết định trực tiếp của admin → reviewed = 1, dùng được ngay.
Model B: admin chỉ xác nhận thông tin cần để tạo SOS, không gắn nhãn đủ mọi cụm
         từ trong bài → chỉ xuất BẢN NHÁP đã đánh dấu sẵn, người gắn nhãn phải
         kiểm tra lại rồi mới chuyển vào Train/Test với reviewed = 1.
"""

import hashlib
import re
import unicodedata

from .sos_article_analysis import article_text

MAX_WORDS = 150          # Xấp xỉ giới hạn 256 BPE của PhoBERT; bài dài hơn cần người tách tay
COLUMNS_A = ['id', 'group_id', 'text', 'is_request', 'needs', 'origin', 'reviewed', 'source']
COLUMNS_B = ['id', 'group_id', 'text_annotated', 'origin', 'reviewed', 'source', 'can_kiem_tra']
NUMBER_WORDS = ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười']


def clean_text(title, content) -> str:
    """Văn bản một dòng, NFC, không có ký tự làm hỏng cú pháp [NHÃN|cụm] hay bộ tách từ."""
    text = unicodedata.normalize('NFC', article_text(title, content))
    text = text.replace('_', ' ').replace('[', '(').replace(']', ')').replace('|', '/')
    return re.sub(r'\s+', ' ', text).strip()


SPLITS = ['Train', 'Validation', 'Test']


def split_of(group_id: str, test_percent: int, validation_percent: int = 0) -> str:
    bucket = int(hashlib.sha256(group_id.encode('utf-8')).hexdigest()[:8], 16) % 100
    if bucket < test_percent:
        return 'Test'
    return 'Validation' if bucket < test_percent + validation_percent else 'Train'


def _find(text: str, phrase: str, taken: list):
    """Vị trí đầu tiên của phrase trong text (không phân biệt hoa thường) chưa bị cụm khác chiếm."""
    phrase = re.sub(r'\s+', ' ', str(phrase or '')).strip()
    if not phrase:
        return None
    for match in re.finditer(re.escape(phrase), text, flags=re.I):
        a, b = match.span()
        if all(b <= s or a >= e for s, e, _ in taken):
            return a, b
    return None


def annotate(text: str, article) -> tuple:
    """
    Đánh dấu sẵn các cụm admin đã xác nhận mà tìm thấy nguyên văn trong bài.
    Returns: (text_annotated, danh sách ghi chú những gì người gắn nhãn cần kiểm tra)
    """
    reviewed = article.reviewed_analysis or {}
    predicted = [e for e in (article.ai_analysis or {}).get('entities', []) if isinstance(e, dict)]
    spans, notes = [], []

    def mark(label, phrase, required=True):
        position = _find(text, phrase, spans)
        if position:
            spans.append((*position, label))
        elif required:
            notes.append(f'{label} "{phrase}" không có nguyên văn trong bài')

    for phrase in reviewed.get('vulnerable_groups', []):
        mark('VULNERABLE_GROUP', phrase)
    for phrase in reviewed.get('resources', []):
        mark('RESOURCE', phrase)

    # Địa điểm: chỉ nhận cụm Model B đoán mà admin giữ lại trong địa chỉ đã xác nhận.
    address = f'{article.extracted_address or ""} {article.extracted_location or ""}'.casefold()
    located = False
    for entity in predicted:
        if entity.get('label') == 'LOCATION' and str(entity.get('text', '')).casefold() in address:
            before = len(spans)
            mark('LOCATION', entity['text'], required=False)
            located = located or len(spans) > before
    if address.strip() and not located:
        notes.append('Chưa đánh dấu được LOCATION; địa chỉ admin nhập: ' +
                     (article.extracted_address or article.extracted_location or ''))

    count = article.extracted_people_count
    if count:
        number = str(count) if count > 10 else f'(?:{count}|{NUMBER_WORDS[count - 1]})'
        match = re.search(rf'\b{number}\s+(?:người|nạn nhân)\b', text, flags=re.I)
        if match and all(match.end() <= s or match.start() >= e for s, e, _ in spans):
            spans.append((match.start(), match.end(), 'PEOPLE_COUNT'))

    annotated = text
    for start, end, label in sorted(spans, reverse=True):
        annotated = f'{annotated[:start]}[{label}|{annotated[start:end]}]{annotated[end:]}'
    notes.append('Kiểm tra các cụm còn thiếu rồi đặt reviewed=1')
    return annotated, notes


def build_rows(articles, test_percent: int = 25, validation_percent: int = 15) -> dict:
    """
    Returns:
        {'a': {'Train': [...], 'Validation': [...], 'Test': [...]}, 'b': {...}, 'skipped': [(id, lý do), ...]}
    """
    result = {'a': {name: [] for name in SPLITS}, 'b': {name: [] for name in SPLITS}, 'skipped': []}
    seen = set()
    for article in articles:
        reviewed = article.reviewed_analysis or {}
        if not isinstance(reviewed.get('is_request'), bool):
            continue
        text = clean_text(article.raw_title, article.raw_content)
        short_id = article.id.hex[:12]
        if not text:
            result['skipped'].append((short_id, 'Bài trống'))
            continue
        if len(text.split()) > MAX_WORDS:
            result['skipped'].append((short_id, f'Dài hơn {MAX_WORDS} từ; cần tách tay thành các đoạn ngắn'))
            continue
        fingerprint = text.casefold()
        if fingerprint in seen:
            result['skipped'].append((short_id, 'Trùng nội dung với bài khác'))
            continue
        seen.add(fingerprint)

        group_id = f'fb-{article.facebook_post_id or short_id}'
        split = split_of(group_id, test_percent, validation_percent)
        is_request = reviewed['is_request']
        base = {'id': f'fb-{short_id}', 'group_id': group_id, 'origin': 'real', 'source': article.source_url}

        result['a'][split].append({**base, 'text': text, 'is_request': int(is_request),
                                   'needs': ';'.join(reviewed.get('needs', [])) if is_request else '',
                                   'reviewed': 1})
        if is_request:
            annotated, notes = annotate(text, article)
        else:
            annotated, notes = text, ['Mẫu âm tính: không đánh dấu thông tin. Kiểm tra rồi đặt reviewed=1']
        result['b'][split].append({**base, 'text_annotated': annotated, 'reviewed': 0,
                                   'can_kiem_tra': '; '.join(notes)})
    return result


def write_workbook(path, sheets: dict, guide: list):
    """sheets: {'Tên sheet': (danh sách cột, [dict, ...])}. Luôn tạo đủ sheet kể cả khi rỗng."""
    from openpyxl import Workbook

    workbook = Workbook()
    workbook.remove(workbook.active)
    for name, (columns, rows) in sheets.items():
        sheet = workbook.create_sheet(name)
        sheet.append(columns)
        for row in rows:
            sheet.append([row.get(column, '') for column in columns])
    sheet = workbook.create_sheet('Huong_dan')
    for line in guide:
        sheet.append([line])
    workbook.save(path)


def read_sheet_rows(path, sheet: str) -> list:
    """Đọc một sheet thành list dict theo dòng tiêu đề; sheet không tồn tại trả về []."""
    from openpyxl import load_workbook

    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        if sheet not in workbook.sheetnames:
            return []
        iterator = workbook[sheet].iter_rows(values_only=True)
        headers = [str(h) if h is not None else '' for h in next(iterator, ())]
        return [dict(zip(headers, values)) for values in iterator
                if not all(v is None or v == '' for v in values)]
    finally:
        workbook.close()


def keep_checked_drafts(path, drafts: dict) -> dict:
    """
    Giữ lại các dòng người gắn nhãn đã sửa trong bản nháp Model B của lần xuất trước:
    dòng nào đã có trong file cũ (theo id) thì dùng lại nguyên văn, chỉ thêm bài mới.
    """
    from pathlib import Path

    if not Path(path).is_file():
        return drafts
    result = {}
    for name, rows in drafts.items():
        previous = {str(row.get('id')): row for row in read_sheet_rows(path, 'Nhap_' + name)}
        result[name] = [previous.get(row['id'], row) for row in rows]
    return result


def build_real_workbook(source_xlsx, real: dict, output_xlsx) -> dict:
    """
    Tạo Excel cho vòng train trên dữ liệu thật, đúng định dạng notebook yêu cầu với
    EVALUATION_DOMAIN=real_vietnamese:
        Train      = toàn bộ Train của Excel gốc (câu tổng hợp) + bài thật phần Train
        Validation = chỉ bài thật
        Test       = chỉ bài thật
    Không sửa file gốc. Returns: số dòng thật ở mỗi sheet.
    """
    from openpyxl import load_workbook

    workbook = load_workbook(source_xlsx)
    counts = {}
    for name in SPLITS:
        sheet = workbook[name]
        headers = [cell.value for cell in sheet[1]]
        if name == 'Train':
            id_column = headers.index('id')
            existing = {str(row[id_column]) for row in sheet.iter_rows(min_row=2, values_only=True) if row[id_column]}
        else:
            if sheet.max_row > 1:
                sheet.delete_rows(2, sheet.max_row - 1)
            existing = set()
        rows = [row for row in real[name] if str(row['id']) not in existing]
        for row in rows:
            sheet.append([row.get(header, '') for header in headers])
        counts[name] = len(rows)
    workbook.save(output_xlsx)
    return counts
