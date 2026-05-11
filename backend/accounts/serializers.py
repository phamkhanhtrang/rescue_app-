from rest_framework import serializers
from .models import  CitizenProfile, RescuerProfile, User


class CitizenProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name')
    phone = serializers.CharField(source='user.phone')
    address = serializers.CharField(source='user.address')

    class Meta:
        model = CitizenProfile
        fields = [
            'id', 'id_number', 'medical_notes',
            'emergency_contact_name', 'emergency_contact_phone',
            'location_sharing',
            'full_name', 'phone', 'address'
        ]

    def update(self, instance, validated_data):
        # Lấy dữ liệu user từ validated_data (nested)
        user_data = validated_data.pop('user', {})
        user = instance.user
        
        # Cập nhật thông tin User
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        
        # Cập nhật thông tin CitizenProfile
        return super().update(instance, validated_data)


class RescuerProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name')
    phone = serializers.CharField(source='user.phone')
    address = serializers.CharField(source='user.address')
    specialty = serializers.CharField(source='get_specialty_display')

    class Meta:
        model = RescuerProfile
        fields = [
            'id', 'id_number', 'unit_name', 'rank', 'specialty',
            'is_on_duty', 'current_lat', 'current_lng',
            'full_name', 'phone', 'address'
        ]

    def update(self, instance, validated_data):
        # Lấy dữ liệu user từ validated_data (nested)
        user_data = validated_data.pop('user', {})
        user = instance.user
        
        # Cập nhật thông tin User
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        
        # Cập nhật thông tin RescuerProfile
        return super().update(instance, validated_data)


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer đầy đủ: kèm theo hồ sơ con tương ứng với role."""
    citizen_profile = CitizenProfileSerializer(read_only=True)
    rescuer_profile = RescuerProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'role', 'full_name', 'phone', 'email', 'address',
            'avatar_url', 'created_at', 'is_active',
            'citizen_profile', 'rescuer_profile',
        ]
        read_only_fields = ['id', 'created_at']
    def update(self, instance, validated_data):
        # Tách dữ liệu của citizen_profile ra
        citizen_data = validated_data.pop('citizen_profile', None)
        
        # Cập nhật thông tin User (full_name, phone...)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        # Cập nhật thông tin CitizenProfile (emergency_contact...)
        if citizen_data:
            cp = instance.citizen_profile
            for attr, value in citizen_data.items():
                setattr(cp, attr, value)
            cp.save()
            
        return instance


class ProfileListSerializer(serializers.ModelSerializer):
    """Serializer gọn cho danh sách (không kèm hồ sơ con)."""
    class Meta:
        model = User
        fields = ['id', 'role', 'full_name', 'phone', 'email', 'avatar_url', 'created_at', 'is_active']
class CitizenRegisterSerializer(serializers.ModelSerializer):
    """Serializer dành riêng cho đăng ký công dân mới."""
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['full_name', 'phone', 'email', 'password','address']

    def create(self, validated_data):
        password = validated_data.pop('password')
        # Tạo User mới với role CITIZEN
        user = User.objects.create(
            role='CITIZEN',
            username=validated_data['phone'], # Sử dụng SĐT làm username
            **validated_data
        )
        user.set_password(password)
        user.save()
        
        # Tự động tạo CitizenProfile trống liên kết với User này
        CitizenProfile.objects.create(user=user)
        
        return user

class RescuerRegisterSerializer(serializers.ModelSerializer):
    """Serializer dành riêng cho đăng ký cứu hộ viên mới."""
    password = serializers.CharField(write_only=True)
    unit_name = serializers.CharField(required=False, allow_blank=True)
    rank = serializers.CharField(required=False, allow_blank=True)
    specialty = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['full_name', 'phone', 'email', 'password', 'address', 'unit_name', 'rank', 'specialty']

    def create(self, validated_data):
        password = validated_data.pop('password')
        unit_name = validated_data.pop('unit_name', '')
        rank = validated_data.pop('rank', '')
        specialty = validated_data.pop('specialty', '')
        
        # Tạo User mới với role RESCUER
        user = User.objects.create(
            role='RESCUER',
            is_active=False, # Tài khoản mặc định bị khóa để chờ duyệt
            username=validated_data['phone'], # Sử dụng SĐT làm username
            **validated_data
        )
        user.set_password(password)
        user.save()
        
        # Tự động tạo RescuerProfile liên kết với User này
        RescuerProfile.objects.create(
            user=user,
            unit_name=unit_name,
            rank=rank,
            specialty=specialty
        )
        
        return user