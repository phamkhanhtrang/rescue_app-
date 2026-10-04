/**
 * src/screens/rescuer/alerts/RescuerAlertsScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thông báo Đội ngũ (Screen 11 — Tab THÔNG BÁO).
 * Phân tab rõ ràng: Cảnh báo khẩn cấp, Yêu cầu chi viện, Thông báo hệ thống.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import { activeAlerts, isEmergencyAlert } from '../../../services/alertPolicy';
import { useAuth } from '../../../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const getUrgentStyle = (source, severity) => {
  if (source === 'AI' || severity === 'HIGH') {
    return { color: RCOLORS.bgBlue, bg: '#E3F2FD', type: 'CẢNH BÁO PHÂN TÍCH' };
  }
  return { color: RCOLORS.primary, bg: RCOLORS.primaryLight, type: 'KHẨN CẤP' };
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff} GIÂY TRƯỚC`;
  if (diff < 3600) return `${Math.floor(diff / 60)} PHÚT TRƯỚC`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} GIỜ TRƯỚC`;
  return `${Math.floor(diff / 86400)} NGÀY TRƯỚC`;
};

const RescuerAlertsScreen = ({ navigation }) => {
  const { userInfo } = useAuth();

  const [urgentAlerts, setUrgentAlerts] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepted, setAccepted] = useState({});
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('URGENT'); // 'URGENT' | 'REQUESTS' | 'SYSTEM'

  const loadData = useCallback(async (isCurrent) => {
    try {
      const [alertResult, missionResult] = await Promise.allSettled([
        API.alerts.getAll({ is_active: 'true' }),
        API.missions.support(),
      ]);
      if (!isCurrent()) return;
      const filteredAlerts = activeAlerts(alertResult.status === 'fulfilled' ? alertResult.value.results || [] : []);
      setUrgentAlerts(filteredAlerts.filter(isEmergencyAlert));
      setSystemAlerts(filteredAlerts.filter(a => !isEmergencyAlert(a)));
      const allRequests = missionResult.status === 'fulfilled' ? missionResult.value.results || [] : [];
      setTeamRequests(allRequests.filter(r => r.status === 'OPEN' && r.rescuer !== userInfo?.id));
      setError([alertResult, missionResult].filter(r => r.status === 'rejected').map(r => r.reason?.message || 'Không tải được dữ liệu.').join('\n'));
    } catch (err) {
      if (isCurrent()) setError(err.message || 'Không thể tải thông báo.');
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [userInfo?.id]);

  const fetchData = useLiveRefresh(loadData);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const handleAccept = async (requestId) => {
    if (!userInfo?.id) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: 'Không tìm thấy thông tin người dùng.',
      });
      return;
    }
    try {
      const mission = await API.missions.acceptSupport(requestId);
      setAccepted(prev => ({ ...prev, [requestId]: true }));
      navigation.navigate('MissionsTab', { screen: 'ActiveMissionScreen', params: { missionId: mission.id } });
    } catch (err) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: 'Không thể chấp nhận yêu cầu. Vui lòng thử lại.',
      });
    }
  };

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

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />

      {/* Segmented Filter Tabs Bar (Harmonious Light Design) */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'URGENT' && styles.segmentBtnActiveRed]}
            onPress={() => setActiveTab('URGENT')}
          >
            <Text style={[styles.segmentText, activeTab === 'URGENT' && styles.segmentTextActive]}>
              🚨 Khẩn cấp ({urgentAlerts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'REQUESTS' && styles.segmentBtnActiveBlue]}
            onPress={() => setActiveTab('REQUESTS')}
          >
            <Text style={[styles.segmentText, activeTab === 'REQUESTS' && styles.segmentTextActive]}>
              📋 Chi viện ({teamRequests.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'SYSTEM' && styles.segmentBtnActiveGray]}
            onPress={() => setActiveTab('SYSTEM')}
          >
            <Text style={[styles.segmentText, activeTab === 'SYSTEM' && styles.segmentTextActive]}>
              🔔 Hệ thống ({systemAlerts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[RCOLORS.primary]} />}
      >
        {!!error && (
          <TouchableOpacity style={styles.errorCard} onPress={fetchData}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>CHẠM ĐỂ THỬ LẠI</Text>
          </TouchableOpacity>
        )}

        {/* ── 1. Cảnh báo khẩn cấp ──────────────────────────────────────────── */}
        {activeTab === 'URGENT' && (
          <>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="alert-outline" size={22} color="#E53935" />
              <Text style={styles.sectionTitle}>CẢNH BÁO KHẨN CẤP</Text>
              {urgentAlerts.length > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{urgentAlerts.length}</Text></View>
              )}
            </View>

            {urgentAlerts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyText}>Hiện không có cảnh báo khẩn cấp nào</Text>
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
                  <Text>{alertItem.is_read ? 'Đã đọc' : 'Chưa đọc'} · {alertItem.zone_name || 'Toàn hệ thống'}</Text>
                  <Text style={styles.urgentDesc}>{alertItem.description}</Text>
                  <TouchableOpacity
                    style={[styles.urgentAction, { backgroundColor: style.color }]}
                    onPress={() => navigation.navigate('AlertDetail', { alertId: alertItem.id })}
                  >
                    <Text style={styles.urgentActionText}>XEM CHI TIẾT</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {/* ── 2. Yêu cầu chi viện từ các đội ─────────────────────────────────── */}
        {activeTab === 'REQUESTS' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📋</Text>
              <Text style={styles.sectionTitle}>YÊU CẦU CHI VIỆN TỪ CÁC ĐỘI</Text>
              {teamRequests.length > 0 && (
                <View style={[styles.badge, { backgroundColor: RCOLORS.bgBlue }]}>
                  <Text style={styles.badgeText}>{teamRequests.length}</Text>
                </View>
              )}
            </View>

            {teamRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🛡️</Text>
                <Text style={styles.emptyText}>Không có yêu cầu chi viện nào từ các đội khác</Text>
              </View>
            ) : teamRequests.map(req => (
              <View key={req.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestIconBox}><Text style={styles.requestIcon}>🆘</Text></View>
                  <View style={styles.requestMeta}>
                    <Text style={styles.requestFrom}>{req.requester_name || 'Đội cứu hộ'}</Text>
                    <Text style={styles.requestTitle}>Cần hỗ trợ tại {req.zone_name || 'khu vực sự cố'}</Text>
                  </View>
                  <Text style={styles.requestTime}>{timeAgo(req.joined_at)}</Text>
                </View>
                <Text style={styles.requestDesc}>
                  {req.resource_type || 'Nguồn lực'} · số lượng {req.quantity || 1}{req.note ? ` — ${req.note}` : ''}
                </Text>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.acceptButton, accepted[req.id] && styles.acceptedButton]}
                    onPress={() => handleAccept(req.id)}
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
          </>
        )}

        {/* ── 3. Thông báo hệ thống ─────────────────────────────────────────── */}
        {activeTab === 'SYSTEM' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🖥</Text>
              <Text style={styles.sectionTitle}>THÔNG BÁO HỆ THỐNG</Text>
            </View>

            {systemAlerts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyText}>Không có thông báo hệ thống mới</Text>
              </View>
            ) : systemAlerts.map(sa => (
              <TouchableOpacity key={sa.id} style={styles.systemCard} onPress={() => navigation.navigate('AlertDetail', { alertId: sa.id })}>
                <View style={styles.systemInfo}>
                  <Text style={styles.systemText}>{sa.title}</Text>
                  <Text style={styles.systemSub}>{sa.description}</Text>
                  <Text style={styles.systemTime}>{timeAgo(sa.created_at)}</Text>
                  <Text>{sa.is_read ? 'Đã đọc' : 'Chưa đọc'} · {sa.zone_name || 'Toàn hệ thống'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

      </ScrollView>

      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={() => setModalConfig(prev => ({ ...prev, visible: false }))}
        onCancel={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 32, gap: RSPACING.md },

  // Segmented Control Bar (Light Theme)
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentBtnActiveRed: {
    backgroundColor: '#E53935',
    elevation: 2,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  segmentBtnActiveBlue: {
    backgroundColor: '#1565C0',
    elevation: 2,
    shadowColor: '#1565C0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  segmentBtnActiveGray: {
    backgroundColor: '#334155',
    elevation: 2,
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: RSPACING.md },
  loadingText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm, paddingTop: RSPACING.xs },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.black, color: RCOLORS.textPrimary, letterSpacing: 0.5, flex: 1 },
  badge: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },

  emptyCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: 24, alignItems: 'center', gap: 6, ...RSHADOWS.card },
  emptyIcon: { fontSize: 24 },
  emptyText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, textAlign: 'center' },
  errorCard: { backgroundColor: '#FFF3F3', borderRadius: RRADIUS.md, padding: RSPACING.md, borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: RCOLORS.primary, fontSize: RFONTS.sm },
  retryText: { color: RCOLORS.primary, fontSize: RFONTS.xs, fontWeight: RFONTS.black, marginTop: 6 },

  urgentCard: { borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm, borderLeftWidth: 4, ...RSHADOWS.card },
  urgentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  urgentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  urgentBadgeText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },
  urgentTime: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary },
  urgentTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  urgentDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  urgentAction: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RRADIUS.sm },
  urgentActionText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: RFONTS.black },

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

  systemCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, flexDirection: 'row', gap: RSPACING.md, alignItems: 'flex-start', ...RSHADOWS.card },
  systemInfo: { flex: 1, gap: 2 },
  systemText: { fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary },
  systemSub: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 16 },
  systemTime: { fontSize: RFONTS.xs, color: RCOLORS.textHint, marginTop: 4 },
});

export default RescuerAlertsScreen;
