/**
 * src/screens/rescuer/alerts/RescuerAlertsScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Thông báo & Chi viện Đội ngũ (Tab 4: ĐỘI NGŨ).
 * Tối ưu hóa:
 *  - Cảnh báo chi viện đồng đội khẩn cấp (Hero Banner khi có đội cần hỗ trợ).
 *  - Thanh chuyển phân loại tác chiến mượt mà với số lượng đếm thực tế.
 *  - Thiết kế thẻ hiện đại, phân định rõ Cảnh báo đỏ, Yêu cầu vật tư, Bản tin chỉ huy.
 *  - Thao tác 1-chạm: Tiếp nhận chi viện và dẫn vào ActiveMission ngay lập tức.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import {
  RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT,
} from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import { activeAlerts, isEmergencyAlert } from '../../../services/alertPolicy';
import { useAuth } from '../../../context/AuthContext';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
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
        message: 'Không tìm thấy thông tin định danh của bạn.',
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
        title: 'Không thể tiếp nhận',
        message: err.message || 'Yêu cầu có thể đã được một đội khác tiếp nhận.',
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RCOLORS.primary} />
          <Text style={styles.loadingText}>Đang đồng bộ tin báo tác chiến...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />

      {/* ─── 1. THANH CHUYỂN PHÂN LOẠI TÁC CHIẾN ───────────────────────── */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'URGENT' && styles.segmentBtnActiveRed]}
            onPress={() => setActiveTab('URGENT')}
          >
            <MaterialCommunityIcons
              name="alert-octagon"
              size={16}
              color={activeTab === 'URGENT' ? '#FFF' : RCOLORS.primary}
            />
            <Text style={[styles.segmentText, activeTab === 'URGENT' && styles.segmentTextActive]}>
              Khẩn cấp ({urgentAlerts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'REQUESTS' && styles.segmentBtnActiveBlue]}
            onPress={() => setActiveTab('REQUESTS')}
          >
            <MaterialCommunityIcons
              name="account-multiple-plus-outline"
              size={16}
              color={activeTab === 'REQUESTS' ? '#FFF' : RCOLORS.bgBlue}
            />
            <Text style={[styles.segmentText, activeTab === 'REQUESTS' && styles.segmentTextActive]}>
              Chi viện ({teamRequests.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'SYSTEM' && styles.segmentBtnActiveNavy]}
            onPress={() => setActiveTab('SYSTEM')}
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={16}
              color={activeTab === 'SYSTEM' ? '#FFF' : RCOLORS.textSecondary}
            />
            <Text style={[styles.segmentText, activeTab === 'SYSTEM' && styles.segmentTextActive]}>
              Hệ thống ({systemAlerts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[RCOLORS.primary]} />}
      >
        {/* Banner khẩn cấp nếu có đồng đội kêu gọi chi viện */}
        {teamRequests.length > 0 && activeTab !== 'REQUESTS' && (
          <TouchableOpacity
            style={styles.heroSupportCallout}
            onPress={() => setActiveTab('REQUESTS')}
          >
            <View style={styles.heroSupportIcon}>
              <MaterialCommunityIcons name="alert-decagram" size={24} color="#FFF" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.heroSupportTitle}>
                🚨 CÓ {teamRequests.length} YÊU CẦU CHI VIỆN TỪ ĐỒNG ĐỘI
              </Text>
              <Text style={styles.heroSupportSub}>
                Chạm vào đây để xem chi tiết và tham gia ứng cứu ngay.
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#FFF" />
          </TouchableOpacity>
        )}

        {!!error && (
          <TouchableOpacity style={styles.errorCard} onPress={fetchData}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Chạm để tải lại</Text>
          </TouchableOpacity>
        )}

        {/* ─── 2. TAB: CẢNH BÁO KHẨN CẤP ──────────────────────────────── */}
        {activeTab === 'URGENT' && (
          <>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="alert-octagon-outline" size={20} color={RCOLORS.primary} />
              <Text style={styles.sectionTitle}>TIN BÁO KHẨN TỪ BAN CHỈ HUY</Text>
            </View>

            {urgentAlerts.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="shield-check" size={48} color={RCOLORS.statusGreen} />
                <Text style={styles.emptyTitle}>Tất cả khu vực an toàn</Text>
                <Text style={styles.emptyText}>Hiện không có cảnh báo khẩn cấp nào từ Ban Chỉ Huy.</Text>
              </View>
            ) : urgentAlerts
                .filter(a => !a.title?.includes('1112122323') && !a.title?.includes('OANTOAN'))
                .map(alertItem => (
              <View key={alertItem.id} style={styles.urgentCard}>
                <View style={styles.urgentHeader}>
                  <View style={styles.badgeRow}>
                    <View style={styles.alertTag}>
                      <Text style={styles.alertTagText}>KHẨN CẤP</Text>
                    </View>
                    <View style={styles.zoneTag}>
                      <Text style={styles.zoneTagText}>{alertItem.zone_name || 'Toàn địa bàn'}</Text>
                    </View>
                  </View>
                  <Text style={styles.urgentTime}>{timeAgo(alertItem.created_at)}</Text>
                </View>

                <Text style={styles.urgentTitle}>{alertItem.title}</Text>
                <Text style={styles.urgentDesc}>{alertItem.description}</Text>

                <View style={styles.urgentFooter}>
                  <Text style={styles.readStatusText}>
                    {alertItem.is_read ? '✓ Đã ghi nhận' : '● Tin mới chưa xem'}
                  </Text>
                  <TouchableOpacity
                    style={styles.urgentAction}
                    onPress={() => navigation.navigate('AlertDetail', { alertId: alertItem.id })}
                  >
                    <Text style={styles.urgentActionText}>XEM CHI TIẾT</Text>
                    <MaterialCommunityIcons name="arrow-right" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ─── 3. TAB: YÊU CẦU CHI VIỆN TỪ CÁC ĐỘI ──────────────────────── */}
        {activeTab === 'REQUESTS' && (
          <>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-group-outline" size={20} color={RCOLORS.bgBlue} />
              <Text style={styles.sectionTitle}>DANH SÁCH ĐỘI BẠN CẦN CHI VIỆN</Text>
            </View>

            {teamRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={48} color={RCOLORS.statusGreen} />
                <Text style={styles.emptyTitle}>Chưa có yêu cầu chi viện</Text>
                <Text style={styles.emptyText}>Các đội khác hiện đang kiểm soát tốt địa bàn tác chiến.</Text>
              </View>
            ) : teamRequests.map(req => (
              <View key={req.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestIconBox}>
                    <MaterialCommunityIcons name="shield-alert" size={22} color={RCOLORS.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.requestFrom}>{req.requester_name || 'Đội Cứu Hộ'}</Text>
                    <Text style={styles.requestZone}>📍 Khu vực: {req.zone_name || 'Hiện trường sự cố'}</Text>
                  </View>
                  <Text style={styles.requestTime}>{timeAgo(req.joined_at)}</Text>
                </View>

                <View style={styles.requestNeedsBox}>
                  <Text style={styles.requestNeedsTitle}>YÊU CẦU NGUỒN LỰC:</Text>
                  <Text style={styles.requestNeedsContent}>
                    {req.resource_type || 'Thiết bị cứu hộ'} · Số lượng: {req.quantity || 1}
                  </Text>
                  {!!req.note && (
                    <Text style={styles.requestNote}>💬 "{req.note}"</Text>
                  )}
                </View>

                <View style={styles.requestActionRow}>
                  <TouchableOpacity
                    style={[styles.acceptBtn, accepted[req.id] && styles.acceptedBtn]}
                    disabled={!!accepted[req.id]}
                    onPress={() => handleAccept(req.id)}
                  >
                    <MaterialCommunityIcons
                      name={accepted[req.id] ? 'check-bold' : 'hand-heart'}
                      size={18}
                      color="#FFF"
                    />
                    <Text style={styles.acceptBtnText}>
                      {accepted[req.id] ? 'ĐÃ TIẾP NHẬN' : 'CHẤP NHẬN CHI VIỆN'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => navigation.navigate('MissionsTab', {
                      screen: 'ZoneDetailScreen',
                      params: { zoneId: req.zone },
                    })}
                  >
                    <Text style={styles.detailBtnText}>Chi tiết vùng</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ─── 4. TAB: THÔNG BÁO HỆ THỐNG ───────────────────────────────── */}
        {activeTab === 'SYSTEM' && (
          <>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="information-outline" size={20} color={RCOLORS.textSecondary} />
              <Text style={styles.sectionTitle}>THÔNG BÁO TỪ HỆ THỐNG</Text>
            </View>

            {systemAlerts.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="bell-sleep-outline" size={48} color={RCOLORS.textHint} />
                <Text style={styles.emptyTitle}>Không có tin mới</Text>
                <Text style={styles.emptyText}>Hiện chưa có thông báo kỹ thuật hoặc điều phối từ hệ thống.</Text>
              </View>
            ) : systemAlerts.map(sa => (
              <TouchableOpacity
                key={sa.id}
                style={styles.systemCard}
                onPress={() => navigation.navigate('AlertDetail', { alertId: sa.id })}
              >
                <View style={styles.systemHeader}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.systemTitle}>{sa.title}</Text>
                    <Text style={styles.systemMeta}>{sa.zone_name || 'Toàn hệ thống'} · {timeAgo(sa.created_at)}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={RCOLORS.textSecondary} />
                </View>
                <Text style={styles.systemDesc} numberOfLines={2}>{sa.description}</Text>
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, fontWeight: '500' },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },

  // Segmented Bar
  tabBarWrapper: { backgroundColor: RCOLORS.bgWhite, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', ...RSHADOWS.card },
  segmentedContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: RRADIUS.md, padding: 3, gap: 4 },
  segmentBtn: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RRADIUS.sm },
  segmentBtnActiveRed: { backgroundColor: RCOLORS.primary, ...RSHADOWS.card },
  segmentBtnActiveBlue: { backgroundColor: RCOLORS.bgBlue, ...RSHADOWS.card },
  segmentBtnActiveNavy: { backgroundColor: RCOLORS.bgNavy, ...RSHADOWS.card },
  segmentText: { fontSize: 11, fontWeight: '600', color: RCOLORS.textSecondary },
  segmentTextActive: { color: '#FFF', fontWeight: '800' },

  // Hero Support Callout
  heroSupportCallout: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...RSHADOWS.card },
  heroSupportIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroSupportTitle: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroSupportSub: { color: 'rgba(255,255,255,0.85)', fontSize: RFONTS.xs },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: RCOLORS.textSecondary, letterSpacing: 0.5 },

  // Urgent Card
  urgentCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: 10, borderLeftWidth: 4, borderLeftColor: RCOLORS.primary, ...RSHADOWS.card },
  urgentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  alertTag: { backgroundColor: '#FDEAEA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RRADIUS.sm },
  alertTagText: { color: RCOLORS.primary, fontSize: 10, fontWeight: '800' },
  zoneTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RRADIUS.sm },
  zoneTagText: { color: RCOLORS.textSecondary, fontSize: 10, fontWeight: '600' },
  urgentTime: { fontSize: RFONTS.xs, color: RCOLORS.textHint },
  urgentTitle: { fontSize: RFONTS.base, fontWeight: '800', color: RCOLORS.textPrimary, lineHeight: 22 },
  urgentDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 20 },
  urgentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  readStatusText: { fontSize: RFONTS.xs, color: RCOLORS.textHint },
  urgentAction: { backgroundColor: RCOLORS.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RRADIUS.sm, flexDirection: 'row', alignItems: 'center', gap: 4 },
  urgentActionText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Request Card
  requestCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: 12, ...RSHADOWS.card, borderWidth: 1, borderColor: '#E2E8F0' },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestIconBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FDEAEA', alignItems: 'center', justifyContent: 'center' },
  requestFrom: { fontSize: RFONTS.sm, fontWeight: '800', color: RCOLORS.textPrimary },
  requestZone: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary },
  requestTime: { fontSize: RFONTS.xs, color: RCOLORS.textHint },
  requestNeedsBox: { backgroundColor: '#F8FAFC', borderRadius: RRADIUS.sm, padding: 10, gap: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  requestNeedsTitle: { fontSize: 10, fontWeight: '800', color: RCOLORS.textSecondary, letterSpacing: 0.5 },
  requestNeedsContent: { fontSize: RFONTS.sm, fontWeight: '700', color: RCOLORS.textPrimary },
  requestNote: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, fontStyle: 'italic', marginTop: 2 },
  requestActionRow: { flexDirection: 'row', gap: 8 },
  acceptBtn: { flex: 1, height: 44, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  acceptedBtn: { backgroundColor: RCOLORS.statusGreen },
  acceptBtnText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '800', letterSpacing: 0.5 },
  detailBtn: { height: 44, paddingHorizontal: 14, borderRadius: RRADIUS.md, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  detailBtnText: { color: RCOLORS.textSecondary, fontSize: RFONTS.xs, fontWeight: '700' },

  // System Card
  systemCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: 14, gap: 6, ...RSHADOWS.card },
  systemHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  systemTitle: { fontSize: RFONTS.sm, fontWeight: '700', color: RCOLORS.textPrimary },
  systemMeta: { fontSize: RFONTS.xs, color: RCOLORS.textHint },
  systemDesc: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, lineHeight: 18 },

  emptyCard: { padding: 40, alignItems: 'center', gap: 10, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg },
  emptyTitle: { fontSize: RFONTS.base, fontWeight: '700', color: RCOLORS.textPrimary },
  emptyText: { color: RCOLORS.textSecondary, fontSize: RFONTS.sm, textAlign: 'center', lineHeight: 20 },
  errorCard: { backgroundColor: '#FEF2F2', padding: 16, borderRadius: RRADIUS.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: RCOLORS.primary, fontSize: RFONTS.sm, textAlign: 'center' },
  retryText: { color: RCOLORS.primary, fontSize: RFONTS.xs, fontWeight: '800' },
});

export default RescuerAlertsScreen;
