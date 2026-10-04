/**
 * src/screens/citizen/sos/SOSTrackingScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Theo Dõi Trực Tiếp Yêu Cầu SOS.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Linking, Platform, AppState, SafeAreaView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../../../components/common/AppMap';
import * as ImagePicker from 'expo-image-picker';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import CustomModal from '../../../components/common/CustomModal';
import API from '../../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

const STATUS = {
  PENDING: 'Chờ phân công đội cứu hộ',
  ACKNOWLEDGED: 'Đội cứu hộ đã tiếp nhận',
  IN_PROGRESS: 'Đội cứu hộ đang hỗ trợ',
  RESOLVED: 'Đã hoàn thành cứu hộ',
  CANCELLED: 'Đã hủy yêu cầu',
};

const VERIFY = {
  UNVERIFIED: 'Chưa xác minh',
  CHECKING: 'Đang xác minh',
  VERIFIED: 'Đã xác minh',
  INCORRECT: 'Thông tin không chính xác',
};

const VERIFY_COLOR = {
  UNVERIFIED: '#FB8C00',
  CHECKING: '#1565C0',
  VERIFIED: '#2E7D32',
  INCORRECT: '#C62828',
};

export default function SOSTrackingScreen({ navigation, route }) {
  const sosId = route?.params?.sosId;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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

  const load = async () => {
    if (!sosId) return setError('Thiếu mã yêu cầu SOS.');
    try {
      setData(await API.sos.getDetails(sosId));
      setError('');
    } catch (e) {
      setError(e.message || 'Không thể tải thông tin yêu cầu.');
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') load();
    }, 15000);
    return () => clearInterval(timer);
  }, [sosId]);

  const act = async (action) => {
    if (action !== 'confirmed' && !message.trim()) {
      showModal('warning', 'Cần nội dung', 'Vui lòng nhập ghi chú hoặc lý do trước khi gửi cập nhật.');
      return;
    }
    setBusy(true);
    try {
      setData(await API.sos.action(sosId, action, message.trim()));
      setMessage('');
      showModal('success', 'Đã cập nhật', 'Thông tin bổ sung của bạn đã được chuyển tới trung tâm.');
    } catch (e) {
      showModal('error', 'Chưa cập nhật được', e.message || 'Đã xảy ra lỗi.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    const choice = await ImagePicker.launchImageLibraryAsync({ quality: 0.65 });
    if (choice.canceled) return;
    setBusy(true);
    try {
      const photo = choice.assets[0];
      const form = new FormData();
      if (Platform.OS === 'web') form.append('image', await (await fetch(photo.uri)).blob(), 'scene.jpg');
      else form.append('image', { uri: photo.uri, name: photo.fileName || 'scene.jpg', type: photo.mimeType || 'image/jpeg' });
      await API.sos.uploadImages(sosId, form);
      await load();
      showModal('success', 'Tải ảnh thành công', 'Ảnh hiện trường đã được đính kèm.');
    } catch (e) {
      showModal('error', 'Chưa tải được ảnh', e.message);
    } finally {
      setBusy(false);
    }
  };

  let status = STATUS[data?.status] || 'Đang tải...';
  if (!['RESOLVED', 'CANCELLED'].includes(data?.status)) {
    if (data?.mission_status === 'PENDING_ACCEPTANCE') status = 'Chờ đội xác nhận nhiệm vụ';
    if (data?.mission_status === 'ON_MY_WAY') status = 'Đội cứu hộ đang cơ động tới vị trí';
  }

  const lat = Number(data?.location_lat);
  const lng = Number(data?.location_lng);
  const valid = Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Title */}
        <View style={styles.titleRow}>
          <View style={styles.pulseDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>THEO DÕI TRỰC TIẾP</Text>
            <Text style={styles.title}>Trạng Thái Cứu Hộ</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.refreshIcon}>↻</Text>
          </TouchableOpacity>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {data ? (
          <>
            {/* Status Card */}
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.statusStripe,
                  { backgroundColor: VERIFY_COLOR[data.verification_status] || '#FB8C00' },
                ]}
              />
              <View style={styles.statusBody}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: `${VERIFY_COLOR[data.verification_status] || '#FB8C00'}18` },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: VERIFY_COLOR[data.verification_status] || '#FB8C00' },
                    ]}
                  >
                    {VERIFY[data.verification_status] || 'Chưa xác minh'}
                  </Text>
                </View>

                <Text style={styles.statusTitle}>{status}</Text>
                <Text style={styles.mutedText}>
                  Cập nhật: {new Date(data.updated_at || data.sent_at).toLocaleString('vi-VN')}
                </Text>

                <View style={styles.lineDivider} />

                <Text style={styles.metaLabel}>MÃ THEO DÕI SOS</Text>
                <Text selectable style={styles.metaValue}>{data.id}</Text>
                <Text style={styles.infoText}>👥 Số người cần trợ giúp: {data.people_count} người</Text>
                {!!data.note && <Text style={styles.infoText}>📝 Ghi chú: {data.note}</Text>}
              </View>
            </View>

            {/* Map view */}
            {valid && (
              <View style={styles.mapWrap}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  scrollEnabled={false}
                >
                  <Marker coordinate={{ latitude: lat, longitude: lng }} title="Vị trí của bạn" />
                </MapView>
                <View style={styles.mapLabel}>
                  <Text style={styles.mapLabelText}>📍 {data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</Text>
                </View>
              </View>
            )}

            {/* Rescuer Card */}
            {data.assigned_rescuer && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Đội phụ trách cứu hộ</Text>
                <Text style={styles.rescuerName}>🚒 {data.assigned_rescuer.name}</Text>
                {!!data.assigned_rescuer.phone && (
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => Linking.openURL(`tel:${data.assigned_rescuer.phone}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.callBtnText}>📞 GỌI ĐỘI PHỤ TRÁCH ({data.assigned_rescuer.phone})</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Event History Timeline */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nhật ký xử lý hệ thống</Text>
              {!data.events?.length && <Text style={styles.mutedText}>Chưa có cập nhật mới.</Text>}
              {data.events?.map((e, i) => (
                <View key={e.id || i} style={styles.eventRow}>
                  <View
                    style={[
                      styles.eventDot,
                      i === (data.events.length - 1) && { backgroundColor: COLORS.primary },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTime}>
                      {new Date(e.created_at).toLocaleString('vi-VN')}
                    </Text>
                    <Text style={styles.eventMessage}>{e.message}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Citizen Feedback Form */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cập nhật thông tin từ người gửi</Text>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                multiline
                placeholder="Bổ sung thông tin hiện trường, diễn biến nước dâng hoặc phản hồi..."
                placeholderTextColor={COLORS.textHint}
              />

              {!['RESOLVED', 'CANCELLED'].includes(data.status) && (
                <>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    disabled={busy}
                    onPress={() => act('update')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryBtnText}>GỬI THÔNG TIN BỔ SUNG</Text>
                  </TouchableOpacity>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.secondaryBtn, { flex: 1 }]}
                      onPress={upload}
                      disabled={busy}
                    >
                      <Text style={styles.secondaryBtnText}>📷 THÊM ẢNH</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dangerOutlineBtn, { flex: 1 }]}
                      onPress={() => act('worsened')}
                      disabled={busy}
                    >
                      <Text style={styles.dangerBtnText}>🚨 KHẨN CẤP HƠN</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => act('cancel')}
                    disabled={busy}
                  >
                    <Text style={styles.secondaryBtnText}>HỦY YÊU CẦU (KHÔNG CẦN GIÚP NỮA)</Text>
                  </TouchableOpacity>
                </>
              )}

              {data.status === 'RESOLVED' && (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1 }]}
                    onPress={() => act('confirmed')}
                  >
                    <Text style={styles.primaryBtnText}>✓ ĐÃ ĐƯỢC HỖ TRỢ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dangerOutlineBtn, { flex: 1 }]}
                    onPress={() => act('still_need_help')}
                  >
                    <Text style={styles.dangerBtnText}>⚠ VẪN CẦN GIÚP</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        ) : (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
        )}
      </ScrollView>

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
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgLight },
  content: { padding: LAYOUT.screenPadding, paddingBottom: 36, gap: SPACING.md },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.statusGreen },
  kicker: { fontSize: 11, fontWeight: '800', color: COLORS.statusGreen, letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgWhite,
  },
  refreshIcon: { fontSize: 20, color: COLORS.textPrimary },

  errorBox: { padding: 12, borderRadius: RADIUS.md, backgroundColor: '#FFEBEE' },
  errorText: { color: COLORS.primary, fontSize: 13 },

  statusCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    ...SHADOWS.card,
  },
  statusStripe: { width: 6 },
  statusBody: { padding: 16, flex: 1, gap: 8 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  statusTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary },
  mutedText: { fontSize: 12, color: COLORS.textHint },
  lineDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  metaLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textHint, letterSpacing: 1 },
  metaValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  mapWrap: { height: 160, borderRadius: 16, overflow: 'hidden', ...SHADOWS.card },
  mapLabel: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(13,20,33,0.85)',
    padding: 8,
    borderRadius: 8,
  },
  mapLabelText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  card: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary },
  rescuerName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  callBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  callBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },

  eventRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border, marginTop: 5 },
  eventTime: { fontSize: 11, fontWeight: '700', color: COLORS.textHint },
  eventMessage: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  input: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  secondaryBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  secondaryBtnText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  dangerOutlineBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8 },
});
