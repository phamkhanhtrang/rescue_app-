/**
 * src/screens/citizen/home/HomeScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình chính của Người dân (Tab HOME).
 *
 * Bố cục từ Figma:
 *  1. SentinelHeader
 *  2. Map preview card (vị trí hiện tại)
 *  3. Status banner "HỆ THỐNG SẴN SÀNG / Bạn đang an toàn"
 *  4. Nút SOS lớn (trung tâm) — giữ 3 giây để gửi
 *  5. Quick link "Xem bản đồ an toàn" → MapScreen
 *  6. Quick links: "Lịch sử" → HistoryScreen | "Hồ sơ" → ProfileScreen
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import MapPlaceholder from '../../../components/citizen/common/MapPlaceholder';
import SOSButton from '../../../components/citizen/home/SOSButton';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const HomeScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalZones, setTotalZones] = useState(0);
  const [totalSOS, setTotalSOS] = useState(0);

  const [location, setLocation] = useState(null);
  const [addressName, setAddressName] = useState('Đang xác định vị trí...');

  // Fetch dashboard stats khi component mount
  useEffect(() => {
    fetchDashboardStats();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddressName('Quyền truy cập vị trí bị từ chối');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc.coords);

      // Ngược mã địa lý để lấy tên địa chỉ
      let reverse = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (reverse && reverse.length > 0) {
        const addr = reverse[0];
        const formattedAddr = [
          addr.name,
          addr.street,
          addr.district,
          addr.city || addr.region
        ].filter(Boolean).join(', ');
        setAddressName(formattedAddr || 'Vị trí hiện tại');
      }
    } catch (error) {
      console.error('Lỗi khi lấy vị trí:', error);
      setAddressName('Không thể xác định vị trí');
    }
  };

  const fetchDashboardStats = async () => {
    setLoading(true);
    // try {
    //   const result = await rescueOperationsApi.getDashboardStats();
    //   if (result.ok && result.data) {
    //     setStats(result.data);
    //     setTotalZones(result.data.summary?.total_zones || 0);
    //     setTotalSOS(result.data.summary?.total_sos || 0);
    //   }
    // } catch (error) {
    //   console.error('Fetch dashboard stats error:', error);
    // } finally {
    //   setLoading(false);
    // }
  };

  // Chuyển sang SOSScreen (full-screen modal từ CitizenStack)
  const handleSOS = () => {
    navigation.navigate('SOSScreen');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── 1. Bản đồ thực tế ─────────────────────────────────────────── */}
        <View style={[styles.mapContainer, styles.mapCard]}>
          {location ? (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.002,
                longitudeDelta: 0.002,
              }}
              showsUserLocation={true}
              followsUserLocation={true}
              showsMyLocationButton={true}
              loadingEnabled={true}
            >
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title="Vị trí của bạn"
              />
            </MapView>
          ) : (
            <View style={[styles.mapPlaceholder, { height: 160 }]}>
              <Text style={{ color: COLORS.textSecondary }}>Đang tải bản đồ...</Text>
            </View>
          )}

          {/* Overlay UI giống placeholder */}
          <View style={styles.mapOverlay}>
            <View style={styles.mapBadge}>
              <View style={[styles.badgeDot, { backgroundColor: location ? COLORS.statusGreen : COLORS.statusOrange }]} />
              <Text style={styles.badgeText}>{location ? "GPS HOẠT ĐỘNG" : "ĐANG DÒ GPS..."}</Text>
            </View>
            <View style={styles.mapLabel}>
              <Text style={styles.labelIcon}>📍</Text>
              <Text style={styles.labelText} numberOfLines={1}>{addressName}</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. Status banner ───────────────────────────────────────────── */}
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <Text style={styles.statusLabel}>HỆ THỐNG SẴN SÀNG</Text>
        </View>

        <Text style={styles.safeTitle}>Bạn đang an toàn</Text>
        <Text style={styles.safeSubtitle}>
          Sentinel đang giám sát môi trường xung quanh bạn.
        </Text>

        {/* ─── 2.5 Dashboard Stats ────────────────────────────────────────── */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalZones}</Text>
              <Text style={styles.statLabel}>🚨 Vùng sự cố</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalSOS}</Text>
              <Text style={styles.statLabel}>📞 Tín hiệu SOS</Text>
            </View>
          </View>
        )}

        {/* ─── 3. Nút SOS ─────────────────────────────────────────────────── */}
        <View style={styles.sosWrapper}>
          <SOSButton onPress={handleSOS} countdownSec={3} />
        </View>

        {/* ─── 4. Xem bản đồ an toàn ──────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.mapLink}
          onPress={() => navigation.navigate('MapTab')}
          activeOpacity={0.8}
        >
          <View style={styles.mapLinkIcon}>
            <Text style={styles.mapLinkIconText}>🗺</Text>
          </View>
          <View style={styles.mapLinkContent}>
            <Text style={styles.mapLinkTitle}>Xem bản đồ an toàn</Text>
            <Text style={styles.mapLinkSub}>Tình hình khu vực lân cận</Text>
          </View>
          <Text style={styles.mapLinkArrow}>›</Text>
        </TouchableOpacity>

        {/* ─── 5. Quick links ─────────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation.navigate('AlertsTab', { screen: 'HistoryScreen' })}
            activeOpacity={0.8}
          >
            <Text style={styles.quickIcon}>📋</Text>
            <Text style={styles.quickLabel}>Lịch sử</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation.navigate('ProfileTab')}
            activeOpacity={0.8}
          >
            <Text style={styles.quickIcon}>👤</Text>
            <Text style={styles.quickLabel}>Hồ sơ</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 24,
    gap: SPACING.base,
  },

  // ── Map ────────────────────────────────────────
  mapCard: {
    marginBottom: SPACING.xs,
  },
  mapContainer: {
    height: 160,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
    position: 'relative',
    ...SHADOWS.card,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    padding: SPACING.sm,
    justifyContent: 'space-between',
    pointerEvents: 'none', // Cho phép chạm vào map bên dưới nếu cần
  },
  mapBadge: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,20,33,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
  },
  mapLabel: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,20,33,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
    maxWidth: '90%',
  },
  labelIcon: {
    fontSize: 10,
  },
  labelText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: FONTS.semiBold,
  },

  // ── Status banner ──────────────────────────────
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.statusGreen,
  },
  statusLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.statusGreen,
    letterSpacing: 1,
  },

  safeTitle: {
    fontSize: FONTS.xl,
    fontWeight: FONTS.black,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  safeSubtitle: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // ── SOS wrapper ────────────────────────────────
  sosWrapper: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },

  // ── Map link card ──────────────────────────────
  mapLink: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  mapLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLinkIconText: {
    fontSize: 20,
  },
  mapLinkContent: {
    flex: 1,
  },
  mapLinkTitle: {
    fontSize: FONTS.base,
    fontWeight: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  mapLinkSub: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mapLinkArrow: {
    fontSize: FONTS.xl,
    color: COLORS.textHint,
  },

  // ── Quick links ────────────────────────────────
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  quickCard: {
    flex: 1,
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.base,
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  quickIcon: {
    fontSize: 22,
  },
  quickLabel: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
});

export default HomeScreen;
