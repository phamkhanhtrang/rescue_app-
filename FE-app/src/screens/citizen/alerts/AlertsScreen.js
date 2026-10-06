import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, RefreshControl
} from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import AlertCard from '../../../components/citizen/alerts/AlertCard';
import CustomModal from '../../../components/common/CustomModal';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

import API from '../../../services/api';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import { isEmergencyAlert, activeAlerts, setAlertLocation } from '../../../services/alertPolicy';
import { registerPushDevice } from '../../../services/pushSession';

const AlertsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = React.useState('emergency'); // 'emergency' | 'directive'
  const [alerts, setAlerts]       = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState('');

  // Tọa độ GPS người dùng (null nếu chưa lấy được)
  const [userLocation, setUserLocation] = React.useState(null);

  // Phân loại: Khẩn cấp (nguy cấp, ưu tiên cao) vs Chỉ đạo (thông báo điều phối, hướng dẫn)
  const emergencyAlerts = alerts.filter(isEmergencyAlert);
  const directiveAlerts = alerts.filter((a) => !isEmergencyAlert(a));
  const displayedAlerts = activeTab === 'emergency' ? emergencyAlerts : directiveAlerts;

  // Lấy tọa độ GPS thật khi màn hình mount
  useFocusEffect(React.useCallback(() => {
    let mounted = true;
    let watcher;
    const update = loc => {
      if (!mounted) return;
      const location = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation({ ...location, at: Date.now() });
      setAlertLocation(location);
      registerPushDevice().catch(() => {});
    };
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const last = await Location.getLastKnownPositionAsync().catch(() => null);
          if (last) update(last);
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          update(loc);
          if (!mounted) return;
          watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 100 }, update);
          if (!mounted) watcher.remove();
        } else if (mounted) {
          setUserLocation(null);
          setAlertLocation(null);
        }
      } catch (e) {
        console.log('Không lấy được GPS:', e);
      }
    })();
    return () => { mounted = false; watcher?.remove(); };
  }, []));

  const loadAlerts = React.useCallback(async (isCurrent) => {
    try {
      const params = {
        tab: 'nearby', // Tự động lấy cả cảnh báo khu vực theo GPS/địa chỉ và thông báo toàn hệ thống
        is_active: 'true',
      };

      // Gửi tọa độ GPS lên backend nếu đã lấy được
      if (userLocation && Date.now() - userLocation.at < 15 * 60 * 1000) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
      }

      const data = await API.alerts.getAll(params);
      if (!isCurrent()) return;
      setAlerts(activeAlerts(data.results || []));
      setError('');
    } catch (error) {
      if (!isCurrent()) return;
      setAlerts([]);
      setError(error.message || 'Không tải được cảnh báo.');
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [userLocation]);
  const fetchAlerts = useLiveRefresh(loadAlerts);

  const [modalConfig, setModalConfig] = React.useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAlerts(); }} />}
      >
        {error ? <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error} Kéo xuống để thử lại.</Text> : null}

        {/* ─── 1. Header section ──────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <Text style={styles.opLabel}>TRẠNG THÁI HOẠT ĐỘNG</Text>

          <View style={styles.titleRow}>
            <Text style={styles.pulseTitle}>Cảnh báo & Chỉ đạo</Text>
            <View style={styles.aiVerified}>
              <Text style={styles.aiVerifiedText}>XÁC THỰC HỆ THỐNG</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. Status Banner ───────────────────────────────────────────── */}
        {!loading && !error && (activeTab === 'emergency' ? (
          emergencyAlerts.length > 0 ? (
            <View style={styles.threatBanner}>
              <Text style={styles.threatBannerIcon}>⚠</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.threatBannerLabel}>TÌNH TRẠNG NGUY HIỂM TỨC THỜI</Text>
                <Text style={styles.threatBannerCount}>
                  {emergencyAlerts.length} CẢNH BÁO NGUY CẤP ĐANG HOẠT ĐỘNG
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.safeBanner}>
              <Text style={styles.safeBannerIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.safeBannerLabel}>CHƯA CÓ CẢNH BÁO</Text>
                <Text style={styles.safeBannerText}>
                  Không có cảnh báo nguy cấp nào trong khu vực của bạn
                </Text>
              </View>
            </View>
          )
        ) : (
          <View style={styles.directiveBanner}>
            <Text style={styles.directiveBannerIcon}>📢</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.directiveBannerLabel}>BAN CHỈ ĐẠO CỨU TRỢ</Text>
              <Text style={styles.directiveBannerText}>
                {directiveAlerts.length > 0
                  ? `${directiveAlerts.length} thông báo điều phối, hướng dẫn sinh hoạt an toàn & phân bổ nhu yếu phẩm`
                  : 'Hiện chưa có thông báo chỉ đạo mới'}
              </Text>
            </View>
          </View>
        ))}

        {/* ─── Tabs: 🚨 Khẩn cấp / 🔔 Thông báo chỉ đạo ─────────────────── */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'emergency' && styles.tabActiveEmergency]}
            onPress={() => setActiveTab('emergency')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'emergency' && styles.tabTextActiveEmergency]}>
              🚨 Khẩn cấp ({emergencyAlerts.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'directive' && styles.tabActiveDirective]}
            onPress={() => setActiveTab('directive')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'directive' && styles.tabTextActiveDirective]}>
              🔔 Chỉ đạo ({directiveAlerts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── 3. Alert list ──────────────────────────────────────────────── */}
        <View style={styles.alertList}>
          {loading ? (
            <Text style={{ textAlign: 'center', color: COLORS.textSecondary, marginVertical: 40 }}>
              Đang tải dữ liệu cảnh báo...
            </Text>
          ) : error ? null : displayedAlerts.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, backgroundColor: COLORS.bgWhite, borderRadius: RADIUS.md, ...SHADOWS.card, marginBottom: 20 }}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>
                {activeTab === 'emergency' ? '🛡️' : '📋'}
              </Text>
              <Text style={{ fontSize: FONTS.base, fontWeight: FONTS.bold, color: COLORS.textPrimary, marginBottom: 4 }}>
                {activeTab === 'emergency' ? 'Không có cảnh báo nguy cấp' : 'Không có thông báo chỉ đạo'}
              </Text>
              <Text style={{ fontSize: FONTS.sm, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 20 }}>
                {activeTab === 'emergency'
                  ? 'Chưa có bản tin nguy cấp phù hợp với vị trí hoặc địa chỉ hiện có của bạn.'
                  : 'Chưa có thông báo điều phối mới từ ban chỉ đạo cứu hộ.'}
              </Text>
            </View>
          ) : (
            displayedAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onPress={() => navigation.navigate('AlertDetail', { alertId: alert.id })}
                onRoute={() => navigation.navigate('MapTab')}
                onVoteSuccess={fetchAlerts}
              />
            ))
          )}
        </View>

        {/* ─── 4. Quick nav to History ────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => navigation.navigate('HistoryScreen')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18 }}>🕒</Text>
            <Text style={styles.historyLinkText}>Lịch sử truyền tín hiệu SOS</Text>
          </View>
          <Text style={styles.historyArrow}>›</Text>
        </TouchableOpacity>

        {/* ─── 5. Stats footer ────────────────────────────────────────────── */}
        {/* <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>142</Text>
            <Text style={styles.statLabel}>NGƯỜI DÙNG LÂN CẬN</Text>
            <Text style={styles.statSub}>ĐÃ KẾT NỐI MESH</Text>
          </View>
          <View style={[styles.statCard, styles.statCardWarning]}>
            <Text style={[styles.statValue, { color: COLORS.statusOrange }]}>42%</Text>
            <Text style={styles.statLabel}>TRẠNG THÁI LƯỚI ĐIỆN</Text>
            <Text style={[styles.statSub, { color: COLORS.statusOrange }]}>ĐANG GIẢM SÚT</Text>
          </View>
        </View> */}

        {/* ─── 6. Offline Mode link ───────────────────────────────────────── */}
        {/* <TouchableOpacity
          style={styles.offlineLink}
          onPress={() => navigation.navigate('OfflineModeScreen')}
        >
          <Text style={styles.offlineLinkText}>📡  Chế độ Ngoại tuyến (Offline)</Text>
          <Text style={styles.offlineArrow}>›</Text>
        </TouchableOpacity> */}

      </ScrollView>

      {/* ── Floating SOS ──────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.floatingSOS}
        onPress={() => navigation.navigate('SOSScreen')}
        activeOpacity={0.85}
      >
        <Text style={styles.floatingSOSText}>SOS</Text>
      </TouchableOpacity>

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
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  scroll: { flex: 1 },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 90,
  },

  // ── Header section ─────────────────────────────
  headerSection: {
    marginBottom: SPACING.base,
    gap: SPACING.sm,
  },
  opLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pulseTitle: {
    fontSize: FONTS.xl,
    fontWeight: FONTS.black,
    color: COLORS.textPrimary,
    flex: 1,
  },
  aiVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  aiIcon: { fontSize: 11 },
  aiVerifiedText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.statusGreen,
    letterSpacing: 0.5,
  },

  // ── Threat banner ──────────────────────────────
  threatBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  threatBannerIcon: {
    fontSize: 24,
    color: COLORS.textWhite,
  },
  threatBannerLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  threatBannerCount: {
    fontSize: FONTS.base,
    fontWeight: FONTS.bold,
    color: COLORS.textWhite,
    marginTop: 2,
  },
  safeBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  safeBannerIcon: {
    fontSize: 24,
  },
  safeBannerLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  safeBannerText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#1B5E20',
    marginTop: 2,
  },
  directiveBanner: {
    backgroundColor: '#EEF2FF',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  directiveBannerIcon: {
    fontSize: 24,
  },
  directiveBannerLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  directiveBannerText: {
    fontSize: FONTS.xs,
    color: '#3730A3',
    marginTop: 2,
    fontWeight: '600',
    lineHeight: 17,
  },

  // ── Tabs ───────────────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: RADIUS.full,
    padding: 4,
    marginBottom: SPACING.lg,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  tabActiveEmergency: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    ...SHADOWS.card,
  },
  tabActiveDirective: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    ...SHADOWS.card,
  },
  tabText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
  },
  tabTextActiveEmergency: {
    color: '#DC2626',
    fontWeight: '800',
  },
  tabTextActiveDirective: {
    color: '#4F46E5',
    fontWeight: '800',
  },

  // ── Alert list ─────────────────────────────────
  alertList: {
    marginBottom: SPACING.sm,
  },

  // ── History link ───────────────────────────────
  historyLink: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.base,
    ...SHADOWS.card,
  },
  historyLinkText: {
    fontSize: FONTS.base,
    color: COLORS.textPrimary,
    fontWeight: FONTS.medium,
  },
  historyArrow: {
    fontSize: FONTS.xl,
    color: COLORS.textHint,
  },

  // ── Stats ──────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    alignItems: 'center',
    gap: 2,
    ...SHADOWS.card,
  },
  statCardWarning: {
    borderTopWidth: 3,
    borderTopColor: COLORS.statusOrange,
  },
  statValue: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.black,
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  statSub: {
    fontSize: FONTS.xs,
    color: COLORS.statusGreen,
    fontWeight: FONTS.semiBold,
  },

  // ── Offline link ───────────────────────────────
  offlineLink: {
    backgroundColor: COLORS.bgNavy,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offlineLinkText: {
    fontSize: FONTS.base,
    color: COLORS.textWhite,
    fontWeight: FONTS.medium,
  },
  offlineArrow: {
    fontSize: FONTS.xl,
    color: 'rgba(255,255,255,0.5)',
  },

  // ── Floating SOS ───────────────────────────────
  floatingSOS: {
    position: 'absolute',
    bottom: 80,
    right: LAYOUT.screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sos,
  },
  floatingSOSText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: FONTS.black,
    letterSpacing: 1,
  },
});

export default AlertsScreen;
