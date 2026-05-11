/**
 * src/screens/rescuer/missions/ZoneListScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Danh sách Vùng Cứu Hộ Hoạt Động (Screen 4 — Tab NHIỆM VỤ default).
 *
 * Bố cục Figma:
 *  1. Header + "LIVE OPS UPDATED" badge
 *  2. "Vùng Cứu Hộ Hoạt Động" title
 *  3. Danh sách zone cards: quận, SOS count, team count, status, action
 *  4. AI SENTINEL INSIGHT card
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl
} from 'react-native';
import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';

const getSeverityStyles = (severity) => {
  switch (severity) {
    case 'CRITICAL':
      return { color: RCOLORS.primary, icon: '🔴', label: 'Nguy cấp' };
    case 'HIGH':
      return { color: RCOLORS.statusOrange, icon: '🟠', label: 'Cao' };
    case 'MEDIUM':
      return { color: RCOLORS.statusBlue, icon: '🔵', label: 'Trung bình' };
    case 'LOW':
      return { color: RCOLORS.statusGreen, icon: '🟢', label: 'Thấp' };
    default:
      return { color: RCOLORS.textHint, icon: '⚪', label: 'Không rõ' };
  }
};

const getStatusLabel = (status) => {
  const mapping = {
    'ACTIVE': 'Đang xảy ra',
    'STABILIZING': 'Đang ổn định',
    'RESOLVED': 'Đã giải quyết',
    'STANDBY': 'Chờ',
  };
  return mapping[status] || status;
};

const ZoneListScreen = ({ navigation }) => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchZones = async () => {
    try {
      const response = await API.zones.getAll();
      setZones(response.results || []);
      setError(null);
    } catch (err) {
      console.error('Fetch zones error:', err);
      setError('Không thể tải danh sách vùng sự cố.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchZones();
  }, []);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RCOLORS.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RCOLORS.primary} />
        }
      >
        {/* Badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>CẬP NHẬT VẬN HÀNH TRỰC TIẾP</Text>
        </View>

        <Text style={styles.pageTitle}>Vùng Cứu Hộ Hoạt Động</Text>
        <Text style={styles.pageDesc}>Danh sách tất cả các khu vực đang hoạt động đồng thời trong tình trạng báo động.</Text>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchZones}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Zone cards */}
        {zones.length === 0 && !error && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Hiện không có vùng sự cố nào đang hoạt động.</Text>
          </View>
        )}

        {zones.map(zone => {
          const { color, icon, label: severityLabel } = getSeverityStyles(zone.severity);
          return (
            <TouchableOpacity
              key={zone.id}
              style={styles.zoneCard}
              onPress={() => navigation.navigate('ZoneDetailScreen', { zoneId: zone.id, zoneName: zone.name })}
              activeOpacity={0.85}
            >
              <View style={styles.zoneTop}>
                <View style={styles.zoneLeft}>
                  <Text style={styles.zoneIcon}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zoneName} numberOfLines={1}>{zone.name}</Text>
                    <View style={styles.sosCountRow}>
                      <Text style={styles.sosCount}>{zone.people_affected || 0} Yêu cầu</Text>
                      <Text style={styles.teamCount}>  ·  {zone.rescuers_needed || 0} Cần thiết</Text>
                    </View>
                  </View>
                </View>
                {/* Status badge */}
                <View style={[styles.statusBadge, { backgroundColor: color + '1A' }]}>
                  <Text style={[styles.statusText, { color: color }]}>{getStatusLabel(zone.status)}</Text>
                </View>
              </View>
              {/* Divider */}
              <View style={styles.divider} />
              {/* Action */}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: color }]}
                onPress={() => navigation.navigate('ZoneDetailScreen', { zoneId: zone.id, zoneName: zone.name })}
              >
                <Text style={styles.actionText}>XEM CHI TIẾT</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {/* AI Insight */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiIcon}>🤖</Text>
            <Text style={styles.aiLabel}>PHÂN TÍCH AI SENTINEL</Text>
          </View>
          <Text style={styles.aiTitle}>Phân tích rủi ro tự động</Text>
          <Text style={styles.aiDesc}>
            Dựa trên dữ liệu hiện tại, các vùng có mức độ "Nguy cấp" cần được ưu tiên điều phối nguồn lực ngay lập tức để giảm thiểu thiệt hại.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 32, gap: RSPACING.md },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: RCOLORS.statusGreen },
  liveText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.statusGreen, letterSpacing: 0.5 },
  pageTitle: { fontSize: RFONTS.xl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  pageDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  zoneCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  zoneTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: RSPACING.sm },
  zoneLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: RSPACING.sm, flex: 1 },
  zoneIcon: { fontSize: 22, marginTop: 2 },
  zoneName: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary, flex: 1 },
  sosCountRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  sosCount: { fontSize: RFONTS.sm, fontWeight: RFONTS.bold, color: RCOLORS.primary },
  teamCount: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RRADIUS.full },
  statusText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold },
  divider: { height: 1, backgroundColor: RCOLORS.border },
  actionButton: { borderRadius: RRADIUS.sm, paddingVertical: RSPACING.sm, alignItems: 'center' },
  actionText: { color: RCOLORS.textWhite, fontSize: RFONTS.sm, fontWeight: RFONTS.bold },
  aiCard: { backgroundColor: RCOLORS.bgTeal, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiIcon: { fontSize: 14 },
  aiLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  aiTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textWhite },
  aiDesc: { fontSize: RFONTS.sm, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  errorCard: { backgroundColor: '#FFEBEE', padding: 16, borderRadius: RRADIUS.md, alignItems: 'center', gap: 8 },
  errorText: { color: RCOLORS.primary, fontSize: RFONTS.sm, textAlign: 'center' },
  retryBtn: { backgroundColor: RCOLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RRADIUS.sm },
  retryText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: 'bold' },
  emptyCard: { padding: 32, alignItems: 'center' },
  emptyText: { color: RCOLORS.textHint, fontSize: RFONTS.sm, textAlign: 'center' },
});

export default ZoneListScreen;
