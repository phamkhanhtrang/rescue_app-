/**
 * src/screens/citizen/sos/SOSScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Gửi SOS — nhập chi tiết trước khi gửi tín hiệu.
 *
 * Bố cục từ Figma:
 *  1. Header: SENTINEL + back
 *  2. "LIVE GPS LOCK" badge + "Vị trí của bạn"
 *  3. Map card + địa chỉ
 *  4. "NHU CẦU KHẨN CẤP" — chọn loại: Cứu người / Y tế / Thực phẩm
 *  5. "MÔ TẢ NGẮN" text input
 *  6. "Chụp ảnh hiện trường (Tùy chọn)" button
 *  7. "GỬI SOS →" red button + blockchain notice
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';

import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../services/api';
import { BASE_URL } from '../../../services/apiClient';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

// ─── Loại nhu cầu khẩn cấp ───────────────────────────────────────────────────
const EMERGENCY_TYPES = [
  { id: 'rescue', label: 'Cứu người', icon: '🚨', color: COLORS.primary },
  { id: 'medical', label: 'Y tế', icon: '🏥', color: '#1565C0' },
  { id: 'food', label: 'Thực phẩm', icon: '🍽️', color: '#2E7D32' },
];

const SOSScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [selectedType, setSelectedType] = useState('rescue');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('Đang xác định vị trí...');
  const [image, setImage] = useState(null);
  const [signal_type, setSignalType] = useState('SOS');
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập bị từ chối', 'Ứng dụng cần quyền truy cập vị trí để gửi SOS chính xác.');
        return;
      }

      try {
        let loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(coords);

        // Lấy địa chỉ chi tiết
        let reverse = await Location.reverseGeocodeAsync(coords);
        if (reverse && reverse.length > 0) {
          const item = reverse[0];
          const addr = [
            item.name,
            item.street,
            item.district,
            item.city || item.region
          ].filter(Boolean).join(', ');
          setAddress(addr || 'Vị trí không xác định');
        }
      } catch (error) {
        console.error('Error fetching location:', error);
        setAddress('Không thể xác định vị trí');
      }
    })();
  }, []);

  const handleSend = async () => {
    if (!selectedType) {
      Alert.alert('Chọn loại khẩn cấp', 'Vui lòng chọn loại nhu cầu khẩn cấp trước khi gửi.');
      return;
    }

    if (!location) {
      Alert.alert('Lỗi vị trí', 'Vui lòng đợi ứng dụng xác định vị trí GPS của bạn.');
      return;
    }

    setLoading(true);
    try {
      // 1. Tạo bản ghi SOS chính qua API
      const sosData = {
      // 1. Phải gửi 'location_lng' thay vì 'location_lon'
      location_lat: location.latitude.toString(),
      location_lng: location.longitude.toString(), 
      
      // 2. Phải dùng 'note' thay vì 'description'
      note: description || `Yêu cầu hỗ trợ: ${EMERGENCY_TYPES.find(t => t.id === selectedType)?.label}`,
      
      // 3. 'signal_type' và 'emergency_type' (Backend đang có cả 2 trường này)
      signal_type: signal_type.toUpperCase(), 
      emergency_type: selectedType.toUpperCase(),
      
      // 4. Các trường khác nếu Backend yêu cầu (dựa trên Serializer)
      status: "PENDING",
      people_count: 1, // Giá trị mặc định
      citizen: userInfo?.id, // Gửi ID người dùng đã đăng nhập
    };


      const result = await API.sos.create(sosData);

      console.log(sosData)
      // 2. Tải ảnh lên nếu người dùng có chụp ảnh
      if (image && result.id) {
        const formData = new FormData();
        
        // Lấy tên file từ URI một cách an toàn
        const uriParts = image.split('/');
        const originalFileName = uriParts.pop();
        
        // Xác định đuôi file (mặc định là jpg nếu không tìm thấy)
        const extMatch = /\.(\w+)$/.exec(originalFileName);
        const fileExtension = extMatch ? extMatch[1].toLowerCase() : 'jpg';
        
        const fileName = `sos_photo_${Date.now()}.${fileExtension}`;
        const fileType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;

        formData.append('image', {
          uri: image,
          name: fileName,
          type: fileType,
        });

        // Mẹo: Log nội dung để kiểm tra trên thiết bị thật
        console.log("📤 Đang gửi ảnh:", { fileName, fileType, uri: image });
        
        await API.sos.uploadImages(result.id, formData);
        console.log('✅ Image uploaded successfully');
      }

      // 3. Điều hướng tới màn hình xác nhận sau khi thành công
      navigation.replace('SOSConfirmScreen', {
        emergencyType: selectedType,
        description,
        location: address,
        coords: location,
        sosId: result.id,
      });

    } catch (error) {
      console.error("❌ Lỗi gửi SOS:", error);
      // Hiển thị thông báo lỗi chi tiết để debug
      const errorMessage = error.data?.message || error.message || "Lỗi không xác định";
      Alert.alert(
        "Lỗi gửi SOS",
        `Chi tiết: ${errorMessage}\n\nVui lòng kiểm tra Server tại: ${BASE_URL}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Ứng dụng cần quyền camera để chụp ảnh hiện trường.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ─── 1. GPS badge + Title ───────────────────────────────────────── */}
        <View style={styles.gpsBadge}>
          <View style={styles.gpsDot} />
          <Text style={styles.gpsLabel}>ĐÃ XÁC THỰC GPS</Text>
          <Text style={styles.gpsIcon}>📡</Text>
        </View>

        <Text style={styles.sectionTitle}>Vị trí của bạn</Text>

        {/* ─── 2. Map card ────────────────────────────────────────────────── */}
        <View style={styles.mapContainer}>
          {location ? (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              customMapStyle={mapDarkStyle}
              region={{
                ...location,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={location} />
            </MapView>
          ) : (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.mapLoadingText}>Đang khóa mục tiêu GPS...</Text>
            </View>
          )}
          <View style={styles.mapBadge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>GPS TỨC THỜI</Text>
          </View>
        </View>

        {/* Địa chỉ text */}
        <View style={styles.addressRow}>
          <Text style={styles.addressIcon}>📍</Text>
          <Text style={styles.addressText}>
            {address}
          </Text>
        </View>

        {/* ─── 3. Nhu cầu khẩn cấp ───────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.base }]}>
          NHU CẦU KHẨN CẤP
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

        {/* ─── 4. Mô tả ngắn ──────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.base }]}>
          MÔ TẢ NGẮN
        </Text>

        <TextInput
          style={styles.textInput}
          placeholder="VD: Có 2 người mắc kẹt, nước đang dâng..."
          placeholderTextColor={COLORS.textHint}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={300}
        />

        {/* ─── 5. Chụp ảnh ────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.photoButton} onPress={handlePhoto} activeOpacity={0.8}>
          <Text style={styles.photoIcon}>📷</Text>
          <Text style={styles.photoLabel}>
            {image ? 'Đã chọn 1 ảnh' : 'Chụp ảnh hiện trường (Tùy chọn)'}
          </Text>
        </TouchableOpacity>

        {/* ─── 6. Nút GỬI SOS ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.sendButton, loading && { opacity: 0.7 }]}
          onPress={handleSend}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textWhite} />
          ) : (
            <Text style={styles.sendText}>GỬI SOS  ▶</Text>
          )}
        </TouchableOpacity>

        {/* Blockchain notice */}
        <View style={styles.blockchainNotice}>
          <Text style={styles.blockchainIcon}>⛓</Text>
          <Text style={styles.blockchainText}>
            Dữ liệu được mã hóa & xác thực blockchain
          </Text>
        </View>

      </ScrollView>
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
    paddingBottom: 32,
  },

  // ── GPS badge ──────────────────────────────────
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
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
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },

  // ── Map ────────────────────────────────────────
  mapCard: {
    marginBottom: SPACING.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.base,
    ...SHADOWS.card,
  },
  addressIcon: { fontSize: 14, marginTop: 1 },
  addressText: {
    flex: 1,
    fontSize: FONTS.base,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },

  // ── Emergency types ────────────────────────────
  emergencyGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.base,
  },
  emergencyCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgWhite,
    gap: 6,
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

  // ── Text input ─────────────────────────────────
  textInput: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONTS.base,
    color: COLORS.textPrimary,
    minHeight: 100,
    marginBottom: SPACING.base,
    ...SHADOWS.card,
  },

  // ── Photo button ───────────────────────────────
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    padding: SPACING.base,
    marginBottom: SPACING.lg,
  },
  photoIcon: { fontSize: 20 },
  photoLabel: {
    fontSize: FONTS.base,
    color: COLORS.textSecondary,
    fontWeight: FONTS.medium,
  },

  // ── Send button ────────────────────────────────
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.base + 2,
    alignItems: 'center',
    ...SHADOWS.sos,
    marginBottom: SPACING.md,
  },
  sendText: {
    color: COLORS.textWhite,
    fontSize: FONTS.lg,
    fontWeight: FONTS.bold,
    letterSpacing: 1,
  },

  // ── Blockchain notice ──────────────────────────
  blockchainNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  blockchainIcon: { fontSize: 12 },
  blockchainText: {
    fontSize: FONTS.xs,
    color: COLORS.textHint,
    textAlign: 'center',
  },

  // ── Map Container ──────────────────────────────
  mapContainer: {
    height: 170,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    backgroundColor: '#2C3E50',
    ...SHADOWS.card,
  },
  map: { flex: 1 },
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapLoadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FONTS.xs,
  },
  mapBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,20,33,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.statusGreen,
  },
  badgeText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    letterSpacing: 0.5,
  },
});

// Theme tối cho Map (Đồng bộ với MapScreen)
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
