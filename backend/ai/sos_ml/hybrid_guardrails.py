"""Module Hybrid Guardrails cho hệ thống AI Cứu hộ.

Cung cấp các quy tắc an toàn cấp hệ thống (Production Guardrails):
1. Chặn False Positive (Tin từ thiện/quyên góp/kinh doanh/thời tiết thông thường).
2. Cứu nguy False Negative (Emergency Override cho các trường hợp sinh tử khẩn cấp).
3. Hậu xử lý thực thể NER (Phân biệt số người vs số hàng hóa, bổ sung địa chỉ thật).
"""
import re
from typing import Dict, List, Any, Tuple


# ─── 1. BỘ TỪ KHÓA NGUY CẤP SINH TỬ (EMERGENCY OVERRIDE) ─────────────────────
EMERGENCY_RESCUE_PATTERNS = [
    re.compile(r'(cứu|giải cứu|cứu hộ)\s+(với|giúp|gấp|khẩn|nhanh|ngay|hộ|em|nhà|bà con)', re.I),
    re.compile(r'(ngập|nước)\s+(lên|tới|đến|ngang)\s+(cổ|ngực|mũi|nóc|mái|trần|gác|đầu)', re.I),
    re.compile(r'(kẹt|mắc kẹt)\s+(trên|ở|trong)\s+(mái|nóc|gác|cột|ngọn cây|tầng 2|tầng 3)', re.I),
    re.compile(r'(chìm|lật|thủng|trôi)\s+(thuyền|cano|ca nô|xuồng|bè|nhà)', re.I),
    re.compile(r'sắp\s+(sập|trôi|chìm|ngập hết)\s+(nhà|thuyền|cano)?', re.I),
    re.compile(r'nước\s+(xiết|chảy xiết|lên nhanh|dâng cao|dâng sắp chạm trần)', re.I),
]

EMERGENCY_MEDICAL_PATTERNS = [
    re.compile(r'(bà bầu|sản phụ|mẹ bầu|phụ nữ mang thai)\s+(sắp sinh|chuyển dạ|đau đẻ|vỡ ối)', re.I),
    re.compile(r'(thở oxy|thở máy|tai biến|đột quỵ|ngừng tim|ngất xỉu|co giật|bị thương nặng)', re.I),
    re.compile(r'(người già|cụ già|bé sơ sinh|trẻ nhỏ)\s+(đang sốt cao|kiệt sức|hôn mê|nguy kịch)', re.I),
]


# ─── 2. BỘ TỪ KHÓA TỪ THIỆN / BÁN HÀNG / THỜI TIẾT (NON-REQUEST FILTER) ───────
DONATION_PATTERNS = [
    re.compile(r'(gom được|quyên góp|ủng hộ|phát tâm|tài trợ|gửi tặng|phát miễn phí|tặng bà con)', re.I),
    re.compile(r'(chia sẻ|san sẻ)\s+(với bà con|khó khăn|đồng bào)', re.I),
    re.compile(r'bếp ăn\s+(0 đồng|từ thiện|miễn phí)', re.I),
    re.compile(r'(ai cần|hộ nào cần)\s+(nhận|liên hệ|đăng ký|qua lấy)', re.I),
    re.compile(r'(muốn|sẵn sàng)\s+(ủng hộ|giúp đỡ|tặng|tiếp tế)', re.I),
    re.compile(r'ủng hộ\s+(bà con|đồng bào|miền trung|tiền|mì tôm|lương thực|quần áo)', re.I),
    re.compile(r'điểm\s+tập kết\s+(hàng|quà|nhu yếu phẩm)', re.I),
]

COMMERCIAL_PATTERNS = [
    re.compile(r'(bán|thanh lý|cho thuê|cung cấp|báo giá|bảng giá|sỉ lẻ)\s+(áo phao|thuyền|xuồng|cano|đèn pin|ắc quy|phao|máy phát)', re.I),
    re.compile(r'(ship|giao hàng)\s+(toàn quốc|hỏa tốc|trong ngày|qua quận|tận nơi)', re.I),
    re.compile(r'shop\s+(mình|em|chúng tôi)\s+(có|bán|nhận|về hàng)', re.I),
    re.compile(r'giá\s+(chỉ\s+\d+|cực rẻ|ưu đãi|công khai)', re.I),
]

GENERAL_WEATHER_PATTERNS = [
    re.compile(r'tình hình\s+(mưa lũ|thời tiết|nước rút|bão|mực nước)', re.I),
    re.compile(r'bản tin\s+(dự báo|cảnh báo|thời tiết|thủy văn)', re.I),
    re.compile(r'cập nhật\s+(mực nước|tình hình|thông tin)', re.I),
    re.compile(r'mực nước\s+(đang rút|đã giảm|xuống dần)', re.I),
]


# ─── 3. PATTERNS TRÍCH XUẤT THỰC THỂ BỔ TRỢ (REGEX NER) ────────────────────────
LOCATION_REGEXES = [
    # Số nhà, ngõ ngách, tên đường
    re.compile(r'(?:số\s+\d+[a-zA-Z]?\s+)?(?:ngõ|ngách|hẻm)\s+\d+[a-zA-Z]?(?:\s+(?:đường|phố)?\s+[A-ZÀ-Ỹa-zà-ỹ0-9\s]+)?', re.I),
    re.compile(r'số\s+\d+[a-zA-Z]?\s+(?:đường|phố)?\s+[A-ZÀ-Ỹa-zà-ỹ0-9\s]+', re.I),
    # Cụm địa giới hành chính
    re.compile(r'(?:thôn|xóm|bản|tổ|ấp)\s+[0-9A-ZÀ-Ỹa-zà-ỹ\s]+?(?=(?:,|\.|\n|\s+(?:xã|phường|huyện|quận)|$))', re.I),
    re.compile(r'(?:xã|phường|thị trấn)\s+[A-ZÀ-Ỹa-zà-ỹ\s]+?(?=(?:,|\.|\n|\s+(?:huyện|quận|tỉnh|tp)|$))', re.I),
    re.compile(r'(?:quận|huyện|thị xã)\s+[A-ZÀ-Ỹa-zà-ỹ\s]+?(?=(?:,|\.|\n|\s+(?:tỉnh|tp)|$))', re.I),
    re.compile(r'(?:tỉnh|thành phố|tp\.?)\s+[A-ZÀ-Ỹa-zà-ỹ\s]+?(?=(?:,|\.|\n|$))', re.I),
]

PEOPLE_COUNT_REGEX = re.compile(
    r'(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+(?:người|thành viên|mẹ con|cháu nhỏ|nhân khẩu|nạn nhân)',
    re.I
)

MERCHANDISE_UNITS = {
    'thùng', 'hộp', 'chiếc', 'cái', 'suất', 'phần', 'áo', 'kg', 'tấn',
    'bịch', 'gói', 'lon', 'chai', 'bình', 'bao', 'triệu', 'nghìn', 'đồng'
}

VULNERABLE_REGEX = re.compile(
    r'(bà bầu|sản phụ|phụ nữ mang thai|mẹ bầu|trẻ sơ sinh|bé sơ sinh|trẻ nhỏ|cháu nhỏ|người già|cụ già|ông bà cụ|người khuyết tật|liệt giường|tai biến|bệnh nhân)',
    re.I
)

RESOURCE_REGEX = re.compile(
    r'(thuyền|cano|ca nô|xuồng|áo phao|phao cứu sinh|mì tôm|lương thực|thực phẩm|nước uống|nước sạch|nước ngọt|thuốc men|băng gạc|đèn pin|sạc dự phòng|chăn ấm)',
    re.I
)


def is_asking_help(text: str) -> bool:
    """Kiểm tra câu có thực sự đang ngỏ lời nhờ giúp đỡ hay không."""
    pattern = re.compile(
        r'(cứu|giúp|xin|nhờ|cần|hỗ trợ|mắc kẹt|kẹt|ngập)\s+(với|giúp|nhà|em|chúng tôi|bà con|cho|khẩn cấp|ngay|gấp)',
        re.I
    )
    return bool(pattern.search(text))


def check_emergency(text: str) -> Tuple[bool, List[str]]:
    """Phát hiện tình huống cứu nạn khẩn cấp đe dọa tính mạng."""
    suggested = []
    for pat in EMERGENCY_RESCUE_PATTERNS:
        if pat.search(text):
            suggested.append('RESCUE')
            break
    for pat in EMERGENCY_MEDICAL_PATTERNS:
        if pat.search(text):
            suggested.append('MEDICAL')
            break
    return (len(suggested) > 0, suggested)


def check_non_request(text: str) -> Tuple[bool, str]:
    """Phát hiện tin không phải yêu cầu cứu trợ (Từ thiện, Bán hàng, Dự báo thời tiết)."""
    # Nếu câu có dấu hiệu kêu cứu rõ ràng thì không bị chặn
    if is_asking_help(text):
        return (False, '')

    for pat in DONATION_PATTERNS:
        if pat.search(text):
            return (True, 'DONATION')

    for pat in COMMERCIAL_PATTERNS:
        if pat.search(text):
            return (True, 'COMMERCIAL')

    for pat in GENERAL_WEATHER_PATTERNS:
        if pat.search(text):
            return (True, 'WEATHER_INFO')

    return (False, '')


def refine_entities(text: str, existing_entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sửa lỗi và bổ sung các thực thể bóc tách:
    - Chuyển PEOPLE_COUNT nhầm sang RESOURCE nếu đi kèm đơn vị hàng hóa (ví dụ: 500 thùng mì).
    - Bổ sung các thực thể còn thiếu bằng Regex nếu chưa có trong kết quả model.
    """
    entities = []

    # 1. Sửa lỗi trên thực thể do model trả về
    for ent in existing_entities:
        label = ent.get('label')
        ent_text = ent.get('text', '')
        start = ent.get('start', 0)
        end = ent.get('end', 0)

        if label == 'PEOPLE_COUNT':
            # Kiểm tra từ ngữ ngay sau cụm từ này trong text
            after_text = text[end:end + 20].strip().lower()
            words_after = after_text.split()
            first_word_after = words_after[0] if words_after else ''

            # Hoặc bản thân ent_text chứa đơn vị hàng hóa
            contains_merch = any(u in ent_text.lower() for u in MERCHANDISE_UNITS)
            follows_merch = first_word_after in MERCHANDISE_UNITS

            if contains_merch or follows_merch:
                # Đổi sang RESOURCE thay vì PEOPLE_COUNT
                entities.append({
                    'start': start,
                    'end': end,
                    'label': 'RESOURCE',
                    'text': ent_text
                })
                continue

        entities.append(ent)

    # Hàm kiểm tra trùng lặp vị trí span
    def overlaps(s, e):
        return any(not (e <= existing['start'] or s >= existing['end']) for existing in entities)

    # 2. Bổ sung PEOPLE_COUNT bằng Regex nếu sót
    for m in PEOPLE_COUNT_REGEX.finditer(text):
        s, e = m.start(), m.end()
        if not overlaps(s, e):
            entities.append({
                'start': s,
                'end': e,
                'label': 'PEOPLE_COUNT',
                'text': text[s:e]
            })

    # 3. Bổ sung VULNERABLE_GROUP bằng Regex nếu sót
    for m in VULNERABLE_REGEX.finditer(text):
        s, e = m.start(), m.end()
        if not overlaps(s, e):
            entities.append({
                'start': s,
                'end': e,
                'label': 'VULNERABLE_GROUP',
                'text': text[s:e]
            })

    # 4. Bổ sung RESOURCE bằng Regex nếu sót
    for m in RESOURCE_REGEX.finditer(text):
        s, e = m.start(), m.end()
        if not overlaps(s, e):
            entities.append({
                'start': s,
                'end': e,
                'label': 'RESOURCE',
                'text': text[s:e]
            })

    # 5. Bổ sung LOCATION bằng Regex nếu sót
    for reg in LOCATION_REGEXES:
        for m in reg.finditer(text):
            s, e = m.start(), m.end()
            val = text[s:e].strip(' ,.')
            if len(val) >= 4 and not overlaps(s, s + len(val)):
                entities.append({
                    'start': s,
                    'end': s + len(val),
                    'label': 'LOCATION',
                    'text': val
                })

    # Sắp xếp các entities theo thứ tự start tăng dần
    entities.sort(key=lambda x: x['start'])
    return entities


def apply_guardrails(clean_text: str, model_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Áp dụng toàn bộ quy tắc Guardrails lên kết quả dự đoán của PhoBERT.
    Đánh dấu minh bạch xem quyết định là do Model PhoBERT hay do Rule can thiệp.
    """
    raw_model_score = model_result.get('request_score')
    raw_model_is_request = model_result.get('is_request')
    model_result['raw_model_score'] = raw_model_score
    model_result['raw_model_is_request'] = raw_model_is_request

    decision_source = 'MODEL'
    decision_detail = 'Kết quả 100% do Model PhoBERT tự phân tích và dự đoán.'

    # 1. Kiểm tra tình huống yêu cầu hỗ trợ (Model A)
    if 'is_request' in model_result:
        is_urg, urg_needs = check_emergency(clean_text)

        if is_urg:
            # Nếu model ĐÃ TỰ ĐOÁN ĐÚNG (is_request == True và score >= 0.70)
            if raw_model_is_request and (raw_model_score is not None and raw_model_score >= 0.70):
                decision_source = 'MODEL'
                decision_detail = f'Model PhoBERT tự nhận diện chính xác yêu cầu khẩn cấp (điểm số: {raw_model_score*100:.1f}%). Rule không cần can thiệp.'
                existing_needs = list(model_result.get('needs', []))
                for un in urg_needs:
                    if un not in existing_needs:
                        existing_needs.append(un)
                model_result['needs'] = existing_needs
            else:
                # MODEL ĐOÁN SÓT HOẶC ĐIỂM THẤP -> Rule cứu nguy khẩn cấp
                decision_source = 'RULE_FALLBACK'
                score_str = f"{raw_model_score*100:.1f}%" if raw_model_score is not None else "thấp"
                decision_detail = f'Model PhoBERT cho điểm thấp ({score_str}) hoặc bỏ sót. Rule Cứu nguy khẩn cấp đã can thiệp kích hoạt để bảo đảm tính mạng.'
                model_result['is_request'] = True
                model_result['request_score'] = max(raw_model_score or 0.0, 0.95)

                existing_needs = list(model_result.get('needs', []))
                for un in urg_needs:
                    if un not in existing_needs:
                        existing_needs.append(un)
                model_result['needs'] = existing_needs

                need_scores = dict(model_result.get('need_scores', {}))
                for un in urg_needs:
                    need_scores[un] = max(need_scores.get(un, 0.0), 0.95)
                model_result['need_scores'] = need_scores
                model_result['guardrail_applied'] = 'EMERGENCY_OVERRIDE'

        # 2. Kiểm tra tin từ thiện / bán hàng / tin tức thông thường (Non-request Filter)
        else:
            is_non_req, reason = check_non_request(clean_text)
            if is_non_req:
                # Nếu model bị nhầm lẫn và cho điểm cao (False Positive)
                if raw_model_is_request:
                    decision_source = 'RULE_FILTER'
                    reason_vn = 'tin ủng hộ/từ thiện' if reason == 'DONATION' else ('tin bán hàng/dịch vụ' if reason == 'COMMERCIAL' else 'bản tin thời tiết')
                    score_str = f"{raw_model_score*100:.1f}%" if raw_model_score is not None else "cao"
                    decision_detail = f'Model PhoBERT chấm nhầm ({score_str}). Rule đã can thiệp chặn vì đây là {reason_vn}.'
                    model_result['is_request'] = False
                    model_result['request_score'] = min(raw_model_score or 1.0, 0.12)
                    model_result['needs'] = []
                    model_result['guardrail_applied'] = f'NON_REQUEST_FILTER_{reason}'
                else:
                    # Model cũng đã tự đoán là False
                    decision_source = 'MODEL'
                    score_str = f"{raw_model_score*100:.1f}%" if raw_model_score is not None else "thấp"
                    decision_detail = f'Model PhoBERT tự nhận diện chính xác đây không phải yêu cầu cứu hộ (điểm số: {score_str}).'
            else:
                decision_source = 'MODEL'
                score_str = f"{raw_model_score*100:.1f}%" if raw_model_score is not None else "0.0%"
                decision_detail = f'Kết quả hoàn toàn do Model PhoBERT dự đoán (điểm số: {score_str}).'

    model_result['decision_source'] = decision_source
    model_result['decision_detail'] = decision_detail

    # 3. Tinh chỉnh thực thể NER
    if 'entities' in model_result:
        model_result['entities'] = refine_entities(clean_text, model_result['entities'])

    return model_result
