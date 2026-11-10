/**
 * src/screens/rescuer/map/RescuerMapScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bản đồ Tác chiến & Hiệp đồng Cứu nạn Thực địa (Tab 2: BẢN ĐỒ).
 * Tối ưu hóa:
 *  - Bộ lọc chip tác chiến: Tất cả | 🚨 SOS khẩn cấp | 📍 Vùng sự cố | 🛟 Đồng đội.
 *  - Cụm phím điều khiển nổi (FAB): Định vị GPS, Chuyển bản đồ vệ tinh, Bảng chú giải, Menu danh sách, Làm mới.
 *  - Khi chạm vào Marker SOS: Bảng lệnh chi tiết hỗ trợ Gọi điện ngay cho người dân và Dẫn đường GPS turn-by-turn.
 *  - Khi chạm vào Marker Đồng đội: Gọi điện hiệp đồng tác chiến tức thời.
 *  - Thanh điều hướng đáy (Bottom Command Bar) hiển thị nhiệm vụ hiện tại và nút Dẫn đường.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Dimensions, ScrollView, Modal, Pressable, Linking
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Polyline } from '../../../components/common/AppMap';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import {
  RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT,
} from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const { width } = Dimensions.get('window');

const RescuerMapScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [zones, setZones] = useState([]);
  const [sosList, setSosList] = useState([]);
  const [otherRescuers, setOtherRescuers] = useState([]);
  const [fieldReports, setFieldReports] = useState([]);
  const [activeMission, setActiveMission] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [votingHazard, setVotingHazard] = useState(false);

  // Map view custom options
  const [mapType, setMapType] = useState('standard'); // 'standard' | 'satellite'
  const [showLegend, setShowLegend] = useState(false);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'SOS' | 'ZONES' | 'HAZARDS' | 'RESCUERS'

  const mapRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const validCoords = (lat, lng) =>
    lat != null && lng != null &&
    String(lat).trim() !== '' && String(lng).trim() !== '' &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;

  const openItem = (type, item) => {
    setShowSideMenu(false);
    setSelectedItem({ type, item });
  };

  const statusLabel = value => ({
    PENDING: 'Chờ tiếp nhận',
    ACKNOWLEDGED: 'Đã tiếp nhận',
    IN_PROGRESS: 'Đang cứu nạn',
    ACTIVE: 'Đang hoạt động',
    CRITICAL: 'Nguy cấp',
    HIGH: 'Cao',
    MEDIUM: 'Trung bình',
    LOW: 'Thấp',
  }[value] || value || 'Chưa cập nhật');

  const flyTo = (lat, lng) => {
    if (mapRef.current && validCoords(lat, lng)) {
      mapRef.current.animateCamera({
        center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
        zoom: 16,
      }, { duration: 800 });
      setShowSideMenu(false);
    }
  };

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [zonesRes, missionsRes, sosRes, rescuersRes, fieldReportsRes] = await Promise.all([
        API.zones.getAll(),
        API.missions.getAll({ rescuer_id: userInfo?.id }),
        API.sos.getAll(),
        API.rescuers.getAll(),
        API.fieldReports.getAll({ active_only: 'true' }).catch(() => ({ results: [] })),
      ]);

      const fetchedSos = sosRes.results || sosRes || [];
      const activeSos = fetchedSos.filter(s => ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(s.status));
      setSosList(activeSos);

      let fetchedRescuers = rescuersRes.results || rescuersRes || [];
      fetchedRescuers = fetchedRescuers.filter(r => r.is_active && r.id !== userInfo?.id && r.rescuer_profile?.current_lat);
      setOtherRescuers(fetchedRescuers);

      let fetchedZones = zonesRes.results || [];
      fetchedZones = fetchedZones.filter(z => z.status !== 'RESOLVED');
      setZones(fetchedZones);

      const rawReports = Array.isArray(fieldReportsRes) ? fieldReportsRes : fieldReportsRes?.results || [];
      setFieldReports(rawReports.filter(r => validCoords(r.location_lat, r.location_lng)));

      if (missionsRes.results) {
        setActiveMission(missionsRes.results.find(m => !['COMPLETED', 'CANCELLED'].includes(m.status)) || null);
      }
    } catch (err) {
      console.error('Fetch map data error:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const handleRescuerHazardVote = async (reportId, verdict, defaultNote) => {
    try {
      setVotingHazard(true);
      const rescuerName = userInfo?.rescuer_profile?.unit_name || userInfo?.full_name || 'Đội Cứu Hộ';
      const updated = await API.fieldReports.vote(reportId, {
        verdict,
        note: defaultNote,
        voter_name: rescuerName,
        voter_role: 'RESCUER',
        voter_id: userInfo?.id ? `rescuer_${userInfo.id}` : `rescuer_${rescuerName}`,
      });
      setSelectedItem({ type: 'hazard', item: updated });
      await fetchData();
      setModalConfig({
        visible: true,
        type: 'success',
        title: '✓ Đã cập nhật hiện trường',
        message: `Đã ghi nhận đánh giá của Đội cứu hộ (${updated.status_display || updated.status}).`,
      });
    } catch (err) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi cập nhật',
        message: err?.message || 'Không thể gửi đánh giá hiện trường.',
      });
    } finally {
      setVotingHazard(false);
    }
  };

  useEffect(() => {
    const initMap = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setModalConfig({
            visible: true,
            type: 'warning',
            title: 'Quyền GPS chưa cấp',
            message: 'Ứng dụng cần quyền vị trí để định vị và điều hướng tác chiến.',
          });
        } else {
          const lastLoc = await Location.getLastKnownPositionAsync();
          if (lastLoc) setCurrentLocation(lastLoc.coords);
          Location.getCurrentPositionAsync({}).then(loc => {
            if (loc) setCurrentLocation(loc.coords);
          }).catch(() => {});
        }
        fetchData();
      } catch (err) {
        console.error('Init map error:', err);
        setLoading(false);
      }
    };

    initMap();
    const timer = setInterval(fetchData, 25000);
    return () => clearInterval(timer);
  }, []);

  const getSeverityColor = (severity) => {
    switch ((severity || '').toUpperCase()) {
      case 'CRITICAL': return RCOLORS.primary;
      case 'HIGH':     return '#F57C00';
      case 'MEDIUM':   return '#0288D1';
      case 'LOW':      return '#16A34A';
      default:         return '#1E293B';
    }
  };

  const getZoneFillColor = (severity) => {
    switch ((severity || '').toUpperCase()) {
      case 'CRITICAL': return 'rgba(183, 19, 26, 0.15)';
      case 'HIGH':     return 'rgba(245, 124, 0, 0.15)';
      case 'MEDIUM':   return 'rgba(2, 136, 209, 0.15)';
      default:         return 'rgba(22, 163, 74, 0.15)';
    }
  };

  const deployedZone = zones.find(z => z.id === activeMission?.zone);

  const filteredSosList = sosList.filter(s => {
    if (filterMode === 'RESCUERS' || filterMode === 'ZONES' || filterMode === 'HAZARDS') return false;
    return true;
  });

  const filteredOtherRescuers = otherRescuers.filter(r => {
    if (filterMode === 'SOS' || filterMode === 'ZONES' || filterMode === 'HAZARDS') return false;
    return true;
  });

  const filteredZones = zones.filter(z => {
    if (filterMode === 'SOS' || filterMode === 'RESCUERS' || filterMode === 'HAZARDS') return false;
    return true;
  });

  const filteredFieldReports = fieldReports.filter(() => {
    if (filterMode === 'SOS' || filterMode === 'RESCUERS' || filterMode === 'ZONES') return false;
    return true;
  });

  const callContact = (phone) => {
    if (!phone) {
      setModalConfig({
        visible: true,
        type: 'info',
        title: 'Chưa có số điện thoại',
        message: 'Mục này không có số điện thoại liên lạc.',
      });
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Lỗi cuộc gọi',
        message: 'Không thể kích hoạt cuộc gọi trên thiết bị này.',
      });
    });
  };

  const navigateToPoint = (lat, lng, name) => {
    if (!lat || !lng) return;
    setSelectedItem(null);
    navigation.navigate('MissionNavScreen', {
      targetLat: parseFloat(lat),
      targetLng: parseFloat(lng),
      zoneName: name,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader />

      {/* ─── 1. BỘ LỌC TÁC CHIẾN (CHIP TABS) ─────────────────────────── */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'ALL' && styles.filterChipActiveNavy]}
            onPress={() => setFilterMode('ALL')}
          >
            <MaterialCommunityIcons name="layers-outline" size={16} color={filterMode === 'ALL' ? '#FFF' : RCOLORS.textSecondary} />
            <Text style={[styles.filterChipText, filterMode === 'ALL' && styles.filterChipTextActive]}>
              Tất cả ({sosList.length + zones.length + fieldReports.length + otherRescuers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'SOS' && styles.filterChipActiveRed]}
            onPress={() => setFilterMode('SOS')}
          >
            <MaterialCommunityIcons name="alert-octagon" size={16} color={filterMode === 'SOS' ? '#FFF' : RCOLORS.primary} />
            <Text style={[styles.filterChipText, filterMode === 'SOS' && styles.filterChipTextActive]}>
              Điểm SOS ({sosList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'HAZARDS' && styles.filterChipActiveOrange]}
            onPress={() => setFilterMode('HAZARDS')}
          >
            <MaterialCommunityIcons name="waves" size={16} color={filterMode === 'HAZARDS' ? '#FFF' : '#EA580C'} />
            <Text style={[styles.filterChipText, filterMode === 'HAZARDS' && styles.filterChipTextActive]}>
              Điểm ngập/Chặn ({fieldReports.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'ZONES' && styles.filterChipActiveOrange]}
            onPress={() => setFilterMode('ZONES')}
          >
            <MaterialCommunityIcons name="map-marker-radius" size={16} color={filterMode === 'ZONES' ? '#FFF' : '#EA580C'} />
            <Text style={[styles.filterChipText, filterMode === 'ZONES' && styles.filterChipTextActive]}>
              Vùng sự cố ({zones.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'RESCUERS' && styles.filterChipActiveBlue]}
            onPress={() => setFilterMode('RESCUERS')}
          >
            <MaterialCommunityIcons name="account-group" size={16} color={filterMode === 'RESCUERS' ? '#FFF' : RCOLORS.bgBlue} />
            <Text style={[styles.filterChipText, filterMode === 'RESCUERS' && styles.filterChipTextActive]}>
              Đồng đội ({otherRescuers.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ─── 2. BẢN ĐỒ TÁC CHIẾN ────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={RCOLORS.primary} />
            <Text style={styles.loadingText}>Đang tải bản đồ tác chiến...</Text>
          </View>
        ) : (
          <>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              mapType={mapType}
              initialRegion={{
                latitude: currentLocation?.latitude || 15.9829225,
                longitude: currentLocation?.longitude || 108.2109632,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              showsUserLocation={true}
              showsMyLocationButton={false}
            >
              {/* Vị trí bản thân */}
              {currentLocation && (
                <Marker
                  coordinate={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.myLocationPin} collapsable={false} pointerEvents="none">
                    <MaterialCommunityIcons name="shield-account" size={20} color="#FFF" />
                  </View>
                </Marker>
              )}

              {/* Các vùng sự cố (Vòng tròn & Marker) */}
              {filteredZones.map(z => {
                const color = getSeverityColor(z.severity);
                const lat = parseFloat(z.location_lat);
                const lng = parseFloat(z.location_lng);
                if (!validCoords(z.location_lat, z.location_lng)) return null;

                return (
                  <React.Fragment key={`zone-frag-${z.id}`}>
                    <Circle
                      center={{ latitude: lat, longitude: lng }}
                      radius={Number(z.radius_meters) || 800}
                      fillColor={getZoneFillColor(z.severity)}
                      strokeColor={color}
                      strokeWidth={z.id === activeMission?.zone ? 3.5 : 2}
                      zIndex={1}
                    />

                    <Marker
                      coordinate={{ latitude: lat, longitude: lng }}
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={2}
                      onPress={() => openItem('zone', z)}
                    >
                      <View style={[styles.zonePin, { backgroundColor: color }]} collapsable={false} pointerEvents="none">
                        <MaterialCommunityIcons name="map-marker-alert" size={18} color="#FFF" />
                      </View>
                    </Marker>
                  </React.Fragment>
                );
              })}

              {/* Điểm SOS của người dân (Tự tách góc tròn nếu trùng vị trí) */}
              {filteredSosList.filter(s => validCoords(s.location_lat, s.location_lng)).map((s, idx) => {
                const angle = idx * 2.39996;
                const dLat = 0.00014 * Math.sin(angle);
                const dLng = 0.00014 * Math.cos(angle);
                return (
                  <Marker
                    key={`sos-${s.id}`}
                    onPress={() => openItem('sos', s)}
                    coordinate={{
                      latitude: parseFloat(s.location_lat) + dLat,
                      longitude: parseFloat(s.location_lng) + dLng,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    zIndex={3}
                  >
                    <View style={styles.sosPin} collapsable={false} pointerEvents="none">
                      <MaterialCommunityIcons name="alert-decagram" size={16} color="#FFF" />
                    </View>
                  </Marker>
                );
              })}

              {/* Đoạn đường ngập / Chướng ngại vật do người dân báo (Polyline bám mặt đường + Pin tròn 28px) */}
              {filteredFieldReports.map((rep, idx) => {
                const rLat = parseFloat(rep.location_lat);
                const rLng = parseFloat(rep.location_lng);
                const isReceding = rep.status === 'RECEDING';
                const isVer = rep.status === 'VERIFIED' || rep.is_verified;
                const isCleared = rep.status === 'CLEARED';
                const col = isCleared ? '#16A34A' : isReceding ? '#D97706' : isVer ? '#DC2626' : '#EA580C';
                const roadCoords =
                  Array.isArray(rep.road_geometry) && rep.road_geometry.length >= 2
                    ? rep.road_geometry.map((pt) => ({
                        latitude: parseFloat(pt[0]),
                        longitude: parseFloat(pt[1]),
                      }))
                    : [
                      { latitude: rLat - 0.00055, longitude: rLng - 0.00055 },
                      { latitude: rLat, longitude: rLng },
                      { latitude: rLat + 0.00055, longitude: rLng + 0.00055 },
                    ];
                const midPt = roadCoords[Math.floor(roadCoords.length / 2)] || { latitude: rLat, longitude: rLng };
                const iconMap = {
                  FLOOD: '🌊',
                  FALLEN_TREE: '🌲',
                  LANDSLIDE: '⛰️',
                  POWER_LINE: '⚡',
                  ROAD_BLOCKED: '🚧',
                };
                return (
                  <React.Fragment key={`hazard-${rep.id}`}>
                    <Polyline
                      coordinates={roadCoords}
                      strokeColor="#FFFFFF"
                      strokeWidth={9}
                      zIndex={2}
                    />
                    <Polyline
                      coordinates={roadCoords}
                      strokeColor={col}
                      strokeWidth={6}
                      lineDashPattern={isReceding ? [8, 6] : isVer || isCleared ? undefined : [6, 6]}
                      tappable
                      onPress={() => openItem('hazard', rep)}
                      zIndex={3}
                    />
                    <Marker
                      coordinate={{ latitude: midPt.latitude, longitude: midPt.longitude }}
                      anchor={{ x: 0.5, y: 0.5 }}
                      onPress={() => openItem('hazard', rep)}
                      zIndex={4}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          backgroundColor: col,
                          borderWidth: 2,
                          borderColor: '#FFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          elevation: 4,
                        }}
                      >
                        <Text style={{ fontSize: 13 }}>{isCleared ? '✅' : iconMap[rep.hazard_type] || '⚠️'}</Text>
                      </View>
                    </Marker>
                  </React.Fragment>
                );
              })}

              {/* Đồng đội cứu hộ */}
              {filteredOtherRescuers.filter(r => validCoords(r.rescuer_profile?.current_lat, r.rescuer_profile?.current_lng)).map(r => (
                <Marker
                  key={`rescuer-${r.id}`}
                  onPress={() => openItem('rescuer', r)}
                  coordinate={{
                    latitude: parseFloat(r.rescuer_profile.current_lat),
                    longitude: parseFloat(r.rescuer_profile.current_lng),
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={2}
                >
                  <View style={styles.rescuerPin} collapsable={false} pointerEvents="none">
                    <MaterialCommunityIcons name="account-group" size={16} color="#FFF" />
                  </View>
                </Marker>
              ))}
            </MapView>

            {/* Cụm Nút Điều Khiển Tác Chiến Bên Phải */}
            <View style={styles.rightControls}>
              {/* Định vị GPS */}
              <TouchableOpacity
                style={styles.fabBtn}
                onPress={() => {
                  if (currentLocation && mapRef.current) {
                    mapRef.current.animateCamera({
                      center: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                      zoom: 16,
                    }, { duration: 800 });
                  }
                }}
              >
                <MaterialCommunityIcons name="crosshairs-gps" size={22} color={RCOLORS.bgNavy} />
              </TouchableOpacity>

              {/* Đổi kiểu bản đồ Vệ tinh */}
              <TouchableOpacity
                style={[styles.fabBtn, mapType === 'satellite' && styles.fabBtnActive]}
                onPress={() => setMapType(prev => prev === 'standard' ? 'satellite' : 'standard')}
              >
                <MaterialCommunityIcons
                  name={mapType === 'standard' ? 'satellite-variant' : 'map'}
                  size={22}
                  color={mapType === 'satellite' ? '#FFF' : RCOLORS.bgNavy}
                />
              </TouchableOpacity>

              {/* Bảng chú giải */}
              <TouchableOpacity
                style={[styles.fabBtn, showLegend && styles.fabBtnActive]}
                onPress={() => setShowLegend(prev => !prev)}
              >
                <MaterialCommunityIcons
                  name="information-outline"
                  size={22}
                  color={showLegend ? '#FFF' : RCOLORS.bgNavy}
                />
              </TouchableOpacity>

              {/* Danh sách nhanh */}
              <TouchableOpacity
                style={[styles.fabBtn, showSideMenu && styles.fabBtnActive]}
                onPress={() => setShowSideMenu(prev => !prev)}
              >
                <MaterialCommunityIcons
                  name="format-list-bulleted"
                  size={22}
                  color={showSideMenu ? '#FFF' : RCOLORS.bgNavy}
                />
              </TouchableOpacity>

              {/* Làm mới dữ liệu */}
              <TouchableOpacity
                style={styles.fabBtn}
                onPress={fetchData}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={RCOLORS.primary} />
                ) : (
                  <MaterialCommunityIcons name="refresh" size={22} color={RCOLORS.bgNavy} />
                )}
              </TouchableOpacity>
            </View>

            {/* Chú giải nổi */}
            {showLegend && (
              <View style={styles.legendPanel}>
                <Text style={styles.legendTitle}>KÝ HIỆU TÁC CHIẾN</Text>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: RCOLORS.primary }]} />
                  <Text style={styles.legendLabel}>Điểm SOS người dân</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                  <Text style={styles.legendLabel}>🌊 Điểm ngập / Chặn đường (150m)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#EA580C' }]} />
                  <Text style={styles.legendLabel}>Tâm vùng sự cố</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: RCOLORS.bgBlue }]} />
                  <Text style={styles.legendLabel}>Vị trí đồng đội cứu hộ</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: RCOLORS.statusGreen }]} />
                  <Text style={styles.legendLabel}>Vị trí của bạn</Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* ─── 3. THANH ĐIỀU HÀNH ĐÁY (COMMAND FOOTER) ─────────────────── */}
      {!loading && (
        <View style={styles.bottomCommandBar}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.commandBarLabel}>KHU VỰC NHIỆM VỤ ĐANG THỰC HIỆN</Text>
            <Text style={styles.commandBarValue} numberOfLines={1}>
              {deployedZone ? `📍 ${deployedZone.name}` : (activeMission ? 'Nhiệm vụ trực tiếp' : 'Chưa nhận nhiệm vụ')}
            </Text>
          </View>
          {deployedZone ? (
            <TouchableOpacity
              style={styles.commandNavBtn}
              onPress={() => navigateToPoint(deployedZone.location_lat, deployedZone.location_lng, deployedZone.name)}
            >
              <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFF" />
              <Text style={styles.commandNavBtnText}>DẪN ĐƯỜNG</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.commandSelectBtn}
              onPress={() => navigation.navigate('MissionsTab', { screen: 'ZoneListScreen' })}
            >
              <Text style={styles.commandSelectBtnText}>CHỌN VÙNG →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ─── 4. BOTTOM SHEET CHI TIẾT ĐỐI TƯỢNG ĐÃ CHỌN ──────────────── */}
      <Modal
        visible={showSideMenu || !!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowSideMenu(false); setSelectedItem(null); }}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setShowSideMenu(false); setSelectedItem(null); }} />
          <SafeAreaView style={styles.sheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {selectedItem ? 'Chi tiết trên bản đồ' : 'Danh sách cứu trợ & đồng đội'}
              </Text>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => { setShowSideMenu(false); setSelectedItem(null); }}
              >
                <MaterialCommunityIcons name="close" size={24} color={RCOLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody}>
              {selectedItem ? (() => {
                const { type, item } = selectedItem;
                const lat = type === 'rescuer' ? item.rescuer_profile?.current_lat : item.location_lat;
                const lng = type === 'rescuer' ? item.rescuer_profile?.current_lng : item.location_lng;
                const phone = type === 'rescuer' ? item.phone : (item.contact_phone || item.phone);
                const title =
                  type === 'zone'
                    ? item.name
                    : type === 'sos'
                    ? (item.contact_name || item.citizen_name || 'Người dân cần cứu hộ')
                    : type === 'hazard'
                    ? `${item.hazard_display || 'Điểm cảnh báo'}${item.water_level_cm > 0 ? ` (${item.water_level_cm}cm)` : ''}`
                    : (item.rescuer_profile?.unit_name || item.full_name || 'Đội cứu hộ');

                return (
                  <View style={styles.detailBox}>
                    <View style={styles.detailTitleRow}>
                      <View style={[styles.detailTypeIcon, { backgroundColor: type === 'sos' ? '#FEF2F2' : type === 'zone' || type === 'hazard' ? '#FFF7ED' : '#EFF6FF' }]}>
                        <MaterialCommunityIcons
                          name={type === 'sos' ? 'alert-decagram' : type === 'hazard' ? 'waves' : type === 'zone' ? 'map-marker-radius' : 'account-group'}
                          size={24}
                          color={type === 'sos' ? RCOLORS.primary : type === 'zone' || type === 'hazard' ? '#EA580C' : RCOLORS.bgBlue}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailHeaderTitle}>{title}</Text>
                        <Text style={styles.detailHeaderSub}>
                          {type === 'zone'
                            ? `Mức độ: ${statusLabel(item.severity)}`
                            : type === 'sos'
                            ? `Trạng thái: ${statusLabel(item.status)}`
                            : type === 'hazard'
                            ? `Trạng thái: ${item.status_display || item.status} (${item.report_count || 1} xác nhận)`
                            : 'Đồng đội cứu hộ'}
                        </Text>
                      </View>
                    </View>

                    {/* Chi tiết từng loại đối tượng */}
                    {type === 'sos' && (
                      <View style={styles.detailDataBox}>
                        <Text style={styles.detailItemText}>
                          👥 Số lượng người cần cứu: <Text style={{ fontWeight: '700', color: RCOLORS.textPrimary }}>{item.people_count || 1} người</Text>
                        </Text>
                        {!!item.address && (
                          <Text style={styles.detailItemText}>📍 Địa chỉ: {item.address}</Text>
                        )}
                        {!!item.note && (
                          <Text style={styles.detailItemText}>💬 Tình huống: {item.note}</Text>
                        )}
                      </View>
                    )}

                    {type === 'hazard' && (
                      <View style={styles.detailDataBox}>
                        <Text style={styles.detailItemText}>
                          📍 Vị trí: {item.address || `${Number(item.location_lat).toFixed(5)}, ${Number(item.location_lng).toFixed(5)}`}
                        </Text>
                        {!!item.description && (
                          <Text style={styles.detailItemText}>📝 Mô tả: {item.description}</Text>
                        )}
                        {item.votes && item.votes.length > 0 && item.votes[0].note ? (
                          <Text style={styles.detailItemText}>
                            💬 Ghi chú mới nhất ({item.votes[0].voter_name}): "{item.votes[0].note}"
                          </Text>
                        ) : null}

                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <TouchableOpacity
                            disabled={votingHazard}
                            style={{ flex: 1, backgroundColor: '#DC2626', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => handleRescuerHazardVote(item.id, 'CONFIRM_DANGER', 'Đội cứu hộ xác nhận tại hiện trường: Đường đang ngập sâu / không thể đi qua.')}
                          >
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>🔴 Đang ngập/Chặn</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={votingHazard}
                            style={{ flex: 1, backgroundColor: '#D97706', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => handleRescuerHazardVote(item.id, 'RECEDING', 'Đội cứu hộ cập nhật: Nước đang rút nhưng mặt đường vẫn còn ngập nhẹ.')}
                          >
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>🟡 Nước đang rút</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={votingHazard}
                            style={{ flex: 1, backgroundColor: '#16A34A', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => handleRescuerHazardVote(item.id, 'CLEARED', 'Đội cứu hộ xác nhận: Đường đã thông hoàn toàn, mở khóa dẫn đường.')}
                          >
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>🟢 Đường đã thông</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {type === 'zone' && (
                      <View style={styles.detailDataBox}>
                        <Text style={styles.detailItemText}>
                          ⚠️ Nhu cầu cứu nạn: {item.rescuers_needed || 0} đội · Ảnh hưởng: {item.people_affected || 0} người
                        </Text>
                        <Text style={styles.detailItemText}>{item.description || 'Chưa có thông tin mô tả chi tiết vùng.'}</Text>
                      </View>
                    )}

                    {type === 'rescuer' && (
                      <View style={styles.detailDataBox}>
                        <Text style={styles.detailItemText}>👤 Đội trưởng / Người phụ trách: {item.full_name || item.username}</Text>
                        <Text style={styles.detailItemText}>📞 Số điện thoại: {item.phone || 'Chưa cập nhật'}</Text>
                        <Text style={styles.detailItemText}>Vị trí được GPS tự động cập nhật từ hiện trường.</Text>
                      </View>
                    )}

                    {/* Cụm nút hành động nhanh cho đối tượng */}
                    <View style={styles.detailActionGrid}>
                      {!!phone && (
                        <TouchableOpacity
                          style={styles.sheetCallBtn}
                          onPress={() => callContact(phone)}
                        >
                          <MaterialCommunityIcons name="phone" size={18} color="#FFF" />
                          <Text style={styles.sheetCallBtnText}>Gọi điện ({phone})</Text>
                        </TouchableOpacity>
                      )}

                      {validCoords(lat, lng) && (
                        <TouchableOpacity
                          style={styles.sheetNavBtn}
                          onPress={() => navigateToPoint(lat, lng, title)}
                        >
                          <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFF" />
                          <Text style={styles.sheetNavBtnText}>Dẫn đường GPS</Text>
                        </TouchableOpacity>
                      )}

                      {type === 'zone' && (
                        <TouchableOpacity
                          style={styles.sheetZoneDetailBtn}
                          onPress={() => {
                            setSelectedItem(null);
                            navigation.navigate('MissionsTab', {
                              screen: 'ZoneDetailScreen',
                              params: { zoneId: item.id, zoneName: item.name },
                            });
                          }}
                        >
                          <Text style={styles.sheetZoneDetailBtnText}>Xem chi tiết vùng sự cố →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })() : (
                <View style={{ gap: 14 }}>
                  <Text style={styles.sideMenuStat}>
                    Đang hiển thị {zones.length} vùng sự cố · {sosList.length} điểm SOS · {otherRescuers.length} đồng đội
                  </Text>

                  {/* Danh sách các điểm SOS cần hỗ trợ */}
                  <Text style={styles.sideMenuSectionTitle}>CÁC ĐIỂM SOS GẦN BẠN</Text>
                  {sosList.slice(0, 8).map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.sideMenuRow}
                      onPress={() => openItem('sos', s)}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.sideMenuRowTitle}>
                          🚨 {s.contact_name || s.emergency_type || 'SOS khẩn cấp'} · {s.people_count || 1} người
                        </Text>
                        <Text style={styles.sideMenuRowSub} numberOfLines={1}>
                          📍 {s.address || 'Hiện trường chưa rõ địa chỉ'}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={RCOLORS.textSecondary} />
                    </TouchableOpacity>
                  ))}

                  {/* Danh sách đồng đội */}
                  <Text style={[styles.sideMenuSectionTitle, { marginTop: 10 }]}>LỰC LƯỢNG ĐỒNG ĐỘI</Text>
                  {otherRescuers.map(r => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.sideMenuRow}
                      onPress={() => openItem('rescuer', r)}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.sideMenuRowTitle}>
                          🛟 {r.rescuer_profile?.unit_name || r.full_name || 'Đội cứu hộ'}
                        </Text>
                        <Text style={styles.sideMenuRowSub}>
                          📞 {r.phone || 'Chưa cập nhật SĐT'}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={RCOLORS.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={() => setModalConfig(prev => ({ ...prev, visible: false }))}
        onCancel={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1220' },
  filterContainer: { backgroundColor: RCOLORS.bgWhite, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', ...RSHADOWS.card },
  filterScroll: { paddingHorizontal: 12, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: RRADIUS.full, borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActiveNavy: { backgroundColor: RCOLORS.bgNavy, borderColor: RCOLORS.bgNavy },
  filterChipActiveRed: { backgroundColor: RCOLORS.primary, borderColor: RCOLORS.primary },
  filterChipActiveOrange: { backgroundColor: '#EA580C', borderColor: '#EA580C' },
  filterChipActiveBlue: { backgroundColor: RCOLORS.bgBlue, borderColor: RCOLORS.bgBlue },
  filterChipText: { fontSize: 11, fontWeight: '600', color: RCOLORS.textSecondary },
  filterChipTextActive: { color: '#FFF', fontWeight: '700' },

  mapContainer: { flex: 1, position: 'relative' },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: RFONTS.sm, color: '#FFF' },

  // Marker Pins
  myLocationPin: { width: 36, height: 36, borderRadius: 18, backgroundColor: RCOLORS.statusGreen, borderWidth: 3, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...RSHADOWS.elevated },
  zonePin: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...RSHADOWS.elevated },
  sosPin: { width: 34, height: 34, borderRadius: 17, backgroundColor: RCOLORS.primary, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...RSHADOWS.elevated },
  rescuerPin: { width: 32, height: 32, borderRadius: 16, backgroundColor: RCOLORS.bgBlue, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...RSHADOWS.elevated },

  // Right FAB controls
  rightControls: { position: 'absolute', right: 14, bottom: 20, gap: 10, alignItems: 'center' },
  fabBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: RCOLORS.bgWhite, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', ...RSHADOWS.elevated },
  fabBtnActive: { backgroundColor: RCOLORS.bgNavy, borderColor: RCOLORS.bgNavy },

  // Legend
  legendPanel: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(15,23,42,0.92)', borderRadius: RRADIUS.md, padding: 12, gap: 6, borderWidth: 1, borderColor: '#334155' },
  legendTitle: { fontSize: 10, fontWeight: '800', color: '#CBD5E1', letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: '#E2E8F0', fontWeight: '500' },

  // Bottom Command Bar
  bottomCommandBar: { backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  commandBarLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  commandBarValue: { fontSize: RFONTS.sm, fontWeight: '800', color: '#FFF' },
  commandNavBtn: { height: 42, paddingHorizontal: 16, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  commandNavBtnText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '800', letterSpacing: 0.5 },
  commandSelectBtn: { height: 42, paddingHorizontal: 16, backgroundColor: '#334155', borderRadius: RRADIUS.md, justifyContent: 'center' },
  commandSelectBtnText: { color: '#FFF', fontSize: RFONTS.xs, fontWeight: '700' },

  // Sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetContainer: { maxHeight: '75%', backgroundColor: RCOLORS.bgWhite, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  sheetTitle: { fontSize: RFONTS.md, fontWeight: '800', color: RCOLORS.textPrimary },
  sheetCloseBtn: { padding: 4 },
  sheetBody: { padding: 18, paddingBottom: 32, gap: 14 },

  detailBox: { gap: 14 },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailTypeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detailHeaderTitle: { fontSize: RFONTS.md, fontWeight: '800', color: RCOLORS.textPrimary },
  detailHeaderSub: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary, marginTop: 2 },
  detailDataBox: { backgroundColor: '#F8FAFC', borderRadius: RRADIUS.md, padding: 12, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  detailItemText: { fontSize: RFONTS.sm, color: RCOLORS.textPrimary, lineHeight: 20 },

  detailActionGrid: { gap: 8, marginTop: 4 },
  sheetCallBtn: { height: 44, backgroundColor: RCOLORS.statusGreen, borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sheetCallBtnText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: '700' },
  sheetNavBtn: { height: 44, backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sheetNavBtnText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: '700' },
  sheetZoneDetailBtn: { height: 44, borderWidth: 1.5, borderColor: RCOLORS.primary, borderRadius: RRADIUS.md, alignItems: 'center', justifyContent: 'center' },
  sheetZoneDetailBtnText: { color: RCOLORS.primary, fontSize: RFONTS.sm, fontWeight: '700' },

  sideMenuStat: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary },
  sideMenuSectionTitle: { fontSize: 11, fontWeight: '800', color: RCOLORS.textSecondary, letterSpacing: 0.5 },
  sideMenuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: RRADIUS.md, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  sideMenuRowTitle: { fontSize: RFONTS.sm, fontWeight: '700', color: RCOLORS.textPrimary },
  sideMenuRowSub: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary },
});

export default RescuerMapScreen;
