import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import API from '../services/api';
import useLiveRefresh from '../hooks/useLiveRefresh';
import { alertLocationParams, isEmergencyAlert } from '../services/alertPolicy';
import { useAuth } from '../context/AuthContext';
import { contentParts } from '../services/contentLinks';

export default function AlertDetailScreen({ route, navigation }) {
  const { alertId } = route.params || {};
  const { userRole } = useAuth();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { setItem(null); setError(''); setLoading(true); }, [alertId]);
  const load = useCallback(async isCurrent => {
    try {
      const params = alertLocationParams();
      const data = await API.alerts.getDetails(alertId, params);
      if (!isCurrent()) return;
      setItem(data);
      setError('');
      // Opening this actual detail is the only action that acknowledges reading.
      if (!data.is_read) {
        await API.alerts.markRead(alertId, data.publication, params);
        if (isCurrent()) setItem({ ...data, is_read: true });
      }
    } catch (e) {
      if (!isCurrent()) return;
      setItem(null);
      setError(e.status === 404 ? 'Bản tin đã thu hồi, hết hạn hoặc không thuộc phạm vi của bạn.' : e.message || 'Không tải được bản tin.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [alertId]);
  const refresh = useLiveRefresh(load);
  const parts = contentParts(item?.description || '');
  const sourceUrl = parts.find(part => part.url)?.url;
  const openLink = url => Linking.openURL(url).catch(() => setError('Không mở được bài viết nguồn. Vui lòng kiểm tra trình duyệt hoặc kết nối mạng.'));
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16, backgroundColor: '#fff', flexGrow: 1 }}>
    {loading && <ActivityIndicator />}
    {error ? <View><Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error}</Text>
      <TouchableOpacity onPress={refresh}><Text style={{ paddingVertical: 16, color: '#1d4ed8' }}>Thử lại</Text></TouchableOpacity></View> : null}
    {item && <>
      <Text style={{ color: isEmergencyAlert(item) ? '#b91c1c' : '#1d4ed8', fontWeight: 'bold' }}>
        {isEmergencyAlert(item) ? 'CẢNH BÁO KHẨN CẤP' : 'THÔNG BÁO CHỈ ĐẠO'} · {item.is_read ? 'Đã đọc' : 'Mới'}
      </Text>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{item.title}</Text>
      <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>📍 {item.zone_name ? String(item.zone_name).replace(/Zone\s*AI\s*/gi, 'Khu vực ') : 'Toàn hệ thống'}</Text>
      <Text>{new Date(item.published_at || item.created_at).toLocaleString('vi-VN')}</Text>
      {item.expires_at && <Text>Hết hạn: {new Date(item.expires_at).toLocaleString('vi-VN')}</Text>}
      <Text style={{ fontSize: 16, lineHeight: 24, color: '#334155' }}>{parts.map((part, index) => part.url
        ? (part.text.startsWith('http') ? null : <Text key={index} accessibilityRole="link" style={{ color: '#1d4ed8', textDecorationLine: 'underline' }} onPress={() => openLink(part.url)}>{part.text}</Text>)
        : part.text)}</Text>
      {sourceUrl && (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => openLink(sourceUrl)}
          style={{
            backgroundColor: '#EFF6FF',
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#BFDBFE',
            marginTop: 8,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16 }}>🌐</Text>
          <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 14 }}>Đọc toàn văn bài viết trên báo gốc ↗</Text>
        </TouchableOpacity>
      )}
      {userRole === 'CITIZEN' && item.source === 'COMMUNITY' && <TouchableOpacity onPress={() => navigation.navigate('CitizenTabs', {
        screen: 'AlertsTab', params: { screen: 'CommunityVerifyScreen', params: { alertId: item.id, location: alertLocationParams() } },
      })}><Text style={{ color: '#1d4ed8' }}>Phản hồi hiện trường</Text></TouchableOpacity>}
    </>}
  </ScrollView>;
}
