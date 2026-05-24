from rest_framework import serializers
from .models import Mission, Resource


class MissionSerializer(serializers.ModelSerializer):
    rescuer_name = serializers.ReadOnlyField(source='rescuer.full_name')
    zone_name = serializers.ReadOnlyField(source='zone.name')

    class Meta:
        model = Mission
        fields = [
            'id', 'zone', 'zone_name',
            'rescuer', 'rescuer_name',
            'role', 'status',
            'joined_at', 'completed_at',
        ]
        read_only_fields = ['id', 'joined_at']


class ResourceSerializer(serializers.ModelSerializer):
    rescuer_name = serializers.ReadOnlyField(source='rescuer.full_name')

    class Meta:
        model = Resource
        fields = [
            'id', 'rescuer', 'rescuer_name',
            'vehicle_type', 'number_staff', 'is_available', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

