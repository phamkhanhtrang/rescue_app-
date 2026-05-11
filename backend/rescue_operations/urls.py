from django.urls import path
from . import views

urlpatterns = [
    # Dashboard thống kê
    path('dashboard/', views.dashboard_stats, name='dashboard-stats'),

    # Zone CRUD
    path('zones/', views.zone_list, name='zone-list'),
    path('zones/create/', views.zone_create, name='zone-create'),
    path('zones/<uuid:pk>/', views.zone_detail, name='zone-detail'),

    # SOS Signal
    path('sos/', views.sos_list, name='sos-list'),
    path('sos/create/', views.sos_create, name='sos-create'),
    path('sos/<uuid:pk>/', views.sos_detail, name='sos-detail'),

    # SOS Images
    path('sos/<uuid:sos_id>/images/', views.sos_image_upload, name='sos-image-upload'),
]