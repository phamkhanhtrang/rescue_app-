/**
 * src/components/citizen/common/SentinelHeader.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Header dùng chung cho mọi màn hình SENTINEL (CitizenStack).
 *
 * Props:
 *   onSignalPress  - Callback khi nhấn icon tín hiệu (tùy chọn)
 *   dark           - Dùng theme tối (nền #0D1421, chữ trắng) — mặc định false
 *   showBack       - Hiển thị nút back (tùy chọn)
 *   onBack         - Callback khi nhấn back (tùy chọn)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, StatusBar,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '../../../constants/citizen/theme';

// ─── Shield Icon SVG thay thế bằng Text emoji ────────────────────────────────
// TODO: Thay bằng SVG hoặc @expo/vector-icons khi cài đặt

const SentinelHeader = ({
  onSignalPress,
  dark = false,
  showBack = false,
  onBack,
}) => {
  const bgColor = dark ? COLORS.bgDark   : COLORS.bgWhite;
  const textColor= dark ? COLORS.textWhite: COLORS.textPrimary;
  const logoRed  = COLORS.primary;

  return (
    <>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />
      <View style={[styles.container, { backgroundColor: bgColor }]}>

        {/* Nút back hoặc khoảng trống */}
        <View style={styles.leftSlot}>
          {showBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Text style={[styles.backArrow, { color: textColor }]}>←</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Logo SENTINEL */}
        <View style={styles.logoRow}>
          {/* Shield icon */}
          <View style={styles.shieldContainer}>
            <View style={[styles.shield, { backgroundColor: logoRed }]}>
              <Text style={styles.shieldIcon}>🛡</Text>
            </View>
          </View>

          {/* Brand name */}
          <Text style={[styles.brandName, { color: dark ? COLORS.textWhite : COLORS.primary }]}>
            SENTINEL
          </Text>
        </View>

        {/* Signal indicator */}
        <TouchableOpacity
          style={styles.rightSlot}
          onPress={onSignalPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Trạng thái tín hiệu"
        >
          <View style={styles.signalContainer}>
            {/* 3 vạch sóng */}
            {[4, 8, 12].map((h, i) => (
              <View
                key={i}
                style={[
                  styles.signalBar,
                  { height: h },
                  i < 3 && { backgroundColor: COLORS.statusGreen },
                ]}
              />
            ))}
          </View>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    borderBottomWidth: 0,
    // Thêm padding trên nếu không dùng SafeAreaView
  },

  // ── Slots ──────────────────────────────────────
  leftSlot: {
    width: 40,
    alignItems: 'flex-start',
  },
  rightSlot: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // ── Logo ───────────────────────────────────────
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shieldContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shield: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldIcon: {
    fontSize: 14,
    color: '#FFF',
  },
  brandName: {
    fontSize: FONTS.base,
    fontWeight: FONTS.black,
    letterSpacing: 1.5,
  },

  // ── Back button ────────────────────────────────
  backBtn: {
    padding: 4,
  },
  backArrow: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
  },

  // ── Signal bars ────────────────────────────────
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  signalBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: COLORS.statusGreen,
  },
});

export default SentinelHeader;
