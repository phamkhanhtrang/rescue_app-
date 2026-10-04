/**
 * src/screens/rescuer/missions/ZoneDetailScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Chi tiết Vùng cứu hộ (Screen 6).
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';

const getSeverityLabel = (severity) => {
  const mapping = {
    'CRITICAL': 'NGUY CẤP: CẤP ĐỘ 5',
    'HIGH': 'CẢNH BÁO: CAO',
    'MEDIUM': 'TRUNG BÌNH',
    'LOW': 'THẤP',
  };
  return mapping[severity] || severity;
};

const ZoneDetailScreen = ({ navigation, route }) => {
  const { zoneId, zoneName: initialZoneName } = route?.params ?? {};
  const [zone, setZone] = useState(null);
  const [sosSignals, setSosSignals] = useState([]);
  const [missionsCount, setMissionsCount] = useState(0);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });
  const total = Math.max(0, (zone?.rescuers_needed || 0) - missionsCount);
  useEffect(() => {
    const fetchData = async () => {
      if (!zoneId) {
        setLoading(false);
        return;
      }
      try {
        const [zoneData, sosData, missionData] = await Promise.all([
          API.zones.getDetails(zoneId),
          API.sos.getAll({ zone: zoneId }),
          API.missions.getAll({ zone_id: zoneId })
        ]);
        setZone(zoneData);
        setSosSignals(sosData.results || []);
        const allMissions = missionData.results || [];
        const activeMissions = allMissions.filter(m => ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP'].includes(m.status));
        setMissions(allMissions);
        setMissionsCount(activeMissions.length);
      } catch (err) {
        console.error('Fetch detail error:', err);
        setError('Không thể tải thông tin.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [zoneId]);
  const NEEDD = [
    { id: 'RESCUE', roleName: 'Đội Cứu hộ', label: 'Cứu hộ' },
    { id: 'MEDICAL', roleName: 'Đội Y tế', label: 'Y tế' },
    { id: 'FOOD', roleName: 'Đội Hậu cần', label: 'Lương thực' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader showBack onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RCOLORS.primary} />
          <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayZone = zone || { name: initialZoneName || 'Vùng sự cố' };
  const severityColor = displayZone.severity === 'CRITICAL' ? RCOLORS.primary : RCOLORS.statusOrange;

  // Aggregate SOS needs
  const emergencyTypes = [...new Set(sosSignals.map(s => s.emergency_type).filter(Boolean))];
  const notes = sosSignals.map(s => s.note).filter(Boolean);
  const teamsNeeded = displayZone.rescuers_needed || 0;

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} showAvatar={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Image header ──────────────────────────────────────────────────── */}
        <View style={styles.imageHeader}>
          <View style={styles.zoneVisual}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={72} color="rgba(255,255,255,0.82)" />
            <Text style={styles.zoneVisualText}>KHU VỰC ĐIỀU PHỐI CỨU HỘ</Text>
          </View>
          <View style={[styles.levelBadge, { backgroundColor: severityColor }]}>
            <Text style={styles.levelBadgeText}>⚠ {getSeverityLabel(displayZone.severity)}</Text>
          </View>
          <View style={styles.zoneNameBox}>
            <Text style={styles.zoneNameText}>{displayZone.name?.toUpperCase()}</Text>
          </View>
        </View>

        {/* ── Địa chỉ ────────────────────────────────────────────────────────── */}
        <View style={styles.locationRow}>
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={20}
            color="#666"
          />
          <Text style={styles.locationText}>
            {displayZone.sector_code ? `Mã khu vực: ${displayZone.sector_code} · ` : ''}
            Tọa độ: {displayZone.location_lat}, {displayZone.location_lng}
          </Text>
        </View>

        {/* ── Nhu cầu cấp thiết ──────────────────────────────────────────────── */}
        <View style={styles.demandCard}>
          <Text style={styles.demandLabel}>Tổng số yêu cầu trong vùng</Text>
          <View style={styles.demandRow}>
            <Text style={styles.demandNumber}>{displayZone.people_affected || 0} Người</Text>
            <TouchableOpacity
              style={styles.sosMini}
              onPress={() =>
                setModalConfig({
                  visible: true,
                  type: 'info',
                  title: 'Chi tiết SOS',
                  message: notes.join('\n\n') || 'Không có ghi chú cụ thể.',
                })
              }
            >
              <Text style={styles.sosMiniText}>SOS</Text>
            </TouchableOpacity>
          </View>


          <Text style={styles.demandDesc}>
            <Text style={styles.demandUrgent}>Tổng hợp ghi chú: </Text>
            {notes.length > 0 ? notes[0] : (displayZone.description || 'Chưa có mô tả.')}
            {notes.length > 1 ? ` (+${notes.length - 1} yêu cầu khác)` : ''}
          </Text>
        </View>

        {/* ── Đội NGK ────────────────────────────────────────────────────────── */}
        <View style={styles.teamsSection}>
          <Text style={styles.teamsLabel}>ĐỘI NGŨ HIỆN TẠI</Text>
          <Text style={styles.teamsSub}>
            Cần điều động thêm {total} đội cứu hộ
          </Text>
          {/* <View style={styles.teamAvatars}>
            {['T1', 'T2', 'T3', 'T4'].map((t, i) => (
              <View key={t} style={[styles.teamAvatar, { marginLeft: i > 0 ? -10 : 0 }]}>
                <Text style={styles.teamAvatarText}>{t}</Text>
              </View>
            ))}
            <View style={styles.teamMoreBadge}>
              <Text style={styles.teamMoreText}>+2</Text>
            </View>
          </View> */}
        </View>

        {/* ── Nhân lực cần ──────────────────────────────────────────────────── */}
        <View style={styles.personnelList}>
          <View style={styles.personnelRow}>

            <View style={styles.personnelInfo}>
              <Text style={styles.personnelLabel}>Tổng đội cứu hộ cần thiết</Text>
              <Text style={styles.personnelSub}>
                Yêu cầu khẩn cấp: {NEEDD.map(n => {
                  const isRequested = sosSignals.some(s => s.emergency_type?.toUpperCase() === n.id.toUpperCase());
                  if (!isRequested) return null;

                  const activeMissionCount = missions.filter(m => {
                    const r = m.role?.toLowerCase() || '';
                    return (r.includes(n.label.toLowerCase()) || r.includes(n.roleName.toLowerCase())) &&
                      ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP'].includes(m.status);
                  }).length;

                  return activeMissionCount > 0
                    ? `${n.label} (đã có ${activeMissionCount})`
                    : `${n.label} (chưa có)`;
                }).filter(Boolean).join(', ') || 'Chưa có yêu cầu cụ thể'}
              </Text>
            </View>
            <View style={[styles.personnelStatus, { backgroundColor: (missionsCount >= teamsNeeded && teamsNeeded > 0) ? '#E8F5E9' : RCOLORS.primaryLight }]}>
              <Text style={[styles.personnelStatusText, { color: (missionsCount >= teamsNeeded && teamsNeeded > 0) ? RCOLORS.statusGreen : RCOLORS.primary }]}>
                {displayZone.rescuers_needed > 0 ? `${missionsCount}/${displayZone.rescuers_needed} ĐỘI` : 'Chưa có'}
              </Text>
              {displayZone.severity === 'CRITICAL' && missionsCount < teamsNeeded && <Text style={styles.urgentLabel}>CẦN GẤP</Text>}
            </View>
          </View>
        </View>

        {/* ── Join button ───────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => navigation.navigate('JoinConfirmScreen', { 
            zoneId: displayZone.id, 
            zoneName: displayZone.name,
            missionsCount: missionsCount,
            rescuersNeeded: displayZone.rescuers_needed
          })}
        >
          <MaterialCommunityIcons
            name="lightning-bolt-outline"
            size={22}
            color="#dcb30eff"
          />
          <Text style={styles.joinText}>THAM GIA VÙNG CỨU HỘ</Text>
        </TouchableOpacity>

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary },
  content: { paddingBottom: 32, gap: RSPACING.md },

  imageHeader: { height: 190, position: 'relative', overflow: 'hidden', backgroundColor: '#1A2E40' },
  zoneVisual: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 34 },
  zoneVisualText: { color: 'rgba(255,255,255,0.72)', fontSize: RFONTS.xs, fontWeight: RFONTS.black, letterSpacing: 1.4 },
  imageBg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageBgText: { fontSize: 80 },
  levelBadge: { position: 'absolute', top: RSPACING.base, left: RSPACING.base, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RRADIUS.full },
  levelBadgeText: { color: RCOLORS.textWhite, fontSize: RFONTS.xs, fontWeight: RFONTS.black, letterSpacing: 0.5 },
  zoneNameBox: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: RLAYOUT.screenPadding, backgroundColor: 'rgba(13,26,45,0.75)' },
  zoneNameText: { color: RCOLORS.textWhite, fontSize: RFONTS.xxl, fontWeight: RFONTS.black, lineHeight: 32 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: RLAYOUT.screenPadding },
  locationIcon: { fontSize: 14 },
  locationText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary },

  demandCard: { marginHorizontal: RLAYOUT.screenPadding, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.sm, ...RSHADOWS.card },
  demandLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1.5 },
  demandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  demandNumber: { fontSize: RFONTS.lg, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  sosMini: { backgroundColor: RCOLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RRADIUS.sm, ...RSHADOWS.redGlow },
  sosMiniText: { color: RCOLORS.textWhite, fontSize: RFONTS.base, fontWeight: RFONTS.black, letterSpacing: 1 },
  demandSub: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1 },
  demandBar: { height: 5, backgroundColor: RCOLORS.bgApp, borderRadius: RRADIUS.full, overflow: 'hidden' },
  demandBarFill: { height: '100%', backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.full },
  demandDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  demandUrgent: { fontWeight: RFONTS.bold, color: RCOLORS.primary },

  blockchainCard: { marginHorizontal: RLAYOUT.screenPadding, backgroundColor: '#E8F5E9', borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm, borderLeftWidth: 4, borderLeftColor: RCOLORS.statusGreen },
  blockchainLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.statusGreen, letterSpacing: 1 },
  blockchainRow: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm },
  blockchainIcon: { fontSize: 18 },
  blockchainHash: { fontSize: RFONTS.sm, fontWeight: RFONTS.medium, color: RCOLORS.textPrimary },
  blockchainVerified: { fontSize: RFONTS.sm, color: RCOLORS.statusGreen, fontWeight: RFONTS.semiBold, marginTop: 2 },

  teamsSection: { marginHorizontal: RLAYOUT.screenPadding, gap: RSPACING.sm },
  teamsLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1 },
  teamsSub: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary },
  teamAvatars: { flexDirection: 'row', alignItems: 'center' },
  teamAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: RCOLORS.bgBlue, borderWidth: 2, borderColor: RCOLORS.bgWhite, alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { color: RCOLORS.textWhite, fontSize: RFONTS.xs, fontWeight: RFONTS.bold },
  teamMoreBadge: { marginLeft: RSPACING.sm, backgroundColor: RCOLORS.bgApp, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RRADIUS.full, borderWidth: 1, borderColor: RCOLORS.border },
  teamMoreText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary },

  personnelList: { marginHorizontal: RLAYOUT.screenPadding, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, overflow: 'hidden', ...RSHADOWS.card },
  personnelRow: { flexDirection: 'row', alignItems: 'center', padding: RSPACING.base, borderBottomWidth: 1, borderBottomColor: RCOLORS.border, gap: RSPACING.sm },
  personnelIcon: { fontSize: 22 },
  personnelInfo: { flex: 1 },
  personnelLabel: { fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary },
  personnelSub: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, marginTop: 2 },
  personnelStatus: { borderRadius: RRADIUS.sm, padding: RSPACING.sm, alignItems: 'center', minWidth: 80 },
  personnelStatusText: { fontSize: RFONTS.xs, fontWeight: RFONTS.black, letterSpacing: 0.3 },
  urgentLabel: { fontSize: RFONTS.xs - 2, color: RCOLORS.primary, fontWeight: RFONTS.bold, marginTop: 2 },

  joinButton: { marginHorizontal: RLAYOUT.screenPadding, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: RSPACING.sm, ...RSHADOWS.redGlow },
  joinIcon: { fontSize: 18 },
  joinText: { color: RCOLORS.textWhite, fontSize: RFONTS.lg, fontWeight: RFONTS.black, letterSpacing: 0.5 },
});

export default ZoneDetailScreen;
