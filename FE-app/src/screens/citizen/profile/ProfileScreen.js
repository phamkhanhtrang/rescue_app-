import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import API from '../../../services/api';
import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import CustomModal from '../../../components/common/CustomModal';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

const ProfileScreen = ({ navigation }) => {
  const { userInfo, signOut, updateUserInfo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [retry, setRetry] = useState(0);

  // Form states
  const [name, setName] = useState(userInfo?.full_name || '');
  const [phone, setPhone] = useState(userInfo?.phone || '');
  const [address, setAddress] = useState(userInfo?.address || '');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [medical, setMedical] = useState(userInfo?.medical_notes || '');
  const [avatarUri, setAvatarUri] = useState(userInfo?.avatar_url || '');

  // Sub-modal states
  const [personalModalVisible, setPersonalInfoModalVisible] = useState(false);
  const [medicalModalVisible, setMedicalModalVisible] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  // Custom Modal State
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Đồng ý',
    cancelText: 'Hủy',
    onConfirm: null,
    onCancel: null,
  });

  const showModal = ({
    type = 'info',
    title,
    message,
    confirmText = 'Đồng ý',
    cancelText = 'Hủy',
    onConfirm = null,
    onCancel = null,
  }) => {
    setModalConfig({
      visible: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, visible: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: onCancel ? () => {
        setModalConfig(prev => ({ ...prev, visible: false }));
        onCancel();
      } : null,
    });
  };

  useFocusEffect(
    useCallback(() => {
      if (!userInfo?.id) return;
      let alive = true;
      setProfileReady(false);
      setProfileError('');

      const fetchProfile = async () => {
        try {
          const profileData = await API.citizens.getProfile(userInfo.id);
          if (profileData && alive) {
            setProfileReady(true);
            setName(profileData.full_name || '');
            setPhone(profileData.phone || '');
            setEmergencyName(profileData.emergency_contact_name || '');
            setEmergencyPhone(profileData.emergency_contact_phone || '');
            setMedical(profileData.medical_notes || '');
            setAddress(profileData.address || '');
            setIdNumber(profileData.id_number || '');
            if (profileData.avatar_url) {
              setAvatarUri(profileData.avatar_url);
            }
          }
        } catch (error) {
          if (alive) setProfileError(error?.message || 'Không tải được hồ sơ.');
        }
      };

      fetchProfile();
      return () => { alive = false; };
    }, [userInfo?.id, retry])
  );

  const saveProfileData = async (payload, successMsg, closeCallback) => {
    if (!userInfo?.id) return;
    setLoading(true);
    try {
      const fullPayload = {
        full_name: name.trim(),
        phone: phone.trim(),
        address: address,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        medical_notes: medical,
        id_number: idNumber,
        avatar_url: avatarUri,
        ...payload,
      };

      const result = await API.citizens.updateProfile(userInfo.id, fullPayload);
      if (result) {
        await updateUserInfo({
          ...userInfo,
          full_name: result.full_name || fullPayload.full_name,
          phone: result.phone || fullPayload.phone,
          address: result.address || fullPayload.address,
          avatar_url: result.avatar_url || fullPayload.avatar_url,
          citizen_profile: { ...(userInfo?.citizen_profile || {}), ...result },
        });

        if (closeCallback) closeCallback();
        showModal({
          type: 'success',
          title: 'Cập nhật thành công',
          message: successMsg || 'Dữ liệu hồ sơ đã được lưu trữ an toàn.',
        });
      }
    } catch (e) {
      showModal({
        type: 'error',
        title: 'Cập nhật thất bại',
        message: e.message || 'Không thể lưu thông tin. Vui lòng kiểm tra lại.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Avatar handler
  const compressAvatar = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipResult.uri;
    } catch (err) {
      return uri;
    }
  };

  const handlePickAvatarCamera = async () => {
    setAvatarModalVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showModal({
        type: 'warning',
        title: 'Quyền truy cập Camera',
        message: 'Cần cấp quyền camera để chụp ảnh đại diện mới.',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]?.uri) {
      const compressed = await compressAvatar(result.assets[0].uri);
      setAvatarUri(compressed);
      await saveProfileData({ avatar_url: compressed }, 'Đã cập nhật ảnh đại diện mới.');
    }
  };

  const handlePickAvatarGallery = async () => {
    setAvatarModalVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showModal({
        type: 'warning',
        title: 'Quyền Thư viện ảnh',
        message: 'Cần cấp quyền thư viện để chọn ảnh đại diện.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]?.uri) {
      const compressed = await compressAvatar(result.assets[0].uri);
      setAvatarUri(compressed);
      await saveProfileData({ avatar_url: compressed }, 'Đã cập nhật ảnh đại diện mới.');
    }
  };

  const handleSignOut = () => {
    showModal({
      type: 'confirm',
      title: 'Đăng xuất tài khoản?',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng SENTINEL không?',
      confirmText: 'Đăng xuất',
      cancelText: 'Hủy',
      onConfirm: signOut,
      onCancel: () => {},
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Error / Loading State */}
        {!profileReady && (
          <View style={styles.stateBanner}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.stateBannerText}>
              {profileError ? `Lỗi: ${profileError}` : 'Đang đồng bộ hồ sơ cứu hộ...'}
            </Text>
            {!!profileError && (
              <TouchableOpacity onPress={() => setRetry(v => v + 1)}>
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── 1. Profile Header Card ──────────────────────────────────────── */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {name ? name.trim().charAt(0).toUpperCase() : '👤'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.avatarEditBadge}
              onPress={() => setAvatarModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarEditIcon}>📷</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.userName}>{name || 'Công dân Sentinel'}</Text>
            <Text style={styles.userPhone}>{phone || 'Chưa cập nhật SĐT'}</Text>

            <View style={styles.verifiedBadge}>
              <View style={styles.verifiedDot} />
              <Text style={styles.verifiedText}>CÔNG DÂN ĐÃ ĐỊNH DANH · SẴN SÀNG SOS</Text>
            </View>
          </View>
        </View>

        {/* ── 2. Menu Section: Thông tin cứu trợ & Y tế ───────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeaderTitle}>HỒ SƠ CỨU TRỢ & Y TẾ</Text>

          <View style={styles.menuCard}>
            {/* Mục 1: Thông tin cá nhân & Định danh */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setPersonalInfoModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: '#E3F2FD' }]}>
                <Text style={styles.menuEmoji}>👤</Text>
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Thông tin cá nhân & CCCD</Text>
                <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                  {name || 'Họ tên'} · {idNumber ? `CCCD: ${idNumber}` : 'Chưa nhập CCCD'}
                </Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* Mục 2: Hồ sơ sức khỏe & Y tế */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setMedicalModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: '#FFEBEE' }]}>
                <Text style={styles.menuEmoji}>🏥</Text>
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Hồ sơ sức khỏe & Dị ứng</Text>
                <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                  {medical ? medical : 'Chưa có ghi chú dị ứng / tiền sử bệnh'}
                </Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* Mục 3: Người liên hệ khẩn cấp */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setEmergencyModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: '#FFF3E0' }]}>
                <Text style={styles.menuEmoji}>🆘</Text>
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Người liên hệ khẩn cấp</Text>
                <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                  {emergencyName ? `${emergencyName} (${emergencyPhone || 'N/A'})` : 'Chưa thiết lập người thân'}
                </Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 3. Menu Section: Hoạt động & Bảo mật ──────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeaderTitle}>HOẠT ĐỘNG & BẢO MẬT</Text>

          <View style={styles.menuCard}>
            {/* Lịch sử yêu cầu SOS */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('SOSRequestsScreen')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: '#E8F5E9' }]}>
                <Text style={styles.menuEmoji}>📋</Text>
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Lịch sử tín hiệu SOS</Text>
                <Text style={styles.menuItemSubtitle}>Xem các yêu cầu cứu trợ đã gửi & tiến độ</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* Tài khoản & Mật khẩu */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Password', { mode: 'change' })}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: '#F3E5F5' }]}>
                <Text style={styles.menuEmoji}>🔒</Text>
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Tài khoản & Mật khẩu</Text>
                <Text style={styles.menuItemSubtitle}>Đổi mật khẩu và quản lý bảo mật</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 4. Menu Section: Hệ thống & Đăng xuất ────────────────────────── */}
        <View style={[styles.sectionWrap, { marginBottom: SPACING.xl }]}>
          <TouchableOpacity
            style={styles.signOutCard}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutEmoji}>🚪</Text>
            <Text style={styles.signOutText}>Đăng xuất tài khoản</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Sentinel Rescue Platform v2.4 · Bảo mật mã hóa</Text>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 1: Chỉnh sửa thông tin cá nhân & CCCD ─────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={personalModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPersonalInfoModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Thông tin cá nhân & CCCD</Text>
                <Text style={styles.sheetSubtitle}>Đội cứu hộ đối chiếu khi tiếp cận hiện trường</Text>
              </View>
              <TouchableOpacity onPress={() => setPersonalInfoModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScroll}
            >
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Họ và tên (*)</Text>
                <TextInput
                  style={styles.inputField}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nhập họ và tên đầy đủ"
                  placeholderTextColor={COLORS.textHint}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Số điện thoại (*)</Text>
                <TextInput
                  style={styles.inputField}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Nhập số điện thoại liên hệ"
                  placeholderTextColor={COLORS.textHint}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Số CCCD / CMND</Text>
                <TextInput
                  style={styles.inputField}
                  value={idNumber}
                  onChangeText={setIdNumber}
                  placeholder="Nhập 12 số CCCD"
                  placeholderTextColor={COLORS.textHint}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Địa chỉ thường trú / Nơi ở</Text>
                <TextInput
                  style={[styles.inputField, { minHeight: 64 }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                  placeholderTextColor={COLORS.textHint}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.saveActionBtn, loading && { opacity: 0.7 }]}
                disabled={loading}
                onPress={() => saveProfileData({
                  full_name: name.trim(),
                  phone: phone.trim(),
                  id_number: idNumber.trim(),
                  address: address.trim(),
                }, 'Đã cập nhật thông tin cá nhân.', () => setPersonalInfoModalVisible(false))}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveActionText}>LƯU THÔNG TIN CÁ NHÂN</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 2: Hồ sơ sức khỏe & Y tế ───────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={medicalModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMedicalModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Hồ sơ sức khỏe & Y tế</Text>
                <Text style={styles.sheetSubtitle}>Bác sĩ và cứu thương nắm thông tin khi cấp cứu</Text>
              </View>
              <TouchableOpacity onPress={() => setMedicalModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScroll}
            >
              <View style={styles.alertNoteBox}>
                <Text style={styles.alertNoteTitle}>💡 Lưu ý quan trọng:</Text>
                <Text style={styles.alertNoteText}>
                  Nếu bạn hoặc người thân có tiền sử bệnh tim mạch, hen suyễn, tiểu đường, dị ứng thuốc (Penicillin, Aspirin...) hoặc đang mang thai, hãy ghi rõ dưới đây.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Ghi chú y tế & Dị ứng</Text>
                <TextInput
                  style={[styles.inputField, { minHeight: 120, textAlignVertical: 'top' }]}
                  value={medical}
                  onChangeText={setMedical}
                  placeholder="VD: Tiền sử cao huyết áp, dị ứng kháng sinh Amoxicillin, khó thở khi ngập nước..."
                  placeholderTextColor={COLORS.textHint}
                  multiline
                  numberOfLines={5}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveActionBtn, loading && { opacity: 0.7 }]}
                disabled={loading}
                onPress={() => saveProfileData({
                  medical_notes: medical.trim(),
                }, 'Đã lưu hồ sơ sức khỏe và ghi chú y tế.', () => setMedicalModalVisible(false))}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveActionText}>LƯU HỒ SƠ Y TẾ</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 3: Người liên hệ khẩn cấp ─────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={emergencyModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEmergencyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Người liên hệ khẩn cấp</Text>
                <Text style={styles.sheetSubtitle}>Đội cứu hộ sẽ liên lạc xác nhận khi mất kết nối</Text>
              </View>
              <TouchableOpacity onPress={() => setEmergencyModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScroll}
            >
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Họ tên người thân</Text>
                <TextInput
                  style={styles.inputField}
                  value={emergencyName}
                  onChangeText={setEmergencyName}
                  placeholder="VD: Bố / Mẹ / Vợ / Chồng..."
                  placeholderTextColor={COLORS.textHint}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Số điện thoại người thân</Text>
                <TextInput
                  style={styles.inputField}
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="Nhập SĐT liên hệ khẩn cấp"
                  placeholderTextColor={COLORS.textHint}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveActionBtn, loading && { opacity: 0.7 }]}
                disabled={loading}
                onPress={() => saveProfileData({
                  emergency_contact_name: emergencyName.trim(),
                  emergency_contact_phone: emergencyPhone.trim(),
                }, 'Đã cập nhật người liên hệ khẩn cấp.', () => setEmergencyModalVisible(false))}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveActionText}>LƯU NGƯỜI LIÊN HỆ</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 4: Chọn nguồn cập nhật Ảnh đại diện ─────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.avatarModalBackdrop}
          activeOpacity={1}
          onPress={() => setAvatarModalVisible(false)}
        >
          <View style={styles.avatarPickerSheet}>
            <Text style={styles.avatarPickerTitle}>Cập nhật ảnh đại diện</Text>
            <Text style={styles.avatarPickerSubtitle}>
              Ảnh đại diện giúp đội cứu nạn nhận dạng bạn dễ dàng hơn
            </Text>

            <TouchableOpacity
              style={styles.avatarPickerOption}
              onPress={handlePickAvatarCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarPickerEmoji}>📸</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.avatarPickerOptionTitle}>Chụp ảnh mới</Text>
                <Text style={styles.avatarPickerOptionDesc}>Sử dụng camera của thiết bị</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarPickerOption}
              onPress={handlePickAvatarGallery}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarPickerEmoji}>🖼️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.avatarPickerOptionTitle}>Chọn từ thư viện ảnh</Text>
                <Text style={styles.avatarPickerOptionDesc}>Tải ảnh sẵn có từ album</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarPickerCancel}
              onPress={() => setAvatarModalVisible(false)}
            >
              <Text style={styles.avatarPickerCancelText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Modal for Alert/Confirm */}
      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 40,
    gap: SPACING.md,
  },

  stateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E2E8F0',
    padding: 10,
    borderRadius: RADIUS.md,
  },
  stateBannerText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    flex: 1,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1565C0',
  },

  // ── Header Card ──────────────────────────────────────────────────────────
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E2E8F0',
  },
  avatarFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.primary,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  avatarEditIcon: {
    fontSize: 14,
  },
  headerInfo: {
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  userPhone: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },

  // ── Menu Sections ────────────────────────────────────────────────────────
  sectionWrap: {
    gap: 6,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuEmoji: {
    fontSize: 20,
  },
  menuTextWrap: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '600',
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 64,
  },

  // ── Sign Out Card ────────────────────────────────────────────────────────
  signOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutEmoji: {
    fontSize: 16,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  versionText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },

  // ── Modal Sheet Styles ───────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 36 : SPACING.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    padding: 4,
    fontWeight: '700',
  },
  sheetScroll: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },

  alertNoteBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    gap: 4,
  },
  alertNoteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  alertNoteText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },

  saveActionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...SHADOWS.card,
  },
  saveActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Avatar Picker Modal ──────────────────────────────────────────────────
  avatarModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  avatarPickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : SPACING.lg,
  },
  avatarPickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  avatarPickerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: SPACING.md,
  },
  avatarPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarPickerEmoji: {
    fontSize: 26,
  },
  avatarPickerOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  avatarPickerOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  avatarPickerCancel: {
    marginTop: SPACING.xs,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
  },
  avatarPickerCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});

export default ProfileScreen;
