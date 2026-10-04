/**
 * src/screens/rescuer/dashboard/DashboardScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Điều hành — "Command Center" (Tab ĐIỀU HÀNH).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
  RefreshControl,
} from 'react-native';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { useAuth } from '../../../context/AuthContext';
import {
  RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT,
} from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const DashboardScreen = ({ navigation }) => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [extraStats, setExtraStats] = useState({ completed: 0, staff: 1 });
  const [aiRecommendation, setAiRecommendation] = useState(null); // Gợi ý AI cho Rescuer này
  const [error, setError] = useState('');
  const [news, setNews] = useState([]);
  const [newsError, setNewsError] = useState('');

  const loadNews = useCallback(async isCurrent => {
    try {
      const result = await API.news.getPublished({ limit: 5 });
      if (!isCurrent()) return;
      setNews(result.results || []);
      setNewsError('');
    } catch (e) {
      if (isCurrent()) setNewsError(e.message || 'Không tải được tin tức.');
    }
  }, []);
  useLiveRefresh(loadNews, 30000);

  const { userInfo } = useAuth();

  const fetchData = async () => {
    try {
      const [zonesData, missionsData, resourcesData] = await Promise.all([
        API.zones.getAll(),
        API.missions.getAll({ rescuer_id: userInfo?.id }),
        API.resources.current()
      ]);
      setError('');

      const rawMissions = Array.isArray(missionsData) ? missionsData : (missionsData?.results || []);
      const activeStatuses = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP'];
      const myMissions = rawMissions.filter(m => activeStatuses.includes(m.status));

      const rawZones = Array.isArray(zonesData) ? zonesData : (zonesData?.results || []);
      const myZones = myMissions.map(m => {
        const matchedZone = rawZones.find(z => z.id === m.zone);
        const directSos = m.sos?.[0];
        return {
          ...matchedZone,
          id: m.zone || m.id,
          name: m.zone_name || 'SOS đơn lẻ',
          description: matchedZone?.description || directSos?.address || directSos?.note || 'Ca cứu hộ ngoài vùng',
          severity: matchedZone?.severity || 'HIGH',
          _mission: m,
          _isDirect: !m.zone,
        };
      });

      setZones(myZones);

      const completedCount = rawMissions.filter(m => m.status === 'COMPLETED').length;
      const totalStaff = resourcesData?.resource?.number_staff || 0;
      setExtraStats({ completed: completedCount, staff: totalStaff });

      // Lấy gợi ý AI phân công (chỉ lấy 1 gợi ý phù hợp nhất cho Rescuer này)
      try {
        const aiData = await API.ai.getRecommendations(3);
        const recs = aiData?.recommendations || [];
        // Lọc gợi ý dành cho chính Rescuer này (không fallback sang người khác)
        const myRec = recs.find(r => r.rescuer_id === userInfo?.id) || null;
        setAiRecommendation(myRec);
      } catch (_) {
        // AI không ảnh hưởng luồng chính
      }

    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu điều hành.');
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
        <View style={{ marginBottom: 18, padding: 16, backgroundColor: RCOLORS.bgWhite, borderRadius: 16 }}>
          <Text style={{ fontWeight: '800', color: RCOLORS.textPrimary, marginBottom: 8 }}>BẢN TIN BÁO CHÍ THIÊN TAI</Text>
          {newsError ? <Text style={{ color: '#B91C1C' }}>{newsError}</Text> : news.length === 0 ? <Text style={{ color: '#64748B' }}>Chưa có tin đã xuất bản.</Text> : news.map(item => (
            <TouchableOpacity key={item.id} onPress={() => navigation.navigate('NewsDetail', { newsId: item.id })} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
              <Text style={{ fontWeight: '700', color: RCOLORS.textPrimary }} numberOfLines={2}>{item.title}</Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>{item.source_platform} · {item.location || 'Chưa rõ địa điểm'}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
                <Text style={styles.statLabel}>CA ĐÃ HOÀN THÀNH</Text>
                <Text style={styles.statValue}>{extraStats.completed}</Text>
                <Text style={styles.statSub}>Nhiệm vụ cứu hộ</Text>
              </View>
              <View style={[styles.statCard, styles.statCardRight]}>
                <Text style={styles.statLabel}>NHÂN SỰ TRONG NHÓM</Text>
                <Text style={styles.statValue}>{extraStats.staff}</Text>
                <Text style={styles.statSub}>Đang sẵn sàng</Text>
              </View>
            </View>

            {/* ─── 3. Security Status ─────────────────────────────────────────── */}
            {/* <View style={styles.securityCard}>
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
            </View> */}

            {/* ─── 4. Priority Watch Zones ────────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nhiệm vụ đang phụ trách</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{zones.length} ĐANG HOẠT ĐỘNG</Text>
              </View>
            </View>

            {zones.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons
                  name="email-open-outline"
                  size={48}
                  color="#999"
                />
                <Text style={styles.emptyText}>Chưa thực hiện nhiệm vụ nào</Text>
              </View>
            ) : (
              zones.map((zone) => (
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
                  <View style={styles.progressRow}><Text style={styles.progressLabel}>TRẠNG THÁI NHIỆM VỤ</Text><Text style={styles.progressValue}>{zone._mission?.status}</Text></View>
                  {/* Action button */}
                  <TouchableOpacity
                    style={[
                      styles.zoneAction,
                      { backgroundColor: zone.severity === 'CRITICAL' ? RCOLORS.primary : RCOLORS.bgBlue }
                    ]}
                    onPress={() => navigation.navigate('MissionsTab', {
                      screen: 'ActiveMissionScreen',
                      params: { missionId: zone._mission?.id, zoneId: zone._isDirect ? null : zone.id, zoneName: zone.name }
                    })}
                  >
                    <Text style={styles.zoneActionText}>
                      Chi tiết
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* ─── 5. AI Gợi ý Phân công ──────────────────────────────────── */}
            {aiRecommendation && (
              <TouchableOpacity
                style={styles.aiCard}
                onPress={() => navigation.navigate('MissionsTab', {
                  screen: 'ZoneDetailScreen',
                  params: { zoneId: aiRecommendation.zone_id, zoneName: aiRecommendation.zone_name }
                })}
                activeOpacity={0.85}
              >
                <View style={styles.aiCardHeader}>
                  <Text style={styles.aiCardTag}>🤖  AI GỢI Ý CHO BẠN</Text>
                  <View style={styles.aiScoreBadge}>
                    <Text style={styles.aiScoreText}>{aiRecommendation.match_score}đ</Text>
                  </View>
                </View>
                <Text style={styles.aiCardZone}>{aiRecommendation.zone_name}</Text>
                <View style={styles.aiCardReasons}>
                  {(aiRecommendation.reasons || []).map((r, i) => (
                    <Text key={i} style={styles.aiCardReason}>• {r}</Text>
                  ))}
                </View>
                <View style={styles.aiCardAction}>
                  <Text style={styles.aiCardActionText}>Xem chi tiết Zone →</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ─── 6. Quick actions ───────────────────────────────────────────── */}
            <View style={styles.quickRow}>
              <QuickAction
  icon="map-outline"
  label="Bản đồ"
  onPress={() => navigation.navigate('MapTab')}
/>

<QuickAction
  icon="clipboard-text-outline"
  label="Nhiệm vụ"
  onPress={() => navigation.navigate('MissionsTab')}
/>

<QuickAction
  icon="chart-box-outline"
  label="Xem báo cáo"
  onPress={() =>
    navigation.navigate('MissionsTab', {
      screen: 'MissionHistoryScreen',
    })
  }
/>
            </View>
            {!!error && <TouchableOpacity style={styles.errorCard} onPress={fetchData}><Text style={styles.errorText}>{error}</Text><Text style={styles.retryText}>CHẠM ĐỂ THỬ LẠI</Text></TouchableOpacity>}

            {/* ─── 6. Real-time intelligence ──────────────────────────────────── */}

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
    <MaterialCommunityIcons
  name={icon}
  size={24}
  color="#333"
/>
    <Text style={qaStyles.label}>{label}</Text>

  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  scroll: { flex: 1 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 32, gap: RSPACING.md },
  errorCard: { backgroundColor: '#FFF3F3', borderRadius: RRADIUS.md, padding: RSPACING.md, borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: RCOLORS.primary, fontSize: RFONTS.sm },
  retryText: { color: RCOLORS.primary, fontSize: RFONTS.xs, fontWeight: RFONTS.black, marginTop: 5 },

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

  emptyCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.xl, alignItems: 'center', justifyContent: 'center', gap: RSPACING.sm, ...RSHADOWS.card, minHeight: 120 },
  emptyIcon: { fontSize: 32, opacity: 0.6 },
  emptyText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, fontWeight: RFONTS.medium },

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

  // ── AI Recommendation Card ────────────────────────────────────────────
  aiCard: {
    backgroundColor: '#1A237E',
    borderRadius: RRADIUS.md,
    padding: RSPACING.base,
    gap: RSPACING.sm,
    ...RSHADOWS.card,
    borderLeftWidth: 4,
    borderLeftColor: '#7986CB',
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiCardTag: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  aiScoreBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: RRADIUS.full },
  aiScoreText: { fontSize: RFONTS.sm, fontWeight: RFONTS.black, color: '#fff' },
  aiCardZone: { fontSize: RFONTS.lg, fontWeight: RFONTS.bold, color: '#fff' },
  aiCardReasons: { gap: 2 },
  aiCardReason: { fontSize: RFONTS.xs, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },
  aiCardAction: { alignSelf: 'flex-start', marginTop: 2 },
  aiCardActionText: { fontSize: RFONTS.sm, fontWeight: RFONTS.bold, color: '#7986CB' },
});

const qaStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base, alignItems: 'center', gap: RSPACING.xs, ...RSHADOWS.card },
  icon: { fontSize: 24 },
  label: { fontSize: RFONTS.xs, fontWeight: RFONTS.semiBold, color: RCOLORS.textPrimary, textAlign: 'center' },
});

export default DashboardScreen;
