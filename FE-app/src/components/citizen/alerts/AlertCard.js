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
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../constants/citizen/theme';

// Cấu hình màu theo severity
const SEVERITY_CONFIG = {
  critical: {
    accent:    COLORS.primary,
    badgeBg:   '#FFEBEE',
    badgeText: COLORS.primary,
    icon:      '🔴',
    label:     'CRITICAL',
  },
  warning: {
    accent:    COLORS.statusOrange,
    badgeBg:   '#FFF3E0',
    badgeText: COLORS.statusOrange,
    icon:      '⚠️',
    label:     'WARNING',
  },
  info: {
    accent:    COLORS.statusBlue,
    badgeBg:   '#E3F2FD',
    badgeText: COLORS.statusBlue,
    icon:      '🔵',
    label:     'INFO',
  },
  rescue: {
    accent:    COLORS.statusGreen,
    badgeBg:   '#E8F5E9',
    badgeText: COLORS.statusGreen,
    icon:      '🟢',
    label:     'RESCUE INFO',
  },
};

const AlertCard = ({
  severity = 'info',
  category = '',
  title = '',
  description = '',
  timeAgo = '',
  hasRoute = false,
  verified = false,
  onPress,
  onRoute,
}) => {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;

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
          {category ? (
            <Text style={styles.category}>• {category}</Text>
          ) : null}
        </View>
        <Text style={styles.timeAgo}>{timeAgo}</Text>
      </View>

      {/* Content */}
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
      ) : null}

      {/* Footer actions */}
      {(hasRoute || verified) && (
        <View style={styles.footerRow}>
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
        </View>
      )}
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
});

export default AlertCard;
