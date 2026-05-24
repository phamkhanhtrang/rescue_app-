/**
 * src/screens/rescuer/resources/ResourceDeclareScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Khai báo Nguồn lực (Screen 3).
 *
 * Bố cục từ Figma:
 *  1. Header back + AI ASSISTED MATCHING badge
 *  2. "Khai báo nguồn lực" title + mô tả
 *  3. 01. PHƯƠNG TIỆN VẬN CHUYỂN: Truck / Boat / Canoe (chip selector)
 *  4. 02. LOẠI HÌNH HỖ TRỢ: Rescue / Food / Medical (chip selector, multi)
 *  5. 03. HÀNG HÓA & TIẾP TẾ: Water / Medicine / Lúa gạo (số lượng +/-)
 *  6. Map preview: "Đường Bình - Zone A4"
 *  7. INTEGRITY CHECK section
 *  8. "Xác nhận nguồn lực →" red button
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const VEHICLES = ['Xe tải', ' Thuyền', 'Cano'];
const TYPES = ['Cứu hộ', 'Thực phẩm', 'Y tế'];
const SUPPLIES = [
  { id: 'water', label: 'Nước uống', unit: 'thùng', initial: 15 },
  { id: 'medicine', label: 'Thuốc men', unit: 'hộp', initial: 0 },
  { id: 'rice', label: 'Lúa gạo/muối', unit: 'bao', initial: 5 },
];

const ResourceDeclareScreen = ({ navigation }) => {
  const [selectedVehicle, setSelectedVehicle] = useState('Xe tải');
  const [selectedTypes, setSelectedTypes] = useState(['Cứu hộ']);
  const [supplies, setSupplies] = useState(
    SUPPLIES.reduce((acc, s) => ({ ...acc, [s.id]: s.initial }), {})
  );
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [numberStaff, setNumberStaff] = useState(1);
  const [loading, setLoading] = useState(false);

  const { userInfo } = useAuth();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Quyền truy cập vị trí bị từ chối');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
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
      Alert.alert('Lỗi', 'Không tìm thấy thông tin cứu hộ viên.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        rescuer: userInfo.id,
        vehicle_type: selectedVehicle,
        number_staff: numberStaff,
        is_available: true
      };

      await API.resources.create(payload);

      Alert.alert('Thành công', 'Thông tin nguồn lực đã được ghi nhận.');
      navigation.goBack();
    } catch (error) {
      console.error("Lỗi khai báo nguồn lực:", error);
      Alert.alert('Lỗi', 'Không thể lưu thông tin nguồn lực. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* AI Matched badge */}
        {/* <View style={styles.aiBadge}>
          <Text style={styles.aiDot}>●</Text>
          <Text style={styles.aiBadgeText}>GHÉP CẶP HỖ TRỢ AI</Text>
        </View> */}

        <Text style={styles.pageTitle}>Khai báo nguồn lực</Text>
        <Text style={styles.pageDesc}>
          Thông tin của bạn sẽ được AI phân phối đến các điểm đang cần hỗ trợ nhất.
        </Text>

        {/* ── 01. Phương tiện ──────────────────────────────────────────────── */}
        <SectionLabel index="01" label="PHƯƠNG TIỆN VẬN CHUYỂN" />
        <View style={styles.chipRow}>
          {VEHICLES.map(v => (
            <TouchableOpacity
              key={v} activeOpacity={0.8}
              style={[styles.chip, selectedVehicle === v && styles.chipActive]}
              onPress={() => setSelectedVehicle(v)}
            >
              <Text style={[styles.chipText, selectedVehicle === v && styles.chipTextActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 02. Loại hình hỗ trợ ─────────────────────────────────────────── */}
        {/* <SectionLabel index="02" label="LOẠI HÌNH HỖ TRỢ" />
        <View style={styles.typeList}>
          {TYPES.map(t => {
            const sel = selectedTypes.includes(t);
            return (
              <TouchableOpacity key={t} style={[styles.typeRow, sel && styles.typeRowActive]} onPress={() => toggleType(t)}>
                <Text style={[styles.typeText, sel && styles.typeTextActive]}>{t}</Text>
                {sel && <Text style={styles.typeCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View> */}

        {/* ── 02. Thành viên ─────────────────────────────────────────────────── */}
        <SectionLabel index="02" label="SỐ LƯỢNG THÀNH VIÊN TRONG NHÓM" />
        <View style={styles.staffCard}>
          <View style={styles.staffInfo}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={24}
              color="#666"
            />
            <View>
              <Text style={styles.staffLabel}>Nhân sự đi cùng</Text>
              <Text style={styles.staffSubLabel}>Bao gồm cả đội trưởng</Text>
            </View>
          </View>
          <View style={styles.counter}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setNumberStaff(prev => Math.max(1, prev - 1))}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{numberStaff}</Text>
            <TouchableOpacity
              style={[styles.counterBtn, styles.counterBtnPlus]}
              onPress={() => setNumberStaff(prev => prev + 1)}
            >
              <Text style={[styles.counterBtnText, { color: RCOLORS.textWhite }]}>+</Text>
            </TouchableOpacity>
          </View>
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
                {location ? `Vị trí hiện tại: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Đang tìm kiếm...'}
              </Text>
            </View>
          </View>
          <View style={styles.mapLiveRow}>
            <View style={styles.mapLiveDot} />
            <Text style={styles.mapLiveText}>VỊ TRÍ THỰC TẾ (GPS)</Text>
          </View>
        </View>

        {/* ── Integrity check ───────────────────────────────────────────────── */}
        {/* <View style={styles.integrityCard}>
          <Text style={styles.integrityTitle}>KIỂM TRA TÍNH TOÀN VẸN</Text>
          <Text style={styles.integrityDesc}>
            Thông tin sẽ được xác minh và đối chiếu trên các điểm điều phối lân cận trước khi triển khai.
          </Text>
          <View style={styles.integrityBadge}>
            <Text style={styles.integrityBadgeText}>⛓ Blockchain · Xác thực · Minh bạch</Text>
          </View>
        </View> */}

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={RCOLORS.textWhite} />
          ) : (
            <Text style={styles.submitText}>Xác nhận nguồn lực  →</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
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
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E3F2FD', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RRADIUS.full },
  aiDot: { fontSize: 8, color: RCOLORS.bgBlue },
  aiBadgeText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.bgBlue, letterSpacing: 0.5 },
  pageTitle: { fontSize: RFONTS.xl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  pageDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },

  // Chips
  chipRow: { flexDirection: 'row', gap: RSPACING.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RRADIUS.md, borderWidth: 1.5, borderColor: RCOLORS.border, backgroundColor: RCOLORS.bgWhite },
  chipActive: { borderColor: RCOLORS.bgBlue, backgroundColor: RCOLORS.bgBlue },
  chipText: { fontSize: RFONTS.sm, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary },
  chipTextActive: { color: RCOLORS.textWhite },

  // Types
  typeList: { gap: RSPACING.sm },
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, borderWidth: 1.5, borderColor: RCOLORS.border },
  typeRowActive: { borderColor: RCOLORS.primary, backgroundColor: RCOLORS.primaryLight },
  typeText: { fontSize: RFONTS.base, fontWeight: RFONTS.medium, color: RCOLORS.textPrimary },
  typeTextActive: { color: RCOLORS.primary, fontWeight: RFONTS.bold },
  typeCheck: { fontSize: 16, color: RCOLORS.primary },

  // Supplies
  supplyList: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, overflow: 'hidden', ...RSHADOWS.card },
  supplyRow: { flexDirection: 'row', alignItems: 'center', padding: RSPACING.base, borderBottomWidth: 1, borderBottomColor: RCOLORS.border, gap: RSPACING.sm },
  supplyIcon: { fontSize: 18 },
  supplyLabel: { flex: 1, fontSize: RFONTS.base, fontWeight: RFONTS.medium, color: RCOLORS.textPrimary },
  counter: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm },
  counterBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: RCOLORS.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnPlus: { backgroundColor: RCOLORS.primary, borderColor: RCOLORS.primary },
  counterBtnText: { fontSize: RFONTS.lg, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  counterValue: { fontSize: RFONTS.lg, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary, minWidth: 28, textAlign: 'center' },

  // Map preview
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

  // Integrity
  integrityCard: { backgroundColor: '#F0F4FF', borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm, borderWidth: 1, borderColor: '#DBEAFE' },
  integrityTitle: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.bgBlue, letterSpacing: 1 },
  integrityDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  integrityBadge: { alignSelf: 'flex-start', backgroundColor: RCOLORS.bgBlue, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  integrityBadgeText: { color: RCOLORS.textWhite, fontSize: RFONTS.xs, fontWeight: RFONTS.bold },

  submitButton: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base + 2, alignItems: 'center', ...RSHADOWS.redGlow },
  submitButtonDisabled: { backgroundColor: RCOLORS.textHint, shadowOpacity: 0 },
  submitText: { color: RCOLORS.textWhite, fontSize: RFONTS.lg, fontWeight: RFONTS.bold },

  // Staff card
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
  staffEmoji: { fontSize: 24 },
  staffLabel: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  staffSubLabel: { fontSize: 10, color: RCOLORS.textHint, fontWeight: RFONTS.medium },
});

const slStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  index: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.primary },
  label: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1 },
});

export default ResourceDeclareScreen;
