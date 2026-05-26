/**
 * src/screens/rescuer/missions/ActiveMissionScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Đang thực hiện Nhiệm vụ (Screen 9).
 * Tích hợp Chia sẻ vị trí GPS thời gian thực và Cảnh báo rời vùng.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert, Animated,
} from 'react-native';
import * as Location from 'expo-location';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// Hàm tính khoảng cách giữa 2 tọa độ (meters)
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
};

const useCountdown = (initialSeconds) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `00:${m}:${s}`;
};

const ActiveMissionScreen = ({ navigation, route }) => {
  const { userInfo } = useAuth();
  const { zoneId, zoneName = 'VÙNG ALPHA' } = route?.params ?? {};
  const timer = useCountdown(42 * 60 + 15);
  const pulse = useRef(new Animated.Value(1)).current;

  const [sosSignals, setSosSignals] = useState([]);
  const [otherMissions, setOtherMissions] = useState([]);
  const [currentZone, setCurrentZone] = useState(null);
  const [isLeavingZone, setIsLeavingZone] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Fetch dữ liệu ban đầu
  const fetchData = async () => {
    if (!zoneId) return;
    try {
      const [sosRes, missionRes, zoneRes] = await Promise.all([
        API.sos.getAll({ zone: zoneId }),
        API.missions.getAll({ zone_id: zoneId }),
        API.zones.getDetails(zoneId)
      ]);
      setSosSignals(sosRes.results || []);
      setOtherMissions(missionRes.results || []);
      setCurrentZone(zoneRes);
    } catch (err) {
      console.error('Fetch mission data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [zoneId]);

  // 2. CHIA SẺ VỊ TRÍ GPS & CẢNH BÁO RỜI VÙNG
  useEffect(() => {
    let intervalId;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      intervalId = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const { latitude, longitude } = loc.coords;

          // Gửi vị trí lên server
          await API.rescuers.updateLocation(userInfo?.id, { 
            current_lat: latitude, 
            current_lng: longitude 
          });

          // Kiểm tra Geofencing (Nếu cách tâm vùng > 600m thì cảnh báo)
          if (currentZone) {
            const dist = getDistance(
              latitude, longitude, 
              parseFloat(currentZone.location_lat), 
              parseFloat(currentZone.location_lng)
            );
            
            // Ngưỡng 600m (vì circle là 500m)
            setIsLeavingZone(dist > 600);
          }
        } catch (e) {
          console.warn('GPS sharing error:', e);
        }
      }, 15000); // 15 giây gửi một lần
    };

    startTracking();
    return () => intervalId && clearInterval(intervalId);
  }, [currentZone, userInfo]);

  const handleCompleteSOS = async (sosId) => {
    try {
      await API.sos.updateStatus(sosId, 'RESOLVED');
      fetchData();
      Alert.alert('Thành công', 'Nhiệm vụ đã được đánh dấu hoàn thành.');
    } catch (err) {
      console.error('Update SOS error:', err);
      Alert.alert('Lỗi', 'Không thể cập nhật trạng thái.');
    }
  };

  const progressPct = sosSignals.length > 0 
    ? Math.round((sosSignals.filter(s => ['COMPLETED', 'RESOLVED'].includes(s.status)).length / sosSignals.length) * 100) 
    : 0;

  const victimsFound = sosSignals.filter(s => ['COMPLETED', 'RESOLVED'].includes(s.status)).reduce((sum, s) => sum + (s.people_count || 0), 0);
  const totalPeople = sosSignals.reduce((sum, s) => sum + (s.people_count || 0), 0);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ─── 1. Mission header ──────────────────────────────────────────── */}
        <View style={[styles.missionHeader, isLeavingZone && styles.missionHeaderDanger]}>
          <View style={styles.missionBadgeRow}>
            <View style={[styles.activeBadge, isLeavingZone && { backgroundColor: '#FFD600' }]}><Text style={[styles.activeBadgeText, isLeavingZone && { color: '#000' }]}>● {isLeavingZone ? 'CẢNH BÁO VỊ TRÍ' : 'NHIỆM VỤ ĐANG THỰC HIỆN'}</Text></View>
          </View>
          
          <Text style={[styles.missionWarning, isLeavingZone && styles.missionWarningDanger]}>
            {isLeavingZone 
              ? `KHÔNG\nĐƯỢC RỜI\n${zoneName.toUpperCase()}` 
              : `BÁO CÁO\nTRẠNG THÁI\n${zoneName.toUpperCase()}`}
          </Text>
          
          {/* <Animated.Text style={[styles.missionTimer, { transform: [{ scale: pulse }], color: isLeavingZone ? '#FFD600' : RCOLORS.blockchain }]}>
            {timer}
          </Animated.Text>
          
          {isLeavingZone && (
            <Text style={styles.geofenceDesc}>Bạn đang di chuyển ra ngoài khu vực được phân công. Vui lòng quay lại ngay!</Text>
          )} */}
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
            {/* <StatBox label="KHOẢNG CÁCH"    value={isLeavingZone ? "> 600m" : "< 500m"}    color={isLeavingZone ? RCOLORS.primary : RCOLORS.statusGreen} /> */}
            <StatBox label="MỐI NGUY HIỂM"       value={sosSignals.filter(s => s.status === 'PENDING').length}    color={RCOLORS.primary} />
          </View>
        </View>

        {/* ─── 3. Navigation Shortcut ─────────────────────────────────────── */}
        <TouchableOpacity 
          style={styles.navShortcut}
          onPress={() => navigation.navigate('MapTab', { screen: 'MissionNavScreen', params: { targetLat: currentZone?.location_lat, targetLng: currentZone?.location_lng, zoneName } })}
        >
          <Text style={styles.navShortcutText}>📍 MỞ BẢN ĐỒ DẪN ĐƯỜNG</Text>
        </TouchableOpacity>

        {/* ─── 4. Task pipeline ───────────────────────────────────────────── */}
        <View style={styles.taskCard}>
          <Text style={styles.taskTitle}>YÊU CẦU CẦN XỬ LÝ TRONG VÙNG</Text>
          {sosSignals.length > 0 ? 
            sosSignals.slice(0, 5).map(task => {
              const isResolved = ['RESOLVED', 'COMPLETED'].includes(task.status);
              return (
                <View key={task.id} style={[styles.taskRow, !isResolved && styles.taskRowActive]}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskName}>{task.emergency_type}: {task.note || 'Yêu cầu'}</Text>
                    {!isResolved && <Text style={styles.taskPriority}>!</Text>}
                  </View>
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
            }) : (
              <Text style={styles.emptyText}>Chưa có tín hiệu SOS nào.</Text>
            )}
        </View>

        <TouchableOpacity
          style={styles.updateMainButton}
          onPress={() => {
            const myMission = otherMissions.find(m => m.rescuer === userInfo?.id);
            if (myMission?.id) {
              navigation.navigate('StatusUpdateScreen', { 
                missionId: myMission.id, 
                currentStatus: myMission.status 
              });
            } else {
              Alert.alert('⚠️ Không tìm thấy nhiệm vụ', 'Hệ thống không tìm thấy nhiệm vụ nào của bạn trong vùng này.');
            }
          }}
        >
          <Text style={styles.updateMainText}>⚙  Cập nhật trạng thái đội</Text>
        </TouchableOpacity>

      </ScrollView>
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

  missionHeader: { backgroundColor: RCOLORS.bgDark, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md },
  missionHeaderDanger: { backgroundColor: '#311B1B', borderWidth: 2, borderColor: RCOLORS.primary },
  missionBadgeRow: { flexDirection: 'row', gap: RSPACING.sm },
  activeBadge: { backgroundColor: RCOLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  activeBadgeText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },
  codeBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  codeBadgeText: { color: '#4CAF50', fontSize: RFONTS.xs, fontWeight: RFONTS.bold },
  missionWarning: { fontSize: RFONTS.xxl + 2, fontWeight: RFONTS.black, color: RCOLORS.textWhite, lineHeight: 34 },
  missionWarningDanger: { color: RCOLORS.primary },
  missionTimer: { fontSize: RFONTS.xxl + 6, fontWeight: RFONTS.black, letterSpacing: 2 },
  geofenceDesc: { color: '#FFD600', fontSize: RFONTS.sm, fontWeight: RFONTS.bold },

  progressCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  aiStatusBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RRADIUS.full },
  aiStatusText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: '#2E7D32' },
  progressTypeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressType: { fontSize: RFONTS.sm, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary },
  progressPct: { fontSize: RFONTS.sm, fontWeight: RFONTS.black, color: RCOLORS.primary },
  progressBg: { height: 8, backgroundColor: RCOLORS.bgApp, borderRadius: RRADIUS.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.full },
  statsGrid: { flexDirection: 'row', gap: RSPACING.sm },

  navShortcut: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, paddingVertical: 14, alignItems: 'center', ...RSHADOWS.elevated },
  navShortcutText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },

  taskCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  taskTitle: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1 },
  taskRow: { borderRadius: RRADIUS.sm, padding: RSPACING.md, gap: RSPACING.sm, borderWidth: 1, borderColor: RCOLORS.border },
  taskRowActive: { borderColor: RCOLORS.primary + '40', backgroundColor: RCOLORS.primaryLight },
  taskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskName: { fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary, flex: 1 },
  taskPriority: { fontSize: RFONTS.lg, fontWeight: RFONTS.black, color: RCOLORS.primary },
  taskActions: { flexDirection: 'row', gap: RSPACING.sm },
  completeBt: { flex: 1, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.sm, paddingVertical: 10, alignItems: 'center' },
  completeBtText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },

  updateMainButton: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: RRADIUS.md, paddingVertical: RSPACING.base, alignItems: 'center', borderWidth: 1, borderColor: RCOLORS.border },
  updateMainText: { color: RCOLORS.textSecondary, fontSize: RFONTS.base, fontWeight: RFONTS.semiBold },
  emptyText: { textAlign: 'center', color: RCOLORS.textHint, marginVertical: 10 },
});

const sbStyles = StyleSheet.create({
  box: { flex: 1, backgroundColor: RCOLORS.bgApp, borderRadius: RRADIUS.sm, padding: RSPACING.sm, alignItems: 'center', gap: 2 },
  value: { fontSize: RFONTS.lg, fontWeight: RFONTS.black },
  label: { fontSize: RFONTS.xs - 2, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, textAlign: 'center' },
});

export default ActiveMissionScreen;
