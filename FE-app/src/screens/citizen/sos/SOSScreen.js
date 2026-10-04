/**
 * src/screens/citizen/sos/SOSScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Gửi SOS — nhập chi tiết trước khi gửi tín hiệu.
 *
 * Tính năng chính:
 *  1. Nút "Tự động dò vị trí hiện tại (GPS)"
 *  2. Kiểm tra bắt buộc các trường (Tên, SĐT, Địa chỉ, Số người, Vị trí)
 *  3. Sử dụng CustomModal cho các thông báo & xác nhận thay cho Alert.alert gốc
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator, Platform,
  Image, Modal, KeyboardAvoidingView,
} from 'react-native';

import MapView, { Marker, PROVIDER_GOOGLE } from '../../../components/common/AppMap';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import CustomModal from '../../../components/common/CustomModal';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../services/api';
import { getDraft, setDraft, remember, clearDraft } from '../../../services/sosStorage';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

const EMERGENCY_TYPES = [
  { id: 'RESCUE', label: 'Cứu người', icon: '🚨', color: COLORS.primary },
  { id: 'MEDICAL', label: 'Y tế', icon: '🏥', color: '#1565C0' },
  { id: 'FOOD', label: 'Thực phẩm', icon: '🍽️', color: '#2E7D32' },
  { id: 'FIRE', label: 'Hỏa hoạn', icon: '🔥', color: '#F57C00' },
  { id: 'OTHER', label: 'Khác', icon: '…', color: '#546E7A' },
];

const SOSScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [selectedType, setSelectedType] = useState('RESCUE');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [images, setImages] = useState([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [people, setPeople] = useState('1');
  const [contactName, setContactName] = useState(userInfo?.full_name || '');
  const [contactPhone, setContactPhone] = useState(userInfo?.phone || '');
  const [locationSource, setLocationSource] = useState('GPS');

  // Custom Modal State
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
  });

  const showModal = (type, title, message, onConfirm = null) => {
    setModalConfig({
      visible: true,
      type,
      title,
      message,
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, visible: false }));
        if (onConfirm) onConfirm();
      },
    });
  };

  useEffect(() => {
    handleDetectLocation(true);
  }, []);

  const handleDetectLocation = async (silent = false) => {
    setDetectingGps(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) {
          showModal('warning', 'Chưa cấp quyền GPS', 'Bạn vẫn có thể nhập địa chỉ hoặc chạm trực tiếp trên bản đồ để chọn vị trí.');
        }
        return;
      }

      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(coords);
      setLocationSource('GPS');

      let reverse = await Location.reverseGeocodeAsync(coords);
      if (reverse && reverse.length > 0) {
        const item = reverse[0];
        const addr = [
          item.name,
          item.street,
          item.subregion || item.district,
          item.city || item.region
        ].filter(Boolean).join(', ');
        setAddress(addr || 'Vị trí hiện tại của bạn');
      }
    } catch (error) {
      if (!silent) {
        showModal('error', 'Không dò được GPS', 'Không thể xác định tọa độ hiện tại. Vui lòng chọn trên bản đồ hoặc nhập địa chỉ.');
      }
    } finally {
      setDetectingGps(false);
    }
  };

  const validateForm = () => {
    if (!location) {
      showModal('error', 'Thiếu vị trí cứu hộ', 'Vui lòng chạm vào biểu tượng định vị hoặc ghim trên bản đồ.');
      return false;
    }
    if (!address.trim()) {
      showModal('error', 'Thiếu địa chỉ', 'Vui lòng nhập địa chỉ hoặc mốc nhận diện cụ thể (VD: Trước nhà số 12...).');
      return false;
    }
    if (!contactName.trim()) {
      showModal('error', 'Thiếu người liên hệ', 'Vui lòng nhập họ tên người liên hệ để đội cứu hộ có thể liên lạc.');
      return false;
    }
    const cleanPhone = contactPhone.trim();
    if (!cleanPhone || !/^[0-9]{9,11}$/.test(cleanPhone)) {
      showModal('error', 'SĐT không hợp lệ', 'Vui lòng nhập đúng số điện thoại (từ 9 đến 11 chữ số).');
      return false;
    }
    const numPeople = Number(people);
    if (!people || !Number.isInteger(numPeople) || numPeople < 1 || numPeople > 10000) {
      showModal('error', 'Số người không hợp lệ', 'Vui lòng nhập số lượng người cần hỗ trợ (từ 1 đến 10,000).');
      return false;
    }
    return true;
  };

  const compressImage = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipResult.uri;
    } catch (err) {
      console.warn('Không thể nén ảnh, sử dụng ảnh gốc:', err);
      return uri;
    }
  };

  const handleSend = async () => {
    if (!validateForm()) return;

    setLoading(true);
    let result;
    try {
      let key = await getDraft();
      if (key) {
        try {
          await API.sos.draft(key);
        } catch (error) {
          if (error.status !== 403) throw error;
          await clearDraft();
          key = null;
        }
      }
      if (!key) {
        key = (await API.sos.draft()).tracking_key;
        if (!key) throw new Error('Máy chủ không cấp mã theo dõi SOS.');
        await setDraft(key);
      }

      // Đóng gói thông tin và ảnh đã nén trong 1 request duy nhất (Multipart/Form-Data)
      const formData = new FormData();
      formData.append('contact_name', contactName.trim());
      formData.append('phone', contactPhone.trim());
      formData.append('address', address.trim());
      formData.append('location_lat', location.latitude.toFixed(7));
      formData.append('location_lng', location.longitude.toFixed(7));
      formData.append('location_source', locationSource);
      formData.append('emergency_type', selectedType);
      formData.append('people_count', String(people));
      formData.append('note', description.trim());

      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const imgUri = images[i];
          if (Platform.OS === 'web') {
            const blob = await (await fetch(imgUri)).blob();
            formData.append('images', blob, `sos-scene-${i + 1}.jpg`);
          } else {
            formData.append('images', {
              uri: imgUri,
              name: `sos-scene-${i + 1}.jpg`,
              type: 'image/jpeg',
            });
          }
        }
      }

      try {
        result = await API.sos.submit(formData, key);
      } catch (error) {
        if (error.status !== 403) throw error;
        await clearDraft();
        key = (await API.sos.draft()).tracking_key;
        if (!key) throw new Error('Máy chủ không cấp mã theo dõi SOS.');
        await setDraft(key);
        result = await API.sos.submit(formData, key);
      }
      await remember(result, key);
      await clearDraft();

      navigation.navigate('SOSConfirmScreen', { sosId: result.id, coords: location });
    } catch (error) {
      showModal('error', 'Chưa gửi được SOS', error.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const findAddress = async () => {
    if (!address.trim()) {
      showModal('warning', 'Thiếu địa chỉ', 'Vui lòng nhập địa chỉ hoặc mốc nhận diện trước khi tìm kiếm.');
      return;
    }
    setLoading(true);
    try {
      const found = await Location.geocodeAsync(address);
      if (!found.length) throw new Error('Không tìm thấy tọa độ cho địa chỉ này.');
      setLocation({ latitude: found[0].latitude, longitude: found[0].longitude });
      setLocationSource('ADDRESS');
    } catch (error) {
      showModal('error', 'Không tìm thấy vị trí', error.message);
    } finally {
      setLoading(false);
    }
  };

  const pickImageFromCamera = async () => {
    setPhotoModalVisible(false);
    if (images.length >= 5) {
      showModal('warning', 'Đạt giới hạn ảnh', 'Bạn chỉ có thể gửi tối đa 5 ảnh hiện trường.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showModal('warning', 'Quyền Camera', 'Ứng dụng cần quyền truy cập camera để chụp ảnh hiện trường.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]?.uri) {
      setLoading(true);
      try {
        const compressedUri = await compressImage(result.assets[0].uri);
        setImages(prev => [...prev, compressedUri]);
      } finally {
        setLoading(false);
      }
    }
  };

  const pickImageFromGallery = async () => {
    setPhotoModalVisible(false);
    const remainingSlots = 5 - images.length;
    if (remainingSlots <= 0) {
      showModal('warning', 'Đạt giới hạn ảnh', 'Bạn chỉ có thể gửi tối đa 5 ảnh hiện trường.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showModal('warning', 'Quyền thư viện ảnh', 'Ứng dụng cần quyền truy cập thư viện để chọn ảnh hiện trường.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLoading(true);
      try {
        const toAdd = result.assets.slice(0, remainingSlots);
        const compressedUris = await Promise.all(
          toAdd.map(asset => compressImage(asset.uri))
        );
        setImages(prev => [...prev, ...compressedUris]);
      } finally {
        setLoading(false);
      }
    }
  };

  const removeImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 1. GPS status badge ───────────────────────────────────────── */}
          <View style={styles.gpsBadge}>
            <View style={[styles.gpsDot, !location && { backgroundColor: '#FB8C00' }]} />
            <Text style={[styles.gpsLabel, !location && { color: '#FB8C00' }]}>
              {location ? `VỊ TRÍ XÁC ĐỊNH · ${locationSource}` : 'CHƯA DÒ ĐƯỢC VỊ TRÍ'}
            </Text>
            <Text style={styles.gpsIcon}>📡</Text>
          </View>

          <Text style={styles.sectionTitle}>VỊ TRÍ CỨU HỘ KHẨN CẤP *</Text>

          {/* ─── 2. Map & Auto Detect Action ───────────────────────────────── */}
          <View style={styles.mapContainer}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              customMapStyle={mapDarkStyle}
              initialRegion={{ latitude: 16.0544, longitude: 108.2022, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
              region={location ? {
                ...location,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              } : undefined}
              onPress={event => {
                setLocation(event.nativeEvent.coordinate);
                setLocationSource('MAP');
              }}
            >
              {location && <Marker coordinate={location} />}
            </MapView>

            <View style={styles.mapBadge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>CHẠM BẢN ĐỒ ĐỂ GHIM VỊ TRÍ</Text>
            </View>

            {/* Floating GPS locate icon button */}
            <TouchableOpacity
              style={styles.mapGpsLocateBtn}
              onPress={() => handleDetectLocation(false)}
              activeOpacity={0.8}
              disabled={detectingGps}
            >
              {detectingGps ? (
                <ActivityIndicator size="small" color="#1565C0" />
              ) : (
                <Text style={{ fontSize: 20 }}>🎯</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Form địa chỉ */}
          <View style={styles.addressSearchRow}>
            <TextInput
              style={[styles.singleInput, { flex: 1, marginBottom: 0 }]}
              placeholder="Địa chỉ hoặc mốc nhận diện (*)"
              placeholderTextColor={COLORS.textHint}
              value={address}
              onChangeText={setAddress}
            />
            <TouchableOpacity
              style={styles.locateIconBtn}
              onPress={() => handleDetectLocation(false)}
              activeOpacity={0.8}
              disabled={detectingGps}
            >
              {detectingGps ? (
                <ActivityIndicator size="small" color="#1565C0" />
              ) : (
                <Text style={{ fontSize: 20 }}>🎯</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchAddrBtn} onPress={findAddress} activeOpacity={0.8}>
              <Text style={styles.searchAddrText}>⌕ Tìm</Text>
            </TouchableOpacity>
          </View>

          {/* ─── 3. Nhu cầu khẩn cấp ───────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>
            NHU CẦU KHẨN CẤP *
          </Text>

          <View style={styles.emergencyGrid}>
            {EMERGENCY_TYPES.map((type) => {
              const isSelected = selectedType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.emergencyCard,
                    isSelected && { borderColor: type.color, backgroundColor: type.color },
                  ]}
                  onPress={() => setSelectedType(type.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emergencyIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.emergencyLabel,
                    isSelected && styles.emergencyLabelSelected,
                  ]}>
                    {type.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkMark}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ─── 4. Thông tin người cần hỗ trợ ───────────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>
            THÔNG TIN LIÊN HỆ & SỐ LƯỢNG *
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Họ và tên người liên hệ *</Text>
            <TextInput
              style={styles.singleInput}
              placeholder="Nhập tên người liên hệ"
              placeholderTextColor={COLORS.textHint}
              value={contactName}
              onChangeText={setContactName}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Số điện thoại *</Text>
              <TextInput
                style={styles.singleInput}
                placeholder="Nhập SĐT liên hệ"
                placeholderTextColor={COLORS.textHint}
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
            </View>
            <View style={[styles.inputGroup, { width: 120 }]}>
              <Text style={styles.inputLabel}>Số người *</Text>
              <TextInput
                style={styles.singleInput}
                placeholder="1"
                placeholderTextColor={COLORS.textHint}
                value={people}
                onChangeText={setPeople}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* ─── 5. Mô tả ngắn ──────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>
            GHI CHÚ / MÔ TẢ NGẮN (TÙY CHỌN)
          </Text>

          <TextInput
            style={styles.textInput}
            placeholder="VD: Có 2 người già mắc kẹt, nước ngập 1m..."
            placeholderTextColor={COLORS.textHint}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={300}
          />

          {/* ─── 6. Ảnh hiện trường (Tối đa 5 ảnh) ────────────────────────── */}
          <View style={styles.photoSection}>
            <View style={styles.photoHeaderRow}>
              <Text style={styles.sectionTitle}>ẢNH HIỆN TRƯỜNG ({images.length}/5)</Text>
              {images.length > 0 && (
                <Text style={styles.photoHintText}>Chạm ✕ để xóa ảnh</Text>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoThumbList}>
              {images.map((imgUri, index) => (
                <View key={index} style={styles.thumbWrapper}>
                  <Image source={{ uri: imgUri }} style={styles.thumbImage} />
                  <TouchableOpacity
                    style={styles.thumbRemoveBtn}
                    onPress={() => removeImage(index)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.thumbRemoveIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {images.length < 5 && (
                <TouchableOpacity
                  style={styles.addPhotoCard}
                  onPress={() => setPhotoModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addPhotoIcon}>📷</Text>
                  <Text style={styles.addPhotoText}>+ Thêm ảnh</Text>
                  <Text style={styles.addPhotoLimit}>({5 - images.length} còn lại)</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* ─── 7. Nút GỬI SOS ─────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.sendButton, loading && { opacity: 0.7 }]}
            onPress={handleSend}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.sendText}>GỬI SOS KHẨN CẤP  ▶</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.blockchainText}>Tín hiệu SOS sẽ lập tức truyền đến Trung tâm Điều phối Cứu hộ.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal chọn nguồn ảnh: Camera hoặc Thư viện */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPhotoModalVisible(false)}
        >
          <View style={styles.photoModalContent}>
            <Text style={styles.photoModalTitle}>Thêm ảnh hiện trường</Text>
            <Text style={styles.photoModalSubtitle}>Tối đa 5 ảnh để đội cứu hộ nắm rõ tình huống</Text>

            <TouchableOpacity style={styles.photoModalOption} onPress={pickImageFromCamera}>
              <Text style={styles.photoModalOptionIcon}>📸</Text>
              <View style={styles.photoModalOptionTextWrap}>
                <Text style={styles.photoModalOptionTitle}>Chụp từ Camera</Text>
                <Text style={styles.photoModalOptionDesc}>Chụp trực tiếp tình hình ngập lụt, mắc kẹt</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.photoModalOption} onPress={pickImageFromGallery}>
              <Text style={styles.photoModalOptionIcon}>🖼️</Text>
              <View style={styles.photoModalOptionTextWrap}>
                <Text style={styles.photoModalOptionTitle}>Chọn từ Thư viện ảnh</Text>
                <Text style={styles.photoModalOptionDesc}>Tải ảnh sẵn có trong thiết bị</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoModalCancelBtn}
              onPress={() => setPhotoModalVisible(false)}
            >
              <Text style={styles.photoModalCancelText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Alert Modal */}
      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  scroll: { flex: 1 },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 36,
  },

  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.statusGreen,
  },
  gpsLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.statusGreen,
    letterSpacing: 1,
    flex: 1,
  },
  gpsIcon: { fontSize: 14 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    marginBottom: SPACING.xs,
  },

  mapContainer: {
    height: 160,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    backgroundColor: '#2C3E50',
    ...SHADOWS.card,
  },
  map: { flex: 1 },
  mapBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,20,33,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.statusGreen,
  },
  badgeText: {
    color: COLORS.textWhite,
    fontSize: 10,
    fontWeight: FONTS.bold,
    letterSpacing: 0.5,
  },

  mapGpsLocateBtn: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.bgWhite,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  addressSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  locateIconBtn: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchAddrBtn: {
    height: 48,
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchAddrText: {
    fontSize: FONTS.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  inputGroup: {
    marginBottom: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  singleInput: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    height: 48,
    fontSize: FONTS.base,
    color: COLORS.textPrimary,
  },

  emergencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  emergencyCard: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgWhite,
    gap: 4,
    position: 'relative',
  },
  emergencyIcon: { fontSize: 22 },
  emergencyLabel: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  emergencyLabelSelected: {
    color: COLORS.textWhite,
  },
  checkMark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: FONTS.bold,
  },

  textInput: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONTS.base,
    color: COLORS.textPrimary,
    minHeight: 80,
    marginBottom: SPACING.md,
  },

  photoSection: {
    marginBottom: SPACING.lg,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  photoHintText: {
    fontSize: 11,
    color: COLORS.textHint,
  },
  photoThumbList: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 4,
  },
  thumbWrapper: {
    width: 82,
    height: 82,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E0E0E0',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbRemoveIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  addPhotoCard: {
    width: 82,
    height: 82,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(211, 47, 47, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  addPhotoIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  addPhotoText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addPhotoLimit: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  photoModalContent: {
    backgroundColor: COLORS.bgWhite,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : SPACING.lg,
  },
  photoModalTitle: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  photoModalSubtitle: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  photoModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#F8F9FA',
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  photoModalOptionIcon: {
    fontSize: 28,
  },
  photoModalOptionTextWrap: {
    flex: 1,
  },
  photoModalOptionTitle: {
    fontSize: FONTS.base,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  photoModalOptionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  photoModalCancelBtn: {
    marginTop: SPACING.xs,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: '#ECEFF1',
  },
  photoModalCancelText: {
    fontSize: FONTS.base,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sos,
    marginBottom: SPACING.xs,
  },
  sendText: {
    color: COLORS.textWhite,
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    letterSpacing: 1,
  },

  blockchainText: {
    fontSize: FONTS.xs,
    color: COLORS.textHint,
    textAlign: 'center',
  },
});

const mapDarkStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default SOSScreen;
