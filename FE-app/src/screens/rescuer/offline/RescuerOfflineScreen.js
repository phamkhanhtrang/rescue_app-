/**
 * src/screens/rescuer/offline/RescuerOfflineScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Chế độ Ngoại tuyến dành cho Đội cứu trợ (Screen 13).
 *
 * Bố cục Figma:
 *  1. Header dark + OFFLINE MODE badge
 *  2. Warning: "HỆ THỐNG MẤT KẾT NỐI"
 *  3. "CHẾ ĐỘ NGOẠI TUYẾN ĐÃ KÍCH HOẠT" + "THỬ LẠI KẾT NỐI"
 *  4. Features: Lưu trữ tạm (42.8 MB), Số nhớ địa chỉ (123 địa chỉ)
 *  5. SENTINEL AI OFFLINE ANALYSIS: SỬ DỤNG BẢN ĐỒ OFFLINE button
 *  6. Status: Trình trạng GPS (ổn định), Đồng bộ tý động (Đang chờ kết nối)
 *  7. NHIỆM VỤ NẾU NGOẠI TUYẾN: 2 task cards
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, Alert,
} from 'react-native';

import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import CustomModal from '../../../components/common/CustomModal';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';

const OFFLINE_TASKS = [
  { id: 't1', title: 'BAO CÁO TÌNH TRẠNG D4', sub: 'LỰC LÀM GỒI', pct: 62, color: RCOLORS.primary },
  { id: 't2', title: 'KIỂM TRA THIẾT BỊ', sub: 'HOÀN THÀNH (8/12)', pct: 75, color: RCOLORS.statusGreen },
];

const RescuerOfflineScreen = ({ navigation }) => {
  const blink = useRef(new Animated.Value(1)).current;
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1,   duration: 900, useNativeDriver: true }),
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
        title: 'Không thành công',
        message: 'Vẫn chưa có kết nối mạng. Hệ thống tiếp tục ở chế độ ngoại tuyến.',
      });
    }, 2500);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: RCOLORS.bgDark }]}>
      <RescuerHeader dark showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Offline badge ─────────────────────────────────────────────────── */}
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineBadgeText}>📵  CHẾ ĐỘ NGOẠI TUYẾN</Text>
        </View>

        {/* ── Warning banner ────────────────────────────────────────────────── */}
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠</Text>
          <View>
            <Text style={styles.warningTitle}>HỆ THỐNG MẤT KẾT NỐI</Text>
            <Text style={styles.warningDesc}>Đường truyền chính và dự phòng đều ngắt kết nối.</Text>
          </View>
        </View>

        {/* ── Main status ───────────────────────────────────────────────────── */}
        <View style={styles.mainStatus}>
          <Text style={styles.mainStatusTitle}>CHẾ ĐỘ NGOẠI TUYẾN{'\n'}ĐÃ KÍCH HOẠT</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} disabled={retrying}>
            <Animated.Text style={[styles.retryIcon, retrying && { opacity: blink }]}>🔄</Animated.Text>
            <Text style={styles.retryText}>{retrying ? 'ĐANG THỬ...' : 'THỬ LẠI KẾT NỐI'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <View style={styles.featuresRow}>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>💾</Text>
            <Text style={styles.featureValue}>42.8 MB</Text>
            <Text style={styles.featureLabel}>LƯU TRỮ TẠM</Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>📍</Text>
            <Text style={styles.featureValue}>123</Text>
            <Text style={styles.featureLabel}>SỐ NHỚ ĐỊA CHỈ</Text>
          </View>
        </View>

        {/* ── AI Offline analysis ───────────────────────────────────────────── */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiIcon}>🤖</Text>
            <Text style={styles.aiLabel}>PHÂN TÍCH SENTINEL AI NGOẠI TUYẾN</Text>
          </View>
          <TouchableOpacity style={styles.mapOfflineButton}>
            <Text style={styles.mapOfflineText}>⚠ SỬ DỤNG BẢN ĐỒ OFFLINE (60 GB)</Text>
          </TouchableOpacity>
          <View style={styles.statusItems}>
            <View style={styles.statusItem}>
              <Text style={styles.statusKey}>Tình trạng GPS</Text>
              <View style={[styles.statusValue, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[styles.statusValueText, { color: RCOLORS.statusGreen }]}>ỔN ĐỊNH (PHỤ THUỘC 6H)</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusKey}>Đồng bộ tự động</Text>
              <View style={[styles.statusValue, { backgroundColor: '#FFF3E0' }]}>
                <Text style={[styles.statusValueText, { color: RCOLORS.statusOrange }]}>ĐANG CHỜ KẾT NỐI...</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Offline tasks ─────────────────────────────────────────────────── */}
        <Text style={styles.offlineTasksTitle}>NHIỆM VỤ KHI NGOẠI TUYẾN</Text>
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

        {/* Footer note */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>GIAO THỨC NGOẠI TUYẾN BẢO MẬT SENTINEL v2.1</Text>
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
  safe: { flex: 1 },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 40, gap: RSPACING.md },

  offlineBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: RRADIUS.full },
  offlineBadgeText: { color: RCOLORS.textWhite, fontSize: RFONTS.xs, fontWeight: RFONTS.bold, letterSpacing: 0.5 },

  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.md, backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.md, padding: RSPACING.base },
  warningIcon: { fontSize: 28 },
  warningTitle: { color: '#FFF', fontSize: RFONTS.base, fontWeight: RFONTS.black },
  warningDesc: { color: 'rgba(255,255,255,0.8)', fontSize: RFONTS.sm, marginTop: 2 },

  mainStatus: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md, alignItems: 'flex-start' },
  mainStatusTitle: { fontSize: RFONTS.xxl, fontWeight: RFONTS.black, color: RCOLORS.textWhite, lineHeight: 34 },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: RSPACING.sm, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: RRADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  retryIcon: { fontSize: 18 },
  retryText: { color: RCOLORS.textWhite, fontSize: RFONTS.sm, fontWeight: RFONTS.bold },

  featuresRow: { flexDirection: 'row', gap: RSPACING.md },
  featureCard: { flex: 1, backgroundColor: RCOLORS.bgNavyLight, borderRadius: RRADIUS.md, padding: RSPACING.base, alignItems: 'center', gap: RSPACING.xs },
  featureIcon: { fontSize: 28 },
  featureValue: { fontSize: RFONTS.xl, fontWeight: RFONTS.black, color: RCOLORS.textWhite },
  featureLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },

  aiCard: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.lg, padding: RSPACING.base, gap: RSPACING.md },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiIcon: { fontSize: 14 },
  aiLabel: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8 },
  mapOfflineButton: { backgroundColor: RCOLORS.primary, borderRadius: RRADIUS.sm, paddingVertical: RSPACING.sm, alignItems: 'center', ...RSHADOWS.redGlow },
  mapOfflineText: { color: '#FFF', fontSize: RFONTS.sm, fontWeight: RFONTS.black },
  statusItems: { gap: RSPACING.sm },
  statusItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusKey: { fontSize: RFONTS.sm, color: 'rgba(255,255,255,0.7)' },
  statusValue: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RRADIUS.full },
  statusValueText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold },

  offlineTasksTitle: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },
  taskCard: { backgroundColor: RCOLORS.bgNavyLight, borderRadius: RRADIUS.md, padding: RSPACING.base, gap: RSPACING.md },
  taskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskTitle: { fontSize: RFONTS.sm, fontWeight: RFONTS.bold, color: RCOLORS.textWhite },
  taskSub: { fontSize: RFONTS.xs, fontWeight: RFONTS.semiBold },
  taskBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: RRADIUS.full, overflow: 'hidden' },
  taskBarFill: { height: '100%', borderRadius: RRADIUS.full },

  footer: { alignItems: 'center' },
  footerText: { fontSize: RFONTS.xs, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 },
});

export default RescuerOfflineScreen;
