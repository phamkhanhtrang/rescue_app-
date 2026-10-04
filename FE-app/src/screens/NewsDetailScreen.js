import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity } from 'react-native';
import API from '../services/api';
import useLiveRefresh from '../hooks/useLiveRefresh';

export default function NewsDetailScreen({ route }) {
  const { newsId } = route.params || {};
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async isCurrent => {
    try { const data = await API.news.getDetails(newsId); if (isCurrent()) { setItem(data); setError(''); } }
    catch (e) { if (isCurrent()) { setItem(null); setError(e.status === 404 ? 'Tin đã được gỡ khỏi hệ thống.' : e.message || 'Không tải được tin tức.'); } }
  }, [newsId]);
  useLiveRefresh(load, 30000);
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 14, flexGrow: 1 }}>
    {!item && !error && <ActivityIndicator />}
    {error ? <Text accessibilityRole="alert" style={{ color: '#B91C1C' }}>{error}</Text> : null}
    {item && <>
      <Text style={{ color: '#1D4ED8', fontWeight: '700' }}>{item.source_platform} · Tin tức đã xuất bản</Text>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>{item.title}</Text>
      {item.location ? <Text>📍 {item.location}</Text> : null}
      <Text style={{ lineHeight: 25, fontSize: 16 }}>{item.content || item.summary}</Text>
      {item.source_url ? <TouchableOpacity onPress={() => Linking.openURL(item.source_url).catch(() => {})}><Text style={{ color: '#1D4ED8' }}>Đọc bài gốc ↗</Text></TouchableOpacity> : null}
      {item.related_alert ? <Text style={{ color: '#B91C1C', fontWeight: '700' }}>Có cảnh báo chính thức liên quan: {item.related_alert.title}</Text> : null}
    </>}
  </ScrollView>;
}
