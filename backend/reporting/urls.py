from django.urls import path
from . import views
from . import flow

urlpatterns = [
    # Mission
    path('missions/', views.mission_list, name='mission-list'),
    path('missions/create/', flow.create, name='mission-create'),
    path('missions/<uuid:pk>/', flow.detail, name='mission-detail'),
    path('missions/<uuid:pk>/complete/', flow.complete, name='mission-complete'),
    path('missions/<uuid:pk>/leave/', flow.leave, name='mission-leave'),
    path('support/', flow.support_list, name='support-list'),
    path('resources/current/', flow.resource_current, name='resource-current'),

    # Resource
    path('resources/', views.resource_list, name='resource-list'),
    path('resources/create/', flow.resource_current, name='resource-create'),
    path('resources/<uuid:pk>/', flow.resource_legacy, name='resource-detail'),
    path('missions/<uuid:rescuer_id>/history/', views.mission_history, name='mission-history'),
]
