"""
ai/sos_pipeline.py
==================
Chuỗi xử lý AI sau khi có SOS mới. Luôn được gọi qua `schedule_new_sos`
để chạy nền, không chặn request của người dân.

    SOS mới → gom cụm → chấm điểm Zone → đọc ghi chú (Model A/B) → chấm lại Zone
"""

import logging

from . import background

logger = logging.getLogger(__name__)


def cluster_and_score() -> dict:
    """Gom cụm các SOS chưa có Zone rồi chấm điểm lại những Zone vừa thay đổi."""
    from . import clustering, priority_scorer

    stats = clustering.run_clustering(only_unassigned=True)
    zone_ids = stats.get('zone_ids') if isinstance(stats, dict) else None
    if zone_ids:
        priority_scorer.run_priority_scoring(zone_ids=zone_ids)
    return stats if isinstance(stats, dict) else {}


def process_new_sos(sos_id=None) -> None:
    """
    Gom cụm và chấm điểm trước (nhanh), sau đó mới đọc ghi chú (chậm hơn, nhất
    là lần đầu nạp model) để Zone xuất hiện trên bản đồ sớm nhất có thể.
    """
    stats = cluster_and_score()
    logger.info('[AI Pipeline] SOS %s → gom cụm: %s', sos_id, stats)
    if sos_id is not None:
        analyze_note_and_rescore(sos_id)


def analyze_note_and_rescore(sos_id) -> None:
    """Đọc ghi chú bằng Model A/B rồi chấm lại Zone chứa SOS nếu có thông tin mới."""
    from .sos_note_analysis import analyze_sos_note
    from rescue_operations.models import SOSSignal
    from . import priority_scorer

    analysis = analyze_sos_note(sos_id)
    # Ghi chú có người yếu thế / nhu cầu y tế làm thay đổi điểm của Zone chứa SOS.
    if analysis.get('vulnerable_groups') or 'MEDICAL' in analysis.get('needs', []):
        zone_id = SOSSignal.objects.filter(pk=sos_id).values_list('zone_id', flat=True).first()
        if zone_id:
            priority_scorer.run_priority_scoring(zone_ids=[str(zone_id)])


def schedule_new_sos(sos_id=None) -> None:
    """Xếp `process_new_sos` vào hàng đợi nền."""
    background.submit(process_new_sos, str(sos_id) if sos_id else None)


def schedule_note_analysis(sos_id) -> None:
    """Đọc lại ghi chú khi người gửi bổ sung thông tin."""
    background.submit(analyze_note_and_rescore, str(sos_id))
