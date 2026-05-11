/**
 * src/screens/citizen/profile/ProfileScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Hồ sơ cứu hộ (Tab PROFILE).
 *
 * Bố cục từ Figma:
 *  1. Header SENTINEL
 *  2. "HỒ SƠ CỨU HỘ" title + badge "SẴN SÀNG SOS" + mô tả
 *  3. Form: Tên, SĐT
 *  4. Liên hệ khẩn cấp: Tên + SĐT + nút OTP
 *  5. Vị trí xác định: địa chỉ + Map
 *  6. "BẢO MẬT BLOCKCHAIN" section
 *  7. "LƯU" button + Sign out
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, SafeAreaView, Alert,
} from 'react-native';
import API from '../../../services/api';
import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import MapPlaceholder from '../../../components/citizen/common/MapPlaceholder';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

const ProfileScreen = () => {
  const { userInfo, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState(userInfo?.full_name);
  const [phone, setPhone] = useState(userInfo?.phone);
  const [address, setAddress] = useState(userInfo?.address);

  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const setUserInfo = useAuth()?.setUser;
  const [idNumber, setIdNumber] = useState('');

  const [saved, setSaved] = useState(false);
  const [medical, setMedical] = useState(userInfo?.medical_notes);
  useEffect(() => {
    if (!userInfo?.id) return;

    const fetchProfile = async () => {
      try {
        // 1. Lấy dữ liệu (response chính là profileData)
        const profileData = await API.citizens.getProfile(userInfo.id);


        // 2. Kiểm tra và set trực tiếp từ profileData (không dùng .profile)
        if (profileData) {
          setEmergencyName(profileData.emergency_contact_name || '');
          setEmergencyPhone(profileData.emergency_contact_phone || '');
          setMedical(profileData.medical_notes || '');
          // setAddress(profileData.address || '');
          setIdNumber(profileData.id_number || '');
        }
      } catch (error) {
        console.error("Lỗi khi lấy profile:", error);
      }
    };

    fetchProfile();
  }, [userInfo?.id]);
  const handleSave = async () => {
    // TODO: Gọi API lưu profile
    setLoading(true);
    try {
      const result = await API.citizens.updateProfile(userInfo?.id, {
        full_name: name.trim(),
        phone: phone.trim(),
        address: address,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        medical_notes: medical,
        id_number:idNumber,
      });
      if (result && result.id) {
        setSaved(true);
        Alert.alert('Thành công', 'Thông tin đã được lưu.');
        // Cập nhật lại userInfo trong context nếu cần
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Đăng xuất?',
      'Bạn có chắc muốn đăng xuất khỏi SENTINEL không?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ─── 1. Title section ───────────────────────────────────────────── */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>HỒ SƠ CỨU HỘ</Text>
            <View style={styles.readyBadge}>
              <View style={styles.readyDot} />
              <Text style={styles.readyText}>SẴN SÀNG SOS</Text>
            </View>
          </View>
          <Text style={styles.pageDesc}>
            Thông tin này sẽ được sử dụng để nhận dạng và liên lạc trong các tình huống khẩn cấp thông qua hệ thống Sentinel.
          </Text>
        </View>

        {/* ─── 2. Form: Tên + SĐT ─────────────────────────────────────────── */}
        <View style={styles.formSection}>
          <FormField
            label="HỌ TÊN"
            icon="👤"
            value={name}
            onChangeText={setName}
            placeholder="Nhập họ và tên..."
          />
          <FormField
            label="SỐ ĐIỆN THOẠI"
            icon="📞"
            value={phone}
            onChangeText={setPhone}
            placeholder="+84 xxx xxx xxx"
            keyboardType="phone-pad"
            rightElement={
              <TouchableOpacity style={styles.otpButton}>
                <Text style={styles.otpText}>Gửi OTP</Text>
              </TouchableOpacity>
            }
          />
          <FormField
            label="Thông tin dị ứng thuốc"
            value={medical}
            onChangeText={setMedical}
            placeholder=""
          />
          <FormField
            label="Số CCCD"
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder=""
          />
        </View>

        {/* ─── 3. Liên hệ khẩn cấp ───────────────────────────────────────── */}
        <View style={styles.sectionGroup}>
          <View style={styles.sectionGroupHeader}>
            <Text style={styles.sectionGroupLabel}>LIÊN HỆ KHẨN CẤP</Text>
            <View style={styles.editable}>
              <Text style={styles.editableText}>⚙ Có thể chỉnh sửa</Text>
            </View>
          </View>

          <FormField
            placeholder="Tên người thân..."
            value={emergencyName}
            onChangeText={setEmergencyName}
          />
          <FormField
            placeholder="SĐT người thân..."
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* ─── 4. Vị trí xác định ─────────────────────────────────────────── */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionGroupLabel}>⊙ VỊ TRÍ XÁC ĐỊNH</Text>
          <FormField
            placeholder="Nhập địa chỉ hoặc tọa độ..."
            value={address}
            onChangeText={setAddress}
          />
          <MapPlaceholder
            height={150}
            label="Vị trí của bạn"
            badgeText="GPS HOẠT ĐỘNG"
          />
        </View>

        {/* ─── 5. Bảo mật blockchain ──────────────────────────────────────── */}
        <View style={styles.blockchainSection}>
          <View style={styles.blockchainHeader}>
            <Text style={styles.blockchainIcon}>⛓</Text>
            <Text style={styles.blockchainLabel}>BẢO MẬT BLOCKCHAIN</Text>
          </View>
          <View style={styles.hashChips}>
            {['0XB4', '81XY', 'A3TF'].map((chip) => (
              <View key={chip} style={styles.hashChip}>
                <Text style={styles.hashChipText}>{chip}</Text>
              </View>
            ))}
          </View>
          <View style={styles.blockchainStatus}>
            <Text style={styles.blockchainStatusText}>🔐 Bảo mật đa tầng</Text>
          </View>
        </View>

        {/* ─── 6. Save button ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.saveButton, saved && styles.saveDone]}
          onPress={handleSave}
          activeOpacity={0.5}
        >
          <Text style={styles.saveText}>
            {saved ? '✓ Đã lưu!' : 'LƯU  💾'}
          </Text>
        </TouchableOpacity>

        {/* ─── 7. Sign out ────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── FormField sub-component ──────────────────────────────────────────────────

const FormField = ({
  label, icon, value, onChangeText,
  placeholder, keyboardType, rightElement,
}) => (
  <View style={fieldStyles.wrapper}>
    {label && (
      <Text style={fieldStyles.label}>{label}</Text>
    )}
    <View style={fieldStyles.inputRow}>
      {icon && <Text style={fieldStyles.icon}>{icon}</Text>}
      <TextInput
        style={[fieldStyles.input, icon && fieldStyles.inputWithIcon]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textHint}
        keyboardType={keyboardType}
      />
      {rightElement}
    </View>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 40,
    gap: SPACING.base,
  },

  // ── Title section ──────────────────────────────
  titleSection: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.black,
    color: COLORS.textPrimary,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  readyDot: {
    width: 7, height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.statusGreen,
  },
  readyText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.statusGreen,
    letterSpacing: 0.5,
  },
  pageDesc: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // ── Form section ───────────────────────────────
  formSection: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.md,
    ...SHADOWS.card,
  },

  // ── Section group ──────────────────────────────
  sectionGroup: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  sectionGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionGroupLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
  },
  editable: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  editableText: {
    fontSize: FONTS.xs,
    color: COLORS.statusBlue,
    fontWeight: FONTS.medium,
  },

  // ── OTP button ─────────────────────────────────
  otpButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  otpText: {
    color: '#FFF',
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
  },

  // ── Blockchain section ─────────────────────────
  blockchainSection: {
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
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
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  hashChips: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  hashChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hashChipText: {
    color: COLORS.blockchain,
    fontSize: FONTS.sm,
    fontWeight: FONTS.semiBold,
    fontVariant: ['tabular-nums'],
  },
  blockchainStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockchainStatusText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FONTS.xs,
  },

  // ── Save button ────────────────────────────────
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.base + 2,
    alignItems: 'center',
    ...SHADOWS.sos,
  },
  saveDone: {
    backgroundColor: COLORS.statusGreen,
  },
  saveText: {
    color: COLORS.textWhite,
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    letterSpacing: 1,
  },

  // ── Sign out ───────────────────────────────────
  signOutButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  signOutText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.base,
    fontWeight: FONTS.medium,
  },
});

const fieldStyles = StyleSheet.create({
  wrapper: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  icon: { fontSize: 16 },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONTS.base,
    color: COLORS.textPrimary,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
});

export default ProfileScreen;
