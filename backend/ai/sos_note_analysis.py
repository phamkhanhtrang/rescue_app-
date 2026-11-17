"""
ai/sos_note_analysis.py
=======================
Cho Model A/B đọc phần ghi chú của SOS gửi từ app.

Nguyên tắc: AI chỉ BỔ SUNG thông tin và GẮN CỜ để admin xem. Nó không bao giờ
loại bỏ, ẩn hay hạ mức ưu tiên của một SOS:
  - Ghi chú trống hoặc quá ngắn là bình thường khi người dân đang gặp nguy.
  - Model A học phân biệt "lời nhờ giúp" trên bài mạng xã hội, không phải
    phát hiện tin giả.

Kết quả lưu ở `SOSSignal.ai_analysis`.
"""

import logging
import re
import unicodedata

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Loại người dân chọn trên app (mã hoặc chữ) → nhóm nhu cầu của Model A.
# 'OTHER' và loại lạ không ánh xạ được nên không dùng để so khớp.
TYPE_KEYWORDS = {
    'RESCUE':     ['rescue', 'cứu người', 'cứu hộ', 'cứu nạn', 'mắc kẹt', 'lũ', 'lụt', 'ngập', 'sạt lở', 'fire', 'hỏa hoạn', 'cháy'],
    'MEDICAL':    ['medical', 'y tế', 'cấp cứu', 'thương'],
    'EVACUATION': ['evacuation', 'sơ tán', 'di dời', 'di tản'],
    'SUPPLY':     ['supply', 'food', 'thực phẩm', 'nhu yếu phẩm', 'lương thực', 'tiếp tế', 'nước uống'],
}

# Ghi chú cho thấy người gửi tự nói đây không phải tình huống thật.
NOT_REAL_PATTERN = re.compile(
    r'\b(test|testing|thử nghiệm|thử app|thử ứng dụng|bấm nhầm|ấn nhầm|nhấn nhầm|gửi nhầm|nhầm nút|demo)\b', re.I)

NUMBER_WORDS = {'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5, 'sáu': 6,
                'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10}

# Các nguồn mà ghi chú không phải lời người dân tự gõ.
SKIPPED_SOURCES = {'AI_CRAWL', 'BLE_OFFLINE'}


def extract_note_text(note: str) -> str:
    """Bỏ phần đầu "[Tên: ... | SĐT: ...]" do hệ thống tự thêm, giữ lời người dân."""
    text = unicodedata.normalize('NFC', note or '')
    text = re.sub(r'^\s*(?:\[[^\]]*\]\s*)+', '', text)
    return text.replace('_', ' ').strip()


def needs_of_type(emergency_type: str) -> list:
    value = (emergency_type or '').casefold()
    return [need for need, words in TYPE_KEYWORDS.items() if any(w in value for w in words)]


def people_count_in(entities: list):
    """Trả về số người nêu trong ghi chú nếu chỉ có đúng một con số rõ ràng."""
    counts = []
    for entity in entities:
        if entity.get('label') != 'PEOPLE_COUNT':
            continue
        match = re.match(r'\s*(\d+|' + '|'.join(NUMBER_WORDS) + r')\b', entity.get('text', '').casefold())
        if match:
            word = match.group(1)
            counts.append(int(word) if word.isdigit() else NUMBER_WORDS[word])
    return counts[0] if len(counts) == 1 else None


def build_analysis(text: str, prediction: dict, emergency_type: str = None, people_count: int = None) -> dict:
    """Chuyển dự đoán của hai model thành thông tin bổ sung + cờ cho admin."""
    entities = prediction.get('entities', [])

    def spans(label):
        return list(dict.fromkeys(e['text'] for e in entities if e.get('label') == label))

    # Chỉ dùng nhu cầu khi model coi ghi chú là lời nhờ giúp. `candidate_needs`
    # giữ lại để admin tham khảo khi ghi chú chỉ là câu mô tả.
    needs = list(prediction.get('needs') or [])
    chosen = needs_of_type(emergency_type)
    flags, messages = [], []

    suggested = [n for n in needs if n not in chosen] if chosen else []
    if suggested:
        flags.append('TYPE_MISMATCH')
        messages.append('Ghi chú cho thấy thêm nhu cầu khác với loại đã chọn.')

    noted_count = people_count_in(entities)
    if noted_count is not None and people_count is not None and noted_count != int(people_count):
        flags.append('PEOPLE_COUNT_MISMATCH')
        messages.append(f'Ghi chú nêu {noted_count} người, khác số đã nhập ({people_count}).')

    vulnerable = spans('VULNERABLE_GROUP')
    if vulnerable:
        flags.append('VULNERABLE_GROUP')
    if prediction.get('guardrail_applied') == 'EMERGENCY_OVERRIDE' or prediction.get('emergency_detected'):
        flags.append('EMERGENCY_KEYWORDS')
        messages.append('Ghi chú có dấu hiệu nguy hiểm tới tính mạng.')

    # Cờ "cần kiểm tra" chỉ bật khi chính nội dung nói đây không phải tình huống
    # thật (thử app, bấm nhầm, quảng cáo...). Điểm model thấp KHÔNG bật cờ này.
    if NOT_REAL_PATTERN.search(text) or str(prediction.get('guardrail_applied', '')).startswith('NON_REQUEST_FILTER'):
        flags.append('NEEDS_CHECK')
        messages.append('Nội dung ghi chú có vẻ không phải yêu cầu cứu trợ; cần kiểm tra trước khi xử lý.')

    return {
        'status': 'ok',
        'source': 'model',
        'method': prediction.get('method'),
        'model_versions': prediction.get('model_versions', []),
        'analyzed_at': timezone.now().isoformat(),
        'is_request': bool(prediction.get('is_request')),
        'request_score': prediction.get('request_score'),
        'decision_source': prediction.get('decision_source'),
        'needs': needs,
        'candidate_needs': list(prediction.get('candidate_needs') or []),
        'need_scores': prediction.get('need_scores', {}),
        'suggested_needs': suggested,
        'vulnerable_groups': vulnerable,
        'resources': spans('RESOURCE'),
        'locations': spans('LOCATION'),
        'people_count_in_note': noted_count,
        'flags': flags,
        'messages': messages,
    }


def analyze_note(note: str, emergency_type: str = None, people_count: int = None) -> dict:
    """Phân tích một ghi chú. Không ném lỗi: lỗi trả về dạng status."""
    now = timezone.now().isoformat()
    text = extract_note_text(note)
    if len(re.sub(r'[\W\d_]+', '', text)) < 3:
        return {'status': 'empty', 'analyzed_at': now, 'flags': [], 'messages': []}
    try:
        from .sos_article_analysis import predict_article
        prediction = predict_article('', text[:4000])
    except Exception as exc:
        logger.warning('[SOS Note] Không phân tích được ghi chú: %s', exc)
        return {'status': 'unavailable', 'analyzed_at': now, 'flags': [], 'messages': [],
                'error': 'Hai model chưa sẵn sàng hoặc ghi chú không phân tích được.'}
    return build_analysis(text, prediction, emergency_type, people_count)


def analyze_sos_note(sos_id) -> dict:
    """Phân tích ghi chú của một SOS và lưu vào `ai_analysis`. Trả về kết quả."""
    from rescue_operations.models import SOSSignal

    if not getattr(settings, 'SOS_NOTE_ANALYSIS_ENABLED', True):
        return {}
    sos = SOSSignal.objects.filter(pk=sos_id).first()
    if sos is None or sos.signal_type != 'SOS' or sos.location_source in SKIPPED_SOURCES:
        return {}
    if (sos.ai_analysis or {}).get('source') == 'admin_review':
        return sos.ai_analysis

    result = analyze_note(sos.note, sos.emergency_type, sos.people_count)
    # update() chỉ ghi đúng một cột, không đè lên thay đổi khác xảy ra trong lúc model chạy.
    SOSSignal.objects.filter(pk=sos_id).update(ai_analysis=result)
    return result
