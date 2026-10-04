/**
 * src/screens/citizen/home/HomeScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Màn hình chính của Người dân (Tab HOME).
 *
 * Cải tiến UX/UI:
 *  1. Top Map Card: Bố cục đẹp mắt, tích hợp status live, nút mở bản đồ an toàn
 *  2. Nút SOS: Thiết kế nổi bật, hỗ trợ cả nhấn trực tiếp hoặc giữ 3s đếm ngược
 *  3. Thống kê & Quick Access: Trạm cứu hộ gần nhất, Cảnh báo mưa lũ
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Platform, Dimensions,
  Linking, ActivityIndicator, Modal, RefreshControl
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../../../components/common/AppMap';
import * as Location from 'expo-location';

import SentinelHeader from '../../../components/citizen/common/SentinelHeader';
import SOSButton from '../../../components/citizen/home/SOSButton';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, LAYOUT } from '../../../constants/citizen/theme';
import API from '../../../services/api';

const { width } = Dimensions.get('window');

const PLATFORM_CONFIG = {
  VNEXPRESS: { label: 'VnExpress', color: '#991B1B', bg: '#FEE2E2', border: '#FECACA' },
  TUOITRE:   { label: 'Tuổi Trẻ',  color: '#B91C1C', bg: '#FEE2E2', border: '#FECACA' },
  THANHNIEN: { label: 'Thanh Niên', color: '#1D4ED8', bg: '#DBEAFE', border: '#BFDBFE' },
  DANTRI:    { label: 'Dân Trí',   color: '#047857', bg: '#D1FAE5', border: '#A7F3D0' },
  GDACS:     { label: 'GDACS',     color: '#C2410C', bg: '#FFEDD5', border: '#FED7AA' },
};

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'Khẩn cấp', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: '🚨' },
  HIGH:     { label: 'Nguy cơ cao', color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5', icon: '⚠️' },
  MEDIUM:   { label: 'Theo dõi', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD', icon: 'ℹ️' },
  LOW:      { label: 'Thông tin', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0', icon: '📋' },
};

const formatNewsTime = (dateStr) => {
  if (!dateStr) return 'Mới cập nhật';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Mới cập nhật';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Mới cập nhật';
  }
};

const mapDarkStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

const HomeScreen = ({ navigation }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [newsList, setNewsList] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setNewsLoading(true);
      const res = await API.news.getPublished({ limit: 20 });
      if (res && res.results) {
        setNewsList(res.results);
      }
    } catch (e) {
      console.log('Error fetching published news:', e);
    } finally {
      setNewsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNews();
  }, []);

  const handleSOS = () => {
    navigation.navigate('SOSScreen');
  };


  return (
    <SafeAreaView style={styles.safe}>
      <SentinelHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ─── 1. GPS Safety Status Card ──────────────────────────────────── */}
        <View style={styles.safetyStatusCard}>
          <View style={styles.safetyCardLeft}>
            <View style={styles.statusLiveBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.statusLiveText}>HỆ THỐNG TRỰC CHIẾN 24/7</Text>
            </View>
            <Text style={styles.safetyLocationText} numberOfLines={1}>
              {userLocation ? '📍 Vị trí GPS: Đã xác định & sẵn sàng' : '📡 Đang tìm kiếm tín hiệu GPS...'}
            </Text>
            <Text style={styles.safetySubtitle}>Kết nối trực tiếp tới Trung tâm Điều phối Cứu nạn</Text>
          </View>
          <TouchableOpacity
            style={styles.openMapActionBtn}
            onPress={() => navigation.navigate('MapTab')}
            activeOpacity={0.8}
          >
            <Text style={styles.openMapActionText}>Bản đồ ↗</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 2. Hero SOS Section ────────────────────────────────────────── */}
        <View style={styles.heroSosSection}>
          <View style={styles.sosPromptWrap}>
            <Text style={styles.sosPromptTitle}>BẠN ĐANG CẦN CỨU TRỢ?</Text>
            <Text style={styles.sosPromptDesc}>
              Nhấn giữ nút tròn 3 giây hoặc chạm liên kết bên dưới để gửi tọa độ khẩn cấp.
            </Text>
          </View>

          <View style={styles.sosCircleContainer}>
            <SOSButton onPress={handleSOS} countdownSec={3} />
          </View>

          <TouchableOpacity
            style={styles.directSosLink}
            onPress={handleSOS}
            activeOpacity={0.7}
          >
            <Text style={styles.directSosLinkText}>⚡ Chạm gửi SOS ngay lập tức (Không cần đợi 3s)</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 3. Quick Actions 4-Grid (2x2) ─────────────────────────────── */}
        <View style={styles.quickSectionHeader}>
          <Text style={styles.sectionHeading}>TRUY CẬP NHANH</Text>
        </View>

        <View style={styles.quickGridContainer}>
          {/* Tile 1: Bản đồ */}
          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => navigation.navigate('MapTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIconBox, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.tileEmoji}>🗺️</Text>
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Bản đồ Cứu hộ</Text>
              <Text style={styles.tileSub}>Vùng ngập & Đội cứu hộ</Text>
            </View>
          </TouchableOpacity>

          {/* Tile 2: Lịch sử SOS */}
          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => navigation.navigate('SOSRequestsScreen')}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIconBox, { backgroundColor: '#FFEBEE' }]}>
              <Text style={styles.tileEmoji}>📋</Text>
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Lịch sử SOS</Text>
              <Text style={styles.tileSub}>Trạng thái yêu cầu</Text>
            </View>
          </TouchableOpacity>

          {/* Tile 3: Hồ sơ Y tế */}
          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => navigation.navigate('ProfileTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIconBox, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.tileEmoji}>👤</Text>
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Hồ sơ Y tế</Text>
              <Text style={styles.tileSub}>Bệnh nền & Người thân</Text>
            </View>
          </TouchableOpacity>

          {/* Tile 4: Tin Cảnh báo */}
          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => navigation.navigate('AlertsTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIconBox, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.tileEmoji}>📢</Text>
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Cảnh báo Bão lũ</Text>
              <Text style={styles.tileSub}>Tin từ Ban chỉ huy</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── 5. Disaster & Relief News Feed ─────────────────────────── */}
        <View style={styles.newsHeaderRow}>
          <Text style={styles.sectionHeading}>BẢN TIN BÁO CHÍ THIÊN TAI</Text>
          <View style={styles.newsTag}>
            <Text style={styles.newsTagText}>CHÍNH THỐNG</Text>
          </View>
        </View>

        {newsLoading && newsList.length === 0 ? (
          <View style={styles.newsLoadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.newsLoadingText}>Đang cập nhật tin tức báo chí...</Text>
          </View>
        ) : newsList.length === 0 ? (
          <View style={styles.newsEmptyCard}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>🗞️</Text>
            <Text style={styles.newsEmptyTitle}>Chưa có bản tin mới</Text>
            <Text style={styles.newsEmptySub}>
              Tin tức cứu trợ và thiên tai chính thống từ báo chí sẽ hiển thị tại đây.
            </Text>
          </View>
        ) : (
          <View style={styles.newsList}>
            {newsList.map((item) => {
              const platformKey = (item.source_platform || '').toUpperCase();
              const plt = PLATFORM_CONFIG[platformKey] || { label: item.source_platform || 'BÁO CHÍ', color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE' };
              const sevKey = (item.severity || item.extracted_severity || 'LOW').toUpperCase();
              const sev = SEVERITY_CONFIG[sevKey] || SEVERITY_CONFIG.LOW;
              const title = item.title || item.raw_title || 'Bản tin thiên tai';
              const summary = item.summary || item.raw_content;
              const location = item.location || item.extracted_location;
              const incident = item.incident_type || item.extracted_incident_type;
              const timeStr = formatNewsTime(item.published_at || item.crawled_at);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.newsCard}
                  activeOpacity={0.85}
                  onPress={() => setSelectedNews(item)}
                >
                  {/* Header: Nguồn + Mức độ + Thời gian */}
                  <View style={styles.newsCardHeader}>
                    <View style={[styles.newsSourceBadge, { backgroundColor: plt.bg, borderColor: plt.border }]}>
                      <Text style={[styles.newsSourceText, { color: plt.color }]}>{plt.label}</Text>
                    </View>

                    <View style={styles.newsHeaderRight}>
                      {sevKey !== 'LOW' && (
                        <View style={[styles.newsSevBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
                          <Text style={[styles.newsSevText, { color: sev.color }]}>
                            {sev.icon} {sev.label}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.newsTime}>{timeStr}</Text>
                    </View>
                  </View>

                  {/* Tiêu đề bài viết */}
                  <Text style={styles.newsCardTitle} numberOfLines={2}>
                    {title}
                  </Text>

                  {/* Thông tin trích xuất: Địa bàn & Loại sự cố */}
                  {(location || incident) ? (
                    <View style={styles.newsMetaRow}>
                      {location ? (
                        <View style={styles.newsMetaChip}>
                          <Text style={styles.newsMetaChipIcon}>📍</Text>
                          <Text style={styles.newsMetaChipText} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                      ) : null}
                      {incident ? (
                        <View style={styles.newsMetaChip}>
                          <Text style={styles.newsMetaChipIcon}>🌊</Text>
                          <Text style={styles.newsMetaChipText} numberOfLines={1}>
                            {incident}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Tóm tắt / Đoạn trích bài báo */}
                  {summary ? (
                    <Text style={styles.newsCardSummary} numberOfLines={2}>
                      {summary}
                    </Text>
                  ) : null}

                  {/* Footer: Xem toàn văn & Mở link báo gốc */}
                  <View style={styles.newsCardFooter}>
                    <Text style={styles.newsReadDetailText}>📖 Xem toàn văn bài viết ›</Text>
                    {(item.source_url || item.url) ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          const target = item.source_url || item.url;
                          if (target) Linking.openURL(target).catch(() => {});
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.newsReadMore}>Báo gốc ↗</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ─── Modal Đọc Toàn Văn Bài Báo (In-App Reader) ────────────────── */}
      <Modal
        visible={!!selectedNews}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedNews(null)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSafeContainer}>
            <View style={styles.modalCard}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  {(() => {
                    const pltKey = (selectedNews?.source_platform || '').toUpperCase();
                    const plt = PLATFORM_CONFIG[pltKey] || { label: selectedNews?.source_platform || 'BÁO CHÍ', color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE' };
                    return (
                      <View style={[styles.newsSourceBadge, { backgroundColor: plt.bg, borderColor: plt.border }]}>
                        <Text style={[styles.newsSourceText, { color: plt.color }]}>{plt.label}</Text>
                      </View>
                    );
                  })()}
                  <Text style={styles.modalTimeText}>
                    {formatNewsTime(selectedNews?.published_at || selectedNews?.crawled_at)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedNews(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Modal Content Scroll */}
              <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={true}>
                {/* Title */}
                <Text style={styles.modalArticleTitle}>
                  {selectedNews?.title || selectedNews?.raw_title || 'Bản tin thiên tai'}
                </Text>

                {/* Metadata Tags */}
                <View style={styles.modalTagsRow}>
                  {(selectedNews?.location || selectedNews?.extracted_location) ? (
                    <View style={styles.modalTagChip}>
                      <Text style={styles.modalTagChipText}>
                        📍 {selectedNews?.location || selectedNews?.extracted_location}
                      </Text>
                    </View>
                  ) : null}

                  {(selectedNews?.incident_type || selectedNews?.extracted_incident_type) ? (
                    <View style={styles.modalTagChip}>
                      <Text style={styles.modalTagChipText}>
                        🌊 {selectedNews?.incident_type || selectedNews?.extracted_incident_type}
                      </Text>
                    </View>
                  ) : null}

                  {(() => {
                    const sKey = (selectedNews?.severity || selectedNews?.extracted_severity || 'LOW').toUpperCase();
                    const sev = SEVERITY_CONFIG[sKey] || SEVERITY_CONFIG.LOW;
                    return (
                      <View style={[styles.modalTagChip, { backgroundColor: sev.bg, borderColor: sev.border }]}>
                        <Text style={[styles.modalTagChipText, { color: sev.color, fontWeight: '700' }]}>
                          {sev.icon} {sev.label}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                <View style={styles.modalDivider} />

                {/* Article Body Content */}
                <Text style={styles.modalBodyText}>
                  {selectedNews?.content || selectedNews?.raw_content || selectedNews?.summary || 'Không có nội dung mở rộng.'}
                </Text>

                {/* Source link info */}
                {(selectedNews?.source_url || selectedNews?.url) ? (
                  <View style={styles.modalSourceBox}>
                    <Text style={styles.modalSourceLabel}>Đường dẫn bài báo gốc:</Text>
                    <Text style={styles.modalSourceUrl} numberOfLines={1}>
                      {selectedNews?.source_url || selectedNews?.url}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                {(selectedNews?.source_url || selectedNews?.url) ? (
                  <TouchableOpacity
                    style={styles.modalOpenWebBtn}
                    onPress={() => {
                      const target = selectedNews?.source_url || selectedNews?.url;
                      if (target) Linking.openURL(target).catch(() => {});
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modalOpenWebText}>Đọc trên báo gốc ↗</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.modalDismissBtn}
                  onPress={() => setSelectedNews(null)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalDismissText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: LAYOUT.screenPadding,
    paddingBottom: 28,
    gap: SPACING.md,
  },

  // ── Safety Status Card ─────────────────────────
  safetyStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  safetyCardLeft: {
    flex: 1,
    gap: 4,
    marginRight: 10,
  },
  statusLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.8,
  },
  safetyLocationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  safetySubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  openMapActionBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  openMapActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },

  // ── Hero SOS Section ───────────────────────────
  heroSosSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...SHADOWS.card,
  },
  sosPromptWrap: {
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.md,
  },
  sosPromptTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  sosPromptDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  sosCircleContainer: {
    paddingVertical: 6,
  },
  directSosLink: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  directSosLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },

  // ── Quick 4-Grid ───────────────────────────────
  quickSectionHeader: {
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
  },
  quickGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickTile: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...SHADOWS.card,
  },
  tileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmoji: {
    fontSize: 18,
  },
  tileTextWrap: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  tileSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },

  // ── News Feed ──────────────────────────────────
  newsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  newsTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  newsTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  newsList: {
    gap: 12,
  },
  newsCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
    gap: 8,
  },
  newsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  newsSourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  newsSourceText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  newsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newsSevBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  newsSevText: {
    fontSize: 9,
    fontWeight: '700',
  },
  newsTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  newsCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  newsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  newsMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 4,
  },
  newsMetaChipIcon: {
    fontSize: 10,
  },
  newsMetaChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  newsCardSummary: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  newsCardFooter: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsReadDetailText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  newsReadMore: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  newsLoadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  newsLoadingText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  newsEmptyCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  newsEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  newsEmptySub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // ── News Detail Modal ──────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSafeContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    ...SHADOWS.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTimeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  modalBodyScroll: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalArticleTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
  },
  modalTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  modalTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modalTagChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  modalBodyText: {
    fontSize: 14,
    lineHeight: 23,
    color: '#334155',
    fontWeight: '400',
  },
  modalSourceBox: {
    marginTop: 18,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  modalSourceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSourceUrl: {
    fontSize: 11,
    color: '#2563EB',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalOpenWebBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalOpenWebText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalDismissBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  modalDismissText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default HomeScreen;
