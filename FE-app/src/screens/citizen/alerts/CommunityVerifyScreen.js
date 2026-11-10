import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator, TextInput, Image, Platform,
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

const VERIFY_OPTIONS = [
  {
    id: 'CONFIRM_DANGER',
    label: 'Đúng, đang nguy hiểm',
    sub: 'Xác nhận đoạn đường này đang ngập / có chướng ngại (Gia hạn cảnh báo thêm 6h)',
    icon: 'alert-circle',
    color: '#DC2626',
    bgColor: '#FEF2F2',
  },
  {
    id: 'WORSENED',
    label: 'Đang nặng thêm',
    sub: 'Nước đang dâng cao hơn hoặc lan rộng thêm',
    icon: 'trending-up',
    color: '#EA580C',
    bgColor: '#FFF7ED',
  },
  {
    id: 'RECEDING',
    label: 'Nước đang rút (Vẫn còn ngập)',
    sub: 'Mực nước đang hạ dần nhưng đường vẫn còn ngập nhẹ / bùn lầy',
    icon: 'trending-down',
    color: '#D97706',
    bgColor: '#FFFBEB',
  },
  {
    id: 'CLEARED',
    label: 'Đường đã thông (Hết nguy hiểm)',
    sub: 'Nước đã rút cạn / Đã dọn xong chướng ngại, xe cộ đi lại bình thường',
    icon: 'checkmark-circle',
    color: '#16A34A',
    bgColor: '#F0FDF4',
  },
  {
    id: 'FALSE_REPORT',
    label: 'Báo cáo sai',
    sub: 'Không có sự cố tại đoạn đường này',
    icon: 'close-circle',
    color: '#64748B',
    bgColor: '#F8FAFC',
  },
];

const WATER_QUICK_OPTIONS = [
  { cm: 0,   label: '0cm (Đã rút)' },
  { cm: 15,  label: '15cm (Mắt cá)' },
  { cm: 45,  label: '45cm (Đầu gối)' },
  { cm: 80,  label: '80cm (Yên xe)' },
  { cm: 120, label: '>120cm (Ngập sâu)' },
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

const formatRemainingTime = (mins, status) => {
  if (mins === null || mins === undefined) return '';
  if (mins <= 0) return 'Đã hết thời hạn (tự ẩn)';
  if (status === 'CLEARED') return `Hiển thị thông đường thêm ${mins} phút rồi tự ẩn`;
  if (mins < 60) return `Tự ẩn sau ${mins} phút nếu không ai vote thêm`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `Tự ẩn sau ${h}h${m > 0 ? `${m}p` : ''} nếu không có vote mới`;
};

const CommunityVerifyScreen = ({ navigation, route }) => {
  const { reportId, alertId } = route.params || {};
  const targetId = reportId || alertId;
  const isFieldReport = Boolean(reportId || !alertId);

  const { userInfo, userRole } = useAuth();

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userGps, setUserGps] = useState(null);
  const [selectedVerdict, setSelectedVerdict] = useState('CONFIRM_DANGER');
  const [note, setNote] = useState('');
  const [waterLevelCm, setWaterLevelCm] = useState(null);
  const [votePhoto, setVotePhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Đồng ý',
    onConfirm: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserGps({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch {}
    })();
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      if (isFieldReport) {
        const data = await API.fieldReports.getDetails(targetId);
        setReportData(data);
        if (data?.my_active_vote?.verdict) {
          setSelectedVerdict(data.my_active_vote.verdict);
        }
      } else {
        try {
          const data = await API.fieldReports.getDetails(targetId);
          setReportData(data);
          if (data?.my_active_vote?.verdict) {
            setSelectedVerdict(data.my_active_vote.verdict);
          }
        } catch {
          const alertData = await API.alerts.getDetails(targetId, route.params?.location || {});
          setReportData(alertData);
        }
      }
    } catch (e) {
      console.log('Fetch verify detail error:', e);
    } finally {
      setLoading(false);
    }
  }, [targetId, isFieldReport]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

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
        name: `vote_photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      };
    } catch {
      return {
        uri: asset.uri,
        name: asset.fileName || `vote_photo_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      };
    }
  };

  const handlePickPhoto = async (fromCamera = false) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setModalConfig({
          visible: true,
          type: 'warning',
          title: 'Cần cấp quyền',
          message: 'Vui lòng cấp quyền truy cập máy ảnh / thư viện ảnh để đính kèm ảnh hiện trường.',
        });
        return;
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

      if (!res.canceled && res.assets?.[0]) {
        const compressed = await compressImage(res.assets[0]);
        setVotePhoto(compressed);
      }
    } catch (e) {
      console.log('Vote photo error:', e);
    }
  };

  const handleAdminToggleHide = async () => {
    if (!reportData?.id) return;
    try {
      setSubmitting(true);
      const nextVerdict = reportData.is_hidden ? 'UNHIDE' : 'HIDE';
      const updated = await API.fieldReports.vote(reportData.id, {
        verdict: nextVerdict,
        voter_role: userRole === 'ADMIN' ? 'ADMIN' : 'RESCUER',
      });
      setReportData(updated);
      setModalConfig({
        visible: true,
        type: 'success',
        title: updated.is_hidden ? '✓ Đã ẩn đoạn đường khỏi bản đồ' : '✓ Đã hiện lại đoạn đường',
        message: updated.is_hidden
          ? 'Đoạn đường này đã được ẩn khỏi Bản đồ công khai và mở khóa lại lộ trình dẫn đường.'
          : 'Đoạn đường đã được hiển thị trở lại trên bản đồ cảnh báo.',
      });
    } catch (e) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: e?.message || 'Không thể cập nhật trạng thái hiển thị.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedVerdict) {
      setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Chọn đánh giá',
        message: 'Vui lòng chọn một trạng thái xác nhận hiện trường.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const voterId = await getOrCreateDeviceVoterId();
      const voterName = userInfo?.full_name || userInfo?.username || 'Người dân địa phương';
      const effectiveRole =
        userRole === 'ADMIN' ? 'ADMIN' : userRole === 'RESCUER' ? 'RESCUER' : 'CITIZEN';

      if (reportData?.hazard_type) {
        const formData = new FormData();
        formData.append('verdict', selectedVerdict);
        formData.append('note', note.trim());
        formData.append('voter_name', voterName);
        formData.append('voter_id', voterId);
        formData.append('voter_role', effectiveRole);
        if (waterLevelCm !== null && waterLevelCm !== undefined) {
          formData.append('water_level_cm', String(waterLevelCm));
        }

        if (votePhoto && votePhoto.uri) {
          if (Platform.OS === 'web') {
            try {
              const resp = await fetch(votePhoto.uri);
              const blob = await resp.blob();
              formData.append('image', blob, votePhoto.name || 'vote_photo.jpg');
            } catch {}
          } else {
            formData.append('image', {
              uri: votePhoto.uri,
              name: votePhoto.name || 'vote_photo.jpg',
              type: votePhoto.type || 'image/jpeg',
            });
          }
        }

        const updated = await API.fieldReports.vote(reportData.id, formData);
        setReportData(updated);
        setNote('');
        setVotePhoto(null);

        const statusMsg =
          updated.reopened
            ? `Đã mở lại Đợt sự cố #${updated.incident_wave} tại đoạn đường này (Ngập/sự cố trở lại)!`
            : updated.status === 'CLEARED'
            ? 'Đoạn đường đã được đánh dấu ĐƯỜNG ĐÃ THÔNG (sẽ hiển thị màu xanh 60 phút rồi tự ẩn).'
            : updated.status === 'RECEDING'
            ? 'Đã cập nhật trạng thái NƯỚC ĐANG RÚT (vẫn còn ngập nhẹ, tiếp tục theo dõi đến khi đường thông hẳn).'
            : updated.is_verified
            ? `Đoạn đường đã được ĐÓNG DẤU XÁC THỰC (${updated.report_count} phiếu hiện hành, tự động gia hạn thêm 6 giờ)!`
            : 'Phản hồi hiện hành và ảnh/ghi chú của bạn đã được lưu vào nhật ký đoạn đường.';

        setModalConfig({
          visible: true,
          type: 'success',
          title: '✓ Đã lưu phản hồi & ảnh xác thực',
          message: statusMsg,
        });
      } else if (alertId) {
        const legacyMap = {
          CONFIRM_DANGER: 'TRUE',
          WORSENED: 'STILL_DANGER',
          RECEDING: 'STILL_DANGER',
          CLEARED: 'RESCUED',
          FALSE_REPORT: 'FALSE',
        };
        await API.alerts.vote(alertId, {
          verdict: legacyMap[selectedVerdict] || 'TRUE',
          user: userInfo?.id,
        }, route.params?.location || {});
        await fetchDetail();
        setModalConfig({
          visible: true,
          type: 'success',
          title: '✓ Đã gửi xác nhận',
          message: 'Cảm ơn bạn đã đóng góp thông tin xác thực hiện trường.',
        });
      }
    } catch (e) {
      const msg = e?.message || e?.data?.error || 'Không thể gửi phản hồi. Vui lòng thử lại.';
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getVerdictBadge = (verdict) => {
    switch (verdict) {
      case 'CONFIRM_DANGER':
      case 'TRUE':
        return { label: 'Đúng, còn nguy hiểm', color: '#DC2626', bg: '#FEE2E2' };
      case 'WORSENED':
      case 'STILL_DANGER':
        return { label: 'Đang nặng thêm', color: '#EA580C', bg: '#FFEDD5' };
      case 'RECEDING':
        return { label: 'Nước đang rút (Còn ngập)', color: '#D97706', bg: '#FEF3C7' };
      case 'CLEARED':
      case 'RESCUED':
        return { label: 'Đường đã thông', color: '#15803D', bg: '#DCFCE7' };
      case 'FALSE_REPORT':
      case 'FALSE':
        return { label: 'Báo cáo sai', color: '#475569', bg: '#E2E8F0' };
      default:
        return { label: verdict, color: '#334155', bg: '#F1F5F9' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <SentinelHeader showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textSecondary }}>Đang tải thông tin đoạn đường...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCleared = reportData?.status === 'CLEARED';
  const isReceding = reportData?.status === 'RECEDING';
  const isVerified = reportData?.is_verified;
  const votesList = reportData?.votes || [];
  const isStaff = userRole === 'ADMIN' || userRole === 'RESCUER';

  // Dựng tọa độ Polyline đoạn đường được tô màu để người vote nhìn thấy rõ đang vote cho đoạn nào
  const roadPoly = Array.isArray(reportData?.road_geometry)
    ? reportData.road_geometry
        .map((pt) => ({
          latitude: Number(Array.isArray(pt) ? pt[0] : pt.lat),
          longitude: Number(Array.isArray(pt) ? pt[1] : pt.lng),
        }))
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    : [];

  const centerLat = Number(reportData?.location_lat);
  const centerLng = Number(reportData?.location_lng);
  const hasMapCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);

  const distFromUserM =
    userGps && hasMapCenter
      ? Math.round(haversineMeters(userGps.latitude, userGps.longitude, centerLat, centerLng))
      : null;

  const strokeColor = isCleared
    ? '#16A34A'
    : isReceding
    ? '#D97706'
    : isVerified
    ? '#DC2626'
    : '#EA580C';

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Thông tin & Bản đồ đoạn đường đang được tô màu */}
        {reportData && (
          <View style={styles.infoCard}>
            <View style={styles.statusRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                {reportData.is_hidden && (
                  <View style={[styles.statusBadge, { backgroundColor: '#E2E8F0' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#334155' }]}>
                      👁️‍🗨️ ĐÃ ẨN KHỎI BẢN ĐỒ
                    </Text>
                  </View>
                )}
                {isCleared ? (
                  <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#15803D' }]}>
                      ✅ ĐƯỜNG ĐÃ THÔNG
                    </Text>
                  </View>
                ) : isReceding ? (
                  <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>
                      🌊 NƯỚC ĐANG RÚT (CÒN NGẬP NHẸ)
                    </Text>
                  </View>
                ) : isVerified ? (
                  <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#DC2626' }]}>
                      ✓ ĐÃ XÁC THỰC (+{reportData.report_count || 2})
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>
                      ⏳ CHỜ CỘNG ĐỒNG XÁC NHẬN
                    </Text>
                  </View>
                )}
                {distFromUserM !== null && (
                  <View style={[styles.statusBadge, { backgroundColor: '#E0F2FE' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#0369A1' }]}>
                      📍 Cách bạn {distFromUserM < 1000 ? `${distFromUserM}m` : `${(distFromUserM / 1000).toFixed(1)}km`}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.timeText}>{formatTime(reportData.created_at)}</Text>
            </View>

            <Text style={styles.reportTitle}>
              {reportData.hazard_display || reportData.title || 'Đoạn đường cảnh báo'}
              {reportData.water_level_cm > 0 ? ` — Ngập ${reportData.water_level_cm}cm` : ''}
            </Text>

            {reportData.address ? (
              <Text style={styles.addressText}>🛣️ Đoạn đường: {reportData.address}</Text>
            ) : (
              <Text style={styles.addressText}>
                📍 Tọa độ: {Number(reportData.location_lat).toFixed(5)}, {Number(reportData.location_lng).toFixed(5)}
              </Text>
            )}

            {/* Thời hạn tự động ẩn nếu không có ai vote thêm */}
            {reportData.remaining_minutes !== null && reportData.remaining_minutes !== undefined && (
              <View style={styles.ttlBanner}>
                <Ionicons name="time-outline" size={15} color="#0369A1" />
                <Text style={styles.ttlText}>
                  {formatRemainingTime(reportData.remaining_minutes, reportData.status)}
                </Text>
              </View>
            )}

            {/* Bản đồ nhỏ hiển thị trực quan đoạn đường đang được tô màu */}
            {hasMapCenter && (
              <View style={styles.miniMapWrap}>
                <MapView
                  style={styles.miniMap}
                  initialRegion={{
                    latitude: centerLat,
                    longitude: centerLng,
                    latitudeDelta: 0.004,
                    longitudeDelta: 0.004,
                  }}
                >
                  {roadPoly.length >= 2 && (
                    <>
                      <Polyline
                        coordinates={roadPoly}
                        strokeColor="#FFFFFF"
                        strokeWidth={9}
                      />
                      <Polyline
                        coordinates={roadPoly}
                        strokeColor={strokeColor}
                        strokeWidth={6}
                      />
                    </>
                  )}
                  <Marker coordinate={{ latitude: centerLat, longitude: centerLng }}>
                    <View style={[styles.roadCenterPin, { backgroundColor: strokeColor }]}>
                      <Text style={{ fontSize: 12 }}>
                        {isCleared ? '✅' : reportData.hazard_type === 'FLOOD' ? '🌊' : '🚧'}
                      </Text>
                    </View>
                  </Marker>
                </MapView>
                <View style={styles.miniMapFooter}>
                  <Text style={styles.miniMapFooterText}>
                    Đoạn đường tô màu dài ~{reportData.segment_length_m || 150}m · Báo bởi: {reportData.reporter_name || 'Người dân'}
                  </Text>
                </View>
              </View>
            )}

            {/* Ảnh hiện trường của báo cáo gốc (nếu có) */}
            {reportData.image_url ? (
              <View style={styles.reportPhotoWrap}>
                <Image
                  source={{ uri: reportData.image_url }}
                  style={styles.reportPhoto}
                  resizeMode="cover"
                />
                <View style={styles.reportPhotoCaption}>
                  <Ionicons name="camera" size={13} color="#FFF" />
                  <Text style={styles.reportPhotoCaptionText}>Ảnh hiện trường đoạn đường</Text>
                </View>
              </View>
            ) : null}

            {reportData.description ? (
              <View style={styles.descBox}>
                <Text style={styles.descLabel}>Mô tả hiện trường:</Text>
                <Text style={styles.descText}>{reportData.description}</Text>
              </View>
            ) : null}

            {/* Nút dành riêng cho Admin / Đội cứu hộ: Ẩn ngay đoạn đường nếu thấy sai hoặc đã hết */}
            {isStaff && (
              <TouchableOpacity
                style={[
                  styles.adminHideBtn,
                  reportData.is_hidden && { backgroundColor: '#0284C7', borderColor: '#0284C7' },
                ]}
                onPress={handleAdminToggleHide}
                disabled={submitting}
              >
                <Ionicons
                  name={reportData.is_hidden ? 'eye-outline' : 'eye-off-outline'}
                  size={17}
                  color="#FFF"
                />
                <Text style={styles.adminHideBtnText}>
                  {reportData.is_hidden
                    ? 'HIỆN LẠI ĐOẠN ĐƯỜNG TRÊN BẢN ĐỒ'
                    : 'ẨN ĐOẠN ĐƯỜNG NÀY KHỎI BẢN ĐỒ (QUYỀN QUẢN TRỊ)'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Thống kê nhanh lượt vote hiện hành */}
            {reportData.vote_summary && (
              <View style={styles.summaryStrip}>
                <View style={styles.summaryPill}>
                  <Text style={[styles.summaryNum, { color: '#DC2626' }]}>
                    {reportData.vote_summary.confirm_count}
                  </Text>
                  <Text style={styles.summaryLbl}>Đang nguy hiểm</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryPill}>
                  <Text style={[styles.summaryNum, { color: '#D97706' }]}>
                    {reportData.vote_summary.receding_count || 0}
                  </Text>
                  <Text style={styles.summaryLbl}>Nước đang rút</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryPill}>
                  <Text style={[styles.summaryNum, { color: '#16A34A' }]}>
                    {reportData.vote_summary.cleared_count}
                  </Text>
                  <Text style={styles.summaryLbl}>Đường đã thông</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryPill}>
                  <Text style={[styles.summaryNum, { color: '#64748B' }]}>
                    {reportData.vote_summary.false_count}
                  </Text>
                  <Text style={styles.summaryLbl}>Báo sai</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 2. Form Gửi Vote, Đính kèm Ảnh & Ghi chú */}
        <View style={styles.verifySection}>
          <Text style={styles.verifyTitle}>Xác nhận tình trạng đoạn đường</Text>
          <Text style={styles.verifySubtitle}>
            Mỗi người tính 1 phiếu hiện hành. Khi có thêm phiếu xác nhận đang ngập, thời hạn hiển thị đoạn đường sẽ được tự động gia hạn thêm 6 giờ.
          </Text>

          <View style={styles.optionsList}>
            {VERIFY_OPTIONS.map((opt) => {
              const isSelected = selectedVerdict === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: isSelected ? opt.color : opt.bgColor,
                      borderColor: opt.color,
                    },
                  ]}
                  onPress={() => {
                    setSelectedVerdict(opt.id);
                    if (opt.id === 'CLEARED') setWaterLevelCm(0);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={isSelected ? '#FFF' : opt.color}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: isSelected ? '#FFF' : opt.color }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.optionSub, { color: isSelected ? '#F1F5F9' : '#64748B' }]}>
                      {opt.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Chọn nhanh mức nước cập nhật (tùy chọn) */}
          {reportData?.hazard_type === 'FLOOD' && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.inputLabel}>Cập nhật mức nước hiện tại (tùy chọn):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {WATER_QUICK_OPTIONS.map((w) => {
                  const active = waterLevelCm === w.cm;
                  return (
                    <TouchableOpacity
                      key={w.cm}
                      style={[
                        styles.waterChip,
                        active && { backgroundColor: '#0284C7', borderColor: '#0284C7' },
                      ]}
                      onPress={() => setWaterLevelCm(active ? null : w.cm)}
                    >
                      <Text style={[styles.waterChipText, active && { color: '#FFF' }]}>
                        {w.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Đính kèm ảnh thực tế khi Vote */}
          <Text style={styles.inputLabel}>Ảnh chụp thực tế khi xác nhận (tùy chọn):</Text>
          <View style={styles.photoActionRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={() => handlePickPhoto(true)}>
              <Ionicons name="camera" size={17} color="#0284C7" />
              <Text style={styles.photoBtnText}>Chụp ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={() => handlePickPhoto(false)}>
              <Ionicons name="images" size={17} color="#0284C7" />
              <Text style={styles.photoBtnText}>Chọn ảnh</Text>
            </TouchableOpacity>
          </View>

          {votePhoto && (
            <View style={styles.votePhotoPreviewWrap}>
              <Image source={{ uri: votePhoto.uri }} style={styles.votePhotoPreview} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => setVotePhoto(null)}
              >
                <Ionicons name="close-circle" size={24} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}

          {/* Ô nhập ghi chú kèm theo của người vote */}
          <Text style={styles.inputLabel}>Ghi chú thực tế của bạn (nếu có):</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="VD: Nước đã rút xuống mắt cá chân, xe máy đi qua được rồi / Cây vẫn chắn ngang chưa dọn..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            value={note}
            onChangeText={setNote}
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitText}>GỬI XÁC NHẬN HIỆN TRƯỜNG</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Danh sách những người đã Vote, Ảnh & Ghi chú kèm theo */}
        <View style={styles.voteSummaryCard}>
          <Text style={styles.voteSummaryTitle}>
            Nhật ký Người dân & Cứu hộ xác nhận ({votesList.length})
          </Text>

          {votesList.length === 0 ? (
            <Text style={{ color: '#64748B', fontSize: 13 }}>Chưa có phản hồi nào.</Text>
          ) : (
            votesList.map((v) => {
              const badge = getVerdictBadge(v.verdict);
              const isOfficial = v.voter_role === 'RESCUER' || v.voter_role === 'ADMIN';
              const isActive = v.is_active_vote !== false;
              return (
                <View key={v.id} style={[styles.voteCard, !isActive && { opacity: 0.72 }]}>
                  <View style={styles.voteHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                      <Text style={styles.voteUser}>
                        👤 {v.voter_name || v.user_name || 'Người dân'}
                      </Text>
                      {isOfficial && (
                        <View style={styles.roleBadge}>
                          <Text style={styles.roleBadgeText}>
                            {v.voter_role === 'RESCUER' ? 'ĐỘI CỨU HỘ' : 'BAN CHỈ HUY'}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.roleBadge,
                          { backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            { color: isActive ? '#15803D' : '#64748B' },
                          ]}
                        >
                          {isActive ? 'PHIẾU HIỆN HÀNH' : 'LỊCH SỬ CŨ'}
                        </Text>
                      </View>
                      {v.incident_wave > 1 && (
                        <View style={[styles.roleBadge, { backgroundColor: '#E0F2FE' }]}>
                          <Text style={[styles.roleBadgeText, { color: '#0369A1' }]}>
                            ĐỢT #{v.incident_wave}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.voteTime}>{formatTime(v.voted_at)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <View style={[styles.verdictTag, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.verdictTagText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                    {v.water_level_cm !== null && v.water_level_cm !== undefined && (
                      <Text style={styles.waterTag}>🌊 Mức nước: {v.water_level_cm}cm</Text>
                    )}
                  </View>

                  {v.image_url ? (
                    <Image
                      source={{ uri: v.image_url }}
                      style={styles.voteItemImage}
                      resizeMode="cover"
                    />
                  ) : null}

                  {v.note ? (
                    <View style={styles.voteNoteBox}>
                      <Text style={styles.voteNoteText}>"{v.note}"</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

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
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  content: {
    padding: SPACING.base,
    paddingBottom: 36,
    gap: SPACING.md,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    ...SHADOWS.card,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 8,
  },
  ttlBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  ttlText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
    flex: 1,
  },
  miniMapWrap: {
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 12,
  },
  miniMap: {
    width: '100%',
    height: 170,
  },
  miniMapFooter: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  miniMapFooterText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  roadCenterPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportPhotoWrap: {
    position: 'relative',
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportPhoto: {
    width: '100%',
    height: 190,
  },
  reportPhotoCaption: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportPhotoCaptionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  descBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
    marginBottom: 12,
  },
  descLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  descText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
  },
  adminHideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#334155',
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    marginBottom: 12,
  },
  adminHideBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryPill: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLbl: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  verifySection: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    ...SHADOWS.card,
  },
  verifyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  verifySubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  optionsList: {
    gap: 8,
    marginBottom: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  optionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  waterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  waterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
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
    paddingVertical: 9,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  votePhotoPreviewWrap: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  votePhotoPreview: {
    width: '100%',
    height: 160,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.sm,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  submitButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: RADIUS.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  voteSummaryCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    ...SHADOWS.card,
  },
  voteSummaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  voteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  voteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voteUser: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  voteTime: {
    fontSize: 11,
    color: '#64748B',
  },
  verdictTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  verdictTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  waterTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
  },
  voteItemImage: {
    width: '100%',
    height: 155,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#E2E8F0',
  },
  voteNoteBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  voteNoteText: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

export default CommunityVerifyScreen;
