from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Alert, AlertVote
from .serializers import AlertSerializer, AlertListSerializer, AlertVoteSerializer


# ─── ALERT ───────────────────────────────────────────────────

@api_view(['GET'])
def alert_list(request):
    """Danh sách cảnh báo, có thể lọc theo source và is_active."""
    queryset = Alert.objects.all().order_by('-created_at')
    source = request.query_params.get('source')
    is_active = request.query_params.get('is_active')
    if source:
        queryset = queryset.filter(source=source.upper())
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active.lower() == 'true')
    serializer = AlertListSerializer(queryset, many=True)
    return Response({'count': queryset.count(), 'results': serializer.data})


@api_view(['POST'])
def alert_create(request):
    """Tạo cảnh báo mới."""
    serializer = AlertSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
def alert_detail(request, pk):
    """Chi tiết / Cập nhật / Xóa một Alert."""
    try:
        alert = Alert.objects.get(pk=pk)
    except Alert.DoesNotExist:
        return Response({'error': 'Không tìm thấy cảnh báo.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(AlertSerializer(alert).data)

    if request.method == 'PUT':
        serializer = AlertSerializer(alert, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        alert.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── ALERT VOTE ──────────────────────────────────────────────

@api_view(['POST'])
def alert_vote(request, alert_id):
    """
    Xác nhận cộng đồng cho một cảnh báo.
    Mỗi người chỉ vote được 1 lần.
    """
    try:
        Alert.objects.get(pk=alert_id)
    except Alert.DoesNotExist:
        return Response({'error': 'Không tìm thấy cảnh báo.'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data.copy()
    data['alert'] = alert_id

    # Kiểm tra đã vote chưa
    user_id = data.get('user')
    if AlertVote.objects.filter(alert_id=alert_id, user_id=user_id).exists():
        return Response({'error': 'Bạn đã vote cho cảnh báo này rồi.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = AlertVoteSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)