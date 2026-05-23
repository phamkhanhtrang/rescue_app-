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

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';

import SentinelHeader   from '../../../components/citizen/common/SentinelHeader';
import MapPlaceholder   from '../../../components/citizen/common/MapPlaceholder';
import SOSButton        from '../../../components/citizen/home/SOSButton';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

const HomeScreen = ({ navigation }) => {

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

        {/* ─── 1. Bản đồ preview ──────────────────────────────────────────── */}
        <MapPlaceholder
          height={160}
          label="VỊ TRÍ HIỆN TẠI"
          badgeText="GPS HOẠT ĐỘNG"
          style={styles.mapCard}
        />

        {/* ─── 2. Status banner ───────────────────────────────────────────── */}
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <Text style={styles.statusLabel}>HỆ THỐNG SẴN SÀNG</Text>
        </View>

        <Text style={styles.safeTitle}>Bạn đang an toàn</Text>
        <Text style={styles.safeSubtitle}>
          Sentinel đang giám sát môi trường xung quanh bạn.
        </Text>

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
