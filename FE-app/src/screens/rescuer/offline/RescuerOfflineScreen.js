/**
 * src/screens/rescuer/offline/RescuerOfflineScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Radar cứu nạn ngoại tuyến BLE (Rescuer).
 *
 * 1. Quét gói SOS 0xGP mà phao cứu sinh của người dân phát qua BLE Advertising.
 * 2. Định vị nạn nhân: cự ly + hướng tính từ GPS trong gói SOS và GPS / la bàn của
 *    máy cứu hộ; chặng cuối (dưới ~15m) dùng cường độ sóng RSSI đã làm mượt.
 * 3. PING: phát lệnh để máy nạn nhân hú còi và chớp đèn flash.
 * 4. Tin nhắn soạn sẵn hai chiều với người dân ở tầm gần.
 * 5. Bồ câu đưa thư: mọi gói SOS nghe được đều lưu lại và tự đồng bộ lên máy chủ
 *    khi có mạng; cứu hộ đánh dấu "đã cứu" ngay cả khi mất mạng.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RLAYOUT } from '../../../constants/rescuer/theme';
import { RESCUER_MESSAGES, compassLabel } from '../../../services/bleProtocol';
import {
  startRescuerScanner,
  stopRescuerScanner,
  setRescuerPosition,
  getTransportInfo,
  sendRemotePing,
  sendQuickChatMessage,
  getQuickChatHistory,
  subscribeToChatMessage,
  markVictimResolvedOffline,
  syncOfflineQueueToBackend,
  getOfflineQueueCount,
  subscribeToQueueChange,
  playSonarBeep,
  triggerHaptic,
} from '../../../services/bleGridService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 48, 300);
const RADAR_EDGE_M = 50; // cự ly ứng với vòng ngoài cùng của radar
const RADAR_EDGE_RATIO = 0.425;

const SEVERITY_LABELS = { 1: 'Cần hỗ trợ', 2: 'Ngập sâu', 3: 'Nguy kịch' };

/** Vị trí một phao trên radar. Hướng lên trên = hướng điện thoại đang chĩa tới. */
function radarPosition(signal, heading) {
  const distance = signal.distanceM ?? RADAR_EDGE_M;
  const ratio = Math.min(Math.max((distance / RADAR_EDGE_M) * RADAR_EDGE_RATIO, 0.08), 0.46);
  const relative = signal.bearing == null ? 0 : signal.bearing - (heading ?? 0);
  const rad = (relative * Math.PI) / 180;
  return {
    left: RADAR_SIZE / 2 + Math.sin(rad) * RADAR_SIZE * ratio - 10,
    top: RADAR_SIZE / 2 - Math.cos(rad) * RADAR_SIZE * ratio - 10,
  };
}

const RescuerOfflineScreen = ({ navigation }) => {
  const transport = getTransportInfo();

  // Trạng thái Radar & Quét sóng
  const [isScanning, setIsScanning] = useState(true);
  const [scanError, setScanError] = useState(null);
  const [discoveredSignals, setDiscoveredSignals] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Vị trí & hướng của cứu hộ
  const [hasPosition, setHasPosition] = useState(false);
  const [heading, setHeading] = useState(null);
  const headingRef = useRef(null);

  // Trạng thái đồng bộ hàng đợi
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Tin nhắn
  const [chatMessages, setChatMessages] = useState([]);

  // Animation Radar Sweep
  const radarSweepAnim = useRef(new Animated.Value(0)).current;
  const targetPulseAnim = useRef(new Animated.Value(1)).current;
  const lastBeepAt = useRef(0);

  // Modal thông báo
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });
  const showModal = (type, title, message) => setModalConfig({ visible: true, type, title, message });

  const selectedSignal =
    discoveredSignals.find((s) => s.sosId === selectedId) || discoveredSignals[0] || null;

  // 1. Animation xoay Radar
  useEffect(() => {
    if (!isScanning) {
      radarSweepAnim.setValue(0);
      targetPulseAnim.setValue(1);
      return undefined;
    }
    const sweepLoop = Animated.loop(
      Animated.timing(radarSweepAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(targetPulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(targetPulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    );
    sweepLoop.start();
    pulseLoop.start();
    return () => {
      sweepLoop.stop();
      pulseLoop.stop();
    };
  }, [isScanning]);

  // 2. GPS và la bàn của máy cứu hộ
  useEffect(() => {
    let positionSub = null;
    let headingSub = null;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        positionSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
          (loc) => {
            setRescuerPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            setHasPosition(true);
          }
        );
        headingSub = await Location.watchHeadingAsync((h) => {
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (typeof value !== 'number' || value < 0) return;
          // Chỉ vẽ lại khi hướng đổi đáng kể, tránh render liên tục.
          const previous = headingRef.current;
          const delta = previous == null ? 360 : Math.abs(((value - previous + 540) % 360) - 180);
          if (delta >= 4) {
            headingRef.current = value;
            setHeading(Math.round(value));
          }
        });
        if (cancelled) {
          positionSub.remove();
          headingSub.remove();
        }
      } catch (e) {
        // Không có GPS / la bàn: radar vẫn chạy theo cường độ sóng.
      }
    })();
    return () => {
      cancelled = true;
      if (positionSub) positionSub.remove();
      if (headingSub) headingSub.remove();
      setRescuerPosition(null);
    };
  }, []);

  // 3. Bật / tắt quét BLE theo nút ĐANG QUÉT / TẠM DỪNG
  useEffect(() => {
    if (!isScanning) {
      stopRescuerScanner();
      return undefined;
    }
    let cancelled = false;
    setScanError(null);
    startRescuerScanner((signals) => {
      if (cancelled) return;
      setDiscoveredSignals(signals);
      // Bíp sonar: càng gần càng dồn dập.
      const nearest = signals.find((s) => s.distanceM != null && !s.isStale);
      if (nearest && nearest.distanceM <= 30) {
        const interval = Math.min(Math.max(nearest.distanceM * 100, 500), 3000);
        if (Date.now() - lastBeepAt.current >= interval) {
          lastBeepAt.current = Date.now();
          playSonarBeep();
        }
      }
    }).catch((e) => {
      if (cancelled) return;
      setScanError(e?.message || 'Không bắt đầu quét được.');
      setIsScanning(false);
    });
    return () => {
      cancelled = true;
      stopRescuerScanner();
    };
  }, [isScanning]);

  // 4. Tin nhắn & số hồ sơ chờ đồng bộ
  useEffect(() => {
    (async () => {
      setChatMessages(await getQuickChatHistory());
      setOfflineQueueCount(await getOfflineQueueCount());
    })();
    const unsubChat = subscribeToChatMessage((msg) => {
      setChatMessages((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)].slice(0, 30));
    });
    const unsubQueue = subscribeToQueueChange(setOfflineQueueCount);
    return () => {
      unsubChat();
      unsubQueue();
    };
  }, []);

  const spinInterpolation = radarSweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Phát lệnh PING tới máy nạn nhân
  const handlePingTarget = async () => {
    if (!selectedSignal) return;
    try {
      await sendRemotePing(selectedSignal.sosId);
      showModal(
        'success',
        '🚨 Đang phát lệnh PING',
        `Lệnh PING tới phao GP-#${selectedSignal.sosId} đang được phát trong vài giây. Nếu máy nạn nhân còn trong tầm sóng, máy sẽ hú còi và chớp đèn flash.`
      );
    } catch (e) {
      showModal('warning', 'Chưa phát được lệnh PING', e?.message || 'Không phát được tín hiệu.');
    }
  };

  // Đánh dấu đã cứu nạn nhân (lưu cục bộ, đồng bộ khi có mạng)
  const handleMarkResolved = async () => {
    if (!selectedSignal) return;
    const { sosId, peopleCount } = selectedSignal;
    await markVictimResolvedOffline(selectedSignal, `Đã cứu ${peopleCount} người lên ca-nô tuần tra an toàn`);
    setSelectedId(null);
    showModal(
      'success',
      '✅ Đã ghi nhận cứu nạn an toàn!',
      `Hồ sơ GP-#${sosId} (${peopleCount} người) đã được lưu trên máy. Khi có mạng, hệ thống sẽ tự đồng bộ lên Bản đồ Chỉ huy.`
    );
    syncOfflineQueueToBackend();
  };

  // Đồng bộ lên máy chủ theo yêu cầu
  const handleSyncToBackend = async () => {
    setSyncing(true);
    triggerHaptic('impact');
    const result = await syncOfflineQueueToBackend();
    setSyncing(false);

    if (!result.success) {
      showModal(
        'warning',
        result.offline ? 'Chưa có kết nối mạng' : 'Đồng bộ chưa thành công',
        result.offline
          ? 'Thiết bị chưa kết nối được máy chủ. Toàn bộ hồ sơ vẫn được giữ an toàn trên máy và sẽ tự đồng bộ sau.'
          : result.error
      );
      return;
    }
    if (result.empty) {
      showModal('info', 'Không có hồ sơ chờ', 'Mọi hồ sơ cứu nạn ngoại tuyến đã được đồng bộ.');
      return;
    }
    const notes = [];
    if (result.resolveIgnored) {
      notes.push(`${result.resolveIgnored} hồ sơ chưa được chuyển sang "đã cứu" vì tài khoản này không có quyền cứu hộ.`);
    }
    if (result.rejectedCount) notes.push(`${result.rejectedCount} gói tin hỏng đã bị loại.`);
    showModal(
      'success',
      '🎉 Đồng bộ thành công!',
      [`Đã đẩy ${result.syncedCount} hồ sơ cứu nạn ngoại tuyến lên máy chủ trung tâm.`, ...notes].join(' ')
    );
  };

  // Gửi tin nhắn soạn sẵn
  const handleSendRescuerChat = async (code) => {
    try {
      await sendQuickChatMessage('RESCUER', code, selectedSignal?.sosId ?? null);
    } catch (e) {
      showModal('warning', 'Chưa gửi được tin nhắn', e?.message || 'Không phát được tín hiệu.');
    }
  };

  const northRad = (-(heading ?? 0) * Math.PI) / 180;

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader
        showBack
        onBack={() => navigation.goBack()}
        title="RADAR CỨU NẠN NGOẠI TUYẾN"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ─── 1. Header trạng thái ───────────────────────────────────────── */}
        <View style={styles.headerBanner}>
          <View style={styles.headerLeft}>
            <View style={[styles.livePulseDot, !isScanning && { backgroundColor: '#64748B' }]} />
            <Text style={styles.bannerTitle}>
              {transport.isSimulated ? 'RADAR (MÔ PHỎNG QUA MẠNG)' : 'RADAR BLUETOOTH BLE'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.scanToggleBtn, !isScanning && styles.scanToggleBtnOff]}
            onPress={() => setIsScanning(!isScanning)}
          >
            <MaterialCommunityIcons
              name={isScanning ? 'radar' : 'pause-circle'}
              size={14}
              color="#FFF"
            />
            <Text style={styles.scanToggleText}>
              {isScanning ? 'ĐANG QUÉT' : 'TẠM DỪNG'}
            </Text>
          </TouchableOpacity>
        </View>

        {transport.isSimulated && (
          <Text style={styles.simNotice}>
            Bản chạy này không dùng được sóng Bluetooth thật (Expo Go, web hoặc iOS). Tín hiệu được giả lập
            qua máy chủ nên cần có mạng và không có cường độ sóng RSSI; cự ly chỉ tính theo GPS.
          </Text>
        )}
        {scanError && (
          <Text style={styles.errorNotice}>⚠️ {scanError} Nhấn "TẠM DỪNG" để thử quét lại.</Text>
        )}

        {/* ─── 2. Radar ───────────────────────────────────────────────────── */}
        <View style={styles.radarContainer}>
          <View style={[styles.radarCircle, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
            <View style={[styles.radarRing, { width: '85%', height: '85%' }]} />
            <View style={[styles.radarRing, { width: '51%', height: '51%' }]} />
            <View style={[styles.radarRing, { width: '25.5%', height: '25.5%' }]} />
            <View style={[styles.radarCrossH]} />
            <View style={[styles.radarCrossV]} />

            {/* Nhãn cự ly (tỉ lệ tuyến tính, vòng ngoài = 50m) */}
            <Text style={[styles.radarDistLabel, { top: RADAR_SIZE * 0.075 + 2 }]}>50m</Text>
            <Text style={[styles.radarDistLabel, { top: RADAR_SIZE * 0.245 + 2 }]}>30m</Text>
            <Text style={[styles.radarDistLabel, { top: RADAR_SIZE * 0.3725 + 2 }]}>15m</Text>

            {/* Mốc hướng Bắc, xoay theo la bàn */}
            {heading != null && (
              <Text
                style={[
                  styles.northMarker,
                  {
                    left: RADAR_SIZE / 2 + Math.sin(northRad) * RADAR_SIZE * 0.46 - 7,
                    top: RADAR_SIZE / 2 - Math.cos(northRad) * RADAR_SIZE * 0.46 - 8,
                  },
                ]}
              >
                B
              </Text>
            )}

            {isScanning && (
              <Animated.View
                style={[
                  styles.radarSweepLine,
                  {
                    transform: [
                      { rotate: spinInterpolation },
                      { translateY: -(RADAR_SIZE / 4) },
                    ],
                  },
                ]}
              />
            )}

            <View style={styles.radarCenterBoat}>
              <MaterialCommunityIcons name="ferry" size={16} color="#38BDF8" />
            </View>

            {discoveredSignals.map((sig) => {
              const isTargetSelected = selectedSignal?.sosId === sig.sosId;
              return (
                <TouchableOpacity
                  key={sig.id}
                  style={[
                    styles.radarTargetDot,
                    radarPosition(sig, heading),
                    isTargetSelected && styles.radarTargetDotSelected,
                    sig.isStale && { opacity: 0.45 },
                  ]}
                  onPress={() => setSelectedId(sig.sosId)}
                >
                  <Animated.View
                    style={[
                      styles.targetPulseWave,
                      isTargetSelected && { transform: [{ scale: targetPulseAnim }] },
                    ]}
                  />
                  <Text style={styles.targetDotEmoji}>{sig.bearing == null ? '❔' : '📍'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.radarHint}>
            {heading != null && hasPosition
              ? 'Phía trên radar là hướng điện thoại đang chĩa tới.'
              : 'Chưa có GPS / la bàn: radar chỉ thể hiện cự ly, chưa thể hiện hướng.'}
          </Text>
        </View>

        {/* ─── 3. Thông tin mục tiêu đang chọn ────────────────────────────── */}
        {selectedSignal ? (
          <View style={styles.targetCard}>
            <View style={styles.targetHeader}>
              <View style={styles.targetBadge}>
                <Text style={styles.targetBadgeText}>PHAO GP-#{selectedSignal.sosId}</Text>
              </View>
              <View style={styles.rssiBadge}>
                <MaterialCommunityIcons name="signal" size={12} color="#22C55E" />
                <Text style={styles.rssiText}>
                  {selectedSignal.smoothedRSSI != null ? `${selectedSignal.smoothedRSSI} dBm` : 'Không có RSSI'}
                </Text>
              </View>
            </View>

            <View style={styles.distMeterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.distSubLabel}>
                  {selectedSignal.distanceSource === 'GPS'
                    ? 'KHOẢNG CÁCH (THEO GPS):'
                    : selectedSignal.distanceSource === 'RSSI'
                    ? 'KHOẢNG CÁCH ƯỚC TÍNH (THEO SÓNG):'
                    : 'CHƯA ƯỚC TÍNH ĐƯỢC KHOẢNG CÁCH'}
                </Text>
                <View style={styles.distValueRow}>
                  <Text style={styles.distBigValue}>{selectedSignal.distanceM ?? '—'}</Text>
                  <Text style={styles.distUnit}>MÉT</Text>
                </View>
              </View>

              <View style={styles.proximityStatus}>
                <Text style={styles.proximityStatusText}>
                  {selectedSignal.isStale
                    ? '⚠️ MẤT SÓNG'
                    : selectedSignal.distanceM == null
                    ? '📡 ĐANG BẮT SÓNG'
                    : selectedSignal.distanceM <= 5
                    ? '🎯 ĐÃ ÁP SÁT'
                    : selectedSignal.distanceM <= 15
                    ? '⚡ RẤT GẦN'
                    : '📡 TRONG TẦM BẮT'}
                </Text>
              </View>
            </View>

            <Text style={styles.gpsCoordText}>
              {selectedSignal.bearing != null
                ? `🧭 Hướng ${compassLabel(selectedSignal.bearing)} (${selectedSignal.bearing}°)`
                : '🧭 Chưa xác định được hướng'}
              {selectedSignal.gpsDistanceM != null ? ` • GPS ${selectedSignal.gpsDistanceM}m` : ''}
              {selectedSignal.rssiDistanceM != null ? ` • Sóng ≈${selectedSignal.rssiDistanceM}m` : ''}
            </Text>

            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>
                👨‍👩‍👦 Nhân khẩu: <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{selectedSignal.peopleCount} người</Text>
                {'  '}• Phao bật {selectedSignal.minutesActive} phút
              </Text>
              <View style={styles.demoTags}>
                {selectedSignal.hasElderly && <Text style={styles.demoTag}>🧓 Có người già</Text>}
                {selectedSignal.hasChildren && <Text style={styles.demoTag}>👶 Có trẻ nhỏ</Text>}
                {selectedSignal.hasInjury && <Text style={styles.demoTag}>🩹 Có thương tích</Text>}
                <Text style={[styles.demoTag, { color: '#EF4444', borderColor: '#EF4444' }]}>
                  🚨 Mức độ: {SEVERITY_LABELS[selectedSignal.severity] || 'Không rõ'}
                </Text>
              </View>
            </View>

            <Text style={styles.gpsCoordText}>
              {selectedSignal.hasLocation
                ? `📍 GPS nạn nhân: ${selectedSignal.lat.toFixed(6)}°, ${selectedSignal.lng.toFixed(6)}°`
                : '📍 Máy nạn nhân chưa có GPS: hãy dò theo cường độ sóng và dùng PING.'}
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.pingActionBtn}
                onPress={handlePingTarget}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="bullhorn-outline" size={18} color="#FFF" />
                <Text style={styles.pingActionText}>PING ĐỊNH VỊ (HÚ CÒI + FLASH)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resolvedActionBtn}
                onPress={handleMarkResolved}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="check-decagram" size={18} color="#FFF" />
                <Text style={styles.resolvedActionText}>ĐÃ CỨU AN TOÀN</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noTargetCard}>
            <MaterialCommunityIcons name="radar" size={32} color="#64748B" />
            <Text style={styles.noTargetText}>
              {isScanning
                ? 'Đang quét phao cứu sinh xung quanh... Chưa phát hiện tín hiệu nào.'
                : 'Đã tạm dừng quét.'}
            </Text>
          </View>
        )}

        {/* ─── 4. Bồ câu đưa thư (Store-and-Forward) ──────────────────────── */}
        <View style={styles.mulingCard}>
          <View style={styles.mulingHeader}>
            <MaterialCommunityIcons name="database-sync" size={20} color="#1D4ED8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.mulingTitle}>BỒ CÂU ĐƯA THƯ SỐ (STORE-AND-FORWARD)</Text>
              <Text style={styles.mulingDesc}>
                Mọi tín hiệu SOS nghe được và hồ sơ đã cứu đều lưu trên máy. Khi có mạng, hệ thống tự đồng bộ
                mỗi phút; bạn cũng có thể đồng bộ ngay bằng nút dưới đây.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.syncBtn}
            onPress={handleSyncToBackend}
            disabled={syncing}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={syncing ? 'loading' : 'cloud-upload'}
              size={18}
              color="#FFF"
            />
            <Text style={styles.syncBtnText}>
              {syncing
                ? 'ĐANG ĐỒNG BỘ DỮ LIỆU...'
                : `ĐỒNG BỘ LÊN MÁY CHỦ (${offlineQueueCount} HỒ SƠ CHỜ)`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── 5. Tin nhắn soạn sẵn với người dân ─────────────────────────── */}
        <View style={styles.chatCard}>
          <View style={styles.chatHeader}>
            <MaterialCommunityIcons name="radio-handheld" size={20} color="#1D4ED8" />
            <Text style={styles.chatTitle}>
              TIN NHẮN NHANH {selectedSignal ? `TỚI GP-#${selectedSignal.sosId}` : 'TỚI MỌI PHAO Ở GẦN'}
            </Text>
          </View>

          <View style={styles.presetGrid}>
            {RESCUER_MESSAGES.map((m) => (
              <TouchableOpacity
                key={m.code}
                style={styles.presetChip}
                onPress={() => handleSendRescuerChat(m.code)}
              >
                <Text style={styles.presetChipText}>+ {m.text}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {chatMessages.length > 0 && (
            <View style={styles.chatHistory}>
              <Text style={styles.chatHistoryLabel}>TIN NHẮN GẦN ĐÂY:</Text>
              {chatMessages.slice(0, 4).map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.chatBubble,
                    m.senderRole === 'RESCUER' ? styles.chatBubbleRescuer : styles.chatBubbleCitizen,
                  ]}
                >
                  <Text style={styles.chatRole}>
                    {m.senderRole === 'RESCUER'
                      ? '🛡️ Tôi (Ca-nô):'
                      : `👤 Người dân${m.sosId ? ` GP-#${m.sosId}` : ''}:`}
                  </Text>
                  <Text style={styles.chatText}>{m.text}</Text>
                  <Text style={styles.chatTime}>{m.sentAt}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={() => setModalConfig((prev) => ({ ...prev, visible: false }))}
        onCancel={() => setModalConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

// ─── Stylesheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1120' },
  simNotice: {
    fontSize: 11,
    lineHeight: 16,
    color: '#FCD34D',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8,
    padding: 10,
  },
  errorNotice: {
    fontSize: 12,
    lineHeight: 17,
    color: '#FCA5A5',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderRadius: 8,
    padding: 10,
  },
  northMarker: {
    position: 'absolute',
    width: 14,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F87171',
  },
  radarHint: {
    marginTop: 8,
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  content: {
    padding: RLAYOUT.screenPadding,
    paddingBottom: 40,
    gap: RSPACING.md,
  },

  // ── Header Banner ──────────────────────────────
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RRADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  bannerTitle: {
    fontSize: RFONTS.xs,
    fontWeight: RFONTS.black,
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  scanToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RRADIUS.sm,
  },
  scanToggleBtnOff: {
    backgroundColor: '#64748B',
  },
  scanToggleText: {
    fontSize: 10,
    fontWeight: RFONTS.bold,
    color: '#FFF',
  },

  // ── Radar Visualizer ───────────────────────────
  radarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  radarCircle: {
    backgroundColor: '#030712',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0284C7',
    shadowOpacity: 0.35,
    shadowRadius: 15,
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    borderStyle: 'dashed',
  },
  radarCrossH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
  },
  radarCrossV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
  },
  radarDistLabel: {
    position: 'absolute',
    fontSize: 9,
    color: 'rgba(56, 189, 248, 0.6)',
    fontWeight: 'bold',
  },
  radarSweepLine: {
    position: 'absolute',
    width: 2,
    height: '50%',
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  radarCenterBoat: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  radarTargetDot: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarTargetDotSelected: {
    transform: [{ scale: 1.25 }],
  },
  targetPulseWave: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
  targetDotEmoji: {
    fontSize: 16,
  },

  // ── Target Card ────────────────────────────────
  targetCard: {
    backgroundColor: '#1E293B',
    borderRadius: RRADIUS.lg,
    padding: RSPACING.base,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    gap: RSPACING.sm,
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RRADIUS.sm,
  },
  targetBadgeText: {
    fontSize: 11,
    fontWeight: RFONTS.black,
    color: '#F87171',
    letterSpacing: 0.5,
  },
  rssiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RRADIUS.sm,
  },
  rssiText: {
    fontSize: 11,
    fontWeight: RFONTS.bold,
    color: '#22C55E',
  },
  distMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: RRADIUS.md,
    padding: 12,
  },
  distSubLabel: {
    fontSize: 10,
    fontWeight: RFONTS.bold,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  distValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  distBigValue: {
    fontSize: 32,
    fontWeight: RFONTS.black,
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  distUnit: {
    fontSize: RFONTS.sm,
    fontWeight: RFONTS.bold,
    color: '#94A3B8',
  },
  proximityStatus: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RRADIUS.pill,
  },
  proximityStatusText: {
    fontSize: 11,
    fontWeight: RFONTS.black,
    color: '#38BDF8',
  },
  demoBox: {
    gap: 6,
  },
  demoTitle: {
    fontSize: RFONTS.xs,
    color: '#CBD5E1',
  },
  demoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  demoTag: {
    fontSize: 10,
    fontWeight: RFONTS.bold,
    color: '#F8FAFC',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RRADIUS.sm,
  },
  gpsCoordText: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  pingActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: RRADIUS.md,
  },
  pingActionText: {
    fontSize: 11,
    fontWeight: RFONTS.bold,
    color: '#FFF',
  },
  resolvedActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: RRADIUS.md,
  },
  resolvedActionText: {
    fontSize: 11,
    fontWeight: RFONTS.bold,
    color: '#FFF',
  },

  noTargetCard: {
    backgroundColor: '#1E293B',
    borderRadius: RRADIUS.lg,
    padding: RSPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  noTargetText: {
    fontSize: RFONTS.xs,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // ── Muling Sync Card ───────────────────────────
  mulingCard: {
    backgroundColor: '#1E293B',
    borderRadius: RRADIUS.lg,
    padding: RSPACING.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: RSPACING.sm,
  },
  mulingHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  mulingTitle: {
    fontSize: 11,
    fontWeight: RFONTS.black,
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  mulingDesc: {
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 14,
    marginTop: 2,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: RRADIUS.md,
    marginTop: 4,
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: RFONTS.bold,
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // ── Chat Card ──────────────────────────────────
  chatCard: {
    backgroundColor: '#1E293B',
    borderRadius: RRADIUS.lg,
    padding: RSPACING.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: RSPACING.sm,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatTitle: {
    fontSize: 11,
    fontWeight: RFONTS.black,
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: RRADIUS.pill,
  },
  presetChipText: {
    fontSize: 10,
    color: '#E0F2FE',
    fontWeight: RFONTS.medium,
  },
  chatHistory: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    gap: 6,
  },
  chatHistoryLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748B',
  },
  chatBubble: {
    padding: 8,
    borderRadius: RRADIUS.md,
    gap: 2,
  },
  chatBubbleRescuer: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignSelf: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  chatBubbleCitizen: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignSelf: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  chatRole: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#CBD5E1',
  },
  chatText: {
    fontSize: 11,
    color: '#F8FAFC',
  },
  chatTime: {
    fontSize: 9,
    color: '#64748B',
    alignSelf: 'flex-end',
  },
});

export default RescuerOfflineScreen;
