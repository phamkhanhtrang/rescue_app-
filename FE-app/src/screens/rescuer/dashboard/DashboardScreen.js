/**
 * src/screens/rescuer/dashboard/DashboardScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Tác chiến — Trung tâm Tác chiến Thực địa (Tab 1 TÁC CHIẾN).
 * Tối ưu hoá cho lực lượng cứu hộ:
 *  1. Thẻ Nhiệm vụ đang thực hiện (Hero Card) đặt trên cùng với nút Dẫn đường & Xử lý.
 *  2. Nếu rảnh việc: Hiển thị trạng thái Trực chiến & Danh sách SOS cần ứng cứu gần nhất.
 *  3. Nút Báo động Khẩn cấp (Panic Alert) gửi tín hiệu cầu cứu về BCH.
 *  4. Bản tin thiên tai đưa xuống dưới cùng làm tài liệu tham khảo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
  RefreshControl, Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { useAuth } from '../../../context/AuthContext';
import {
  RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT,
} from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import useLiveRefresh from '../../../hooks/useLiveRefresh';

const MISSION_STATUS_LABEL = {
  PENDING_ACCEPTANCE: 'Chờ tiếp nhận',
  ACCEPTED: 'Đã tiếp nhận',
  ON_MY_WAY: 'Đang di chuyển',
  ACTIVE: 'Đang thực hiện',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  NEEDS_HELP: '🚨 Cần chi viện',
};
const getMissionStatusText = (status) => MISSION_STATUS_LABEL[status] || status || 'Đang xử lý';

const formatDisplayName = (name, desc) => {
  if (!name) return desc || 'Khu vực cứu nạn';
  if (name.includes('Zone AI')) {
    if (desc && desc !== 'Hiện trường ngoài vùng tập trung' && desc !== 'Địa điểm chưa xác định cụ thể') {
      return `Vùng cứu hộ ${desc}`;
    }
    return name.replace(/Zone AI/i, 'Vùng cứu nạn trọng điểm');
  }
  return name;
};

const DashboardScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [zones, setZones] = useState([]);
  const [pendingSos, setPendingSos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [extraStats, setExtraStats] = useState({ completed: 0, staff: 1 });
  const [error, setError] = useState('');
  const [news, setNews] = useState([]);
  const [showNews, setShowNews] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Đồng ý',
    cancelText: 'Hủy',
    onConfirm: null,
  });

  const loadNews = useCallback(async isCurrent => {
    try {
      const result = await API.news.getPublished({ limit: 4 });
      if (!isCurrent()) return;
      setNews(result.results || []);
    } catch (_) {}
  }, []);
  useLiveRefresh(loadNews, 45000);

  const fetchData = async () => {
    try {
      const [zonesData, missionsData, resourcesData, sosData] = await Promise.all([
        API.zones.getAll(),
        API.missions.getAll({ rescuer_id: userInfo?.id }),
        API.resources.current(),
        API.sos.getAll().catch(() => ({ results: [] })),
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
          name: m.zone_name || 'Ca cứu hộ SOS đơn lẻ',
          description: matchedZone?.description || directSos?.address || directSos?.note || 'Hiện trường ngoài vùng tập trung',
          severity: matchedZone?.severity || 'HIGH',
          _mission: m,
          _isDirect: !m.zone,
        };
      });

      setZones(myZones);

      const completedCount = rawMissions.filter(m => m.status === 'COMPLETED').length;
      const totalStaff = resourcesData?.resource?.number_staff || 1;
      setExtraStats({ completed: completedCount, staff: totalStaff });

      // Lọc các SOS chưa có đội phụ trách
      const rawSos = Array.isArray(sosData) ? sosData : (sosData?.results || []);
      const unassigned = rawSos.filter(s =>
        !s.assigned_mission &&
        ['PENDING', 'ACKNOWLEDGED'].includes(s.status)
      ).slice(0, 4);
      setPendingSos(unassigned);

    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu điều hành tác chiến.');
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

  // Kích hoạt báo động chi viện khẩn cấp (có xác nhận chống bấm nhầm)
  const handlePanicHelp = () => {
    const activeM = zones[0]?._mission;
    setModalConfig({
      visible: true,
      type: 'warning',
      title: '🚨 XÁC NHẬN PHÁT TÍN HIỆU CHI VIỆN',
      message: 'Bạn có chắc chắn muốn phát tín hiệu báo động khẩn cấp về Ban Chỉ Huy & các đội lân cận?',
      confirmText: 'Phát báo động ngay',
      cancelText: 'Hủy bỏ',
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, visible: false }));
        if (activeM) {
          navigation.navigate('MissionsTab', {
            screen: 'ActiveMissionScreen',
            params: { missionId: activeM.id, autoPanic: true },
          });
        } else {
          navigation.navigate('MapTab');
        }
      },
    });
  };

  const topActiveMission = zones[0];

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
            <Text style={styles.loadingText}>Đang cập nhật tình hình tác chiến...</Text>
          </View>
        ) : (
          <>
            {/* ─── 1. HERO CARD: NHIỆM VỤ ĐANG PHỤ TRÁCH HOẶC TRỰC CHIẾN ─── */}
            {topActiveMission ? (
              <View style={styles.heroMissionCard}>
                <View style={styles.heroHeader}>
                  <View style={styles.heroBadge}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.heroBadgeText}>
                      {getMissionStatusText(topActiveMission._mission?.status).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.heroTimeLabel}>Nhiệm vụ trọng điểm</Text>
                </View>

                <Text style={styles.heroTitle}>{formatDisplayName(topActiveMission.name, topActiveMission.description)}</Text>
                <Text style={styles.heroDesc} numberOfLines={2}>
                  📍 {topActiveMission.description}
                </Text>

                <View style={styles.heroDivider} />

                {/* Các nút hành động chính */}
                <View style={styles.heroActionsRow}>
                  <TouchableOpacity
                    style={styles.heroBtnPrimary}
                    onPress={() => navigation.navigate('MissionsTab', {
                      screen: 'ActiveMissionScreen',
                      params: {
                        missionId: topActiveMission._mission?.id,
                        zoneId: topActiveMission._isDirect ? null : topActiveMission.id,
                        zoneName: topActiveMission.name,
                      }
                    })}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="shield-check" size={20} color="#FFF" />
                    <Text style={styles.heroBtnPrimaryText}>VÀO TÁC CHIẾN</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.heroBtnSecondary}
                    onPress={() => navigation.navigate('MapTab', {
                      screen: 'MissionNavScreen',
                      params: {
                        targetLat: topActiveMission.location_lat,
                        targetLng: topActiveMission.location_lng,
                        zoneName: topActiveMission.name,
                      }
                    })}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="navigation-variant" size={20} color={RCOLORS.primary} />
                    <Text style={styles.heroBtnSecondaryText}>DẪN ĐƯỜNG</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.standbyCard}>
                <View style={styles.standbyHeader}>
                  <View style={styles.standbyDot} />
                  <Text style={styles.standbyTitle}>ĐANG TRỰC CHIẾN · SẴN SÀNG NHẬN LỆNH</Text>
                </View>
                <Text style={styles.standbyDesc}>
                  Bạn chưa được chỉ định nhiệm vụ mới. Vui lòng theo dõi các ca SOS khẩn cấp bên dưới hoặc di chuyển theo hướng dẫn trên bản đồ.
                </Text>
              </View>
            )}

            {/* Nếu có thêm các nhiệm vụ khác đang phụ trách */}
            {zones.length > 1 && (
              <View style={styles.additionalMissionsBox}>
                <Text style={styles.subSectionTitle}>Ca cứu hộ khác đang phụ trách ({zones.length - 1})</Text>
                {zones.slice(1).map(zone => (
                  <TouchableOpacity
                    key={zone.id}
                    style={styles.compactMissionRow}
                    onPress={() => navigation.navigate('MissionsTab', {
                      screen: 'ActiveMissionScreen',
                      params: { missionId: zone._mission?.id, zoneName: zone.name }
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compactMissionTitle}>{zone.name}</Text>
                      <Text style={styles.compactMissionSub}>{getMissionStatusText(zone._mission?.status)}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color="#64748B" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ─── TÁC CHIẾN NGOẠI TUYẾN BLE (RADAR SONAR) ─── */}
            <TouchableOpacity
              style={styles.bleTacticalCard}
              onPress={() => navigation.navigate('RescuerOfflineScreen')}
              activeOpacity={0.88}
            >
              <View style={styles.bleTacticalIconWrap}>
                <MaterialCommunityIcons name="radar" size={28} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.bleTacticalTitle}>RADAR CỨU NẠN NGOẠI TUYẾN</Text>
                  <View style={styles.bleLiveBadge}>
                    <Text style={styles.bleLiveText}>BLE GRID</Text>
                  </View>
                </View>
                <Text style={styles.bleTacticalSub}>
                  Dò tìm phao cứu sinh 0xGP, đo cự ly RSSI, kích hoạt còi hú & đồng bộ khi mất mạng.
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#38BDF8" />
            </TouchableOpacity>

            {/* ─── 2. DANH SÁCH SOS CHƯA CÓ ĐỘI TIẾP NHẬN ─── */}
            {pendingSos.length > 0 && !topActiveMission && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Tín hiệu SOS cần ứng cứu</Text>
                  <View style={styles.urgentCountBadge}>
                    <Text style={styles.urgentCountText}>{pendingSos.length} ca chờ</Text>
                  </View>
                </View>

                {pendingSos.map(sos => (
                  <View key={sos.id} style={styles.sosCard}>
                    <View style={styles.sosHeader}>
                      <View style={styles.sosTypeBadge}>
                        <Text style={styles.sosTypeText}>{sos.emergency_type || 'SOS KHẨN CẤP'}</Text>
                      </View>
                      <Text style={styles.sosPeopleText}>👥 {sos.people_count || 1} người</Text>
                    </View>

                    <Text style={styles.sosAddress} numberOfLines={2}>
                      📍 {sos.address || sos.note || 'Địa điểm chưa xác định cụ thể'}
                    </Text>

                    <View style={styles.sosActionRow}>
                      <TouchableOpacity
                        style={styles.sosAcceptBtn}
                        onPress={() => {
                          if (sos.zone) {
                            navigation.navigate('MissionsTab', {
                              screen: 'ZoneDetailScreen',
                              params: { zoneId: sos.zone }
                            });
                          } else {
                            navigation.navigate('MapTab');
                          }
                        }}
                      >
                        <Text style={styles.sosAcceptText}>XEM & TIẾP NHẬN</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ─── 3. THỐNG KÊ & CHỈ SỐ NHANH ─── */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardLeft]}>
                <Text style={styles.statLabel}>CA ĐÃ HOÀN THÀNH</Text>
                <Text style={styles.statValue}>{extraStats.completed}</Text>
                <Text style={styles.statSub}>Đã cứu nạn thành công</Text>
              </View>

              <View style={[styles.statCard, styles.statCardRight]}>
                <Text style={styles.statLabel}>QUÂN SỐ NHÓM</Text>
                <Text style={styles.statValue}>{extraStats.staff}</Text>
                <Text style={styles.statSub}>Chiến sĩ trực chiến</Text>
              </View>
            </View>

            {/* ─── 4. LỐI TẮT TÁC CHIẾN ─── */}
            <View style={styles.quickGrid}>
              <TouchableOpacity
                style={styles.quickTile}
                onPress={() => navigation.navigate('MapTab')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialCommunityIcons name="map-marker-radius" size={26} color="#1D4ED8" />
                </View>
                <Text style={styles.quickTileLabel}>Bản đồ Hiện trường</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickTile}
                onPress={() => navigation.navigate('MissionsTab', { screen: 'ZoneListScreen' })}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: '#FDEAEA' }]}>
                  <MaterialCommunityIcons name="format-list-bulleted-square" size={26} color={RCOLORS.primary} />
                </View>
                <Text style={styles.quickTileLabel}>Danh sách Khu vực</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickTile}
                onPress={() => navigation.navigate('ResourceDeclareScreen')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialCommunityIcons name="package-variant-closed" size={26} color="#059669" />
                </View>
                <Text style={styles.quickTileLabel}>Khai báo Nguồn lực</Text>
              </TouchableOpacity>
            </View>

            {/* ─── 5. NÚT BÁO ĐỘNG KHẨN CẤP (FIELD PANIC BUTTON) ─── */}
            <TouchableOpacity
              style={styles.panicButton}
              onPress={handlePanicHelp}
              activeOpacity={0.85}
            >
              <View style={styles.panicIconBox}>
                <MaterialCommunityIcons name="alert-octagon" size={28} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panicTitle}>BÁO ĐỘNG CẦN CHI VIỆN KHẨN CẤP</Text>
                <Text style={styles.panicSub}>Phát tín hiệu nguy cấp về Ban Chỉ Huy & Đội lân cận</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            {/* ─── 6. BẢN TIN THIÊN TAI THAM KHẢO (ĐƯA XUỐNG ĐÁY) ─── */}
            {news.length > 0 && (
              <View style={styles.newsCollapseBox}>
                <TouchableOpacity
                  style={styles.newsCollapseHeader}
                  onPress={() => setShowNews(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="newspaper-variant-outline" size={20} color="#64748B" />
                    <Text style={styles.newsCollapseTitle}>Bản tin thiên tai tham khảo ({news.length})</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={showNews ? "chevron-up" : "chevron-down"}
                    size={22}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {showNews && (
                  <View style={styles.newsList}>
                    {news
                      .filter(item => item.title && !item.title.includes('1112122323') && !item.title.includes('OANTOAN'))
                      .map(item => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => navigation.navigate('NewsDetail', { newsId: item.id })}
                          style={styles.newsItem}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <View style={styles.newsBadge}>
                              <Text style={styles.newsBadgeText}>{item.source_platform || 'TIN TỨC'}</Text>
                            </View>
                            <Text style={styles.newsLocationText}>📍 {item.location || 'Toàn quốc'}</Text>
                          </View>
                          <Text style={styles.newsItemTitle} numberOfLines={2}>{item.title}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>
            )}

            {!!error && (
              <TouchableOpacity style={styles.errorCard} onPress={fetchData}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retryText}>CHẠM ĐỂ THỬ LẠI</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  scroll: { flex: 1 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 120, gap: 12 },
  loadingText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, fontWeight: '500' },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },

  // Hero Active Mission
  heroMissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderLeftWidth: 5,
    borderLeftColor: RCOLORS.primary,
    ...RSHADOWS.card,
    gap: 10,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RCOLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RRADIUS.full,
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RCOLORS.primary,
  },
  heroBadgeText: {
    color: RCOLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTimeLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: RCOLORS.textPrimary,
    lineHeight: 24,
  },
  heroDesc: {
    fontSize: 14,
    color: RCOLORS.textSecondary,
    lineHeight: 20,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  heroBtnPrimary: {
    flex: 1,
    backgroundColor: RCOLORS.primary,
    borderRadius: 10,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  heroBtnSecondary: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroBtnSecondaryText: {
    color: RCOLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },

  // Standby Ready Card
  standbyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderLeftWidth: 5,
    borderLeftColor: '#16A34A',
    ...RSHADOWS.card,
    gap: 8,
  },
  standbyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  standbyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  standbyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  standbyDesc: {
    fontSize: 13,
    color: RCOLORS.textSecondary,
    lineHeight: 19,
  },

  // Additional Missions
  additionalMissionsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    ...RSHADOWS.card,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  compactMissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  compactMissionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: RCOLORS.textPrimary,
  },
  compactMissionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  // SOS Section
  sectionContainer: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: RCOLORS.textPrimary,
  },
  urgentCountBadge: {
    backgroundColor: '#FDEAEA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentCountText: {
    color: RCOLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  sosCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    ...RSHADOWS.card,
  },
  sosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sosTypeBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sosTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  sosPeopleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  sosAddress: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  sosActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  sosAcceptBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sosAcceptText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 4,
    ...RSHADOWS.card,
  },
  statCardLeft: {
    borderTopWidth: 3,
    borderTopColor: RCOLORS.primary,
  },
  statCardRight: {
    borderTopWidth: 3,
    borderTopColor: '#1D4ED8',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: RCOLORS.textPrimary,
  },
  statSub: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },

  // Quick Grid
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
    ...RSHADOWS.card,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: RCOLORS.textPrimary,
    textAlign: 'center',
  },

  // Panic Button
  panicButton: {
    backgroundColor: RCOLORS.primary,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: RCOLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  panicIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panicTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  panicSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Collapsible News
  newsCollapseBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    ...RSHADOWS.card,
  },
  newsCollapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsCollapseTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  newsList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    gap: 8,
  },
  newsItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  newsBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  newsLocationText: {
    fontSize: 11,
    color: '#64748B',
  },
  newsItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: RCOLORS.textPrimary,
    lineHeight: 18,
  },
  newsItemMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  errorCard: {
    backgroundColor: '#FFF3F3',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: { color: RCOLORS.primary, fontSize: 13 },
  retryText: { color: RCOLORS.primary, fontSize: 11, fontWeight: '800', marginTop: 4 },

  bleTacticalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#0284C7',
    marginVertical: 4,
    shadowColor: '#0284C7',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bleTacticalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  bleTacticalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  bleLiveBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bleLiveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
  },
  bleTacticalSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 15,
  },
});

export default DashboardScreen;
