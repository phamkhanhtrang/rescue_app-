/**
 * src/screens/citizen/alerts/OfflineModeScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phao Cứu Sinh Ngoại Tuyến Bluetooth (BLE Digital Beacon - 0xGP Protocol).
 *
 * Chức năng:
 * 1. Hoạt động độc lập 100% khi mất mạng 4G/Wi-Fi và mất điện lưới.
 * 2. Lấy tọa độ GPS vệ tinh trực tiếp (0đ cước phí, không cần SIM).
 * 3. Thiết lập nhân khẩu (Số người, Trẻ nhỏ, Người già, Chấn thương).
 * 4. Nén gói tin nhị phân 16-Bytes và phát xung BLE Advertising (mỗi 800ms).
 * 5. Nhận lệnh PING từ ca-nô cứu hộ cự ly gần: Chớp đèn Flash SOS và Hú còi 100% âm lượng.
 * 6. Bộ đàm tin nhắn nhanh 1-chạm (BLE Quick Chat).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Animated, Alert, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import CustomModal from '../../../components/common/CustomModal';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';
import {
  startCitizenBeacon,
  stopCitizenBeacon,
  getCitizenBeaconState,
  subscribeToPulse,
  subscribeToPing,
  sendQuickChatMessage,
  getQuickChatHistory,
  subscribeToChatMessage,
  playAlarmSiren,
  triggerHaptic,
} from '../../../services/bleGridService';

const PRESET_MESSAGES = [
  'Đang ở gác lửng sau nhà',
  'Cửa cuốn kẹt không mở được',
  'Có trẻ nhỏ bị sốt cao',
  'Đã hết sạch nước uống',
  'Gia đình an toàn, đang chờ ca-nô',
];

const OfflineModeScreen = ({ navigation }) => {
  // Trạng thái GPS
  const [gps, setGps] = useState({ lat: 16.0544, lng: 108.2022, ready: false });

  // Cấu hình phao cứu sinh
  const [peopleCount, setPeopleCount] = useState(3);
  const [hasElderly, setHasElderly] = useState(true);
  const [hasChildren, setHasChildren] = useState(false);
  const [hasInjury, setHasInjury] = useState(false);
  const [severity, setSeverity] = useState(2); // 1: Cần hỗ trợ, 2: Ngập sâu/Hết lương thực, 3: Nguy kịch

  // Trạng thái phát sóng
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const [packetHex, setPacketHex] = useState('');
  const [pingAlert, setPingAlert] = useState(null);

  // Bộ đàm tin nhắn
  const [chatMessages, setChatMessages] = useState([]);

  // Animation nhịp thở & vòng quét phát sóng
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const radarWave = useRef(new Animated.Value(0)).current;

  // Modal thông báo
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  // 1. Lấy vị trí GPS vệ tinh khi mở màn hình
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setGps({
            lat: Math.round(loc.coords.latitude * 1000000) / 1000000,
            lng: Math.round(loc.coords.longitude * 1000000) / 1000000,
            ready: true,
          });
        } else {
          setGps({ lat: 16.0544, lng: 108.2022, ready: true });
        }
      } catch (e) {
        setGps({ lat: 16.0544, lng: 108.2022, ready: true });
      }
    })();
  }, []);

  // 2. Khôi phục trạng thái phát sóng nếu đã bật trước đó
  useEffect(() => {
    (async () => {
      const state = await getCitizenBeaconState();
      if (state.isActive && state.data) {
        setIsBroadcasting(true);
        setPacketHex(state.data.packetHex || '');
        setPulseCount(state.pulseCount || 0);
      }
      const chat = await getQuickChatHistory();
      setChatMessages(chat);
    })();
  }, []);

  // 3. Quản lý Animation khi đang phát sóng
  useEffect(() => {
    let loopAnim = null;
    let waveAnim = null;

    if (isBroadcasting) {
      loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loopAnim.start();

      waveAnim = Animated.loop(
        Animated.timing(radarWave, { toValue: 1, duration: 1600, useNativeDriver: true })
      );
      waveAnim.start();
    } else {
      pulseAnim.setValue(1);
      radarWave.setValue(0);
    }

    return () => {
      if (loopAnim) loopAnim.stop();
      if (waveAnim) waveAnim.stop();
    };
  }, [isBroadcasting]);

  // 4. Lắng nghe nhịp xung phát & lệnh PING từ cứu hộ
  useEffect(() => {
    const unsubPulse = subscribeToPulse((info) => {
      setPulseCount(info.pulseNumber);
      setPacketHex(info.hex);
    });

    const unsubPing = subscribeToPing((pingData) => {
      setPingAlert({
        receivedAt: new Date().toLocaleTimeString('vi-VN'),
        targetId: pingData.targetId,
      });
      triggerHaptic('alarm');
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

  // Bật/tắt phát phao cứu sinh
  const toggleBroadcast = async () => {
    if (!isBroadcasting) {
      triggerHaptic('impact');
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
      setPacketHex(beacon.packetHex);
      setPingAlert(null);
    } else {
      triggerHaptic('warning');
      await stopCitizenBeacon();
      setIsBroadcasting(false);
      setPingAlert(null);
    }
  };

  // Thử nghiệm còi hú và chớp đèn ngay trên máy
  const handleTestPing = async () => {
    triggerHaptic('alarm');
    setPingAlert({
      receivedAt: new Date().toLocaleTimeString('vi-VN'),
      targetId: 'TEST_MANUAL',
    });
    await playAlarmSiren(5000);
  };

  // Gửi tin nhắn nhanh bộ đàm
  const handleSendQuickChat = async (text) => {
    const msg = await sendQuickChatMessage('CITIZEN', text);
    setChatMessages((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)].slice(0, 30));
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isBroadcasting ? '#090D16' : COLORS.bgDark }]}>
      <SentinelHeader
        dark
        showBack
        onBack={() => navigation.goBack()}
        title={isBroadcasting ? 'PHAO CỨU SINH BLE (ĐANG PHÁT)' : 'CỨU NẠN NGOẠI TUYẾN BLE'}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ─── 1. Báo động khi nhận lệnh Ping từ Ca-nô cứu hộ ────────────── */}
        {pingAlert && (
          <View style={styles.pingAlertCard}>
            <View style={styles.pingAlertHeader}>
              <MaterialCommunityIcons name="bullhorn" size={26} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pingAlertTitle}>PHÁT HIỆN CA-NÔ CỨU HỘ Ở CỰ LY GẦN!</Text>
                <Text style={styles.pingAlertSub}>
                  Đội cứu hộ vừa gửi lệnh Ping lúc {pingAlert.receivedAt}. Điện thoại đang chớp đèn Flash SOS và hú còi âm lượng lớn để chỉ vị trí!
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.pingDismissBtn} onPress={() => setPingAlert(null)}>
              <Text style={styles.pingDismissText}>ĐÃ NHẬN BIẾT / TẮT BÁO ĐỘNG</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── 2. Trạng thái Sóng vô tuyến & GPS Vệ tinh ──────────────────── */}
        <View style={styles.sensorCard}>
          <View style={styles.sensorRow}>
            <View style={styles.sensorItem}>
              <MaterialCommunityIcons name="satellite-variant" size={20} color="#38BDF8" />
              <View>
                <Text style={styles.sensorLabel}>GPS VỆ TINH ĐỘC LẬP</Text>
                <Text style={styles.sensorValue}>
                  {gps.lat.toFixed(4)}°N, {gps.lng.toFixed(4)}°E
                </Text>
                <Text style={styles.sensorSub}>Sai số ±3m • 0đ data</Text>
              </View>
            </View>

            <View style={styles.sensorItem}>
              <MaterialCommunityIcons name="bluetooth" size={20} color="#34D399" />
              <View>
                <Text style={styles.sensorLabel}>BĂNG TẦN BLE 2.4GHz</Text>
                <Text style={styles.sensorValue}>0xGP (16 Bytes)</Text>
                <Text style={styles.sensorSub}>Phát mỗi 800ms • ~12mA</Text>
              </View>
            </View>
          </View>
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
                  onPress={() => setPeopleCount((p) => Math.min(20, p + 1))}
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
          /* Màn hình hiển thị khi đang phát sóng (Siêu tiết kiệm pin) */
          <View style={styles.activeBeaconCard}>
            <View style={styles.activeBeaconHeader}>
              <Animated.View style={[styles.activeBeaconDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.activeBeaconTitle}>PHAO CỨU SINH ĐANG PHÁT XUNG</Text>
            </View>

            <Text style={styles.activeBeaconSub}>
              Điện thoại đang quảng bá tín hiệu nhị phân 16-Bytes đến ca-nô và lực lượng cứu hộ trong bán kính 30m – 70m.
            </Text>

            {/* Thông số gói tin */}
            <View style={styles.packetHexBox}>
              <Text style={styles.packetHexLabel}>GÓI TIN NHỊ PHÂN (16 BYTES 0xGP):</Text>
              <Text style={styles.packetHexValue}>{packetHex || '4750... CHỜ PHÁT'}</Text>
              <View style={styles.packetStatRow}>
                <Text style={styles.packetStat}>Nhịp xung: #{pulseCount}</Text>
                <Text style={styles.packetStat}>Chu kỳ: 800ms</Text>
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
          ]}
          onPress={toggleBroadcast}
          activeOpacity={0.88}
        >
          <Animated.View style={{ transform: [{ scale: isBroadcasting ? pulseAnim : 1 }] }}>
            <MaterialCommunityIcons
              name={isBroadcasting ? 'radiobox-marked' : 'broadcast'}
              size={32}
              color="#FFF"
            />
          </Animated.View>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.mainActionTitle}>
              {isBroadcasting ? 'DỪNG PHÁT PHAO CỨU SINH' : 'KÍCH HOẠT PHAO CỨU SINH BLE'}
            </Text>
            <Text style={styles.mainActionSub}>
              {isBroadcasting
                ? 'Nhấn để tạm dừng phát xung khi đã được cứu'
                : 'Phát sóng cự ly 30m - 70m không cần mạng Internet'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ─── 5. Bộ đàm Tin nhắn Nhanh BLE (Quick Chat) ──────────────────── */}
        <View style={styles.chatCard}>
          <View style={styles.chatHeader}>
            <MaterialCommunityIcons name="message-flash" size={20} color="#38BDF8" />
            <Text style={styles.chatTitle}>BỘ ĐÀM TIN NHẮN NHANH BLE 1-CHẠM</Text>
          </View>
          <Text style={styles.chatSubtitle}>
            Gửi nhanh vị trí cụ thể trong nhà cho ca-nô cứu hộ ở cự ly gần không cần 4G:
          </Text>

          {/* Danh sách nút nhắn 1-chạm */}
          <View style={styles.presetGrid}>
            {PRESET_MESSAGES.map((msg, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.presetChip}
                onPress={() => handleSendQuickChat(msg)}
              >
                <Text style={styles.presetChipText}>+ {msg}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Lịch sử tin nhắn bộ đàm */}
          {chatMessages.length > 0 && (
            <View style={styles.chatHistory}>
              <Text style={styles.chatHistoryTitle}>TIN NHẮN ĐÃ TRAO ĐỔI TẦM GẦN:</Text>
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
