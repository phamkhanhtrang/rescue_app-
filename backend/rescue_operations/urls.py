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
    path('sos/<uuid:pk>/', flow.detail, name='sos-detail'),

    # SOS Images
    path('sos/<uuid:sos_id>/images/', flow.image_upload, name='sos-image-upload'),
    path('get-route/', views.get_rescue_route_api, name='get-route'),
]
