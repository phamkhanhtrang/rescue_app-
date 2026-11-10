from rest_framework import serializers
from .models import Zone, SOSSignal, SOSImage, CrowdReport, CrowdReportVote


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



class CrowdReportVoteSerializer(serializers.ModelSerializer):
    verdict_display = serializers.CharField(source='get_verdict_display', read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = CrowdReportVote
        fields = [
            'id', 'report', 'user', 'voter_name', 'voter_role',
            'verdict', 'verdict_display', 'note', 'water_level_cm',
            'image', 'image_url',
            'incident_wave', 'is_active_vote', 'voted_at',
        ]
        read_only_fields = ['id', 'voted_at']

    def get_image_url(self, obj):
        if not obj.image:
            return None
        try:
            url = obj.image.url
            req = self.context.get('request') if hasattr(self, 'context') and self.context else None
            return req.build_absolute_uri(url) if req else url
        except Exception:
            return None


class CrowdReportSerializer(serializers.ModelSerializer):
    hazard_display = serializers.CharField(source='get_hazard_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    votes = CrowdReportVoteSerializer(many=True, read_only=True)
    vote_summary = serializers.SerializerMethodField()
    road_geometry = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    remaining_minutes = serializers.SerializerMethodField()
    my_active_vote = serializers.SerializerMethodField()

    class Meta:
        model = CrowdReport
        fields = [
            'id', 'reporter', 'reporter_name',
            'hazard_type', 'hazard_display',
            'water_level_cm', 'severity', 'severity_display',
            'location_lat', 'location_lng', 'end_lat', 'end_lng',
            'road_geometry', 'segment_length_m',
            'address', 'description', 'image', 'image_url',
            'status', 'status_display', 'is_verified', 'is_hidden', 'report_count',
            'incident_wave', 'wave_started_at', 'expires_at', 'remaining_minutes',
            'created_at', 'updated_at', 'cleared_at',
            'votes', 'vote_summary', 'my_active_vote',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'cleared_at']

    def get_image_url(self, obj):
        if obj.image:
            try:
                url = obj.image.url
                req = self.context.get('request') if hasattr(self, 'context') and self.context else None
                return req.build_absolute_uri(url) if req else url
            except Exception:
                pass
        # Nếu báo cáo gốc chưa có ảnh nhưng lượt vote xác nhận có đính kèm ảnh, lấy ảnh mới nhất
        for v in obj.votes.all():
            if v.image and v.verdict != 'FALSE_REPORT':
                try:
                    url = v.image.url
                    req = self.context.get('request') if hasattr(self, 'context') and self.context else None
                    return req.build_absolute_uri(url) if req else url
                except Exception:
                    continue
        return None

    def get_remaining_minutes(self, obj):
        from django.utils import timezone
        if obj.is_hidden or obj.status in ('REJECTED', 'EXPIRED'):
            return 0
        if not obj.expires_at:
            return None
        diff = (obj.expires_at - timezone.now()).total_seconds()
        return max(0, round(diff / 60))

    def get_my_active_vote(self, obj):
        req = self.context.get('request') if hasattr(self, 'context') and self.context else None
        if not req:
            return None
        user = getattr(req, 'user', None)
        voter_id_param = req.query_params.get('voter_id') if hasattr(req, 'query_params') else None
        for v in obj.votes.all():
            if not v.is_active_vote or v.incident_wave != obj.incident_wave:
                continue
            if user and getattr(user, 'is_authenticated', False) and v.user_id == user.id:
                return v.verdict
            if voter_id_param and v.voter_identifier == f"id:{str(voter_id_param).strip().lower()}":
                return v.verdict
        return None

    def get_road_geometry(self, obj):
        if obj.road_geometry and isinstance(obj.road_geometry, list) and len(obj.road_geometry) >= 2:
            return obj.road_geometry
        lat, lng = float(obj.location_lat), float(obj.location_lng)
        if obj.end_lat is not None and obj.end_lng is not None:
            e_lat, e_lng = float(obj.end_lat), float(obj.end_lng)
            return [
                [round(lat, 6), round(lng, 6)],
                [round((lat + e_lat) / 2, 6), round((lng + e_lng) / 2, 6)],
                [round(e_lat, 6), round(e_lng, 6)],
            ]
        return [
            [round(lat - 0.0006, 6), round(lng, 6)],
            [round(lat, 6), round(lng, 6)],
            [round(lat + 0.0006, 6), round(lng, 6)],
        ]

    def get_vote_summary(self, obj):
        from datetime import timedelta
        from django.utils import timezone
        ttl_cutoff = timezone.now() - timedelta(hours=6)
        all_votes = list(obj.votes.all())
        # Quy tắc 1 & 2: Chỉ đếm phiếu hiện hành (is_active_vote=True) của đợt hiện tại (incident_wave) và còn hạn 6h
        valid_votes = [
            v for v in all_votes
            if v.is_active_vote and v.incident_wave == obj.incident_wave and v.voted_at >= ttl_cutoff
        ]
        confirm = sum(1 for v in valid_votes if v.verdict in ('CONFIRM_DANGER', 'WORSENED'))
        worsened = sum(1 for v in valid_votes if v.verdict == 'WORSENED')
        receding = sum(1 for v in valid_votes if v.verdict == 'RECEDING')
        cleared = sum(1 for v in valid_votes if v.verdict == 'CLEARED')
        false_rep = sum(1 for v in valid_votes if v.verdict == 'FALSE_REPORT')
        return {
            'confirm_count': confirm,
            'worsened_count': worsened,
            'receding_count': receding,
            'cleared_count': cleared,
            'false_count': false_rep,
            'active_total': len(valid_votes),
            'total': len(all_votes),
        }
