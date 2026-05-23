/**
 * src/components/citizen/alerts/AlertCard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Card hiển thị một cảnh báo trong AlertsScreen (The Guardian Pulse).
 *
 * Props:
 *   severity    - 'critical' | 'warning' | 'info' | 'rescue'
 *   category    - Text loại cảnh báo (vd: "FLASH FLOOD")
 *   title       - Tiêu đề cảnh báo
 *   description - Mô tả ngắn
 *   timeAgo     - Thời gian (vd: "2m ago")
 *   hasRoute    - Có nút "GET ROUTE" không (default: false)
 *   onPress     - Callback khi nhấn card
 *   onRoute     - Callback khi nhấn GET ROUTE
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../constants/citizen/theme';

import API from '../../../services/api';

// Cấu hình màu theo severity
const SEVERITY_CONFIG = {
  emergency: {
    accent:    COLORS.primary,
    badgeBg:   '#FFEBEE',
    badgeText: COLORS.primary,
    label:     'Khẩn cấp',
  },
  warning: {
    accent:    COLORS.statusOrange,
    badgeBg:   '#FFF3E0',
    badgeText: COLORS.statusOrange,
    label:     'Cảnh báo',
  },
  notification: {
    accent:    COLORS.statusBlue,
    badgeBg:   '#E3F2FD',
    badgeText: COLORS.statusBlue,
    label:     'Thông báo',
  },
};

const SOURCE_BADGES = {
  AUTHORITY: 'CƠ QUAN CHỨC NĂNG',
  AI: 'AI VERIFIED',
  SYSTEM: 'HỆ THỐNG',
  COMMUNITY: 'CỘNG ĐỒNG'
};

const AlertCard = ({
  alert,
  onPress,
  onRoute,
  onVoteSuccess
}) => {
  if (!alert) return null;
  const { id, severity = 'info', category, title, description, source, created_at, hasRoute, verified } = alert;

  const cfg = SEVERITY_CONFIG[(severity || '').toLowerCase()] || SEVERITY_CONFIG.notification || { accent: COLORS.statusBlue };

  // Format time (simple mockup)
  const timeStr = created_at ? new Date(created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong';

  const handleVote = async (verdict) => {
    try {
      const payload = {
        user: 'd9b2d63d-a233-4123-8472-1234567890ab', // Mock UUID for now
        verdict: verdict
      };
      await API.alerts.vote(id, payload);
      Alert.alert('Thành công', 'Đã ghi nhận phản hồi!');
      if (onVoteSuccess) onVoteSuccess();
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Lỗi khi vote');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: cfg.accent }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
            <Text style={styles.badgeIcon}>{cfg.icon}</Text>
            <Text style={[styles.badgeLabel, { color: cfg.badgeText }]}>
              {cfg.label}
            </Text>
          </View>
          {source && (
            <View style={[styles.badge, { backgroundColor: '#E0E0E0' }]}>
              <Text style={[styles.badgeLabel, { color: '#424242' }]}>
                {SOURCE_BADGES[source] || source}
              </Text>
            </View>
          )}
          {category ? (
            <Text style={styles.category}>• {category}</Text>
          ) : null}
        </View>
        <Text style={styles.timeAgo}>{timeStr}</Text>
      </View>

      {/* Content */}
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
      ) : null}

      {/* Footer actions */}
      <View style={styles.footerRow}>
        {(hasRoute || verified) && (
          <>
            {hasRoute && (
              <TouchableOpacity
                style={[styles.routeButton, { backgroundColor: cfg.accent }]}
                onPress={onRoute}
              >
                <Text style={styles.routeText}>GET ROUTE</Text>
              </TouchableOpacity>
            )}
            {verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>⛓ BLOCKCHAIN VERIFIED</Text>
              </View>
            )}
          </>
        )}

        {/* Voting Buttons */}
        {/* <View style={{ flexDirection: 'row', gap: SPACING.sm, marginLeft: 'auto' }}>
          <TouchableOpacity
            style={[styles.voteButton, { backgroundColor: COLORS.statusGreen }]}
            onPress={() => handleVote('RESCUED')}
          >
            <Text style={styles.voteText}>ĐÃ TỚI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voteButton, { backgroundColor: COLORS.primary }]}
            onPress={() => handleVote('STILL_DANGER')}
          >
            <Text style={styles.voteText}>CÒN NGUY HIỂM</Text>
          </TouchableOpacity>
        </View> */}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    borderLeftWidth: 4,
    ...SHADOWS.card,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 9,
  },
  badgeLabel: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    letterSpacing: 0.5,
  },
  category: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.medium,
  },
  timeAgo: {
    fontSize: FONTS.xs,
    color: COLORS.textHint,
  },
  title: {
    fontSize: FONTS.base,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  routeButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
  },
  routeText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  verifiedText: {
    fontSize: FONTS.xs,
    color: COLORS.statusBlue,
    fontWeight: FONTS.semiBold,
  },
  voteButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
  },
  voteText: {
    color: COLORS.textWhite,
    fontSize: 10,
    fontWeight: FONTS.bold,
  }
});

export default AlertCard;
