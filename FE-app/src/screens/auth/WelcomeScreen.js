/**
 * src/screens/auth/WelcomeScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Chào mừng — Chọn vai trò (Actor Selection).
 *
 * Bố cục thiết kế SENTINEL:
 *  1. Background tối (gradient giả lập) + logo lớn ở giữa
 *  2. "SENTINEL" title + tagline
 *  3. "CHỌN VAI TRÒ CỦA BẠN" label
 *  4. Card NGƯỜI DÂN (light, blue accent)
 *  5. Card ĐỘI CỨU HỘ (dark, red accent)
 *  6. Footer: version + blockchain badge
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, StatusBar, Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
const { height: SCREEN_H } = Dimensions.get('window');

// ─── Màu sắc nội tuyến (không phụ thuộc theme) ────────────────────────────────
const C = {
  bg: '#0B1220',
  bgCard: '#111E30',
  bgCardLight: '#FFFFFF',
  primary: '#E53935',
  blue: '#1565C0',
  teal: '#00838F',
  white: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.55)',
  textDimDark: 'rgba(0,0,0,0.5)',
  border: 'rgba(255,255,255,0.10)',
  borderLight: '#E0E7F0',
};

const WelcomeScreen = ({ navigation }) => {
  // Animations
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const cardsY = useRef(new Animated.Value(60)).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Logo xuất hiện
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      // 2. Cards slide up
      Animated.parallel([
        Animated.spring(cardsY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(cardsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Background decorative circles ───────────────────────────────── */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* ── Logo + Title ─────────────────────────────────────────────────── */}
      <Animated.View style={[styles.logoSection, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.shieldOuter}>
          <View style={styles.shieldInner}>
            <Text style={styles.shieldText}>🛡</Text>
          </View>
        </View>
        <Text style={styles.brandName}>SENTINEL</Text>
        <Text style={styles.tagline}>Hệ thống Cứu hộ Khẩn cấp</Text>

        {/* Live indicator */}
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>HỆ THỐNG ĐANG HOẠT ĐỘNG</Text>
        </View>
      </Animated.View>

      {/* ── Role picker cards ────────────────────────────────────────────── */}
      <Animated.View style={[styles.cardsSection, { opacity: cardsOpacity, transform: [{ translateY: cardsY }] }]}>
        <Text style={styles.chooseLabel}>CHỌN VAI TRÒ CỦA BẠN</Text>

        {/* ── CITIZEN card ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.citizenCard}
          onPress={() => navigation.navigate('CitizenLogin')}
          activeOpacity={0.88}
          accessibilityLabel="Đăng nhập với vai trò Người dân"
        >
          <View style={styles.cardIconBox}>
            <MaterialCommunityIcons
              name="account-outline"
              size={26}
              color="#000"
            />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.citizenCardTitle}>Người dân</Text>
            <Text style={styles.citizenCardDesc}>
              Báo cáo khẩn cấp · Nhận cảnh báo · Theo dõi cứu hộ
            </Text>
          </View>
          <View style={[styles.cardArrow, { backgroundColor: C.blue }]}>
            <Text style={styles.cardArrowText}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── RESCUER card ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.rescuerCard}
          onPress={() => navigation.navigate('RescuerLogin')}
          activeOpacity={0.88}
          accessibilityLabel="Đăng nhập với vai trò Đội cứu hộ"
        >
          <View style={[styles.cardIconBox, { backgroundColor: 'rgba(229,57,53,0.15)' }]}>
  <MaterialCommunityIcons
    name="fire-truck"
    size={26}
    color="#fff"
  />
</View>
          <View style={styles.cardBody}>
            <Text style={styles.rescuerCardTitle}>Đội cứu hộ</Text>
            <Text style={styles.rescuerCardDesc}>
              Command Center · Điều phối · Nhiệm vụ thực địa
            </Text>
          </View>
          <View style={[styles.cardArrow, { backgroundColor: C.primary }]}>
            <Text style={styles.cardArrowText}>›</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <View style={styles.footerBadge}>

        </View>
        <Text style={styles.footerVersion}>SENTINEL v2.1 · © 2025</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Background decorative
  bgCircle1: {
    position: 'absolute',
    width: 400, height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(229,57,53,0.06)',
    top: -100, right: -100,
  },
  bgCircle2: {
    position: 'absolute',
    width: 300, height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(21,101,192,0.05)',
    bottom: 50, left: -80,
  },

  // Logo section
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    gap: 12,
  },
  shieldOuter: {
    width: 100, height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(229,57,53,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(229,57,53,0.3)',
  },
  shieldInner: {
    width: 72, height: 72,
    borderRadius: 18,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  shieldText: { fontSize: 36 },
  brandName: {
    fontSize: 40,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 13,
    color: C.textDim,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
    backgroundColor: 'rgba(67,160,71,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(67,160,71,0.25)',
  },
  liveDot: {
    width: 7, height: 7,
    borderRadius: 3.5,
    backgroundColor: '#43A047',
  },
  liveText: {
    color: '#43A047',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Cards section
  cardsSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  chooseLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textDim,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },

  // Citizen card (light background)
  citizenCard: {
    backgroundColor: C.bgCardLight,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderTopWidth: 3,
    borderTopColor: C.blue,
  },
  rescuerCard: {
    backgroundColor: '#16273C',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.25)',
    borderTopWidth: 3,
    borderTopColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  cardIconBox: {
    width: 52, height: 52,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: { fontSize: 26 },
  cardBody: { flex: 1 },
  citizenCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D1A2D',
  },
  citizenCardDesc: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    marginTop: 3,
    lineHeight: 16,
  },
  rescuerCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.white,
  },
  rescuerCardDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
    lineHeight: 16,
  },
  cardArrow: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrowText: {
    color: C.white,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
    gap: 8,
  },
  footerBadge: {
    backgroundColor: 'rgba(0,188,212,0.12)',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,188,212,0.2)',
  },
  footerBadgeText: {
    color: '#00BCD4',
    fontSize: 11,
    fontWeight: '600',
  },
  footerVersion: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
  },
});

export default WelcomeScreen;
