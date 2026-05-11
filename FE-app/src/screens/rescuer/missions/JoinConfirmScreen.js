/**
 * src/screens/rescuer/missions/JoinConfirmScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Xác nhận Tham gia Cứu hộ (Screen 7).
 *
 * Bố cục Figma:
 *  1. Header back + AI VERIFIED ZONE badge
 *  2. "Tham gia cứu hộ" title + mô tả
 *  3. Chọn vai trò: Đội Y tế / Đội Cứu hộ (selected) / Đội Hậu cần
 *  4. BLOCKCHAIN VERIFIED LOG section (hash)
 *  5. "XÁC NHẬN THAM GIA →" red button
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert,
} from 'react-native';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const ROLES = [
  {
    id: 'medical', icon: '🏥',
    title: 'Đội Y tế',
    desc: 'Sơ cứu, điều phối thuốc và chăm sóc thương binh.',
  },
  {
    id: 'rescue',  icon: '⛑',
    title: 'Đội Cứu hộ',
    desc: 'Tìm kiếm cứu nạn, di chuyển người dân và thiết bị.',
    selected: true,
  },
  {
    id: 'supply',  icon: '📦',
    title: 'Đội Hậu cần',
    desc: 'Phân phối thực phẩm, nước uống và điều phối kho bãi.',
  },
];

const JoinConfirmScreen = ({ navigation, route }) => {
  const { zoneId, zoneName = 'Vùng 7G' } = route?.params ?? {};
  const [selectedRole, setSelectedRole] = useState('rescue');
  const { userInfo } = useAuth();

  const handleConfirm = async () => {
    try {
      // Gọi API tạo nhiệm vụ mới (Tham gia)
      const missionData = {
        zone: zoneId,
        rescuer: userInfo?.id,
        role: ROLES.find(r => r.id === selectedRole)?.title,
        status: 'ACTIVE'
      };

      await API.missions.create(missionData);

      Alert.alert(
        '✅ Đã tham gia!',
        `Bạn đã xác nhận tham gia vùng ${zoneName} với vai trò ${missionData.role}.`,
        [{ text: 'Bắt đầu nhiệm vụ', onPress: () => navigation.navigate('ActiveMissionScreen', { zoneName, zoneId }) }]
      );
    } catch (error) {
      console.error('Join mission error:', error);
      Alert.alert('Lỗi', 'Không thể tham gia vùng cứu hộ. Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} showAvatar={false} />

      <ScrollView contentContainerStyle={styles.content}>

        {/* AI badge */}
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeIcon}>🤖</Text>
          <Text style={styles.aiBadgeText}>VÙNG ĐÃ XÁC THỰC AI</Text>
        </View>

        <Text style={styles.pageTitle}>Tham gia cứu hộ</Text>
        <Text style={styles.pageDesc}>
          Bạn đã gia nhập vùng an toàn <Text style={styles.boldText}>{zoneName}</Text>. Vui lòng xác nhận vai trò chuyên môn của mình để hệ thống phân bổ nhiệm vụ chính xác.
        </Text>

        {/* Role selection */}
        <View style={styles.roleList}>
          {ROLES.map(role => {
            const active = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.roleCard, active && styles.roleCardActive]}
                onPress={() => setSelectedRole(role.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.roleIconBox, active && styles.roleIconBoxActive]}>
                  <Text style={styles.roleIcon}>{role.icon}</Text>
                </View>
                <View style={styles.roleInfo}>
                  <Text style={[styles.roleTitle, active && styles.roleTitleActive]}>{role.title}</Text>
                  <Text style={styles.roleDesc}>{role.desc}</Text>
                </View>
                {active && (
                  <View style={styles.roleCheck}>
                    <Text style={styles.roleCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Blockchain log */}
        {/* <View style={styles.blockchainLog}>
          <View style={styles.blockchainHeader}>
            <Text style={styles.blockchainIcon}>⛓</Text>
            <Text style={styles.blockchainLabel}>NHẬT KÝ XÁC THỰC BLOCKCHAIN</Text>
          </View>
          <Text style={styles.blockchainHash}>
            MÃ BẢO MẬT: 8zt7... •R2ik • Trạng thái của bạn sẽ được lưu vào blockchain để phục vụ truy vết sau sự cố.
          </Text>
        </View> */}

        {/* Confirm button */}
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmText}>XÁC NHẬN THAM GIA  →</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E3F2FD', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RRADIUS.full },
  aiBadgeIcon: { fontSize: 12 },
  aiBadgeText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.bgBlue, letterSpacing: 0.5 },
  pageTitle: { fontSize: RFONTS.xxl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  pageDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  boldText: { fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },

  roleList: { gap: RSPACING.md },
  roleCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, flexDirection: 'row', alignItems: 'flex-start', gap: RSPACING.md, borderWidth: 2, borderColor: RCOLORS.border, ...RSHADOWS.card },
  roleCardActive: { borderColor: RCOLORS.primary, backgroundColor: RCOLORS.primaryLight },
  roleIconBox: { width: 44, height: 44, borderRadius: RRADIUS.md, backgroundColor: RCOLORS.bgApp, alignItems: 'center', justifyContent: 'center' },
  roleIconBoxActive: { backgroundColor: RCOLORS.primary },
  roleIcon: { fontSize: 22 },
  roleInfo: { flex: 1 },
  roleTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  roleTitleActive: { color: RCOLORS.primary },
  roleDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, marginTop: 3, lineHeight: 16 },
  roleCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: RCOLORS.primary, alignItems: 'center', justifyContent: 'center' },
  roleCheckText: { color: RCOLORS.textWhite, fontSize: RFONTS.sm, fontWeight: RFONTS.bold },

  blockchainLog: { backgroundColor: '#F0F4FF', borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm, borderWidth: 1, borderColor: '#DBEAFE' },
  blockchainHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockchainIcon: { fontSize: 13 },
  blockchainLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.bgBlue, letterSpacing: 1 },
  blockchainHash: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },

  confirmButton: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base + 2, alignItems: 'center', ...RSHADOWS.redGlow },
  confirmText: { color: RCOLORS.textWhite, fontSize: RFONTS.lg, fontWeight: RFONTS.black, letterSpacing: 0.5 },
});

export default JoinConfirmScreen;
