/**
 * src/screens/citizen/map/MapScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Bản đồ điều phối (Tab MAP).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Dimensions, ActivityIndicator,
} from 'react-native';

import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../constants/citizen/theme';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Mock dữ liệu alert trên bản đồ ─────────────────────────────────────────
const IMMEDIATE_THREAT = {
  distance: 'CÁCH ĐÂY 3.4 KM',
  title: 'Ngập lụt: Nguy cơ cao',
  description: 'Đề xuất sơ tán cho khu vực vùng thấp. Tránh các tuyến đường qua vùng ngập lụt.',
};

const MapScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [addressName, setAddressName] = useState('Đang xác định...');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);

      // Lấy tên khu vực
      let reverse = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (reverse && reverse.length > 0) {
        setAddressName(`${reverse[0].district || ''}, ${reverse[0].city || reverse[0].region || ''}`);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader dark />

      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            customMapStyle={mapDarkStyle} // Theme tối cho đồng bộ Sentinel
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
            zoomEnabled={true}
            scrollEnabled={true}
          >
            {/* Vùng nguy hiểm giả lập (Circle) */}
            <Circle
              center={{
                latitude: location.latitude + 0.005,
                longitude: location.longitude + 0.005,
              }}
              radius={500}
              fillColor="rgba(229, 57, 53, 0.2)"
              strokeColor="rgba(229, 57, 53, 0.5)"
              strokeWidth={2}
            />

            {/* Marker cảnh báo */}
            <Marker
              coordinate={{
                latitude: location.latitude + 0.005,
                longitude: location.longitude + 0.005,
              }}
              title="Khu vực ngập lụt"
              description="Nguy cơ cao, tránh di chuyển qua đây"
            />
          </MapView>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải bản đồ vệ tinh...</Text>
          </View>
        )}

        {/* ── Overlay UI giữ nguyên phong cách ───────────────────────────── */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          {/* AI badge */}
          <View style={styles.aiBadge}>
            <View style={styles.aiDot} />
            <Text style={styles.aiText}>ĐANG TỐI ƯU HÓA TUYẾN ĐƯỜNG AI</Text>
          </View>

          {/* Area label */}
          <View style={styles.areaLabel}>
            <Text style={styles.areaName}>{addressName}</Text>
            <Text style={styles.areaCoords}>
              {location ? `${location.latitude.toFixed(4)}° N · ${location.longitude.toFixed(4)}° E` : 'Đang dò GPS...'}
            </Text>
          </View>

          {/* Alert popup */}
          <TouchableOpacity
            style={styles.alertPopup}
            onPress={() => navigation.navigate('AlertsTab')}
          >
            <View style={[styles.alertDot, { backgroundColor: COLORS.statusOrange }]} />
            <View>
              <Text style={styles.alertPopupType}>CẢNH BÁO HOẠT ĐỘNG</Text>
              <Text style={styles.alertPopupTitle}>Khẩn cấp y tế lân cận</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Bottom threat panel ─────────────────────────────────────────── */}
        <View style={styles.threatPanel}>
          <View style={styles.threatHeader}>
            <View style={styles.threatBadge}>
              <Text style={styles.threatBadgeText}>⚠ MỐI ĐE DỌA TỨC THỜI</Text>
            </View>
            <Text style={styles.threatDistance}>{IMMEDIATE_THREAT.distance}</Text>
          </View>

          <Text style={styles.threatTitle}>{IMMEDIATE_THREAT.title}</Text>
          <Text style={styles.threatDesc} numberOfLines={2}>
            {IMMEDIATE_THREAT.description}
          </Text>

          <TouchableOpacity
            style={styles.routeButton}
            onPress={() => navigation.navigate('AlertsTab')}
          >
            <Text style={styles.routeText}>Xem tuyến đường an toàn  →</Text>
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
    backgroundColor: 'rgba(0, 150, 136, 0.9)',
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  areaCoords: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 2,
  },
  alertPopup: {
    position: 'absolute',
    bottom: 240, // Để trên threatPanel
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  alertDot: {
    width: 10, height: 10,
    borderRadius: 5,
  },
  alertPopupType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.statusOrange,
    letterSpacing: 0.5,
  },
  alertPopupTitle: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  threatPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0D1421',
    padding: SPACING.base,
    paddingBottom: 34, // Padding cho iPhone/Android mới có thanh bar
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
    backgroundColor: '#B71C1C',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  threatBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  threatDistance: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  threatTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  threatDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
  },
  routeButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: 8,
  },
  routeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  floatingSOS: {
    position: 'absolute',
    bottom: 220, // Đẩy lên cao hơn để không bị threatPanel che
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

// Theme tối cho Map
const mapDarkStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default MapScreen;
