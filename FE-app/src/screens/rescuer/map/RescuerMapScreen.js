/**
 * src/screens/rescuer/map/RescuerMapScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bản đồ Cứu hộ (Screen 5 — Tab BẢN ĐỒ).
 * Sử dụng Bản đồ thật (react-native-maps) và xác định vùng đang triển khai.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Dimensions
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const { width, height } = Dimensions.get('window');

const RescuerMapScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [zones, setZones] = useState([]);
  const [activeMission, setActiveMission] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initMap = async () => {
      try {
        // 1. Xin quyền vị trí
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền truy cập', 'Vui lòng cho phép truy cập vị trí để sử dụng bản đồ.');
        } else {
          let loc = await Location.getCurrentPositionAsync({});
          setCurrentLocation(loc.coords);
        }

        // 2. Lấy danh sách vùng và nhiệm vụ hiện tại
        const [zonesRes, missionsRes] = await Promise.all([
          API.zones.getAll(),
          API.missions.getAll({ rescuer: userInfo?.id, status: 'ACTIVE' })
        ]);

        setZones(zonesRes.results || []);
        if (missionsRes.results && missionsRes.results.length > 0) {
          setActiveMission(missionsRes.results[0]);
        }
      } catch (err) {
        console.error('Init map error:', err);
      } finally {
        setLoading(false);
      }
    };

    initMap();
  }, []);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return RCOLORS.primary;
      case 'HIGH':     return RCOLORS.statusOrange;
      case 'MEDIUM':   return RCOLORS.statusBlue;
      case 'LOW':      return RCOLORS.statusGreen;
      default:         return RCOLORS.bgBlue;
    }
  };

  // Vùng đang triển khai (nếu có)
  const deployedZone = zones.find(z => z.id === activeMission?.zone);

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader liveMode />

      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={RCOLORS.primary} />
            <Text style={styles.loadingText}>Đang tải bản đồ vệ tinh...</Text>
          </View>
        ) : (
          <>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              customMapStyle={darkMapStyle}
              initialRegion={{
                latitude: currentLocation?.latitude || 10.762622,
                longitude: currentLocation?.longitude || 106.660172,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {/* Vị trí hiện tại của cứu hộ */}
              {currentLocation && (
                <Marker
                  coordinate={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                  }}
                  title="Vị trí của bạn"
                >
                  <View style={styles.userMarker} />
                </Marker>
              )}

              {/* Các vùng sự cố */}
              {zones.map(z => (
                <React.Fragment key={z.id}>
                  <Marker
                    coordinate={{
                      latitude: parseFloat(z.location_lat),
                      longitude: parseFloat(z.location_lng),
                    }}
                    onPress={() => navigation.navigate('MissionsTab', { 
                      screen: 'ZoneDetailScreen', 
                      params: { zoneId: z.id, zoneName: z.name } 
                    })}
                  >
                    <View style={[styles.zoneMarker, { backgroundColor: getSeverityColor(z.severity) }]}>
                      <Text style={styles.zoneMarkerText}>{z.sector_code || 'Z'}</Text>
                    </View>
                  </Marker>

                  {/* Khoanh vùng (Circle) cho vùng đang triển khai */}
                  {z.id === activeMission?.zone && (
                    <Circle
                      center={{
                        latitude: parseFloat(z.location_lat),
                        longitude: parseFloat(z.location_lng),
                      }}
                      radius={500} // Bán kính 500m
                      fillColor="rgba(229, 57, 53, 0.2)"
                      strokeColor={RCOLORS.primary}
                      strokeWidth={2}
                    />
                  )}
                </React.Fragment>
              ))}
            </MapView>

            {/* Nút TRIỂN KHAI đè lên vùng đang làm việc */}
            {deployedZone && (
              <View style={styles.deploymentOverlay}>
                <View style={styles.deployInfoCard}>
                  <Text style={styles.deployLabel}>ĐANG TRIỂN KHAI TẠI</Text>
                  <Text style={styles.deployZoneName}>{deployedZone.name}</Text>
                  <TouchableOpacity 
                    style={styles.navButton}
                    onPress={() => navigation.navigate('MissionNavScreen', { 
                      targetLat: deployedZone.location_lat,
                      targetLng: deployedZone.location_lng,
                      zoneName: deployedZone.name
                    })}
                  >
                    <Text style={styles.navButtonText}>BẮT ĐẦU DẪN ĐƯỜNG ⚡</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* AI Strategy badge */}
            <View style={styles.aiStrategyBadge}>
              <Text style={styles.aiStrategyText}>🤖 CHIẾN LƯỢC AI</Text>
              <Text style={styles.aiStrategyDesc}>
                {deployedZone ? `Ưu tiên: ${deployedZone.name}` : 'Đang giám sát hệ thống...'}
              </Text>
            </View>

            {/* Scale indicator (Mô phỏng) */}
            <View style={styles.sosBadge}>
              <Text style={styles.sosBadgeText}>SOS: {zones.reduce((acc, z) => acc + (z.people_affected || 0), 0)} NẠN NHÂN</Text>
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.deployFooter}>
          <View>
            <Text style={styles.deployFooterLabel}>MỤC TIÊU HIỆN TẠI</Text>
            <Text style={styles.deployFooterValue}>{deployedZone ? deployedZone.name : 'CHƯA CÓ NHIỆM VỤ'}</Text>
          </View>
          <TouchableOpacity
            style={styles.listButton}
            onPress={() => navigation.navigate('MissionsTab', { screen: 'ZoneListScreen' })}
          >
            <Text style={styles.listButtonText}>DANH SÁCH  →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgDark },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: RCOLORS.textWhite, fontSize: RFONTS.sm },

  userMarker: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#2196F3', borderWidth: 3, borderColor: '#FFF' },
  zoneMarker: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RRADIUS.sm, borderWidth: 1, borderColor: '#FFF' },
  zoneMarkerText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },

  deploymentOverlay: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
  deployInfoCard: { backgroundColor: 'rgba(13, 26, 45, 0.95)', padding: RSPACING.base, borderRadius: RRADIUS.lg, width: width * 0.85, borderWidth: 1, borderColor: RCOLORS.primary, ...RSHADOWS.redGlow },
  deployLabel: { fontSize: RFONTS.xs, color: RCOLORS.primary, fontWeight: RFONTS.black, letterSpacing: 1 },
  deployZoneName: { fontSize: RFONTS.xl, color: '#FFF', fontWeight: RFONTS.black, marginVertical: 4 },
  navButton: { backgroundColor: RCOLORS.primary, paddingVertical: 12, borderRadius: RRADIUS.md, alignItems: 'center', marginTop: 10 },
  navButtonText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },

  aiStrategyBadge: { position: 'absolute', top: RSPACING.base, left: RSPACING.base, backgroundColor: 'rgba(0,0,0,0.7)', padding: RSPACING.sm, borderRadius: RRADIUS.sm, borderWidth: 1, borderColor: RCOLORS.primary },
  aiStrategyText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.bold },
  aiStrategyDesc: { color: 'rgba(255,255,255,0.6)', fontSize: RFONTS.xs },

  sosBadge: { position: 'absolute', top: RSPACING.base, right: RSPACING.base, backgroundColor: RCOLORS.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RRADIUS.full },
  sosBadgeText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: RFONTS.black },

  deployFooter: { backgroundColor: RCOLORS.bgDark, padding: RLAYOUT.screenPadding, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: RCOLORS.borderDark },
  deployFooterLabel: { fontSize: RFONTS.xs, color: 'rgba(255,255,255,0.5)', fontWeight: RFONTS.bold },
  deployFooterValue: { fontSize: RFONTS.lg, fontWeight: RFONTS.black, color: RCOLORS.textWhite },
  listButton: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: RRADIUS.md },
  listButtonText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: RFONTS.bold },
});

export default RescuerMapScreen;
