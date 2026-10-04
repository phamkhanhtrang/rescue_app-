from django.urls import path
from . import views

urlpatterns = [
    # Alert CRUD
    path('alerts/', views.alert_list, name='alert-list'),
    path('alerts/create/', views.alert_create, name='alert-create'),
    path('alerts/<uuid:pk>/', views.alert_detail, name='alert-detail'),
    path('alerts/<uuid:pk>/read/', views.alert_read, name='alert-read'),
    path('push-devices/', views.push_device, name='push-device'),

    # Alert Vote (xác nhận cộng đồng)
    path('alerts/<uuid:alert_id>/vote/', views.alert_vote, name='alert-vote'),
]
