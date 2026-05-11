/**
 * src/screens/citizen/alerts/OfflineModeScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Offline Mode — khi mất kết nối mạng.
 *
 * Bố cục từ Figma:
 *  1. Header SENTINEL (dark)
 *  2. Icon "cloud-off" + "ĐANG OFFLINE"
 *  3. "BLOCKCHAIN VERIFIED — SOS đã được lưu cục bộ" card xanh nhạt
 *  4. Feature list: Tự động đồng bộ / AI Guardian offline
 *  5. Device status: Vị trí GPS / Mã hóa Blockchain
 *  6. "GỬI SOS CẤP BÁCH (OFFLINE)" button (đỏ)
 *  7. Footer: "ĐANG TÌM KẾT NỐI..." | "LỰC LƯỢNG SẴN SÀNG"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Animated, Alert,
} from 'react-native';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

const OfflineModeScreen = ({ navigation }) => {
  const blink = useRef(new Animated.Value(1)).current;

  // Nhấp nháy "đang tìm kết nối"
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const handleOfflineSOS = () => {
    Alert.alert(
      '📡 SOS Offline',
      'Tín hiệu SOS đã được lưu cục bộ. Sẽ tự động gửi khi có kết nối mạng hoặc qua mạng lưới mesh.',
      [{ text: 'Đã hiểu', style: 'default' }]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bgDark }]}>
      <SentinelHeader dark showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── 1. Offline icon + title ─────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <View style={styles.offlineIconBox}>
            <Text style={styles.offlineIconText}>📵</Text>
          </View>
          <Text style={styles.offlineTitle}>ĐANG OFFLINE</Text>
          <Text style={styles.offlineSubtitle}>
            HỆ THỐNG BẢO VỆ CỤC BỘ ĐÃ KÍCH HOẠT
          </Text>
        </View>

        {/* ─── 2. Blockchain stored card ───────────────────────────────────── */}
        <View style={styles.storedCard}>
          <View style={styles.storedHeader}>
            <Text style={styles.storedIcon}>⛓</Text>
            <Text style={styles.storedLabel}>BLOCKCHAIN VERIFIED</Text>
          </View>
          <Text style={styles.storedTitle}>SOS đã được lưu cục bộ</Text>
          <Text style={styles.storedDesc}>
            Mọi tín hiệu khẩn cấp đều được mã hóa và lưu trữ an toàn ngay trên thiết bị. Hệ thống tự động đồng bộ ngay khi phục hồi kết nối.
          </Text>
        </View>

        {/* ─── 3. Feature list ─────────────────────────────────────────────── */}
        <View style={styles.featureList}>
          <FeatureItem
            icon="🔄"
            title="Tự động đồng bộ"
            desc="Đồng quét tín hiệu lên mạng lưới..."
          />
          <FeatureItem
            icon="🤖"
            title="AI Guardian"
            desc="Hỗ trợ offline vẫn khai thác dữ liệu lịch sử."
          />
        </View>

        {/* ─── 4. Device status ────────────────────────────────────────────── */}
        <View style={styles.statusCard}>
          <Text style={styles.statusCardTitle}>TRẠNG THÁI HỆ THỐNG THIẾT BỊ</Text>

          <StatusRow icon="📍" label="Vị trí GPS" sub="ĐÃ CHÍNH XÁC / ĐANG THEO DÕI" ok />
          <View style={styles.divider} />
          <StatusRow icon="🔐" label="Mã hóa Blockchain" sub="BẢO MẬT ĐA TẦNG" ok />
        </View>

        {/* ─── 5. Offline SOS button ───────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.offlineSOSButton}
          onPress={handleOfflineSOS}
          activeOpacity={0.85}
        >
          <Text style={styles.offlineSOSIcon}>📡</Text>
          <Text style={styles.offlineSOSText}>GỬI SOS CẤP BÁCH (OFFLINE)</Text>
        </TouchableOpacity>

        {/* ─── 6. Footer ───────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Animated.Text style={[styles.footerConnecting, { opacity: blink }]}>
            ĐANG TÌM KẾT NỐI...
          </Animated.Text>
          <Text style={styles.footerSeparator}>|</Text>
          <Text style={styles.footerReady}>LỰC LƯỢNG SẴN SÀNG</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FeatureItem = ({ icon, title, desc }) => (
  <View style={featureStyles.item}>
    <View style={featureStyles.iconBox}>
      <Text style={featureStyles.icon}>{icon}</Text>
    </View>
    <View style={featureStyles.content}>
      <Text style={featureStyles.title}>{title}</Text>
      <Text style={featureStyles.desc}>{desc}</Text>
    </View>
  </View>
);

const StatusRow = ({ icon, label, sub, ok }) => (
  <View style={statusStyles.row}>
    <Text style={statusStyles.icon}>{icon}</Text>
    <View style={statusStyles.content}>
      <Text style={statusStyles.label}>{label}</Text>
      <Text style={statusStyles.sub}>{sub}</Text>
    </View>
    <Text style={statusStyles.check}>{ok ? '✅' : '❌'}</Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 40,
    gap: SPACING.base,
  },

  // ── Header ─────────────────────────────────────
  headerSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.md,
  },
  offlineIconBox: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineIconText: { fontSize: 52 },
  offlineTitle: {
    fontSize: FONTS.xxl + 4,
    fontWeight: FONTS.black,
    color: COLORS.textWhite,
    letterSpacing: 2,
  },
  offlineSubtitle: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // ── Stored card ────────────────────────────────
  storedCard: {
    backgroundColor: 'rgba(11,94,117,0.5)',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.bgTeal,
    gap: SPACING.sm,
  },
  storedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storedIcon: { fontSize: 13 },
  storedLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  storedTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textWhite,
  },
  storedDesc: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },

  // ── Features ───────────────────────────────────
  featureList: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
  },

  // ── Status card ────────────────────────────────
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.md,
  },
  statusCardTitle: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // ── SOS button ─────────────────────────────────
  offlineSOSButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.base + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...SHADOWS.sos,
  },
  offlineSOSIcon: { fontSize: 18 },
  offlineSOSText: {
    color: COLORS.textWhite,
    fontSize: FONTS.base,
    fontWeight: FONTS.bold,
    letterSpacing: 0.5,
  },

  // ── Footer ─────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  footerConnecting: {
    color: COLORS.statusOrange,
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    letterSpacing: 1,
  },
  footerSeparator: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: FONTS.base,
  },
  footerReady: {
    color: COLORS.statusGreen,
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    letterSpacing: 1,
  },
});

const featureStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  content: { flex: 1 },
  title: {
    fontSize: FONTS.base,
    fontWeight: FONTS.semiBold,
    color: COLORS.textWhite,
  },
  desc: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
});

const statusStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  icon: { fontSize: 18 },
  content: { flex: 1 },
  label: {
    fontSize: FONTS.base,
    fontWeight: FONTS.medium,
    color: COLORS.textWhite,
  },
  sub: {
    fontSize: FONTS.xs,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: FONTS.semiBold,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  check: { fontSize: 18 },
});

export default OfflineModeScreen;
