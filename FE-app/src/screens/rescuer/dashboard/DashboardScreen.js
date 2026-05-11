/**
 * src/screens/rescuer/dashboard/DashboardScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Điều hành — "Command Center" (Tab ĐIỀU HÀNH).
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
  RefreshControl,
} from 'react-native';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import {
  RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT,
} from '../../../constants/rescuer/theme';
import API from '../../../services/api'; 

const AI_INSIGHTS = [
  {
    icon: '🤖',
    text: 'AI dự đoán tỷ lệ thành công 76% tại khu vực Delta. Đang điều động đội SENTINEL-13.',
  },
  {
    icon: '⛓',
    text: 'Xác thực Blockchain: Nhật ký cứu hộ #AZ-98 đã được xác nhận bởi 3 nút.',
  },
];

const UNIT_DISTRIBUTION = [
  { label: 'Tìm kiếm & Cứu nạn', count: 43, color: RCOLORS.primary, pct: 0.70 },
  { label: 'Hỗ trợ Y tế',  count: 18, color: RCOLORS.bgBlue,  pct: 0.30 },
];

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsData, zonesData] = await Promise.all([
        API.zones.getDashboardStats(),
        API.zones.getAll({ limit: 2 })
      ]);
      setStats(statsData);
      setZones(zonesData.results || []);
    } catch (err) {
      console.error('Fetch dashboard data error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} color={RCOLORS.primary} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={RCOLORS.primary} />
          </View>
        ) : (
          <>
            {/* ─── 1. Title ───────────────────────────────────────────────────── */}
            <View style={styles.titleSection}>
              <Text style={styles.opLabel}>TỔNG QUAN VẬN HÀNH</Text>
              <Text style={styles.pageTitle}>Trung tâm Điều hành</Text>
            </View>

            {/* ─── 2. Stats row ───────────────────────────────────────────────── */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardLeft]}>
                <Text style={styles.statLabel}>VÙNG GIÁM SÁT</Text>
                <Text style={styles.statValue}>{stats?.total_zones || 0}</Text>
                <Text style={styles.statSub}>{stats?.critical_zones || 0} vùng nguy cấp</Text>
              </View>
              <View style={[styles.statCard, styles.statCardRight]}>
                <Text style={styles.statLabel}>NHÂN VIÊN ĐANG TRỰC</Text>
                <Text style={styles.statValue}>{stats?.total_rescuers || 0}</Text>
                <Text style={styles.statSub}>92% Sẵn sàng vận hành</Text>
              </View>
            </View>

            {/* ─── 3. Security Status ─────────────────────────────────────────── */}
            <View style={styles.securityCard}>
              <Text style={styles.securityLabel}>TRẠNG THÁI AN NINH</Text>
              <View style={styles.securityRow}>
                <View style={styles.alertDot} />
                <Text style={styles.securityText}>
                  {stats?.critical_zones > 0 ? 'NGUY CƠ CAO' : 'BÌNH THƯỜNG'}
                </Text>
              </View>
              <View style={styles.highAlertBadge}>
                <Text style={styles.highAlertText}>
                  {stats?.critical_zones > 0 ? '⚠ CẢNH BÁO ĐỎ' : '✓ AN TOÀN'}
                </Text>
              </View>
            </View>

            {/* ─── 4. Priority Watch Zones ────────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vùng Theo dõi Ưu tiên</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{zones.length} ĐANG HOẠT ĐỘNG</Text>
              </View>
            </View>

            {zones.map((zone) => (
              <View key={zone.id} style={styles.zoneCard}>
                <View style={styles.zoneHeader}>
                  <View style={styles.zoneIconBox}>
                    <Text style={styles.zoneIcon}>{zone.incident_type === 'Flood' ? '🌊' : '🎯'}</Text>
                  </View>
                  <View style={styles.zoneInfo}>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    <Text style={styles.zoneDesc} numberOfLines={1}>{zone.description}</Text>
                  </View>
                </View>
                {/* Progress (Mocked) */}
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>TIẾN ĐỘ</Text>
                  <Text style={styles.progressValue}>{zone.severity === 'CRITICAL' ? '20%' : '60%'}</Text>
                </View>
                <View style={styles.progressBg}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: zone.severity === 'CRITICAL' ? '20%' : '60%', 
                        backgroundColor: zone.severity === 'CRITICAL' ? RCOLORS.primary : RCOLORS.statusOrange 
                      }
                    ]} 
                  />
                </View>
                {/* Action button */}
                <TouchableOpacity
                  style={[
                    styles.zoneAction, 
                    { backgroundColor: zone.severity === 'CRITICAL' ? RCOLORS.primary : RCOLORS.bgBlue }
                  ]}
                  onPress={() => navigation.navigate('MissionsTab', { 
                    screen: 'ZoneDetailScreen',
                    params: { zoneId: zone.id, zoneName: zone.name }
                  })}
                >
                  <Text style={styles.zoneActionText}>
                    {zone.severity === 'CRITICAL' ? 'Triển khai' : 'Giám sát'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* ─── 5. Quick actions ───────────────────────────────────────────── */}
            <View style={styles.quickRow}>
              <QuickAction icon="🗺" label="Bản đồ" onPress={() => navigation.navigate('MapTab')} />
              <QuickAction icon="📋" label="Nhiệm vụ" onPress={() => navigation.navigate('MissionsTab')} />
              <QuickAction icon="📊" label="Xem báo cáo" onPress={() => navigation.navigate('MissionsTab', { screen: 'MissionHistoryScreen' })} />
            </View>

            {/* ─── 6. Real-time intelligence ──────────────────────────────────── */}
            <View style={styles.rtiCard}>
              <View style={styles.rtiHeader}>
                <View style={styles.rtiDot} />
                <Text style={styles.rtiTitle}>DỮ LIỆU TỨC THỜI (RTI)</Text>
              </View>
              {AI_INSIGHTS.map((insight, idx) => (
                <View key={idx} style={styles.insightRow}>
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                  <Text style={styles.insightText}>{insight.text}</Text>
                </View>
              ))}
              <View style={styles.rtiImagePlaceholder}>
                <Text style={styles.rtiImageText}>📡  Dữ liệu Cảm biến Trực tiếp</Text>
              </View>
            </View>

            {/* ─── 7. Unit Distribution ───────────────────────────────────────── */}
            <View style={styles.unitCard}>
              <Text style={styles.unitTitle}>Phân bổ Đội ngũ</Text>
              {UNIT_DISTRIBUTION.map((unit, idx) => (
                <View key={idx} style={styles.unitRow}>
                  <Text style={styles.unitLabel}>{unit.label}</Text>
                  <View style={styles.unitBarBg}>
                    <View style={[styles.unitBarFill, { width: `${unit.pct * 100}%`, backgroundColor: unit.color }]} />
                  </View>
                  <Text style={styles.unitCount}>{unit.count}</Text>
                </View>
              ))}
            </View>

            {/* ─── Resource Declare button ─────────────────────────────────────── */}
            <TouchableOpacity
              style={styles.resourceButton}
              onPress={() => navigation.navigate('ResourceDeclareScreen')}
            >
              <Text style={styles.resourceIcon}>📦</Text>
              <Text style={styles.resourceText}>Khai báo Nguồn lực</Text>
              <Text style={styles.resourceArrow}>›</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const QuickAction = ({ icon, label, onPress }) => (
  <TouchableOpacity style={qaStyles.card} onPress={onPress} activeOpacity={0.8}>
    <Text style={qaStyles.icon}>{icon}</Text>
    <Text style={qaStyles.label}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  scroll: { flex: 1 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 32, gap: RSPACING.md },

  titleSection: { gap: RSPACING.xs },
  opLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1.5 },
  pageTitle: { fontSize: RFONTS.xxl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },

  statsRow: { flexDirection: 'row', gap: RSPACING.md },
  statCard: { flex: 1, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.xs, ...RSHADOWS.card },
  statCardLeft: { borderTopWidth: 3, borderTopColor: RCOLORS.primary },
  statCardRight: { borderTopWidth: 3, borderTopColor: RCOLORS.bgBlue },
  statLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 1 },
  statValue: { fontSize: RFONTS.hero, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  statSub: { fontSize: RFONTS.xs, color: RCOLORS.statusGreen, fontWeight: RFONTS.medium },

  securityCard: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.sm, ...RSHADOWS.redGlow },
  securityLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm },
  alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF8A80' },
  securityText: { fontSize: RFONTS.xl, fontWeight: RFONTS.black, color: RCOLORS.textWhite },
  highAlertBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  highAlertText: { color: RCOLORS.textWhite, fontSize: RFONTS.xs, fontWeight: RFONTS.bold },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  liveBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RRADIUS.full },
  liveBadgeText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.statusGreen },

  zoneCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  zoneHeader: { flexDirection: 'row', gap: RSPACING.sm, alignItems: 'flex-start' },
  zoneIconBox: { width: 36, height: 36, borderRadius: RRADIUS.sm, backgroundColor: RCOLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  zoneIcon: { fontSize: 18 },
  zoneInfo: { flex: 1 },
  zoneName: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  zoneDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, fontWeight: RFONTS.semiBold },
  progressValue: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  progressBg: { height: 6, backgroundColor: RCOLORS.bgApp, borderRadius: RRADIUS.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: RRADIUS.full },
  zoneAction: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 7, borderRadius: RRADIUS.sm },
  zoneActionText: { color: RCOLORS.textWhite, fontSize: RFONTS.sm, fontWeight: RFONTS.bold },

  quickRow: { flexDirection: 'row', gap: RSPACING.md },

  rtiCard: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.md },
  rtiHeader: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm },
  rtiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RCOLORS.statusGreen },
  rtiTitle: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  insightRow: { flexDirection: 'row', gap: RSPACING.sm, alignItems: 'flex-start' },
  insightIcon: { fontSize: 14, marginTop: 1 },
  insightText: { flex: 1, fontSize: RFONTS.sm, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  rtiImagePlaceholder: { height: 90, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: RRADIUS.md, alignItems: 'center', justifyContent: 'center' },
  rtiImageText: { color: 'rgba(255,255,255,0.4)', fontSize: RFONTS.sm },

  unitCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.md, ...RSHADOWS.card },
  unitTitle: { fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  unitRow: { gap: RSPACING.sm },
  unitLabel: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, fontWeight: RFONTS.medium },
  unitBarBg: { height: 8, backgroundColor: RCOLORS.bgApp, borderRadius: RRADIUS.full, overflow: 'hidden', flex: 1 },
  unitBarFill: { height: '100%', borderRadius: RRADIUS.full },
  unitCount: { fontSize: RFONTS.sm, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary, minWidth: 24, textAlign: 'right' },

  resourceButton: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.base, flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm, ...RSHADOWS.card },
  resourceIcon: { fontSize: 20 },
  resourceText: { flex: 1, fontSize: RFONTS.base, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary },
  resourceArrow: { fontSize: RFONTS.xl, color: RCOLORS.textHint },
});

const qaStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base, alignItems: 'center', gap: RSPACING.xs, ...RSHADOWS.card },
  icon: { fontSize: 24 },
  label: { fontSize: RFONTS.xs, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary, textAlign: 'center' },
});

export default DashboardScreen;
