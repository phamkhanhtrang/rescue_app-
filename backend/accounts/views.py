from rest_framework.decorators import permission_classes
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Count, Q
from rest_framework_simplejwt.tokens import RefreshToken
from .models import  CitizenProfile, RescuerProfile, User
from .serializers import (
    ProfileSerializer, ProfileListSerializer,
    CitizenProfileSerializer, RescuerProfileSerializer,
    CitizenRegisterSerializer, RescuerRegisterSerializer,
)
from rest_framework.permissions import AllowAny
from django.core.mail import send_mail
import random

@api_view(['POST'])
@permission_classes([AllowAny])
def login_api(request):
    login_input = request.data.get("login_input") 
    password = request.data.get('password')
    
    if not login_input or not password:
        return Response({
            'error': 'Vui lòng nhập đầy đủ tài khoản và mật khẩu'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    user = User.objects.filter(Q(email=login_input) | Q(phone=login_input) | Q(username=login_input)).first()
    if not user:
        return Response({
            'error': 'Tài khoản không tồn tại'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if user.check_password(password):
        if not user.is_active:
            if user.role == 'RESCUER':
                try:
                    rp = RescuerProfile.objects.get(user=user)
                    if rp.status == 'PENDING':
                        return Response({
                            'error': 'Tài khoản của bạn đang chờ quản trị viên duyệt. Vui lòng chờ thông báo qua email.'
                        }, status=status.HTTP_403_FORBIDDEN)
                    elif rp.status == 'BANNED':
                        return Response({
                            'error': 'Tài khoản của bạn đã bị khóa bởi quản trị viên.'
                        }, status=status.HTTP_403_FORBIDDEN)
                except RescuerProfile.DoesNotExist:
                    pass
            return Response({
                'error': 'Tài khoản của bạn đã bị vô hiệu hóa'
            }, status=status.HTTP_403_FORBIDDEN)

        # Tạo token cho người dùng
        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Đăng nhập thành công',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'phone': user.phone,
                'email': user.email,
                'full_name': user.full_name,
                'role': user.role,
                'address': user.address,
                'username': user.username,
                # 'is_verified': user.is_verified
            }
        }, status=status.HTTP_200_OK)
    else:
        return Response({
            'error': 'Mật khẩu không chính xác'
        }, status=status.HTTP_401_UNAUTHORIZED)
 


# ─── PROFILE ─────────────────────────────────────────────────

@api_view(['GET'])
def profile_list(request):
    """Danh sách tất cả người dùng, có thể lọc theo role."""
    role = request.query_params.get('role')
    queryset = User.objects.all().order_by('-created_at')
    if role:
        queryset = queryset.filter(role=role.upper())
        serializer = ProfileSerializer(queryset, many=True)
    else:
        serializer = ProfileListSerializer(queryset, many=True)
    return Response({
        'count': queryset.count(),
        'results': serializer.data,
    })



@api_view(['POST'])
def activate_account(request, pk):
    """Kích hoạt tài khoản và gửi email thông báo/mã số."""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'Không tìm thấy người dùng.'}, status=status.HTTP_404_NOT_FOUND)

    if user.is_active:
        return Response({'message': 'Tài khoản đã được kích hoạt trước đó.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_active = True
    
    if user.role == 'RESCUER':
        try:
            rp = RescuerProfile.objects.get(user=user)
            rp.status = 'ACTIVE'
            rp.save(update_fields=['status'])
        except RescuerProfile.DoesNotExist:
            pass # Không có profile thì bỏ qua
            
        # Gửi email
        if user.email:
            try:
                send_mail(
                    subject='Kích hoạt tài khoản cứu hộ',
                    message='Chúc mừng! Tài khoản cứu hộ của bạn đã được đăng ký và duyệt thành công. Bạn đã có thể đăng nhập vào ứng dụng.',
                    from_email='App Cứu Hộ <trangpk.22it@vku.udn.vn>',
                    recipient_list=[user.email.strip()],
                    fail_silently=False,
                )
            except Exception as e:
                # Nếu không gửi được email, vẫn kích hoạt nhưng báo lỗi
                user.save(update_fields=['is_active'])
                return Response({'message': f'Đã kích hoạt tài khoản nhưng không thể gửi email: {str(e)}'}, status=status.HTTP_200_OK)
    
    elif user.role == 'CITIZEN':
        # Gửi email thông báo mở khoá
        if user.email:
            try:
                send_mail(
                    subject='Tài khoản của bạn đã được mở lại',
                    message='Tài khoản của bạn đã được mở lại. Bạn có thể tiếp tục sử dụng ứng dụng.',
                    from_email='App Cứu Hộ <trangpk.22it@vku.udn.vn>',
                    recipient_list=[user.email.strip()],
                    fail_silently=False,
                )
            except Exception as e:
                user.save(update_fields=['is_active'])
                return Response({'message': f'Đã mở khoá tài khoản nhưng không thể gửi email: {str(e)}'}, status=status.HTTP_200_OK)

    user.save(update_fields=['is_active'])
    return Response({'message': 'Kích hoạt tài khoản thành công.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
def ban_account(request, pk):
    """Cấm (khoá) tài khoản."""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'Không tìm thấy người dùng.'}, status=status.HTTP_404_NOT_FOUND)

    if not user.is_active:
        return Response({'message': 'Tài khoản đã bị cấm trước đó.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_active = False
    
    if user.role == 'RESCUER':
        try:
            rp = RescuerProfile.objects.get(user=user)
            rp.status = 'BANNED'
            rp.save(update_fields=['status'])
        except RescuerProfile.DoesNotExist:
            pass
        
        # Gửi email thông báo bị khóa
        if user.email:
            try:
                send_mail(
                    subject='Tài khoản cứu hộ của bạn đã bị khóa',
                    message='Tài khoản cứu hộ của bạn đã bị quản trị viên khóa. Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ với quản trị viên để được hỗ trợ.',
                    from_email='App Cứu Hộ <trangpk.22it@vku.udn.vn>',
                    recipient_list=[user.email.strip()],
                    fail_silently=True,
                )
            except Exception:
                pass  # Không gửi được email thì vẫn tiếp tục khóa tài khoản

    user.save(update_fields=['is_active'])
    return Response({'message': 'Đã cấm tài khoản thành công.'}, status=status.HTTP_200_OK)
@api_view(['POST'])
def profile_create(request):
    """Tạo hồ sơ người dùng mới."""
    serializer = ProfileSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
def profile_detail(request, pk):
    """Chi tiết / Cập nhật / Xóa một Profile."""
    try:
        profile = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'Không tìm thấy người dùng.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ProfileSerializer(profile).data)

    if request.method == 'PUT':
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── CITIZEN PROFILE ─────────────────────────────────────────

@api_view(['POST'])
def citizen_profile_create(request):
    """Tạo người dùng mới và hồ sơ chi tiết cho Người dân (Đăng ký)."""
    serializer = CitizenRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        # Trả về thông tin user sau khi tạo
        return Response({
            'message': 'Đăng ký thành công',
            'user': ProfileSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT'])
def citizen_profile_detail(request, user_id):
    """Chi tiết / Cập nhật hồ sơ Người dân theo user_id."""
    try:
        cp = CitizenProfile.objects.get(user_id=user_id)
    except CitizenProfile.DoesNotExist:
        return Response({'error': 'Không tìm thấy hồ sơ công dân.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(CitizenProfileSerializer(cp).data)

    serializer = CitizenProfileSerializer(cp, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── RESCUER PROFILE ─────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def rescuer_profile_create(request):
    """Tạo người dùng mới và hồ sơ chi tiết cho Cứu hộ viên (Đăng ký)."""
    serializer = RescuerRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'message': 'Đăng ký cứu hộ viên thành công',
            'user': ProfileSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT'])
def rescuer_profile_detail(request, user_id):
    """Chi tiết / Cập nhật hồ sơ Cứu hộ viên theo user_id."""
    try:
        rp = RescuerProfile.objects.get(user_id=user_id)
    except RescuerProfile.DoesNotExist:
        return Response({'error': 'Không tìm thấy hồ sơ cứu hộ.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(RescuerProfileSerializer(rp).data)

    serializer = RescuerProfileSerializer(rp, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
def rescuer_update_location(request, user_id):
    """Cập nhật vị trí GPS thời gian thực của cứu hộ viên."""
    try:
        rp = RescuerProfile.objects.get(user_id=user_id)
    except RescuerProfile.DoesNotExist:
        return Response({'error': 'Không tìm thấy hồ sơ cứu hộ.'}, status=status.HTTP_404_NOT_FOUND)

    lat = request.data.get('current_lat') or request.data.get('latitude')
    lng = request.data.get('current_lng') or request.data.get('longitude')
    if lat is None or lng is None:
        return Response({'error': 'Vui lòng cung cấp tọa độ (current_lat/lng hoặc latitude/longitude).'}, status=status.HTTP_400_BAD_REQUEST)

    rp.current_lat = lat
    rp.current_lng = lng
    rp.save(update_fields=['current_lat', 'current_lng'])
    return Response({'message': 'Cập nhật vị trí thành công.', 'current_lat': rp.current_lat, 'current_lng': rp.current_lng})


# ─── DASHBOARD ───────────────────────────────────────────────

@api_view(['GET'])
def accounts_summary(request):
    """Thống kê tổng quan người dùng."""
    total = User.objects.count()
    by_role = User.objects.values('role').annotate(count=Count('id'))
    on_duty = RescuerProfile.objects.filter(is_on_duty=True).count()

    return Response({
        'total_users': total,
        'by_role': {item['role']: item['count'] for item in by_role},
        'rescuers_on_duty': on_duty,
    })

