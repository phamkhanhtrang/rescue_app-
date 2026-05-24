import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import * as Location from 'expo-location';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import AlertCard from '../../../components/citizen/alerts/AlertCard';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

import API from '../../../services/api';

const AlertsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = React.useState('nearby');
  const [alerts, setAlerts]       = React.useState([]);
  const [loading, setLoading]     = React.useState(true);

  // Tọa độ GPS người dùng (null nếu chưa lấy được)
  const [userLocation, setUserLocation] = React.useState(null);

  // Lấy tọa độ GPS thật khi màn hình mount
  React.useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      } catch (e) {
        console.log('Không lấy được GPS:', e);
      }
    })();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = {
        tab: activeTab,
        is_active: 'true',
      };

      // Gửi tọa độ GPS lên backend nếu đã lấy được
      if (userLocation) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
      }

      const data = await API.alerts.getAll(params);
      if (data && data.results) {
        const citizenAlerts = data.results.filter(a => a.category !== 'teams');
        setAlerts(citizenAlerts);
      }
    } catch (error) {
      console.log('Fetch alerts error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch lại khi tab thay đổi HOẶC khi có GPS
  React.useEffect(() => {
    fetchAlerts();
  }, [activeTab, userLocation]);

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── 1. Header section ──────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <Text style={styles.opLabel}>TRẠNG THÁI HOẠT ĐỘNG</Text>

          <View style={styles.titleRow}>
            <Text style={styles.pulseTitle}>Thông báo/Cảnh báo</Text>
            <View style={styles.aiVerified}>
              <Text style={styles.aiVerifiedText}>XÁC THỰC AI</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. Threat banner ───────────────────────────────────────────── */}
        <View style={styles.threatBanner}>
          <Text style={styles.threatBannerIcon}>⚠</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.threatBannerLabel}>KHU VỰC NGUY HIỂM TỨC THỜI</Text>
            <Text style={styles.threatBannerCount}>
              {alerts.filter(a => a.severity === 'Emergency' || a.severity === 'EMERGENCY').length} MỐI ĐE DỌA NGHIÊM TRỌNG ĐANG HOẠT ĐỘNG
            </Text>
          </View>
        </View>

        {/* ─── Tabs: Lân cận / Toàn quốc ──────────────────────────────────── */}
        {/* <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'nearby' && styles.tabActive]}
            onPress={() => setActiveTab('nearby')}
          >
            <Text style={[styles.tabText, activeTab === 'nearby' && styles.tabTextActive]}> Lân cận</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'national' && styles.tabActive]}
            onPress={() => setActiveTab('national')}
          >
            <Text style={[styles.tabText, activeTab === 'national' && styles.tabTextActive]}>Toàn quốc</Text>
          </TouchableOpacity>
        </View> */}

        {/* ─── 3. Alert list ──────────────────────────────────────────────── */}
        <View style={styles.alertList}>
          {loading ? (
            <Text style={{ textAlign: 'center', color: COLORS.textSecondary, marginVertical: 20 }}>Đang tải...</Text>
          ) : alerts.length === 0 ? (
            <Text style={{ textAlign: 'center', color: COLORS.textSecondary, marginVertical: 20 }}>Không có cảnh báo nào.</Text>
          ) : (
            alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onPress={() =>
                  navigation.navigate('CommunityVerifyScreen', { alertId: alert.id })
                }
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
          <Text style={styles.historyLinkText}>Xem lịch sử tín hiệu (Signal History)</Text>
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

  // ── Tabs ───────────────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E0E0E0',
    borderRadius: RADIUS.full,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  tabActive: {
    backgroundColor: COLORS.bgWhite,
    ...SHADOWS.card,
  },
  tabText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.textPrimary,
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