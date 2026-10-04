/**
 * src/screens/citizen/history/HistoryScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình Lịch sử tín hiệu — "Signal History" (Guardian Logs).
 *
 * Bố cục từ Figma:
 *  1. Header SENTINEL
 *  2. "GUARDIAN LOGS" label + "Signal History" title + mô tả
 *  3. Danh sách SOS log cards:
 *     - Tiêu đề + badge (ACTIVE THREAD / RESOLVED)
 *     - Ngày giờ
 *     - Zone Snapshot: STATUS, HAZARDS
 *     - Blockchain Receipt hash
 *     - NODE VERIFIED badge
 *  4. AI Guardian Insight card (teal)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../services/api';
import { BASE_URL } from '../../../services/apiClient';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';

const HistoryScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    if (!userInfo?.id) {
      setLoading(false);
      setRefreshing(false);
      setError('Không tìm thấy thông tin tài khoản để tải lịch sử SOS.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      // Gọi API với tham số lọc citizen theo ID của người dùng hiện tại
      const response = await API.sos.getAll({ citizen: userInfo.id });
      
      const formattedLogs = (response.results || []).map(item => ({
        id: item.id.toString(),
        type: item.signal_type, 
        title: item.emergency_type === 'MEDICAL' ? 'Cấp cứu Y tế' : 
               item.emergency_type === 'CRIME' ? 'Báo động Tội phạm' : 'Kích hoạt SOS Khẩn cấp',
        status: formatStatus(item.status),
        statusColor: getStatusColor(item.status),
        datetime: formatDateTime(item.sent_at),
        zone: item.zone_name || 'Vùng cứu hộ',
        hazards: item.description || 'Yêu cầu trợ giúp đã gửi',
        note: item.note,
        images: item.images,
      }));

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Lỗi lấy lịch sử SOS:', error);
      setError(error.message || 'Không thể tải lịch sử SOS.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userInfo?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatStatus = (status) => {
    const map = {
      'PENDING': 'ĐANG CHỜ',
      'ACTIVE': 'ĐANG XỬ LÝ',
      'RESOLVED': 'ĐÃ XỬ LÝ',
      'CANCELLED': 'ĐÃ HỦY',
    };
    return map[status] || status;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return COLORS.primary;
      case 'RESOLVED': return COLORS.statusGreen;
      case 'CANCELLED': return COLORS.textHint;
      default: return COLORS.secondary;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return `${d.getDate()} THÁNG ${d.getMonth() + 1}, ${d.getFullYear()} • ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >

        {/* ─── 1. Section header ──────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.guardianLabel}>NHẬT KÝ BẢO VỆ</Text>
          <Text style={styles.pageTitle}>Lịch sử Tín hiệu</Text>
          <Text style={styles.pageDesc}>
            Theo dõi các yêu cầu SOS, hình ảnh hiện trường và trạng thái xử lý được cập nhật từ trung tâm điều phối.
          </Text>
        </View>

        {/* ─── 2. Log entries ─────────────────────────────────────────────── */}
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.fullReportButton} onPress={fetchHistory}>
              <Text style={styles.fullReportText}>THỬ LẠI</Text>
            </TouchableOpacity>
          </View>
        ) : logs.length > 0 ? (
          logs.map((entry) => (
            <LogCard
              key={entry.id}
              entry={entry}
              onPress={() => navigation.navigate('SOSTrackingScreen', { sosId: entry.id })}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Chưa có tín hiệu nào được ghi lại.</Text>
          </View>
        )}

        {/* ─── 3. Hướng dẫn theo dõi ─────────────────────────────────────── */}
        <View style={styles.aiInsightCard}>
          <View style={styles.aiInsightHeader}>
            <Text style={styles.aiInsightIcon}>📍</Text>
            <Text style={styles.aiInsightLabel}>THEO DÕI YÊU CẦU</Text>
          </View>
          <Text style={styles.aiInsightTitle}>
            Mở một yêu cầu để xem tiến độ
          </Text>
          <Text style={styles.aiInsightText}>
            Trạng thái xác minh, phân công và thực hiện nhiệm vụ sẽ được cập nhật trong từng yêu cầu SOS.
          </Text>
        </View>


      </ScrollView>
    </SafeAreaView>
  );
};

// ─── LogCard Component ────────────────────────────────────────────────────────

const LogCard = ({ entry, onPress }) => (
  <TouchableOpacity
    style={[styles.logCard, { borderLeftColor: entry.statusColor }]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    {/* Header */}
    <View style={styles.logHeader}>
      <View style={styles.logIconBox}>
        <Text style={styles.logIcon}>{entry.type === 'SOS' ? '🚨' : '⚡'}</Text>
      </View>
      <View style={styles.logTitleBox}>
        <Text style={styles.logTitle}>{entry.title}</Text>
        <Text style={styles.logDatetime}>{entry.datetime}</Text>
      </View>
      <View style={[styles.logBadge, { backgroundColor: entry.statusColor + '1A' }]}>
        <Text style={[styles.logBadgeText, { color: entry.statusColor }]}>
          {entry.status}
        </Text>
      </View>
    </View>

    {/* Zone Snapshot */}
    <View style={styles.logSnapshot}>
      <Text style={styles.logSnapshotLabel}>⊙ HÌNH ẢNH KHU VỰC</Text>
      {/* hiện ảnh */}
      {entry.images && entry.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {entry.images.map((img, index) => {
            // Xử lý URL ảnh: Nếu là đường dẫn tương đối từ Django, thêm BASE_URL
            const imageUrl = img.image.startsWith('http') 
              ? img.image 
              : `${BASE_URL}${img.image}`;
              
            return (
              <Image 
                key={img.id || index}
                source={{ uri: imageUrl }}
                style={styles.evidenceImage}
                resizeMode="cover"
              />
            );
          })}
        </ScrollView>
      )}
      <View style={styles.logSnapshotRow}>
        <View style={styles.logSnapshotItem}>
          <Text style={styles.logSnapshotKey}>TRẠNG THÁI</Text>
          <Text style={styles.logSnapshotVal}>{entry.zone}</Text>
        </View>
        <View style={styles.logSnapshotItem}>
          <Text style={styles.logSnapshotKey}>MỐI NGUY</Text>
          <Text style={styles.logSnapshotVal}>{entry.hazards}</Text>
        </View>
        
      </View>
      <View style={styles.logSnapshot}>
          <Text style={styles.logSnapshotKey}>Ghi chú</Text>
          <Text style={styles.logSnapshotVal}>{entry.note}</Text>
        </View>
    </View>

    {/* Blockchain receipt */}
    {/* <View style={styles.logBlockchain}>
      <Text style={styles.logBlockchainLabel}>⛓ BIÊN LAI BLOCKCHAIN</Text>
      <Text style={styles.logBlockchainHash}>{entry.blockchainHash}</Text>
      {entry.nodeVerified && (
        <View style={styles.nodeVerified}>
          <Text style={styles.nodeVerifiedText}>✓ ĐÃ XÁC THỰC NÚT</Text>
        </View>
      )}
    </View> */}
  </TouchableOpacity>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 32,
    gap: SPACING.base,
  },

  // ── Section header ─────────────────────────────
  sectionHeader: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  guardianLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  pageTitle: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.black,
    color: COLORS.textPrimary,
  },
  pageDesc: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // ── Log card ───────────────────────────────────
  logCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    borderLeftWidth: 4,
    padding: SPACING.base,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  logIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logIcon: { fontSize: 18 },
  logTitleBox: { flex: 1 },
  logTitle: {
    fontSize: FONTS.base,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
  },
  logDatetime: {
    fontSize: FONTS.xs,
    color: COLORS.textHint,
    marginTop: 2,
  },
  logBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  logBadgeText: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    letterSpacing: 0.3,
  },

  // ── Zone snapshot ──────────────────────────────
  logSnapshot: {
    backgroundColor: COLORS.bgLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  logSnapshotLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  logSnapshotRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  logSnapshotItem: {
    gap: 2,
  },
  logSnapshotKey: {
    fontSize: FONTS.xs,
    color: COLORS.textHint,
    fontWeight: FONTS.semiBold,
    letterSpacing: 0.5,
  },
  logSnapshotVal: {
    fontSize: FONTS.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.medium,
  },
  imageScroll: {
    marginTop: SPACING.xs,
  },
  evidenceImage: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    marginRight: SPACING.sm,
  },

  // ── Blockchain ─────────────────────────────────
  logBlockchain: {
    gap: SPACING.xs,
  },
  logBlockchainLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.bold,
    letterSpacing: 0.8,
  },
  logBlockchainHash: {
    fontSize: FONTS.sm,
    color: COLORS.blockchain,
    fontWeight: FONTS.medium,
    fontVariant: ['tabular-nums'],
  },
  nodeVerified: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  nodeVerifiedText: {
    fontSize: FONTS.xs,
    color: COLORS.statusGreen,
    fontWeight: FONTS.bold,
  },

  // ── AI Insight card ────────────────────────────
  aiInsightCard: {
    backgroundColor: COLORS.bgTeal,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiInsightIcon: { fontSize: 14 },
  aiInsightLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1,
  },
  aiInsightTitle: {
    fontSize: FONTS.base,
    fontWeight: FONTS.bold,
    color: COLORS.textWhite,
  },
  aiInsightText: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
  fullReportButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  fullReportText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.textHint,
    fontSize: FONTS.sm,
  },
});

export default HistoryScreen;
