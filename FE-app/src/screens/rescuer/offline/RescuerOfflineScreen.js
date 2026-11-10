/**
 * src/screens/rescuer/offline/RescuerOfflineScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Chế độ Ngoại tuyến dành cho Đội cứu trợ (Light Theme đồng bộ).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RLAYOUT } from '../../../constants/rescuer/theme';

const OFFLINE_TASKS = [
  { id: 't1', title: 'BÁO CÁO TÌNH TRẠNG HIỆN TRƯỜNG', sub: 'ĐANG XỬ LÝ (62%)', pct: 62, color: RCOLORS.primary },
  { id: 't2', title: 'KIỂM TRA TRANG THIẾT BỊ', sub: 'HOÀN THÀNH (8/12)', pct: 75, color: '#16A34A' },
];

const RescuerOfflineScreen = ({ navigation }) => {
  const blink = useRef(new Animated.Value(1)).current;
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      setRetrying(false);
      setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Chưa có kết nối mạng',
        message: 'Thiết bị vẫn chưa bắt được tín hiệu 3G/4G. Hệ thống tiếp tục lưu dữ liệu cục bộ.',
      });
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} title="TÁC CHIẾN NGOẠI TUYẾN" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Offline badge ─────────────────────────────────────────────────── */}
        <View style={styles.offlineBadge}>
          <MaterialCommunityIcons name="cloud-off-outline" size={14} color="#B45309" />
          <Text style={styles.offlineBadgeText}>CHẾ ĐỘ NGOẠI TUYẾN TỰ ĐỘNG</Text>
        </View>

        {/* ── Warning banner ────────────────────────────────────────────────── */}
        <View style={styles.warningBanner}>
          <MaterialCommunityIcons name="alert-circle" size={24} color={RCOLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>HỆ THỐNG MẤT KẾT NỐI MẠNG</Text>
            <Text style={styles.warningDesc}>Đường truyền dữ liệu chính bị gián đoạn. Mọi thao tác sẽ được lưu vào bộ nhớ tạm.</Text>
          </View>
        </View>

        {/* ── Main status ───────────────────────────────────────────────────── */}
        <View style={styles.mainStatus}>
          <Text style={styles.mainStatusTitle}>CHẾ ĐỘ NGOẠI TUYẾN ĐÃ KÍCH HOẠT</Text>
          <Text style={styles.mainStatusSub}>
            Bạn vẫn có thể xem danh sách cứu nạn đã lưu, sử dụng định vị GPS vệ tinh và ghi nhận kết quả cứu trợ.
          </Text>

          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} disabled={retrying} activeOpacity={0.85}>
            <Animated.View style={[retrying && { opacity: blink }]}>
              <MaterialCommunityIcons name="refresh" size={18} color="#FFF" />
            </Animated.View>
            <Text style={styles.retryText}>{retrying ? 'ĐANG DÒ MẠNG...' : 'THỬ LẠI KẾT NỐI'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <View style={styles.featuresRow}>
          <View style={styles.featureCard}>
            <MaterialCommunityIcons name="database" size={24} color="#1D4ED8" />
            <Text style={styles.featureValue}>42.8 MB</Text>
            <Text style={styles.featureLabel}>LƯU TRỮ TẠM</Text>
          </View>
          <View style={styles.featureCard}>
            <MaterialCommunityIcons name="map-marker-multiple" size={24} color={RCOLORS.primary} />
            <Text style={styles.featureValue}>123</Text>
            <Text style={styles.featureLabel}>ĐỊA CHỈ ĐÃ LƯU</Text>
          </View>
        </View>

        {/* ── Offline map & data ───────────────────────────────────────────── */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="map-check" size={20} color="#1D4ED8" />
            <Text style={styles.aiLabel}>DỮ LIỆU & BẢN ĐỒ NGOẠI TUYẾN</Text>
          </View>

          <TouchableOpacity
            style={styles.mapOfflineButton}
            onPress={() => navigation.navigate('MapTab')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="download-box-outline" size={18} color="#FFF" />
            <Text style={styles.mapOfflineText}>SỬ DỤNG BẢN ĐỒ OFFLINE ĐÃ TẢI (250 MB)</Text>
          </TouchableOpacity>

          <View style={styles.statusItems}>
            <View style={styles.statusItem}>
              <Text style={styles.statusKey}>Tín hiệu GPS vệ tinh</Text>
              <View style={[styles.statusValue, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.statusValueText, { color: '#16A34A' }]}>ỔN ĐỊNH (HOẠT ĐỘNG TỐT)</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusKey}>Đồng bộ tự động</Text>
              <View style={[styles.statusValue, { backgroundColor: '#FFFBEB' }]}>
                <Text style={[styles.statusValueText, { color: '#D97706' }]}>CHỜ SÓNG ĐỂ ĐỒNG BỘ...</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Offline tasks ─────────────────────────────────────────────────── */}
        <Text style={styles.offlineTasksTitle}>NHIỆM VỤ ĐANG THỰC HIỆN KHI NGOẠI TUYẾN</Text>
        {OFFLINE_TASKS.map(task => (
          <View key={task.id} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={[styles.taskSub, { color: task.color }]}>{task.sub}</Text>
            </View>
            <View style={styles.taskBarBg}>
              <View style={[styles.taskBarFill, { width: `${task.pct}%`, backgroundColor: task.color }]} />
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>GIAO THỨC ĐIỀU PHỐI NGOẠI TUYẾN · BẢO MẬT v2.4</Text>
        </View>
      </ScrollView>

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
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },

  offlineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RRADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlineBadgeText: { color: '#B45309', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RSPACING.md,
    backgroundColor: '#FEF2F2',
    borderRadius: RRADIUS.md,
    padding: RSPACING.base,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  warningTitle: { color: RCOLORS.primary, fontSize: 13, fontWeight: '800' },
  warningDesc: { color: '#64748B', fontSize: 12, marginTop: 2, lineHeight: 17 },

  mainStatus: {
    backgroundColor: '#FFFFFF',
    borderRadius: RRADIUS.lg,
    padding: RSPACING.base,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  mainStatusTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  mainStatusSub: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  retryButton: {
    backgroundColor: '#1D4ED8',
    height: 44,
    borderRadius: RRADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  featuresRow: { flexDirection: 'row', gap: 12 },
  featureCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: RRADIUS.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  featureValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  featureLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },

  aiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RRADIUS.md,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiLabel: { fontSize: 12, fontWeight: '800', color: '#1D4ED8', letterSpacing: 0.5 },

  mapOfflineButton: {
    backgroundColor: RCOLORS.primary,
    height: 44,
    borderRadius: RRADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapOfflineText: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  statusItems: { gap: 8 },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusKey: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  statusValue: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusValueText: { fontSize: 10, fontWeight: '800' },

  offlineTasksTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginTop: 4 },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RRADIUS.md,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  taskSub: { fontSize: 11, fontWeight: '800' },
  taskBarBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  taskBarFill: { height: '100%', borderRadius: 3 },

  footer: { alignItems: 'center', marginTop: 10 },
  footerText: { fontSize: 10, color: '#94A3B8', fontWeight: '600', letterSpacing: 0.5 },
});

export default RescuerOfflineScreen;
