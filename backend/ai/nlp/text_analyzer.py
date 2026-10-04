"""
ai/nlp/text_analyzer.py
=======================
Phân tích văn bản để trích xuất:
  - Loại sự cố (incident_type)
  - Mức độ nghiêm trọng (severity: CRITICAL / HIGH / MEDIUM / LOW)
  - Điểm tin cậy (confidence_score: 0.0 – 1.0)

Chiến lược:
  1. PRIMARY: PhoBERT fine-tuned (model thật, hiểu ngữ cảnh tiếng Việt)
  2. FALLBACK: Rule-based keyword matching (khi chưa cài model)
"""

import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    incident_type:    str
    severity:         str    # CRITICAL / HIGH / MEDIUM / LOW
    confidence_score: float  # 0.0 – 1.0
    method:           str    # 'phobert' | 'rule_based'
    phobert_label:    str = ''   # Nhãn PhoBERT gốc (RESCUE/MEDICAL/...)
    all_scores:       dict  = None  # {label: score} từ PhoBERT


# ─── Từ điển phân loại sự cố (Rule-based fallback) ──────────────────────────

INCIDENT_RULES = [
    ('Lũ lụt',        ['lũ', 'lụt', 'ngập', 'nước dâng', 'vỡ đê', 'triều cường', 'flood']),
    ('Bão',           ['bão', 'áp thấp nhiệt đới', 'siêu bão', 'cyclone', 'typhoon', 'hurricane']),
    ('Sạt lở',        ['sạt lở', 'sạt', 'đất đá', 'núi lở', 'landslide']),
    ('Động đất',      ['động đất', 'địa chấn', 'earthquake']),
    ('Sóng thần',     ['sóng thần', 'tsunami']),
    ('Hạn hán',       ['hạn hán', 'khô hạn', 'thiếu nước', 'drought']),
    ('Cháy rừng',     ['cháy rừng', 'cháy', 'hỏa hoạn', 'fire', 'wildfire']),
    ('Lốc xoáy',      ['lốc', 'lốc xoáy', 'gió lốc', 'tornado']),
    ('Y tế khẩn cấp', ['dịch bệnh', 'bệnh', 'y tế', 'epidemic', 'outbreak']),
    ('Cứu hộ khẩn cấp', ['cứu', 'mắc kẹt', 'kẹt', 'sos', 'ngập sâu', 'thuyền', 'ghe']),
    ('Sơ tán',        ['sơ tán', 'di dời', 'thoát khỏi', 'evacuation']),
    ('Nhu yếu phẩm',  ['nhu yếu phẩm', 'lương thực', 'nước uống', 'mì tôm', 'gạo']),
]

SEVERITY_RULES = {
    'CRITICAL': [
        'chết', 'tử vong', 'thiệt mạng', 'mất tích', 'cuốn trôi',
        'sập nhà', 'vỡ đê', 'siêu bão', 'cấp 12', 'cấp 13', 'cấp 14',
        'hàng chục người', 'hàng trăm người', 'cứu với', 'cứu gấp',
        'deadly', 'fatality', 'casualties', 'killed', 'missing',
    ],
    'HIGH': [
        'di dời', 'sơ tán', 'khẩn cấp', 'nguy hiểm', 'cảnh báo đỏ',
        'cấp 9', 'cấp 10', 'cấp 11', 'bị thương', 'ngập sâu', 'mắc kẹt',
        'evacuate', 'warning', 'dangerous', 'severe', 'cứu hộ gấp',
    ],
    'MEDIUM': [
        'cảnh báo', 'theo dõi', 'ảnh hưởng', 'ngập', 'thiệt hại',
        'watch', 'impact', 'affect', 'damage',
    ],
    'LOW': [
        'nhẹ', 'giảm', 'ổn định', 'suy yếu', 'tan', 'qua đi',
        'minor', 'weak', 'dissipate',
    ],
}

BOOSTERS  = ['xác nhận', 'chính thức', 'báo cáo', 'ghi nhận', 'confirmed', 'official']
DAMPENERS = ['nghi', 'có thể', 'dự báo', 'lo ngại', 'possibly', 'reportedly', 'might']


# ─── Hàm công khai (Public API) ──────────────────────────────────────────────

def analyze(title: str, content: str) -> AnalysisResult:
    """
    Phân tích tiêu đề + nội dung để trả về AnalysisResult.

    Ưu tiên: PhoBERT → Rule-based fallback

    Args:
        title:   Tiêu đề bài viết
        content: Nội dung / tóm tắt

    Returns:
        AnalysisResult với incident_type, severity, confidence_score, method
    """
    full_text = f"{title or ''} {content or ''}".strip()

    # ── Thử PhoBERT trước ────────────────────────────────────────────────────
    try:
        from .phobert_analyzer import classify, is_available
        if is_available():
            result = classify(full_text)
            if result is not None:
                logger.debug(
                    f"[Analyzer] PhoBERT → {result.label} "
                    f"({result.confidence:.2f}) | {result.incident_type}"
                )
                return AnalysisResult(
                    incident_type    = result.incident_type,
                    severity         = result.severity,
                    confidence_score = result.confidence,
                    method           = 'phobert',
                    phobert_label    = result.label,
                    all_scores       = result.all_scores,
                )
    except Exception as e:
        logger.warning(f"[Analyzer] PhoBERT error, falling back to rule-based: {e}")

    # ── Fallback: Rule-based ──────────────────────────────────────────────────
    logger.debug("[Analyzer] Dùng rule-based fallback")
    return _rule_based_analyze(full_text)


def analyze_with_phobert_only(text: str):
    """
    Gọi thẳng PhoBERT, không fallback. Dùng cho API /ai/classify/.
    Trả về None nếu model chưa sẵn sàng.
    """
    try:
        from .phobert_analyzer import classify, is_available
        if not is_available():
            return None
        return classify(text)
    except Exception as e:
        logger.error(f"[Analyzer] PhoBERT-only error: {e}")
        return None


# ─── Rule-based (Fallback) ───────────────────────────────────────────────────

def _rule_based_analyze(text: str) -> AnalysisResult:
    text_lower = text.lower()
    incident_type    = _classify_incident(text_lower)
    severity         = _classify_severity(text_lower)
    confidence_score = _compute_confidence(text_lower, incident_type, severity)

    return AnalysisResult(
        incident_type    = incident_type,
        severity         = severity,
        confidence_score = confidence_score,
        method           = 'rule_based',
        phobert_label    = '',
        all_scores       = None,
    )


def _classify_incident(text: str) -> str:
    best_type  = 'Thiên tai'
    best_count = 0
    for name, keywords in INCIDENT_RULES:
        count = sum(1 for kw in keywords if kw in text)
        if count > best_count:
            best_count = count
            best_type  = name
    return best_type


def _classify_severity(text: str) -> str:
    for level in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
        if any(kw in text for kw in SEVERITY_RULES[level]):
            return level
    return 'MEDIUM'


def _compute_confidence(text: str, incident_type: str, severity: str) -> float:
    score = 0.40
    if incident_type != 'Thiên tai':
        score += 0.20
    if severity in ('CRITICAL', 'HIGH'):
        score += 0.20
    elif severity == 'MEDIUM':
        score += 0.10
    boost = sum(1 for b in BOOSTERS if b in text)
    damp  = sum(1 for d in DAMPENERS if d in text)
    score += boost * 0.05
    score -= damp  * 0.05
    return round(min(1.0, max(0.0, score)), 2)
