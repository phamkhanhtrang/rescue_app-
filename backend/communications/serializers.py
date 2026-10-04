from rest_framework import serializers
from django.utils import timezone
from django.conf import settings
from rescue_operations.flow import admin
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
    is_read = serializers.BooleanField(read_only=True, default=False)
    delivery_status = serializers.SerializerMethodField()
    source_article = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = [
            'id', 'zone', 'zone_name', 'title', 'description',
            'category', 'severity', 'source',
            'location_lat', 'location_lng',
            'is_active', 'created_at',
            'vote_count', 'votes',
            'source_article',
            'message_type', 'audience', 'expires_at', 'publication', 'published_at', 'is_read', 'delivery_status',
        ]
        read_only_fields = ['id', 'created_at', 'publication', 'published_at']

    def validate(self, attrs):
        current = self.instance
        value = lambda key, default=None: attrs.get(key, getattr(current, key, default))
        if (not current or 'title' in attrs) and not value('title', '').strip():
            raise serializers.ValidationError({'title': 'Vui lòng nhập tiêu đề.'})
        if (not current or 'description' in attrs) and not (value('description', '') or '').strip():
            raise serializers.ValidationError({'description': 'Vui lòng nhập nội dung.'})
        expiry = value('expires_at')
        if expiry and expiry <= timezone.now() and value('is_active', True):
            raise serializers.ValidationError({'expires_at': 'Thời điểm hết hạn phải ở tương lai để phát/kích hoạt tin.'})
        message_type = value('message_type')
        if not message_type:
            message_type = 'EMERGENCY' if (value('severity', '') or '').upper() in ('CRITICAL', 'HIGH', 'EMERGENCY') or value('category') == 'emergency' else 'BROADCAST'
        attrs['message_type'] = message_type
        if not current and 'audience' not in attrs and attrs.get('category') == 'teams':
            attrs['audience'] = 'RESCUER'
        if 'message_type' in self.initial_data:
            attrs['severity'] = 'CRITICAL' if message_type == 'EMERGENCY' else 'NORMAL'
        if not current or any(key in self.initial_data for key in ('message_type', 'audience', 'zone')):
            attrs['category'] = 'teams' if value('audience', 'ALL') == 'RESCUER' else 'emergency' if message_type == 'EMERGENCY' else 'zone' if value('zone') else 'system'
        return attrs

    def update(self, instance, validated_data):
        republish = (not instance.is_active and validated_data.get('is_active')) or any(
            key in validated_data and validated_data[key] != getattr(instance, key)
            for key in ('title', 'description', 'message_type', 'audience', 'zone', 'expires_at', 'severity')
        )
        if republish:
            validated_data['publication'] = instance.publication + 1
            validated_data['published_at'] = timezone.now()
        return super().update(instance, validated_data)

    def get_delivery_status(self, obj):
        request = self.context.get('request')
        if not request or not admin(request.user):
            return None
        deliveries = [d for d in obj.deliveries.all() if d.publication == obj.publication]
        return {
            'published': True,
            'push_enabled': getattr(settings, 'EXPO_PUSH_ENABLED', False),
            'read_count': sum(r.publication == obj.publication for r in obj.reads.all()),
            'queued': sum(d.status in ('PENDING', 'SENDING') for d in deliveries),
            'expo_accepted': sum(d.status in ('ACCEPTED', 'RECEIPT_OK') for d in deliveries),
            'push_service_confirmed': sum(d.status == 'RECEIPT_OK' for d in deliveries),
            'failed': sum(d.status == 'FAILED' for d in deliveries),
            'unknown': sum(d.status == 'UNKNOWN' for d in deliveries),
        }

    def get_vote_count(self, obj):
        return obj.votes.count()

    def get_source_article(self, obj):
        article = obj.crawled_sources.filter(is_published=True, status__in=['APPROVED', 'ALERT_CREATED']).exclude(source_platform='FACEBOOK').first()
        return {'id': str(article.pk), 'title': article.raw_title} if article else None

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


class AlertListSerializer(AlertSerializer):
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
            'zone', 'message_type', 'audience', 'expires_at', 'publication', 'published_at', 'is_read', 'delivery_status',
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
