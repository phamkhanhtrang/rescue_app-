/**
 * src/screens/rescuer/map/MissionNavScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Điều hướng Nhiệm vụ (Screen 5 - Sub).
 * Tích hợp Bản đồ thật, GPS thời gian thực, Dẫn đường và Cảnh báo nguy hiểm.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Dimensions, Alert
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';

const { width, height } = Dimensions.get('window');

// Một số điểm nguy hiểm giả lập để test cảnh báo
const HAZARDS = [
  { id: 'h1', lat: 10.765, lng: 106.662, type: 'Bức xạ cao' },
  { id: 'h2', lat: 10.761, lng: 106.665, type: 'Sụt lún đường' },
];

const MissionNavScreen = ({ navigation, route }) => {
  const { targetLat, targetLng, zoneName = 'Vùng mục tiêu' } = route?.params ?? {};
  
  const [currentPos, setCurrentPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState('--:--');
  const [obstacleAlert, setObstacleAlert] = useState(null);

  const targetCoords = {
    latitude: parseFloat(targetLat) || 10.762622,
    longitude: parseFloat(targetLng) || 106.660172
  };

  useEffect(() => {
    let subscription;

    const startNav = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Theo dõi vị trí liên tục
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5, // Cập nhật mỗi 5m
        },
        (loc) => {
          const { latitude, longitude, heading: h } = loc.coords;
          setCurrentPos({ latitude, longitude });
          setHeading(h || 0);

          // 1. Tính khoảng cách
          const dist = getDistance(latitude, longitude, targetCoords.latitude, targetCoords.longitude);
          setDistance(Math.round(dist));

          // 2. Tính ETA (giả định vận tốc trung bình 30km/h = 8.3m/s)
          const seconds = dist / 8.3;
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          setEta(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);

          // 3. Kiểm tra vật cản/nguy hiểm xung quanh
          const nearbyHazard = HAZARDS.find(h => getDistance(latitude, longitude, h.lat, h.lng) < 150);
          setObstacleAlert(nearbyHazard ? nearbyHazard.type : null);
        }
      );
    };

    startNav();
    return () => subscription && subscription.remove();
  }, []);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        
        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          customMapStyle={darkMapStyle}
          region={currentPos ? {
            ...currentPos,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : {
            ...targetCoords,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          followsUserLocation
        >
          {/* Điểm đích */}
          <Marker coordinate={targetCoords} title={zoneName}>
            <View style={styles.targetMarker}>
              <Text style={styles.targetMarkerText}>🎯</Text>
            </View>
          </Marker>

          {/* Lộ trình (Đường thẳng tượng trưng cho lộ trình tối ưu) */}
          {currentPos && (
            <Polyline
              coordinates={[currentPos, targetCoords]}
              strokeColor={RCOLORS.primary}
              strokeWidth={4}
              lineDashPattern={[5, 5]}
            />
          )}

          {/* Các điểm nguy hiểm */}
          {HAZARDS.map(h => (
            <Marker key={h.id} coordinate={{ latitude: h.lat, longitude: h.lng }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
            </Marker>
          ))}
        </MapView>

        {/* ── Cảnh báo vật cản (Obstacle alert) ─────────────────────────────── */}
        {obstacleAlert && (
          <View style={styles.obstacleAlert}>
            <View style={styles.alertLeft}>
              <Text style={styles.alertTitle}>Vật cản trên lộ trình!</Text>
              <Text style={styles.alertDesc}>Phát hiện {obstacleAlert}. Đề xuất chuyển hướng.</Text>
            </View>
            <View style={styles.alertStats}>
              <Text style={styles.alertDist}>150m</Text>
              <Text style={styles.alertBearing}>Cẩn trọng</Text>
            </View>
          </View>
        )}

        {/* ── Thông tin dẫn đường (Footer) ──────────────────────────────────── */}
        <View style={styles.navFooter}>
          <View style={styles.targetInfo}>
            <Text style={styles.targetLabel}>ĐIỂM ĐẾN</Text>
            <Text style={styles.targetName}>{zoneName}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{eta}</Text>
              <Text style={styles.statLabel}>DỰ KIẾN (ETA)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{distance}m</Text>
              <Text style={styles.statLabel}>KHOẢNG CÁCH</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>30km/h</Text>
              <Text style={styles.statLabel}>VẬN TỐC</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.arriveButton}
            onPress={() => navigation.navigate('MissionsTab', { screen: 'ActiveMissionScreen' })}
          >
            <Text style={styles.arriveText}>XÁC NHẬN ĐÃ ĐẾN VÙNG</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgDark },
  container: { flex: 1 },
  map: { flex: 1 },

  targetMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(229,57,53,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: RCOLORS.primary },
  targetMarkerText: { fontSize: 20 },

  obstacleAlert: { position: 'absolute', top: RSPACING.md, left: RSPACING.base, right: RSPACING.base, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, padding: RSPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...RSHADOWS.redGlow },
  alertTitle: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: RFONTS.black },
  alertDesc: { color: 'rgba(255,255,255,0.85)', fontSize: RFONTS.xs, marginTop: 2 },
  alertStats: { alignItems: 'flex-end' },
  alertDist: { color: '#FFF', fontSize: RFONTS.md, fontWeight: RFONTS.black },
  alertBearing: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: RFONTS.bold },

  navFooter: { backgroundColor: RCOLORS.bgDark, borderTopLeftRadius: RRADIUS.xl, borderTopRightRadius: RRADIUS.xl, padding: RSPACING.lg, gap: RSPACING.lg, ...RSHADOWS.elevated },
  targetInfo: { gap: 4 },
  targetLabel: { color: RCOLORS.primary, fontSize: RFONTS.xs, fontWeight: RFONTS.black, letterSpacing: 1 },
  targetName: { color: '#FFF', fontSize: RFONTS.xl, fontWeight: RFONTS.black },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: RSPACING.md, borderRadius: RRADIUS.md },
  statItem: { alignItems: 'center', gap: 2 },
  statVal: { color: '#FFF', fontSize: RFONTS.lg, fontWeight: RFONTS.black },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: RFONTS.bold },
  divider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' },

  arriveButton: { backgroundColor: '#4CAF50', paddingVertical: 14, borderRadius: RRADIUS.md, alignItems: 'center' },
  arriveText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },
});

export default MissionNavScreen;
