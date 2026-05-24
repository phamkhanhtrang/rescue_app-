from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils import timezone

from .models import Mission, Resource
from .serializers import MissionSerializer, ResourceSerializer


# ─── MISSION ─────────────────────────────────────────────────

@api_view(['GET'])
def mission_list(request):
    """Danh sách nhiệm vụ, có thể lọc theo zone hoặc rescuer."""
    queryset = Mission.objects.all().order_by('-joined_at')
    zone_id = request.query_params.get('zone_id')
    rescuer_id = request.query_params.get('rescuer_id')
    s = request.query_params.get('status')
    if zone_id:
        queryset = queryset.filter(zone_id=zone_id)
    if rescuer_id:
        queryset = queryset.filter(rescuer_id=rescuer_id)
    if s:
        queryset = queryset.filter(status=s.upper())
    serializer = MissionSerializer(queryset, many=True)
    return Response({'count': queryset.count(), 'results': serializer.data})


@api_view(['POST'])
def mission_create(request):
    """Tạo / Giao nhiệm vụ cứu hộ."""
    serializer = MissionSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH'])
def mission_detail(request, pk):
    """Chi tiết / Cập nhật nhiệm vụ."""
    try:
        mission = Mission.objects.get(pk=pk)
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
def mission_complete(request, pk):
    """Đánh dấu nhiệm vụ là hoàn thành."""
    try:
        mission = Mission.objects.get(pk=pk)
    except Mission.DoesNotExist:
        return Response({'error': 'Không tìm thấy nhiệm vụ.'}, status=status.HTTP_404_NOT_FOUND)

    mission.status = 'COMPLETED'
    mission.completed_at = timezone.now()
    mission.save(update_fields=['status', 'completed_at'])
    return Response(MissionSerializer(mission).data)


# ─── RESOURCE ────────────────────────────────────────────────

@api_view(['GET'])
def resource_list(request):
    """Danh sách nguồn lực, có thể lọc theo rescuer hoặc is_available."""
    queryset = Resource.objects.all().order_by('-created_at')
    rescuer_id = request.query_params.get('rescuer_id')
    available = request.query_params.get('is_available')
    if rescuer_id:
        queryset = queryset.filter(rescuer_id=rescuer_id)
    if available is not None:
        queryset = queryset.filter(is_available=available.lower() == 'true')
    serializer = ResourceSerializer(queryset, many=True)
    return Response({'count': queryset.count(), 'results': serializer.data})


@api_view(['POST'])
def resource_create(request):
    """Khai báo nguồn lực mới."""
    serializer = ResourceSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
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
def mission_history(request, rescuer_id):
    """Lấy lịch sử nhiệm vụ của một Đội cứu trợ."""

    try:
        # Filter missions by rescuer
        missions = Mission.objects.filter(
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
