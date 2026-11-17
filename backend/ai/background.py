"""
ai/background.py
================
Chạy tác vụ AI ngoài luồng xử lý request.

Một luồng nền duy nhất nhận việc theo hàng đợi, nên các lần gom cụm không
chạy chồng lên nhau và request của người dân được trả ngay sau khi lưu SOS.

Khi `settings.AI_BACKGROUND_INLINE = True` (mặc định lúc chạy test) tác vụ chạy
ngay trong luồng gọi để kết quả có thể kiểm tra được.
"""

import logging
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.db import close_old_connections, transaction

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='ai-background')


def _inline() -> bool:
    return bool(getattr(settings, 'AI_BACKGROUND_INLINE', False))


def _run(fn, args, kwargs):
    # Luồng nền có kết nối DB riêng; đóng kết nối cũ trước và sau mỗi tác vụ.
    close_old_connections()
    try:
        fn(*args, **kwargs)
    except Exception:
        logger.exception('[AI Background] Tác vụ %s thất bại', getattr(fn, '__name__', fn))
    finally:
        close_old_connections()


def submit(fn, *args, **kwargs):
    """
    Xếp `fn(*args, **kwargs)` vào hàng đợi nền.

    Lỗi của tác vụ chỉ được ghi log, không bao giờ ảnh hưởng tới request gốc.
    Tác vụ chỉ bắt đầu sau khi transaction hiện tại commit, để luồng nền đọc
    được dữ liệu vừa lưu.
    """
    if _inline():
        try:
            fn(*args, **kwargs)
        except Exception:
            logger.exception('[AI Background] Tác vụ %s thất bại', getattr(fn, '__name__', fn))
        return
    transaction.on_commit(lambda: _executor.submit(_run, fn, args, kwargs))
