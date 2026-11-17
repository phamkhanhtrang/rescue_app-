"""Module chuẩn hóa văn bản tiếng Việt & dịch Teencode cho hệ thống cứu hộ.

Chuẩn hóa các bài viết, tin nhắn cứu nạn từ mạng xã hội (Facebook, Zalo, App)
về dạng tiếng Việt chuẩn để mô hình PhoBERT và các bộ trích xuất thông tin
đạt độ chính xác cao nhất.
"""
import re
import unicodedata

# ─── BẢNG TỪ ĐIỂN ÁNH XẠ TEENCODE & VIẾT TẮT TIẾNG VIỆT ───────────────────────
TEENCODE_DICT = {
    # Đại từ, xưng hô
    "mn": "mọi người",
    "mng": "mọi người",
    "mọi ng": "mọi người",
    "ngta": "người ta",
    "ng": "người",
    "nguoi": "người",
    "e": "em",
    "mk": "mình",
    "mik": "mình",
    "t": "tôi",
    "tui": "tôi",
    "ad": "admin",
    "b": "bạn",
    "cj": "chị",
    "aj": "ai",
    # Từ ngữ cứu nạn & thời tiết khẩn cấp
    "nc": "nước",
    "nuoc": "nước",
    "cuu": "cứu",
    "giup": "giúp",
    "ngap": "ngập",
    "noc": "nóc",
    "mai": "mái",
    "gac": "gác",
    "lung": "lửng",
    "tran": "trần",
    "troi": "trời",
    "thuyen": "thuyền",
    "phao": "phao",
    "cano": "ca nô",
    "xuong": "xuồng",
    "can": "cần",
    "gap": "gấp",
    "khan": "khẩn",
    "chua": "chưa",
    "chet": "chết",
    "ret": "rét",
    "lanh": "lạnh",
    "chim": "chìm",
    "thung": "thủng",
    "sap": "sắp",
    "suyt": "suýt",
    "nhanh": "nhanh",
    "xiet": "xiết",
    "sdt": "số điện thoại",
    "sđt": "số điện thoại",
    "dt": "điện thoại",
    "đt": "điện thoại",
    "mi tom": "mì tôm",
    "luong thuc": "lương thực",
    "thuc pham": "thực phẩm",
    # Ngữ pháp & trạng từ thông dụng
    "vs": "với",
    "voi": "với",
    "k": "không",
    "ko": "không",
    "kh": "không",
    "hok": "không",
    "khong": "không",
    "hổng": "không",
    "dc": "được",
    "đc": "được",
    "dk": "được",
    "duoc": "được",
    "r": "rồi",
    "roi": "rồi",
    "đg": "đang",
    "dg": "đang",
    "dang": "đang",
    "th": "thôi",
    "thoii": "thôi",
    "j": "gì",
    "gi": "gì",
    "cx": "cũng",
    "cung": "cũng",
    "kb": "không biết",
    "trc": "trước",
    "truoc": "trước",
    "ns": "nói",
    "noi": "nói",
    "pk": "phải không",
    "chax": "chắc",
    "nt": "nhắn tin",
    "ib": "inbox",
    "fb": "facebook",
    "oi": "ơi",
    "den": "đến",
    "so": "số",
    "ngo": "ngõ",
    "ngach": "ngách",
    "hem": "hẻm",
    "thon": "thôn",
    "xa": "xã",
    "huyen": "huyện",
    "quan": "quận",
    "tinh": "tỉnh",
    "duong": "đường",
    "pho": "phố",
    "ket": "kẹt",
    "mac": "mắc",
    "nguc": "ngực",
    "co": "cổ",
    "nha": "nhà",
}

# Regex nhận diện từ tiếng Việt hoặc số
WORD_PATTERN = re.compile(r'\b[a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ0-9_]+\b')

# Regex co ký tự lặp kéo dài (ví dụ: cứuuuu -> cứu, ngậpppp -> ngập)
ELONGATED_PATTERN = re.compile(r'([a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ])\1{2,}')


def de_elongate(text: str) -> str:
    """Co ngắn ký tự lặp quá mức do người gõ kéo dài cảm xúc."""
    return ELONGATED_PATTERN.sub(r'\1', text)


def normalize_teencode(text: str) -> str:
    """Thay thế các từ viết tắt / teencode bằng tiếng Việt chuẩn."""
    def _replace(match):
        token = match.group(0)
        lower_token = token.lower()
        if lower_token in TEENCODE_DICT:
            replacement = TEENCODE_DICT[lower_token]
            if token.isupper():
                return replacement.upper()
            if token.istitle():
                return replacement.capitalize()
            return replacement
        return token

    return WORD_PATTERN.sub(_replace, text)


def clean_text_for_pipeline(text: str) -> str:
    """
    Chuẩn hóa văn bản hoàn chỉnh cho pipeline AI:
    1. Chuẩn hóa NFC Unicode
    2. Loại bỏ dấu gạch dưới '_' (tránh crash pyvi segmenter)
    3. Co ngắn ký tự kéo dài
    4. Dịch teencode
    5. Chuẩn hóa khoảng trắng
    """
    if not text:
        return ""

    # 1. NFC normalize
    text = unicodedata.normalize("NFC", str(text))

    # 2. Xóa underscore tránh lỗi segmenter pyvi
    text = text.replace("_", " ")

    # 3. Co ký tự kéo dài
    text = de_elongate(text)

    # 4. Thay thế teencode
    text = normalize_teencode(text)

    # 5. Xóa ký tự vô hình và chuẩn hóa khoảng trắng
    text = re.sub(r'[\r\t\f\v]', ' ', text)
    text = re.sub(r'\n+', '\n', text)
    text = re.sub(r'[ ]{2,}', ' ', text)

    return text.strip()


# Hai ký tự vùng dùng riêng của Unicode, không xuất hiện trong văn bản thật,
# dùng để đánh dấu tạm đầu/cuối cụm thực thể trong lúc chuẩn hóa.
_SPAN_OPEN, _SPAN_CLOSE = '', ''


def clean_marked_text(text: str, entities=None):
    """
    Chuẩn hóa văn bản huấn luyện giống hệt lúc hệ thống chạy thật, đồng thời tính lại
    vị trí các cụm thực thể (chuẩn hóa làm đổi độ dài câu: "ko" -> "không").

    Args:
        text:     văn bản gốc.
        entities: danh sách {'start', 'end', 'label', 'text'} trên văn bản gốc, không chồng nhau.

    Returns:
        (văn bản đã chuẩn hóa, danh sách thực thể với start/end/text trên văn bản mới)
    """
    entities = sorted(entities or [], key=lambda e: e['start'])
    if _SPAN_OPEN in text or _SPAN_CLOSE in text:
        raise ValueError('Văn bản chứa ký tự điều khiển không hỗ trợ.')
    cleaned = clean_text_for_pipeline(text)
    if not cleaned:
        raise ValueError('Văn bản trống sau khi chuẩn hóa.')
    if not entities:
        return cleaned, []

    marked, cursor = [], 0
    for entity in entities:
        marked += [text[cursor:entity['start']], _SPAN_OPEN, text[entity['start']:entity['end']], _SPAN_CLOSE]
        cursor = entity['end']
    marked.append(text[cursor:])
    marked = clean_text_for_pipeline(''.join(marked))

    plain, result, start = [], [], None
    length, labels = 0, iter(entities)
    for char in marked:
        if char == _SPAN_OPEN:
            start = length
        elif char == _SPAN_CLOSE:
            label = next(labels)['label']
            value = ''.join(plain)[start:length]
            # Chuẩn hóa có thể để lại khoảng trắng ở mép cụm (ví dụ "_" -> " ").
            left = len(value) - len(value.lstrip())
            value = value.strip()
            if value:
                result.append({'start': start + left, 'end': start + left + len(value), 'label': label, 'text': value})
            start = None
        else:
            plain.append(char)
            length += 1
    plain = ''.join(plain)
    # Dấu tạm chỉ được phép nằm ở ranh giới từ; nếu nó cắt giữa một từ thì câu
    # chuẩn hóa sẽ khác với câu hệ thống nhìn thấy lúc chạy thật.
    if plain != cleaned:
        raise ValueError('Nhãn cắt giữa một từ nên không chuẩn hóa được. Kiểm tra lại vị trí nhãn.')
    return cleaned, result
