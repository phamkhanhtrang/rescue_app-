/**
 * src/screens/rescuer/missions/ActiveMissionScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Đang thực hiện Nhiệm vụ (Screen 9).
 * Tích hợp Chia sẻ vị trí GPS thời gian thực và Cảnh báo rời vùng.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, TextInput, AppState, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const NEXT = { PENDING_ACCEPTANCE: 'ACCEPTED', ACCEPTED: 'ON_MY_WAY', ON_MY_WAY: 'ACTIVE', NEEDS_HELP: 'ACTIVE' };
const STATUS = {
  PENDING_ACCEPTANCE: 'CHỜ ĐỘI XÁC NHẬN',
  ACCEPTED: 'ĐÃ NHẬN NHIỆM VỤ',
  ON_MY_WAY: 'ĐANG DI CHUYỂN',
  ACTIVE: 'ĐANG XỬ LÝ',
  NEEDS_HELP: '🚨 CẦN CHI VIỆN KHẨN CẤP',
  COMPLETED: 'ĐÃ HOÀN THÀNH',
  CANCELLED: 'ĐÃ BÀN GIAO',
};
const SUPPLY_LABELS = {
  water: 'Nước uống', food: 'Thực phẩm/mì', medicine: 'Thuốc men',
  life_jacket: 'Áo phao', rice: 'Gạo/muối',
};

const ActiveMissionScreen = ({ navigation, route }) => {
  const { userInfo } = useAuth();
  const [mission, setMission] = useState(null);
  const [currentZone, setCurrentZone] = useState(null);
  const [availableSos, setAvailableSos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [supportType, setSupportType] = useState('');
  const [supportQty, setSupportQty] = useState('1');
  const [deliveryDrafts, setDeliveryDrafts] = useState({});
  const [busy, setBusy] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const zoneName = mission?.zone_name || (mission && !mission.zone ? 'SOS ĐƠN LẺ' : route?.params?.zoneName) || 'VÙNG CỨU HỘ';
  const sosSignals = mission?.sos || [];
  const isLeavingZone = false;

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
          API.zones.getDetails(m.zone),
          API.sos.getAll({ zone: m.zone }),
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
          name: 'SOS đơn lẻ',
          location_lat: directSos.location_lat,
          location_lng: directSos.location_lng,
        } : null);
        setAvailableSos([]);
      }
    } catch (e) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Không tải được nhiệm vụ',
        message: e.message || 'Lỗi hệ thống',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [route?.params?.missionId, userInfo?.id]);

  useEffect(() => {
    if (!mission || ['COMPLETED', 'CANCELLED'].includes(mission.status)) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') fetchData();
    }, 10000);
    return () => clearInterval(timer);
  }, [mission?.id, mission?.status, route?.params?.missionId, userInfo?.id]);

  useEffect(() => {
    if (!mission || ['COMPLETED', 'CANCELLED'].includes(mission.status)) return;
    let cancelled = false;
    const update = async () => {
      if (cancelled || AppState.currentState !== 'active') return;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled)
          await API.rescuers.updateLocation(userInfo.id, {
            current_lat: loc.coords.latitude.toFixed(7),
            current_lng: loc.coords.longitude.toFixed(7),
          });
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
    if (busy) return;
    setBusy(true);
    try {
      const m = await API.missions.action(mission.id, action, { message: note.trim(), ...extra });
      setMission(m);
      if (m.zone) {
        const zoneSos = await API.sos.getAll({ zone: m.zone });
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
        title: 'Chưa cập nhật được',
        message: e.message || 'Lỗi thao tác',
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteSOS = sosId => {
    if (!note.trim()) {
      return setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Cần kết quả',
        message: 'Nhập kết quả xử lý trước khi đóng SOS.',
      });
    }
    act('resolve_sos', { sos_id: sosId });
  };

  const deliverSupplies = async sos => {
    const draft = deliveryDrafts[sos.id] || {};
    const supplies_delivered = Object.fromEntries(
      Object.entries(draft).filter(([, value]) => Number(value) > 0).map(([key, value]) => [key, Number(value)])
    );
    if (!Object.keys(supplies_delivered).length) {
      return setModalConfig({ visible: true, type: 'warning', title: 'Chưa nhập số lượng', message: 'Nhập ít nhất một mặt hàng đã giao.' });
    }
    const success = await act('deliver_supplies', { sos_id: sos.id, supplies_delivered });
    if (success) setDeliveryDrafts(current => ({ ...current, [sos.id]: {} }));
  };

  const progressPct = sosSignals.length
    ? Math.round(
        (sosSignals.filter(x => ['RESOLVED', 'CANCELLED'].includes(x.status)).length / sosSignals.length) * 100
      )
    : 0;
  const victimsFound = sosSignals.filter(x => x.status === 'RESOLVED').reduce((n, x) => n + (x.people_count || 0), 0);
  const totalPeople = sosSignals.reduce((n, x) => n + (x.people_count || 0), 0);

  if (loading)
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={RCOLORS.primary} />
          <Text style={styles.emptyText}>Đang tải nhiệm vụ...</Text>
        </View>
      </SafeAreaView>
    );

  if (!mission)
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader />
        <View style={styles.loadingBox}>
          <Text style={styles.noMissionTitle}>Chưa có nhiệm vụ đang mở</Text>
          <Text style={styles.emptyText}>Nhiệm vụ được điều phối hoặc yêu cầu chi viện bạn nhận sẽ xuất hiện tại đây.</Text>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ─── 1. Mission header ──────────────────────────────────────────── */}
        <View style={[styles.missionHeader, isLeavingZone && styles.missionHeaderDanger]}>
          <View style={styles.missionBadgeRow}>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>● {mission ? STATUS[mission.status] : 'ĐANG TẢI NHIỆM VỤ'}</Text>
            </View>
          </View>

          <Text style={[styles.missionWarning, isLeavingZone && styles.missionWarningDanger]}>
            {mission ? `NHIỆM VỤ\n${zoneName.toUpperCase()}` : 'CHƯA CÓ\nNHIỆM VỤ MỞ'}
          </Text>
        </View>

        {/* ─── 2. Mission Progress ────────────────────────────────────────── */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Tiến độ Nhiệm vụ</Text>
          </View>
          <View style={styles.progressTypeRow}>
            <Text style={styles.progressType}>TIẾN ĐỘ XỬ LÝ SOS</Text>
            <Text style={styles.progressPct}>{progressPct}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          <View style={styles.statsGrid}>
            <StatBox label="NẠN NHÂN ĐÃ TÌM THẤY" value={`${victimsFound}/${totalPeople}`} />
            <StatBox label="MỐI NGUY HIỂM" value={sosSignals.filter(s => s.status === 'PENDING').length} color={RCOLORS.primary} />
          </View>
        </View>

        {/* ─── 2.5 Emergency Help Banner ─────────────────────────────────── */}
        {mission?.status === 'NEEDS_HELP' && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerTitle}>🚨 ĐỘI ĐANG PHÁT TÍN HIỆU CẦN CHI VIỆN KHẨN CẤP</Text>
            <Text style={styles.emergencyBannerDesc}>
              {mission.outcome_note ? `${mission.outcome_note}\n\n` : ''}
              Ban chỉ huy và các đội trong khu vực đã nhận tín hiệu ưu tiên. Khi đội đã khắc phục xong sự cố hoặc có lực lượng hỗ trợ tiếp cận, bấm nút bên dưới để tiếp tục xử lý nhiệm vụ.
            </Text>
            <TouchableOpacity
              style={styles.resumeButton}
              disabled={busy}
              onPress={() => act('resume')}
            >
              <Text style={styles.resumeButtonText}>✅ ĐÃ ĐƯỢC HỖ TRỢ / TIẾP TỤC NHIỆM VỤ</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── 3. Navigation Shortcut ─────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.navShortcut}
          disabled={!currentZone}
          onPress={() =>
            currentZone &&
            navigation.navigate('MapTab', {
              screen: 'MissionNavScreen',
              params: { targetLat: currentZone.location_lat, targetLng: currentZone.location_lng, zoneName },
            })
          }
        >
          <Text style={styles.navShortcutText}>📍 MỞ BẢN ĐỒ DẪN ĐƯỜNG</Text>
        </TouchableOpacity>

        {mission && !['COMPLETED', 'CANCELLED'].includes(mission.status) && (
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>BÁO CÁO / LÝ DO BÀN GIAO / NỘI DUNG CHI VIỆN</Text>
            <TextInput
              style={styles.reportInput}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Nhập nội dung trước khi xử lý SOS, hoàn thành hoặc bàn giao..."
              placeholderTextColor={RCOLORS.textHint}
            />
            {NEXT[mission.status] && (
              <TouchableOpacity style={styles.navShortcut} disabled={busy} onPress={() => act('next')}>
                <Text style={styles.navShortcutText}>
                  {NEXT[mission.status] === 'ACCEPTED'
                    ? 'XÁC NHẬN NHẬN NHIỆM VỤ'
                    : NEXT[mission.status] === 'ON_MY_WAY'
                    ? 'BẮT ĐẦU DI CHUYỂN'
                    : 'XÁC NHẬN ĐÃ ĐẾN HIỆN TRƯỜNG'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── 4. Task pipeline ───────────────────────────────────────────── */}
        <View style={styles.taskCard}>
          <Text style={styles.taskTitle}>YÊU CẦU CẦN XỬ LÝ TRONG VÙNG</Text>
          {sosSignals.length > 0 ? (
            sosSignals.slice(0, 5).map(task => {
              const isResolved = ['RESOLVED', 'COMPLETED'].includes(task.status);
              return (
                <View key={task.id} style={[styles.taskRow, !isResolved && styles.taskRowActive]}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskName}>
                      {task.emergency_type}: {task.note || 'Yêu cầu'}
                    </Text>
                    {!isResolved && <Text style={styles.taskPriority}>!</Text>}
                  </View>
                  {task.supplies_needed && Object.keys(task.supplies_needed).length > 0 && (
                    <View style={styles.supplyBox}>
                      <Text style={styles.supplyTitle}>TIẾP TẾ CÒN THIẾU</Text>
                      {Object.entries(task.supplies_needed).map(([item, needed]) => {
                        const remaining = Math.max(0, Number(needed || 0) - Number(task.supplies_delivered?.[item] || 0));
                        return (
                          <View key={item} style={styles.supplyRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.supplyName}>{SUPPLY_LABELS[item] || item}</Text>
                              <Text style={styles.supplyMeta}>Cần {needed} · đã giao {task.supplies_delivered?.[item] || 0} · còn {remaining}</Text>
                            </View>
                            <TextInput
                              style={styles.supplyInput}
                              editable={!isResolved && remaining > 0}
                              keyboardType="number-pad"
                              placeholder="0"
                              value={String(deliveryDrafts[task.id]?.[item] || '')}
                              onChangeText={value => setDeliveryDrafts(current => ({
                                ...current,
                                [task.id]: { ...(current[task.id] || {}), [item]: value },
                              }))}
                            />
                          </View>
                        );
                      })}
                      {!isResolved && Object.entries(task.supplies_needed).some(([item, needed]) => Number(needed) > Number(task.supplies_delivered?.[item] || 0)) && (
                        <TouchableOpacity style={styles.deliveryButton} disabled={busy} onPress={() => deliverSupplies(task)}>
                          <Text style={styles.completeBtText}>GHI NHẬN HÀNG ĐÃ GIAO</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  <View style={styles.taskActions}>
                    <TouchableOpacity
                      style={[styles.completeBt, isResolved && { backgroundColor: RCOLORS.border }]}
                      onPress={() => !isResolved && handleCompleteSOS(task.id)}
                      disabled={isResolved}
                    >
                      <Text style={styles.completeBtText}>{isResolved ? 'ĐÃ XỬ LÝ' : 'XÁC NHẬN HOÀN THÀNH'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>
              {mission.supporting_requests?.length
                ? 'Đây là nhiệm vụ chi viện. Phối hợp với đội chính theo nội dung bên dưới.'
                : 'Bạn chưa nhận SOS nào trong vùng.'}
            </Text>
          )}
        </View>

        {!mission.supporting_requests?.length &&
          !['COMPLETED', 'CANCELLED'].includes(mission.status) && (
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>SOS CHƯA CÓ ĐỘI PHỤ TRÁCH</Text>
            {availableSos.length ? availableSos.map(sos => (
              <View key={sos.id} style={[styles.taskRow, styles.taskRowActive]}>
                <Text style={styles.taskName}>
                  {sos.emergency_type || 'SOS'} · {sos.people_count || 1} người
                </Text>
                <Text style={styles.emptyText}>
                  {sos.verification_status === 'VERIFIED'
                    ? 'Đã được điều phối viên xác minh'
                    : 'Chưa xác minh · cần kiểm tra tại hiện trường'}
                </Text>
                {!!sos.note && <Text style={styles.emptyText} numberOfLines={3}>{sos.note}</Text>}
                <TouchableOpacity
                  style={styles.completeBt}
                  disabled={busy}
                  onPress={() => act('claim_sos', { sos_id: sos.id })}
                >
                  <Text style={styles.completeBtText}>NHẬN XỬ LÝ SOS NÀY</Text>
                </TouchableOpacity>
              </View>
            )) : (
              <Text style={styles.emptyText}>Hiện không còn SOS nào chưa có đội phụ trách.</Text>
            )}
          </View>
        )}

        {!!mission.supporting_requests?.length && (
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>NỘI DUNG CHI VIỆN ĐÃ NHẬN</Text>
            {mission.supporting_requests.map(r => (
              <View key={r.id} style={styles.taskRow}>
                <Text style={styles.taskName}>
                  {r.resource_type} · số lượng {r.quantity}
                </Text>
                {!!r.note && <Text style={styles.emptyText}>{r.note}</Text>}
              </View>
            ))}
            {!!mission.support_target_sos?.length && (
              <View style={styles.supplyBox}>
                <Text style={styles.supplyTitle}>ĐIỂM CẦN BÀN GIAO HÀNG</Text>
                {mission.support_target_sos.map(sos => (
                  <View key={sos.id} style={styles.taskRow}>
                    <Text style={styles.taskName}>{sos.contact_name || sos.address || 'Điểm SOS'} · {sos.people_count || 1} người</Text>
                    {Object.entries(sos.supplies_needed || {}).map(([item, needed]) => {
                      const remaining = Math.max(0, Number(needed || 0) - Number(sos.supplies_delivered?.[item] || 0));
                      return (
                        <View key={item} style={styles.supplyRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.supplyName}>{SUPPLY_LABELS[item] || item}</Text>
                            <Text style={styles.supplyMeta}>Còn thiếu {remaining}</Text>
                          </View>
                          <TextInput
                            style={styles.supplyInput}
                            editable={remaining > 0}
                            keyboardType="number-pad"
                            placeholder="0"
                            value={String(deliveryDrafts[sos.id]?.[item] || '')}
                            onChangeText={value => setDeliveryDrafts(current => ({ ...current, [sos.id]: { ...(current[sos.id] || {}), [item]: value } }))}
                          />
                        </View>
                      );
                    })}
                    {Object.keys(sos.supplies_needed || {}).length ? (
                      <TouchableOpacity style={styles.deliveryButton} disabled={busy} onPress={() => deliverSupplies(sos)}>
                        <Text style={styles.completeBtText}>XÁC NHẬN ĐÃ BÀN GIAO</Text>
                      </TouchableOpacity>
                    ) : <Text style={styles.emptyText}>Điểm này chưa khai báo nhu cầu hàng hóa.</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {mission && !['COMPLETED', 'CANCELLED'].includes(mission.status) && (
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>ĐIỀU PHỐI NHIỆM VỤ</Text>
            <View style={styles.supportRow}>
              <TextInput
                style={[styles.reportInput, { flex: 1, minHeight: 46 }]}
                value={supportType}
                onChangeText={setSupportType}
                placeholder="Cần chi viện gì?"
              />
              <TextInput
                style={styles.qtyInput}
                value={supportQty}
                onChangeText={setSupportQty}
                keyboardType="number-pad"
                placeholder="SL"
              />
            </View>
            {!mission.supporting_requests?.length && (
              <TouchableOpacity
                style={styles.updateMainButton}
                disabled={busy}
                onPress={() => act('support', { resource_type: supportType, quantity: supportQty })}
              >
                <Text style={styles.updateMainText}>Yêu cầu trang thiết bị / vật phẩm</Text>
              </TouchableOpacity>
            )}

            {['ON_MY_WAY', 'ACTIVE'].includes(mission.status) && (
              <TouchableOpacity
                style={styles.needsHelpButton}
                disabled={busy}
                onPress={() => {
                  if (!note.trim()) {
                    return setModalConfig({
                      visible: true,
                      type: 'warning',
                      title: 'Cần nêu rõ lý do',
                      message: 'Vui lòng nhập tình huống hoặc lý do cần chi viện vào ô "Báo cáo / Nội dung chi viện" phía trên trước khi phát tín hiệu.',
                    });
                  }
                  act('needs_help');
                }}
              >
                <Text style={styles.needsHelpButtonText}>🚨 BÁO ĐỘNG CẦN CHI VIỆN KHẨN CẤP</Text>
              </TouchableOpacity>
            )}

            {mission.status === 'NEEDS_HELP' && (
              <TouchableOpacity
                style={styles.resumeButton}
                disabled={busy}
                onPress={() => act('resume')}
              >
                <Text style={styles.resumeButtonText}>✅ TIẾP TỤC NHIỆM VỤ (ĐÃ ĐƯỢC HỖ TRỢ)</Text>
              </TouchableOpacity>
            )}
            {mission.support_requests?.map(r => (
              <View key={r.id} style={styles.taskRow}>
                <Text style={styles.taskName}>
                  {r.resource_type} · {r.quantity} · {r.status}
                </Text>
                {r.status !== 'CLOSED' && (
                  <TouchableOpacity style={styles.completeBt} onPress={() => act('close_support', { support_id: r.id })}>
                    <Text style={styles.completeBtText}>ĐÓNG NHU CẦU</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.completeMission} disabled={busy} onPress={() => act('complete')}>
              <Text style={styles.completeBtText}>BÁO CÁO HOÀN THÀNH NHIỆM VỤ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.updateMainButton} disabled={busy} onPress={() => act('leave')}>
              <Text style={styles.updateMainText}>BÀN GIAO / TỪ CHỐI CÓ LÝ DO</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

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

const StatBox = ({ label, value, color = RCOLORS.textPrimary }) => (
  <View style={sbStyles.box}>
    <Text style={[sbStyles.value, { color }]}>{value}</Text>
    <Text style={sbStyles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 32, gap: RSPACING.md },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: RSPACING.xl, gap: RSPACING.md },
  noMissionTitle: { fontSize: RFONTS.lg, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },

  missionHeader: { backgroundColor: RCOLORS.bgDark, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md },
  missionHeaderDanger: { backgroundColor: '#311B1B', borderWidth: 2, borderColor: RCOLORS.primary },
  missionBadgeRow: { flexDirection: 'row', gap: RSPACING.sm },
  activeBadge: { backgroundColor: RCOLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  activeBadgeText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },
  missionWarning: { fontSize: RFONTS.xxl + 2, fontWeight: RFONTS.black, color: RCOLORS.textWhite, lineHeight: 34 },
  missionWarningDanger: { color: RCOLORS.primary },

  progressCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  progressTypeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressType: { fontSize: RFONTS.sm, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary },
  progressPct: { fontSize: RFONTS.sm, fontWeight: RFONTS.black, color: RCOLORS.primary },
  progressBg: { height: 8, backgroundColor: RCOLORS.bgApp, borderRadius: RRADIUS.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.full },
  statsGrid: { flexDirection: 'row', gap: RSPACING.sm },

  navShortcut: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, paddingVertical: 14, alignItems: 'center', ...RSHADOWS.elevated },
  navShortcutText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },

  taskCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  reportInput: { minHeight: 92, borderWidth: 1, borderColor: RCOLORS.border, borderRadius: RRADIUS.md, padding: 12, color: RCOLORS.textPrimary, textAlignVertical: 'top' },
  supportRow: { flexDirection: 'row', gap: RSPACING.sm },
  qtyInput: { width: 62, borderWidth: 1, borderColor: RCOLORS.border, borderRadius: RRADIUS.md, padding: 10, color: RCOLORS.textPrimary },
  completeMission: { backgroundColor: RCOLORS.statusGreen, borderRadius: RRADIUS.md, paddingVertical: 14, alignItems: 'center' },
  taskTitle: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1 },
  taskRow: { borderRadius: RRADIUS.sm, padding: RSPACING.md, gap: RSPACING.sm, borderWidth: 1, borderColor: RCOLORS.border },
  taskRowActive: { borderColor: RCOLORS.primary + '40', backgroundColor: RCOLORS.primaryLight },
  taskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskName: { fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary, flex: 1 },
  taskPriority: { fontSize: RFONTS.lg, fontWeight: RFONTS.black, color: RCOLORS.primary },
  supplyBox: { backgroundColor: '#FFF8E1', borderRadius: RRADIUS.sm, padding: RSPACING.sm, gap: 8, borderWidth: 1, borderColor: '#F2D28B' },
  supplyTitle: { fontSize: RFONTS.xs, fontWeight: RFONTS.black, color: '#8A5A00', letterSpacing: 0.6 },
  supplyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  supplyName: { fontSize: RFONTS.sm, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  supplyMeta: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, marginTop: 2 },
  supplyInput: { width: 60, borderWidth: 1, borderColor: '#D5B76F', borderRadius: RRADIUS.sm, backgroundColor: '#FFF', padding: 8, textAlign: 'center', color: RCOLORS.textPrimary, fontWeight: RFONTS.bold },
  deliveryButton: { backgroundColor: '#00695C', borderRadius: RRADIUS.sm, paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  taskActions: { flexDirection: 'row', gap: RSPACING.sm },
  completeBt: { flex: 1, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.sm, paddingVertical: 10, alignItems: 'center' },
  completeBtText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },

  updateMainButton: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: RRADIUS.md, paddingVertical: RSPACING.base, alignItems: 'center', borderWidth: 1, borderColor: RCOLORS.border },
  updateMainText: { color: RCOLORS.textSecondary, fontSize: RFONTS.base, fontWeight: RFONTS.semiBold },
  emptyText: { textAlign: 'center', color: RCOLORS.textHint, marginVertical: 10 },

  emergencyBanner: { backgroundColor: '#FFEBEE', borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm, borderWidth: 2, borderColor: '#D32F2F', ...RSHADOWS.card },
  emergencyBannerTitle: { color: '#C62828', fontSize: RFONTS.sm, fontWeight: RFONTS.black },
  emergencyBannerDesc: { color: '#B71C1C', fontSize: RFONTS.xs, lineHeight: 18 },
  needsHelpButton: { backgroundColor: '#D32F2F', borderRadius: RRADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  needsHelpButtonText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },
  resumeButton: { backgroundColor: '#2E7D32', borderRadius: RRADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  resumeButtonText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },
});

const sbStyles = StyleSheet.create({
  box: { flex: 1, backgroundColor: RCOLORS.bgApp, borderRadius: RRADIUS.sm, padding: RSPACING.sm, alignItems: 'center', gap: 2 },
  value: { fontSize: RFONTS.lg, fontWeight: RFONTS.black },
  label: { fontSize: RFONTS.xs - 2, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, textAlign: 'center' },
});

export default ActiveMissionScreen;
