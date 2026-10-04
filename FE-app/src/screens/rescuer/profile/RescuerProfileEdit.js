import { useFocusEffect } from '@react-navigation/native';
/**
 * src/screens/rescuer/profile/RescuerProfileEdit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình chỉnh sửa hồ sơ Cứu hộ viên.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Alert, ActivityIndicator,
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
  useFocusEffect(React.useCallback(() => {
    if (!userInfo?.id) return;
    let alive = true;
    setProfileReady(false); setProfileError('');

    const fetchProfile = async () => {
      try {
        // 1. Lấy dữ liệu (response chính là profileData)
        const profileData = await API.rescuers.getProfile(userInfo.id);


        // 2. Kiểm tra và set trực tiếp từ profileData (không dùng .profile)
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
    return () => { alive = false; };
  }, [userInfo?.id, retry]));
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
      // Cấu trúc dữ liệu phẳng để khớp với RescuerProfileSerializer
      const payload = {
        full_name: fullName,
        id_number: idNumber,
        unit_name: unitName,
        rank: rank,
        team_code: teamCode,
        phone, address,
        specialty: specialty,
      };

      const response = await API.rescuers.updateProfile(userInfo.id, payload);

      if (response) {
        // Cập nhật lại context để các màn hình khác (như ProfileScreen) nhận dữ liệu mới ngay lập tức
        if (updateUserInfo) {
          const updatedUser = {
            ...userInfo,
            full_name: response.full_name,
            phone: response.phone, address: response.address,
            profile: { ...(userInfo.profile || {}), ...response },
            rescuer_profile: { ...(userInfo.rescuer_profile || {}), ...response },
          };
          await updateUserInfo(updatedUser);
        }
        navigation.goBack();
      }
    } catch (error) {
      console.error("Lỗi cập nhật hồ sơ:", error);
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
      <RescuerHeader dark showBack onBack={() => navigation.goBack()} title="CHỈNH SỬA HỒ SƠ" />

      <ScrollView contentContainerStyle={styles.content}>
          {!profileReady && <Text style={{ color: '#C62828', padding: 12 }}>{profileError || 'Đang tải hồ sơ…'}</Text>}
          {!!profileError && <TouchableOpacity onPress={() => setRetry(v => v + 1)}><Text style={{ color: '#1976D2', padding: 12 }}>Thử tải lại hồ sơ</Text></TouchableOpacity>}
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
            placeholder="Ví dụ: Đội cứu hộ Hà Nội"
          />

          <InputGroup
            label="CẤP BẬC"
            value={rank}
            onChangeText={setRank}
            placeholder="Ví dụ: Đội trưởng, Thành viên..."
          />

          <InputGroup label="SỐ ĐIỆN THOẠI" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <InputGroup label="ĐỊA CHỈ" value={address} onChangeText={setAddress} />
          <InputGroup label="SỐ HIỆU ĐỘI (TỰ KHAI)" value={teamCode} onChangeText={setTeamCode} />
          <Text style={styles.fieldLabel}>CHUYÊN MÔN CHÍNH</Text>
          {Object.entries({ SEARCH_RESCUE: 'Tìm kiếm & cứu nạn', MEDICAL: 'Y tế', LOGISTICS: 'Hậu cần', COMMAND: 'Chỉ huy' }).map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setSpecialty(key)} style={[styles.input, { justifyContent: 'center', borderColor: specialty === key ? '#42A5F5' : '#455A64' }]}>
              <Text style={{ color: '#FFF' }}>{specialty === key ? '● ' : '○ '}{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.disabledButton]}
          onPress={handleSave}
          disabled={loading || !profileReady}
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
      placeholderTextColor={RCOLORS.textHint}
      keyboardType={keyboardType}
      multiline={multiline}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgDark },
  content: { padding: RSPACING.base, gap: RSPACING.lg },

  formCard: {
    backgroundColor: RCOLORS.bgNavyLight,
    borderRadius: RRADIUS.md,
    padding: RSPACING.base,
    gap: 16
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: RCOLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 4
  },

  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: RCOLORS.textHint,
    letterSpacing: 1
  },
  input: {
    backgroundColor: RCOLORS.bgDark,
    borderRadius: RRADIUS.sm,
    height: 48,
    paddingHorizontal: 12,
    color: RCOLORS.textWhite,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputMultiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  saveButton: {
    backgroundColor: RCOLORS.primary,
    height: 56,
    borderRadius: RRADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: RCOLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: { opacity: 0.7 },
  saveButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1
  },
});

export default RescuerProfileEdit;
