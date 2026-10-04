import PasswordScreen from '../screens/auth/PasswordScreen';
import SOSRequestsScreen from '../screens/citizen/sos/SOSRequestsScreen';
/**
 * src/navigation/CitizenStack.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Navigator chính cho vai trò NGƯỜI DÂN (CITIZEN).
 *
 * Cấu trúc phân cấp:
 *
 *   CitizenStack (NativeStack)          ← Root stack
 *   ├── CitizenTabs (BottomTabs)        ← 4 tab chính
 *   │   ├── HomeTab    → HomeScreen
 *   │   ├── MapTab     → MapScreen
 *   │   ├── AlertsTab  → AlertsStack (NativeStack)
 *   │   │   ├── AlertsScreen            ← The Guardian Pulse
 *   │   │   ├── HistoryScreen           ← Signal History
 *   │   │   ├── CommunityVerifyScreen   ← Xác thực cộng đồng
 *   │   │   └── OfflineModeScreen       ← Chế độ offline
 *   │   └── ProfileTab → ProfileScreen
 *   │
 *   ├── SOSScreen        ← Modal slide-from-bottom (gửi SOS)
 *   └── SOSConfirmScreen ← Slide-from-right (xác nhận đã gửi)
 *
 * Lý do tách AlertsStack ra stack riêng:
 *   - CommunityVerify, History, Offline đều liên quan đến "alerts/news"
 *   - Giữ back navigation tự nhiên: Alerts → sub-screens → back → Alerts
 *   - Tránh xuất hiện tab bar khi đang ở SOSScreen (full-screen flow)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import AlertDetailScreen from '../screens/AlertDetailScreen';
import NewsDetailScreen from '../screens/NewsDetailScreen';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// ── Screens: Home ──────────────────────────────────────────────────────────
import HomeScreen           from '../screens/citizen/home/HomeScreen';

// ── Screens: SOS (full-screen flow, nằm trong root stack) ─────────────────
import SOSScreen            from '../screens/citizen/sos/SOSScreen';
import SOSConfirmScreen     from '../screens/citizen/sos/SOSConfirmScreen';
import SOSTrackingScreen    from '../screens/citizen/sos/SOSTrackingScreen';
import AnonymousSOSScreen   from '../screens/citizen/sos/AnonymousSOSScreen';

// ── Screens: Map ───────────────────────────────────────────────────────────
import MapScreen            from '../screens/citizen/map/MapScreen';

// ── Screens: Alerts & sub-screens ──────────────────────────────────────────
import AlertsScreen         from '../screens/citizen/alerts/AlertsScreen';
import CommunityVerifyScreen from '../screens/citizen/alerts/CommunityVerifyScreen';
import OfflineModeScreen    from '../screens/citizen/alerts/OfflineModeScreen';
import HistoryScreen        from '../screens/citizen/history/HistoryScreen';

// ── Screens: Profile ───────────────────────────────────────────────────────
import ProfileScreen        from '../screens/citizen/profile/ProfileScreen';

// ── Theme ──────────────────────────────────────────────────────────────────
import { COLORS, FONTS, SPACING } from '../constants/citizen/theme';

// ─── Navigator factories ───────────────────────────────────────────────────────

const RootStack   = createNativeStackNavigator();
const Tab         = createBottomTabNavigator();
const AlertsStack = createNativeStackNavigator();

// ─── AlertsStack: Navigator con cho tab ALERTS ────────────────────────────────
// Bao gồm các màn hình liên quan đến cảnh báo, lịch sử, xác thực, offline.

const AlertsNavigator = () => (
  <AlertsStack.Navigator
    initialRouteName="AlertsScreen"
    screenOptions={{ headerShown: false }}
  >
    {/* Màn hình chính của tab ALERTS */}
    <AlertsStack.Screen name="AlertsScreen" component={AlertsScreen} />

    {/* Lịch sử tín hiệu SOS */}
    <AlertsStack.Screen name="HistoryScreen"         component={HistoryScreen} />

    {/* Xác thực cộng đồng (navigate từ một AlertCard) */}
    <AlertsStack.Screen
      name="CommunityVerifyScreen"
      component={CommunityVerifyScreen}
      options={{ animation: 'slide_from_right' }}
    />

    {/* Chế độ offline */}
    <AlertsStack.Screen
      name="OfflineModeScreen"
      component={OfflineModeScreen}
      options={{ animation: 'slide_from_right' }}
    />
  </AlertsStack.Navigator>
);

// ─── Tab Bar Icon (dùng emoji làm placeholder icon) ──────────────────────────
// TODO: Thay bằng @expo/vector-icons: MaterialIcons hoặc Ionicons

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_ICON_MAX_WIDTH = Math.floor(SCREEN_WIDTH / 5); // mỗi tab tối đa 1/5 màn hình
const tabBarHeight = 60; // Cân đối chiều cao tab bar

const TabIcon = ({ name, label, focused }) => (
  <View style={tabIconStyles.wrapper}>
    <MaterialCommunityIcons
      name={name}
      size={28}
      color={focused ? '#111' : '#888'}
      style={{ marginBottom: 0 }}
    />
    <Text
      style={[
        tabIconStyles.label,
        { color: focused ? '#111' : '#888' }
      ]}
      numberOfLines={1}
      ellipsizeMode="tail"
      adjustsFontSizeToFit
      minimumFontScale={0.85}
    >
      {label}
    </Text>
  </View>
);

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    maxWidth: 80,
    paddingTop: 2,
    paddingBottom: 0,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semiBold,
    letterSpacing: 0.3,
    maxWidth: 68,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 18,
  },
});

// ─── CitizenTabs: Bottom Tab Navigator ────────────────────────────────────────

const CitizenTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: { ...tabBarStyles.bar, height: tabBarHeight },
    }}
  >
    <Tab.Screen
      name="HomeTab"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon name="home-outline" label="Trang chủ" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Trang chủ',
      }}
    />
    <Tab.Screen
      name="MapTab"
      component={MapScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon name="map-outline" label="Bản đồ" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Bản đồ',
      }}
    />
    <Tab.Screen
      name="AlertsTab"
      component={AlertsNavigator}
      options={{
        unmountOnBlur: true,
        tabBarIcon: ({ focused }) => (
          <TabIcon name="alert-circle-outline" label="Cảnh báo" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Cảnh báo',
      }}
    />
    <Tab.Screen
      name="ProfileTab"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon name="account-outline" label="Hồ sơ" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Hồ sơ',
      }}
    />
  </Tab.Navigator>
);

// ─── Tab Bar Styles ───────────────────────────────────────────────────────────

const tabBarStyles = StyleSheet.create({
  bar: {
    backgroundColor: '#fff', // Nền trắng
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    height: 60,
    paddingBottom: 4,
    paddingTop: 4,
    // shadowColor: '#000', // Loại bỏ shadow cho tối giản
    // shadowOffset: { width: 0, height: -3 },
    // shadowOpacity: 0.06,
    // shadowRadius: 8,
    // elevation: 10,
  },
});

// ─── CitizenStack: Root Stack ─────────────────────────────────────────────────

const CitizenStack = () => (
  <RootStack.Navigator initialRouteName="CitizenTabs" screenOptions={{ headerShown: false }}>

    {/* Tab navigator là màn hình mặc định */}
    <RootStack.Screen name="Password" component={PasswordScreen} options={{ headerShown: true, title: "Tài khoản & mật khẩu" }} />
    <RootStack.Screen name="SOSRequestsScreen" component={SOSRequestsScreen} />
    <RootStack.Screen name="CitizenTabs" component={CitizenTabs} />
    <RootStack.Screen name="AlertDetail" component={AlertDetailScreen} options={{ headerShown: true, title: 'Chi tiết thông báo' }} />
    <RootStack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ headerShown: true, title: 'Chi tiết tin tức' }} />

    {/* ── SOS flow (full-screen, không có tab bar) ────────────────────────── */}
    <RootStack.Screen
      name="SOSScreen"
      component={SOSScreen}
      options={{
        animation: 'slide_from_bottom',
        presentation: 'modal',
        // gestureEnabled: true — cho phép swipe down để đóng
      }}
    />

    <RootStack.Screen
      name="SOSConfirmScreen"
      component={SOSConfirmScreen}
      options={{
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    />

    <RootStack.Screen
      name="SOSTrackingScreen"
      component={SOSTrackingScreen}
      options={{ animation: 'slide_from_right' }}
    />

    <RootStack.Screen
      name="AnonymousSOSScreen"
      component={AnonymousSOSScreen}
      options={{ animation: 'slide_from_bottom' }}
    />

  </RootStack.Navigator>
);

export default CitizenStack;
