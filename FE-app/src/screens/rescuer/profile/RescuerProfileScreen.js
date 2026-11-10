/**
 * src/screens/rescuer/profile/RescuerProfileScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hồ sơ và Cài đặt của Đội cứu trợ (Light Theme đồng bộ toàn hệ thống).
 * Tối ưu hóa:
 *  - Giao diện nền sáng rõ ràng, độ tương phản cao, đọc rõ ngoài trời nắng/mưa.
 *  - Thẻ Hotline khẩn cấp trực ban Ban Chỉ Huy (Gọi 114 / Trực ban khi mất 4G).
 *  - Phím tắt khai báo nguồn lực, chế độ ngoại tuyến, đổi mật khẩu.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS } from '../../../constants/rescuer/theme';

const RescuerProfileScreen = ({ navigation }) => {
  const { signOut, userInfo } = useAuth();
  const [idNumber, setIdNumber] = useState(userInfo?.profile?.id_number || '');
  const [unitName, setUnitName] = useState(userInfo?.profile?.unit_name || '');
  const [rank, setRank] = useState(userInfo?.profile?.rank || '');
  const [specialty, setSpecialty] = useState(userInfo?.profile?.specialty || '');

  useEffect(() => {
    if (!userInfo?.id) return;

    const fetchProfile = async () => {
      try {
        const profileData = await API.rescuers.getProfile(userInfo.id);
        if (profileData) {
          setIdNumber(profileData.id_number || '');
          setUnitName(profileData.unit_name || '');
          setRank(profileData.rank || '');
          setSpecialty(profileData.specialty_display || profileData.specialty || '');
        }
      } catch (error) {
        console.error("Lỗi khi lấy profile:", error);
      }
    };

    fetchProfile();
  }, [userInfo?.id, userInfo?.rescuer_profile]);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Đồng ý',
    cancelText: 'Hủy',
    onConfirm: null,
  });

  const handleLogout = () => {
    setModalConfig({
      visible: true,
      type: 'confirm',
      title: 'Xác nhận đăng xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống điều phối cứu nạn?',
      confirmText: 'Đăng xuất',
      cancelText: 'Hủy',
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, visible: false }));
        await signOut();
      },
    });
  };

  const PROFILE_STATS = [
    { label: 'TRẠNG THÁI', value: 'SẴN SÀNG', icon: 'shield-check-outline', color: '#16A34A', bg: '#F0FDF4' },
    { label: 'CHUYÊN MÔN', value: specialty ? specialty.slice(0, 10) : 'CỨU NẠN', icon: 'account-star-outline', color: '#1D4ED8', bg: '#EFF6FF' },
    { label: 'ĐỊNH DANH', value: 'XÁC THỰC', icon: 'check-decagram-outline', color: '#D97706', bg: '#FFFBEB' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} showAvatar={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── 1. Profile Header ─────────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>
                {(userInfo?.full_name || userInfo?.name || 'R').charAt(0).toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editBadge}
              onPress={() => navigation.navigate('RescuerProfileEdit')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="pencil" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{userInfo?.full_name || userInfo?.name || 'Cứu hộ viên'}</Text>
          <Text style={styles.userRole}>{unitName || 'Đội Cứu Nạn Khẩn Cấp'}</Text>
        </View>

        {/* ── 2. Stats Grid ─────────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          {PROFILE_STATS.map((stat, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: stat.bg }]}>
              <MaterialCommunityIcons name={stat.icon} size={22} color={stat.color} />
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── 3. Hotline Cứu Nạn Khẩn Cấp (Offline / Khi mất 4G) ───────────── */}
        <View style={styles.hotlineCard}>
          <View style={styles.hotlineHeader}>
            <MaterialCommunityIcons name="phone-alert" size={22} color={RCOLORS.primary} />
            <Text style={styles.hotlineTitle}>HOTLINE ĐIỀU PHỐI KHẨN CẤP</Text>
          </View>
          <Text style={styles.hotlineDesc}>
            Khi mất kết nối 4G/Internet hoặc cần tiếp ứng khẩn cấp, gọi trực tiếp Ban Chỉ Huy qua mạng viễn thông:
          </Text>
          <View style={styles.hotlineBtnRow}>
            <TouchableOpacity
              style={styles.hotlineBtn114}
              onPress={() => Linking.openURL('tel:114')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="phone" size={18} color="#FFF" />
              <Text style={styles.hotlineBtnText}>Gọi 114 (Cứu nạn)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hotlineBtnBCH}
              onPress={() => Linking.openURL('tel:19001144')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="radio-handheld" size={18} color="#FFF" />
              <Text style={styles.hotlineBtnText}>Trực ban BCH</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 4. Rescuer Detailed Info ───────────────────────────────────── */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>THÔNG TIN ĐỘI VIÊN</Text>

          <View style={styles.infoCard}>
            <InfoRow label="HỌ VÀ TÊN" value={userInfo?.full_name || userInfo?.name || '---'} />
            <InfoRow label="SỐ CCCD" value={idNumber || 'Chưa cập nhật'} />
            <InfoRow label="TỔ CHỨC" value={unitName || 'Đội Cứu Nạn Khẩn Cấp'} />
            <InfoRow label="CẤP BẬC" value={rank || 'Thành viên'} />
            <InfoRow label="CHUYÊN MÔN" value={specialty || 'Cứu hộ tổng hợp'} />
          </View>
        </View>

        {/* ── 5. Settings & Actions Menu ─────────────────────────────────── */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>HỆ THỐNG & TÁC CHIẾN</Text>

          <MenuButton
            icon="account-circle-outline"
            label="Chỉnh sửa thông tin cá nhân"
            onPress={() => navigation.navigate('RescuerProfileEdit')}
          />

          <MenuButton
            icon="truck-cargo-container"
            label="Khai báo nguồn lực & phương tiện"
            onPress={() => navigation.navigate('ResourceDeclareScreen')}
          />

          <MenuButton
            icon="cloud-off-outline"
            label="Chế độ ngoại tuyến (Offline Ops)"
            onPress={() => navigation.navigate('RescuerOfflineScreen')}
          />

          <MenuButton
            icon="key-outline"
            label="Tài khoản & Đổi mật khẩu"
            onPress={() => navigation.navigate('Password', { mode: 'change' })}
          />
        </View>

        {/* ── 6. Logout Button ─────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <MaterialCommunityIcons name="logout" size={20} color={RCOLORS.primary} />
          <Text style={styles.logoutText}>ĐĂNG XUẤT HỆ THỐNG</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.versionText}>HỆ THỐNG ĐIỀU PHỐI CỨU NẠN · v2.4.0</Text>
        </View>
      </ScrollView>

      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const MenuButton = ({ icon, label, value, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuLeft}>
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={RCOLORS.primary}
      />
      <Text style={styles.menuLabel}>{label}</Text>
    </View>
    <View style={styles.menuRight}>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
    </View>
  </TouchableOpacity>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoRowLabel}>{label}</Text>
    <Text style={styles.infoRowValue} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: RSPACING.base, paddingBottom: 40, gap: RSPACING.lg },

  profileHeader: { alignItems: 'center', gap: RSPACING.sm, paddingVertical: RSPACING.md },
  avatarWrap: { position: 'relative' },
  avatarLarge: {
    width: 86, height: 86,
    borderRadius: 43,
    backgroundColor: '#FDEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: RCOLORS.primary,
  },
  avatarTextLarge: { fontSize: 34, fontWeight: '900', color: RCOLORS.primary },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: RCOLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  userName: { fontSize: RFONTS.xl, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  userRole: { fontSize: RFONTS.xs, fontWeight: '700', color: RCOLORS.primary, letterSpacing: 0.5 },

  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    padding: 12, borderRadius: RRADIUS.md,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E2E8F0',
  },
  statValue: { fontSize: 12, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },

  // Hotline Card
  hotlineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RRADIUS.md,
    padding: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  hotlineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hotlineTitle: { color: RCOLORS.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  hotlineDesc: { color: '#475569', fontSize: 12, lineHeight: 18 },
  hotlineBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  hotlineBtn114: {
    flex: 1, height: 44,
    backgroundColor: RCOLORS.primary,
    borderRadius: RRADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  hotlineBtnBCH: {
    flex: 1, height: 44,
    backgroundColor: '#1D4ED8',
    borderRadius: RRADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  hotlineBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Info Section
  infoSection: { gap: RSPACING.xs },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 4 },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RRADIUS.md,
    padding: RSPACING.base,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  infoRowLabel: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  infoRowValue: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1, textAlign: 'right', marginLeft: 20 },

  menuSection: { gap: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', padding: 14, borderRadius: RRADIUS.md,
    borderWidth: 1, borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuValue: { fontSize: 12, color: '#64748B' },

  logoutButton: {
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5, borderColor: '#FCA5A5',
    borderRadius: RRADIUS.md, height: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  logoutText: { color: RCOLORS.primary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  footer: { alignItems: 'center', marginTop: 10 },
  versionText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
});

export default RescuerProfileScreen;
