/**
 * src/components/citizen/common/MapPlaceholder.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Map placeholder styling giống màn hình thực tế.
 * Thay thế bằng react-native-maps khi cấu hình native xong.
 *
 * Props:
 *   height       - Chiều cao card (default: 180)
 *   showPin      - Hiện icon vị trí (default: true)
 *   dark         - Dùng theme tối như MapScreen (default: false)
 *   label        - Nhãn hiển thị góc dưới (vd: "VỊ TRÍ HIỆN TẠI")
 *   badgeText    - Badge ở góc trên phải (vd: "LIVE GPS LOCK")
 *   style        - StyleSheet bổ sung
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../constants/citizen/theme';

const MapPlaceholder = ({
  height = 180,
  showPin = true,
  dark = false,
  label = 'VỊ TRÍ HIỆN TẠI',
  badgeText = null,
  style,
}) => {
  // Pulse animation cho vị trí pin
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const bgColor = dark ? '#1C2B3A' : '#2C3E50';
  const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)';

  return (
    <View style={[styles.wrapper, { height }, SHADOWS.card, style]}>

      {/* Nền giả bản đồ */}
      <View style={[styles.mapBase, { backgroundColor: bgColor }]}>

        {/* Lưới ô */}
        {[...Array(6)].map((_, i) => (
          <View key={`v${i}`} style={[styles.gridV, { left: `${i * 20}%`, backgroundColor: gridColor }]} />
        ))}
        {[...Array(5)].map((_, i) => (
          <View key={`h${i}`} style={[styles.gridH, { top: `${i * 25}%`, backgroundColor: gridColor }]} />
        ))}

        {/* Đường road giả */}
        <View style={[styles.road, styles.roadH, { top: '40%', backgroundColor: 'rgba(255,255,255,0.10)' }]} />
        <View style={[styles.road, styles.roadH, { top: '65%', backgroundColor: 'rgba(255,255,255,0.07)' }]} />
        <View style={[styles.road, styles.roadV, { left: '35%', backgroundColor: 'rgba(255,255,255,0.08)' }]} />
        <View style={[styles.road, styles.roadV, { left: '70%', backgroundColor: 'rgba(255,255,255,0.06)' }]} />

        {/* Pin vị trí */}
        {showPin && (
          <View style={styles.pinContainer}>
            <Animated.View style={[styles.pinPulse, { transform: [{ scale: pulse }] }]} />
            <View style={styles.pin}>
              <View style={styles.pinDot} />
            </View>
          </View>
        )}

        {/* Badge GPS (góc trên phải) */}
        {badgeText && (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}

        {/* Label vị trí (góc dưới trái) */}
        <View style={styles.labelContainer}>
          <Text style={styles.labelIcon}>📍</Text>
          <Text style={styles.labelText}>{label}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  mapBase: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },

  // ── Grid ───────────────────────────────────────
  gridV: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 1,
  },
  gridH: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
  },

  // ── Roads ──────────────────────────────────────
  road: {
    position: 'absolute',
  },
  roadH: {
    left: 0, right: 0,
    height: 4,
    borderRadius: 2,
  },
  roadV: {
    top: 0, bottom: 0,
    width: 4,
    borderRadius: 2,
  },

  // ── Pin ────────────────────────────────────────
  pinContainer: {
    position: 'absolute',
    top: '35%',
    left: '45%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229, 57, 53, 0.25)',
  },
  pin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },

  // ── Badge ──────────────────────────────────────
  badge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
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
    backgroundColor: COLORS.statusGreen,
  },
  badgeText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    letterSpacing: 0.5,
  },

  // ── Label ──────────────────────────────────────
  labelContainer: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,20,33,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  labelIcon: {
    fontSize: 10,
  },
  labelText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: FONTS.semiBold,
  },
});

export default MapPlaceholder;
