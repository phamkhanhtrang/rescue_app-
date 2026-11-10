import { useFocusEffect } from '@react-navigation/native';
/**
 * src/screens/rescuer/profile/RescuerProfileEdit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình chỉnh sửa hồ sơ Cứu hộ viên (Light Theme đồng bộ).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../services/api';
import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS } from '../../../constants/rescuer/theme';

const RescuerProfileEdit = ({ navigation }) => {
  const { userInfo, updateUserInfo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [retry, setRetry] = useState(0);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
  });

  // State cho các trường thông tin
  const [fullName, setFullName] = useState(userInfo?.full_name || userInfo?.name || '');
  const [idNumber, setIdNumber] = useState(userInfo?.profile?.id_number || '');
  const [unitName, setUnitName] = useState(userInfo?.profile?.unit_name || '');
  const [teamCode, setTeamCode] = useState('');
  const [phone, setPhone] = useState(userInfo?.phone || '');
  const [address, setAddress] = useState(userInfo?.address || '');
  const [rank, setRank] = useState(userInfo?.profile?.rank || '');
  const [specialty, setSpecialty] = useState(userInfo?.profile?.specialty || '');

  useFocusEffect(
    React.useCallback(() => {
      if (!userInfo?.id) return;
      let alive = true;
      setProfileReady(false);
      setProfileError('');

      const fetchProfile = async () => {
        try {
          const profileData = await API.rescuers.getProfile(userInfo.id);
          if (profileData && alive) {
            setProfileReady(true);
            setFullName(profileData.full_name || '');
            setIdNumber(profileData.id_number || '');
            setUnitName(profileData.unit_name || '');
            setRank(profileData.rank || '');
            setTeamCode(profileData.team_code || '');
            setPhone(profileData.phone || '');
            setAddress(profileData.address || '');
            setSpecialty(profileData.specialty || '');
          }
        } catch (error) {
          if (alive) setProfileError(error?.message || 'Không tải được hồ sơ.');
        }
      };

      fetchProfile();
      return () => {
        alive = false;
      };
    }, [userInfo?.id, retry])
  );

  const handleSave = async () => {
    if (!profileReady || loading) return;

    if (!userInfo?.id) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: 'Không tìm thấy thông tin định danh người dùng.',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName,
        id_number: idNumber,
        unit_name: unitName,
        rank: rank,
        team_code: teamCode,
        phone,
        address,
        specialty: specialty,
      };

      const response = await API.rescuers.updateProfile(userInfo.id, payload);

      if (response) {
        if (updateUserInfo) {
          const updatedUser = {
            ...userInfo,
            full_name: response.full_name,
            phone: response.phone,
            address: response.address,
            profile: { ...(userInfo.profile || {}), ...response },
            rescuer_profile: { ...(userInfo.rescuer_profile || {}), ...response },
          };
          await updateUserInfo(updatedUser);
        }
        navigation.goBack();
      }
    } catch (error) {
      console.error('Lỗi cập nhật hồ sơ:', error);
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: error?.message || 'Không thể cập nhật hồ sơ. Vui lòng thử lại.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} title="CHỈNH SỬA HỒ SƠ" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!profileReady && (
          <Text style={{ color: RCOLORS.primary, padding: 8, fontSize: 13, fontWeight: '600' }}>
            {profileError || 'Đang tải thông tin hồ sơ...'}
          </Text>
        )}
        {!!profileError && (
          <TouchableOpacity onPress={() => setRetry(v => v + 1)}>
            <Text style={{ color: '#1D4ED8', padding: 8, fontWeight: '700' }}>Thử tải lại hồ sơ</Text>
          </TouchableOpacity>
        )}

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>THÔNG TIN CƠ BẢN</Text>

          <InputGroup
            label="HỌ VÀ TÊN"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nhập họ tên đầy đủ"
          />

          <InputGroup
            label="SỐ CCCD"
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="Nhập số CCCD"
            keyboardType="numeric"
          />

          <InputGroup
            label="TỔ CHỨC / ĐƠN VỊ"
            value={unitName}
            onChangeText={setUnitName}
            placeholder="Ví dụ: Đội cứu hộ Đà Nẵng"
          />

          <InputGroup
            label="CẤP BẬC"
            value={rank}
            onChangeText={setRank}
            placeholder="Ví dụ: Đội trưởng, Thành viên..."
          />

          <InputGroup
            label="SỐ ĐIỆN THOẠI"
            value={phone}
            onChangeText={setPhone}
            placeholder="Nhập số điện thoại"
            keyboardType="phone-pad"
          />

          <InputGroup
            label="ĐỊA CHỈ"
            value={address}
            onChangeText={setAddress}
            placeholder="Địa chỉ thường trú / địa bàn hoạt động"
          />

          <InputGroup
            label="SỐ HIỆU ĐỘI (TỰ KHAI)"
            value={teamCode}
            onChangeText={setTeamCode}
            placeholder="Mã đội hoặc số hiệu cano/xuồng"
          />

          <Text style={styles.fieldLabel}>CHUYÊN MÔN CHÍNH</Text>
          <View style={styles.specialtyContainer}>
            {Object.entries({
              SEARCH_RESCUE: 'Tìm kiếm & cứu nạn',
              MEDICAL: 'Y tế & Sơ cứu',
              LOGISTICS: 'Hậu cần & Tiếp tế',
              COMMAND: 'Chỉ huy & Điều phối',
            }).map(([key, label]) => {
              const active = specialty === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSpecialty(key)}
                  style={[styles.specialtyItem, active && styles.specialtyItemActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.specialtyText, active && styles.specialtyTextActive]}>
                    {active ? '● ' : '○ '}
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (loading || !profileReady) && styles.disabledButton]}
          onPress={handleSave}
          disabled={loading || !profileReady}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>LƯU THAY ĐỔI</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm || (() => setModalConfig(prev => ({ ...prev, visible: false })))}
        onCancel={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const InputGroup = ({ label, value, onChangeText, placeholder, keyboardType, multiline }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      keyboardType={keyboardType}
      multiline={multiline}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: RSPACING.base, paddingBottom: 40, gap: RSPACING.lg },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RRADIUS.md,
    padding: RSPACING.base,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: RCOLORS.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },

  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: RRADIUS.sm,
    height: 48,
    paddingHorizontal: 14,
    color: '#0F172A',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  inputMultiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  specialtyContainer: { gap: 8 },
  specialtyItem: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: RRADIUS.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
  },
  specialtyItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1D4ED8',
  },
  specialtyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  specialtyTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  saveButton: {
    backgroundColor: RCOLORS.primary,
    height: 52,
    borderRadius: RRADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: RCOLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  disabledButton: { opacity: 0.6 },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default RescuerProfileEdit;
