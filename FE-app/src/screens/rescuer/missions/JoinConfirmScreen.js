/**
 * src/screens/rescuer/missions/JoinConfirmScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Xác nhận Tham gia Cứu hộ.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const ROLES = [
  {
    id: 'medical',
    icon: 'hospital-box-outline',
    title: 'Đội Y tế',
    desc: 'Sơ cứu, điều phối thuốc và chăm sóc thương binh.',
  },
  {
    id: 'rescue',
    icon: 'shield-cross',
    title: 'Đội Cứu hộ',
    desc: 'Tìm kiếm cứu nạn, di chuyển người dân và thiết bị.',
    selected: true,
  },
  {
    id: 'supply',
    icon: 'package-variant-closed',
    title: 'Đội Hậu cần',
    desc: 'Phân phối thực phẩm, nước uống và điều phối kho bãi.',
  },
];

const JoinConfirmScreen = ({ navigation, route }) => {
  const { zoneId, zoneName = 'Vùng 7G', missionsCount = 0, rescuersNeeded = 0 } = route?.params ?? {};
  const [selectedRole, setSelectedRole] = useState('rescue');
  const { userInfo } = useAuth();
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Đồng ý',
    onConfirm: null,
  });

  const isFull = rescuersNeeded > 0 && missionsCount >= rescuersNeeded;

  const handleConfirm = async () => {
    if (isFull) {
      setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Đã đủ đội',
        message: 'Vùng này đã đủ đội cứu hộ, vui lòng tìm nhiệm vụ khác.',
        confirmText: 'Đã hiểu',
      });
      return;
    }

    try {
      if (userInfo?.id) {
        // Kiểm tra xem cứu hộ viên có nhiệm vụ nào chưa hoàn tất không
        const rescuerMissions = await API.missions.getAll({ rescuer_id: userInfo.id });
        const activeMission = (rescuerMissions.results || []).find(
          m => m.status !== 'COMPLETED' && m.status !== 'CANCELLED'
        );
        if (activeMission) {
          setModalConfig({
            visible: true,
            type: 'warning',
            title: 'Nhiệm vụ chưa hoàn tất',
            message: 'Bạn đang ở trong một nhiệm vụ khác. Vui lòng hoàn thành nhiệm vụ hiện tại trước khi tham gia nhiệm vụ mới.',
            confirmText: 'Đã hiểu',
          });
          return;
        }
      }

      // Gọi API tạo nhiệm vụ mới (Tham gia)
      const missionData = {
        zone: zoneId,
        rescuer: userInfo?.id,
        role: ROLES.find(r => r.id === selectedRole)?.title,
        status: 'ACCEPTED'
      };

      const createdMission = await API.missions.create(missionData);
      navigation.navigate('ActiveMissionScreen', { zoneName, zoneId, missionId: createdMission.id });
    } catch (error) {
      console.error('Join mission error:', error);
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: error?.response?.data?.error || error?.message || 'Không thể tham gia vùng cứu hộ. Vui lòng thử lại.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} showAvatar={false} />

      <ScrollView contentContainerStyle={styles.content}>

        {/* Zone badge */}
        <View style={styles.aiBadge}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={20}
            color="#666"
          />
          <Text style={styles.aiBadgeText}>KHU VỰC ĐIỀU PHỐI</Text>
        </View>

        <Text style={styles.pageTitle}>Tham gia cứu hộ</Text>
        <Text style={styles.pageDesc}>
          Bạn đang đăng ký tham gia <Text style={styles.boldText}>{zoneName}</Text>. Hãy chọn đúng vai trò theo nguồn lực thực tế của đội.
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
                <MaterialCommunityIcons
                  name={role.icon}
                  size={24}
                  color="#666"
                />
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

        {/* Confirm button */}
        <TouchableOpacity 
          style={[styles.confirmButton, isFull && { backgroundColor: '#9E9E9E', shadowColor: 'transparent', elevation: 0 }]} 
          onPress={handleConfirm}
        >
          <Text style={styles.confirmText}>{isFull ? "ĐÃ ĐỦ ĐỘI" : "XÁC NHẬN THAM GIA  →"}</Text>
        </TouchableOpacity>

      </ScrollView>

      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        onConfirm={modalConfig.onConfirm || (() => setModalConfig(prev => ({ ...prev, visible: false })))}
        onCancel={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E3F2FD', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RRADIUS.full },
  aiBadgeText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.bgBlue, letterSpacing: 0.5 },
  pageTitle: { fontSize: RFONTS.xxl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  pageDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  boldText: { fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },

  roleList: { gap: RSPACING.md },
  roleCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, flexDirection: 'row', alignItems: 'flex-start', gap: RSPACING.md, borderWidth: 2, borderColor: RCOLORS.border, ...RSHADOWS.card },
  roleCardActive: { borderColor: RCOLORS.primary, backgroundColor: RCOLORS.primaryLight },
  roleInfo: { flex: 1 },
  roleTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  roleTitleActive: { color: RCOLORS.primary },
  roleDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, marginTop: 3, lineHeight: 16 },
  roleCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: RCOLORS.primary, alignItems: 'center', justifyContent: 'center' },
  roleCheckText: { color: RCOLORS.textWhite, fontSize: RFONTS.sm, fontWeight: RFONTS.bold },

  confirmButton: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base + 2, alignItems: 'center', ...RSHADOWS.redGlow },
  confirmText: { color: RCOLORS.textWhite, fontSize: RFONTS.lg, fontWeight: RFONTS.black, letterSpacing: 0.5 },
});

export default JoinConfirmScreen;
