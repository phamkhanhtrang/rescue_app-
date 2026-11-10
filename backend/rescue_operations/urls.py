from django.urls import path
from . import views
from . import flow

urlpatterns = [
    # Dashboard thống kê
    path('dashboard/', views.dashboard_stats, name='dashboard-stats'),

    # Zone CRUD
    path('zones/', views.zone_list, name='zone-list'),
    path('zones/create/', views.zone_create, name='zone-create'),
    path('zones/<uuid:pk>/', views.zone_detail, name='zone-detail'),
    path('zones/manage/', flow.manage_zone, name='zone-manage'),

    # SOS Signal
    path('sos/', views.sos_list, name='sos-list'),
    path('sos/draft/', flow.draft, name='sos-draft'),
    path('sos/create/', flow.create, name='sos-create'),
    path('sos/anonymous/', flow.create, name='sos-anonymous-create'),
    path('sos/bulk-offline-sync/', views.bulk_offline_sync, name='sos-bulk-offline-sync'),
    path('sos/<uuid:pk>/', flow.detail, name='sos-detail'),

    # SOS Images
    path('sos/<uuid:sos_id>/images/', flow.image_upload, name='sos-image-upload'),
    path('get-route/', views.get_rescue_route_api, name='get-route'),

    # Báo cáo hiện trường từ người dân & Vote xác thực (T2 + T3 + T4 + S2 + S4)
    path('field-reports/', views.field_report_list, name='field-report-list'),
    path('field-reports/preview-road/', views.preview_road_segment, name='field-report-preview-road'),
    path('field-reports/create/', views.field_report_create, name='field-report-create'),
    path('field-reports/<uuid:pk>/', views.field_report_detail, name='field-report-detail'),
    path('field-reports/<uuid:pk>/vote/', views.field_report_vote, name='field-report-vote'),
    path('safety-check/', views.safety_check, name='safety-check'),
]
