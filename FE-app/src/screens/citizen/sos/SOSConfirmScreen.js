/**
 * src/screens/citizen/sos/SOSConfirmScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Xác nhận SOS đã gửi thành công.
 *
 * Bố cục từ Figma:
 *  1. Header: SENTINEL
 *  2. Icon checkmark xanh + "Yêu cầu đã gửi" + badge "ĐANG CHỜ XỬ LÝ"
 *  3. Map card + badge "TÍN HIỆU MẠNH"
 *  4. SENTINEL AI INSIGHT card (teal dark)
 *  5. Progress bar (87% Ready)
 *  6. BLOCKCHAIN HASH section
 *  7. Nút "Xem trạng thái →" (đỏ) + "Hủy yêu cầu" (xám)
 *  8. Footer note
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, Alert, ActivityIndicator,
} from 'react-native';

import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import API from '../../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

const SOSConfirmScreen = ({ navigation, route }) => {
  const { emergencyType, description, location, coords, sosId } = route?.params ?? {};

  const [loading, setLoading] = useState(false);

  // Checkmark scale-in animation
  const checkScale = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: 1,
      tension: 60,
      friction: 6,
      useNativeDriver: true,
    }).start();

    Animated.timing(progressWidth, {
      toValue: 0.87, // 87%
      duration: 1500,
      useNativeDriver: false,
    }).start();
  }, []);

  const handleViewStatus = () => {
    // Điều hướng vào Tab Alerts, sau đó vào tiếp màn hình HistoryScreen bên trong AlertsNavigator
    navigation.navigate('CitizenTabs', {
      screen: 'AlertsTab',
      params: { screen: 'HistoryScreen' },
    });
  };

  const handleCancel = () => {
    Alert.alert(
      'Hủy yêu cầu?',
      'Bạn có chắc muốn hủy yêu cầu cứu hộ này không?',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy yêu cầu',
          style: 'destructive',
          onPress: async () => {
            if (!sosId) {
              navigation.navigate('CitizenTabs');
              return;
            }
            setLoading(true);
            try {
              await API.sos.cancel(sosId);
              Alert.alert('Thành công', 'Yêu cầu cứu hộ đã được hủy.');
              navigation.navigate('CitizenTabs');
            } catch (error) {
              console.error('Cancel SOS error:', error);
              Alert.alert('Lỗi', 'Không thể hủy yêu cầu lúc này. Vui lòng thử lại sau.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── 1. Checkmark + Title ───────────────────────────────────────── */}
        <View style={styles.successSection}>
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
            <Text style={styles.checkIcon}>✓</Text>
          </Animated.View>

          <Text style={styles.sentTitle}>Yêu cầu đã gửi</Text>

          <View style={styles.statusBadge}>
            <View style={styles.statusPulse} />
            <Text style={styles.statusBadgeText}>ĐANG CHỜ XỬ LÝ</Text>
          </View>
        </View>

        {/* ─── 2. Map card ────────────────────────────────────────────────── */}
        <View style={styles.mapSection}>
          <View style={styles.mapWrapper}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: coords?.latitude || 21.0285,
                longitude: coords?.longitude || 105.8542,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: coords?.latitude || 21.0285,
                  longitude: coords?.longitude || 105.8542,
                }}
                pinColor={COLORS.primary}
              />
            </MapView>
            <View style={styles.mapBadge}>
              <Text style={styles.mapBadgeText}>TÍN HIỆU MẠNH</Text>
            </View>
          </View>
          <Text style={styles.coordText}>
            📍 {coords?.latitude?.toFixed(4) || '21.0285'}° N, {coords?.longitude?.toFixed(4) || '105.8542'}° E
          </Text>
        </View>

        {/* ─── 3. AI Insight card ─────────────────────────────────────────── */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiHeaderIcon}>🤖</Text>
            <Text style={styles.aiHeaderLabel}>PHÂN TÍCH AI SENTINEL</Text>
          </View>
          <Text style={styles.aiText}>
            Lực lượng cứu hộ gần nhất đã nhận được thông tin và đang điều phối phương tiện.
          </Text>

          {/* Progress bar */}
          <View style={styles.progressWrapper}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>87% Sẵn sàng</Text>
        </View>

        {/* ─── 4. Blockchain hash ─────────────────────────────────────────── */}
        {/* <View style={styles.blockchainCard}>
          <View style={styles.blockchainHeader}>
            <Text style={styles.blockchainIcon}>⛓</Text>
            <Text style={styles.blockchainLabel}>XÁC THỰC BLOCKCHAIN</Text>
          </View>
          <View style={styles.hashRow}>
            <Text style={styles.hashLabel}>MÃ LÔ (BATCH ID)</Text>
            <Text style={styles.hashValue}>0x8F1A42...</Text>
          </View>
          <View style={styles.hashRow}>
            <Text style={styles.hashLabel}>THỜI GIAN (TIMESTAMP)</Text>
            <Text style={styles.hashValue}>1706819...8</Text>
          </View>
          <Text style={styles.hashNote}>Dữ liệu được xác thực theo thời gian thực!</Text>
        </View> */}

        {/* ─── 5. Actions ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.trackButton}
          onPress={handleViewStatus}
          activeOpacity={0.85}
        >
          <Text style={styles.trackText}>Xem trạng thái  →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, loading && { opacity: 0.6 }]}
          onPress={handleCancel}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textSecondary} />
          ) : (
            <Text style={styles.cancelText}>Hủy yêu cầu</Text>
          )}
        </TouchableOpacity>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Vui lòng giữ điện thoại luôn bật và không rời khỏi vị trí hiện tại của bạn.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 32,
    gap: SPACING.base,
  },

  // ── Success section ────────────────────────────
  successSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.statusGreen,
  },
  checkIcon: {
    fontSize: 40,
    color: COLORS.statusGreen,
    fontWeight: FONTS.bold,
  },
  sentTitle: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.black,
    color: COLORS.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  statusPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.statusOrange,
  },
  statusBadgeText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.statusOrange,
    letterSpacing: 1,
  },

  // ── Map section ────────────────────────────────
  mapSection: {
    gap: SPACING.sm,
  },
  mapWrapper: {
    height: 150,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.bgLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    ...SHADOWS.card,
  },
  mapBadgeText: {
    fontSize: 10,
    fontWeight: FONTS.bold,
    color: COLORS.statusGreen,
    letterSpacing: 0.5,
  },
  coordText: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ── AI card ────────────────────────────────────
  aiCard: {
    backgroundColor: COLORS.bgTeal,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiHeaderIcon: { fontSize: 14 },
  aiHeaderLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  aiText: {
    fontSize: FONTS.base,
    color: COLORS.textWhite,
    lineHeight: 22,
  },
  progressWrapper: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.statusGreen,
    borderRadius: RADIUS.full,
  },
  progressLabel: {
    fontSize: FONTS.xs,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },

  // ── Blockchain card ────────────────────────────
  blockchainCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  blockchainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockchainIcon: { fontSize: 14 },
  blockchainLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  hashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  hashLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textHint,
    fontWeight: FONTS.medium,
  },
  hashValue: {
    fontSize: FONTS.sm,
    color: COLORS.blockchain,
    fontWeight: FONTS.semiBold,
    fontVariant: ['tabular-nums'],
  },
  hashNote: {
    fontSize: FONTS.xs,
    color: COLORS.textHint,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Buttons ────────────────────────────────────
  trackButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.base + 2,
    alignItems: 'center',
    ...SHADOWS.sos,
  },
  trackText: {
    color: COLORS.textWhite,
    fontSize: FONTS.base + 1,
    fontWeight: FONTS.bold,
  },
  cancelButton: {
    backgroundColor: COLORS.bgLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.base + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.base + 1,
    fontWeight: FONTS.medium,
  },
  footerNote: {
    fontSize: FONTS.sm,
    color: COLORS.textHint,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.base,
  },
});

export default SOSConfirmScreen;
