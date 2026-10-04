"""
ai/urls.py
==========
URL patterns cho module AI.
"""

from django.urls import path
from . import views, news, sos_inference_api, sos_article_api

urlpatterns = [
    path('analyze-sos/', sos_inference_api.analyze_sos, name='ai-analyze-sos'),
    path('crawled/<uuid:pk>/analyze/', sos_article_api.reanalyze, name='ai-reanalyze-article'),
    # Gom cụm SOS → tạo/cập nhật Zone
    path('cluster/', views.cluster_sos, name='ai-cluster-sos'),

    # Tính điểm ưu tiên cho Zone
    path('score/', views.score_zones, name='ai-score-zones'),

    # Danh sách Zone ưu tiên cao nhất
    path('priority-zones/', views.priority_zones, name='ai-priority-zones'),

    # Pipeline đầy đủ: cluster + score
    path('run/', views.run_ai_pipeline, name='ai-run-pipeline'),

    # ── Crawler endpoints ──────────────────────────────────────────────────
    # Chạy pipeline crawl tin thiên tai
    path('crawl/', views.run_crawl, name='ai-run-crawl'),

    # Danh sách bài đã crawl (có lọc theo status, platform)
    path('crawled/', views.crawled_list, name='ai-crawled-list'),

    # Nội dung đầy đủ được tải khi Admin mở hồ sơ duyệt
    path('crawled/<uuid:pk>/', views.crawled_detail, name='ai-crawled-detail'),

    # Duyệt / Từ chối bài crawl thủ công
    path('crawled/<uuid:pk>/review/', views.crawled_review, name='ai-crawled-review'),

    # Danh sách bài báo/tin tức thiên tai đã xuất bản (cho App)
    path('news/', news.news_list, name='ai-published-news'),
    path('news/<uuid:pk>/', news.news_detail, name='ai-news-detail'),
    path('crawled/<uuid:pk>/publication/', news.publication, name='ai-news-publication'),
    path('crawled/<uuid:pk>/alert/', news.create_news_alert, name='ai-news-alert'),

    # ── Assignment Recommender ─────────────────────────────────────────────
    # Lấy danh sách gợi ý phân công Rescuer → Zone
    path('recommend/', views.recommend_assignments, name='ai-recommend-assignments'),

    # ── Facebook SOS Crawler ────────────────────────────────────────────────
    # Kích hoạt quét bài SOS từ nhóm Facebook
    path('crawl/facebook/', views.run_facebook_crawl, name='ai-crawl-facebook'),

    # ── PhoBERT Classifier ─────────────────────────────────────────────────
    # Phân loại văn bản SOS bằng PhoBERT (hoặc rule-based nếu chưa có model)
    path('classify/', views.classify_text, name='ai-classify-text'),
]
