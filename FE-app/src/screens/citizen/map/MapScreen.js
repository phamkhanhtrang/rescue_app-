/**
 * src/screens/citizen/map/MapScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Bản đồ điều phối (Tab MAP).
 *
 * Chức năng:
 *  - Marker Zone (từ bảng zones) — màu theo đội cứu hộ:
 *      🔴 Đỏ nhấp nháy — Chưa có đội (không có mission ACTIVE/ON_MY_WAY)
 *      🟡 Vàng          — Đã có đội đang đến (mission ACTIVE/ON_MY_WAY)
 *      🟢 Xanh          — Zone đã được giải quyết (status=RESOLVED)
 *  - Vùng tô màu bán trong suốt theo severity (từ bảng alerts):
 *      🔴 Đỏ  — CRITICAL / EMERGENCY
 *      🟡 Vàng — WARNING / HIGH
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Dimensions, ActivityIndicator, Animated,
} from 'react-native';

import MapView, { Marker, PROVIDER_GOOGLE, Circle, Callout } from 'react-native-maps';
import * as Location from 'expo-location';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../constants/citizen/theme';
import API from '../../../services/api';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Mission statuses tính là "có đội" ───────────────────────────────────────
const ACTIVE_MISSION_STATUSES = ['ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP'];

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
      return { fill: 'rgba(229,57,53,0.25)', stroke: 'rgba(229,57,53,0.7)' };
    case 'WARNING':
    case 'HIGH':
      return { fill: 'rgba(253,216,53,0.25)', stroke: 'rgba(253,216,53,0.7)' };
    default:
      return { fill: 'rgba(66,165,245,0.15)', stroke: 'rgba(66,165,245,0.5)' };
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
        Animated.timing(anim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 600, useNativeDriver: true }),
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
  const [addressName, setAddressName]         = useState('Đang xác định...');
  const [zonesList, setZonesList]             = useState([]);
  const [alertsList, setAlertsList]           = useState([]);
  const [activeMissionZoneIds, setActiveMissionZoneIds] = useState(new Set());
  const [loadingData, setLoadingData]         = useState(false);

  // ─── Lấy GPS ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);

      let reverse = await Location.reverseGeocodeAsync({
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (reverse && reverse.length > 0) {
        setAddressName(
          `${reverse[0].district || ''}, ${reverse[0].city || reverse[0].region || ''}`
        );
      }
    })();
  }, []);

  // ─── Fetch Zones + Missions + Alerts từ API ─────────────────────────────────
  const fetchMapData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [zonesRes, missionsRes, alertsRes] = await Promise.all([
        API.zones.getAll(),
        API.missions.getAll(),
        API.alerts.getAll({ is_active: 'true', tab: 'all' }),
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
      const activeZoneIds = new Set(
        rawMissions
          .filter(m => ACTIVE_MISSION_STATUSES.includes(m.status) && m.zone)
          .map(m => m.zone)
      );
      setActiveMissionZoneIds(activeZoneIds);

      // Alerts list — chỉ lấy alert có tọa độ và mức độ WARNING, EMERGENCY (hoặc CRITICAL/HIGH)
      const rawAlerts = Array.isArray(alertsRes)
        ? alertsRes
        : alertsRes?.results || [];
      
      const allowedSeverities = ['WARNING', 'EMERGENCY', 'CRITICAL', 'HIGH'];
      setAlertsList(rawAlerts.filter(a => 
        a.location_lat && 
        a.location_lng &&
        allowedSeverities.includes((a.severity || '').toUpperCase())
      ));
    } catch (e) {
      console.log('MapScreen fetch error:', e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData();
    // Tự động refresh mỗi 30 giây
    const interval = setInterval(fetchMapData, 30000);
    return () => clearInterval(interval);
  }, [fetchMapData]);

  // ─── Thống kê nhanh ──────────────────────────────────────────────────────────
  const noTeamCount    = zonesList.filter(z => getZoneMarkerState(z, activeMissionZoneIds) === 'no_team').length;
  const hasTeamCount   = zonesList.filter(z => getZoneMarkerState(z, activeMissionZoneIds) === 'has_team').length;
  const resolvedCount  = zonesList.filter(z => z.status === 'RESOLVED').length;
  const criticalAlerts = alertsList.filter(a =>
    ['CRITICAL','EMERGENCY'].includes((a.severity || '').toUpperCase())
  ).length;

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader dark />
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            customMapStyle={mapDarkStyle}
            region={{
              latitude:      location.latitude,
              longitude:     location.longitude,
              latitudeDelta:  0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
            zoomEnabled={true}
            scrollEnabled={true}
            onPress={() => setSelectedSOS(null)}
          >
            {/* ── Vùng cảnh báo từ alerts API ─────────────────────────────── */}
            {alertsList.map((alert) => {
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

            {/* ── Zone Markers (màu theo đội cứu hộ) ─────────────────────── */}
            {zonesList.map((zone) => {
              const state   = getZoneMarkerState(zone, activeMissionZoneIds);
              const color   = ZONE_MARKER_COLOR[state];
              const label   = ZONE_MARKER_LABEL[state];
              const isNeedBlink = state === 'no_team';
              return (
                <Marker
                  key={`zone-${zone.id}`}
                  coordinate={{
                    latitude:  parseFloat(zone.location_lat),
                    longitude: parseFloat(zone.location_lng),
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  {isNeedBlink ? (
                    <BlinkingDot color={color} />
                  ) : (
                    <View style={[styles.markerDot, { backgroundColor: color, borderColor: '#FFF' }]} />
                  )}

                  <Callout tooltip>
                    <View style={styles.calloutBox}>
                      <Text style={styles.calloutTitle}>📍 {zone.name}</Text>
                      <Text style={[styles.calloutStatus, { color }]}>{label}</Text>
                      {zone.incident_type ? (
                        <Text style={styles.calloutMeta}>⚠️ {zone.incident_type}</Text>
                      ) : null}
                      {zone.people_affected > 0 && (
                        <Text style={styles.calloutMeta}>👥 {zone.people_affected} người bị ảnh hưởng</Text>
                      )}
                      {zone.rescuers_needed > 0 && (
                        <Text style={styles.calloutMeta}>🦺 Cần {zone.rescuers_needed} cứu hộ viên</Text>
                      )}
                      {zone.description ? (
                        <Text style={styles.calloutNote} numberOfLines={2}>{zone.description}</Text>
                      ) : null}
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
          </View>
        )}

        {/* ── Overlay UI ──────────────────────────────────────────────────── */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          {/* AI badge */}
          <View style={styles.aiBadge}>
            <View style={styles.aiDot} />
            <Text style={styles.aiText}>SENTINEL MAP LIVE</Text>
          </View>

          {/* Area label */}
          <View style={styles.areaLabel}>
            <Text style={styles.areaName}>{addressName}</Text>
            <Text style={styles.areaCoords}>
              {location
                ? `${location.latitude.toFixed(4)}° N · ${location.longitude.toFixed(4)}° E`
                : 'Đang dò GPS...'}
            </Text>
          </View>

          {/* Nút refresh */}
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={fetchMapData}
            disabled={loadingData}
          >
            <Text style={styles.refreshText}>{loadingData ? '⏳' : '🔄'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Bảng chú thích ──────────────────────────────────────────────── */}
        <View style={styles.legendPanel}>
          <Text style={styles.legendTitle}>CHÚ THÍCH</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
            <Text style={styles.legendLabel}>Chưa có đội ({noTeamCount})</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#FDD835' }]} />
            <Text style={styles.legendLabel}>Đội đang đến ({hasTeamCount})</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#43A047' }]} />
            <Text style={styles.legendLabel}>Đã xử lý ({resolvedCount})</Text>
          </View>
          <View style={[styles.legendRow, { marginTop: 4 }]}>
            <View style={[styles.legendZone, { backgroundColor: 'rgba(229,57,53,0.4)' }]} />
            <Text style={styles.legendLabel}>Vùng khẩn cấp ({criticalAlerts})</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendZone, { backgroundColor: 'rgba(253,216,53,0.4)' }]} />
            <Text style={styles.legendLabel}>Vùng cảnh báo</Text>
          </View>
        </View>

        {/* ── Bottom panel ────────────────────────────────────────────────── */}
        <View style={styles.threatPanel}>
          <View style={styles.threatHeader}>
            <View style={styles.threatBadge}>
              
            </View>
            <TouchableOpacity onPress={fetchMapData}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                {loadingData ? 'Đang cập nhật...' : 'Nhấn để cập nhật'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.routeButton}
            onPress={() => navigation.navigate('AlertsTab')}
          >
            <Text style={styles.routeText}>Xem danh sách cảnh báo  →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Floating SOS button ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.floatingSOS}
          onPress={() => navigation.navigate('SOSScreen')}
          activeOpacity={0.85}
        >
          <Text style={styles.floatingSOSText}>SOS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
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
    backgroundColor: '#1C2B3A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FONTS.sm,
  },

  // ── Custom Marker ─────────────────────────────────────────────
  markerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
  },

  // ── Callout ───────────────────────────────────────────────────
  calloutBox: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: 10,
    minWidth: 180,
    maxWidth: 240,
    ...SHADOWS.card,
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
    marginBottom: 2,
  },
  calloutMeta: {
    fontSize: 11,
    color: '#555',
  },
  calloutNote: {
    fontSize: 11,
    color: '#777',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // ── Overlay ───────────────────────────────────────────────────
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    padding: SPACING.md,
  },
  aiBadge: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,150,136,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  aiDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
  },
  aiText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  areaLabel: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: 'rgba(13,20,33,0.85)',
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  areaName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  areaCoords: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 2,
  },
  refreshBtn: {
    position: 'absolute',
    top: SPACING.md + 64,
    right: SPACING.md,
    backgroundColor: 'rgba(13,20,33,0.85)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  refreshText: { fontSize: 16 },

  // ── Legend ────────────────────────────────────────────────────
  legendPanel: {
    position: 'absolute',
    bottom: 230,
    left: SPACING.md,
    backgroundColor: 'rgba(13,20,33,0.9)',
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  legendTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },

  // ── Bottom threat panel ───────────────────────────────────────
  threatPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#0D1421',
    padding: SPACING.base,
    paddingBottom: 34,
    gap: SPACING.sm,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  threatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  threatBadge: {
    backgroundColor: '#1A237E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  threatBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 4,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLbl: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    textAlign: 'center',
  },
  routeButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 4,
  },
  routeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Floating SOS ──────────────────────────────────────────────
  floatingSOS: {
    position: 'absolute',
    bottom: 225,
    right: SPACING.base,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  floatingSOSText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
});

// ─── Dark map style ───────────────────────────────────────────────────────────
const mapDarkStyle = [
  { elementType: 'geometry',            stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#242f3e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'road', elementType: 'geometry',        stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill',stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'water', elementType: 'geometry',       stylers: [{ color: '#17263c' }] },
];

export default MapScreen;
