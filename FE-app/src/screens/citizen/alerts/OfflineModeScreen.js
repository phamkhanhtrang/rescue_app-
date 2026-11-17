/**
 * src/screens/citizen/alerts/OfflineModeScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phao Cứu Sinh Ngoại Tuyến Bluetooth (giao thức 0xGP v2).
 *
 * Chức năng:
 * 1. Lấy toạ độ GPS của máy (không cần mạng) và cập nhật liên tục vào gói SOS.
 * 2. Thiết lập nhân khẩu (số người, trẻ nhỏ, người già, chấn thương) và mức độ.
 * 3. Phát gói SOS 20 bytes bằng BLE Advertising cho ca-nô cứu hộ ở gần.
 * 4. Nghe lệnh PING của cứu hộ: hú còi và chớp đèn flash để chỉ vị trí.
 * 5. Gửi / nhận tin nhắn soạn sẵn với cứu hộ ở tầm gần.
 *
 * Khi chạy trong Expo Go, web hoặc iOS, sóng BLE được giả lập qua máy chủ
 * (xem services/bleTransport.js) và giao diện ghi rõ "MÔ PHỎNG".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Animated, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import CustomModal from '../../../components/common/CustomModal';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';
import { CITIZEN_MESSAGES } from '../../../services/bleProtocol';
import {
  startCitizenBeacon,
  stopCitizenBeacon,
  restoreCitizenBeacon,
  updateCitizenLocation,
  getTransportInfo,
  subscribeToPulse,
  subscribeToPing,
  sendQuickChatMessage,
  getQuickChatHistory,
  subscribeToChatMessage,
  stopAlarmSiren,
  triggerHaptic,
} from '../../../services/bleGridService';

const PING_ALARM_MS = 15000;

const formatElapsed = (totalSec) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const OfflineModeScreen = ({ navigation }) => {
  const transport = getTransportInfo();

  // Trạng thái GPS (lat/lng = 0 nghĩa là chưa có toạ độ)
  const [gps, setGps] = useState({ lat: 0, lng: 0, accuracy: null, ready: false, denied: false });

  // Cấu hình phao cứu sinh
  const [peopleCount, setPeopleCount] = useState(1);
  const [hasElderly, setHasElderly] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);
  const [hasInjury, setHasInjury] = useState(false);
  const [severity, setSeverity] = useState(2); // 1: Cần hỗ trợ, 2: Ngập sâu/Hết lương thực, 3: Nguy kịch

  // Trạng thái phát sóng
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [beaconId, setBeaconId] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [packetHex, setPacketHex] = useState('');
  const [pingAlert, setPingAlert] = useState(null);

  // Đèn flash chớp khi nhận PING
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [strobeOn, setStrobeOn] = useState(false);
  const canStrobe = Platform.OS !== 'web' && !!cameraPermission?.granted;

  // Tin nhắn soạn sẵn
  const [chatMessages, setChatMessages] = useState([]);

  // Animation nhịp thở
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Modal thông báo
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });
  const showModal = (type, title, message) => setModalConfig({ visible: true, type, title, message });

  // 1. Theo dõi vị trí GPS và cập nhật vào gói SOS đang phát
  useEffect(() => {
    let subscription = null;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setGps((g) => ({ ...g, denied: true }));
          return;
        }
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 10 },
          (loc) => {
            const lat = Math.round(loc.coords.latitude * 1000000) / 1000000;
            const lng = Math.round(loc.coords.longitude * 1000000) / 1000000;
            setGps({ lat, lng, accuracy: loc.coords.accuracy ?? null, ready: true, denied: false });
            updateCitizenLocation(lat, lng);
          }
        );
        if (cancelled) subscription.remove();
      } catch (e) {
        setGps((g) => ({ ...g, denied: true }));
      }
    })();
    return () => {
      cancelled = true;
      if (subscription) subscription.remove();
    };
  }, []);

  // 2. Khôi phục phao đang bật (kể cả sau khi app bị đóng) và lịch sử tin nhắn
  useEffect(() => {
    (async () => {
      const state = await restoreCitizenBeacon();
      if (state.isActive) {
        setIsBroadcasting(true);
        setBeaconId(state.sosId);
        setPacketHex(state.packetHex || '');
        setElapsedSec(state.elapsedSec || 0);
        if (state.config) {
          setPeopleCount(state.config.peopleCount);
          setHasElderly(state.config.hasElderly);
          setHasChildren(state.config.hasChildren);
          setHasInjury(state.config.hasInjury);
          setSeverity(state.config.severity);
        }
      }
      setChatMessages(await getQuickChatHistory());
    })();
  }, []);

  // 3. Animation khi đang phát sóng
  useEffect(() => {
    if (!isBroadcasting) {
      pulseAnim.setValue(1);
      return undefined;
    }
    const loopAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loopAnim.start();
    return () => loopAnim.stop();
  }, [isBroadcasting]);

  // 4. Lắng nghe nhịp phát, lệnh PING và tin nhắn từ cứu hộ
  useEffect(() => {
    const unsubPulse = subscribeToPulse((info) => {
      setElapsedSec(info.elapsedSec);
      setPacketHex(info.hex);
    });

    const unsubPing = subscribeToPing((pingData) => {
      setPingAlert({
        receivedAt: new Date().toLocaleTimeString('vi-VN'),
        rescuerDistanceM: pingData.rescuerDistanceM,
        key: pingData.timestamp,
      });
    });

    const unsubChat = subscribeToChatMessage((msg) => {
      setChatMessages((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)].slice(0, 30));
    });

    return () => {
      unsubPulse();
      unsubPing();
      unsubChat();
    };
  }, []);

  // 5. Chớp đèn flash trong lúc báo động PING
  useEffect(() => {
    if (!pingAlert) {
      setStrobeOn(false);
      return undefined;
    }
    const blink = setInterval(() => setStrobeOn((on) => !on), 350);
    const stop = setTimeout(() => {
      clearInterval(blink);
      setStrobeOn(false);
    }, PING_ALARM_MS);
    return () => {
      clearInterval(blink);
      clearTimeout(stop);
    };
  }, [pingAlert?.key]);

  // Bật/tắt phát phao cứu sinh
  const toggleBroadcast = async () => {
    if (starting) return;
    if (!isBroadcasting) {
      triggerHaptic('impact');
      setStarting(true);
      try {
        // Xin quyền camera để có thể chớp đèn flash khi cứu hộ PING (từ chối vẫn phát phao được).
        if (Platform.OS !== 'web' && !cameraPermission?.granted) {
          await requestCameraPermission().catch(() => {});
        }
        const beacon = await startCitizenBeacon({
          peopleCount,
          hasElderly,
          hasChildren,
          hasInjury,
          severity,
          lat: gps.lat,
          lng: gps.lng,
        });
        setIsBroadcasting(true);
        setBeaconId(beacon.sosId);
        setPacketHex(beacon.packetHex);
        setElapsedSec(0);
        setPingAlert(null);
      } catch (e) {
        showModal('warning', 'Chưa phát được phao cứu sinh', e?.message || 'Không phát được tín hiệu.');
      } finally {
        setStarting(false);
      }
    } else {
      triggerHaptic('warning');
      await stopCitizenBeacon();
      setIsBroadcasting(false);
      setPingAlert(null);
    }
  };

  const dismissPingAlert = () => {
    stopAlarmSiren();
    setPingAlert(null);
  };

  // Gửi tin nhắn soạn sẵn
  const handleSendQuickChat = async (code) => {
    try {
      await sendQuickChatMessage('CITIZEN', code);
    } catch (e) {
      showModal('warning', 'Chưa gửi được tin nhắn', e?.message || 'Không phát được tín hiệu.');
    }
  };

  const gpsText = gps.ready
    ? `${gps.lat.toFixed(4)}°, ${gps.lng.toFixed(4)}°`
    : gps.denied ? 'Chưa có quyền vị trí' : 'Đang dò vệ tinh…';
  const gpsSub = gps.ready
    ? (gps.accuracy ? `Sai số ±${Math.round(gps.accuracy)}m` : 'Đã có toạ độ')
    : 'Cứu hộ vẫn dò được theo sóng';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isBroadcasting ? '#090D16' : COLORS.bgDark }]}>
      <SentinelHeader
        dark
        showBack
        onBack={() => navigation.goBack()}
        title={isBroadcasting ? 'PHAO CỨU SINH BLE (ĐANG PHÁT)' : 'CỨU NẠN NGOẠI TUYẾN BLE'}
      />

      {/* Camera ẩn chỉ để điều khiển đèn flash khi nhận PING */}
      {pingAlert && canStrobe && (
        <CameraView style={styles.hiddenCamera} facing="back" enableTorch={strobeOn} />
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ─── 1. Báo động khi nhận lệnh Ping từ Ca-nô cứu hộ ────────────── */}
        {pingAlert && (
          <View style={styles.pingAlertCard}>
            <View style={styles.pingAlertHeader}>
              <MaterialCommunityIcons name="bullhorn" size={26} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pingAlertTitle}>CỨU HỘ ĐANG Ở GẦN BẠN!</Text>
                <Text style={styles.pingAlertSub}>
                  Đội cứu hộ vừa gửi lệnh Ping lúc {pingAlert.receivedAt}
                  {pingAlert.rescuerDistanceM != null ? `, cách bạn khoảng ${pingAlert.rescuerDistanceM}m theo GPS` : ''}.
                  {' '}Điện thoại đang hú còi{canStrobe ? ' và chớp đèn flash' : ''} để chỉ vị trí.
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.pingDismissBtn} onPress={dismissPingAlert}>
              <Text style={styles.pingDismissText}>ĐÃ NHẬN BIẾT / TẮT BÁO ĐỘNG</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── 2. Trạng thái GPS & kênh truyền ────────────────────────────── */}
        <View style={styles.sensorCard}>
          <View style={styles.sensorRow}>
            <View style={styles.sensorItem}>
              <MaterialCommunityIcons name="satellite-variant" size={20} color="#38BDF8" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sensorLabel}>GPS CỦA MÁY</Text>
                <Text style={styles.sensorValue}>{gpsText}</Text>
                <Text style={styles.sensorSub}>{gpsSub}</Text>
              </View>
            </View>

            <View style={styles.sensorItem}>
              <MaterialCommunityIcons
                name={transport.isSimulated ? 'lan-connect' : 'bluetooth'}
                size={20}
                color={transport.isSimulated ? '#F59E0B' : '#34D399'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.sensorLabel}>KÊNH TRUYỀN</Text>
                <Text style={styles.sensorValue}>{transport.isSimulated ? 'MÔ PHỎNG QUA MẠNG' : 'BLUETOOTH BLE'}</Text>
                <Text style={styles.sensorSub}>Gói 0xGP 20 bytes</Text>
              </View>
            </View>
          </View>
          {transport.isSimulated && (
            <Text style={styles.simNotice}>
              Bản chạy này không dùng được sóng Bluetooth thật (Expo Go, web hoặc iOS). Tín hiệu đang
              được giả lập qua máy chủ nên cần có mạng. Cài bản build Android để phát BLE thật.
            </Text>
          )}
        </View>

        {/* ─── 3. Cấu hình nhân khẩu học & mức độ nguy cấp ───────────────── */}
        {!isBroadcasting ? (
          <View style={styles.configCard}>
            <Text style={styles.cardHeaderTitle}>1. THIẾT LẬP THÔNG TIN CẦN CỨU</Text>

            {/* Số người */}
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>Số người đang mắc kẹt:</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setPeopleCount((p) => Math.max(1, p - 1))}
                >
                  <Text style={styles.counterBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{peopleCount} người</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setPeopleCount((p) => Math.min(31, p + 1))}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Phân loại đặc biệt */}
            <Text style={[styles.configLabel, { marginTop: 8 }]}>Trường hợp cần ưu tiên:</Text>
            <View style={styles.tagsGrid}>
              <TouchableOpacity
                style={[styles.tagItem, hasElderly && styles.tagActive]}
                onPress={() => setHasElderly(!hasElderly)}
              >
                <Text style={styles.tagIcon}>🧓</Text>
                <Text style={[styles.tagText, hasElderly && styles.tagTextActive]}>Người cao tuổi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tagItem, hasChildren && styles.tagActive]}
                onPress={() => setHasChildren(!hasChildren)}
              >
                <Text style={styles.tagIcon}>👶</Text>
                <Text style={[styles.tagText, hasChildren && styles.tagTextActive]}>Trẻ em / Sơ sinh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tagItem, hasInjury && styles.tagActive]}
                onPress={() => setHasInjury(!hasInjury)}
              >
                <Text style={styles.tagIcon}>🩹</Text>
                <Text style={[styles.tagText, hasInjury && styles.tagTextActive]}>Chấn thương / Bệnh</Text>
              </TouchableOpacity>
            </View>

            {/* Mức độ nguy cấp */}
            <Text style={[styles.configLabel, { marginTop: 12 }]}>Mức độ khẩn cấp:</Text>
            <View style={styles.severityRow}>
              {[
                { level: 1, label: 'Cần hỗ trợ', color: '#38BDF8' },
                { level: 2, label: 'Ngập sâu / Hết thức ăn', color: '#F59E0B' },
                { level: 3, label: 'Nguy kịch', color: '#EF4444' },
              ].map((s) => (
                <TouchableOpacity
                  key={s.level}
                  style={[
                    styles.severityBtn,
                    severity === s.level && { borderColor: s.color, backgroundColor: `${s.color}22` },
                  ]}
                  onPress={() => setSeverity(s.level)}
                >
                  <View style={[styles.severityDot, { backgroundColor: s.color }]} />
                  <Text
                    style={[
                      styles.severityBtnText,
                      severity === s.level && { color: '#FFF', fontWeight: 'bold' },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* Màn hình hiển thị khi đang phát sóng */
          <View style={styles.activeBeaconCard}>
            <View style={styles.activeBeaconHeader}>
              <Animated.View style={[styles.activeBeaconDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.activeBeaconTitle}>PHAO CỨU SINH ĐANG PHÁT</Text>
            </View>

            <Text style={styles.activeBeaconSub}>
              {transport.isSimulated
                ? 'Tín hiệu SOS đang được giả lập qua máy chủ cho các máy cứu hộ cùng chạy chế độ mô phỏng.'
                : 'Điện thoại đang phát tín hiệu SOS cho ca-nô cứu hộ trong tầm khoảng 10–30m (xa hơn nếu thoáng). Hãy giữ ứng dụng mở trên màn hình để phao tiếp tục phát.'}
            </Text>

            {/* Thông số gói tin */}
            <View style={styles.packetHexBox}>
              <Text style={styles.packetHexLabel}>GÓI TIN ĐANG PHÁT (20 BYTES 0xGP):</Text>
              <Text style={styles.packetHexValue}>{packetHex || '4750...'}</Text>
              <View style={styles.packetStatRow}>
                <Text style={styles.packetStat}>Mã phao: GP-#{beaconId}</Text>
                <Text style={styles.packetStat}>Đã phát: {formatElapsed(elapsedSec)}</Text>
                <Text style={styles.packetStat}>Số người: {peopleCount}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── 4. Nút bấm chính Kích hoạt / Tắt Phao cứu sinh ─────────────── */}
        <TouchableOpacity
          style={[
            styles.mainActionButton,
            isBroadcasting ? styles.stopButton : styles.startButton,
            starting && { opacity: 0.6 },
          ]}
          onPress={toggleBroadcast}
          disabled={starting}
          activeOpacity={0.88}
        >
          <Animated.View style={{ transform: [{ scale: isBroadcasting ? pulseAnim : 1 }] }}>
            <MaterialCommunityIcons
              name={isBroadcasting ? 'radiobox-marked' : 'broadcast'}
              size={32}
              color="#FFF"
            />
          </Animated.View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.mainActionTitle}>
              {isBroadcasting ? 'DỪNG PHÁT PHAO CỨU SINH' : starting ? 'ĐANG KHỞI ĐỘNG...' : 'KÍCH HOẠT PHAO CỨU SINH BLE'}
            </Text>
            <Text style={styles.mainActionSub}>
              {isBroadcasting
                ? 'Nhấn để dừng phát khi đã được cứu'
                : transport.isSimulated
                ? 'Chế độ mô phỏng: cần kết nối tới máy chủ'
                : 'Phát sóng Bluetooth tầm gần, không cần Internet'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ─── 5. Tin nhắn soạn sẵn với cứu hộ ────────────────────────────── */}
        <View style={styles.chatCard}>
          <View style={styles.chatHeader}>
            <MaterialCommunityIcons name="message-flash" size={20} color="#38BDF8" />
            <Text style={styles.chatTitle}>TIN NHẮN NHANH 1-CHẠM</Text>
          </View>
          <Text style={styles.chatSubtitle}>
            {isBroadcasting
              ? 'Chạm để phát tin nhắn cho ca-nô cứu hộ ở gần (mỗi tin phát trong vài giây):'
              : 'Kích hoạt phao cứu sinh trước, sau đó chạm để gửi tin cho ca-nô cứu hộ ở gần:'}
          </Text>

          <View style={styles.presetGrid}>
            {CITIZEN_MESSAGES.map((m) => (
              <TouchableOpacity
                key={m.code}
                style={[styles.presetChip, !isBroadcasting && { opacity: 0.5 }]}
                onPress={() => handleSendQuickChat(m.code)}
              >
                <Text style={styles.presetChipText}>+ {m.text}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {chatMessages.length > 0 && (
            <View style={styles.chatHistory}>
              <Text style={styles.chatHistoryTitle}>TIN NHẮN GẦN ĐÂY:</Text>
              {chatMessages.slice(0, 4).map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.chatBubble,
                    m.senderRole === 'CITIZEN' ? styles.chatBubbleCitizen : styles.chatBubbleRescuer,
                  ]}
                >
                  <Text style={styles.chatRole}>
                    {m.senderRole === 'CITIZEN' ? 'Tôi (Người dân):' : '🛡️ Ca-nô cứu hộ:'}
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
  safe: { flex: 1 },
  hiddenCamera: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  simNotice: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    color: '#FCD34D',
  },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 40,
    gap: SPACING.md,
  },

  // ── Sensor Card ────────────────────────────────
  sensorCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sensorItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  sensorLabel: {
    fontSize: 10,
    fontWeight: FONTS.bold,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  sensorValue: {
    fontSize: 12,
    fontWeight: FONTS.bold,
    color: '#F8FAFC',
    marginTop: 2,
  },
  sensorSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },

  // ── Ping Alert ─────────────────────────────────
  pingAlertCard: {
    backgroundColor: '#DC2626',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 2,
    borderColor: '#FEF08A',
    gap: SPACING.sm,
  },
  pingAlertHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  pingAlertTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.black,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  pingAlertSub: {
    fontSize: FONTS.xs,
    color: '#FEF2F2',
    lineHeight: 16,
    marginTop: 4,
  },
  pingDismissBtn: {
    backgroundColor: '#991B1B',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginTop: 4,
  },
  pingDismissText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#FEF08A',
  },

  // ── Config Card ────────────────────────────────
  configCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: SPACING.sm,
  },
  cardHeaderTitle: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.black,
    color: '#38BDF8',
    letterSpacing: 1,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  configLabel: {
    fontSize: FONTS.sm,
    color: '#CBD5E1',
    fontWeight: FONTS.semibold,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: RADIUS.md,
    padding: 3,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontSize: 18,
    fontWeight: FONTS.bold,
    color: '#FFF',
  },
  counterValue: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: '#FFF',
    paddingHorizontal: 12,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  tagIcon: { fontSize: 14 },
  tagText: {
    fontSize: FONTS.xs,
    color: '#94A3B8',
    fontWeight: FONTS.medium,
  },
  tagTextActive: {
    color: '#38BDF8',
    fontWeight: FONTS.bold,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  severityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  severityBtnText: {
    fontSize: 10,
    color: '#94A3B8',
  },

  // ── Active Beacon Card ─────────────────────────
  activeBeaconCard: {
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    gap: SPACING.sm,
  },
  activeBeaconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBeaconDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
  },
  activeBeaconTitle: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.black,
    color: '#22C55E',
    letterSpacing: 1,
  },
  activeBeaconSub: {
    fontSize: FONTS.xs,
    color: '#94A3B8',
    lineHeight: 16,
  },
  packetHexBox: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  packetHexLabel: {
    fontSize: 9,
    fontWeight: FONTS.bold,
    color: '#64748B',
    letterSpacing: 0.5,
  },
  packetHexValue: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#38BDF8',
    marginTop: 3,
  },
  packetStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 6,
  },
  packetStat: {
    fontSize: 10,
    color: '#94A3B8',
  },
  testPingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  testPingText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: '#FBBF24',
  },

  // ── Main Action Button ─────────────────────────
  mainActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.base,
    borderRadius: RADIUS.xl,
    marginTop: 4,
  },
  startButton: {
    backgroundColor: '#DC2626',
    ...SHADOWS.primary,
  },
  stopButton: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  mainActionTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.black,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  mainActionSub: {
    fontSize: FONTS.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // ── Quick Chat Card ────────────────────────────
  chatCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: SPACING.sm,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatTitle: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.black,
    color: '#38BDF8',
    letterSpacing: 1,
  },
  chatSubtitle: {
    fontSize: FONTS.xs,
    color: '#94A3B8',
    lineHeight: 16,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
  },
  presetChipText: {
    fontSize: 11,
    color: '#E0F2FE',
    fontWeight: FONTS.medium,
  },
  chatHistory: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    gap: 6,
  },
  chatHistoryTitle: {
    fontSize: 10,
    fontWeight: FONTS.bold,
    color: '#64748B',
  },
  chatBubble: {
    padding: 8,
    borderRadius: RADIUS.md,
    gap: 2,
  },
  chatBubbleCitizen: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignSelf: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  chatBubbleRescuer: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignSelf: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  chatRole: {
    fontSize: 10,
    fontWeight: FONTS.bold,
    color: '#CBD5E1',
  },
  chatText: {
    fontSize: FONTS.xs,
    color: '#F8FAFC',
  },
  chatTime: {
    fontSize: 9,
    color: '#64748B',
    alignSelf: 'flex-end',
  },
});

export default OfflineModeScreen;
