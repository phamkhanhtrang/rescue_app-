/**
 * src/constants/rescuer/theme.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Design tokens riêng cho RescuerStack — trích xuất từ Figma THE SENTINEL.
 * Phong cách chuyên nghiệp hơn CitizenStack: navy đậm, blue team, red alert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const RCOLORS = {
  // ── Thương hiệu ────────────────────────────────
  primary:       '#B7131A',   // Đỏ khẩn cấp (SOS, Ban Chỉ Huy, NGUY CẤP)
  primaryDark:   '#8B0E13',
  primaryLight:  '#FDEAEA',

  // ── Nền ────────────────────────────────────────
  bgApp:         '#F8F9FA',   // Nền toàn ứng dụng
  bgWhite:       '#FFFFFF',
  bgDark:        '#0F172A',   // Header tối, bản đồ đêm
  bgNavy:        '#1E293B',   // Card tối command center
  bgNavyLight:   '#334155',   // Card navy nhạt hơn
  bgTeal:        '#0F766E',   // Hỗ trợ tác chiến
  bgBlue:        '#1D4ED8',   // Blue accent

  // ── Văn bản ────────────────────────────────────
  textPrimary:   '#0F172A',
  textSecondary: '#64748B',
  textHint:      '#94A3B8',
  textWhite:     '#FFFFFF',
  textBlue:      '#1D4ED8',
  textTeal:      '#0F766E',
  textRed:       '#B7131A',

  // ── Trạng thái ─────────────────────────────────
  statusGreen:   '#16A34A',
  statusOrange:  '#EA580C',
  statusRed:     '#B7131A',
  statusBlue:    '#1D4ED8',
  statusPurple:  '#7C3AED',

  // ── Độ thiếu hụt nhân lực ─────────────────────
  urgentRed:     '#B7131A',   // THIẾU X - CẦN GẤP
  urgentOrange:  '#EA580C',   // Cảnh báo
  sufficientGreen:'#16A34A',  // ĐỦ QUÂN SỐ

  // ── UI ─────────────────────────────────────────
  border:        '#E2E8F0',
  borderDark:    '#334155',
  shadow:        'rgba(15,23,42,0.08)',
  shadowRed:     'rgba(183,19,26,0.35)',
  overlay:       'rgba(15,23,42,0.65)',
  blockchain:    '#1D4ED8',
};

export const RFONTS = {
  xs:        10,
  sm:        12,
  base:      14,
  md:        16,
  lg:        18,
  xl:        22,
  xxl:       28,
  hero:      36,
  regular:   '400',
  medium:    '500',
  semiBold:  '600',
  bold:      '700',
  extraBold: '800',
  black:     '900',
};

export const RSPACING = {
 xs:  4,
  sm:  8,
  md:  12,
  base:16,
  lg:  20,
  xl:  24,
  xxl: 32,
  xxxl:48,
};
export const RRADIUS = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
};

export const RSHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  redGlow: {
    shadowColor: '#B7131A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const RLAYOUT = {
  headerHeight:  56,
  tabBarHeight:  64,
  screenPadding: 16,
};
