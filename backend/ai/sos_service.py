"""One process-wide model cache shared by crawler and admin playground."""
from pathlib import Path
from threading import RLock
from django.conf import settings

_lock = RLock()
_predictor = None
_loaded_key = None


def get_predictor(mode='both'):
    global _predictor, _loaded_key
    root = getattr(settings, 'SOS_TWO_MODEL_DIR', '')
    if not root:
        raise RuntimeError('Chưa cấu hình SOS_TWO_MODEL_DIR')
    root = Path(root)
    if not root.is_absolute():
        root = Path(settings.BASE_DIR) / root
    device = getattr(settings, 'SOS_TWO_MODEL_DEVICE', 'cpu')
    key = (str(root), device)
    with _lock:
        if _predictor is None or _loaded_key != key:
            from .sos_ml.inference import SOSPredictor
            _predictor = SOSPredictor(root, device=device, lazy=True)
            _loaded_key = key
        _predictor.ensure(mode)
        return _predictor
