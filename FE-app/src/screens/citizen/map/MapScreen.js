/**
 * src/screens/citizen/map/MapScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Bản đồ điều phối Trực quan dành cho Người Dân.
 *
 * Chức năng nâng cao:
 *  - Chế độ Bản đồ Sáng / Vệ tinh (Light Mode / Satellite toggle)
 *  - Cụm nút điều khiển điều hướng thông minh (Locate Me 🎯, Đổi kiểu bản đồ 🗺️, Chú giải ℹ️, Refresh 🔄)
 *  - Panel Bảng Chú Giải Màu Sắc (Map Legend Panel)
 *  - Marker Zone (🔴 Cần cứu trợ gấp / 🟡 Đang ứng cứu / 🟢 Đã an toàn) & Rescuer Pin 🚁
 *  - Vùng cảnh báo nguy hiểm (Circles) màu sắc trực quan
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Dimensions, ActivityIndicator, Animated, ScrollView,
  Modal, Linking
} from 'react-native';

import MapView, { Marker, PROVIDER_GOOGLE, Circle, Callout } from '../../../components/common/AppMap';
import * as Location from 'expo-location';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../constants/citizen/theme';
import API from '../../../services/api';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Mission statuses tính là "có đội" ───────────────────────────────────────
const ACTIVE_MISSION_STATUSES = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP'];

/**
 * Tính màu marker cho một zone dựa vào:
 *  - zone.status === 'RESOLVED'      → xanh
 *  - có mission active cho zone đó  → vàng
 *  - không có                        → đỏ (nhấp nháy)
 */
const getZoneMarkerState = (zone, activeMissionZoneIds) => {
  if (zone.status === 'RESOLVED') return 'resolved';  // xanh
  if (activeMissionZoneIds.has(zone.id)) return 'has_team'; // vàng
  return 'no_team'; // đỏ nhấp nháy
};

const ZONE_MARKER_COLOR = {
  no_team:  '#E53935', // đỏ
  has_team: '#FDD835', // vàng
  resolved: '#43A047', // xanh
};

const ZONE_MARKER_LABEL = {
  no_team:  'Chưa có đội cứu hộ',
  has_team: 'Đội đang trên đường',
  resolved: 'Đã được giải quyết',
};

// ─── Màu vùng cảnh báo theo severity ─────────────────────────────────────────
const getAlertZoneColor = (severity) => {
  switch ((severity || '').toUpperCase()) {
    case 'CRITICAL':
    case 'EMERGENCY':
      return { fill: 'rgba(229,57,53,0.22)', stroke: '#E53935' };
    case 'WARNING':
    case 'HIGH':
      return { fill: 'rgba(255,179,0,0.22)', stroke: '#FFB300' };
    default:
      return { fill: 'rgba(30,136,229,0.18)', stroke: '#1E88E5' };
  }
};

// ─── Bán kính vùng cảnh báo (m) theo severity ────────────────────────────────
const getAlertRadius = (severity) => {
  switch ((severity || '').toUpperCase()) {
    case 'CRITICAL':
    case 'EMERGENCY': return 800;
    case 'WARNING':
    case 'HIGH':      return 600;
    default:          return 400;
  }
};

// ─── BlinkingMarker (Animated cho SOS PENDING) ───────────────────────────────
const BlinkingDot = ({ color }) => {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 550, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 550, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ opacity: anim }}>
      <View style={[styles.markerDot, { backgroundColor: color, borderColor: '#FFF' }]} />
    </Animated.View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const MapScreen = ({ navigation }) => {
  const [location, setLocation]               = useState(null);
  const [addressName, setAddressName]         = useState('Đang xác định vị trí...');
  const [zonesList, setZonesList]             = useState([]);
  const [alertsList, setAlertsList]           = useState([]);
  const [activeMissionZoneIds, setActiveMissionZoneIds] = useState(new Set());
  const [activeMissionsList, setActiveMissionsList] = useState([]);
  const [rescuersList, setRescuersList]       = useState([]);
  const [loadingData, setLoadingData]         = useState(false);
  const [showTeamModal, setShowTeamModal]     = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);

  // Map view custom options
  const [mapType, setMapType]                 = useState('standard'); // 'standard' | 'satellite'
  const [showLegend, setShowLegend]           = useState(true);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  // ─── Lấy GPS (Tức thì qua cache + cập nhật ngầm độ chính xác cao) ────────
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // 1. Tức thì: Lấy ngay tọa độ lưu gần nhất từ cache máy (0.05s) để hiện map lập tức
      const lastLoc = await Location.getLastKnownPositionAsync();
      if (lastLoc) {
        setLocation(lastLoc.coords);
      }

      // 2. Chạy ngầm: Lấy tọa độ GPS tươi mới và Geocode không làm treo giao diện
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(async (loc) => {
          if (loc) {
            setLocation(loc.coords);
            try {
              let reverse = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
              if (reverse && reverse.length > 0) {
                setAddressName(
                  `${reverse[0].streetNumber ? reverse[0].streetNumber + ' ' : ''}${reverse[0].street || reverse[0].subregion || ''}, ${reverse[0].district || reverse[0].city || ''}`
                );
              }
            } catch (err) {}
          }
        })
        .catch(() => {});
    })();
  }, []);

  // ─── Fetch Data ─────────────────────────────────────────────────────────────
  const fetchMapData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [zonesRes, missionsRes, alertsRes, rescuersRes] = await Promise.all([
        API.zones.getAll(),
        API.missions.getAll(),
        API.alerts.getAll({ is_active: 'true', tab: 'all' }),
        API.rescuers.getAll(),
      ]);

      // Zones list
      const rawZones = Array.isArray(zonesRes)
        ? zonesRes
        : zonesRes?.results || [];
      setZonesList(rawZones.filter(z => z.location_lat && z.location_lng));

      // Tập hợp zone_id có mission đang active
      const rawMissions = Array.isArray(missionsRes)
        ? missionsRes
        : missionsRes?.results || [];
      
      const activeMissions = rawMissions.filter(m => ACTIVE_MISSION_STATUSES.includes(m.status) && m.zone);
      setActiveMissionsList(activeMissions);
      setActiveMissionZoneIds(new Set(activeMissions.map(m => m.zone)));

      // Alerts list
      const rawAlerts = Array.isArray(alertsRes)
        ? alertsRes
        : alertsRes?.results || [];
      
      const allowedSeverities = ['WARNING', 'EMERGENCY', 'CRITICAL', 'HIGH'];
      setAlertsList(rawAlerts.filter(a => 
        a.location_lat && 
        a.location_lng &&
        allowedSeverities.includes((a.severity || '').toUpperCase())
      ));

      // Rescuers list
      const rawRescuers = Array.isArray(rescuersRes)
        ? rescuersRes
        : rescuersRes?.results || [];
      setRescuersList(rawRescuers.filter(r => 
        r.rescuer_profile?.is_on_duty && 
        r.rescuer_profile?.current_lat && 
        r.rescuer_profile?.current_lng
      ));
    } catch (e) {
      console.log('MapScreen fetch error:', e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 30000);
    return () => clearInterval(interval);
  }, [fetchMapData]);

  const mapRef = useRef(null);

  const activeRescueMission = activeMissionsList[0] || null;

  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'NO_TEAM' | 'HAS_TEAM' | 'ALERTS'

  const filteredZones = zonesList.filter(zone => {
    const state = getZoneMarkerState(zone, activeMissionZoneIds);
    if (filterType === 'NO_TEAM') return state === 'no_team';
    if (filterType === 'HAS_TEAM') return state === 'has_team' || state === 'resolved';
    return true;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack={false} />

      {/* Layer Filter Pills */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'ALL' && styles.filterChipActive]}
            onPress={() => setFilterType('ALL')}
          >
            <Text style={[styles.filterText, filterType === 'ALL' && styles.filterTextActive]}>🌐 Tất cả ({zonesList.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'NO_TEAM' && styles.filterChipActiveRed]}
            onPress={() => setFilterType('NO_TEAM')}
          >
            <Text style={[styles.filterText, filterType === 'NO_TEAM' && styles.filterTextActiveRed]}>🔴 Cần cứu trợ ({zonesList.filter(z => getZoneMarkerState(z, activeMissionZoneIds) === 'no_team').length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'HAS_TEAM' && styles.filterChipActiveYellow]}
            onPress={() => setFilterType('HAS_TEAM')}
          >
            <Text style={[styles.filterText, filterType === 'HAS_TEAM' && styles.filterTextActiveYellow]}>🟡 Đang ứng cứu ({zonesList.filter(z => getZoneMarkerState(z, activeMissionZoneIds) !== 'no_team').length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'ALERTS' && styles.filterChipActiveBlue]}
            onPress={() => setFilterType('ALERTS')}
          >
            <Text style={[styles.filterText, filterType === 'ALERTS' && styles.filterTextActiveBlue]}>⚠️ Vùng nguy hiểm ({alertsList.length})</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            mapType={mapType}
            region={{
              latitude:      location.latitude,
              longitude:     location.longitude,
              latitudeDelta:  0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
            showsMyLocationButton={false}
            zoomEnabled={true}
            scrollEnabled={true}
          >
            {/* ── Vùng cảnh báo từ alerts API ─────────────────────────────── */}
            {(filterType === 'ALL' || filterType === 'ALERTS') && alertsList.map((alert) => {
              const colors = getAlertZoneColor(alert.severity);
              const radius = getAlertRadius(alert.severity);
              return (
                <Circle
                  key={`alert-zone-${alert.id}`}
                  center={{
                    latitude:  parseFloat(alert.location_lat),
                    longitude: parseFloat(alert.location_lng),
                  }}
                  radius={radius}
                  fillColor={colors.fill}
                  strokeColor={colors.stroke}
                  strokeWidth={2}
                />
              );
            })}

            {/* ── Zone Markers & Boundaries (màu theo đội cứu hộ) ────────────── */}
            {(filterType !== 'ALERTS') && filteredZones.map((zone) => {
              const state   = getZoneMarkerState(zone, activeMissionZoneIds);
              const color   = ZONE_MARKER_COLOR[state];
              const label   = ZONE_MARKER_LABEL[state];
              const lat     = parseFloat(zone.location_lat);
              const lng     = parseFloat(zone.location_lng);
              if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

              return (
                <React.Fragment key={`zone-frag-${zone.id}`}>
                  {/* Khoanh vùng diện tích sự cố (Zone Circle Boundary) */}
                  <Circle
                    center={{ latitude: lat, longitude: lng }}
                    radius={Number(zone.radius_meters) || 800}
                    fillColor={state === 'no_team' ? 'rgba(229, 57, 53, 0.35)' : 'rgba(245, 124, 0, 0.35)'}
                    strokeColor={color}
                    strokeWidth={2.5}
                    zIndex={1}
                  />

                  <Marker
                    coordinate={{ latitude: lat, longitude: lng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    zIndex={2}
                  >
                    <View style={[styles.zoneCirclePin, { backgroundColor: color }]} collapsable={false} pointerEvents="none">
                      <Text style={styles.circlePinText}>📍</Text>
                    </View>

                    <Callout tooltip>
                      <View style={styles.calloutBox}>
                        <Text style={styles.calloutTitle}>📍 {zone.name}</Text>
                        <Text style={[styles.calloutStatus, { color }]}>{label}</Text>
                        {zone.incident_type ? (
                          <Text style={styles.calloutMeta}>⚠️ {zone.incident_type}</Text>
                        ) : null}
                        {zone.people_affected > 0 && (
                          <Text style={styles.calloutMeta}>👥 {zone.people_affected} người ảnh hưởng</Text>
                        )}
                        {zone.rescuers_needed > 0 && (
                          <Text style={styles.calloutMeta}>🦺 Cần {zone.rescuers_needed} lực lượng cứu hộ</Text>
                        )}
                        {zone.description ? (
                          <Text style={styles.calloutNote} numberOfLines={2}>{zone.description}</Text>
                        ) : null}
                      </View>
                    </Callout>
                  </Marker>
                </React.Fragment>
              );
            })}

            {/* ── Rescuer Markers ───────────────────────────────────────────── */}
            {rescuersList.map((rescuer) => {
              const rp = rescuer.rescuer_profile;
              if (!rp) return null;
              const unitName = rp.unit_name || 'Đội Cứu Hộ';
              return (
                <Marker
                  key={`rescuer-${rescuer.id}`}
                  coordinate={{
                    latitude:  parseFloat(rp.current_lat),
                    longitude: parseFloat(rp.current_lng),
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={999}
                >
                  <View style={styles.rescuerCirclePin} collapsable={false} pointerEvents="none">
                    <Text style={styles.circlePinText}>🛟</Text>
                  </View>

                  <Callout tooltip>
                    <View style={styles.calloutBox}>
                      <Text style={styles.calloutTitle}>ĐỘI CỨU HỘ TRỰC CHIẾN</Text>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#111' }}>
                        {unitName}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
                        Trưởng nhóm: {rescuer.full_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#444' }}>
                        SĐT: {rescuer.phone}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#43A047', marginTop: 4, fontWeight: 'bold' }}>
                        ● ĐANG TRỰC CHIẾN
                      </Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải dữ liệu vị trí bản đồ...</Text>
          </View>
        )}

        {/* ── Area Info Header Overlay ────────────────────────────────────── */}
        <View style={styles.topInfoBar}>
          <View style={styles.areaTextWrap}>
            <Text style={styles.areaNameText} numberOfLines={1}>{addressName}</Text>
            <Text style={styles.areaCoordsText}>
              {location
                ? `📍 GPS: ${location.latitude.toFixed(4)}° N, ${location.longitude.toFixed(4)}° E`
                : 'Đang kết nối vệ tinh GPS...'}
            </Text>
          </View>
          {loadingData && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
        </View>

        {/* ── Cụm Nút Điều Khiển Phải Dưới (Bottom Right Control Cluster) ──── */}
        <View style={styles.rightControlGroup}>
          {/* Nút Tự Định Vị (Locate Me) */}
          <TouchableOpacity
            style={styles.controlFab}
            onPress={() => {
              if (location && mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.03,
                  longitudeDelta: 0.03,
                }, 800);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.controlIconText}>🎯</Text>
          </TouchableOpacity>

          {/* Nút Đổi Kiểu Bản Đồ (Standard / Satellite) */}
          <TouchableOpacity
            style={[styles.controlFab, mapType === 'satellite' && styles.controlFabActive]}
            onPress={() => setMapType(prev => prev === 'standard' ? 'satellite' : 'standard')}
            activeOpacity={0.8}
          >
            <Text style={styles.controlIconText}>{mapType === 'standard' ? '🗺️' : '🛰️'}</Text>
          </TouchableOpacity>

          {/* Nút Bật/Tắt Chú Giải (Map Legend) */}
          <TouchableOpacity
            style={[styles.controlFab, showLegend && styles.controlFabActive]}
            onPress={() => setShowLegend(prev => !prev)}
            activeOpacity={0.8}
          >
            <Text style={styles.controlIconText}>ℹ️</Text>
          </TouchableOpacity>

          {/* Nút Làm Mới Dữ Liệu */}
          <TouchableOpacity
            style={styles.controlFab}
            onPress={fetchMapData}
            disabled={loadingData}
            activeOpacity={0.8}
          >
            <Text style={styles.controlIconText}>{loadingData ? '⏳' : '🔄'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Bảng Chú Giải Màu Sắc (Map Legend Floating Panel) ───────────── */}
        {showLegend && (
          <View style={styles.legendPanel}>
            <Text style={styles.legendTitle}>CHÚ GIẢI BẢN ĐỒ</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
              <Text style={styles.legendLabel}>Chưa có đội cứu trợ</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#FDD835' }]} />
              <Text style={styles.legendLabel}>Đội đang ứng cứu</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#43A047' }]} />
              <Text style={styles.legendLabel}>Đã an toàn</Text>
            </View>
            <View style={styles.legendRow}>
              <Text style={{ fontSize: 13, width: 14, textAlign: 'center' }}>🚁</Text>
              <Text style={styles.legendLabel}>Vị trí Đội cứu trợ</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendZone, { backgroundColor: 'rgba(229,57,53,0.3)', borderColor: '#E53935', borderWidth: 1 }]} />
              <Text style={styles.legendLabel}>Vùng nguy hiểm khẩn cấp</Text>
            </View>
          </View>
        )}

        {/* ── Floating SOS Button ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.floatingSOS, { bottom: isBottomCollapsed ? 68 : 130 }]}
          onPress={() => navigation.navigate('SOSScreen')}
          activeOpacity={0.85}
        >
          <Text style={styles.floatingSOSText}>SOS</Text>
        </TouchableOpacity>

        {/* ── Thẻ Trạng Thái Cứu Hộ Phía Dưới (Bottom Rescue Alert Card) ───── */}
        <View style={styles.rescueAlertContainer}>
          {isBottomCollapsed ? (
            <TouchableOpacity
              style={styles.collapsedAlertBar}
              onPress={() => setIsBottomCollapsed(false)}
              activeOpacity={0.85}
            >
              <View style={styles.collapsedLeftRow}>
                <Text style={{ fontSize: 16 }}>{activeRescueMission ? '🚑' : '⏳'}</Text>
                <Text style={styles.collapsedAlertText} numberOfLines={1}>
                  {activeRescueMission
                    ? `Đội cứu hộ: ${activeRescueMission.rescuer_unit || activeRescueMission.rescuer_name || 'Đang đến'}`
                    : 'Trạng thái cứu hộ: Đang tìm kiếm đội'}
                </Text>
              </View>
              <View style={styles.expandBadge}>
                <Text style={styles.expandBadgeText}>⌃ Mở rộng</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.expandedAlertWrapper}>
              <TouchableOpacity
                style={styles.collapseToggleBtn}
                onPress={() => setIsBottomCollapsed(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.collapseToggleText}>⌄ Thu gọn</Text>
              </TouchableOpacity>

              {activeRescueMission ? (
                <TouchableOpacity
                  style={styles.rescueAlertCard}
                  onPress={() => {
                    const zone = zonesList.find(z => z.id === activeRescueMission.zone);
                    const lat = activeRescueMission.rescuer_lat || (zone ? parseFloat(zone.location_lat) : null);
                    const lng = activeRescueMission.rescuer_lng || (zone ? parseFloat(zone.location_lng) : null);
                    if (lat && lng && mapRef.current) {
                      mapRef.current.animateToRegion({
                        latitude: lat,
                        longitude: lng,
                        latitudeDelta: 0.012,
                        longitudeDelta: 0.012,
                      }, 900);
                    }
                    setSelectedMission(activeRescueMission);
                    setShowTeamModal(true);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.rescueIconBadge}>
                    <Text style={{ fontSize: 24 }}>🚑</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rescueAlertTitle}>ĐỘI CỨU HỘ ĐANG ĐẾN!</Text>
                    <Text style={styles.rescueAlertDesc} numberOfLines={1}>
                      {activeRescueMission.rescuer_unit
                        ? `🏢 ${activeRescueMission.rescuer_unit}`
                        : `👤 ${activeRescueMission.rescuer_name || 'Đội Cứu Hộ'}`}
                    </Text>
                    <Text style={[styles.rescueAlertDesc, { color: '#2E7D32', fontWeight: '700', marginTop: 2 }]} numberOfLines={1}>
                      📍 {activeRescueMission.zone_name || 'Đang di chuyển...'} · Chạm để xem vị trí
                    </Text>
                  </View>
                  <View style={styles.infoArrowBtn}>
                    <Text style={{ fontSize: 16, color: '#2E7D32', fontWeight: 'bold' }}>➔</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.rescueAlertCard, { borderLeftColor: '#90A4AE' }]}>
                  <View style={[styles.rescueIconBadge, { backgroundColor: '#ECEFF1' }]}>
                    <Text style={{ fontSize: 22 }}>⏳</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rescueAlertTitle, { color: '#37474F' }]}>CHƯA CÓ ĐỘI CỨU HỘ TIẾP NHẬN</Text>
                    <Text style={styles.rescueAlertDesc} numberOfLines={1}>
                      Hệ thống Sentinel đang tự động phân bổ lực lượng trợ giúp gần nhất.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Modal chi tiết Đội cứu hộ ────────────────────────────────────── */}
        <Modal
          visible={showTeamModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTeamModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowTeamModal(false)}
          >
            <View
              style={styles.modalSheet}
              onStartShouldSetResponder={() => true}
            >
              {/* Header */}
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🚑 THÔNG TIN ĐỘI CỨU HỘ</Text>
                <TouchableOpacity onPress={() => setShowTeamModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedMission && (() => {
                const m = selectedMission;
                const zoneMissions = activeMissionsList.filter(x => x.zone === m.zone);
                return (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Status badge */}
                    <View style={styles.modalStatusRow}>
                      <View style={[styles.modalStatusBadge,
                        { backgroundColor: selectedMission.status === 'ACTIVE' ? '#E8F5E9' : '#FFF8E1' }]}>
                        <View style={[styles.modalStatusDot,
                          { backgroundColor: selectedMission.status === 'ACTIVE' ? '#43A047' : '#FDD835' }]} />
                        <Text style={[styles.modalStatusText,
                          { color: selectedMission.status === 'ACTIVE' ? '#2E7D32' : '#F57F17' }]}>
                          {selectedMission.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG'
                            : selectedMission.status === 'ON_MY_WAY' ? 'ĐANG TRÊN ĐƯỜNG'
                            : selectedMission.status === 'NEEDS_HELP' ? 'CẦN HỖ TRỢ'
                            : selectedMission.status}
                        </Text>
                      </View>
                      {selectedMission.rescuer_on_duty && (
                        <View style={styles.onDutyBadge}>
                          <Text style={styles.onDutyText}>● TRỰC CHIẾN</Text>
                        </View>
                      )}
                    </View>

                    {/* Info rows */}
                    <View style={styles.modalCard}>
                      <InfoRow icon="🏢" label="Đơn vị / Tổ chức"
                        value={m.rescuer_unit || 'Chưa cập nhật'} />
                      <InfoRow icon="👤" label="Trưởng nhóm"
                        value={m.rescuer_name || 'N/A'} />
                      <InfoRow icon="📞" label="Số điện thoại"
                        value={m.rescuer_phone || 'N/A'}
                        onPress={() => {
                          if (m.rescuer_phone) Linking.openURL(`tel:${m.rescuer_phone}`);
                        }}
                        isLink
                      />
                      <InfoRow icon="🎖" label="Cấp bậc"
                        value={m.rescuer_rank || 'Chưa cập nhật'} />
                      <InfoRow icon="⚕️" label="Chuyên môn"
                        value={m.rescuer_specialty || 'Đa năng'} />
                      <InfoRow icon="📍" label="Vùng nhiệm vụ"
                        value={m.zone_name || 'Đang cập nhật'} />
                      <InfoRow icon="👥" label="Số đội đang trong vùng"
                        value={`${zoneMissions.length} nhiệm vụ đang hoạt động`}
                        isLast
                      />
                    </View>

                    {/* GPS status */}
                    {m.rescuer_lat ? (
                      <View style={styles.gpsCard}>
                        <Text style={styles.gpsLabel}>📡 VỊ TRÍ GPS THỜI GIAN THỰC</Text>
                        <Text style={styles.gpsCoords}>
                          {m.rescuer_lat.toFixed(5)}° N · {m.rescuer_lng.toFixed(5)}° E
                        </Text>
                        <TouchableOpacity
                          style={styles.zoomBtn}
                          onPress={() => {
                            if (mapRef.current) {
                              mapRef.current.animateToRegion({
                                latitude: m.rescuer_lat,
                                longitude: m.rescuer_lng,
                                latitudeDelta: 0.006,
                                longitudeDelta: 0.006,
                              }, 800);
                            }
                            setShowTeamModal(false);
                          }}
                        >
                          <Text style={styles.zoomBtnText}>🔍 Zoom tới đội cứu hộ</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={[styles.gpsCard, { borderColor: '#ccc' }]}>
                        <Text style={[styles.gpsLabel, { color: '#999' }]}>📡 GPS chưa chia sẻ</Text>
                        <Text style={[styles.gpsCoords, { color: '#bbb', fontSize: 12 }]}>
                          Đội chưa bật chia sẻ vị trí GPS.
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                );
              })()}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

// ─── InfoRow helper ──────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, isLink, isLast, onPress }) => (
  <TouchableOpacity
    style={[infoRowStyle.row, isLast && { borderBottomWidth: 0 }]}
    onPress={onPress}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
  >
    <Text style={infoRowStyle.icon}>{icon}</Text>
    <View style={infoRowStyle.body}>
      <Text style={infoRowStyle.label}>{label}</Text>
      <Text style={[infoRowStyle.value, isLink && infoRowStyle.link]}>{value}</Text>
    </View>
    {isLink && <Text style={{ fontSize: 16, color: '#1565C0' }}>↗️</Text>}
  </TouchableOpacity>
);
const infoRowStyle = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
            borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 12 },
  icon:  { fontSize: 20, width: 28, textAlign: 'center' },
  body:  { flex: 1 },
  label: { fontSize: 11, color: '#999', marginBottom: 2 },
  value: { fontSize: 14, fontWeight: '600', color: '#111' },
  link:  { color: '#1565C0', textDecorationLine: 'underline' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0D1421',
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: '#1565C0',
    borderColor: '#1565C0',
  },
  filterChipActiveRed: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
  filterChipActiveYellow: {
    backgroundColor: '#F57F17',
    borderColor: '#F57F17',
  },
  filterChipActiveBlue: {
    backgroundColor: '#0288D1',
    borderColor: '#0288D1',
  },
  filterText: {
    fontSize: 12,
    color: '#616161',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  filterTextActiveRed: {
    color: '#FFF',
    fontWeight: '700',
  },
  filterTextActiveYellow: {
    color: '#FFF',
    fontWeight: '700',
  },
  filterTextActiveBlue: {
    color: '#FFF',
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    color: '#64748B',
    fontSize: FONTS.sm,
    fontWeight: '600',
  },

  // ── Custom Circular Icon Markers (Tròn Gọn) ───────────────────────
  circlePinText: {
    fontSize: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
  zoneCirclePin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rescuerCirclePin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#43A047',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  zonePinBody: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  zonePinText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    includeFontPadding: false,
  },

  rescuerPinBody: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  rescuerPinText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    includeFontPadding: false,
  },

  // ── Callout ───────────────────────────────────────────────────
  calloutBox: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: 12,
    minWidth: 190,
    maxWidth: 250,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  calloutStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E53935',
    marginBottom: 4,
  },
  calloutMeta: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
  calloutNote: {
    fontSize: 11,
    color: '#777',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // ── Area Info Header Overlay ──────────────────────────────────
  topInfoBar: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  areaTextWrap: { flex: 1 },
  areaNameText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '800',
  },
  areaCoordsText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
    fontWeight: '600',
  },

  // ── Cụm Nút Điều Khiển Phải ──────────────────────────────────
  rightControlGroup: {
    position: 'absolute',
    bottom: 90,
    right: 12,
    gap: 8,
    zIndex: 999,
    elevation: 10,
  },
  controlFab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  controlFabActive: {
    backgroundColor: '#1E88E5',
    borderColor: '#1565C0',
  },
  controlIconText: {
    fontSize: 16,
  },

  locateIconFab: {
    position: 'absolute',
    bottom: 90,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 99,
  },
  locateIconText: {
    fontSize: 18,
  },

  // ── Panel Bảng Chú Giải ──────────────────────────────────────
  legendPanel: {
    position: 'absolute',
    bottom: 120,
    left: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    gap: 6,
    maxWidth: 200,
  },
  legendTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  legendZone: {
    width: 16,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    color: '#1E293B',
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Floating SOS ──────────────────────────────────────────────
  floatingSOS: {
    position: 'absolute',
    bottom: 120,
    right: SPACING.md,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  floatingSOSText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  // ── Alert Đội cứu hộ Phía Dưới ────────────────────────────────
  rescueAlertContainer: {
    position: 'absolute',
    bottom: 16,
    left: SPACING.md,
    right: SPACING.md,
  },
  collapsedAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  collapsedLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  collapsedAlertText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  expandBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E7D32',
  },
  expandedAlertWrapper: {
    position: 'relative',
  },
  collapseToggleBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    marginBottom: -2,
    marginRight: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#CBD5E1',
    zIndex: 2,
    elevation: 3,
  },
  collapseToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  rescueAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#43A047',
    gap: 10,
  },
  rescueIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescueAlertTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  rescueAlertDesc: {
    fontSize: 12,
    color: '#64748B',
  },
  infoArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F8E9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Modal bottom sheet ──────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '80%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modalHandle: {
    width: 40, height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 0.3,
  },
  modalClose: {
    fontSize: 18,
    color: '#888',
    paddingHorizontal: 6,
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalStatusDot: {
    width: 8, height: 8,
    borderRadius: 4,
  },
  modalStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  onDutyBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  onDutyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1565C0',
    letterSpacing: 0.3,
  },
  modalCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEE',
  },

  // ── GPS card ──────────────────────────────────────────
  gpsCard: {
    borderWidth: 1.5,
    borderColor: '#43A047',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 6,
    backgroundColor: '#F1F8E9',
  },
  gpsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  gpsCoords: {
    fontSize: 13,
    fontWeight: '600',
    color: '#388E3C',
    fontVariant: ['tabular-nums'],
  },
  zoomBtn: {
    marginTop: 6,
    backgroundColor: '#43A047',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  zoomBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default MapScreen;
