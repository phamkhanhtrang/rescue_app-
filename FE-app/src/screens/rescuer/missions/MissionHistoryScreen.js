/**
 * src/screens/rescuer/missions/MissionHistoryScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lịch sử Nhiệm vụ (Screen 12).
 *
 * Bố cục Figma:
 *  1. Header + "HỆ THỐNG LƯU TRẠNG THÁI XÁC THỰC" badge
 *  2. "Lịch sử nhiệm vụ" title
 *  3. Stats: TỶ LỆ THÀNH CÔNG 98.2%, SỐ LƯỢNG NHIỆM VỤ 1,024, TỔNG SỐ NGƯỜI 142
 *  4. Mission cards: ảnh + zone info + status badge (HOÀN THÀNH / ĐỘ GUY BỔ)
 *  5. "XEM THÊM HỒ SƠ CŨ" button
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import RescuerHeader from '../../../components/rescuer/common/RescuerHeader';
import { RCOLORS, RFONTS, RSPACING, RRADIUS, RSHADOWS, RLAYOUT } from '../../../constants/rescuer/theme';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const MissionHistoryScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Lấy lịch sử nhiệm vụ theo id cứu hộ viên
        const res = await API.missions.getAll({ rescuer_id: userInfo?.id });
        setMissions(res.results || []);
      } catch (err) {
        console.error('Fetch mission history error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [userInfo?.id]);

  const completedCount = missions.filter(m => m.status === 'COMPLETED').length;
  const successRate = missions.length > 0 ? ((completedCount / missions.length) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <RescuerHeader showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={RCOLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <RescuerHeader showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Badge */}
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedIcon}>⛓</Text>
          <Text style={styles.verifiedText}>HỆ THỐNG LƯU TRẠNG THÁI XÁC THỰC</Text>
        </View>

        <Text style={styles.pageTitle}>Lịch sử nhiệm vụ</Text>
        <Text style={styles.pageDesc}>Dữ liệu lưu trữ các hoạt động cứu hộ và tuần tra được mã hóa trên hệ thống Sentinel.</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TỶ LỆ THÀNH CÔNG</Text>
            <Text style={[styles.statValue, { color: RCOLORS.statusGreen }]}>{successRate}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SỐ LƯỢNG NV</Text>
            <Text style={styles.statValue}>{missions.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>HOÀN THÀNH</Text>
            <Text style={[styles.statValue, { color: RCOLORS.bgBlue }]}>{completedCount}</Text>
          </View>
        </View>

        {/* Mission cards */}
        {missions.length > 0 ? missions.map(log => {
          const statusColor = log.status === 'COMPLETED' ? RCOLORS.statusGreen : (log.status === 'CANCELLED' ? RCOLORS.statusOrange : RCOLORS.primary);
          const statusText = log.status === 'COMPLETED' ? 'HOÀN THÀNH' : (log.status === 'CANCELLED' ? 'ĐÃ HỦY' : 'ĐANG CHẠY');
          
          return (
            <TouchableOpacity 
              key={log.id} 
              style={styles.logCard}
              onPress={() => navigation.navigate('ActiveMissionScreen', { zoneId: log.zone, zoneName: log.zone_name })}
            >
              {/* Header/Emoji */}
              <View style={styles.logMeta}>
                <Text style={styles.logZone}>{log.zone_name || `VÙNG ID: ${log.zone?.substring(0, 8)}`}</Text>
                <Text style={styles.logMissionId}>• {log.id.substring(0, 8).toUpperCase()}</Text>
              </View>

              {/* Title + desc */}
              <Text style={styles.logTitle}>Vai trò: {log.role || 'Cứu hộ viên'}</Text>
              <Text style={styles.logDesc} numberOfLines={2}>
                Tham gia hỗ trợ tại khu vực sự cố. Toàn bộ nhật ký hoạt động đã được ghi nhận.
              </Text>

              {/* Footer */}
              <View style={styles.logFooter}>
                <Text style={styles.logDate}>{new Date(log.joined_at).toLocaleDateString('vi-VN')}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: RCOLORS.textSecondary }}>Bạn chưa tham gia nhiệm vụ nào.</Text>
          </View>
        )}

        {/* Load more */}
        {missions.length > 5 && (
          <TouchableOpacity style={styles.loadMoreButton}>
            <Text style={styles.loadMoreText}>XEM THÊM HỒ SƠ CŨ</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RCOLORS.bgApp },
  content: { padding: RLAYOUT.screenPadding, paddingBottom: 32, gap: RSPACING.md },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E3F2FD', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  verifiedIcon: { fontSize: 12 },
  verifiedText: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.bgBlue },
  pageTitle: { fontSize: RFONTS.xxl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  pageDesc: { fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: RSPACING.md },
  statBox: { flex: 1, backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.md, padding: RSPACING.md, alignItems: 'center', gap: RSPACING.xs, ...RSHADOWS.card },
  statLabel: { fontSize: RFONTS.xs - 1, fontWeight: RFONTS.bold, color: RCOLORS.textSecondary, letterSpacing: 0.5, textAlign: 'center' },
  statValue: { fontSize: RFONTS.xl, fontWeight: RFONTS.black, color: RCOLORS.textPrimary },
  logCard: { backgroundColor: RCOLORS.bgWhite, borderRadius: RRADIUS.lg, overflow: 'hidden', ...RSHADOWS.card },
  logImage: { height: 140, backgroundColor: '#2C3E50', alignItems: 'center', justifyContent: 'center' },
  logImageEmoji: { fontSize: 60 },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: RSPACING.base, paddingTop: RSPACING.md },
  logZone: { fontSize: RFONTS.xs, fontWeight: RFONTS.bold, color: RCOLORS.bgBlue },
  logMissionId: { fontSize: RFONTS.xs, color: RCOLORS.textHint },
  logTitle: { paddingHorizontal: RSPACING.base, fontSize: RFONTS.base, fontWeight: RFONTS.bold, color: RCOLORS.textPrimary },
  logDesc: { paddingHorizontal: RSPACING.base, fontSize: RFONTS.sm, color: RCOLORS.textSecondary, lineHeight: 18 },
  logFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: RSPACING.base, borderTopWidth: 1, borderTopColor: RCOLORS.border, marginTop: RSPACING.sm },
  logDate: { fontSize: RFONTS.xs, color: RCOLORS.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RRADIUS.full },
  statusText: { fontSize: RFONTS.xs, fontWeight: RFONTS.black },
  loadMoreButton: { backgroundColor: RCOLORS.bgNavy, borderRadius: RRADIUS.md, paddingVertical: RSPACING.base, alignItems: 'center' },
  loadMoreText: { color: RCOLORS.textWhite, fontSize: RFONTS.sm, fontWeight: RFONTS.bold, letterSpacing: 0.5 },
});

export default MissionHistoryScreen;
