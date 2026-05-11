from django.urls import path
from . import views

urlpatterns = [
    # Mission
    path('missions/', views.mission_list, name='mission-list'),
    path('missions/create/', views.mission_create, name='mission-create'),
    path('missions/<uuid:pk>/', views.mission_detail, name='mission-detail'),
    path('missions/<uuid:pk>/complete/', views.mission_complete, name='mission-complete'),

    # Resource
    path('resources/', views.resource_list, name='resource-list'),
    path('resources/create/', views.resource_create, name='resource-create'),
    path('resources/<uuid:pk>/', views.resource_detail, name='resource-detail'),
]
