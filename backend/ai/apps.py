import logging
import os
import sys
import threading

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class AiConfig(AppConfig):
    name = 'ai'

    def ready(self):
        from django.conf import settings

        if not (getattr(settings, 'SOS_MODEL_PRELOAD', False) and getattr(settings, 'SOS_TWO_MODEL_DIR', '')):
            return
        # Chỉ nạp model khi tiến trình thật sự phục vụ request: không nạp cho
        # migrate/test/shell, và không nạp ở tiến trình giám sát của autoreload.
        command = sys.argv[1] if len(sys.argv) > 1 else ''
        managed = os.path.basename(sys.argv[0]) in ('manage.py', 'django-admin')
        if managed and (command != 'runserver' or
                        ('--noreload' not in sys.argv and os.environ.get('RUN_MAIN') != 'true')):
            return
        threading.Thread(target=self._preload, name='ai-model-preload', daemon=True).start()

    @staticmethod
    def _preload():
        try:
            from .sos_service import get_predictor
            get_predictor('both')
            logger.info('[AI] Đã nạp sẵn Model A/B.')
        except Exception:
            logger.exception('[AI] Không nạp sẵn được Model A/B; sẽ thử lại khi có yêu cầu phân tích.')
