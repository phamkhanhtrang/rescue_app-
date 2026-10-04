from django.db import transaction
from rest_framework import serializers
from .models import CitizenProfile, RescuerProfile, User
from .validation import phone_value, email_value, password_value


class ContactValidation:
    def contact_user(self):
        if isinstance(self.instance, User):
            return self.instance
        return getattr(self.instance, 'user', None)

    def validate_phone(self, value):
        return phone_value(value, self.contact_user())

    def validate_email(self, value):
        return email_value(value, self.contact_user())

    def validate_full_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Vui lòng nhập họ tên.')
        return value.strip()


class CitizenProfileSerializer(ContactValidation, serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', max_length=150)
    phone = serializers.CharField(source='user.phone')
    address = serializers.CharField(source='user.address', max_length=100, allow_blank=True, allow_null=True)
    avatar_url = serializers.CharField(source='user.avatar_url', required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = CitizenProfile
        fields = ['id', 'id_number', 'medical_notes', 'emergency_contact_name',
                  'emergency_contact_phone', 'location_sharing', 'full_name', 'phone', 'address', 'avatar_url']

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        for attr, value in user_data.items():
            setattr(instance.user, attr, value)
        if 'phone' in user_data:
            instance.user.username = user_data['phone']
        if user_data:
            instance.user.save(update_fields=list(user_data) + (['username'] if 'phone' in user_data else []))
        return super().update(instance, validated_data)


class RescuerProfileSerializer(ContactValidation, serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', max_length=150)
    phone = serializers.CharField(source='user.phone')
    address = serializers.CharField(source='user.address', max_length=100, allow_blank=True, allow_null=True)
    specialty_display = serializers.CharField(source='get_specialty_display', read_only=True)

    class Meta:
        model = RescuerProfile
        fields = ['id', 'id_number', 'unit_name', 'team_code', 'rank', 'specialty', 'specialty_display',
                  'status', 'is_on_duty', 'current_lat', 'current_lng', 'full_name', 'phone', 'address']
        read_only_fields = ['status']

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        for attr, value in user_data.items():
            setattr(instance.user, attr, value)
        if 'phone' in user_data:
            instance.user.username = user_data['phone']
        if user_data:
            instance.user.save(update_fields=list(user_data) + (['username'] if 'phone' in user_data else []))
        return super().update(instance, validated_data)


def account_status(user):
    if user.is_active:
        return 'ACTIVE'
    rp = getattr(user, 'rescuer_profile', None)
    return rp.status if rp and rp.status in ['PENDING', 'REJECTED'] else 'BANNED'


class ProfileSerializer(ContactValidation, serializers.ModelSerializer):
    citizen_profile = CitizenProfileSerializer(read_only=True)
    rescuer_profile = RescuerProfileSerializer(read_only=True)
    account_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'role', 'full_name', 'phone', 'email', 'address', 'avatar_url',
                  'created_at', 'is_active', 'account_status', 'account_reason', 'citizen_profile', 'rescuer_profile']
        read_only_fields = ['id', 'username', 'created_at', 'role', 'is_active', 'account_reason']

    def get_account_status(self, obj):
        return account_status(obj)

    @transaction.atomic
    def update(self, instance, validated_data):
        if 'phone' in validated_data:
            validated_data['username'] = validated_data['phone']
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if validated_data:
            instance.save(update_fields=list(validated_data))
        return instance


class ProfileListSerializer(ProfileSerializer):
    class Meta(ProfileSerializer.Meta):
        fields = ['id', 'role', 'full_name', 'phone', 'email', 'avatar_url', 'created_at',
                  'is_active', 'account_status', 'account_reason']


class CitizenRegisterSerializer(ContactValidation, serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ['full_name', 'phone', 'email', 'password', 'address']

    def validate(self, attrs):
        password_value(attrs['password'], User(**{k: v for k, v in attrs.items() if k != 'password'}))
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(username=validated_data['phone'], password=password,
                                        role='CITIZEN', **validated_data)
        CitizenProfile.objects.create(user=user)
        return user


class RescuerRegisterSerializer(CitizenRegisterSerializer):
    unit_name = serializers.CharField(max_length=200)
    team_code = serializers.CharField(max_length=50, required=False, allow_blank=True)
    rank = serializers.CharField(max_length=100, required=False, allow_blank=True)
    specialty = serializers.ChoiceField(choices=RescuerProfile.SPECIALTY_CHOICES)

    class Meta(CitizenRegisterSerializer.Meta):
        fields = CitizenRegisterSerializer.Meta.fields + ['unit_name', 'team_code', 'rank', 'specialty']

    def validate(self, attrs):
        password_value(attrs['password'], User(full_name=attrs.get('full_name', ''), email=attrs.get('email', '')))
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        details = {key: validated_data.pop(key, '') for key in ['unit_name', 'team_code', 'rank', 'specialty']}
        password = validated_data.pop('password')
        user = User.objects.create_user(username=validated_data['phone'], password=password,
                                        role='RESCUER', is_active=False, **validated_data)
        RescuerProfile.objects.create(user=user, **details)
        return user
