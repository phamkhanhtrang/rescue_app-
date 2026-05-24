/**
 * src/constants/rescuer/theme.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Design tokens riêng cho RescuerStack — trích xuất từ Figma THE SENTINEL.
 * Phong cách chuyên nghiệp hơn CitizenStack: navy đậm, blue team, red alert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const RCOLORS = {
  // ── Thương hiệu ────────────────────────────────
  primary:       '#E53935',   // Đỏ khẩn cấp (SOS, DEPLOY, NGUY CẤP)
  primaryDark:   '#B71C1C',
  primaryLight:  '#FFEBEE',

  // ── Nền ────────────────────────────────────────
  bgApp:         '#F4F5F7',   // Nền toàn ứng dụng (xám nhẹ)
  bgWhite:       '#FFFFFF',
  bgDark:        '#0D1A2D',   // Header tối, bản đồ đêm
  bgNavy:        '#112240',   // Card tối command center
  bgNavyLight:   '#1A3050',   // Card navy nhạt hơn
  bgTeal:        '#00695C',   // AI insight (teal xanh đậm)
  bgBlue:        '#1565C0',   // Team blue accent

  // ── Văn bản ────────────────────────────────────
  textPrimary:   '#0D1A2D',
  textSecondary: '#546E7A',
  textHint:      '#B0BEC5',
  textWhite:     '#FFFFFF',
  textBlue:      '#1565C0',
  textTeal:      '#00BCD4',
  textRed:       '#E53935',

  // ── Trạng thái ─────────────────────────────────
  statusGreen:   '#43A047',
  statusOrange:  '#FB8C00',
  statusRed:     '#E53935',
  statusBlue:    '#1565C0',
  statusPurple:  '#7B1FA2',

  // ── Độ thiếu hụt nhân lực ─────────────────────
  urgentRed:     '#E53935',   // THIẾU X - CẦN GẤP
  urgentOrange:  '#FB8C00',   // Cảnh báo
  sufficientGreen:'#43A047',  // ĐỦ QUÂN SỐ

  // ── UI ─────────────────────────────────────────
  border:        '#DDE3ED',
  borderDark:    '#263248',
  shadow:        'rgba(13,26,45,0.12)',
  shadowRed:     'rgba(229,57,53,0.35)',
  overlay:       'rgba(13,26,45,0.65)',
  blockchain:    '#00BCD4',
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
    shadowColor: '#E53935',
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
