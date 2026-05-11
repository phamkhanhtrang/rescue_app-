/**
 * src/components/citizen/home/SOSButton.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Nút SOS lớn — trung tâm của màn hình HomeScreen.
 * Thiết kế: hình vuông góc bo, đỏ rực, có hiệu ứng nhấn + pulse liên tục.
 *
 * Props:
 *   onPress       - Callback khi nhấn
 *   countdownSec  - Đếm ngược trước khi gửi (default: 3)
 *   disabled      - Vô hiệu hóa nút
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  TouchableOpacity, View, Text, StyleSheet,
  Animated, Alert,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../../constants/citizen/theme';

const SOSButton = ({ onPress, countdownSec = 3, disabled = false }) => {
  const scale  = useRef(new Animated.Value(1)).current;
  const glow   = useRef(new Animated.Value(0)).current;
  const [pressing, setPressing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);

  // ── Pulse animation (liên tục) ─────────────────────────────────────────────
  useEffect(() => {
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    glowAnim.start();
    return () => glowAnim.stop();
  }, []);

  // ── Long press countdown ────────────────────────────────────────────────────
  const handlePressIn = () => {
    setPressing(true);
    setCountdown(countdownSec);

    // Scale down khi nhấn
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 20 }).start();

    let remaining = countdownSec;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setPressing(false);
        setCountdown(null);
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
        onPress && onPress();
      }
    }, 1000);
  };

  const handlePressOut = () => {
    if (pressing) {
      clearInterval(timerRef.current);
      setPressing(false);
      setCountdown(null);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    }
  };

  // Cleanup
  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Glow ring opacity ──────────────────────────────────────────────────────
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.45],
  });
  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [1.05, 1.2],
  });

  return (
    <View style={styles.wrapper}>
      {/* Vòng glow bên ngoài */}
      <Animated.View
        style={[
          styles.glowRing,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />

      {/* Nút chính */}
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={[styles.button, disabled && styles.disabled]}
          onPressIn={!disabled ? handlePressIn : undefined}
          onPressOut={!disabled ? handlePressOut : undefined}
          activeOpacity={1}
          accessible
          accessibilityLabel="Nút SOS khẩn cấp. Giữ để gửi tín hiệu cứu hộ"
          accessibilityRole="button"
        >
          {/* Text SOS */}
          <Text style={styles.sosText}>SOS</Text>

          {/* Countdown hoặc hint */}
          {pressing && countdown !== null ? (
            <Text style={styles.countdownText}>{countdown}</Text>
          ) : (
            <Text style={styles.hintText}>GIỮ {countdownSec} GIÂY</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Nhãn dưới nút */}
      <Text style={styles.caption}>YÊU CẦU CỨU TRỢ KHẨN CẤP</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 14,
  },

  // ── Glow ring ──────────────────────────────────
  glowRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    top: -4,
  },

  // ── Main button ────────────────────────────────
  button: {
    width: 140,
    height: 140,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sos,
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: '#999',
  },

  sosText: {
    color: COLORS.textWhite,
    fontSize: FONTS.hero,
    fontWeight: FONTS.black,
    letterSpacing: 4,
    lineHeight: FONTS.hero + 4,
  },
  countdownText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FONTS.xl,
    fontWeight: FONTS.bold,
  },
  hintText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FONTS.xs,
    fontWeight: FONTS.semiBold,
    letterSpacing: 1,
    marginTop: 2,
  },

  // ── Caption ────────────────────────────────────
  caption: {
    color: COLORS.textSecondary,
    fontSize: FONTS.xs,
    fontWeight: FONTS.semiBold,
    letterSpacing: 1.5,
  },
});

export default SOSButton;
