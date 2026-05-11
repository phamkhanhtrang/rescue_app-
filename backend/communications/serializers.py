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


class AlertListSerializer(serializers.ModelSerializer):
    """Serializer gọn cho danh sách cảnh báo."""
    zone_name = serializers.ReadOnlyField(source='zone.name')
    vote_count = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = [
            'id', 'zone_name', 'title', 'category',
            'severity', 'source', 'is_active', 'created_at', 'vote_count',
        ]

    def get_vote_count(self, obj):
        return obj.votes.count()