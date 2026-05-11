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
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    class Meta:
        model = SOSSignal
        fields = [
            'id', 'citizen', 'citizen_name',
            'signal_type', 'status', 'status_display',
            'location_lat', 'location_lng',
            'emergency_type', 'people_count', 'note',
            'zone', 'zone_name',
            'sent_at', 'images',
        ]
        read_only_fields = ['id', 'sent_at']


class SOSSignalListSerializer(serializers.ModelSerializer):
    """Serializer gọn cho danh sách SOS."""
    citizen_name = serializers.ReadOnlyField(source='citizen.full_name')
    images = SOSImageSerializer(many=True, read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    zone_name = serializers.ReadOnlyField(source='zone.name')


    class Meta:
        model = SOSSignal
        fields = [
            'id', 'citizen_name', 'signal_type', 'status', 'status_display',
            'location_lat', 'location_lng', 'note',
            'emergency_type', 'people_count', 'sent_at', 'images',
            'zone', 'zone_name',
        ]


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
        return obj.sos_signals.count()


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
        return obj.sos_signals.count()
