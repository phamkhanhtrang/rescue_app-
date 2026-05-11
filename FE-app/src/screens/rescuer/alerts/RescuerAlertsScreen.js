/**
 * src/screens/rescuer/alerts/RescuerAlertsScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thông báo Đội ngũ (Screen 11 — Tab THÔNG BÁO).
 *
 * Dữ liệu thực từ:
 *  - CẢNH BÁO KHẨN CẤP:  bảng `alerts` (source='AI' hoặc severity='CRITICAL'/'HIGH')
 *  - THÔNG BÁO HỆ THỐNG: bảng `alerts` (source='SYSTEM' và severity='LOW')
 *  - YÊU CẦU TỪ CÁC ĐỘI: bảng `missions` (status='NEEDS_HELP')
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Trả về nhãn và màu sắc cho từng mức độ khẩn cấp */
const getUrgentStyle = (source, severity) => {
  if (source === 'AI' || severity === 'HIGH') {
    return { color: RCOLORS.bgBlue, bg: '#E3F2FD', type: 'MỐI NGUY ĐÃ XÁC THỰC AI' };
  }
  return { color: RCOLORS.primary, bg: RCOLORS.primaryLight, type: 'KHẨN CẤP' };
};

/** Tính thời gian tương đối (VD: "5 PHÚT TRƯỚC") */
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff} GIÂY TRƯỚC`;
  if (diff < 3600) return `${Math.floor(diff / 60)} PHÚT TRƯỚC`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} GIỜ TRƯỚC`;
  return `${Math.floor(diff / 86400)} NGÀY TRƯỚC`;
};

// ─── Component ────────────────────────────────────────────────────────────────

const RescuerAlertsScreen = ({ navigation }) => {
  const { userInfo } = useAuth();

  const [urgentAlerts, setUrgentAlerts]   = useState([]);
  const [systemAlerts, setSystemAlerts]   = useState([]);
  const [teamRequests, setTeamRequests]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [accepted, setAccepted]           = useState({});

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      // Gọi song song cả 2 API để tối ưu thời gian chờ
      const [alertsRes, missionsRes] = await Promise.all([
        API.alerts.getAll(),
        API.missions.getAll({ status: 'NEEDS_HELP' }),
      ]);

      // Phân loại Alerts
      const allAlerts = alertsRes?.results ?? [];
      setUrgentAlerts(
        allAlerts.filter(a =>
          a.source === 'AI' || a.severity === 'CRITICAL' || a.severity === 'HIGH'
        )
      );
      setSystemAlerts(
        allAlerts.filter(a =>
          a.source === 'SYSTEM' && a.severity !== 'CRITICAL' && a.severity !== 'HIGH'
        )
      );

      // Team Requests từ Mission NEEDS_HELP — loại trừ nhiệm vụ của chính mình
      const allMissions = missionsRes?.results ?? [];
      setTeamRequests(allMissions.filter(m => m.rescuer !== userInfo?.id));

    } catch (err) {
      console.error('RescuerAlertsScreen fetchData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAccept = async (missionId, zoneId) => {
    if (!userInfo?.id) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng.');
      return;
    }
    try {
      await API.missions.create({ zone: zoneId, rescuer: userInfo.id, role: 'support' });
      setAccepted(prev => ({ ...prev, [missionId]: true }));
      Alert.alert('✅ Đã chấp nhận', 'Yêu cầu đã được ghi nhận và chỉ định cho đội bạn.');
    } catch (err) {
      console.error('Accept mission error:', err);
      Alert.alert('Lỗi', 'Không thể chấp nhận yêu cầu. Vui lòng thử lại.');
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RCOLORS.primary} />
          <Text style={styles.loadingText}>Đang tải thông báo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[RCOLORS.primary]} />}
      >

        {/* ── Cảnh báo khẩn cấp ──────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🚨</Text>
          <Text style={styles.sectionTitle}>CẢNH BÁO KHẨN CẤP</Text>
          {urgentAlerts.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{urgentAlerts.length}</Text></View>
          )}
        </View>

        {urgentAlerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>✅ Không có cảnh báo khẩn cấp</Text>
          </View>
        ) : urgentAlerts.map(alertItem => {
          const style = getUrgentStyle(alertItem.source, alertItem.severity);
          return (
            <View key={alertItem.id} style={[styles.urgentCard, { backgroundColor: style.bg, borderLeftColor: style.color }]}>
              <View style={styles.urgentHeader}>
                <View style={[styles.urgentBadge, { backgroundColor: style.color }]}>
                  <Text style={styles.urgentBadgeText}>{style.type}</Text>
                </View>
                <Text style={styles.urgentTime}>{timeAgo(alertItem.created_at)}</Text>
              </View>
              <Text style={styles.urgentTitle}>{alertItem.title}</Text>
              <Text style={styles.urgentDesc}>{alertItem.description}</Text>
              <TouchableOpacity
                style={[styles.urgentAction, { backgroundColor: style.color }]}
                onPress={() => alertItem.zone && navigation.navigate('MissionsTab', {
                  screen: 'ZoneDetailScreen', params: { zoneId: alertItem.zone }
                })}
              >
                <Text style={styles.urgentActionText}>PHẢN HỒI NGAY</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* ── Yêu cầu từ các đội ─────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>📋</Text>
          <Text style={styles.sectionTitle}>YÊU CẦU TỪ CÁC ĐỘI</Text>
          {teamRequests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: RCOLORS.bgBlue }]}>
              <Text style={styles.badgeText}>{teamRequests.length}</Text>
            </View>
          )}
        </View>

        {teamRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>📭 Không có yêu cầu hỗ trợ</Text>
          </View>
        ) : teamRequests.map(req => (
          <View key={req.id} style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <View style={styles.requestIconBox}><Text style={styles.requestIcon}>🆘</Text></View>
              <View style={styles.requestMeta}>
                <Text style={styles.requestFrom}>{req.rescuer_name || 'Đội cứu hộ'}</Text>
                <Text style={styles.requestTitle}>Cần hỗ trợ tại {req.zone_name || 'khu vực sự cố'}</Text>
              </View>
              <Text style={styles.requestTime}>{timeAgo(req.joined_at)}</Text>
            </View>
            <Text style={styles.requestDesc}>
              {req.role ? `Vai trò: ${req.role} — ` : ''}Đội này đang cần chi viện khẩn cấp tại vùng sự cố.
            </Text>
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[styles.acceptButton, accepted[req.id] && styles.acceptedButton]}
                onPress={() => handleAccept(req.id, req.zone)}
                disabled={!!accepted[req.id]}
              >
                <Text style={styles.acceptText}>{accepted[req.id] ? '✓ ĐÃ NHẬN' : 'CHẤP NHẬN'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() => navigation.navigate('MissionsTab', {
                  screen: 'ZoneDetailScreen', params: { zoneId: req.zone }
                })}
              >
                <Text style={styles.detailText}>CHI TIẾT</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* ── Thông báo hệ thống ─────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🖥</Text>
          <Text style={styles.sectionTitle}>THÔNG BÁO HỆ THỐNG</Text>
        </View>

        {systemAlerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>📭 Không có thông báo hệ thống</Text>
          </View>
        ) : systemAlerts.map(sa => (
          <View key={sa.id} style={styles.systemCard}>
            <Text style={styles.systemIcon}>⚙️</Text>
            <View style={styles.systemInfo}>
              <Text style={styles.systemText}>{sa.title}</Text>
              <Text style={styles.systemSub}>{sa.description}</Text>
              <Text style={styles.systemTime}>{timeAgo(sa.created_at)}</Text>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 32, gap: RSPACING.md },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: RSPACING.md },
  loadingText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm, paddingTop: RSPACING.sm },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.black, color: RCOLORS.textPrimary, letterSpacing: 0.5, flex: 1 },
  badge: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },

  emptyCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, alignItems: 'center', ...RSHADOWS.card },
  emptyText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary },

  // Urgent cards
  urgentCard: { borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm, borderLeftWidth: 4, ...RSHADOWS.card },
  urgentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  urgentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  urgentBadgeText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },
  urgentTime: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary },
  urgentTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  urgentDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  urgentAction: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RRADIUS.sm },
  urgentActionText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: RFONTS.black },

  // Request cards
  requestCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  requestHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: RSPACING.sm },
  requestIconBox: { width: 36, height: 36, borderRadius: RRADIUS.sm, backgroundColor: '#FFE0E0', alignItems: 'center', justifyContent: 'center' },
  requestIcon: { fontSize: 18 },
  requestMeta: { flex: 1 },
  requestFrom: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.primary, letterSpacing: 0.5 },
  requestTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary },
  requestTime: { fontSize: RFONTS.xs, color: RCOLORS.textHint },
  requestDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  requestActions: { flexDirection: 'row', gap: RSPACING.md },
  acceptButton: { flex: 1, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.sm, paddingVertical: RSPACING.sm, alignItems: 'center' },
  acceptedButton: { backgroundColor: RCOLORS.statusGreen },
  acceptText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: RFONTS.black },
  detailButton: { flex: 1, backgroundColor: RCOLORS.bgApp, borderRadius: RRADIUS.sm, paddingVertical: RSPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: RCOLORS.border },
  detailText: { color: RCOLORS.textPrimary, fontSize: RFONTS.sm, fontWeight: RFONTS.bold },

  // System alerts
  systemCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, flexDirection: 'row', gap: RSPACING.md, alignItems: 'flex-start', ...RSHADOWS.card },
  systemIcon: { fontSize: 20, marginTop: 2 },
  systemInfo: { flex: 1, gap: 2 },
  systemText: { fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary },
  systemSub: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 16 },
  systemTime: { fontSize: RFONTS.xs, color: RCOLORS.textHint, marginTop: 4 },
});

export default RescuerAlertsScreen;
