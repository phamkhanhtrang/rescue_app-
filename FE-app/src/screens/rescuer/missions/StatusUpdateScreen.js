/**
 * src/screens/rescuer/missions/StatusUpdateScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cập nhật Trạng thái Hiện trường (Screen 10).
 *
 * Bố cục Figma:
 *  1. Header + AI INTELLIGENCE VERIFIED badge
 *  2. "Cập nhật hiện trường" title + mô tả
 *  3. Radio options:
 *     - Chưa tiếp cận (gray)
 *     - Đang cứu hộ (blue — selected)
 *     - Ổn định một phần (gray)
 *     - Cần hỗ trợ thêm (red — warning)
 *  4. BLOCKCHAIN SEC hash
 *  5. "Xác nhận" button
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState,useEffect} from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert, ActivityIndicator
} from 'react-native';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';

const STATUS_OPTIONS = [
  {
    id: 'ON_MY_WAY',
    icon: '⬚',
    title: 'Chưa tiếp cận',
    desc:  'Đang di chuyển tới tọa độ',
    color: RCOLORS.textSecondary,
    bg:    RCOLORS.bgApp,
    border:RCOLORS.border,
  },
  {
    id: 'ACTIVE',
    icon: '🔵',
    title: 'Đang cứu hộ',
    desc:  'Hoạt động đang diễn ra',
    color: RCOLORS.bgBlue,
    bg:    '#E3F2FD',
    border:RCOLORS.bgBlue,
    isDefault: true,
  },
  {
    id: 'COMPLETED',
    icon: '🛡',
    title: 'Đã hoàn thành',
    desc:  'Đã kiểm soát được rủi ro chính',
    color: RCOLORS.textSecondary,
    bg:    RCOLORS.bgApp,
    border:RCOLORS.border,
  },
  {
    id: 'NEEDS_HELP',
    icon: '⚠',
    title: 'Cần hỗ trợ thêm',
    desc:  'Yêu cầu chi viện ngay lập tức',
    color: RCOLORS.primary,
    bg:    RCOLORS.primaryLight,
    border:RCOLORS.primary,
    isWarning: true,
  },
];

import API from '../../../services/api';

const StatusUpdateScreen = ({ navigation, route }) => {
  const { missionId, currentStatus } = route.params || {};
  const [selected, setSelected] = useState(currentStatus || 'ACTIVE');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!missionId) return;

    const fetchMissionData = async () => {
      try {
        const missionData = await API.missions.getDetails(missionId);
        if (missionData && missionData.status) {
          setSelected(missionData.status);
        }
      } catch (error) {
        console.error("Lỗi khi lấy chi tiết nhiệm vụ:", error);
      }
    };

    fetchMissionData();
  }, [missionId]);

  const handleConfirm = async () => {
    if (!missionId) {
      Alert.alert('Lỗi', 'Không tìm thấy ID nhiệm vụ.');
      return;
    }

    setLoading(false);
    try {
      setLoading(true);
      await API.missions.updateStatus(missionId, { status: selected });
      Alert.alert(
        '✅ Đã cập nhật',
        'Trạng thái nhiệm vụ của bạn đã được ghi nhận trên hệ thống.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error('Update mission status error:', err);
      Alert.alert('Lỗi', 'Không thể cập nhật trạng thái nhiệm vụ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>

        {/* AI badge */}
        <View style={styles.aiBadge}>
          <Text style={styles.aiIcon}>🤖</Text>
          <Text style={styles.aiText}>XÁC THỰC TRÍ TUỆ NHÂN TẠO</Text>
        </View>

        <Text style={styles.pageTitle}>Cập nhật hiện trường</Text>
        <Text style={styles.pageDesc}>
          Xác nhận trạng thái nhiệm vụ được AI định kỳ phân tích để tối ưu điều phối.
        </Text>

        {/* Status options */}
        <View style={styles.optionList}>
          {STATUS_OPTIONS.map(opt => {
            const active = selected === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.optionCard, { backgroundColor: active ? opt.bg : RCOLORS.bgWhite, borderColor: active ? opt.border : RCOLORS.border }]}
                onPress={() => setSelected(opt.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.optionRadio, active && { backgroundColor: opt.color, borderColor: opt.color }]}>
                  {active && <View style={styles.optionRadioDot} />}
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{opt.title}</Text>
                  <Text style={styles.optionDesc}>{opt.desc}</Text>
                </View>
                {opt.isWarning && (
                  <View style={styles.warningChip}>
                    <Text style={styles.warningChipText}>⚡ KHẨN CẤP</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Blockchain hash */}
        <View style={styles.blockchainCard}>
          <Text style={styles.blockchainLabel}>⛓ BẢO MẬT BLOCKCHAIN</Text>
          <Text style={styles.blockchainHash}>MÃ BẢO MẬT: 81ZF • 2023-11-03</Text>
        </View>

        {/* Confirm */}
        <TouchableOpacity 
          style={[styles.confirmButton, loading && { opacity: 0.7 }]} 
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.confirmText}>Xác nhận</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RRADIUS.full },
  aiIcon: { fontSize: 12 },
  aiText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.statusGreen, letterSpacing: 0.5 },
  pageTitle: { fontSize: RFONTS.xl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  pageDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },

  optionList: { gap: RSPACING.sm },
  optionCard: { borderRadius: RRADIUS.md, padding: RSPACING.base, flexDirection: 'row', alignItems: 'flex-start', gap: RSPACING.md, borderWidth: 2, ...RSHADOWS.card },
  optionRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: RCOLORS.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  optionContent: { flex: 1 },
  optionTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary },
  optionDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, marginTop: 2 },
  warningChip: { backgroundColor: RCOLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RRADIUS.full },
  warningChipText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },

  blockchainCard: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, padding: RSPACING.base, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockchainLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: 'rgba(255,255,255,0.6)' },
  blockchainHash: { fontSize: RFONTS.sm, color: RCOLORS.blockchain, fontWeight: RFONTS.semiBold },

  confirmButton: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base + 2, alignItems: 'center', ...RSHADOWS.elevated },
  confirmText: { color: RCOLORS.textWhite, fontSize: RFONTS.lg, fontWeight: RFONTS.bold },
});

export default StatusUpdateScreen;
