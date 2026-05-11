/**
 * src/screens/citizen/alerts/CommunityVerifyScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Xác thực cộng đồng — người dùng xác nhận tình trạng sự cố.
 *
 * Bố cục từ Figma:
 *  1. Header ảnh sự cố + "LIVE ALERT" badge
 *  2. Thông tin sự cố: địa chỉ, người báo cáo, thời gian
 *  3. "BLOCKCHAIN VERIFIED HISTORY" section
 *  4. "Verify this Situation" — 4 lựa chọn: Đúng / Sai / Vẫn nguy hiểm / Đã có cứu trợ
 *  5. "GUARDIAN AI ANALYSIS" insight card
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert,
} from 'react-native';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

// ─── Lựa chọn xác thực ────────────────────────────────────────────────────────
const VERIFY_OPTIONS = [
  { id: 'confirm',  label: 'Đúng',            icon: '✅', color: COLORS.statusGreen, bgColor: '#E8F5E9' },
  { id: 'false',    label: 'Sai',             icon: '❌', color: COLORS.primary,      bgColor: '#FFEBEE' },
  { id: 'danger',   label: 'Vẫn nguy hiểm',  icon: '⚠️', color: COLORS.statusOrange,bgColor: '#FFF3E0' },
  { id: 'rescued',  label: 'Đã có cứu trợ',  icon: '🚒', color: COLORS.statusBlue,  bgColor: '#E3F2FD' },
];

const CommunityVerifyScreen = ({ navigation, route }) => {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selected) {
      Alert.alert('Chọn trạng thái', 'Vui lòng chọn một đánh giá trước khi gửi.');
      return;
    }
    setSubmitted(true);
    Alert.alert(
      'Cảm ơn!',
      'Đánh giá của bạn đã được ghi lại vào blockchain.',
      [{ text: 'Quay lại', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── 1. Incident image header ───────────────────────────────────── */}
        <View style={styles.imageHeader}>
          {/* Giả lập ảnh hiện trường */}
          <View style={styles.incidentImage}>
            <Text style={styles.incidentImageText}>🌊</Text>
            <Text style={styles.incidentImageLabel}>Ảnh hiện trường</Text>
          </View>

          {/* LIVE badge */}
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>CẢNH BÁO TRỰC TIẾP</Text>
          </View>

          {/* Tiêu đề sự cố */}
          <View style={styles.incidentTitleBox}>
            <Text style={styles.incidentTitle}>Ngập lụt: Quận 7, Khu vực Lam</Text>
          </View>
        </View>

        {/* ─── 2. Thông tin sự cố ─────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <View>
              <Text style={styles.infoMain}>35 Nguyễn Thị Thập, P. Tân Hưng, Q.7</Text>
              <Text style={styles.infoSub}>Đã báo cáo 12 phút trước bởi @HauLe89</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. Blockchain verified ─────────────────────────────────────── */}
        <View style={styles.blockchainSection}>
          <View style={styles.blockchainHeader}>
            <Text style={styles.blockchainIcon}>⛓</Text>
            <Text style={styles.blockchainLabel}>LỊCH SỬ XÁC THỰC BLOCKCHAIN</Text>
          </View>
          <Text style={styles.blockchainHash}>
            Mã hash: 0x7ac2...f · Xác thực bởi 14 nút lân cận.
          </Text>
          <Text style={styles.blockchainNote}>
            Báo cáo này khớp với dữ liệu từ các cảm biến lượng mưa địa phương.
          </Text>
        </View>

        {/* ─── 4. Verify section ──────────────────────────────────────────── */}
        <View style={styles.verifySection}>
          <Text style={styles.verifyTitle}>Xác thực tình trạng này</Text>
          <Text style={styles.verifySubtitle}>
            Sự đóng góp của bạn giúp lực lượng cứu hộ ưu tiên các lộ trình khẩn cấp.
          </Text>

          <View style={styles.optionsGrid}>
            {VERIFY_OPTIONS.map((opt) => {
              const isSelected = selected === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.optionCard,
                    { backgroundColor: isSelected ? opt.color : opt.bgColor },
                    isSelected && styles.optionSelected,
                  ]}
                  onPress={() => setSelected(opt.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.optionIcon}>{opt.icon}</Text>
                  <Text style={[
                    styles.optionLabel,
                    { color: isSelected ? '#FFF' : opt.color },
                  ]}>
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Text style={styles.selectedTag}>ĐÃ CHỌN</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !selected && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitted}
          >
            <Text style={styles.submitText}>
              {submitted ? '✓ Đã gửi xác nhận' : 'Gửi xác nhận'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── 5. AI Analysis card ────────────────────────────────────────── */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <Text style={styles.aiCardIcon}>🤖</Text>
            <Text style={styles.aiCardLabel}>PHÂN TÍCH AI BẢO VỆ</Text>
          </View>
          <Text style={styles.aiCardText}>
            Xác nhận hình ảnh từ các camera giao thông lân cận cho thấy mực nước đang dâng cao 2cm/giờ.
          </Text>
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
  content: {
    paddingBottom: 32,
  },

  // ── Image header ───────────────────────────────
  imageHeader: {
    height: 220,
    backgroundColor: '#2C3E50',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.base,
  },
  incidentImage: {
    alignItems: 'center',
    gap: 8,
  },
  incidentImageText: {
    fontSize: 64,
  },
  incidentImageLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FONTS.sm,
  },
  liveBadge: {
    position: 'absolute',
    top: SPACING.base,
    left: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.liveBadge,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  liveDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: FONTS.xs,
    fontWeight: FONTS.black,
    letterSpacing: 0.8,
  },
  incidentTitleBox: {
    position: 'absolute',
    bottom: 0,
    left: 0, right: 0,
    backgroundColor: 'rgba(13,20,33,0.75)',
    padding: SPACING.base,
  },
  incidentTitle: {
    color: COLORS.textWhite,
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
  },

  // ── Info card ──────────────────────────────────
  infoCard: {
    backgroundColor: COLORS.bgWhite,
    marginHorizontal: LAYOUT.screenPadding,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    ...SHADOWS.card,
    marginBottom: SPACING.base,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  infoIcon: { fontSize: 16, marginTop: 1 },
  infoMain: {
    fontSize: FONTS.base,
    fontWeight: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  infoSub: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // ── Blockchain ─────────────────────────────────
  blockchainSection: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: LAYOUT.screenPadding,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    gap: SPACING.xs,
    marginBottom: SPACING.base,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.statusGreen,
  },
  blockchainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockchainIcon: { fontSize: 13 },
  blockchainLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.statusGreen,
    letterSpacing: 0.5,
  },
  blockchainHash: {
    fontSize: FONTS.sm,
    color: COLORS.textPrimary,
  },
  blockchainNote: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // ── Verify section ─────────────────────────────
  verifySection: {
    marginHorizontal: LAYOUT.screenPadding,
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    ...SHADOWS.card,
    gap: SPACING.sm,
    marginBottom: SPACING.base,
  },
  verifyTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
  },
  verifySubtitle: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  optionCard: {
    width: '47%',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: 'rgba(255,255,255,0.3)',
  },
  optionIcon: { fontSize: 24 },
  optionLabel: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semiBold,
    textAlign: 'center',
  },
  selectedTag: {
    fontSize: FONTS.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: FONTS.bold,
    letterSpacing: 0.5,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.base,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.sos,
  },
  submitDisabled: {
    backgroundColor: COLORS.textHint,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    color: COLORS.textWhite,
    fontSize: FONTS.base,
    fontWeight: FONTS.bold,
  },

  // ── AI card ────────────────────────────────────
  aiCard: {
    marginHorizontal: LAYOUT.screenPadding,
    backgroundColor: COLORS.bgTeal,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiCardIcon: { fontSize: 14 },
  aiCardLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  aiCardText: {
    fontSize: FONTS.base,
    color: COLORS.textWhite,
    lineHeight: 22,
  },
});

export default CommunityVerifyScreen;
