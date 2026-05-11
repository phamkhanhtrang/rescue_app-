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
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// ── Screens: Home ──────────────────────────────────────────────────────────
import HomeScreen           from '../screens/citizen/home/HomeScreen';

// ── Screens: SOS (full-screen flow, nằm trong root stack) ─────────────────
import SOSScreen            from '../screens/citizen/sos/SOSScreen';
import SOSConfirmScreen     from '../screens/citizen/sos/SOSConfirmScreen';

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
  <AlertsStack.Navigator screenOptions={{ headerShown: false }}>
    {/* Màn hình chính của tab ALERTS */}
    <AlertsStack.Screen name="AlertsScreen"          component={AlertsScreen} />

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

const TabIcon = ({ emoji, label, focused }) => (
  <View style={tabIconStyles.wrapper}>
    <Text style={[tabIconStyles.emoji, focused && tabIconStyles.emojiActive]}>
      {emoji}
    </Text>
    <Text style={[tabIconStyles.label, { color: focused ? COLORS.primary : COLORS.textHint }]}>
      {label}
    </Text>
  </View>
);

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 4,
  },
  emoji: {
    fontSize: 20,
    opacity: 0.5,
  },
  emojiActive: {
    opacity: 1,
  },
  label: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.semiBold,
    letterSpacing: 0.3,
  },
});

// ─── CitizenTabs: Bottom Tab Navigator ────────────────────────────────────────

const CitizenTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,   // Label tùy chỉnh trong TabIcon
      tabBarStyle: tabBarStyles.bar,
    }}
  >
    {/* ── Tab HOME ────────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="HomeTab"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon emoji="🏠" label="TRANG CHỦ" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Trang chủ',
      }}
    />

    {/* ── Tab MAP ─────────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="MapTab"
      component={MapScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon emoji="🗺" label="BẢN ĐỒ" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Bản đồ',
      }}
    />

    {/* ── Tab ALERTS ──────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="AlertsTab"
      component={AlertsNavigator}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon emoji="🔔" label="CẢNH BÁO" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Cảnh báo',
      }}
    />

    {/* ── Tab PROFILE ─────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="ProfileTab"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon emoji="👤" label="HỒ SƠ" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Hồ sơ',
      }}
    />
  </Tab.Navigator>
);

// ─── Tab Bar Styles ───────────────────────────────────────────────────────────

const tabBarStyles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.bgWhite,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    height: 68,
    paddingBottom: 8,
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
});

// ─── CitizenStack: Root Stack ─────────────────────────────────────────────────

const CitizenStack = () => (
  <RootStack.Navigator screenOptions={{ headerShown: false }}>

    {/* Tab navigator là màn hình mặc định */}
    <RootStack.Screen name="CitizenTabs" component={CitizenTabs} />

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
        gestureEnabled: false, // Ngăn swipe back từ màn hình xác nhận
      }}
    />

    {/*
     * SOSTrackingScreen sẽ được thêm vào đây khi triển khai.
     * (Màn hình "ZONE ALPHA-7" theo dõi đội cứu hộ)
     *
     * <RootStack.Screen
     *   name="SOSTrackingScreen"
     *   component={SOSTrackingScreen}
     *   options={{ animation: 'slide_from_right' }}
     * />
     */
     }

  </RootStack.Navigator>
);

export default CitizenStack;
