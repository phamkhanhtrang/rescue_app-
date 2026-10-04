from rest_framework import serializers
from .models import Zone, SOSSignal, SOSImage


class SOSImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SOSImage
        fields = ['id', 'sos', 'image', 'caption', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


class SOSSignalSerializer(serializers.ModelSerializer):
    images = SOSImageSerializer(many=True, read_only=True)
    citizen_name = serializers.ReadOnlyField(source='citizen.full_name')
    zone_name = serializers.ReadOnlyField(source='zone.name')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_rescuer_name = serializers.CharField(source='assigned_mission.rescuer.full_name', read_only=True, default=None)
    assigned_mission_status = serializers.CharField(source='assigned_mission.status', read_only=True, default=None)

    class Meta:
        model = SOSSignal
        fields = [
            'id', 'citizen', 'citizen_name',
            'signal_type', 'status', 'status_display',
            'location_lat', 'location_lng',
            'emergency_type', 'people_count', 'note',
            'zone', 'zone_name',
            'contact_name', 'contact_phone', 'address', 'location_source',
            'verification_status', 'assigned_mission', 'assigned_rescuer_name', 'assigned_mission_status',
            'supplies_needed', 'supplies_delivered',
            'sent_at', 'images',
        ]
        read_only_fields = ['id', 'sent_at']

    def create(self, validated_data):
        citizen = validated_data.get('citizen')
        if citizen:
            contact_info = []
            if citizen.full_name:
                contact_info.append(f"Tên: {citizen.full_name}")
            if getattr(citizen, 'phone', None):
                contact_info.append(f"SĐT: {citizen.phone}")
            if getattr(citizen, 'address', None):
                contact_info.append(f"Địa chỉ: {citizen.address}")
            
            if contact_info:
                prefix = " | ".join(contact_info)
                note = validated_data.get('note', '')
                if note:
                    validated_data['note'] = f"[{prefix}]\n{note}"
                else:
                    validated_data['note'] = f"[{prefix}]"

        return super().create(validated_data)


class SOSSignalListSerializer(serializers.ModelSerializer):
    """Serializer gọn cho danh sách SOS."""
    citizen_name = serializers.ReadOnlyField(source='citizen.full_name')
    images = SOSImageSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    zone_name = serializers.ReadOnlyField(source='zone.name')
    assigned_rescuer_name = serializers.CharField(source='assigned_mission.rescuer.full_name', read_only=True, default=None)
    assigned_mission_status = serializers.CharField(source='assigned_mission.status', read_only=True, default=None)

    class Meta:
        model = SOSSignal
        fields = [
            'id', 'citizen_name', 'signal_type', 'status', 'status_display',
            'location_lat', 'location_lng', 'note',
            'emergency_type', 'people_count', 'sent_at', 'images',
            'zone', 'zone_name',
            'contact_name', 'contact_phone', 'address', 'location_source',
            'verification_status', 'assigned_mission', 'assigned_rescuer_name', 'assigned_mission_status',
            'supplies_needed', 'supplies_delivered',
        ]

    def get_fields(self):
        fields = super().get_fields()
        if not self.context.get('include_images', True):
            fields.pop('images', None)
        return fields


class ZoneSerializer(serializers.ModelSerializer):
    sos_count = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            'id', 'name', 'sector_code',
            'status', 'severity', 'incident_type', 'description',
            'location_lat', 'location_lng',
            'people_affected', 'rescuers_needed',
            'ai_priority_score', 'created_at', 'updated_at',
            'sos_count',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_sos_count(self, obj):
        return getattr(obj, '_sos_count', None) if hasattr(obj, '_sos_count') else obj.sos_signals.count()


class ZoneListSerializer(serializers.ModelSerializer):
    """Serializer gọn cho danh sách vùng."""
    sos_count = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            'id', 'name', 'sector_code',
            'status', 'severity', 'incident_type',
            'location_lat', 'location_lng',
            'people_affected', 'rescuers_needed',
            'ai_priority_score', 'created_at', 'updated_at', 'sos_count',
        ]

    def get_sos_count(self, obj):
        return getattr(obj, '_sos_count', None) if hasattr(obj, '_sos_count') else obj.sos_signals.count()
