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
  primary:      '#E53935',   // Đỏ SOS — dùng cho nút SOS, badge active, đường viền khẩn
  primaryDark:  '#B71C1C',   // Đỏ đậm — pressed state, bóng đổ
  primaryLight: '#FFEBEE',   // Đỏ nhạt — background badge nhẹ

  // Nền tảng
  bgLight:      '#F5F5F5',   // Nền ứng dụng chính
  bgWhite:      '#FFFFFF',   // Card, input, header
  bgDark:       '#0D1421',   // Header tối, bản đồ tối, màn hình offline
  bgNavy:       '#1A2236',   // Card tối thứ cấp
  bgTeal:       '#0B5E75',   // Card AI Insight (màu đặc trưng Guardian)
  bgTealDark:   '#083E4D',   // Pressed state cho teal card

  // Văn bản
  textPrimary:  '#1A1A2E',   // Text chính (rất tối, gần đen)
  textSecondary:'#757575',   // Text phụ (xám trung)
  textHint:     '#BDBDBD',   // Placeholder, text nhạt
  textWhite:    '#FFFFFF',   // Text trên nền tối/đỏ
  textTeal:     '#00BCD4',   // Text accent xanh lam (blockchain hash, tags)

  // Trạng thái
  statusGreen:  '#43A047',   // An toàn, verified, resolved
  statusOrange: '#FB8C00',   // Cảnh báo, warning
  statusRed:    '#E53935',   // Nguy hiểm, active threat
  statusBlue:   '#1565C0',   // Thông tin, rescue info

  // UI
  border:       '#E8E8E8',   // Đường viền card, input
  borderFocus:  '#E53935',   // Đường viền khi focus input
  shadow:       'rgba(0,0,0,0.10)',
  shadowRed:    'rgba(229,57,53,0.35)', // Bóng đổ nút SOS
  overlay:      'rgba(13,20,33,0.6)',   // Overlay tối trên bản đồ

  // Đặc biệt
  blockchain:   '#00BCD4',   // Màu blockchain hash
  mapDark:      '#2C3E50',   // Nền map placeholder tối
  liveBadge:    '#FF1744',   // Badge "LIVE ALERT"
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
