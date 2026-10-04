from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
import logging

from .models import Mission, Resource
from .serializers import MissionSerializer, ResourceSerializer

logger = logging.getLogger(__name__)


# ─── MISSION ─────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mission_list(request):
    """Danh sách nhiệm vụ, có thể lọc theo zone hoặc rescuer."""
    queryset = Mission.objects.select_related(
        'rescuer', 'rescuer__rescuer_profile', 'zone'
    ).order_by('-joined_at')
    zone_id = request.query_params.get('zone_id')
    rescuer_id = request.query_params.get('rescuer_id')
    s = request.query_params.get('status')
    active = request.query_params.get('active')
    if zone_id:
        queryset = queryset.filter(zone_id=zone_id)
    if rescuer_id:
        queryset = queryset.filter(rescuer_id=rescuer_id)
    if s:
        queryset = queryset.filter(status=s.upper())
    if active and active.lower() in ['1', 'true', 'yes']:
        queryset = queryset.filter(status__in=['PENDING_ACCEPTANCE', 'ACCEPTED', 'ON_MY_WAY', 'ACTIVE', 'NEEDS_HELP'])
    serializer = MissionSerializer(queryset, many=True)
    return Response({'count': queryset.count(), 'results': serializer.data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mission_create(request):
    """Tạo / Giao nhiệm vụ cứu hộ. Sau khi lưu, tính lại điểm ưu tiên của Zone."""
    serializer = MissionSerializer(data=request.data)
    if serializer.is_valid():
        mission = serializer.save()

        # ── Trigger tính lại điểm uu tiên khi Rescuer nhận nhiệm vụ ────────
        # Vì số người cứu hộ đang thực hiện thay đổi → điểm thiếu hụt giảm xuống
        if mission.zone_id:
            try:
                from ai.priority_scorer import run_priority_scoring
                result = run_priority_scoring(zone_ids=[str(mission.zone_id)])
                logger.info(
                    f"[AI Trigger] Mission mới cho Zone {mission.zone_id} → "
                    f"score: {result['scores']}"
                )
            except Exception as e:
                logger.error(f"[AI Trigger] Scoring thất bại sau mission create: {e}")
        # ─────────────────────────────────────────────────────────────────

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def mission_detail(request, pk):
    """Chi tiết / Cập nhật nhiệm vụ."""
    try:
        mission = Mission.objects.select_related(
            'rescuer', 'rescuer__rescuer_profile', 'zone'
        ).get(pk=pk)
    except Mission.DoesNotExist:
        return Response({'error': 'Không tìm thấy nhiệm vụ.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(MissionSerializer(mission).data)

    serializer = MissionSerializer(mission, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mission_complete(request, pk):
    """Hoàn thành nhiệm vụ. Sau khi lưu, tính lại điểm ưu tiên của Zone."""
    try:
        mission = Mission.objects.select_related(
            'rescuer', 'rescuer__rescuer_profile', 'zone'
        ).get(pk=pk)
    except Mission.DoesNotExist:
        return Response({'error': 'Không tìm thấy nhiệm vụ.'}, status=status.HTTP_404_NOT_FOUND)

    mission.status = 'COMPLETED'
    mission.completed_at = timezone.now()
    mission.save(update_fields=['status', 'completed_at'])

    # ── Trigger tính lại điểm khi Rescuer hoàn thành nhiệm vụ ──────────
    # Vì Rescuer rời đi → zone có thể thiếu người hơn → điểm tăng lại
    if mission.zone_id:
        try:
            from ai.priority_scorer import run_priority_scoring
            run_priority_scoring(zone_ids=[str(mission.zone_id)])
            logger.info(f"[AI Trigger] Mission {pk} hoàn thành → tính lại Zone {mission.zone_id}")
        except Exception as e:
            logger.error(f"[AI Trigger] Scoring thất bại sau mission complete: {e}")
    # ─────────────────────────────────────────────────────────────────

    return Response(MissionSerializer(mission).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mission_leave(request, pk):
    """Rời khỏi / Hủy nhiệm vụ. Sau khi lưu, tính lại điểm ưu tiên của Zone."""
    try:
        mission = Mission.objects.get(pk=pk)
    except Mission.DoesNotExist:
        return Response({'error': 'Không tìm thấy nhiệm vụ.'}, status=status.HTTP_404_NOT_FOUND)

    mission.status = 'CANCELLED'
    mission.completed_at = timezone.now()
    mission.save(update_fields=['status', 'completed_at'])

    # ── Trigger tính lại điểm khi Rescuer rời đi ──────────
    # Vì Rescuer rời đi (thoát zone) → zone thiếu người → điểm tăng lại
    if mission.zone_id:
        try:
            from ai.priority_scorer import run_priority_scoring
            run_priority_scoring(zone_ids=[str(mission.zone_id)])
            logger.info(f"[AI Trigger] Mission {pk} bị hủy/rời → tính lại Zone {mission.zone_id}")
        except Exception as e:
            logger.error(f"[AI Trigger] Scoring thất bại sau mission leave: {e}")
    # ─────────────────────────────────────────────────────────────────

    return Response(MissionSerializer(mission).data)


# ─── RESOURCE ────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resource_list(request):
    """Danh sách nguồn lực, có thể lọc theo rescuer hoặc is_available."""
    queryset = Resource.objects.select_related('rescuer').order_by('-created_at')
    rescuer_id = request.query_params.get('rescuer_id')
    available = request.query_params.get('is_available')
    if rescuer_id:
        queryset = queryset.filter(rescuer_id=rescuer_id)
    if available is not None:
        queryset = queryset.filter(is_available=available.lower() == 'true')
    serializer = ResourceSerializer(queryset, many=True)
    return Response({'count': queryset.count(), 'results': serializer.data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resource_create(request):
    """Khai báo nguồn lực mới."""
    serializer = ResourceSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def resource_detail(request, pk):
    """Chi tiết / Cập nhật / Xóa nguồn lực."""
    try:
        resource = Resource.objects.get(pk=pk)
    except Resource.DoesNotExist:
        return Response({'error': 'Không tìm thấy nguồn lực.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ResourceSerializer(resource).data)

    if request.method == 'PUT':
        serializer = ResourceSerializer(resource, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        resource.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mission_history(request, rescuer_id):
    """Lấy lịch sử nhiệm vụ của một Đội cứu trợ."""

    try:
        # Filter missions by rescuer
        missions = Mission.objects.select_related(
            'rescuer', 'rescuer__rescuer_profile', 'zone'
        ).filter(
            rescuer_id=rescuer_id
        ).order_by('-joined_at')

        # Serialize mission history
        serializer = MissionSerializer(missions, many=True)

        return Response({
            'status': 'success',
            'count': missions.count(),
            'results': serializer.data
        })

    except Exception as e:
        print(f"MISSION HISTORY ERROR: {str(e)}")
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=500)
