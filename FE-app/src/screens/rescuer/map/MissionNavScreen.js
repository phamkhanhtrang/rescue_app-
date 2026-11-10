/**
 * src/screens/rescuer/map/MissionNavScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Điều hướng Nhiệm vụ — Bản đồ Tác chiến kiểu mới.
 * Tối ưu hóa:
 *  - Dùng bản đồ chuẩn sáng sủa (không bị đen thui), hỗ trợ chuyển sang Vệ tinh.
 *  - Tự động tính toán ETA & Khoảng cách (không bao giờ bị gạch nối --:--).
 *  - Nút định vị GPS 1 chạm và Fit toàn bộ lộ trình.
 *  - Panel thông tin dẫn đường sáng, rõ ràng, dễ nhìn dưới trời mưa/nắng.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Dimensions, Alert, Linking, ActivityIndicator
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../../../components/common/AppMap';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS } from '../../../constants/rescuer/theme';
import API from '../../../services/api';

const { width } = Dimensions.get('window');

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
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

const MissionNavScreen = ({ navigation, route }) => {
  const { targetLat, targetLng, zoneName = 'Vùng cứu hộ khẩn cấp' } = route?.params ?? {};

  const [currentPos, setCurrentPos] = useState(null);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState('Đang tính...');
  const [routeError, setRouteError] = useState('');
  const [routePath, setRoutePath] = useState([]);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(null);
  const [mapType, setMapType] = useState('standard'); // 'standard' | 'satellite'
  const [isRouting, setIsRouting] = useState(false);

  const mapRef = useRef(null);
  const lastRouteFetchRef = useRef(0);

  const targetCoords = {
    latitude: Number(targetLat),
    longitude: Number(targetLng)
  };

  const validTarget =
    targetLat != null && targetLng != null &&
    Number.isFinite(targetCoords.latitude) && Math.abs(targetCoords.latitude) <= 90 &&
    Number.isFinite(targetCoords.longitude) && Math.abs(targetCoords.longitude) <= 180;

  // Lấy lộ trình từ máy chủ cứu hộ
  const fetchRouteFromServer = async (startPos) => {
    try {
      setIsRouting(true);
      const response = await API.rescueOperations.getRoute(
        { lat: startPos.latitude, lng: startPos.longitude },
        { lat: targetCoords.latitude, lng: targetCoords.longitude }
      );

      if (response && response.status === 'success' && Array.isArray(response.path) && response.path.length > 1) {
        setRouteError('');
        setRoutePath(response.path);
        setGoogleMapsUrl(response.google_maps_url || null);

        const distM = response.distance_meters || 0;
        setDistance(distM);

        const mins = Math.max(1, Math.ceil((response.eta_seconds || 0) / 60));
        setEta(`${mins} phút`);

        if (mapRef.current && response.path.length > 0) {
          mapRef.current.fitToCoordinates(response.path, {
            edgePadding: { top: 80, right: 40, bottom: 260, left: 40 },
            animated: true
          });
        }
      } else {
        fallbackDistanceAndEta(startPos);
      }
    } catch (error) {
      fallbackDistanceAndEta(startPos);
    } finally {
      setIsRouting(false);
    }
  };

  // Dự phòng tính khoảng cách thực tế khi offline hoặc máy chủ chưa sẵn sàng
  const fallbackDistanceAndEta = (startPos) => {
    const km = calculateHaversineKm(startPos.latitude, startPos.longitude, targetCoords.latitude, targetCoords.longitude);
    const distM = Math.round(km * 1000);
    setDistance(distM);
    // Giả định tốc độ di chuyển cứu hộ bão lũ trung bình ~25 km/h
    const approxMins = Math.max(2, Math.ceil((km / 25) * 60));
    setEta(`~${approxMins} phút`);
    // Tạo đường kẻ thẳng nối 2 điểm nếu chưa có route
    setRoutePath([
      { latitude: startPos.latitude, longitude: startPos.longitude },
      { latitude: targetCoords.latitude, longitude: targetCoords.longitude },
    ]);
  };

  useEffect(() => {
    let subscription;
    let cancelled = false;
    if (!validTarget) return;

    const startNav = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setRouteError('Cần cấp quyền vị trí GPS để định vị và dẫn đường.');
        return;
      }

      const last = await Location.getLastKnownPositionAsync();
      if (last && !cancelled) {
        setCurrentPos(last.coords);
        lastRouteFetchRef.current = Date.now();
        fetchRouteFromServer(last.coords);
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 10,
        },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          setCurrentPos({ latitude, longitude });

          const now = Date.now();
          if (now - lastRouteFetchRef.current > 20000) {
            lastRouteFetchRef.current = now;
            fetchRouteFromServer({ latitude, longitude });
          }
        }
      );
      if (cancelled) subscription.remove();
    };

    startNav().catch(() => setRouteError('Chưa nhận được tín hiệu GPS hiện tại.'));
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  const recenter = () => {
    if (mapRef.current && currentPos) {
      mapRef.current.animateToRegion({
        latitude: currentPos.latitude,
        longitude: currentPos.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 600);
    }
  };

  const fitAll = () => {
    if (mapRef.current && currentPos) {
      mapRef.current.fitToCoordinates([
        currentPos,
        targetCoords
      ], {
        edgePadding: { top: 90, right: 50, bottom: 280, left: 50 },
        animated: true,
      });
    }
  };

  const toggleMapType = () => {
    setMapType(prev => (prev === 'standard' ? 'satellite' : 'standard'));
  };

  const cleanDisplayName = zoneName.includes('Zone AI')
    ? zoneName.replace(/Zone AI/i, 'Vùng cứu nạn')
    : zoneName;

  if (!validTarget) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader showBack onBack={() => navigation.goBack()} />
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>Nhiệm vụ này chưa có tọa độ GPS hợp lệ để dẫn đường.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        {/* ── BẢN ĐỒ KIỂU MỚI (Sáng rõ, có tùy chọn vệ tinh) ────────────────── */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          mapType={mapType}
          initialRegion={{
            ...targetCoords,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          showsUserLocation
          showsCompass
          showsTraffic
        >
          {/* Điểm đích cứu hộ */}
          <Marker coordinate={targetCoords} title={cleanDisplayName} pinColor={RCOLORS.primary}>
            <View style={styles.targetMarker}>
              <MaterialCommunityIcons name="target" size={24} color="#FFF" />
            </View>
          </Marker>

          {/* Tuyến đường dẫn đến hiện trường */}
          {routePath.length > 0 && (
            <Polyline
              coordinates={routePath}
              strokeColor="#1D4ED8"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {/* ── NÚT ĐIỀU KHIỂN NỔI (FAB) ────────────────────────────────────── */}
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fabBtn} onPress={toggleMapType} activeOpacity={0.85}>
            <MaterialCommunityIcons
              name={mapType === 'satellite' ? 'map' : 'satellite-variant'}
              size={22}
              color="#1E293B"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabBtn} onPress={recenter} activeOpacity={0.85}>
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#1D4ED8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabBtn} onPress={fitAll} activeOpacity={0.85}>
            <MaterialCommunityIcons name="fit-to-page-outline" size={22} color="#1E293B" />
          </TouchableOpacity>
        </View>

        {/* ── PANEL THÔNG TIN DẪN ĐƯỜNG (LIGHT THEME ĐỒNG BỘ) ──────────────── */}
        <View style={styles.navFooter}>
          {isRouting && (
            <View style={styles.routingBanner}>
              <ActivityIndicator size="small" color={RCOLORS.primary} />
              <Text style={styles.routingText}>Đang tối ưu lộ trình né ngập lũ...</Text>
            </View>
          )}

          <View style={styles.targetInfo}>
            <View style={styles.targetBadge}>
              <Text style={styles.targetBadgeText}>ĐIỂM ĐẾN CỨU NẠN</Text>
            </View>
            <Text style={styles.targetName} numberOfLines={2}>{cleanDisplayName}</Text>
          </View>

          {/* Hàng chỉ số ETA & Khoảng cách */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{eta}</Text>
              <Text style={styles.statLabel}>DỰ KIẾN (ETA)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>
                {distance == null ? '...' : distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`}
              </Text>
              <Text style={styles.statLabel}>KHOẢNG CÁCH</Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.reloadBtn}
              disabled={!currentPos || isRouting}
              onPress={() => currentPos && fetchRouteFromServer(currentPos)}
            >
              <MaterialCommunityIcons name="refresh" size={18} color="#1D4ED8" />
              <Text style={styles.reloadText}>Cập nhật</Text>
            </TouchableOpacity>
          </View>

          {/* Các nút hành động lớn */}
          <View style={styles.actionBtnGroup}>
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
                  Alert.alert('Chưa có vị trí', 'Vui lòng chờ định vị GPS hoặc bấm Cập nhật lộ trình.');
                }
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="google-maps" size={20} color="#FFF" />
              <Text style={styles.googleMapsText}>CHỈ ĐƯỜNG GOOGLE MAPS (NÉ LŨ)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.arriveButton}
              onPress={() => navigation.navigate('MissionsTab', { screen: 'ActiveMissionScreen' })}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="clipboard-check" size={20} color="#FFF" />
              <Text style={styles.arriveText}>QUAY LẠI TÁC CHIẾN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  map: { flex: 1 },

  errorBox: { padding: 24, alignItems: 'center' },
  errorBoxText: { color: RCOLORS.primary, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  targetMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: RCOLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },

  // Floating Action Buttons
  fabContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 10,
  },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },

  // Panel Dẫn đường đáy (Light theme)
  navFooter: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 24,
    gap: 12,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
  },
  routingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 8,
  },
  routingText: { fontSize: 12, color: '#1D4ED8', fontWeight: '500' },

  targetInfo: { gap: 4 },
  targetBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDEAEA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  targetBadgeText: { color: RCOLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  targetName: { color: '#0F172A', fontSize: 16, fontWeight: '800', lineHeight: 22 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: { alignItems: 'center', gap: 2, flex: 1 },
  statVal: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  statLabel: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  divider: { width: 1, height: 24, backgroundColor: '#E2E8F0' },

  reloadBtn: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 },
  reloadText: { color: '#1D4ED8', fontSize: 11, fontWeight: '700' },

  actionBtnGroup: { gap: 8, marginTop: 4 },
  googleMapsButton: {
    backgroundColor: '#1D4ED8',
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleMapsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  arriveButton: {
    backgroundColor: '#16A34A',
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  arriveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});

export default MissionNavScreen;
