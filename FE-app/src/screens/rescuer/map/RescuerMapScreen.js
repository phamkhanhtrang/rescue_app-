/**
 * src/screens/rescuer/map/RescuerMapScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bản đồ Tác chiến & Điều phối Cứu hộ (Tab BẢN ĐỒ).
 *
 * Tính năng nâng cao:
 *  - Chế độ Bản đồ Vệ tinh / Chuẩn / Tối (Satellite / Standard / Dark toggle)
 *  - Cụm Nút Công Cụ Tác Chiến (🎯 Định vị GPS, 🛰️ Kiểu bản đồ, ℹ️ Chú giải, 🔄 Refresh)
 *  - Bảng Chú Giải Màu Sắc Kỹ Thuật (Tactical Map Legend Panel)
 *  - Marker SOS hiển thị trực quan số lượng người bị nạn
 *  - Marker Đồng đội & Vùng sự cố rõ ràng
 *  - Bottom Command Sheet điều hướng chỉ huy tác chiến
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Dimensions, ScrollView, Modal, Pressable
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from '../../../components/common/AppMap';
import * as Location from 'expo-location';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const { width, height } = Dimensions.get('window');

const RescuerMapScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [zones, setZones] = useState([]);
  const [sosList, setSosList] = useState([]);
  const [otherRescuers, setOtherRescuers] = useState([]);
  const [activeMission, setActiveMission] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);

  // Map view custom options
  const [mapType, setMapType] = useState('standard'); // 'standard' | 'satellite' | 'hybrid'
  const [showLegend, setShowLegend] = useState(true);

  const mapRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const validCoords = (lat, lng) => lat != null && lng != null && String(lat).trim() !== '' && String(lng).trim() !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
  const openItem = (type, item) => {
    setShowSideMenu(false);
    setSelectedItem({ type, item });
  };
  const statusLabel = value => ({ PENDING: 'Chờ tiếp nhận', ACKNOWLEDGED: 'Đã tiếp nhận', IN_PROGRESS: 'Đang cứu hộ', ACTIVE: 'Đang hoạt động', CRITICAL: 'Nguy cấp', HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' }[value] || value || 'Chưa cập nhật');


  const flyTo = (lat, lng) => {
    if (mapRef.current && validCoords(lat, lng)) {
      mapRef.current.animateCamera({ 
        center: { latitude: parseFloat(lat), longitude: parseFloat(lng) }, 
        zoom: 16 
      }, { duration: 900 });
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
      const [zonesRes, missionsRes, sosRes, rescuersRes] = await Promise.all([
        API.zones.getAll(),
        API.missions.getAll({ rescuer_id: userInfo?.id }),
        API.sos.getAll(),
        API.rescuers.getAll()
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

      if (missionsRes.results) {
        setActiveMission(missionsRes.results.find(m => !['COMPLETED','CANCELLED'].includes(m.status)) || null);
      }
    } catch (err) {
      console.error('Fetch map data error:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
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
            title: 'Quyền truy cập GPS',
            message: 'Vui lòng cho phép truy cập vị trí để điều phối tác chiến.',
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
      case 'LOW':      return '#43A047';
      default:         return '#1565C0';
    }
  };

  const getZoneFillColor = (severity) => {
    switch ((severity || '').toUpperCase()) {
      case 'CRITICAL': return 'rgba(229, 57, 53, 0.35)';
      case 'HIGH':     return 'rgba(245, 124, 0, 0.35)';
      case 'MEDIUM':   return 'rgba(2, 136, 209, 0.35)';
      default:         return 'rgba(67, 160, 71, 0.35)';
    }
  };

  const zoneGroups = zones.map(zone => ({ id: zone.id, name: zone.name, zone, signals: sosList.filter(signal => String(signal.zone) === String(zone.id)) }));
  sosList.filter(signal => !zones.some(zone => String(zone.id) === String(signal.zone))).forEach(signal => {
    const id = signal.zone || 'unassigned';
    let group = zoneGroups.find(entry => entry.id === id);
    if (!group) { group = { id, name: signal.zone_name || 'Chưa phân vùng', signals: [] }; zoneGroups.push(group); }
    group.signals.push(signal);
  });

  const deployedZone = zones.find(z => z.id === activeMission?.zone);

  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'SOS' | 'ZONES' | 'RESCUERS'

  const filteredSosList = sosList.filter(s => {
    if (filterMode === 'RESCUERS' || filterMode === 'ZONES') return false;
    return true;
  });

  const filteredOtherRescuers = otherRescuers.filter(r => {
    if (filterMode === 'SOS' || filterMode === 'ZONES') return false;
    return true;
  });

  const filteredZones = zones.filter(z => {
    if (filterMode === 'SOS' || filterMode === 'RESCUERS') return false;
    return true;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader liveMode />

      {/* Layer Filter Pills Bar */}
      <View style={styles.rescuerFilterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rescuerFilterScroll}>
          <TouchableOpacity
            style={[styles.rFilterChip, filterMode === 'ALL' && styles.rFilterActive]}
            onPress={() => setFilterMode('ALL')}
          >
            <Text style={[styles.rFilterText, filterMode === 'ALL' && styles.rFilterTextActive]}>🌐 Tất cả tác chiến</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rFilterChip, filterMode === 'SOS' && styles.rFilterActiveRed]}
            onPress={() => setFilterMode('SOS')}
          >
            <Text style={[styles.rFilterText, filterMode === 'SOS' && styles.rFilterTextActiveRed]}>🚨 SOS Khẩn cấp ({sosList.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rFilterChip, filterMode === 'ZONES' && styles.rFilterActiveOrange]}
            onPress={() => setFilterMode('ZONES')}
          >
            <Text style={[styles.rFilterText, filterMode === 'ZONES' && styles.rFilterTextActiveOrange]}>📍 Vùng sự cố ({zones.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rFilterChip, filterMode === 'RESCUERS' && styles.rFilterActiveBlue]}
            onPress={() => setFilterMode('RESCUERS')}
          >
            <Text style={[styles.rFilterText, filterMode === 'RESCUERS' && styles.rFilterTextActiveBlue]}>🛟 Đồng đội ({otherRescuers.length})</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={RCOLORS.primary} />
            <Text style={styles.loadingText}>Đang khởi tạo bản đồ chỉ cụm tác chiến...</Text>
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
              {/* Vị trí hiện tại của lực lượng cứu hộ */}
              {currentLocation && (
                <Marker
                  onPress={() => openItem('rescuer', {
                    ...userInfo,
                    rescuer_profile: {
                      ...userInfo?.rescuer_profile,
                      current_lat: currentLocation.latitude,
                      current_lng: currentLocation.longitude,
                    },
                  })}
                  coordinate={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.myLocationCirclePin} collapsable={false} pointerEvents="none">
                    <Text style={styles.circlePinText}>🦺</Text>
                  </View>
                </Marker>
              )}

              {/* Các vùng sự cố */}
              {filteredZones.map(z => {
                const color = getSeverityColor(z.severity);
                const lat = parseFloat(z.location_lat);
                const lng = parseFloat(z.location_lng);
                if (!validCoords(z.location_lat, z.location_lng)) return null;

                return (
                  <React.Fragment key={`zone-frag-${z.id}`}>
                    {/* Khoanh vùng diện tích sự cố (Zone Circle Boundary) */}
                    <Circle
                      center={{ latitude: lat, longitude: lng }}
                      radius={Number(z.radius_meters) || 800}
                      fillColor={getZoneFillColor(z.severity)}
                      strokeColor={color}
                      strokeWidth={z.id === activeMission?.zone ? 3.5 : 2.5}
                      zIndex={1}
                    />

                    <Marker
                      coordinate={{ latitude: lat, longitude: lng }}
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={2}
                      onPress={() => openItem('zone', z)}
                    >
                      <View style={[styles.zoneCirclePin, { backgroundColor: color }]} collapsable={false} pointerEvents="none">
                        <Text style={styles.circlePinText}>📍</Text>
                      </View>
                    </Marker>
                  </React.Fragment>
                );
              })}

              {/* Tín hiệu SOS từ người dân */}
              {filteredSosList.filter(s => validCoords(s.location_lat, s.location_lng)).map(s => (
                <Marker
                  key={`sos-${s.id}`}
                  onPress={() => openItem('sos', s)}
                  coordinate={{
                    latitude: parseFloat(s.location_lat),
                    longitude: parseFloat(s.location_lng),
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.sosCirclePin} collapsable={false} pointerEvents="none">
                    <Text style={styles.circlePinText}>🚨</Text>
                  </View>
                </Marker>
              ))}

              {/* Các đội cứu hộ đồng đội khác */}
              {filteredOtherRescuers.filter(r => validCoords(r.rescuer_profile?.current_lat, r.rescuer_profile?.current_lng)).map(r => {
                const rescuerUnitName = r.rescuer_profile?.unit_name || r.username || 'Đội Cứu Hộ';
                return (
                  <Marker
                    key={`rescuer-${r.id}`}
                    onPress={() => openItem('rescuer', r)}
                    coordinate={{
                      latitude: parseFloat(r.rescuer_profile.current_lat),
                      longitude: parseFloat(r.rescuer_profile.current_lng),
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.rescuerCirclePin} collapsable={false} pointerEvents="none">
                      <Text style={styles.circlePinText}>🛟</Text>
                    </View>
                  </Marker>
                );
              })}
            </MapView>

            {/* Cụm Nút Điều Khiển Tác Chiến Cụm Phải Dưới (Bottom Right Control Cluster) */}
            <View style={styles.rightTacticalControls}>
              {/* Định vị GPS bản thân */}
              <TouchableOpacity
                style={styles.tacticalFab}
                onPress={() => {
                  if (currentLocation && mapRef.current) {
                    mapRef.current.animateCamera({
                      center: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                      zoom: 16,
                    }, { duration: 800 });
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.tacticalFabIcon}>🎯</Text>
              </TouchableOpacity>

              {/* Toggle Bản Đồ Vệ Tinh / Chuẩn */}
              <TouchableOpacity
                style={[styles.tacticalFab, mapType === 'satellite' && styles.tacticalFabActive]}
                onPress={() => setMapType(prev => prev === 'standard' ? 'satellite' : 'standard')}
                activeOpacity={0.8}
              >
                <Text style={styles.tacticalFabIcon}>{mapType === 'standard' ? '🛰️' : '🗺️'}</Text>
              </TouchableOpacity>

              {/* Toggle Panel Chú Giải */}
              <TouchableOpacity
                style={[styles.tacticalFab, showLegend && styles.tacticalFabActive]}
                onPress={() => setShowLegend(prev => !prev)}
                activeOpacity={0.8}
              >
                <Text style={styles.tacticalFabIcon}>ℹ️</Text>
              </TouchableOpacity>

              {/* Toggle Quick List Menu */}
              <TouchableOpacity
                style={[styles.tacticalFab, showSideMenu && styles.tacticalFabActive]}
                onPress={() => setShowSideMenu(prev => !prev)}
                activeOpacity={0.8}
              >
                <Text style={styles.tacticalFabIcon}>📋</Text>
              </TouchableOpacity>

              {/* Refresh Data */}
              <TouchableOpacity
                style={styles.tacticalFab}
                onPress={fetchData}
                disabled={refreshing}
                activeOpacity={0.8}
              >
                <Text style={styles.tacticalFabIcon}>{refreshing ? '⏳' : '🔄'}</Text>
              </TouchableOpacity>
            </View>

            {/* Panel Bảng Chú Giải Tác Chiến (Tactical Map Legend) */}
            {showLegend && (
              <View style={styles.tacticalLegendPanel}>
                <Text style={styles.legendTitle}>CHÚ GIẢI TÁC CHIẾN</Text>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: RCOLORS.primary }]} />
                  <Text style={styles.legendLabel}>🚨 SOS Cần cứu trợ gấp</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#F57C00' }]} />
                  <Text style={styles.legendLabel}>📍 Vùng sự cố trọng điểm</Text>
                </View>
                <View style={styles.legendRow}>
                  <Text style={{ fontSize: 13, width: 14, textAlign: 'center' }}>🛟</Text>
                  <Text style={styles.legendLabel}>Đồng đội cứu hộ</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendZone, { backgroundColor: 'rgba(229,57,53,0.3)', borderColor: RCOLORS.primary, borderWidth: 1 }]} />
                  <Text style={styles.legendLabel}>⭕ Phạm vi minh họa (800m)</Text>
                </View>
              </View>
            )}


          </>
        )}
      </View>


      {!loading && (<>            {/* Bottom Command Sheet / Deployment Overlay */}
            <View style={styles.deployFooter}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deployFooterLabel}>KHU VỰC NHIỆM VỤ HIỆN TẠI</Text>
                <Text style={styles.deployFooterValue} numberOfLines={1}>
                  {deployedZone ? `📍 ${deployedZone.name}` : 'CHƯA CHỌN NHIỆM VỤ'}
                </Text>
              </View>
              {deployedZone ? (
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() => navigation.navigate('MissionNavScreen', {
                    targetLat: deployedZone.location_lat,
                    targetLng: deployedZone.location_lng,
                    zoneName: deployedZone.name
                  })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.navButtonText}>DẪN ĐƯỜNG ⚡</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.listButton}
                  onPress={() => navigation.navigate('MissionsTab', { screen: 'ZoneListScreen' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.listButtonText}>CHỌN VÙNG →</Text>
                </TouchableOpacity>
              )}
            </View></>)}

      <Modal visible={showSideMenu || !!selectedItem} transparent animationType="slide" onRequestClose={() => { setShowSideMenu(false); setSelectedItem(null); }}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} accessibilityLabel="Đóng bảng thông tin" onPress={() => { setShowSideMenu(false); setSelectedItem(null); }} />
          <SafeAreaView style={styles.infoSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedItem ? 'Thông tin trên bản đồ' : 'Danh sách theo vùng'}</Text>
              <TouchableOpacity accessibilityLabel="Đóng" style={styles.closeButton} onPress={() => { setShowSideMenu(false); setSelectedItem(null); }}><Text style={{fontSize: 22}}>×</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              {selectedItem ? (() => {
                const { type, item } = selectedItem;
                const lat = type === 'rescuer' ? item.rescuer_profile?.current_lat : item.location_lat;
                const lng = type === 'rescuer' ? item.rescuer_profile?.current_lng : item.location_lng;
                return <View style={styles.detailContent}>
                  <Text style={styles.detailTitle}>{type === 'zone' ? `📍 ${item.name}` : type === 'sos' ? `🚨 ${item.citizen_name || 'Người dân cần cứu hộ'}` : `🛟 ${item.rescuer_profile?.unit_name || item.full_name || 'Đội cứu hộ'}`}</Text>
                  {type === 'zone' && <>
                    <Text style={styles.detailText}>Mức độ: {statusLabel(item.severity)}</Text>
                    <Text style={styles.detailText}>Người bị ảnh hưởng: {item.people_affected ?? 'Chưa cập nhật'} · SOS: {item.sos_count ?? 0}</Text>
                    <Text style={styles.detailText}>{item.description || 'Chưa có mô tả vùng.'}</Text>
                    <TouchableOpacity style={styles.listButton} onPress={() => { setSelectedItem(null); navigation.navigate('MissionsTab', { screen: 'ZoneDetailScreen', params: { zoneId: item.id, zoneName: item.name } }); }}><Text style={styles.listButtonText}>Xem chi tiết vùng →</Text></TouchableOpacity>
                  </>}
                  {type === 'sos' && <>
                    <Text style={styles.detailText}>Vùng: {item.zone_name || 'Chưa phân vùng'}</Text>
                    <Text style={styles.detailText}>Trạng thái: {item.status_display || statusLabel(item.status)}</Text>
                    <Text style={styles.detailText}>Số người: {item.people_count ?? 'Chưa cập nhật'}</Text>
                    {!!item.address && <Text style={styles.detailText}>{item.address}</Text>}
                    <Text style={styles.detailText}>{item.note || 'Chưa có nội dung yêu cầu.'}</Text>
                  </>}
                  {type === 'rescuer' && <>
                    <Text style={styles.detailText}>Trưởng nhóm: {item.full_name || 'Chưa cập nhật'}</Text>
                    <Text style={styles.detailText}>Điện thoại: {item.phone || 'Chưa cập nhật'}</Text>
                    <Text style={styles.detailText}>Vị trí được cập nhật gần nhất trên hệ thống.</Text>
                  </>}
                  <TouchableOpacity disabled={!validCoords(lat, lng)} style={[styles.listButton, !validCoords(lat, lng) && {opacity: 0.4}]} onPress={() => { setSelectedItem(null); flyTo(lat, lng); }}><Text style={styles.listButtonText}>{validCoords(lat, lng) ? 'Xem vị trí trên bản đồ' : 'Chưa có tọa độ hợp lệ'}</Text></TouchableOpacity>
                </View>;
              })() : <>
                <Text style={styles.detailText}>{zones.length} vùng · {sosList.length} SOS · {otherRescuers.length} đội cứu hộ</Text>
                <Text style={styles.sideMenuItemSub}>Chọn một vùng hoặc tín hiệu để xem nội dung và vị trí.</Text>
                {zoneGroups.map(group => <View key={group.id} style={styles.zoneGroup}>
                  <TouchableOpacity disabled={!group.zone} onPress={() => openItem('zone', group.zone)}>
                    <Text style={styles.detailTitle}>📍 {group.name}</Text>
                    <Text style={styles.sideMenuItemSub}>{group.zone ? `Mức độ: ${statusLabel(group.zone.severity)} · ` : ''}{group.signals.length} SOS đang cần hỗ trợ</Text>
                  </TouchableOpacity>
                  {group.signals.length === 0 && <Text style={styles.emptyText}>Chưa có SOS đang cần hỗ trợ trong vùng này.</Text>}
                  {group.signals.map(signal => <TouchableOpacity key={signal.id} style={styles.signalRow} onPress={() => openItem('sos', signal)}>
                    <Text style={styles.sideMenuItemTitle}>🚨 {signal.citizen_name || 'Người dân cần cứu hộ'}</Text>
                    <Text style={styles.sideMenuItemSub}>{signal.people_count ?? '?'} người · {signal.status_display || statusLabel(signal.status)}</Text>
                    <Text style={styles.detailText} numberOfLines={3}>{signal.note || 'Chưa có nội dung yêu cầu.'}</Text>
                    <Text style={styles.itemLink}>Xem nội dung →</Text>
                  </TouchableOpacity>)}
                </View>)}
                {zoneGroups.length === 0 && <Text style={styles.emptyText}>Chưa có vùng sự cố hoặc SOS.</Text>}
                <View style={styles.zoneGroup}>
                  <Text style={styles.detailTitle}>🛟 Đồng đội ({otherRescuers.length})</Text>
                  <Text style={styles.sideMenuItemSub}>Danh sách vị trí đồng đội; chưa có dữ liệu phân đội theo vùng.</Text>
                  {otherRescuers.map(r => <TouchableOpacity key={r.id} style={styles.signalRow} onPress={() => openItem('rescuer', r)}>
                    <Text style={styles.sideMenuItemTitle}>{r.rescuer_profile?.unit_name || r.full_name || 'Đội cứu hộ'}</Text>
                    <Text style={styles.sideMenuItemSub}>{r.full_name || 'Chưa có tên trưởng nhóm'} · {r.phone || 'Chưa có SĐT'}</Text>
                    <Text style={styles.itemLink}>Xem thông tin và vị trí →</Text>
                  </TouchableOpacity>)}
                  {!otherRescuers.length && <Text style={styles.emptyText}>Chưa có vị trí đồng đội.</Text>}
                </View>
              </>}
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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  infoSheet: { height: '80%', backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', flex: 1 },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { padding: 16, paddingBottom: 28, gap: 12 },
  detailContent: { gap: 14 },
  detailTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  detailText: { fontSize: 14, lineHeight: 21, color: '#334155' },
  zoneGroup: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 14, gap: 10, backgroundColor: '#F8FAFC' },
  signalRow: { padding: 12, borderRadius: 8, backgroundColor: '#FFF', gap: 6 },
  emptyText: { fontSize: 13, lineHeight: 19, color: '#64748B', paddingVertical: 8 },
  itemLink: { fontSize: 13, color: '#1565C0', fontWeight: '700' },
  safe: { flex: 1, backgroundColor: '#0B1220' },
  rescuerFilterBar: {
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
  rescuerFilterScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  rFilterChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rFilterActive: {
    backgroundColor: '#1E88E5',
    borderColor: '#1565C0',
  },
  rFilterActiveRed: {
    backgroundColor: '#E53935',
    borderColor: '#C62828',
  },
  rFilterActiveOrange: {
    backgroundColor: '#F57C00',
    borderColor: '#E65100',
  },
  rFilterActiveBlue: {
    backgroundColor: '#1565C0',
    borderColor: '#0D47A1',
  },
  rFilterText: {
    fontSize: 12,
    color: '#616161',
    fontWeight: '600',
  },
  rFilterTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  rFilterTextActiveRed: {
    color: '#FFF',
    fontWeight: '700',
  },
  rFilterTextActiveOrange: {
    color: '#FFF',
    fontWeight: '700',
  },
  rFilterTextActiveBlue: {
    color: '#FFF',
    fontWeight: '700',
  },
  mapContainer: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC' },
  loadingText: { color: '#475569', fontSize: RFONTS.sm, fontWeight: '600' },

  // ── Custom Circular Icon Markers (Tròn Gọn) ───────────────────────
  circlePinText: {
    fontSize: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
  myLocationCirclePin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E88E5',
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
  sosCirclePin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E53935',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
  },
  rescuerCirclePin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1565C0',
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

  locateIconFab: {
    position: 'absolute',
    bottom: 80,
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

  calloutContainer: {
    width: 210,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    ...RSHADOWS.card,
  },
  zoneCalloutContainer: {
    width: 200,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    ...RSHADOWS.card,
  },
  calloutTitle: { color: RCOLORS.primary, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  calloutText: { color: '#334155', fontSize: 11, marginBottom: 2, lineHeight: 16 },
  calloutBtn: { marginTop: 6, paddingVertical: 6, backgroundColor: '#1E88E5', borderRadius: 6, alignItems: 'center' },
  calloutBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Cụm Nút Điều Khiển Tác Chiến (Right Controls)
  rightTacticalControls: {
    position: 'absolute',
    bottom: 16,
    right: 12,
    gap: 8,
    zIndex: 999,
    elevation: 10,
  },
  tacticalFab: {
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
  tacticalFabActive: {
    backgroundColor: '#1565C0',
    borderColor: '#0D47A1',
  },
  tacticalFabIcon: {
    fontSize: 16,
  },

  // Tactical Legend Panel
  tacticalLegendPanel: {
    position: 'absolute',
    bottom: 16,
    left: RSPACING.base,
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
    maxWidth: 210,
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

  // Side Menu Drawer
  sideMenu: {
    position: 'absolute',
    top: RSPACING.base,
    right: 64,
    width: 220,
    maxHeight: height * 0.55,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  sideMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sideMenuTitle: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  sideMenuClose: { color: '#94A3B8', fontSize: 16, fontWeight: 'bold', paddingHorizontal: 4 },
  sideMenuScroll: { padding: 10 },
  sideMenuSection: { color: '#64748B', fontSize: 10, fontWeight: '800', marginTop: 8, marginBottom: 4, letterSpacing: 0.5 },
  sideMenuItem: { backgroundColor: '#F8FAFC', padding: 9, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  sideMenuItemTitle: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  sideMenuItemSub: { color: '#64748B', fontSize: 10, marginTop: 2 },

  // Bottom Command Sheet
  deployFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    gap: 12,
  },
  deployFooterLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', letterSpacing: 0.5 },
  deployFooterValue: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  navButton: { backgroundColor: RCOLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  navButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  listButton: { backgroundColor: '#1E88E5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  listButtonText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});

export default RescuerMapScreen;
