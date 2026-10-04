from django.urls import path
from . import views
from . import passwords
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Thống kê tổng quan
    path('summary/', views.accounts_summary, name='accounts-summary'),
    path('login/', views.login_api, name='login'),
    path('token/refresh/', passwords.refresh_session, name='token-refresh'),
    path('me/', views.me),
    path('logout/', passwords.logout),
    path('password/reset/', passwords.request_reset),
    path('password/reset/confirm/', passwords.confirm_reset),
    path('password/change/', passwords.change_password),
    path('profiles/<uuid:pk>/reject/', views.reject_account),

    # Profile CRUD
    path('profiles/', views.profile_list, name='profile-list'),
    path('profiles/create/', views.profile_create, name='profile-create'),
    path('profiles/<uuid:pk>/', views.profile_detail, name='profile-detail'),

    # CitizenProfile
    path('citizens/create/', views.citizen_profile_create, name='citizen-profile-create'),
    path('citizens/<uuid:user_id>/', views.citizen_profile_detail, name='citizen-profile-detail'),

    # RescuerProfile
    path('rescuers/create/', views.rescuer_profile_create, name='rescuer-profile-create'),
    path('rescuers/<uuid:user_id>/', views.rescuer_profile_detail, name='rescuer-profile-detail'),
    path('rescuers/<uuid:user_id>/location/', views.rescuer_update_location, name='rescuer-update-location'),
    
    # Kích hoạt / Cấm tài khoản
    path('profiles/<uuid:pk>/activate/', views.activate_account, name='profile-activate'),
    path('profiles/<uuid:pk>/ban/', views.ban_account, name='profile-ban'),
]
