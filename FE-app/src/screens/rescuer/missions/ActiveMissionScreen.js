/**
 * src/screens/rescuer/missions/ActiveMissionScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Đang thực hiện Nhiệm vụ (Screen 9).
 * Thiết kế Tác chiến Thực địa (Tactical Field Hub):
 *  - Thanh tiến trình 4 giai đoạn rõ ràng: Nhận lệnh -> Di chuyển -> Tác chiến -> Hoàn tất.
 *  - Nút hành động chính kích thước lớn (>=48px) dễ bấm khi găng tay ướt/mưa.
 *  - Thẻ từng điểm SOS: Hiển thị số người, nút Gọi điện trực tiếp, Dẫn đường GPS.
 *  - Bộ đếm tiếp tế (Stepper -/+) chống nhầm lẫn, không cần gõ bàn phím số phức tạp.
 *  - Báo động khẩn cấp (Panic Alert) gửi chi viện tức thời về BCH.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, TextInput, AppState,
  ActivityIndicator, Linking, Modal, Pressable,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import {
  RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT,
} from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const MISSION_STEPS = [
  { key: 'PENDING_ACCEPTANCE', label: 'Nhận lệnh', icon: 'clipboard-check-outline' },
  { key: 'ACCEPTED', label: 'Chuẩn bị', icon: 'account-clock-outline' },
  { key: 'ON_MY_WAY', label: 'Di chuyển', icon: 'run-fast' },
  { key: 'ACTIVE', label: 'Tác chiến', icon: 'shield-alert-outline' },
  { key: 'COMPLETED', label: 'Hoàn tất', icon: 'check-circle-outline' },
];

const STATUS_TEXT = {
  PENDING_ACCEPTANCE: 'Chờ nhận lệnh',
  ACCEPTED: 'Đã nhận nhiệm vụ',
  ON_MY_WAY: 'Đang di chuyển đến hiện trường',
  ACTIVE: 'Đang tác chiến tại hiện trường',
  NEEDS_HELP: '🚨 CẦN CHI VIỆN KHẨN CẤP',
  COMPLETED: 'Nhiệm vụ đã hoàn thành',
  CANCELLED: 'Đã bàn giao / Hủy',
};

const SUPPLY_LABELS = {
  water: 'Nước sạch',
  food: 'Lương thực / Mì gói',
  medicine: 'Thuốc men y tế',
  life_jacket: 'Áo phao cứu sinh',
  rice: 'Gạo & Muối',
};

const SUPPLY_PRESETS = ['Áo phao', 'Xuồng cao su', 'Nước uống', 'Lương khô', 'Túi sơ cấp cứu'];

const parseSosDetails = (sos) => {
  let phone = sos?.contact_phone || sos?.phone || null;
  let address = sos?.address || null;
  let name = null;

  if (sos?.note) {
    if (!phone) {
      const pMatch = sos.note.match(/(?:SĐT|SDT|Điện thoại|Phone|Tel)?[:\s]*([0-9]{9,11})/i);
      if (pMatch) phone = pMatch[1];
    }
    if (!address || address.includes('chưa có địa chỉ chi tiết')) {
      const aMatch = sos.note.match(/Địa chỉ[:\s]*([^|\]]+)/i);
      if (aMatch && aMatch[1].trim()) address = aMatch[1].trim();
    }
    const nMatch = sos.note.match(/Tên[:\s]*([^|\]]+)/i);
    if (nMatch && nMatch[1].trim()) name = nMatch[1].trim();
  }

  return {
    phone,
    address: address || 'Hiện trường chưa có địa chỉ chi tiết',
    name,
  };
};

const ActiveMissionScreen = ({ navigation, route }) => {
  const { userInfo } = useAuth();
  const [mission, setMission] = useState(null);
  const [currentZone, setCurrentZone] = useState(null);
  const [availableSos, setAvailableSos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Giao hàng draft theo từng SOS: { [sosId]: { [itemKey]: quantityNumber } }
  const [deliveryDrafts, setDeliveryDrafts] = useState({});

  // Báo cáo / Ghi chú nhanh
  const [note, setNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null); // { type: 'resolve_sos' | 'leave' | 'needs_help', id?: string }

  // Yêu cầu chi viện vật tư
  const [supportType, setSupportType] = useState('');
  const [supportQty, setSupportQty] = useState(1);
  const [showSupportSection, setShowSupportSection] = useState(false);

  // Custom Modal feedback
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const rawZoneName = mission?.zone_name || (mission && !mission.zone ? 'Điểm SOS Đơn Lẻ' : route?.params?.zoneName) || 'Khu vực cứu hộ';
  const zoneName = rawZoneName.includes('Zone AI')
    ? (currentZone?.description && !currentZone.description.includes('ngoài vùng tập trung')
        ? `Khu vực ${currentZone.description}`
        : rawZoneName.replace(/Zone AI/i, 'Vùng cứu hộ trọng điểm'))
    : rawZoneName;
  const sosSignals = mission?.sos || [];

  const fetchData = async () => {
    try {
      let id = route?.params?.missionId;
      if (!id) {
        const rows = await API.missions.getAll({ rescuer_id: userInfo?.id });
        id = rows.results?.find(m => !['COMPLETED', 'CANCELLED'].includes(m.status))?.id;
      }
      if (!id) {
        setMission(null);
        return;
      }
      const m = await API.missions.getDetails(id);
      setMission(m);

      if (m.zone) {
        const [zoneData, zoneSos] = await Promise.all([
          API.zones.getDetails(m.zone).catch(() => null),
          API.sos.getAll({ zone: m.zone }).catch(() => ({ results: [] })),
        ]);
        setCurrentZone(zoneData);
        setAvailableSos((zoneSos.results || []).filter(s =>
          !s.assigned_mission &&
          !['RESOLVED', 'CANCELLED'].includes(s.status) &&
          s.verification_status !== 'INCORRECT'
        ));
      } else {
        const directSos = m.sos?.[0];
        setCurrentZone(directSos ? {
          id: 'direct',
          name: directSos.address || 'SOS đơn lẻ',
          location_lat: directSos.location_lat,
          location_lng: directSos.location_lng,
        } : null);
        setAvailableSos([]);
      }
    } catch (e) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi tải nhiệm vụ',
        message: e.message || 'Không thể đồng bộ dữ liệu nhiệm vụ từ máy chủ.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [route?.params?.missionId, userInfo?.id]);

  // Polling đồng bộ trạng thái khi đang tác chiến
  useEffect(() => {
    if (!mission || ['COMPLETED', 'CANCELLED'].includes(mission.status)) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') fetchData();
    }, 10000);
    return () => clearInterval(timer);
  }, [mission?.id, mission?.status, route?.params?.missionId, userInfo?.id]);

  // Chia sẻ vị trí GPS thời gian thực về máy chủ
  useEffect(() => {
    if (!mission || ['COMPLETED', 'CANCELLED'].includes(mission.status)) return;
    let cancelled = false;
    const update = async () => {
      if (cancelled || AppState.currentState !== 'active') return;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled && userInfo?.id) {
          await API.rescuers.updateLocation(userInfo.id, {
            current_lat: loc.coords.latitude.toFixed(7),
            current_lng: loc.coords.longitude.toFixed(7),
          });
        }
      } catch {}
    };
    update();
    const timer = setInterval(update, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mission?.id, mission?.status, userInfo?.id]);

  const act = async (action, extra = {}) => {
    if (busy || !mission) return;
    setBusy(true);
    try {
      const payload = { ...extra };
      if (note.trim()) payload.message = note.trim();
      const m = await API.missions.action(mission.id, action, payload);
      setMission(m);
      if (m.zone) {
        const zoneSos = await API.sos.getAll({ zone: m.zone }).catch(() => ({ results: [] }));
        setAvailableSos((zoneSos.results || []).filter(s =>
          !s.assigned_mission &&
          !['RESOLVED', 'CANCELLED'].includes(s.status) &&
          s.verification_status !== 'INCORRECT'
        ));
      }
      setNote('');
      return true;
    } catch (e) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Thao tác không thành công',
        message: e.message || 'Máy chủ không tiếp nhận lệnh cập nhật.',
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Thay đổi số lượng tiếp tế bàn giao qua Stepper (+/-)
  const changeDeliveryQty = (sosId, itemKey, delta, maxAvailable) => {
    setDeliveryDrafts(prev => {
      const currentSos = prev[sosId] || {};
      const currentVal = Number(currentSos[itemKey] || 0);
      const nextVal = Math.max(0, Math.min(maxAvailable, currentVal + delta));
      return {
        ...prev,
        [sosId]: { ...currentSos, [itemKey]: nextVal },
      };
    });
  };

  const deliverSupplies = async sos => {
    const draft = deliveryDrafts[sos.id] || {};
    const supplies_delivered = Object.fromEntries(
      Object.entries(draft).filter(([, value]) => Number(value) > 0).map(([key, value]) => [key, Number(value)])
    );
    if (!Object.keys(supplies_delivered).length) {
      return setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Chưa chọn số lượng',
        message: 'Bấm nút (+) để tăng số lượng vật phẩm đã bàn giao.',
      });
    }
    const success = await act('deliver_supplies', { sos_id: sos.id, supplies_delivered });
    if (success) {
      setDeliveryDrafts(current => ({ ...current, [sos.id]: {} }));
      setModalConfig({
        visible: true,
        type: 'success',
        title: 'Đã ghi nhận',
        message: 'Số lượng vật phẩm bàn giao đã được cập nhật thành công.',
      });
    }
  };

  const handleOpenNoteModal = (type, targetId = null, defaultTitle = '') => {
    setNoteTarget({ type, id: targetId, title: defaultTitle });
    setShowNoteModal(true);
  };

  const handleSubmitNoteModal = async () => {
    if (!noteTarget) return;
    const { type, id } = noteTarget;

    if (type === 'resolve_sos') {
      if (!note.trim()) {
        return setModalConfig({
          visible: true,
          type: 'warning',
          title: 'Cần ghi chú kết quả',
          message: 'Vui lòng mô tả tóm tắt kết quả (ví dụ: đã đưa nạn nhân lên bờ an toàn).',
        });
      }
      setShowNoteModal(false);
      await act('resolve_sos', { sos_id: id });
    } else if (type === 'needs_help') {
      if (!note.trim()) {
        return setModalConfig({
          visible: true,
          type: 'warning',
          title: 'Cần nêu rõ lý do khẩn cấp',
          message: 'Nhập tình hình nguy hiểm hoặc trang thiết bị cần gấp để BCH điều phối hỗ trợ.',
        });
      }
      setShowNoteModal(false);
      await act('needs_help');
    } else if (type === 'leave') {
      if (!note.trim()) {
        return setModalConfig({
          visible: true,
          type: 'warning',
          title: 'Cần lý do bàn giao',
          message: 'Vui lòng nhập lý do bàn giao hoặc rút lui khỏi nhiệm vụ.',
        });
      }
      setShowNoteModal(false);
      await act('leave');
    }
  };

  const callVictim = (phone) => {
    if (!phone) {
      setModalConfig({
        visible: true,
        type: 'info',
        title: 'Không có số điện thoại',
        message: 'Người báo nạn không cung cấp số điện thoại liên lạc.',
      });
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi cuộc gọi',
        message: 'Không thể kích hoạt cuộc gọi trên thiết bị này.',
      });
    });
  };

  const navigateToCoords = (lat, lng, name) => {
    if (!lat || !lng) {
      setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Thiếu toạ độ GPS',
        message: 'Điểm này chưa có toạ độ GPS chính xác để dẫn đường.',
      });
      return;
    }
    navigation.navigate('MapTab', {
      screen: 'MissionNavScreen',
      params: { targetLat: parseFloat(lat), targetLng: parseFloat(lng), zoneName: name || zoneName },
    });
  };

  // Thống kê tiến độ
  const progressPct = sosSignals.length
    ? Math.round(
        (sosSignals.filter(x => ['RESOLVED', 'COMPLETED'].includes(x.status)).length / sosSignals.length) * 100
      )
    : 0;
  const victimsFound = sosSignals.filter(x => x.status === 'RESOLVED').reduce((n, x) => n + (x.people_count || 1), 0);
  const totalPeople = sosSignals.reduce((n, x) => n + (x.people_count || 1), 0);
  const pendingSosCount = sosSignals.filter(s => !['RESOLVED', 'COMPLETED'].includes(s.status)).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={RCOLORS.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu nhiệm vụ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!mission) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader />
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={64} color={RCOLORS.statusGreen} />
          <Text style={styles.noMissionTitle}>Chưa có nhiệm vụ đang mở</Text>
          <Text style={styles.noMissionDesc}>
            Bạn hiện đang ở chế độ Trực chiến. Nhiệm vụ mới được Ban Chỉ Huy phân bổ sẽ hiển thị tại đây.
          </Text>
          <TouchableOpacity
            style={styles.backHubBtn}
            onPress={() => navigation.navigate('DashboardTab')}
          >
            <Text style={styles.backHubBtnText}>Về Trung tâm Tác chiến</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Xác định bước tiến trình
  const currentStepIndex = MISSION_STEPS.findIndex(s => s.key === mission.status);
  const stepIdx = currentStepIndex >= 0 ? currentStepIndex : (mission.status === 'NEEDS_HELP' ? 3 : 0);

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ─── 1. BẢNG TIẾN TRÌNH NHIỆM VỤ (4 BƯỚC) ────────────────────── */}
        <View style={styles.stepperCard}>
          <View style={styles.stepperRow}>
            {MISSION_STEPS.slice(0, 4).map((step, idx) => {
              const isPast = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              const color = isCurrent ? RCOLORS.primary : (isPast ? RCOLORS.statusGreen : RCOLORS.borderDark);
              return (
                <React.Fragment key={step.key}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, { borderColor: color, backgroundColor: isCurrent ? RCOLORS.primary : (isPast ? RCOLORS.statusGreen : RCOLORS.bgWhite) }]}>
                      <MaterialCommunityIcons
                        name={isPast ? 'check' : step.icon}
                        size={16}
                        color={isPast || isCurrent ? '#FFF' : RCOLORS.textSecondary}
                      />
                    </View>
                    <Text style={[styles.stepLabel, isCurrent && styles.stepLabelActive]} numberOfLines={1}>
                      {step.label}
                    </Text>
                  </View>
                  {idx < 3 && (
                    <View style={[styles.stepLine, { backgroundColor: isPast ? RCOLORS.statusGreen : RCOLORS.border }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* ─── 2. THẺ CHỈ HUY HIỆN TRƯỜNG (TACTICAL COMMAND CARD) ───────── */}
        <View style={[styles.heroCard, mission.status === 'NEEDS_HELP' && styles.heroCardPanic]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.statusTag, { backgroundColor: mission.status === 'NEEDS_HELP' ? RCOLORS.primary : '#1E293B' }]}>
              <View style={[styles.pulseDot, { backgroundColor: mission.status === 'NEEDS_HELP' ? '#FFF' : '#22C55E' }]} />
              <Text style={styles.statusTagText}>
                {STATUS_TEXT[mission.status] || mission.status}
              </Text>
            </View>
            <Text style={styles.missionCode}>#{String(mission.id).slice(-4).toUpperCase()}</Text>
          </View>

          <Text style={styles.zoneHeading} numberOfLines={2}>{zoneName}</Text>

          {/* Cụm nút hành động chính theo trạng thái */}
          <View style={styles.primaryActionRow}>
            {mission.status === 'PENDING_ACCEPTANCE' && (
              <TouchableOpacity
                style={[styles.bigActionBtn, { backgroundColor: RCOLORS.statusGreen }]}
                disabled={busy}
                onPress={() => act('next')}
              >
                <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={22} color="#FFF" />
                <Text style={styles.bigActionBtnText}>XÁC NHẬN NHẬN NHIỆM VỤ</Text>
              </TouchableOpacity>
            )}

            {mission.status === 'ACCEPTED' && (
              <TouchableOpacity
                style={[styles.bigActionBtn, { backgroundColor: RCOLORS.bgBlue }]}
                disabled={busy}
                onPress={() => act('next')}
              >
                <MaterialCommunityIcons name="run-fast" size={22} color="#FFF" />
                <Text style={styles.bigActionBtnText}>BẮT ĐẦU DI CHUYỂN</Text>
              </TouchableOpacity>
            )}

            {mission.status === 'ON_MY_WAY' && (
              <TouchableOpacity
                style={[styles.bigActionBtn, { backgroundColor: RCOLORS.primary }]}
                disabled={busy}
                onPress={() => act('next')}
              >
                <MaterialCommunityIcons name="map-marker-check" size={22} color="#FFF" />
                <Text style={styles.bigActionBtnText}>ĐÃ TIẾP CẬN HIỆN TRƯỜNG</Text>
              </TouchableOpacity>
            )}

            {mission.status === 'ACTIVE' && (
              <View style={styles.activeStatusPill}>
                <MaterialCommunityIcons name="shield-check" size={20} color={RCOLORS.statusGreen} />
                <Text style={styles.activeStatusPillText}>Đang xử lý các điểm SOS trong vùng</Text>
              </View>
            )}

            {/* Nút Dẫn đường GPS */}
            <TouchableOpacity
              style={styles.navQuickBtn}
              onPress={() => navigateToCoords(currentZone?.location_lat, currentZone?.location_lng, zoneName)}
            >
              <MaterialCommunityIcons name="navigation-variant" size={22} color="#FFF" />
              <Text style={styles.navQuickBtnText}>Dẫn đường</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 3. BẢO VỆ & CẢNH BÁO CHI VIỆN KHẨN CẤP (PANIC) ──────────── */}
        {mission.status === 'NEEDS_HELP' ? (
          <View style={styles.panicActiveCard}>
            <View style={styles.panicHeader}>
              <MaterialCommunityIcons name="alert-octagon" size={28} color={RCOLORS.primary} />
              <Text style={styles.panicActiveTitle}>TÍN HIỆU CẦN CHI VIỆN ĐANG PHÁT ĐỘNG</Text>
            </View>
            <Text style={styles.panicActiveDesc}>
              Ban Chỉ Huy và các đội lân cận đã nhận toạ độ khẩn cấp của bạn. Hãy giữ an toàn vị trí hiện tại.
            </Text>
            <TouchableOpacity
              style={styles.panicResumeBtn}
              disabled={busy}
              onPress={() => act('resume')}
            >
              <MaterialCommunityIcons name="check-bold" size={20} color="#FFF" />
              <Text style={styles.panicResumeBtnText}>ĐÃ ĐƯỢC TIẾP CẬN / TIẾP TỤC NHIỆM VỤ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          ['ON_MY_WAY', 'ACTIVE'].includes(mission.status) && (
            <TouchableOpacity
              style={styles.panicTriggerBtn}
              onPress={() => handleOpenNoteModal('needs_help', null, 'Báo động cần chi viện khẩn cấp')}
            >
              <MaterialCommunityIcons name="alert-octagon-outline" size={22} color={RCOLORS.primary} />
              <Text style={styles.panicTriggerBtnText}>🚨 BÁO ĐỘNG CẦN CHI VIỆN KHẨN CẤP</Text>
            </TouchableOpacity>
          )
        )}

        {/* ─── 4. TIẾN ĐỘ & DANH SÁCH ĐIỂM SOS TRONG VÙNG ────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>CÁC ĐIỂM CẦU CỨU TRONG VÙNG</Text>
              <Text style={styles.sectionSub}>Còn {pendingSosCount} điểm đang chờ tiếp cận cứu nạn</Text>
            </View>
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{progressPct}%</Text>
            </View>
          </View>

          {/* Thanh phần trăm */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
          </View>

          <View style={styles.statsSummaryRow}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxVal}>{victimsFound}/{totalPeople}</Text>
              <Text style={styles.statBoxLabel}>Người đã hỗ trợ</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxVal, { color: pendingSosCount > 0 ? RCOLORS.primary : RCOLORS.statusGreen }]}>
                {pendingSosCount}
              </Text>
              <Text style={styles.statBoxLabel}>Điểm còn nguy cấp</Text>
            </View>
          </View>

          {/* Danh sách từng SOS trong vùng */}
          {sosSignals.length > 0 ? (
            sosSignals.map((sos, index) => {
              const isResolved = ['RESOLVED', 'COMPLETED'].includes(sos.status);
              const draft = deliveryDrafts[sos.id] || {};
              const parsed = parseSosDetails(sos);

              return (
                <View
                  key={sos.id}
                  style={[
                    styles.sosCard,
                    isResolved ? styles.sosCardResolved : styles.sosCardActive,
                  ]}
                >
                  <View style={styles.sosCardTop}>
                    <View style={styles.sosTagRow}>
                      <View style={[styles.sosTypeBadge, isResolved && styles.sosTypeBadgeResolved]}>
                        <Text style={[styles.sosTypeBadgeText, isResolved && styles.sosTypeBadgeTextResolved]}>
                          #{index + 1} · {sos.emergency_type || 'SOS'}
                        </Text>
                      </View>
                      <View style={styles.peopleBadge}>
                        <MaterialCommunityIcons name="account-group" size={14} color="#0F172A" />
                        <Text style={styles.peopleBadgeText}>{sos.people_count || 1} người</Text>
                      </View>
                      {sos.verification_status === 'VERIFIED' && (
                        <View style={styles.verifiedBadge}>
                          <MaterialCommunityIcons name="check-decagram" size={13} color={RCOLORS.statusGreen} />
                          <Text style={styles.verifiedBadgeText}>Đã xác minh</Text>
                        </View>
                      )}
                    </View>

                    {isResolved ? (
                      <View style={styles.resolvedPill}>
                        <MaterialCommunityIcons name="check-circle" size={16} color={RCOLORS.statusGreen} />
                        <Text style={styles.resolvedPillText}>Đã cứu xong</Text>
                      </View>
                    ) : (
                      <View style={styles.pendingPill}>
                        <Text style={styles.pendingPillText}>Chưa xong</Text>
                      </View>
                    )}
                  </View>

                  {/* Địa chỉ & mô tả */}
                  <Text style={styles.sosAddress}>
                    <MaterialCommunityIcons name="map-marker" size={15} color={RCOLORS.primary} />
                    {' '}{parsed.address}
                  </Text>
                  {!!sos.note && (
                    <Text style={styles.sosNote} numberOfLines={2}>
                      💬 {sos.note}
                    </Text>
                  )}

                  {/* Cụm liên lạc & dẫn đường */}
                  <View style={styles.sosContactRow}>
                    {!!parsed.phone && (
                      <TouchableOpacity
                        style={styles.callBtn}
                        onPress={() => callVictim(parsed.phone)}
                        activeOpacity={0.85}
                      >
                        <MaterialCommunityIcons name="phone" size={16} color="#FFF" />
                        <Text style={styles.callBtnText}>Gọi ({parsed.phone})</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.navSingleBtn}
                      onPress={() => navigateToCoords(sos.location_lat, sos.location_lng, parsed.address)}
                      activeOpacity={0.85}
                    >
                      <MaterialCommunityIcons name="compass-outline" size={16} color={RCOLORS.bgNavy} />
                      <Text style={styles.navSingleBtnText}>Dẫn đường GPS</Text>
                    </TouchableOpacity>
                  </View>

                  {/* TIẾP TẾ VẬT PHẨM (NẾU CÓ) */}
                  {sos.supplies_needed && Object.keys(sos.supplies_needed).length > 0 && (
                    <View style={styles.supplyPanel}>
                      <Text style={styles.supplyPanelTitle}>📦 NHU CẦU TIẾP TẾ TẠI ĐIỂM NÀY</Text>
                      {Object.entries(sos.supplies_needed).map(([item, needed]) => {
                        const neededNum = Number(needed || 0);
                        const deliveredNum = Number(sos.supplies_delivered?.[item] || 0);
                        const remaining = Math.max(0, neededNum - deliveredNum);
                        const currentDraft = Number(draft[item] || 0);

                        return (
                          <View key={item} style={styles.supplyItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.supplyItemName}>{SUPPLY_LABELS[item] || item}</Text>
                              <Text style={styles.supplyItemMeta}>
                                Cần: {neededNum} · Đã nhận: {deliveredNum} · Còn: <Text style={{ color: remaining > 0 ? RCOLORS.primary : RCOLORS.statusGreen, fontWeight: '700' }}>{remaining}</Text>
                              </Text>
                            </View>

                            {/* Stepper điều chỉnh số lượng */}
                            {!isResolved && remaining > 0 && (
                              <View style={styles.stepperBox}>
                                <TouchableOpacity
                                  style={styles.stepBtn}
                                  onPress={() => changeDeliveryQty(sos.id, item, -1, remaining)}
                                >
                                  <MaterialCommunityIcons name="minus" size={16} color={RCOLORS.textPrimary} />
                                </TouchableOpacity>
                                <View style={styles.stepValBox}>
                                  <Text style={styles.stepValText}>{currentDraft}</Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.stepBtn}
                                  onPress={() => changeDeliveryQty(sos.id, item, 1, remaining)}
                                >
                                  <MaterialCommunityIcons name="plus" size={16} color={RCOLORS.textPrimary} />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })}

                      {!isResolved && Object.entries(sos.supplies_needed).some(([item, needed]) => Number(needed) > Number(sos.supplies_delivered?.[item] || 0)) && (
                        <TouchableOpacity
                          style={styles.confirmDeliveryBtn}
                          disabled={busy}
                          onPress={() => deliverSupplies(sos)}
                        >
                          <MaterialCommunityIcons name="package-variant-closed" size={18} color="#FFF" />
                          <Text style={styles.confirmDeliveryBtnText}>GHI NHẬN HÀNG ĐÃ GIAO</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Nút hoàn tất điểm SOS */}
                  {!isResolved && (
                    <TouchableOpacity
                      style={styles.resolveSosBtn}
                      onPress={() => handleOpenNoteModal('resolve_sos', sos.id, `Xác nhận cứu xong #${index + 1}`)}
                    >
                      <MaterialCommunityIcons name="check-bold" size={18} color="#FFF" />
                      <Text style={styles.resolveSosBtnText}>XÁC NHẬN ĐÃ CỨU HỘ XONG ĐIỂM NÀY</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyNote}>Chưa có điểm SOS nào được gán vào nhiệm vụ này.</Text>
          )}
        </View>

        {/* ─── 5. ĐIỂM SOS CHƯA CÓ ĐỘI PHỤ TRÁCH (CÓ THỂ NHẬN THÊM) ──────── */}
        {availableSos.length > 0 && !['COMPLETED', 'CANCELLED'].includes(mission.status) && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>SOS LÂN CẬN CHƯA CÓ ĐỘI TIẾP NHẬN</Text>
                <Text style={styles.sectionSub}>Có thể nhận thêm nếu đội còn đủ sức tải</Text>
              </View>
              <View style={[styles.progressBadge, { backgroundColor: '#FDEAEA' }]}>
                <Text style={[styles.progressBadgeText, { color: RCOLORS.primary }]}>{availableSos.length}</Text>
              </View>
            </View>

            {availableSos.map(sos => (
              <View key={sos.id} style={styles.availableSosRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.availableSosTitle}>
                    {sos.emergency_type || 'SOS'} · {sos.people_count || 1} người
                  </Text>
                  <Text style={styles.availableSosAddress} numberOfLines={2}>
                    📍 {sos.address || 'Khu vực chưa rõ địa chỉ'}
                  </Text>
                  {!!sos.note && (
                    <Text style={styles.availableSosNote} numberOfLines={2}>
                      💬 {sos.note}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.claimSosBtn}
                  disabled={busy}
                  onPress={() => act('claim_sos', { sos_id: sos.id })}
                >
                  <MaterialCommunityIcons name="plus-box" size={18} color="#FFF" />
                  <Text style={styles.claimSosBtnText}>Nhận điểm</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ─── 6. ĐIỀU PHỐI VẬT TƯ & KẾT THÚC NHIỆM VỤ ─────────────────── */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setShowSupportSection(!showSupportSection)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="tools" size={20} color={RCOLORS.bgNavy} />
              <Text style={styles.sectionTitle}>YÊU CẦU THIẾT BỊ / KẾT THÚC</Text>
            </View>
            <MaterialCommunityIcons
              name={showSupportSection ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={RCOLORS.textSecondary}
            />
          </TouchableOpacity>

          {showSupportSection && (
            <View style={{ marginTop: 12, gap: 14 }}>
              <Text style={styles.subText}>
                Nếu thiếu trang thiết bị (xuồng máy, áo phao, lương thực), gửi yêu cầu chi viện cho Ban Chỉ Huy:
              </Text>

              {/* Preset chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetChipRow}>
                {SUPPLY_PRESETS.map(preset => (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetChip, supportType === preset && styles.presetChipActive]}
                    onPress={() => setSupportType(preset)}
                  >
                    <Text style={[styles.presetChipText, supportType === preset && styles.presetChipTextActive]}>
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.supportInputRow}>
                <TextInput
                  style={styles.supportTypeInput}
                  value={supportType}
                  onChangeText={setSupportType}
                  placeholder="Nhập loại trang thiết bị cần gấp..."
                  placeholderTextColor={RCOLORS.textHint}
                />
                <View style={styles.qtyStepper}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setSupportQty(q => Math.max(1, q - 1))}
                  >
                    <MaterialCommunityIcons name="minus" size={14} color="#0F172A" />
                  </TouchableOpacity>
                  <Text style={styles.qtyVal}>{supportQty}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setSupportQty(q => q + 1)}
                  >
                    <MaterialCommunityIcons name="plus" size={14} color="#0F172A" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.sendSupportBtn}
                disabled={busy || !supportType.trim()}
                onPress={() => act('support', { resource_type: supportType, quantity: supportQty })}
              >
                <MaterialCommunityIcons name="send" size={18} color="#FFF" />
                <Text style={styles.sendSupportBtnText}>Gửi yêu cầu vật tư chi viện</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Nút Hoàn thành toàn bộ nhiệm vụ */}
              <TouchableOpacity
                style={[styles.completeMissionBtn, pendingSosCount > 0 && { opacity: 0.7 }]}
                disabled={busy}
                onPress={() => {
                  if (pendingSosCount > 0) {
                    setModalConfig({
                      visible: true,
                      type: 'warning',
                      title: 'Còn điểm chưa hoàn thành',
                      message: `Còn ${pendingSosCount} điểm SOS chưa xử lý xong. Bạn có chắc muốn hoàn thành nhiệm vụ này không?`,
                    });
                  } else {
                    act('complete');
                  }
                }}
              >
                <MaterialCommunityIcons name="check-all" size={20} color="#FFF" />
                <Text style={styles.completeMissionBtnText}>BÁO CÁO HOÀN THÀNH TOÀN BỘ NHIỆM VỤ</Text>
              </TouchableOpacity>

              {/* Nút Bàn giao nhiệm vụ */}
              <TouchableOpacity
                style={styles.leaveMissionBtn}
                disabled={busy}
                onPress={() => handleOpenNoteModal('leave', null, 'Bàn giao nhiệm vụ')}
              >
                <MaterialCommunityIcons name="account-arrow-right-outline" size={18} color={RCOLORS.textSecondary} />
                <Text style={styles.leaveMissionBtnText}>Bàn giao / Rút lui có lý do</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── MODAL NHẬP BÁO CÁO / LÝ DO ───────────────────────────────── */}
      <Modal
        visible={showNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNoteModal(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{noteTarget?.title || 'Nhập nội dung báo cáo'}</Text>
              <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={RCOLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={note}
              onChangeText={setNote}
              placeholder="Nhập nội dung chi tiết (kết quả cứu hộ, lý do...)"
              placeholderTextColor={RCOLORS.textHint}
              multiline
              autoFocus
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowNoteModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                disabled={busy}
                onPress={handleSubmitNoteModal}
              >
                <Text style={styles.modalSubmitBtnText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── CUSTOM ALERT / FEEDBACK MODAL ────────────────────────────── */}
      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={() => setModalConfig(prev => ({ ...prev, visible: false }))}
        onCancel={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: RSPACING.xl, gap: RSPACING.md },
  loadingText: { fontSize: RFONTS.base, color: RCOLORS.textSecondary, fontWeight: '500' },
  noMissionTitle: { fontSize: RFONTS.xl, fontWeight: '800', color: RCOLORS.textPrimary, marginTop: 8 },
  noMissionDesc: { fontSize: RFONTS.base, color: RCOLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  backHubBtn: { backgroundColor: RCOLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: RRADIUS.md, marginTop: 8 },
  backHubBtnText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: '700' },

  // Stepper 4 bước
  stepperCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, paddingVertical: 12, paddingHorizontal: 10, ...RSHADOWS.card },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', width: 68, gap: 4 },
  stepCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 10, color: RCOLORS.textSecondary, fontWeight: '500' },
  stepLabelActive: { color: RCOLORS.primary, fontWeight: '700' },
  stepLine: { flex: 1, height: 2, marginBottom: 16 },

  // Hero Command Card
  heroCard: { backgroundColor: '#0F172A', borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  heroCardPanic: { backgroundColor: '#311B1B', borderWidth: 2, borderColor: RCOLORS.primary },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RRADIUS.full },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  statusTagText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '700' },
  missionCode: { color: '#94A3B8', fontSize: RFONTS.xs, fontWeight: '700', letterSpacing: 1 },
  zoneHeading: { fontSize: RFONTS.xl, fontWeight: '800', color: '#FFF', lineHeight: 28 },

  primaryActionRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 },
  bigActionBtn: { flex: 1, height: 50, borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  bigActionBtnText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: '800', letterSpacing: 0.5 },
  navQuickBtn: { height: 50, paddingHorizontal: 16, backgroundColor: '#334155', borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  navQuickBtnText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: '700' },
  activeStatusPill: { flex: 1, height: 50, backgroundColor: '#1E293B', borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155' },
  activeStatusPillText: { color: '#E2E8F0', fontSize: RFONTS.sm, fontWeight: '600' },

  // Panic Card / Trigger
  panicActiveCard: { backgroundColor: '#FEF2F2', borderRadius: RRADIUS.md, padding: RSPACING.base, borderWidth: 2, borderColor: RCOLORS.primary, gap: 10 },
  panicHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panicActiveTitle: { color: RCOLORS.primary, fontSize: RFONTS.sm, fontWeight: '800' },
  panicActiveDesc: { color: '#991B1B', fontSize: RFONTS.sm, lineHeight: 20 },
  panicResumeBtn: { backgroundColor: RCOLORS.statusGreen, borderRadius: RRADIUS.md, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  panicResumeBtnText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: '700' },

  panicTriggerBtn: { backgroundColor: '#FEF2F2', borderRadius: RRADIUS.md, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#FCA5A5' },
  panicTriggerBtnText: { color: RCOLORS.primary, fontSize: RFONTS.sm, fontWeight: '800' },

  // Section Card
  sectionCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: RFONTS.sm, fontWeight: '800', color: RCOLORS.textPrimary, letterSpacing: 0.5 },
  sectionSub: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, marginTop: 2 },
  progressBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  progressBadgeText: { fontSize: RFONTS.xs, fontWeight: '800', color: RCOLORS.textPrimary },

  progressBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: RCOLORS.statusGreen, borderRadius: 4 },

  statsSummaryRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: RRADIUS.sm, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  statBoxVal: { fontSize: RFONTS.lg, fontWeight: '800', color: RCOLORS.textPrimary },
  statBoxLabel: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, marginTop: 2 },

  // SOS Individual Card
  sosCard: { borderRadius: RRADIUS.md, padding: RSPACING.base, gap: 10, borderWidth: 1.5 },
  sosCardActive: { borderColor: '#FCA5A5', backgroundColor: '#FFF' },
  sosCardResolved: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', opacity: 0.8 },
  sosCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sosTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  sosTypeBadge: { backgroundColor: '#FDEAEA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RRADIUS.sm },
  sosTypeBadgeResolved: { backgroundColor: '#E2E8F0' },
  sosTypeBadgeText: { color: RCOLORS.primary, fontSize: RFONTS.xs, fontWeight: '700' },
  sosTypeBadgeTextResolved: { color: RCOLORS.textSecondary },
  peopleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RRADIUS.sm },
  peopleBadgeText: { fontSize: RFONTS.xs, fontWeight: '700', color: '#0F172A' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 3, borderRadius: RRADIUS.sm },
  verifiedBadgeText: { fontSize: 10, fontWeight: '700', color: '#166534' },
  resolvedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RRADIUS.sm },
  resolvedPillText: { fontSize: RFONTS.xs, fontWeight: '700', color: '#166534' },
  pendingPill: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RRADIUS.sm },
  pendingPillText: { fontSize: RFONTS.xs, fontWeight: '700', color: '#92400E' },

  sosAddress: { fontSize: RFONTS.base, fontWeight: '600', color: RCOLORS.textPrimary, lineHeight: 20 },
  sosNote: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18, backgroundColor: '#F8FAFC', padding: 8, borderRadius: RRADIUS.sm },

  sosContactRow: { flexDirection: 'row', gap: 8 },
  callBtn: { flex: 1, height: 40, backgroundColor: RCOLORS.statusGreen, borderRadius: RRADIUS.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  callBtnText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '700' },
  navSingleBtn: { flex: 1, height: 40, backgroundColor: '#F1F5F9', borderRadius: RRADIUS.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#CBD5E1' },
  navSingleBtnText: { color: RCOLORS.bgNavy, fontSize: RFONTS.xs, fontWeight: '700' },

  // Tiếp tế panel
  supplyPanel: { backgroundColor: '#FFFBEB', borderRadius: RRADIUS.sm, padding: 10, gap: 10, borderWidth: 1, borderColor: '#FDE68A' },
  supplyPanelTitle: { fontSize: 11, fontWeight: '800', color: '#92400E', letterSpacing: 0.5 },
  supplyItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  supplyItemName: { fontSize: RFONTS.sm, fontWeight: '700', color: '#0F172A' },
  supplyItemMeta: { fontSize: RFONTS.xs, color: '#64748B', marginTop: 2 },

  stepperBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: RRADIUS.sm, borderWidth: 1, borderColor: '#CBD5E1', overflow: 'hidden' },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  stepValBox: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepValText: { fontSize: RFONTS.sm, fontWeight: '800', color: RCOLORS.textPrimary },

  confirmDeliveryBtn: { backgroundColor: '#0D9488', borderRadius: RRADIUS.sm, height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  confirmDeliveryBtnText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '800' },

  resolveSosBtn: { backgroundColor: RCOLORS.statusGreen, borderRadius: RRADIUS.md, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  resolveSosBtnText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: '800' },

  emptyNote: { textAlign: 'center', color: RCOLORS.textHint, fontSize: RFONTS.sm, marginVertical: 10 },

  // Available SOS
  availableSosRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: RRADIUS.md, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  availableSosTitle: { fontSize: RFONTS.sm, fontWeight: '700', color: RCOLORS.textPrimary },
  availableSosAddress: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary },
  availableSosNote: { fontSize: RFONTS.xs, color: RCOLORS.textHint },
  claimSosBtn: { backgroundColor: RCOLORS.bgNavy, paddingHorizontal: 12, height: 38, borderRadius: RRADIUS.sm, flexDirection: 'row', alignItems: 'center', gap: 6 },
  claimSosBtnText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '700' },

  // Collapsible section
  collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subText: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, lineHeight: 18 },
  presetChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F1F5F9', borderRadius: RRADIUS.full, borderWidth: 1, borderColor: '#E2E8F0' },
  presetChipActive: { backgroundColor: RCOLORS.bgNavy, borderColor: RCOLORS.bgNavy },
  presetChipText: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, fontWeight: '600' },
  presetChipTextActive: { color: '#FFF' },

  supportInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  supportTypeInput: { flex: 1, height: 44, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: RRADIUS.sm, paddingHorizontal: 12, fontSize: RFONTS.sm, color: RCOLORS.textPrimary, backgroundColor: '#FFF' },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: RRADIUS.sm, backgroundColor: '#FFF' },
  qtyBtn: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  qtyVal: { width: 34, textAlign: 'center', fontSize: RFONTS.sm, fontWeight: '700', color: RCOLORS.textPrimary },

  sendSupportBtn: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sendSupportBtnText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  completeMissionBtn: { backgroundColor: RCOLORS.statusGreen, borderRadius: RRADIUS.md, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  completeMissionBtnText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: '800' },
  leaveMissionBtn: { height: 44, borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  leaveMissionBtnText: { color: RCOLORS.textSecondary, fontSize: RFONTS.sm, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#FFF', borderRadius: RRADIUS.lg, padding: 20, gap: 14, ...RSHADOWS.elevated },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: RFONTS.md, fontWeight: '800', color: RCOLORS.textPrimary },
  modalInput: { height: 100, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: RRADIUS.md, padding: 12, textAlignVertical: 'top', fontSize: RFONTS.sm, color: RCOLORS.textPrimary },
  modalActionRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RRADIUS.sm, backgroundColor: '#F1F5F9' },
  modalCancelBtnText: { fontSize: RFONTS.sm, fontWeight: '600', color: RCOLORS.textSecondary },
  modalSubmitBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: RRADIUS.sm, backgroundColor: RCOLORS.primary },
  modalSubmitBtnText: { fontSize: RFONTS.sm, fontWeight: '700', color: '#FFF' },
});

export default ActiveMissionScreen;
