from rest_framework import serializers
from .models import Alert, AlertVote


class AlertVoteSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.full_name')

    class Meta:
        model = AlertVote
        fields = ['id', 'alert', 'user', 'user_name', 'verdict', 'voted_at']
        read_only_fields = ['id', 'voted_at']


class AlertSerializer(serializers.ModelSerializer):
    votes = AlertVoteSerializer(many=True, read_only=True)
    vote_count = serializers.SerializerMethodField()
    zone_name = serializers.ReadOnlyField(source='zone.name')
    location_lat = serializers.SerializerMethodField()
    location_lng = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = [
            'id', 'zone', 'zone_name', 'title', 'description',
            'category', 'severity', 'source',
            'location_lat', 'location_lng',
            'is_active', 'created_at',
            'vote_count', 'votes',
        ]
        read_only_fields = ['id', 'created_at']

    def get_vote_count(self, obj):
        return obj.votes.count()

    def get_location_lat(self, obj):
        if obj.location_lat is not None:
            return obj.location_lat
        if obj.zone and obj.zone.location_lat is not None:
            return obj.zone.location_lat
        return None

    def get_location_lng(self, obj):
        if obj.location_lng is not None:
            return obj.location_lng
        if obj.zone and obj.zone.location_lng is not None:
            return obj.zone.location_lng
        return None


class AlertListSerializer(serializers.ModelSerializer):
    """Serializer gọn cho danh sách cảnh báo."""
    zone_name = serializers.ReadOnlyField(source='zone.name')
    vote_count = serializers.SerializerMethodField()
    location_lat = serializers.SerializerMethodField()
    location_lng = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = [
            'id', 'zone_name', 'title', 'category','description',
            'severity', 'source', 'is_active', 'created_at', 'vote_count',
            'location_lat', 'location_lng',
        ]

    def get_vote_count(self, obj):
        return obj.votes.count()

    def get_location_lat(self, obj):
        if obj.location_lat is not None:
            return obj.location_lat
        if obj.zone and obj.zone.location_lat is not None:
            return obj.zone.location_lat
        return None

    def get_location_lng(self, obj):
        if obj.location_lng is not None:
            return obj.location_lng
        if obj.zone and obj.zone.location_lng is not None:
            return obj.zone.location_lng
        return None