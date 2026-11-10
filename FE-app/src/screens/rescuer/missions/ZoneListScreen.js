/**
 * src/screens/rescuer/missions/ZoneListScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Danh sách Vùng Cứu Hộ Hoạt Động (Tab 3: KHU VỰC).
 * Tối ưu hóa tác chiến thực địa:
 *  - Bộ lọc thông minh: Tất cả, Nguy cấp, Thiếu quân số, Gần nhất.
 *  - Tính khoảng cách GPS thời gian thực (Haversine) sắp xếp gần -> xa.
 *  - Cảnh báo thiếu hụt nhân lực cứu hộ (Shortage badge).
 *  - Phím tắt 1-chạm Dẫn đường GPS đến toạ độ tâm vùng sự cố.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { useAuth } from '../../../context/AuthContext';
import {
  RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT,
} from '../../../constants/rescuer/theme';
import API from '../../../services/api';

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const getSeverityInfo = (severity) => {
  switch (severity) {
    case 'CRITICAL':
      return { color: RCOLORS.primary, bg: '#FEF2F2', border: '#FCA5A5', label: 'Nguy cấp', icon: 'alert-decagram' };
    case 'HIGH':
      return { color: RCOLORS.statusOrange, bg: '#FFF7ED', border: '#FDBA74', label: 'Cực kỳ cao', icon: 'alert' };
    case 'MEDIUM':
      return { color: RCOLORS.statusBlue, bg: '#EFF6FF', border: '#93C5FD', label: 'Trung bình', icon: 'alert-circle-outline' };
    case 'LOW':
      return { color: RCOLORS.statusGreen, bg: '#F0FDF4', border: '#86EFAC', label: 'Thấp', icon: 'shield-check-outline' };
    default:
      return { color: RCOLORS.textSecondary, bg: '#F8FAFC', border: '#CBD5E1', label: 'Đang theo dõi', icon: 'information-outline' };
  }
};

const ZoneListScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Bộ lọc & tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'SHORTAGE' | 'NEAREST'

  const fetchZones = async () => {
    try {
      const [zonesRes, sosRes] = await Promise.all([
        API.zones.getAll(),
        API.sos.getAll(),
      ]);
      let fetchedZones = zonesRes.results || zonesRes || [];
      const fetchedSos = sosRes.results || sosRes || [];

      // Lọc các SOS còn hoạt động
      const activeSos = fetchedSos.filter(s => ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(s.status));

      // Lọc các vùng chưa hoàn tất và có SOS cần cứu trợ
      fetchedZones = fetchedZones.filter(z => {
        if (z.status === 'RESOLVED') return false;
        const hasActiveSOS = activeSos.some(s => {
          const zId = typeof s.zone === 'object' ? s.zone?.id : s.zone;
          return zId === z.id;
        });
        return hasActiveSOS;
      });

      // Lấy toạ độ GPS của lực lượng cứu nạn
      let rLat = parseFloat(userInfo?.rescuer_profile?.current_lat || userInfo?.profile?.current_lat || 0);
      let rLng = parseFloat(userInfo?.rescuer_profile?.current_lng || userInfo?.profile?.current_lng || 0);

      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getLastKnownPositionAsync({});
          if (!location) location = await Location.getCurrentPositionAsync({});
          if (location) {
            rLat = location.coords.latitude;
            rLng = location.coords.longitude;
          }
        }
      } catch (locErr) {
        // Fallback GPS vị trí mặc định từ tài khoản
      }

      fetchedZones = fetchedZones.map(z => {
        const zLat = parseFloat(z.location_lat || 0);
        const zLng = parseFloat(z.location_lng || 0);
        let dist = null;
        if (rLat && rLng && zLat && zLng) {
          dist = calculateDistance(rLat, rLng, zLat, zLng);
        }

        // Đếm số SOS thực tế trong vùng này
        const zoneSosList = activeSos.filter(s => {
          const zId = typeof s.zone === 'object' ? s.zone?.id : s.zone;
          return zId === z.id;
        });

        const activeCount = zoneSosList.length;
        const rescuersAssigned = Number(z.rescuers_count || 0);
        const rescuersNeeded = Number(z.rescuers_needed || 1);
        const isShortage = rescuersNeeded > rescuersAssigned;

        return {
          ...z,
          distance: dist,
          activeSosCount: activeCount,
          isShortage,
          shortageCount: Math.max(0, rescuersNeeded - rescuersAssigned),
        };
      });

      // Mặc định sắp xếp theo khoảng cách (gần nhất lên đầu)
      fetchedZones.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });

      setZones(fetchedZones);
      setError(null);
    } catch (err) {
      console.error('Fetch zones error:', err);
      setError('Không thể tải danh sách vùng sự cố.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchZones();
  }, []);

  // Áp dụng bộ lọc và tìm kiếm
  const filteredZones = useMemo(() => {
    return zones.filter(zone => {
      // Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = zone.name?.toLowerCase().includes(q);
        const matchDesc = zone.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }

      // Bộ lọc danh mục
      if (activeFilter === 'CRITICAL') {
        return zone.severity === 'CRITICAL';
      }
      if (activeFilter === 'SHORTAGE') {
        return zone.isShortage;
      }
      return true;
    });
  }, [zones, searchQuery, activeFilter]);

  const navigateToMap = (lat, lng, name) => {
    if (!lat || !lng) return;
    navigation.navigate('MapTab', {
      screen: 'MissionNavScreen',
      params: { targetLat: parseFloat(lat), targetLng: parseFloat(lng), zoneName: name },
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RCOLORS.primary} />
          <Text style={styles.loadingText}>Đang dò quét các vùng sự cố...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RCOLORS.primary} />
        }
      >
        {/* ─── 1. TIÊU ĐỀ & THANH TRẠNG THÁI ──────────────────────────── */}
        <View style={styles.headerBlock}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>CẬP NHẬT TÁC CHIẾN TRỰC TIẾP</Text>
          </View>
          <Text style={styles.pageTitle}>Vùng Cứu Hộ Đang Hoạt Động</Text>
          <Text style={styles.pageDesc}>
            Theo dõi phân bổ lực lượng và tình trạng khẩn cấp tại các điểm nóng thiên tai.
          </Text>
        </View>

        {/* ─── 2. TÌM KIẾM & BỘ LỌC TÁC CHIẾN ────────────────────────── */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={RCOLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên vùng, địa bàn, sự cố..."
            placeholderTextColor={RCOLORS.textHint}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={RCOLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'ALL' && styles.filterChipTextActive]}>
              Tất cả ({zones.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'CRITICAL' && styles.filterChipActive]}
            onPress={() => setActiveFilter('CRITICAL')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'CRITICAL' && styles.filterChipTextActive]}>
              🔴 Nguy cấp ({zones.filter(z => z.severity === 'CRITICAL').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'SHORTAGE' && styles.filterChipActive]}
            onPress={() => setActiveFilter('SHORTAGE')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'SHORTAGE' && styles.filterChipTextActive]}>
              ⚠️ Cần chi viện ({zones.filter(z => z.isShortage).length})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchZones}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── 3. DANH SÁCH VÙNG SỰ CỐ ─────────────────────────────────── */}
        {filteredZones.length === 0 && !error && (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="shield-check" size={48} color={RCOLORS.statusGreen} />
            <Text style={styles.emptyTitle}>Không có vùng sự cố phù hợp</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Không tìm thấy vùng nào khớp với từ khóa tìm kiếm.' : 'Hiện không có vùng thiên tai nào cần tiếp ứng.'}
            </Text>
          </View>
        )}

        {filteredZones.map(zone => {
          const sev = getSeverityInfo(zone.severity);

          return (
            <View key={zone.id} style={styles.zoneCard}>
              {/* Thẻ trên: Tiêu đề + Mức độ + Khoảng cách */}
              <View style={styles.zoneTop}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.zoneBadgeRow}>
                    <View style={[styles.severityBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
                      <MaterialCommunityIcons name={sev.icon} size={13} color={sev.color} />
                      <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
                    </View>
                    {zone.distance !== null && (
                      <View style={styles.distBadge}>
                        <MaterialCommunityIcons name="crosshairs-gps" size={13} color={RCOLORS.bgBlue} />
                        <Text style={styles.distBadgeText}>
                          {zone.distance < 1 ? `${Math.round(zone.distance * 1000)} m` : `${zone.distance.toFixed(1)} km`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.zoneName} numberOfLines={2}>
                    {zone.name?.includes('Zone AI')
                      ? (zone.description && !zone.description.includes('ngoài vùng tập trung')
                          ? `Khu vực ${zone.description}`
                          : zone.name.replace(/Zone AI/i, 'Vùng cứu hộ trọng điểm'))
                      : zone.name}
                  </Text>
                </View>
              </View>

              {/* Tình trạng lực lượng & Nhu cầu cứu nạn */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>{zone.activeSosCount ?? zone.rescuers_needed ?? 0}</Text>
                  <Text style={styles.metricLabel}>Điểm SOS</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>{zone.people_affected || 0}</Text>
                  <Text style={styles.metricLabel}>Người ảnh hưởng</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>{zone.rescuers_count || 0} đội</Text>
                  <Text style={styles.metricLabel}>Đang tác chiến</Text>
                </View>
              </View>

              {/* Huy hiệu thiếu hụt quân số */}
              {zone.isShortage ? (
                <View style={styles.shortageBanner}>
                  <MaterialCommunityIcons name="account-alert" size={16} color={RCOLORS.primary} />
                  <Text style={styles.shortageText}>
                    CẦN CHI VIỆN: Thiếu khoảng {zone.shortageCount} đội cứu hộ tại vùng này
                  </Text>
                </View>
              ) : (
                <View style={styles.sufficientBanner}>
                  <MaterialCommunityIcons name="account-check" size={16} color={RCOLORS.statusGreen} />
                  <Text style={styles.sufficientText}>Lực lượng cứu nạn đang kiểm soát ổn định</Text>
                </View>
              )}

              {/* Cụm nút hành động */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.detailBtn}
                  onPress={() => navigation.navigate('ZoneDetailScreen', { zoneId: zone.id, zoneName: zone.name })}
                >
                  <Text style={styles.detailBtnText}>XEM CHI TIẾT & TIẾP NHẬN</Text>
                </TouchableOpacity>

                {zone.location_lat && zone.location_lng && (
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={() => navigateToMap(zone.location_lat, zone.location_lng, zone.name)}
                  >
                    <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFF" />
                    <Text style={styles.navBtnText}>Dẫn đường</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* ─── 4. AI SENTINEL PHÂN TÍCH ƯU TIÊN ────────────────────────── */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIconBox}>
              <MaterialCommunityIcons name="robot-excited-outline" size={18} color="#FFF" />
            </View>
            <Text style={styles.aiLabel}>PHÂN TÍCH ƯU TIÊN CỨU HỘ</Text>
          </View>
          <Text style={styles.aiTitle}>Khuyến nghị điều phối lực lượng</Text>
          <Text style={styles.aiDesc}>
            Các vùng được đánh dấu "Nguy cấp" và đang thiếu hụt đội ngũ cần được ưu tiên tiếp ứng ngay lập tức. Đội cứu hộ đang rảnh việc vui lòng bấm "Xem chi tiết" để xác nhận tham gia.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, fontWeight: '500' },

  headerBlock: { gap: 6 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: RCOLORS.statusGreen },
  liveText: { fontSize: 10, fontWeight: '800', color: '#166534', letterSpacing: 0.5 },
  pageTitle: { fontSize: RFONTS.xl, fontWeight: '800', color: RCOLORS.textPrimary },
  pageDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 20 },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: '#E2E8F0', ...RSHADOWS.card },
  searchInput: { flex: 1, fontSize: RFONTS.sm, color: RCOLORS.textPrimary },

  filterChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RRADIUS.full, backgroundColor: RCOLORS.bgWhite, borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: RCOLORS.bgNavy, borderColor: RCOLORS.bgNavy },
  filterChipText: { fontSize: RFONTS.xs, fontWeight: '600', color: RCOLORS.textSecondary },
  filterChipTextActive: { color: '#FFF', fontWeight: '700' },

  zoneCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: 14, ...RSHADOWS.card, borderWidth: 1, borderColor: '#E2E8F0' },
  zoneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  zoneBadgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RRADIUS.sm, borderWidth: 1 },
  severityText: { fontSize: 10, fontWeight: '700' },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RRADIUS.sm, backgroundColor: '#EFF6FF' },
  distBadgeText: { fontSize: 10, fontWeight: '700', color: RCOLORS.bgBlue },

  zoneName: { fontSize: RFONTS.md, fontWeight: '800', color: RCOLORS.textPrimary, lineHeight: 22, marginTop: 4 },

  metricsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: RRADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: RFONTS.base, fontWeight: '800', color: RCOLORS.textPrimary },
  metricLabel: { fontSize: 10, color: RCOLORS.textSecondary, marginTop: 2 },
  metricDivider: { width: 1, height: 24, backgroundColor: '#CBD5E1' },

  shortageBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RRADIUS.sm, borderWidth: 1, borderColor: '#FCA5A5' },
  shortageText: { fontSize: 11, fontWeight: '700', color: RCOLORS.primary, flex: 1 },
  sufficientBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RRADIUS.sm },
  sufficientText: { fontSize: 11, fontWeight: '600', color: '#166534', flex: 1 },

  actionRow: { flexDirection: 'row', gap: 8 },
  detailBtn: { flex: 1, height: 44, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, alignItems: 'center', justifyContent: 'center' },
  detailBtnText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '800', letterSpacing: 0.5 },
  navBtn: { height: 44, paddingHorizontal: 14, backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  navBtnText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '700' },

  aiCard: { backgroundColor: '#1E293B', borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: 10 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiIconBox: { width: 28, height: 28, borderRadius: 14, backgroundColor: RCOLORS.primary, alignItems: 'center', justifyContent: 'center' },
  aiLabel: { fontSize: 11, fontWeight: '800', color: '#CBD5E1', letterSpacing: 0.5 },
  aiTitle: { fontSize: RFONTS.base, fontWeight: '700', color: '#FFF' },
  aiDesc: { fontSize: RFONTS.xs, color: '#94A3B8', lineHeight: 18 },

  errorCard: { backgroundColor: '#FEF2F2', padding: 16, borderRadius: RRADIUS.md, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: RCOLORS.primary, fontSize: RFONTS.sm, textAlign: 'center' },
  retryBtn: { backgroundColor: RCOLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RRADIUS.sm },
  retryText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '700' },

  emptyCard: { padding: 40, alignItems: 'center', gap: 10, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg },
  emptyTitle: { fontSize: RFONTS.base, fontWeight: '700', color: RCOLORS.textPrimary },
  emptyText: { color: RCOLORS.textSecondary, fontSize: RFONTS.sm, textAlign: 'center', lineHeight: 20 },
});

export default ZoneListScreen;
