/**
 * src/screens/rescuer/offline/RescuerOfflineScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Trung Tâm Tác Chiến Cứu Nạn Ngoại Tuyến BLE & Radar Sonar Tầm Soát (Rescuer).
 *
 * Tính năng chính:
 * 1. Radar Sonar 360° quét tín hiệu phao cứu sinh BLE (0xGP) trong đêm.
 * 2. Đo cự ly tầm gần bằng thuật toán suy diễn RSSI & Bộ lọc Moving Average.
 * 3. Nút "PING ĐỊNH VỊ": Kích hoạt chớp đèn Flash SOS và còi hú trên máy nạn nhân.
 * 4. Bộ đàm tin nhắn nhanh BLE 1-chạm trao đổi với người dân không cần mạng.
 * 5. Cơ chế Bồ câu đưa thư số (Store-and-Forward): Tự động gom hồ sơ cứu nạn và
 *    đồng bộ hàng loạt lên Django Backend khi về trạm có 4G/Wi-Fi.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RLAYOUT } from '../../../constants/rescuer/theme';
import apiClient from '../../../services/apiClient';
import {
  startRescuerScanner,
  stopRescuerScanner,
  sendRemotePing,
  sendQuickChatMessage,
  getQuickChatHistory,
  subscribeToChatMessage,
  markVictimResolvedOffline,
  syncOfflineQueueToBackend,
  playSonarBeep,
  triggerHaptic,
} from '../../../services/bleGridService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 48, 300);

const RESCUER_PRESET_MESSAGES = [
  'Ca-nô đã tới đầu ngõ',
  'Hãy giơ cao đèn flash / vẫy khăn',
  'Giữ nguyên vị trí, đang tiếp cận gác lửng',
  'Đã đưa phao cứu sinh vào cửa sổ',
  'Toàn bộ gia đình bình tĩnh, ưu tiên trẻ em',
];

const RescuerOfflineScreen = ({ navigation }) => {
  // Trạng thái Radar & Quét sóng
  const [isScanning, setIsScanning] = useState(true);
  const [discoveredSignals, setDiscoveredSignals] = useState([]);
  const [selectedSignal, setSelectedSignal] = useState(null);

  // Trạng thái đồng bộ hàng đợi
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Bộ đàm tin nhắn
  const [chatMessages, setChatMessages] = useState([]);

  // Animation Radar Sweep
  const radarSweepAnim = useRef(new Animated.Value(0)).current;
  const targetPulseAnim = useRef(new Animated.Value(1)).current;

  // Modal thông báo
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  // 1. Quản lý Animation xoay Radar 360°
  useEffect(() => {
    let sweepLoop = null;
    let pulseLoop = null;

    if (isScanning) {
      sweepLoop = Animated.loop(
        Animated.timing(radarSweepAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      sweepLoop.start();

      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(targetPulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(targetPulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.start();
    } else {
      radarSweepAnim.setValue(0);
      targetPulseAnim.setValue(1);
    }

    return () => {
      if (sweepLoop) sweepLoop.stop();
      if (pulseLoop) pulseLoop.stop();
    };
  }, [isScanning]);

  // 2. Khởi chạy Scanner BLE Sonar
  useEffect(() => {
    startRescuerScanner({ interval: 1400 }, (signals) => {
      setDiscoveredSignals(signals);
      if (signals.length > 0) {
        // Tự động chọn mục tiêu gần nhất
        signals.sort((a, b) => a.distanceM - b.distanceM);
        setSelectedSignal((prev) => prev ? signals.find(s => s.sosId === prev.sosId) || signals[0] : signals[0]);
        // Bíp Sonar khi cự ly < 30m
        if (signals[0].distanceM <= 30) {
          playSonarBeep();
        }
      }
    });

    (async () => {
      const history = await getQuickChatHistory();
      setChatMessages(history);
    })();

    const unsubChat = subscribeToChatMessage((msg) => {
      setChatMessages((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)].slice(0, 30));
    });

    return () => {
      stopRescuerScanner();
      unsubChat();
    };
  }, []);

  // Tính góc xoay kim quét radar
  const spinInterpolation = radarSweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Gửi lệnh PING định vị từ xa
  const handlePingTarget = async () => {
    if (!selectedSignal) return;
    triggerHaptic('alarm');
    await sendRemotePing(selectedSignal.sosId);
    setModalConfig({
      visible: true,
      type: 'success',
      title: '🚨 Đã gửi lệnh PING định vị!',
      message: `Đã phát lệnh kích hoạt chớp đèn Flash SOS và hú còi 100% âm lượng trên máy nạn nhân GP-#${selectedSignal.sosId} ở cự ly ${selectedSignal.distanceM}m.`,
    });
  };

  // Đánh dấu đã cứu nạn nhân an toàn (Lưu vào hàng đợi Store-and-Forward)
  const handleMarkResolved = async () => {
    if (!selectedSignal) return;
    triggerHaptic('warning');
    const newCount = await markVictimResolvedOffline(
      selectedSignal,
      `Đã cứu ${selectedSignal.peopleCount} người lên ca-nô tuần tra an toàn`
    );
    setOfflineQueueCount(newCount);
    setModalConfig({
      visible: true,
      type: 'success',
      title: '✅ Đã ghi nhận cứu nạn an toàn!',
      message: `Hồ sơ GP-#${selectedSignal.sosId} (${selectedSignal.peopleCount} người) đã được lưu vào bộ nhớ cục bộ ca-nô. Khi về trạm có sóng 4G, hệ thống sẽ tự động đồng bộ lên Bản đồ Chỉ huy.`,
    });
  };

  // Đồng bộ hàng loạt lên Django Backend
  const handleSyncToBackend = async () => {
    setSyncing(true);
    triggerHaptic('impact');
    const result = await syncOfflineQueueToBackend(apiClient, 'CANO_TUAN_TRA_01');
    setSyncing(false);

    if (result.success) {
      setOfflineQueueCount(0);
      setModalConfig({
        visible: true,
        type: 'success',
        title: '🎉 Đồng bộ thành công!',
        message: `Đã đẩy thành công ${result.syncedCount} hồ sơ cứu nạn ngoại tuyến lên máy chủ trung tâm. Trạng thái trên Web Admin đã chuyển sang RESOLVED!`,
      });
    } else {
      setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Chưa có kết nối mạng',
        message: result.error || 'Thiết bị chưa bắt được sóng 4G/Wi-Fi. Toàn bộ hồ sơ vẫn được giữ an toàn trên máy.',
      });
    }
  };

  // Gửi tin nhắn bộ đàm 1-chạm
  const handleSendRescuerChat = async (text) => {
    const msg = await sendQuickChatMessage('RESCUER', text, selectedSignal?.sosId || 'ALL');
    setChatMessages((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)].slice(0, 30));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader
        showBack
        onBack={() => navigation.goBack()}
        title="RADAR CỨU NẠN NGOẠI TUYẾN"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ─── 1. Header trạng thái Sonar ─────────────────────────────────── */}
        <View style={styles.headerBanner}>
          <View style={styles.headerLeft}>
            <View style={styles.livePulseDot} />
            <Text style={styles.bannerTitle}>SONAR TẦM SOÁT 360° (BLE GRID)</Text>
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

        {/* ─── 2. Giao diện Màn hình Radar Sonar Trực quan ────────────────── */}
        <View style={styles.radarContainer}>
          <View style={[styles.radarCircle, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
            {/* Vòng tròn cự ly 50m, 30m, 15m, 5m */}
            <View style={[styles.radarRing, { width: '85%', height: '85%' }]} />
            <View style={[styles.radarRing, { width: '60%', height: '60%' }]} />
            <View style={[styles.radarRing, { width: '35%', height: '35%' }]} />
            <View style={[styles.radarCrossH]} />
            <View style={[styles.radarCrossV]} />

            {/* Nhãn cự ly */}
            <Text style={[styles.radarDistLabel, { top: 6 }]}>50m</Text>
            <Text style={[styles.radarDistLabel, { top: RADAR_SIZE * 0.18 }]}>30m</Text>
            <Text style={[styles.radarDistLabel, { top: RADAR_SIZE * 0.31 }]}>15m</Text>

            {/* Kim quét Radar xoay 360 độ */}
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

            {/* Ca-nô ở trung tâm */}
            <View style={styles.radarCenterBoat}>
              <MaterialCommunityIcons name="ferry" size={16} color="#38BDF8" />
            </View>

            {/* Các điểm phao cứu sinh phát hiện được trên Radar */}
            {discoveredSignals.map((sig) => {
              const radiusPct = Math.min(Math.max(sig.distanceM / 50.0, 0.18), 0.44);
              const angleRad = ((sig.radarAngle || 45) * Math.PI) / 180;
              const xPos = (RADAR_SIZE / 2) + Math.cos(angleRad) * (RADAR_SIZE * radiusPct) - 10;
              const yPos = (RADAR_SIZE / 2) + Math.sin(angleRad) * (RADAR_SIZE * radiusPct) - 10;

              const isTargetSelected = selectedSignal?.sosId === sig.sosId;

              return (
                <TouchableOpacity
                  key={sig.id}
                  style={[
                    styles.radarTargetDot,
                    { left: xPos, top: yPos },
                    isTargetSelected && styles.radarTargetDotSelected,
                  ]}
                  onPress={() => setSelectedSignal(sig)}
                >
                  <Animated.View
                    style={[
                      styles.targetPulseWave,
                      isTargetSelected && { transform: [{ scale: targetPulseAnim }] },
                    ]}
                  />
                  <Text style={styles.targetDotEmoji}>📍</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── 3. Thẻ Thông tin Chi tiết Mục tiêu Gần nhất ────────────────── */}
        {selectedSignal ? (
          <View style={styles.targetCard}>
            <View style={styles.targetHeader}>
              <View style={styles.targetBadge}>
                <Text style={styles.targetBadgeText}>MỤC TIÊU PHÁT HIỆN: GP-#{selectedSignal.sosId}</Text>
              </View>
              <View style={styles.rssiBadge}>
                <MaterialCommunityIcons name="signal" size={12} color="#22C55E" />
                <Text style={styles.rssiText}>{selectedSignal.smoothedRSSI} dBm</Text>
              </View>
            </View>

            {/* Hiển thị cự ly to nổi bật */}
            <View style={styles.distMeterRow}>
              <View>
                <Text style={styles.distSubLabel}>KHOẢNG CÁCH ƯỚC TÍNH (RSSI):</Text>
                <View style={styles.distValueRow}>
                  <Text style={styles.distBigValue}>{selectedSignal.distanceM}</Text>
                  <Text style={styles.distUnit}>MÉT</Text>
                </View>
              </View>

              <View style={styles.proximityStatus}>
                <Text style={styles.proximityStatusText}>
                  {selectedSignal.distanceM <= 5
                    ? '🎯 ĐÃ ÁP SÁT'
                    : selectedSignal.distanceM <= 15
                    ? '⚡ RẤT GẦN'
                    : '📡 TRONG TẦM BẮT'}
                </Text>
              </View>
            </View>

            {/* Chi tiết nhân khẩu */}
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>
                👨‍👩‍👦 Nhân khẩu: <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{selectedSignal.peopleCount} người</Text>
              </Text>
              <View style={styles.demoTags}>
                {selectedSignal.hasElderly && <Text style={styles.demoTag}>🧓 Có người già</Text>}
                {selectedSignal.hasChildren && <Text style={styles.demoTag}>👶 Có trẻ nhỏ</Text>}
                {selectedSignal.hasInjury && <Text style={styles.demoTag}>🩹 Có thương tích</Text>}
                <Text style={[styles.demoTag, { color: '#EF4444', borderColor: '#EF4444' }]}>
                  🚨 Mức độ: {selectedSignal.severity === 3 ? 'Nguy kịch' : 'Ngập sâu'}
                </Text>
              </View>
            </View>

            {/* Tọa độ GPS */}
            <Text style={styles.gpsCoordText}>
              📍 GPS Vệ tinh: {selectedSignal.lat.toFixed(6)}°N, {selectedSignal.lng.toFixed(6)}°E
            </Text>

            {/* Nút hành động tác chiến */}
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
            <Text style={styles.noTargetText}>Đang quét sóng vô tuyến cự ly 70m xung quanh...</Text>
          </View>
        )}

        {/* ─── 4. Cơ chế Bồ Câu Đưa Thư (Store-and-Forward Sync) ─────────── */}
        <View style={styles.mulingCard}>
          <View style={styles.mulingHeader}>
            <MaterialCommunityIcons name="database-sync" size={20} color="#1D4ED8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.mulingTitle}>BỒ CÂU ĐƯA THƯ SỐ (STORE-AND-FORWARD)</Text>
              <Text style={styles.mulingDesc}>
                Ca-nô lưu trữ tạm hồ sơ nạn nhân đã cứu. Khi ra vùng có sóng 4G/Wi-Fi, hệ thống tự động đồng bộ hàng loạt lên máy chủ trung tâm.
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

        {/* ─── 5. Bộ Đàm BLE 1-Chạm (Quick Chat với Người Dân) ───────────── */}
        <View style={styles.chatCard}>
          <View style={styles.chatHeader}>
            <MaterialCommunityIcons name="radio-handheld" size={20} color="#1D4ED8" />
            <Text style={styles.chatTitle}>BỘ ĐÀM NGOẠI TUYẾN 1-CHẠM (RESCUER CHAT)</Text>
          </View>

          <View style={styles.presetGrid}>
            {RESCUER_PRESET_MESSAGES.map((msg, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.presetChip}
                onPress={() => handleSendRescuerChat(msg)}
              >
                <Text style={styles.presetChipText}>+ {msg}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Lịch sử tin nhắn */}
          {chatMessages.length > 0 && (
            <View style={styles.chatHistory}>
              <Text style={styles.chatHistoryLabel}>TIN NHẮN ĐÃ TRAO ĐỔI TẦM GẦN:</Text>
              {chatMessages.slice(0, 4).map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.chatBubble,
                    m.senderRole === 'RESCUER' ? styles.chatBubbleRescuer : styles.chatBubbleCitizen,
                  ]}
                >
                  <Text style={styles.chatRole}>
                    {m.senderRole === 'RESCUER' ? '🛡️ Tôi (Ca-nô):' : '👤 Người dân:'}
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
