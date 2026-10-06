/**
 * src/screens/rescuer/resources/ResourceDeclareScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Khai báo Nguồn lực.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Switch,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../../../components/common/AppMap';
import * as Location from 'expo-location';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const VEHICLES = ['Xe tải', 'Thuyền', 'Cano', 'Khác'];
const TYPES = [
  { code: 'RESCUE', label: 'Cứu hộ' },
  { code: 'FOOD', label: 'Thực phẩm' },
  { code: 'MEDICAL', label: 'Y tế' },
  { code: 'LOGISTICS', label: 'Hậu cần' },
  { code: 'COMMAND', label: 'Chỉ huy' },
];
const SUPPLIES = [
  { id: 'water', label: 'Nước uống', unit: 'thùng', initial: 0 },
  { id: 'medicine', label: 'Thuốc men', unit: 'hộp', initial: 0 },
  { id: 'rice', label: 'Lúa gạo/muối', unit: 'bao', initial: 0 },
  { id: 'food', label: 'Thực phẩm/mì', unit: 'thùng', initial: 0 },
  { id: 'life_jacket', label: 'Áo phao', unit: 'cái', initial: 0 },
];

const ResourceDeclareScreen = ({ navigation }) => {
  const [selectedVehicle, setSelectedVehicle] = useState('Xe tải');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [supplies, setSupplies] = useState(
    SUPPLIES.reduce((acc, s) => ({ ...acc, [s.id]: s.initial }), {})
  );
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [numberStaff, setNumberStaff] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [available, setAvailable] = useState(true);
  const [resourceState, setResourceState] = useState(null);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
  });

  const { userInfo } = useAuth();

  useEffect(() => {
    // 1. Tải thông tin tài nguyên hiện tại
    API.resources.current()
      .then((state) => {
        setResourceState(state);
        if (state.resource) {
          const r = state.resource;
          setSelectedVehicle(r.vehicle_type || 'Xe tải');
          setVehicleCount(r.vehicle_count || 0);
          setNumberStaff(r.number_staff || 1);
          setSelectedTypes(r.specialties || []);
          setSupplies((prev) => ({ ...prev, ...r.supplies }));
          setAvailable(r.is_available);
        }
      })
      .catch((e) => {
        setErrorMsg(e.message);
      });

    // 2. Lấy tọa độ GPS tức thì từ bộ đệm (0.05s) cho bản đồ
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Quyền truy cập vị trí bị từ chối');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
      if (lastKnown) {
        setLocation(lastKnown.coords);
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      if (loc) {
        setLocation(loc.coords);
      }
    })();
  }, []);

  const toggleType = (t) =>
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );

  const adjustQty = (id, delta) =>
    setSupplies(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));

  const handleConfirm = async () => {
    if (!userInfo?.id) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: 'Không tìm thấy thông tin cứu hộ viên.',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        vehicle_type: selectedVehicle,
        vehicle_count: vehicleCount,
        number_staff: numberStaff,
        specialties: selectedTypes,
        supplies,
        is_available: available,
      };

      await API.resources.save(payload);
      navigation.goBack();
    } catch (error) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi',
        message: error.message || 'Không thể ghi nhận nguồn lực',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Khai báo nguồn lực</Text>
        <Text style={styles.pageDesc}>
          Chỉ khai báo nguồn lực có thể triển khai ngay. Thông tin sẽ được trung tâm dùng khi điều phối nhiệm vụ.
        </Text>
        {resourceState?.reserved && (
          <View style={styles.integrityCard}>
            <Text style={styles.integrityTitle}>NGUỒN LỰC ĐANG ĐƯỢC PHÂN BỔ</Text>
            <Text style={styles.integrityDesc}>Kết thúc hoặc bàn giao nhiệm vụ trước khi thay đổi bản khai.</Text>
          </View>
        )}
        {!!errorMsg && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>{errorMsg}</Text>
          </View>
        )}

        {/* ── 01. Phương tiện ──────────────────────────────────────────────── */}
        <SectionLabel index="01" label="PHƯƠNG TIỆN VẬN CHUYỂN" />
        <View style={styles.chipRow}>
          {VEHICLES.map(v => (
            <TouchableOpacity
              disabled={resourceState?.reserved}
              key={v}
              activeOpacity={0.8}
              style={[styles.chip, selectedVehicle === v && styles.chipActive]}
              onPress={() => setSelectedVehicle(v)}
            >
              <Text style={[styles.chipText, selectedVehicle === v && styles.chipTextActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.staffCard}>
          <Text style={styles.staffLabel}>Số phương tiện sẵn sàng</Text>
          <View style={styles.counter}>
            <TouchableOpacity
              disabled={resourceState?.reserved}
              style={styles.counterBtn}
              onPress={() => setVehicleCount(v => Math.max(0, v - 1))}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{vehicleCount}</Text>
            <TouchableOpacity
              disabled={resourceState?.reserved}
              style={[styles.counterBtn, styles.counterBtnPlus]}
              onPress={() => setVehicleCount(v => v + 1)}
            >
              <Text style={[styles.counterBtnText, { color: '#FFF' }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 02. Chuyên môn ─────────────────────────────────────────── */}
        <SectionLabel index="02" label="CHUYÊN MÔN CỦA ĐỘI" />
        <View style={styles.typeList}>
          {TYPES.map(t => {
            const sel = selectedTypes.includes(t.code);
            return (
              <TouchableOpacity
                disabled={resourceState?.reserved}
                key={t.code}
                style={[styles.typeRow, sel && styles.typeRowActive]}
                onPress={() => toggleType(t.code)}
              >
                <Text style={[styles.typeText, sel && styles.typeTextActive]}>{t.label}</Text>
                {sel && <Text style={styles.typeCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── 03. Thành viên ─────────────────────────────────────────────────── */}
        <SectionLabel index="03" label="SỐ LƯỢNG THÀNH VIÊN TRONG NHÓM" />
        <View style={styles.staffCard}>
          <View style={styles.staffInfo}>
            <MaterialCommunityIcons name="account-group-outline" size={24} color="#666" />
            <View>
              <Text style={styles.staffLabel}>Nhân sự đi cùng</Text>
              <Text style={styles.staffSubLabel}>Bao gồm cả đội trưởng</Text>
            </View>
          </View>
          <View style={styles.counter}>
            <TouchableOpacity
              disabled={resourceState?.reserved}
              style={styles.counterBtn}
              onPress={() => setNumberStaff(prev => Math.max(1, prev - 1))}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{numberStaff}</Text>
            <TouchableOpacity
              disabled={resourceState?.reserved}
              style={[styles.counterBtn, styles.counterBtnPlus]}
              onPress={() => setNumberStaff(prev => prev + 1)}
            >
              <Text style={[styles.counterBtnText, { color: RCOLORS.textWhite }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 04. Hàng hóa ─────────────────────────────────────────────────── */}
        <SectionLabel index="04" label="HÀNG HÓA VÀ TIẾP TẾ" />
        <View style={styles.supplyList}>
          {SUPPLIES.map(item => (
            <View style={styles.supplyRow} key={item.id}>
              <Text style={styles.supplyLabel}>
                {item.label} ({item.unit})
              </Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  disabled={resourceState?.reserved}
                  style={styles.counterBtn}
                  onPress={() => adjustQty(item.id, -1)}
                >
                  <Text style={styles.counterBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{supplies[item.id]}</Text>
                <TouchableOpacity
                  disabled={resourceState?.reserved}
                  style={[styles.counterBtn, styles.counterBtnPlus]}
                  onPress={() => adjustQty(item.id, 1)}
                >
                  <Text style={[styles.counterBtnText, { color: '#FFF' }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.staffCard}>
          <View>
            <Text style={styles.staffLabel}>Sẵn sàng nhận nhiệm vụ</Text>
            <Text style={styles.staffSubLabel}>Tắt khi đội chưa thể triển khai</Text>
          </View>
          <Switch disabled={resourceState?.reserved} value={available} onValueChange={setAvailable} />
        </View>

        {/* ── Map preview ──────────────────────────────────────────────────── */}
        <View style={styles.mapPreview}>
          <View style={styles.mapContainer}>
            {location ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  title="Vị trí của bạn"
                />
              </MapView>
            ) : (
              <View style={styles.mapLoading}>
                <ActivityIndicator color={RCOLORS.primary} />
                <Text style={styles.mapLoadingText}>Đang xác định vị trí...</Text>
              </View>
            )}
            <View style={styles.mapOverlay}>
              <Text style={styles.mapZoneLabel}>
                {location
                  ? `Vị trí hiện tại: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                  : 'Đang tìm kiếm...'}
              </Text>
            </View>
          </View>
          <View style={styles.mapLiveRow}>
            <View style={styles.mapLiveDot} />
            <Text style={styles.mapLiveText}>VỊ TRÍ THỰC TẾ (GPS)</Text>
          </View>
        </View>

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleConfirm}
          disabled={loading || resourceState?.reserved}
        >
          {loading ? (
            <ActivityIndicator color={RCOLORS.textWhite} />
          ) : (
            <Text style={styles.submitText}>Xác nhận nguồn lực  →</Text>
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

const SectionLabel = ({ index, label }) => (
  <View style={slStyles.row}>
    <Text style={slStyles.index}>{index}.</Text>
    <Text style={slStyles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },
  pageTitle: { fontSize: RFONTS.xl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  pageDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },

  chipRow: { flexDirection: 'row', gap: RSPACING.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RRADIUS.md, borderWidth: 1.5, borderColor: RCOLORS.border, backgroundColor: RCOLORS.bgWhite },
  chipActive: { borderColor: RCOLORS.bgBlue, backgroundColor: RCOLORS.bgBlue },
  chipText: { fontSize: RFONTS.sm, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary },
  chipTextActive: { color: RCOLORS.textWhite },

  typeList: { gap: RSPACING.sm },
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, borderWidth: 1.5, borderColor: RCOLORS.border },
  typeRowActive: { borderColor: RCOLORS.primary, backgroundColor: RCOLORS.primaryLight },
  typeText: { fontSize: RFONTS.base, fontWeight: RFONTS.medium, color: RCOLORS.textPrimary },
  typeTextActive: { color: RCOLORS.primary, fontWeight: RFONTS.bold },
  typeCheck: { fontSize: 16, color: RCOLORS.primary },

  supplyList: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, overflow: 'hidden', ...RSHADOWS.card },
  supplyRow: { flexDirection: 'row', alignItems: 'center', padding: RSPACING.base, borderBottomWidth: 1, borderBottomColor: RCOLORS.border, gap: RSPACING.sm },
  supplyLabel: { flex: 1, fontSize: RFONTS.base, fontWeight: RFONTS.medium, color: RCOLORS.textPrimary },
  counter: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm },
  counterBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: RCOLORS.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnPlus: { backgroundColor: RCOLORS.primary, borderColor: RCOLORS.primary },
  counterBtnText: { fontSize: RFONTS.lg, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  counterValue: { fontSize: RFONTS.lg, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary, minWidth: 28, textAlign: 'center' },

  mapPreview: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, overflow: 'hidden', ...RSHADOWS.card },
  mapContainer: { height: 160, position: 'relative', backgroundColor: '#F3F4F6' },
  map: { ...StyleSheet.absoluteFillObject },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapLoadingText: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, fontWeight: RFONTS.medium },
  mapOverlay: { position: 'absolute', bottom: RSPACING.sm, left: RSPACING.sm, right: RSPACING.sm },
  mapZoneLabel: { color: RCOLORS.textWhite, fontSize: 10, fontWeight: RFONTS.bold, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RRADIUS.sm, alignSelf: 'flex-start' },
  mapLiveRow: { flexDirection: 'row', alignItems: 'center', padding: RSPACING.sm, gap: 6 },
  mapLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RCOLORS.statusGreen },
  mapLiveText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.statusGreen, letterSpacing: 1 },

  integrityCard: { backgroundColor: '#F0F4FF', borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm, borderWidth: 1, borderColor: '#DBEAFE' },
  warningCard: { backgroundColor: '#FFF3E0', borderRadius: RRADIUS.md, padding: RSPACING.md, borderWidth: 1, borderColor: '#FFE0B2' },
  warningText: { color: '#A45100', fontSize: RFONTS.sm, lineHeight: 18 },
  integrityTitle: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.bgBlue, letterSpacing: 1 },
  integrityDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },

  submitButton: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base + 2, alignItems: 'center', ...RSHADOWS.redGlow },
  submitButtonDisabled: { backgroundColor: RCOLORS.textHint, shadowOpacity: 0 },
  submitText: { color: RCOLORS.textWhite, fontSize: RFONTS.lg, fontWeight: RFONTS.bold },

  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: RCOLORS.bgWhite,
    borderRadius: RRADIUS.md,
    padding: RSPACING.base,
    ...RSHADOWS.card,
  },
  staffInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  staffLabel: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  staffSubLabel: { fontSize: 10, color: RCOLORS.textHint, fontWeight: RFONTS.medium },
});

const slStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  index: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.primary },
  label: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1 },
});

export default ResourceDeclareScreen;
