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

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';



const VERIFY_OPTIONS = [
  { id: 'TRUE',         label: 'Còn nguy hiểm',  color: COLORS.statusGreen,  bgColor: '#E8F5E9' },
  { id: 'FALSE',        label: 'Tin giả',          color: COLORS.primary,      bgColor: '#FFEBEE' },
  { id: 'STILL_DANGER', label: 'Vẫn nguy hiểm',         color: COLORS.statusOrange, bgColor: '#FFF3E0' },
  { id: 'RESCUED',      label: 'Đã có cứu trợ',         color: COLORS.statusBlue,   bgColor: '#E3F2FD' },
];
const LEVEL = [
  { id: 'WARNING',         label: 'Cảnh báo',  color: COLORS.statusGreen,  bgColor: '#E8F5E9' },
  { id: 'EMERGENCY',        label: 'Khẩn cấp',          color: COLORS.primary,      bgColor: '#FFEBEE' },
  { id: 'NOTIFICATION',        label: 'Thông báo',          color: COLORS.primary,      bgColor: '#FFEBEE' },
];
const SOURCE = [
  { id: 'SYSTEM',         label: 'Hệ thống',  color: COLORS.statusGreen,  bgColor: '#E8F5E9' },
  { id: 'AI',        label: 'AI',          color: COLORS.primary,      bgColor: '#FFEBEE' },
];
const CommunityVerifyScreen = ({ navigation, route }) => {
  const { alertId } = route.params || {};
  const { userInfo } = useAuth();

  const [alertData, setAlertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // ─── Load alert details ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAlert = async () => {
      try {
        setLoading(true);
        const data = await API.alerts.getDetails(alertId);
        setAlertData(data);
      } catch (e) {
        console.log('Fetch alert error:', e);
      } finally {
        setLoading(false);
      }
    };
    if (alertId) {
      fetchAlert();
    }
  }, [alertId]);

  // ─── Submit vote ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert('Chọn trạng thái', 'Vui lòng chọn một đánh giá trước khi gửi.');
      return;
    }
    try {
      await API.alerts.vote(alertId, {
        verdict: selected,
        user: userInfo?.id,
      });
      setSubmitted(true);
      Alert.alert(
        'Cảm ơn!',
        'Đánh giá của bạn đã được ghi lại.',
        [{ text: 'Quay lại', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      console.log('Submit vote error:', e);
      const msg = e?.error || 'Bạn đã đánh giá cảnh báo này.';
      Alert.alert('Lỗi', msg);
    }
  };

  // ─── Format thời gian ──────────────────────────────────────────────────────
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <SentinelHeader showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textSecondary }}>Đang tải cảnh báo...</Text>
        </View>
      </SafeAreaView>
    );
  }

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

          {/* Tiêu đề sự cố — lấy từ API */}
          <View style={styles.incidentTitleBox}>
            <Text style={styles.incidentTitle}>
              {alertData?.title || 'Đang tải...'}
            </Text>
          </View>
        </View>

        {/* ─── 2. Thông tin sự cố (từ API) ────────────────────────────────── */}
        {alertData && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoMain}>
                  Khu vực: {alertData.zone_name || 'Chưa xác định'}
                </Text>
                {alertData.description ? (
                  <Text style={styles.infoSub}>{alertData.description}</Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.infoRow, { marginTop: SPACING.sm }]}>
              <Text style={styles.infoIcon}>🕐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoMain}>
                  Thời gian báo cáo
                </Text>
                <Text style={styles.infoSub}>
                  {formatTime(alertData.created_at)}
                </Text>
              </View>
            </View>

            {alertData.severity && (
              <View style={[styles.infoRow, { marginTop: SPACING.sm }]}>
                <Text style={styles.infoIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoMain}>Mức độ</Text>
                  <Text style={styles.infoSub}>{LEVEL.find(x=> x.id === alertData.severity)?.label}</Text>
                </View>
              </View>
            )}

            {alertData.source && (
              <View style={[styles.infoRow, { marginTop: SPACING.sm }]}>
                <Text style={styles.infoIcon}>📡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoMain}>Nguồn phát tin</Text>
                  <Text style={styles.infoSub}>{SOURCE.find(x=> x.id === alertData.source)?.label}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ─── 3. Verify section ──────────────────────────────────────────── */}
        <View style={styles.verifySection}>
          <Text style={styles.verifyTitle}>Xác thực tình trạng này</Text>
          {alertData && (
            <Text style={styles.verifySubtitle}>Cảnh báo: {alertData.title}</Text>
          )}
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
                  disabled={submitted}
                >
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
            disabled={submitted || !selected}
          >
            <Text style={styles.submitText}>
              {submitted ? '✓ Đã gửi xác nhận' : 'Gửi xác nhận'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── 4. Thống kê vote hiện tại ──────────────────────────────────── */}
        {alertData?.votes && alertData.votes.length > 0 && (
          <View style={styles.voteSummaryCard}>
            <Text style={styles.voteSummaryTitle}>
              Xác nhận cộng đồng ({alertData.vote_count || alertData.votes.length} lượt)
            </Text>
            {alertData.votes.map((v) => (
              <View key={v.id} style={styles.voteRow}>
                <Text style={styles.voteUser}>{v.user_name || 'Ẩn danh'}</Text>
                <Text style={styles.voteVerdict}>{VERIFY_OPTIONS.find(x=> x.id === v.verdict)?.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── 5. AI Analysis card ────────────────────────────────────────── */}
        {/* <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <Text style={styles.aiCardIcon}>🤖</Text>
            <Text style={styles.aiCardLabel}>PHÂN TÍCH AI BẢO VỆ</Text>
          </View>
          <Text style={styles.aiCardText}>
            Xác nhận hình ảnh từ các camera giao thông lân cận cho thấy mực nước đang dâng cao 2cm/giờ.
          </Text>
        </View> */}

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

  // ── Vote summary ──────────────────────────────
  voteSummaryCard: {
    backgroundColor: COLORS.bgWhite,
    marginHorizontal: LAYOUT.screenPadding,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    ...SHADOWS.card,
    marginBottom: SPACING.base,
  },
  voteSummaryTitle: {
    fontSize: FONTS.base,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  voteUser: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
  },
  voteVerdict: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semiBold,
    color: COLORS.textPrimary,
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
