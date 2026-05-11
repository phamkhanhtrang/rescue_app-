/**
 * src/screens/rescuer/profile/RescuerProfileScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hồ sơ và Cài đặt của Đội cứu trợ.
 * Bao gồm tính năng Đăng xuất.
 *
 * Thiết kế: Professional Navy/Dark theme, blockchain verified badge.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Image, Alert,
} from 'react-native';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS } from '../../../constants/rescuer/theme';

const RescuerProfileScreen = ({ navigation }) => {
  const { signOut, userInfo } = useAuth();
  // const [fullName, setFullName] = useState(userInfo?.full_name || userInfo?.name || '');
  const [idNumber, setIdNumber] = useState(userInfo?.profile?.id_number || '');
  const [unitName, setUnitName] = useState(userInfo?.profile?.unit_name || '');
  const [rank, setRank] = useState(userInfo?.profile?.rank || '');
  const [specialty, setSpecialty] = useState(userInfo?.profile?.specialty || '');
  useEffect(() => {
    if (!userInfo?.id) return;

    const fetchProfile = async () => {
      try {
        // 1. Lấy dữ liệu (response chính là profileData)
        const profileData = await API.rescuers.getProfile(userInfo.id);


        // 2. Kiểm tra và set trực tiếp từ profileData (không dùng .profile)
        if (profileData) {
          setIdNumber(profileData.id_number || '');
          setUnitName(profileData.unit_name || '');
          setRank(profileData.rank || '');
          setSpecialty(profileData.specialty || '');
        }
      } catch (error) {
        console.error("Lỗi khi lấy profile:", error);
      }
    };

    fetchProfile();
  }, [userInfo?.id]);
  const handleLogout = () => {
    Alert.alert(
      'Xác nhận đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống chỉ huy SENTINEL?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đăng xuất', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
          }
        },
      ]
    );
  };

  const PROFILE_STATS = [
    { label: 'NHIỆM VỤ', value: '42', icon: '📋' },
    { label: 'GIỜ TRỰC', value: '128h', icon: '⏱' },
    { label: 'UY TÍN', value: '98%', icon: '⭐' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader dark showBack onBack={() => navigation.goBack()} showAvatar={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* ── Profile Header ─────────────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>R</Text>
            </View>
            <TouchableOpacity style={styles.editBadge}>
              <Text style={styles.editIcon}>✎</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{userInfo?.name || 'Đội trưởng Trần B'}</Text>
          <Text style={styles.userRole}>CHỈ HUY HIỆN TRƯỜNG • UNIT-07</Text>
          
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>⛓ ĐẠI LÝ ĐÃ XÁC THỰC BLOCKCHAIN</Text>
          </View>
        </View>

        {/* ── Stats Grid ─────────────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          {PROFILE_STATS.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Rescuer Detailed Info ───────────────────────────────────────── */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>THÔNG TIN ĐỘI VIÊN</Text>
          
          <View style={styles.infoCard}>
            <InfoRow label="HỌ VÀ TÊN" value={userInfo?.full_name || userInfo?.name || '---'}   />
            <InfoRow
  label="SỐ CCCD"
  value={idNumber  }
/>
            <InfoRow label="TỔ CHỨC" value={unitName || 'Đội cứu hộ SENTINEL'}  />
            <InfoRow label="CẤP BẬC" value={rank || 'Thành viên'}   />
            <InfoRow label="CHUYÊN MÔN" value={specialty || 'Cứu hộ tổng hợp'}  />
          </View>
        </View>

        {/* ── Settings Menu ──────────────────────────────────────────────── */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>HỆ THỐNG & CÁ NHÂN</Text>
          
          <MenuButton 
            icon="👤" 
            label="Thông tin cá nhân" 
            onPress={() => navigation.navigate('RescuerProfileEdit')} 
          />
          <MenuButton icon="🛡" label="Bảo mật & Xác thực 2 lớp" />
          <MenuButton icon="🔔" label="Cài đặt thông báo" />
          <MenuButton icon="🌐" label="Ngôn ngữ" value="Tiếng Việt" />
          <MenuButton icon="📄" label="Điều khoản & Pháp lý" />
        </View>

        {/* ── Logout Button ─────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>ĐĂNG XUẤT HỆ THỐNG</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.versionText}>CHỈ HUY SENTINEL v2.4.0</Text>
          <Text style={styles.deviceId}>Mã thiết bị: SN-99-AX-421</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const MenuButton = ({ icon, label, value, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuLeft}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
    </View>
    <View style={styles.menuRight}>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <Text style={styles.menuArrow}>›</Text>
    </View>
  </TouchableOpacity>
);

const InfoRow = ({ label, value, icon }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoRowLeft}>
      <Text style={styles.infoRowIcon}>{icon}</Text>
      <Text style={styles.infoRowLabel}>{label}</Text>
    </View>
    <Text style={styles.infoRowValue} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgDark },
  content: { padding: RSPACING.base, paddingBottom: 40, gap: RSPACING.lg },

  profileHeader: { alignItems: 'center', gap: RSPACING.sm, paddingVertical: RSPACING.md },
  avatarWrap: { position: 'relative' },
  avatarLarge: {
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: RCOLORS.bgNavy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: RCOLORS.primary,
    ...RSHADOWS.redGlow,
  },
  avatarTextLarge: { fontSize: 40, fontWeight: '900', color: RCOLORS.textWhite },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: RCOLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: RCOLORS.bgDark,
  },
  editIcon: { color: '#FFF', fontSize: 16 },
  userName: { fontSize: RFONTS.xl, fontWeight: RFONTS.black, color: RCOLORS.textWhite, marginTop: 4 },
  userRole: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.primary, letterSpacing: 1 },
  verifiedBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(0,200,83,0.1)',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 99, borderWidth: 1, borderColor: 'rgba(0,200,83,0.3)',
  },
  verifiedText: { color: '#00C853', fontSize: 10, fontWeight: '900' },

  statsGrid: { flexDirection: 'row', gap: RSPACING.md },
  statCard: {
    flex: 1, backgroundColor: RCOLORS.bgNavyLight,
    padding: RSPACING.base, borderRadius: RRADIUS.md,
    alignItems: 'center', gap: 4,
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: RFONTS.lg, fontWeight: RFONTS.black, color: RCOLORS.textWhite },
  statLabel: { fontSize: 10, fontWeight: RFONTS.bold, color: RCOLORS.textHint, letterSpacing: 0.5 },

  menuSection: { gap: RSPACING.xs },
  sectionTitle: { fontSize: 11, fontWeight: RFONTS.black, color: RCOLORS.textHint, letterSpacing: 1.5, marginBottom: 8 },
  
  // Info Section
  infoSection: { gap: RSPACING.xs },
  infoCard: { backgroundColor: RCOLORS.bgNavyLight, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 10 },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoRowIcon: { fontSize: 14 },
  infoRowLabel: { fontSize: 10, fontWeight: RFONTS.bold, color: RCOLORS.textHint, letterSpacing: 0.5 },
  infoRowValue: { fontSize: RFONTS.sm, fontWeight: RFONTS.bold, color: RCOLORS.textWhite, flex: 1, textAlign: 'right', marginLeft: 20 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: RCOLORS.bgNavyLight, padding: RSPACING.base, borderRadius: RRADIUS.md,
    marginBottom: 2,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.base },
  menuIcon: { fontSize: 18 },
  menuLabel: { fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textWhite },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuValue: { fontSize: RFONTS.sm, color: RCOLORS.textHint },
  menuArrow: { fontSize: 24, color: RCOLORS.textHint, lineHeight: 24 },

  logoutButton: {
    marginTop: 20,
    backgroundColor: 'rgba(229,57,53,0.1)',
    borderWidth: 1.5, borderColor: RCOLORS.primary,
    borderRadius: RRADIUS.md, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { color: RCOLORS.primary, fontSize: RFONTS.base, fontWeight: RFONTS.black, letterSpacing: 1 },

  footer: { alignItems: 'center', marginTop: 10 },
  versionText: { fontSize: 10, color: RCOLORS.textHint, fontWeight: '700' },
  deviceId: { fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 },
});

export default RescuerProfileScreen;
