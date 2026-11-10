import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from '../../../components/common/AppMap';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import CustomModal from '../../../components/common/CustomModal';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../constants/citizen/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const VOTER_STORAGE_KEY = '@citizen_voter_device_id';

const HAZARD_TYPES = [
  { id: 'FLOOD',        label: 'Ngập lụt',          icon: '🌊', color: '#0284C7', bg: '#E0F2FE' },
  { id: 'FALLEN_TREE',  label: 'Cây đổ chắn đường', icon: '🌲', color: '#15803D', bg: '#DCFCE7' },
  { id: 'LANDSLIDE',    label: 'Sạt lở đất đá',     icon: '⛰️', color: '#B45309', bg: '#FEF3C7' },
  { id: 'POWER_LINE',   label: 'Dây điện đứt',      icon: '⚡', color: '#DC2626', bg: '#FEE2E2' },
  { id: 'ROAD_BLOCKED', label: 'Đường chia cắt',    icon: '🚧', color: '#7C3AED', bg: '#EDE9FE' },
];

const WATER_LEVELS = [
  { cm: 15,  label: 'Mắt cá (~15cm)',      desc: 'Xe máy đi chậm được',        color: '#16A34A', bg: '#F0FDF4' },
  { cm: 45,  label: 'Ngang gối (~45cm)',   desc: 'Xe máy dễ chết máy',         color: '#D97706', bg: '#FFFBEB' },
  { cm: 80,  label: 'Ngang yên (~80cm)',   desc: 'Chỉ xe gầm cao / xuồng qua', color: '#DC2626', bg: '#FEF2E2' },
  { cm: 120, label: 'Ngập sâu (>120cm)',   desc: 'Nguy hiểm cao, cấm đi qua',  color: '#7F1D1D', bg: '#FEE2E2' },
];

const getOrCreateDeviceVoterId = async () => {
  try {
    let id = await AsyncStorage.getItem(VOTER_STORAGE_KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      await AsyncStorage.setItem(VOTER_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
};

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatRemainingTime = (mins) => {
  if (mins === null || mins === undefined) return '';
  if (mins <= 0) return 'Sắp tự ẩn';
  if (mins < 60) return `Tự ẩn sau ${mins}p nếu không ai vote thêm`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `Tự ẩn sau ${h}h${m > 0 ? `${m}p` : ''} nếu không ai vote thêm`;
};

export default function FieldReportScreen({ navigation }) {
  const { userInfo } = useAuth();
  const mapRef = useRef(null);

  const [hazardType, setHazardType] = useState('FLOOD');
  const [waterLevelCm, setWaterLevelCm] = useState(45);
  const [userGps, setUserGps] = useState(null);          // Vị trí GPS thực của người dùng để đo khoảng cách
  const [coords, setCoords] = useState(null);            // Tâm đoạn đường đang được chọn / tô màu
  const [roadGeometry, setRoadGeometry] = useState([]);  // Polyline đoạn đường tự động tô màu
  const [segmentLengthM, setSegmentLengthM] = useState(0);
  const [locLoading, setLocLoading] = useState(true);
  const [roadPreviewLoading, setRoadPreviewLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);              // Ảnh hiện trường đính kèm
  const [submitting, setSubmitting] = useState(false);
  const [recentReports, setRecentReports] = useState([]);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Đồng ý',
    onConfirm: null,
  });

  useEffect(() => {
    fetchLocation();
    loadRecentReports();
  }, []);

  const previewRoadOnMap = async ({ lat, lng, query, keepTypedAddress = false }) => {
    try {
      setRoadPreviewLoading(true);
      const params = {};
      if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        params.lat = lat;
        params.lng = lng;
      }
      if (query) {
        params.road_query = query;
      }

      const info = await API.fieldReports.previewRoad(params);
      if (info && Array.isArray(info.road_geometry) && info.road_geometry.length >= 2) {
        const poly = info.road_geometry
          .map((pt) => ({
            latitude: Number(Array.isArray(pt) ? pt[0] : pt.lat),
            longitude: Number(Array.isArray(pt) ? pt[1] : pt.lng),
          }))
          .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

        setRoadGeometry(poly);
        setSegmentLengthM(info.segment_length_m || 150);

        const cLat = Number(info.center_lat || (poly[Math.floor(poly.length / 2)]?.latitude) || lat);
        const cLng = Number(info.center_lng || (poly[Math.floor(poly.length / 2)]?.longitude) || lng);
        if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
          const newCenter = { latitude: cLat, longitude: cLng };
          setCoords(newCenter);
          mapRef.current?.animateToRegion(
            {
              latitude: cLat,
              longitude: cLng,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            },
            350
          );
        }

        if (info.road_name && (!keepTypedAddress || !address.trim())) {
          setAddress(info.road_name);
        }
      }
    } catch (e) {
      console.log('Preview road segment error:', e?.message);
      if (query && !lat) {
        setModalConfig({
          visible: true,
          type: 'warning',
          title: 'Chưa tìm thấy tên đường này',
          message: 'Hãy nhập rõ tên đường kèm quận/thành phố (VD: "Đường Hàm Nghi, Đà Nẵng") hoặc chạm trực tiếp vào đoạn đường trên bản đồ.',
        });
      }
    } finally {
      setRoadPreviewLoading(false);
    }
  };

  const fetchLocation = async () => {
    try {
      setLocLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const currentCoords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserGps(currentCoords);
      setCoords(currentCoords);

      // Tự động nhận diện & tô màu đoạn đường tại vị trí GPS hiện tại luôn
      await previewRoadOnMap({
        lat: currentCoords.latitude,
        lng: currentCoords.longitude,
      });

      const geo = await Location.reverseGeocodeAsync(currentCoords).catch(() => null);
      if (geo && geo.length > 0) {
        const g = geo[0];
        const parts = [g.name || g.street, g.subregion || g.district, g.region || g.city].filter(Boolean);
        if (parts.length > 0) {
          setAddress((prev) => prev || parts.join(', '));
        }
      }
    } catch (e) {
      console.log('FieldReport GPS error:', e);
    } finally {
      setLocLoading(false);
    }
  };

  const handleSearchRoadByName = async () => {
    const q = address.trim();
    if (!q) {
      setModalConfig({
        visible: true,
        type: 'info',
        title: 'Nhập tên đoạn đường',
        message: 'Vui lòng nhập tên đoạn đường bạn muốn báo cáo (VD: "Đường Nguyễn Văn Linh, Đà Nẵng").',
      });
      return;
    }
    await previewRoadOnMap({
      query: q,
      lat: userGps?.latitude || coords?.latitude,
      lng: userGps?.longitude || coords?.longitude,
      keepTypedAddress: false,
    });
  };

  const handleMapTap = async (e) => {
    const tapped = e?.nativeEvent?.coordinate;
    if (!tapped) return;
    setCoords(tapped);
    await previewRoadOnMap({
      lat: tapped.latitude,
      lng: tapped.longitude,
      keepTypedAddress: false,
    });
  };

  const compressImage = async (asset) => {
    try {
      const actions = [];
      if (asset.width && asset.width > 1280) {
        actions.push({ resize: { width: 1280 } });
      }
      const manip = await ImageManipulator.manipulateAsync(
        asset.uri,
        actions,
        { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
      );
      return {
        uri: manip.uri,
        name: `road_report_${Date.now()}.jpg`,
        type: 'image/jpeg',
      };
    } catch {
      return {
        uri: asset.uri,
        name: asset.fileName || `road_report_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      };
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setModalConfig({
          visible: true,
          type: 'warning',
          title: 'Cần quyền truy cập ảnh',
          message: 'Vui lòng cấp quyền thư viện ảnh để đính kèm hình ảnh hiện trường.',
        });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.[0]) {
        const compressed = await compressImage(res.assets[0]);
        setPhoto(compressed);
      }
    } catch (e) {
      console.log('Pick image error:', e);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setModalConfig({
          visible: true,
          type: 'warning',
          title: 'Cần quyền máy ảnh',
          message: 'Vui lòng cấp quyền máy ảnh để chụp trực tiếp đoạn đường sự cố.',
        });
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.[0]) {
        const compressed = await compressImage(res.assets[0]);
        setPhoto(compressed);
      }
    } catch (e) {
      console.log('Camera error:', e);
    }
  };

  const loadRecentReports = async () => {
    try {
      const res = await API.fieldReports.getAll({ limit: 25 });
      if (res && res.results) {
        setRecentReports(res.results);
      }
    } catch (e) {
      console.log('Load recent field reports error:', e);
    }
  };

  const handleSubmit = async () => {
    if (!coords && !address.trim()) {
      setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Thiếu thông tin đoạn đường',
        message: 'Vui lòng nhập tên đoạn đường hoặc bật định vị GPS để hệ thống tự tô màu đoạn đường sự cố.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const voterId = await getOrCreateDeviceVoterId();
      const reporterName = userInfo?.full_name || userInfo?.username || 'Người dân';

      const formData = new FormData();
      formData.append('reporter_name', reporterName);
      formData.append('voter_id', voterId);
      formData.append('hazard_type', hazardType);
      formData.append('water_level_cm', String(hazardType === 'FLOOD' ? waterLevelCm : 0));
      if (coords) {
        formData.append('location_lat', String(coords.latitude));
        formData.append('location_lng', String(coords.longitude));
      }
      formData.append('address', address.trim());
      formData.append('description', description.trim());

      if (photo && photo.uri) {
        if (Platform.OS === 'web') {
          try {
            const resp = await fetch(photo.uri);
            const blob = await resp.blob();
            formData.append('image', blob, photo.name || 'road_report.jpg');
          } catch {}
        } else {
          formData.append('image', {
            uri: photo.uri,
            name: photo.name || 'road_report.jpg',
            type: photo.type || 'image/jpeg',
          });
        }
      }

      const res = await API.fieldReports.create(formData);

      if (res && res.corroborated) {
        setModalConfig({
          visible: true,
          type: 'success',
          title: '✓ Đã gộp & xác minh đoạn đường!',
          message: `Đã có người báo sự cố trên cùng đoạn đường này (cách ${res.distance_merged_m || 20}m). Báo cáo của bạn đã được gộp vào để nâng cảnh báo lên ĐÃ XÁC THỰC (${res.report_count} người xác nhận)!`,
          confirmText: 'Xem chi tiết & Vote',
          onConfirm: () => {
            setModalConfig((prev) => ({ ...prev, visible: false }));
            navigation.navigate('CommunityVerifyScreen', { reportId: res.id });
          },
        });
      } else {
        setModalConfig({
          visible: true,
          type: 'success',
          title: '✓ Đã tô màu & cảnh báo đoạn đường!',
          message: `Đoạn đường "${res?.address || address || 'Sự cố'}" (~${res?.segment_length_m || segmentLengthM || 150}m) đã được tô màu trên Bản đồ chung. Nếu sau thời hạn không có ai vote thêm hoặc đường đã thông, hệ thống sẽ tự động ẩn đi.`,
          confirmText: 'Xem chi tiết đoạn đường',
          onConfirm: () => {
            setModalConfig((prev) => ({ ...prev, visible: false }));
            navigation.navigate('CommunityVerifyScreen', { reportId: res.id });
          },
        });
      }
      setPhoto(null);
      setDescription('');
      loadRecentReports();
    } catch (e) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Không thể gửi báo cáo',
        message: e?.message || 'Đã xảy ra lỗi kết nối. Vui lòng thử lại.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Tính khoảng cách từ vị trí người dân tới các đoạn đường báo cáo và xếp gần nhất lên đầu
  const refPos = userGps || coords;
  const sortedReports = [...recentReports]
    .map((rep) => {
      const distM =
        refPos && rep.location_lat && rep.location_lng
          ? Math.round(
              haversineMeters(
                refPos.latitude,
                refPos.longitude,
                Number(rep.location_lat),
                Number(rep.location_lng)
              )
            )
          : null;
      return { ...rep, _distM: distM };
    })
    .sort((a, b) => {
      if (a._distM !== null && b._distM !== null) return a._distM - b._distM;
      return 0;
    });

  const activeHazardObj = HAZARD_TYPES.find((h) => h.id === hazardType) || HAZARD_TYPES[0];

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Banner tiêu đề */}
          <View style={styles.headerBanner}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>TỰ ĐỘNG TÔ MÀU ĐOẠN ĐƯỜNG · REAL-TIME</Text>
            </View>
            <Text style={styles.headerTitle}>Báo Đoạn Đường Sự Cố</Text>
            <Text style={styles.headerDesc}>
              Chỉ cần nhập tên đoạn đường (hoặc dùng vị trí GPS hiện tại), hệ thống sẽ tự động nhận diện và tô màu đoạn đường đó trên bản đồ chung.
            </Text>
          </View>

          {/* Bước 1: Nhập tên đoạn đường hoặc Tự động nhận diện từ GPS */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.stepLabel}>1. TÊN ĐOẠN ĐƯỜNG SỰ CỐ</Text>
              <TouchableOpacity onPress={fetchLocation} style={styles.refreshGpsBtn}>
                <Ionicons name="locate" size={15} color="#1D4ED8" />
                <Text style={styles.refreshGpsText}>Đường tôi đang đứng</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchRoadRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Nhập tên đường (VD: Đường Hàm Nghi, Đà Nẵng)..."
                placeholderTextColor="#94A3B8"
                value={address}
                onChangeText={setAddress}
                returnKeyType="search"
                onSubmitEditing={handleSearchRoadByName}
              />
              <TouchableOpacity
                style={styles.searchRoadBtn}
                onPress={handleSearchRoadByName}
                disabled={roadPreviewLoading}
                activeOpacity={0.85}
              >
                {roadPreviewLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="color-wand" size={16} color="#FFF" />
                    <Text style={styles.searchRoadBtnText}>Tô màu đường</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {coords && (
              <View style={styles.miniMapWrap}>
                <MapView
                  ref={mapRef}
                  style={styles.miniMap}
                  initialRegion={{
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    latitudeDelta: 0.0042,
                    longitudeDelta: 0.0042,
                  }}
                  onPress={handleMapTap}
                >
                  {roadGeometry.length >= 2 && (
                    <>
                      <Polyline
                        coordinates={roadGeometry}
                        strokeColor="#FFFFFF"
                        strokeWidth={10}
                      />
                      <Polyline
                        coordinates={roadGeometry}
                        strokeColor={activeHazardObj.color || '#DC2626'}
                        strokeWidth={6}
                      />
                    </>
                  )}
                  <Marker coordinate={coords} title={address || 'Đoạn đường sự cố'}>
                    <View style={[styles.roadCenterPin, { backgroundColor: activeHazardObj.color || '#DC2626' }]}>
                      <Text style={{ fontSize: 13 }}>{activeHazardObj.icon}</Text>
                    </View>
                  </Marker>
                </MapView>
                <View style={styles.miniMapHintBar}>
                  <Text style={styles.miniMapHintText}>
                    {roadGeometry.length >= 2
                      ? `✓ Đã tự động tô màu đoạn đường (~${segmentLengthM || 150}m). Bạn cũng có thể chạm 1 lần vào đường khác trên bản đồ để đổi.`
                      : '💡 Nhập tên đường rồi bấm "Tô màu đường", hoặc chạm 1 lần vào con đường trên bản đồ.'}
                  </Text>
                </View>
              </View>
            )}

            {locLoading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <ActivityIndicator size="small" color="#1D4ED8" />
                <Text style={styles.gpsText}>Đang tự động nhận diện đoạn đường từ GPS...</Text>
              </View>
            )}
          </View>

          {/* Bước 2: Chọn loại sự cố */}
          <View style={styles.sectionCard}>
            <Text style={styles.stepLabel}>2. LOẠI SỰ CỐ TRÊN ĐƯỜNG</Text>
            <View style={styles.hazardGrid}>
              {HAZARD_TYPES.map((h) => {
                const active = hazardType === h.id;
                return (
                  <TouchableOpacity
                    key={h.id}
                    style={[
                      styles.hazardCard,
                      { backgroundColor: active ? h.color : h.bg, borderColor: h.color },
                    ]}
                    onPress={() => setHazardType(h.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.hazardIcon}>{h.icon}</Text>
                    <Text style={[styles.hazardLabel, { color: active ? '#FFF' : h.color }]}>
                      {h.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Bước 3: Chọn mức nước (nếu là Ngập lụt) */}
          {hazardType === 'FLOOD' && (
            <View style={styles.sectionCard}>
              <Text style={styles.stepLabel}>3. ƯỚC LƯỢNG MỨC NƯỚC NGẬP</Text>
              <View style={styles.waterGrid}>
                {WATER_LEVELS.map((w) => {
                  const active = waterLevelCm === w.cm;
                  return (
                    <TouchableOpacity
                      key={w.cm}
                      style={[
                        styles.waterCard,
                        {
                          backgroundColor: active ? w.color : w.bg,
                          borderColor: w.color,
                        },
                      ]}
                      onPress={() => setWaterLevelCm(w.cm)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.waterTitle, { color: active ? '#FFF' : w.color }]}>
                        {w.label}
                      </Text>
                      <Text style={[styles.waterDesc, { color: active ? '#F8FAFC' : '#475569' }]}>
                        {w.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Bước 4: Ảnh hiện trường & Ghi chú thực tế */}
          <View style={styles.sectionCard}>
            <Text style={styles.stepLabel}>
              {hazardType === 'FLOOD' ? '4. ẢNH HIỆN TRƯỜNG & GHI CHÚ (TÙY CHỌN)' : '3. ẢNH HIỆN TRƯỜNG & GHI CHÚ (TÙY CHỌN)'}
            </Text>

            <View style={styles.photoActionRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
                <Ionicons name="camera" size={18} color="#0284C7" />
                <Text style={styles.photoBtnText}>Chụp ảnh hiện trường</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={handlePickFromGallery} activeOpacity={0.85}>
                <Ionicons name="images" size={18} color="#0284C7" />
                <Text style={styles.photoBtnText}>Chọn từ thư viện</Text>
              </TouchableOpacity>
            </View>

            {photo && (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => setPhoto(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Mô tả thêm: Nước chảy xiết không? Xe máy có đi qua được không? Cây đổ chắn mấy làn đường?..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#FFF" />
                  <Text style={styles.submitBtnText}>GỬI BÁO CÁO & TÔ MÀU ĐOẠN ĐƯỜNG</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Danh sách báo cáo gần đây để bấm vào Vote / Báo nước rút */}
          {sortedReports.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.stepLabel}>
                ĐOẠN ĐƯỜNG ĐANG CẢNH BÁO GẦN BẠN ({sortedReports.length}) — BẤM ĐỂ VOTE
              </Text>
              {sortedReports.map((rep) => {
                const isCleared = rep.status === 'CLEARED';
                const isReceding = rep.status === 'RECEDING';
                const distLabel =
                  rep._distM !== null
                    ? rep._distM < 1000
                      ? `Cách ${rep._distM}m`
                      : `Cách ${(rep._distM / 1000).toFixed(1)}km`
                    : null;

                return (
                  <TouchableOpacity
                    key={rep.id}
                    style={[
                      styles.reportItem,
                      isCleared && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
                      isReceding && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                    ]}
                    onPress={() => navigation.navigate('CommunityVerifyScreen', { reportId: rep.id })}
                  >
                    {rep.image_url ? (
                      <Image
                        source={{ uri: rep.image_url }}
                        style={styles.reportItemThumb}
                        resizeMode="cover"
                      />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <Text style={styles.reportItemTitle}>
                          {rep.hazard_display} {rep.water_level_cm > 0 ? `(${rep.water_level_cm}cm)` : ''}
                        </Text>
                        {isCleared ? (
                          <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803D' }}>
                              ✓ ĐÃ THÔNG ĐƯỜNG
                            </Text>
                          </View>
                        ) : isReceding ? (
                          <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>
                              🌊 NƯỚC ĐANG RÚT
                            </Text>
                          </View>
                        ) : rep.is_verified ? (
                          <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>
                              ✓ ĐÃ XÁC THỰC (+{rep.report_count})
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>
                              ⏳ CHỜ XÁC NHẬN
                            </Text>
                          </View>
                        )}
                        {distLabel && (
                          <View style={[styles.statusBadge, { backgroundColor: '#E0F2FE' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#0369A1' }}>
                              📍 {distLabel}
                            </Text>
                          </View>
                        )}
                      </View>
                      {rep.address ? (
                        <Text style={styles.reportItemAddress}>🛣️ {rep.address}</Text>
                      ) : null}
                      {rep.description ? (
                        <Text style={styles.reportItemDesc} numberOfLines={2}>
                          💬 {rep.description}
                        </Text>
                      ) : null}
                      <Text style={styles.reportItemMeta}>
                        👤 {rep.reporter_name} · {rep.votes?.length || 1} phiếu
                        {rep.remaining_minutes !== null && rep.remaining_minutes !== undefined
                          ? ` · ⏳ ${formatRemainingTime(rep.remaining_minutes)}`
                          : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#64748B" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        onConfirm={modalConfig.onConfirm || (() => setModalConfig((prev) => ({ ...prev, visible: false })))}
        onCancel={() => setModalConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  content: {
    padding: SPACING.base,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  headerBanner: {
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: 8,
  },
  headerBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  headerDesc: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    ...SHADOWS.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  refreshGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  refreshGpsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  searchRoadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchRoadBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchRoadBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  miniMapWrap: {
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 6,
  },
  miniMap: {
    width: '100%',
    height: 185,
  },
  miniMapHintBar: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  miniMapHintText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
  },
  roadCenterPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  gpsText: {
    fontSize: 12,
    color: '#475569',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  photoPreviewWrap: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoPreview: {
    width: '100%',
    height: 170,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  hazardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hazardCard: {
    width: '48%',
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 6,
  },
  hazardIcon: {
    fontSize: 24,
  },
  hazardLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  waterGrid: {
    gap: 8,
  },
  waterCard: {
    borderRadius: RADIUS.sm,
    padding: 12,
    borderWidth: 1.5,
  },
  waterTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  waterDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#EA580C',
    borderRadius: RADIUS.sm,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 8,
  },
  reportItemThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  reportItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  reportItemAddress: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginBottom: 2,
  },
  reportItemDesc: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 4,
  },
  reportItemMeta: {
    fontSize: 11,
    color: '#64748B',
  },
});
