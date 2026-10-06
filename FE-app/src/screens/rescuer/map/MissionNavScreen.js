/**
 * src/screens/rescuer/map/MissionNavScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Điều hướng Nhiệm vụ (Screen 5 - Sub).
 * Tích hợp Bản đồ thật, GPS thời gian thực, Dẫn đường và Cảnh báo nguy hiểm.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Dimensions, Alert, Linking
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../../../components/common/AppMap';
import * as Location from 'expo-location';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';

const { width, height } = Dimensions.get('window');

const MissionNavScreen = ({ navigation, route }) => {
  const { targetLat, targetLng, zoneName = 'Vùng mục tiêu' } = route?.params ?? {};

  const [currentPos, setCurrentPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState('--:--');
  const [routeError, setRouteError] = useState('');
  const [routePath, setRoutePath] = useState([]); // Lộ trình từ A* Server
  const [googleMapsUrl, setGoogleMapsUrl] = useState(null);

  const mapRef = useRef(null);

  const lastRouteFetchRef = useRef(0);

  const [isRouting, setIsRouting] = useState(false);
  const targetCoords = {
    latitude: Number(targetLat),
    longitude: Number(targetLng)
  };

  const validTarget = targetLat != null && targetLng != null && Number.isFinite(targetCoords.latitude) && Math.abs(targetCoords.latitude) <= 90 && Number.isFinite(targetCoords.longitude) && Math.abs(targetCoords.longitude) <= 180;

  const fetchRouteFromServer = async (startPos) => {

    try {

      setIsRouting(true);


      const response = await API.rescueOperations.getRoute(
        {
          lat: startPos.latitude,
          lng: startPos.longitude
        },
        {
          lat: targetCoords.latitude,
          lng: targetCoords.longitude
        }
      );

      if (
        response &&
        response.status === 'success' && Array.isArray(response.path) && response.path.length > 1
      ) {

        setRouteError('');
        setRoutePath(response.path);
        setGoogleMapsUrl(response.google_maps_url || null);

        // Distance thật từ backend
        setDistance(response.distance_meters || 0);

        // ETA thật từ backend
        const mins = Math.ceil(
          (response.eta_seconds || 0) / 60
        );

        setEta(`${mins} phút`);

        // Zoom map theo tuyến đường
        if (
          mapRef.current &&
          response.path.length > 0
        ) {

          mapRef.current.fitToCoordinates(
            response.path,
            {
              edgePadding: {
                top: 100,
                right: 50,
                bottom: 300,
                left: 50
              },
              animated: true
            }
          );
        }
      } else { throw new Error('Không có lộ trình phù hợp.'); }

    } catch (error) {

      console.log(
        'Không thể lấy lộ trình:',
        error.message
      );

      setRoutePath([]); setDistance(null); setEta('--');
      setRouteError('Chưa lấy được lộ trình. Vui lòng kiểm tra kết nối và thử lại.');

    } finally {

      setIsRouting(false);
    }
  };


  useEffect(() => {
    let subscription, cancelled = false;
    if (!validTarget) return;

    const startNav = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') { setRouteError('Cần quyền vị trí để tìm đường.'); return; }

      // Lấy ngay vị trí gần nhất từ cache (0.05s) để tải lộ trình ngay lập tức
      const last = await Location.getLastKnownPositionAsync();
      if (last && !cancelled) {
        setCurrentPos(last.coords);
        setHeading(last.coords.heading || 0);
        lastRouteFetchRef.current = Date.now();
        fetchRouteFromServer(last.coords);
      }

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

          const now = Date.now();

          if (
            now - lastRouteFetchRef.current > 15000
          ) {

            lastRouteFetchRef.current = now;

            fetchRouteFromServer({
              latitude,
              longitude
            });
          }

        }
      );
      if (cancelled) subscription.remove();
    };

    startNav().catch(() => setRouteError('Chưa lấy được vị trí hiện tại.'));
    return () => { cancelled = true; subscription?.remove(); };
  }, []);

  if (!validTarget) return <SafeAreaView style={styles.safe}><RescuerHeader showBack onBack={() => navigation.goBack()} /><Text style={{color:'#FFF',padding:20}}>Nhiệm vụ chưa có tọa độ đích hợp lệ.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} />

      <View style={styles.container}>

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <MapView
          ref={mapRef}
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

          {/* Lộ trình do máy chủ cung cấp */}
          {routePath.length > 0 && (
            <Polyline
              coordinates={routePath}
              strokeColor={RCOLORS.primary}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}

        </MapView>

        {/* ── Thông tin dẫn đường (Footer) ──────────────────────────────────── */}
        <View style={styles.navFooter}>
          {!!routeError && <Text style={{color:"#FFB4AB"}}>{routeError}</Text>}
          {isRouting && <Text style={{color:"#FFF"}}>Đang tìm đường…</Text>}
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
              <Text style={styles.statVal}>{distance == null ? '--' : `${Math.round(distance)}m`}</Text>
              <Text style={styles.statLabel}>KHOẢNG CÁCH</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <TouchableOpacity disabled={!currentPos || isRouting} onPress={() => fetchRouteFromServer(currentPos)}><Text style={styles.statVal}>Tải lại</Text></TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.googleMapsButton}
            onPress={() => {
              let url = googleMapsUrl;
              if (!url && currentPos && validTarget) {
                url = `https://www.google.com/maps/dir/?api=1&origin=${currentPos.latitude},${currentPos.longitude}&destination=${targetCoords.latitude},${targetCoords.longitude}&travelmode=driving`;
              }
              if (url) {
                Linking.openURL(url).catch(() => {
                  Alert.alert('Không thể mở Google Maps', 'Vui lòng kiểm tra ứng dụng Google Maps đã cài đặt.');
                });
              } else {
                Alert.alert('Chưa có vị trí', 'Vui lòng chờ tín hiệu GPS hoặc bấm Tải lại lộ trình.');
              }
            }}
          >
            <Text style={styles.googleMapsText}>🧭 MỞ CHỈ ĐƯỜNG GOOGLE MAPS (NÉ LŨ)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.arriveButton}
            onPress={() => navigation.navigate('MissionsTab', { screen: 'ActiveMissionScreen' })}
          >
            <Text style={styles.arriveText}>VỀ NHIỆM VỤ ĐỂ CẬP NHẬT</Text>
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

  googleMapsButton: { backgroundColor: '#0288D1', paddingVertical: 14, borderRadius: RRADIUS.md, alignItems: 'center' },
  googleMapsText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },
  arriveButton: { backgroundColor: '#4CAF50', paddingVertical: 14, borderRadius: RRADIUS.md, alignItems: 'center' },
  arriveText: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },
});

export default MissionNavScreen;

