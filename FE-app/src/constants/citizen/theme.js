/**
 * src/constants/citizen/theme.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Design tokens cho CitizenStack — trích xuất từ thiết kế Figma SENTINEL.
 * Import file này thay vì hardcode màu/kích thước ở từng component.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Màu sắc ─────────────────────────────────────────────────────────────────

export const COLORS = {
  // Thương hiệu
  primary:      '#B7131A',   // Đỏ SOS — dùng cho nút SOS, badge active, đường viền khẩn
  primaryDark:  '#8B0E13',   // Đỏ đậm — pressed state, bóng đổ
  primaryLight: '#FDEAEA',   // Đỏ nhạt — background badge nhẹ

  // Nền tảng
  bgLight:      '#F8F9FA',   // Nền ứng dụng chính
  bgWhite:      '#FFFFFF',   // Card, input, header
  bgDark:       '#0F172A',   // Header tối, bản đồ tối, màn hình offline
  bgNavy:       '#1E293B',   // Card tối thứ cấp
  bgTeal:       '#1E293B',   // Card tối phụ trợ
  bgTealDark:   '#0F172A',   // Pressed state cho card tối

  // Văn bản
  textPrimary:  '#0F172A',   // Text chính (Slate-900)
  textSecondary:'#64748B',   // Text phụ (Slate-500)
  textHint:     '#94A3B8',   // Placeholder, text nhạt (Slate-400)
  textWhite:    '#FFFFFF',   // Text trên nền tối/đỏ
  textTeal:     '#1D4ED8',   // Text accent xanh lam

  // Trạng thái
  statusGreen:  '#16A34A',   // An toàn, verified, resolved
  statusOrange: '#EA580C',   // Cảnh báo, warning
  statusRed:    '#B7131A',   // Nguy hiểm, active threat
  statusBlue:   '#1D4ED8',   // Thông tin, rescue info

  // UI
  border:       '#E2E8F0',   // Đường viền card, input
  borderFocus:  '#B7131A',   // Đường viền khi focus input
  shadow:       'rgba(0,0,0,0.08)',
  shadowRed:    'rgba(183,19,26,0.35)', // Bóng đổ nút SOS
  overlay:      'rgba(15,23,42,0.6)',   // Overlay tối trên bản đồ

  // Đặc biệt
  accent:       '#1D4ED8',   // Màu accent
  verified:     '#16A34A',   // Màu đã xác thực
  blockchain:   '#1D4ED8',   // Backward-compatibility token
  mapDark:      '#1E293B',   // Nền map placeholder tối
  liveBadge:    '#B7131A',   // Badge "LIVE ALERT"
};

// ─── Typography ──────────────────────────────────────────────────────────────

export const FONTS = {
  // Kích thước
  xs:   10,
  sm:   12,
  base: 14,
  md:   16,
  lg:   18,
  xl:   22,
  xxl:  28,
  hero: 36,

  // Độ đậm
  regular:    '400',
  medium:     '500',
  semiBold:   '600',
  bold:       '700',
  extraBold:  '800',
  black:      '900',

  // Font family (Expo default system font; thay bằng Google Fonts nếu cần)
  family: undefined, // React Native tự dùng system font theo platform
};

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  base:16,
  lg:  20,
  xl:  24,
  xxl: 32,
  xxxl:48,
};

// ─── Border Radius ────────────────────────────────────────────────────────────

export const RADIUS = {
  sm:    6,
  md:    10,
  lg:    14,
  xl:    20,
  xxl:   28,
  full:  9999,
};

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sos: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  tab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
};

// ─── Layout ───────────────────────────────────────────────────────────────────

export const LAYOUT = {
  headerHeight:   56,
  tabBarHeight:   65,
  screenPadding:  16,
  cardRadius:     RADIUS.lg,
};
