from rest_framework import serializers
from .models import Mission, Resource


class MissionSerializer(serializers.ModelSerializer):
    rescuer_name  = serializers.ReadOnlyField(source='rescuer.full_name')
    rescuer_phone = serializers.ReadOnlyField(source='rescuer.phone')
    zone_name     = serializers.ReadOnlyField(source='zone.name')

    # ── Trường từ RescuerProfile (truy cập an toàn) ─────────────────────────
    rescuer_unit      = serializers.SerializerMethodField()
    rescuer_rank      = serializers.SerializerMethodField()
    rescuer_specialty = serializers.SerializerMethodField()
    rescuer_on_duty   = serializers.SerializerMethodField()
    rescuer_lat       = serializers.SerializerMethodField()
    rescuer_lng       = serializers.SerializerMethodField()

    class Meta:
        model = Mission
        fields = [
            'id', 'zone', 'zone_name',
            'rescuer', 'rescuer_name', 'rescuer_phone',
            'rescuer_unit', 'rescuer_rank', 'rescuer_specialty',
            'rescuer_on_duty', 'rescuer_lat', 'rescuer_lng',
            'role', 'status',
            'joined_at', 'completed_at',
        ]
        read_only_fields = ['id', 'joined_at']

    def _get_profile(self, obj):
        """Lấy RescuerProfile an toàn — không raise exception nếu chưa tồn tại."""
        try:
            return obj.rescuer.rescuer_profile if obj.rescuer else None
        except Exception:
            return None

    def get_rescuer_unit(self, obj):
        rp = self._get_profile(obj)
        return rp.unit_name if rp else None

    def get_rescuer_rank(self, obj):
        rp = self._get_profile(obj)
        return rp.rank if rp else None

    def get_rescuer_specialty(self, obj):
        rp = self._get_profile(obj)
        if not rp:
            return None
        try:
            return rp.get_specialty_display()
        except Exception:
            return rp.specialty

    def get_rescuer_on_duty(self, obj):
        rp = self._get_profile(obj)
        return bool(rp.is_on_duty) if rp else False

    def get_rescuer_lat(self, obj):
        rp = self._get_profile(obj)
        return float(rp.current_lat) if rp and rp.current_lat is not None else None

    def get_rescuer_lng(self, obj):
        rp = self._get_profile(obj)
        return float(rp.current_lng) if rp and rp.current_lng is not None else None


class ResourceSerializer(serializers.ModelSerializer):
    rescuer_name = serializers.ReadOnlyField(source='rescuer.full_name')

    class Meta:
        model = Resource
        fields = [
            'id', 'rescuer', 'rescuer_name',
            'vehicle_type', 'vehicle_count', 'number_staff', 'specialties', 'supplies',
            'is_available', 'created_at', 'updated_at', 'confirmed_at', 'verification_status',
        ]
        read_only_fields = ['id', 'rescuer', 'created_at', 'updated_at', 'confirmed_at', 'verification_status']

    def validate_number_staff(self, value):
        if value < 1 or value > 1000:
            raise serializers.ValidationError('Số nhân sự phải từ 1 đến 1000.')
        return value

    def validate_vehicle_count(self, value):
        if value > 1000:
            raise serializers.ValidationError('Số phương tiện tối đa là 1000.')
        return value

    def validate(self, attrs):
        if attrs.get('vehicle_count', getattr(self.instance, 'vehicle_count', 0)) > 0 and not attrs.get('vehicle_type', getattr(self.instance, 'vehicle_type', '')):
            raise serializers.ValidationError('Cần khai báo loại phương tiện.')
        return attrs

    def validate_specialties(self, value):
        allowed = ['RESCUE', 'MEDICAL', 'FOOD', 'LOGISTICS', 'COMMAND']
        if not isinstance(value, list) or any(v not in allowed for v in value):
            raise serializers.ValidationError('Chuyên môn không hợp lệ.')
        return list(dict.fromkeys(value))

    def validate_supplies(self, value):
        if not isinstance(value, dict) or any(k not in ['water', 'medicine', 'rice', 'food', 'life_jacket'] or
                not isinstance(v, int) or isinstance(v, bool) or v < 0 or v > 100000 for k, v in value.items()):
            raise serializers.ValidationError('Vật tư phải có số lượng nguyên không âm.')
        return value
