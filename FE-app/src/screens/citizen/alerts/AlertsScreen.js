/**
 * src/screens/citizen/alerts/AlertsScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Thông báo — "THE GUARDIAN PULSE" (Tab ALERTS).
 *
 * Bố cục từ Figma:
 *  1. Header SENTINEL
 *  2. "OPERATIONAL STATUS" label + "THE GUARDIAN PULSE" title + "AI VERIFIED"
 *  3. Banner đỏ: "KHU VỰC NGUY HIỂM — 3 MỐI ĐE DỌA"
 *  4. Danh sách AlertCard (Critical, Warning, Rescue Info)
 *  5. Footer stats: NEARBY USERS / GRID STATUS
 *  6. Floating SOS button
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import AlertCard from '../../../components/citizen/alerts/AlertCard';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

// ─── Mock alerts data ─────────────────────────────────────────────────────────
// ─── Mock alerts data ─────────────────────────────────────────────────────────
const ALERTS = [
  {
    id: '1',
    severity: 'critical',
    category: 'LŨ QUÉT',
    title: 'Quận Mabry: Sơ tán ngay lập tức',
    description: 'Mực nước đang dâng cao 4m/h. AI gợi ý lộ trình phía Bắc qua Cao tốc 22 vẫn thông thoáng trong 15 phút tới.',
    timeAgo: '2 phút trước',
    hasRoute: true,
    verified: true,
  },
  {
    id: '2',
    severity: 'warning',
    category: 'GIÓ GIẬT MẠNH',
    title: 'Dự báo lưới điện mất ổn định',
    description: 'Gió giật vượt quá 65mph đã được phát hiện. Vui lòng sạc đầy tất cả thiết bị y tế và liên lạc ngay lập tức.',
    timeAgo: '14 phút trước',
    hasRoute: false,
    verified: false,
  },
  {
    id: '3',
    severity: 'rescue',
    category: 'TRẠM Y TẾ LƯU ĐỘNG',
    title: 'Triển khai Đội Sentinel-7',
    description: 'Hỗ trợ chấn thương và nguồn cung cấp nước sạch đã đến Trạm Trung tâm phía Tây. Mở cửa 24/7.',
    timeAgo: '1 giờ trước',
    hasRoute: false,
    verified: false,
  },
];

const AlertsScreen = ({ navigation }) => {
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
            <Text style={styles.pulseTitle}>NHỊP ĐẬP BẢO VỆ</Text>
            <View style={styles.aiVerified}>
              <Text style={styles.aiIcon}>🤖</Text>
              <Text style={styles.aiVerifiedText}>XÁC THỰC AI</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. Threat banner ───────────────────────────────────────────── */}
        <View style={styles.threatBanner}>
          <Text style={styles.threatBannerIcon}>⚠</Text>
          <View>
            <Text style={styles.threatBannerLabel}>KHU VỰC NGUY HIỂM TỨC THỜI</Text>
            <Text style={styles.threatBannerCount}>
              3 MỐI ĐE DỌA NGHIÊM TRỌNG ĐANG HOẠT ĐỘNG
            </Text>
          </View>
        </View>

        {/* ─── 3. Alert list ──────────────────────────────────────────────── */}
        <View style={styles.alertList}>
          {ALERTS.map((alert) => (
            <AlertCard
              key={alert.id}
              {...alert}
              onPress={() =>
                navigation.navigate('CommunityVerifyScreen', { alertId: alert.id })
              }
              onRoute={() => navigation.navigate('MapTab')}
            />
          ))}
        </View>

        {/* ─── 4. Quick nav to History ────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => navigation.navigate('HistoryScreen')}
        >
          <Text style={styles.historyLinkText}>📋  Xem lịch sử tín hiệu (Signal History)</Text>
          <Text style={styles.historyArrow}>›</Text>
        </TouchableOpacity>

        {/* ─── 5. Stats footer ────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
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
        </View>

        {/* ─── 6. Offline Mode link ───────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.offlineLink}
          onPress={() => navigation.navigate('OfflineModeScreen')}
        >
          <Text style={styles.offlineLinkText}>📡  Chế độ Ngoại tuyến (Offline)</Text>
          <Text style={styles.offlineArrow}>›</Text>
        </TouchableOpacity>

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
