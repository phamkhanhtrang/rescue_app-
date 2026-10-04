/**
 * src/screens/citizen/sos/SOSRequestsScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lịch sử các yêu cầu SOS đã gửi.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';
import { records, getDraft, remember, clearDraft } from '../../../services/sosStorage';
import { apiClient } from '../../../services/apiClient';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const STATUS = {
  PENDING: 'CHỜ PHÂN CÔNG',
  ACKNOWLEDGED: 'ĐÃ TIẾP NHẬN',
  IN_PROGRESS: 'ĐANG HỖ TRỢ',
  RESOLVED: 'HOÀN THÀNH',
  CANCELLED: 'ĐÃ HỦY',
};

const STATUS_COLOR = {
  PENDING: '#FB8C00',
  ACKNOWLEDGED: '#1565C0',
  IN_PROGRESS: '#0288D1',
  RESOLVED: '#43A047',
  CANCELLED: '#757575',
};

export default function SOSRequestsScreen({ navigation }) {
  const { userInfo } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'RESOLVED'

  const load = useCallback(async () => {
    setError('');
    try {
      let local = await records();
      setItems(local);
      const draft = await getDraft();
      if (draft) {
        const recovered = await apiClient('/rescue_operations/sos/draft/', { headers: { 'X-SOS-Key': draft } });
        if (recovered.sos) {
          await remember(recovered.sos, draft);
          await clearDraft();
          local = await records();
        }
      }
      let rows = local;
      if (userInfo?.id) {
        const response = await API.sos.getAll({ citizen: userInfo.id });
        rows = [...local, ...(response.results || [])];
      }
      setItems(
        [...new Map(rows.map(item => [item.id, item])).values()].sort(
          (a, b) => new Date(b.sent_at || b.created_at || 0) - new Date(a.sent_at || a.created_at || 0)
        )
      );
    } catch (e) {
      setError(e.message || 'Không thể tải danh sách yêu cầu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userInfo?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredItems = items.filter(item => {
    if (filterTab === 'ACTIVE') return !['RESOLVED', 'CANCELLED'].includes(item.status);
    if (filterTab === 'RESOLVED') return ['RESOLVED', 'CANCELLED'].includes(item.status);
    return true;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Title Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerIconBox}>
            <Text style={styles.headerIcon}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>NHẬT KÝ CỨU HỘ</Text>
            <Text style={styles.title}>Lịch Sử Yêu Cầu SOS</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Theo dõi tiến độ, trao đổi thông tin với trung tâm điều phối và cập nhật trạng thái khẩn cấp.
        </Text>

        {/* Filter Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, filterTab === 'ALL' && styles.tabBtnActive]}
            onPress={() => setFilterTab('ALL')}
          >
            <Text style={[styles.tabText, filterTab === 'ALL' && styles.tabTextActive]}>
              Tất cả ({items.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, filterTab === 'ACTIVE' && styles.tabBtnActive]}
            onPress={() => setFilterTab('ACTIVE')}
          >
            <Text style={[styles.tabText, filterTab === 'ACTIVE' && styles.tabTextActive]}>
              Đang xử lý ({items.filter(i => !['RESOLVED', 'CANCELLED'].includes(i.status)).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, filterTab === 'RESOLVED' && styles.tabBtnActive]}
            onPress={() => setFilterTab('RESOLVED')}
          >
            <Text style={[styles.tabText, filterTab === 'RESOLVED' && styles.tabTextActive]}>
              Hoàn thành ({items.filter(i => ['RESOLVED', 'CANCELLED'].includes(i.status)).length})
            </Text>
          </TouchableOpacity>
        </View>

        {!!error && (
          <TouchableOpacity style={styles.errorCard} onPress={load}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <Text style={styles.retryText}>Chạm để thử lại ↻</Text>
          </TouchableOpacity>
        )}

        {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />}

        {!loading && !filteredItems.length && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚨</Text>
            <Text style={styles.emptyTitle}>Không có yêu cầu nào</Text>
            <Text style={styles.emptyText}>
              {filterTab === 'ALL'
                ? 'Bạn chưa gửi yêu cầu SOS nào. Tín hiệu SOS khi gửi sẽ xuất hiện ở đây.'
                : 'Không có yêu cầu phù hợp với bộ lọc đã chọn.'}
            </Text>
          </View>
        )}

        {filteredItems.map(item => {
          const color = STATUS_COLOR[item.status] || STATUS_COLOR.PENDING;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.requestCard}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('SOSTrackingScreen', { sosId: item.id })}
            >
              <View style={[styles.cardStripe, { backgroundColor: color }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
                    <View style={[styles.badgeDot, { backgroundColor: color }]} />
                    <Text style={[styles.badgeText, { color }]}>{STATUS[item.status] || 'SOS ĐÃ GỬI'}</Text>
                  </View>
                  <Text style={styles.cardArrow}>›</Text>
                </View>

                <Text style={styles.requestTitle}>{item.emergency_type || 'Yêu cầu cứu trợ khẩn cấp'}</Text>
                
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>🆔 {String(item.id).slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.metaText}>🕒 {new Date(item.sent_at || item.created_at).toLocaleString('vi-VN')}</Text>
                </View>

                {!!item.address && (
                  <Text numberOfLines={2} style={styles.addressText}>
                    📍 {item.address}
                  </Text>
                )}

                {item.people_count > 0 && (
                  <Text style={styles.peopleText}>👥 Số người cần giúp: {item.people_count} người</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.newSosBtn}
          onPress={() => navigation.navigate('AnonymousSOSScreen')}
          activeOpacity={0.85}
        >
          <Text style={styles.newSosText}>＋ GỬI YÊU CẦU SOS MỚI</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgLight },
  content: { padding: LAYOUT.screenPadding, paddingBottom: 36, gap: SPACING.md },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { fontSize: 24 },
  kicker: { fontSize: 11, color: COLORS.primary, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 22, color: COLORS.textPrimary, fontWeight: '900' },
  subtitle: { fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.card,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },

  errorCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    gap: 4,
  },
  errorText: { color: COLORS.primary, fontSize: 13 },
  retryText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },

  emptyCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...SHADOWS.card,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '800' },
  emptyText: { fontSize: 13, lineHeight: 18, color: COLORS.textSecondary, textAlign: 'center' },

  requestCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  cardStripe: { width: 6 },
  cardBody: { flex: 1, padding: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cardArrow: { fontSize: 20, color: COLORS.textHint },

  requestTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 11, color: COLORS.textHint },
  addressText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  peopleText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },

  newSosBtn: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...SHADOWS.sos,
  },
  newSosText: { color: COLORS.textWhite, fontWeight: '900', fontSize: 14, letterSpacing: 0.8 },
});
