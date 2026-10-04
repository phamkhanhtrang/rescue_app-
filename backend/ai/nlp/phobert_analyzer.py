"""
ai/nlp/phobert_analyzer.py
===========================
Module inference dùng model PhoBERT đã fine-tune trên dữ liệu SOS tiếng Việt.

Cấu hình (settings.py hoặc .env):
    PHOBERT_MODEL_DIR = "ai/nlp/sos_phobert_model"  # Đường dẫn tương đối từ BASE_DIR

Label mapping (từ notebook training):
    EVACUATION : 0  →  Sơ tán khẩn cấp    (severity=HIGH)
    INFO       : 1  →  Thông tin cảnh báo  (severity=LOW)
    MEDICAL    : 2  →  Y tế khẩn cấp      (severity=HIGH)
    RESCUE     : 3  →  Cứu hộ khẩn cấp    (severity=CRITICAL)
    SPAM       : 4  →  Không phải SOS      (rejected)
    SUPPLY     : 5  →  Nhu yếu phẩm       (severity=MEDIUM)

Lazy loading: Model chỉ load 1 lần khi gọi lần đầu (singleton pattern).
Fallback: Nếu model chưa được cài đặt, tự động dùng rule-based.
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Label mapping cố định (khớp với notebook training) ──────────────────────

LABEL2ID = {
    'EVACUATION': 0,
    'INFO':       1,
    'MEDICAL':    2,
    'RESCUE':     3,
    'SPAM':       4,
    'SUPPLY':     5,
}

ID2LABEL = {v: k for k, v in LABEL2ID.items()}

# Map nhãn PhoBERT → incident_type và severity trong hệ thống hiện tại
LABEL_TO_INCIDENT = {
    'RESCUE':     ('Cứu hộ khẩn cấp',    'CRITICAL'),
    'MEDICAL':    ('Y tế khẩn cấp',       'HIGH'),
    'EVACUATION': ('Sơ tán',              'HIGH'),
    'SUPPLY':     ('Nhu yếu phẩm',        'MEDIUM'),
    'INFO':       ('Thông tin cảnh báo',  'LOW'),
    'SPAM':       ('Không xác định',      'LOW'),
}

MAX_LENGTH = 256


# ─── Kết quả phân tích ───────────────────────────────────────────────────────

@dataclass
class PhoBERTResult:
    label:          str         # RESCUE / MEDICAL / EVACUATION / SUPPLY / INFO / SPAM
    is_sos:         bool        # True nếu không phải SPAM
    confidence:     float       # 0.0 – 1.0
    incident_type:  str         # Mapped sang tên hiển thị
    severity:       str         # CRITICAL / HIGH / MEDIUM / LOW
    all_scores:     dict        # {label: score, ...}


# ─── Singleton loader ─────────────────────────────────────────────────────────

_model     = None
_tokenizer = None
_device    = None
_loaded    = False   # True kể cả khi load thất bại (tránh retry vô hạn)


def _get_model_dir() -> Optional[str]:
    """Đọc đường dẫn model từ Django settings."""
    try:
        from django.conf import settings
        model_dir = getattr(settings, 'PHOBERT_MODEL_DIR', None)
        if model_dir and not os.path.isabs(model_dir):
            # Tương đối từ BASE_DIR
            base_dir = getattr(settings, 'BASE_DIR', os.path.dirname(__file__))
            model_dir = os.path.join(base_dir, model_dir)
        return model_dir
    except Exception:
        return None


def _load_model():
    """Load model lần đầu (lazy singleton)."""
    global _model, _tokenizer, _device, _loaded

    if _loaded:
        return  # Đã load (dù thành công hay thất bại)

    _loaded = True
    model_dir = _get_model_dir()

    if not model_dir:
        logger.warning(
            "[PhoBERT] PHOBERT_MODEL_DIR chưa được cấu hình trong settings.py. "
            "Dùng rule-based fallback."
        )
        return

    if not os.path.isdir(model_dir):
        logger.warning(
            f"[PhoBERT] Không tìm thấy model tại: {model_dir}. "
            "Dùng rule-based fallback."
        )
        return

    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        logger.info(f"[PhoBERT] Đang load model từ {model_dir} trên {_device}...")

        _tokenizer = AutoTokenizer.from_pretrained(model_dir, use_fast=False)
        _model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        _model.to(_device)
        _model.eval()

        logger.info("[PhoBERT] Model load thành công ✓")

    except ImportError:
        logger.error(
            "[PhoBERT] torch/transformers chưa được cài. "
            "Chạy: pip install torch transformers. Dùng rule-based fallback."
        )
        _model = _tokenizer = None
    except Exception as e:
        logger.error(f"[PhoBERT] Lỗi load model: {e}. Dùng rule-based fallback.")
        _model = _tokenizer = None


def is_available() -> bool:
    """Kiểm tra model đã sẵn sàng chưa."""
    _load_model()
    return _model is not None and _tokenizer is not None


# ─── Hàm phân loại chính ─────────────────────────────────────────────────────

def classify(text: str) -> Optional[PhoBERTResult]:
    """
    Phân loại văn bản SOS bằng PhoBERT.

    Args:
        text: Nội dung bài viết / câu cần phân loại (tiếng Việt)

    Returns:
        PhoBERTResult nếu model sẵn sàng, None nếu không có model.
    """
    _load_model()

    if _model is None or _tokenizer is None:
        return None

    if not text or not text.strip():
        return PhoBERTResult(
            label='SPAM', is_sos=False, confidence=1.0,
            incident_type='Không xác định', severity='LOW',
            all_scores={k: 0.0 for k in LABEL2ID}
        )

    try:
        import torch
        import numpy as np

        inputs = _tokenizer(
            text,
            return_tensors='pt',
            max_length=MAX_LENGTH,
            padding='max_length',
            truncation=True,
        )
        inputs = {k: v.to(_device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = _model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1).squeeze(0).cpu().numpy()

        pred_id    = int(np.argmax(probs))
        pred_label = ID2LABEL[pred_id]
        confidence = float(probs[pred_id])
        all_scores = {ID2LABEL[i]: round(float(probs[i]), 4) for i in range(len(probs))}

        incident_type, severity = LABEL_TO_INCIDENT[pred_label]

        return PhoBERTResult(
            label         = pred_label,
            is_sos        = pred_label != 'SPAM',
            confidence    = round(confidence, 4),
            incident_type = incident_type,
            severity      = severity,
            all_scores    = all_scores,
        )

    except Exception as e:
        logger.error(f"[PhoBERT] Lỗi inference: {e}")
        return None


def classify_batch(texts: list[str]) -> list[Optional[PhoBERTResult]]:
    """
    Phân loại một batch văn bản (hiệu quả hơn gọi từng cái).

    Args:
        texts: Danh sách văn bản cần phân loại

    Returns:
        Danh sách PhoBERTResult, None cho các văn bản bị lỗi
    """
    _load_model()

    if _model is None or _tokenizer is None:
        return [None] * len(texts)

    if not texts:
        return []

    try:
        import torch
        import numpy as np

        inputs = _tokenizer(
            texts,
            return_tensors='pt',
            max_length=MAX_LENGTH,
            padding='max_length',
            truncation=True,
        )
        inputs = {k: v.to(_device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = _model(**inputs)
            probs_batch = torch.softmax(outputs.logits, dim=1).cpu().numpy()

        results = []
        for probs in probs_batch:
            pred_id    = int(np.argmax(probs))
            pred_label = ID2LABEL[pred_id]
            confidence = float(probs[pred_id])
            all_scores = {ID2LABEL[i]: round(float(probs[i]), 4) for i in range(len(probs))}
            incident_type, severity = LABEL_TO_INCIDENT[pred_label]

            results.append(PhoBERTResult(
                label         = pred_label,
                is_sos        = pred_label != 'SPAM',
                confidence    = round(confidence, 4),
                incident_type = incident_type,
                severity      = severity,
                all_scores    = all_scores,
            ))
        return results

    except Exception as e:
        logger.error(f"[PhoBERT] Lỗi batch inference: {e}")
        return [None] * len(texts)
