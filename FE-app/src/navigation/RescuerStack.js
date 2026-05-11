/**
 * src/navigation/RescuerStack.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Navigator chính cho vai trò ĐỘI CỨU TRỢ (RESCUER).
 *
 * Kiến trúc phân cấp:
 *
 *   RescuerStack (NativeStack — root)
 *   ├── RescuerTabs (BottomTabs — 4 tab)
 *   │   ├── DashboardTab   → DashboardScreen      (Command Center)
 *   │   ├── MissionsTab    → MissionsNavigator     (NativeStack)
 *   │   │   ├── ZoneListScreen                    (Danh sách Vùng)
 *   │   │   ├── ZoneDetailScreen                  (Chi tiết Vùng 07)
 *   │   │   ├── JoinConfirmScreen                 (Xác nhận Tham gia)
 *   │   │   ├── ActiveMissionScreen               (Đang thực hiện)
 *   │   │   ├── StatusUpdateScreen                (Cập nhật Trạng thái)
 *   │   │   └── MissionHistoryScreen              (Lịch sử)
 *   │   ├── MapTab         → MapNavigator          (NativeStack)
 *   │   │   ├── RescuerMapScreen                  (Bản đồ Cứu hộ)
 *   │   │   └── MissionNavScreen                  (Điều hướng Nhiệm vụ)
 *   │   └── AlertsTab      → RescuerAlertsScreen   (Thông báo Đội ngũ)
 *   │
 *   ├── ResourceDeclareScreen   [modal, slide-from-bottom]
 *   └── RescuerOfflineScreen    [modal, slide-from-bottom]
 *
 * Label tab: ĐIỀU HÀNH | NHIỆM VỤ | BẢN ĐỒ | THÔNG BÁO
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// ── Tab: Dashboard (ĐIỀU HÀNH) ────────────────────────────────────────────
import DashboardScreen          from '../screens/rescuer/dashboard/DashboardScreen';

// ── Tab: Missions (NHIỆM VỤ) ──────────────────────────────────────────────
import ZoneListScreen           from '../screens/rescuer/missions/ZoneListScreen';
import ZoneDetailScreen         from '../screens/rescuer/missions/ZoneDetailScreen';
import JoinConfirmScreen        from '../screens/rescuer/missions/JoinConfirmScreen';
import ActiveMissionScreen      from '../screens/rescuer/missions/ActiveMissionScreen';
import StatusUpdateScreen       from '../screens/rescuer/missions/StatusUpdateScreen';
import MissionHistoryScreen     from '../screens/rescuer/missions/MissionHistoryScreen';

// ── Tab: Map (BẢN ĐỒ) ────────────────────────────────────────────────────
import RescuerMapScreen         from '../screens/rescuer/map/RescuerMapScreen';
import MissionNavScreen         from '../screens/rescuer/map/MissionNavScreen';

// ── Tab: Alerts (THÔNG BÁO) ───────────────────────────────────────────────
import RescuerAlertsScreen      from '../screens/rescuer/alerts/RescuerAlertsScreen';

// ── Root modals ───────────────────────────────────────────────────────────
import ResourceDeclareScreen    from '../screens/rescuer/resources/ResourceDeclareScreen';
import RescuerOfflineScreen     from '../screens/rescuer/offline/RescuerOfflineScreen';
import RescuerProfileScreen     from '../screens/rescuer/profile/RescuerProfileScreen';
import RescuerProfileEdit       from '../screens/rescuer/profile/RescuerProfileEdit';

// ── Theme ─────────────────────────────────────────────────────────────────
import { RCOLORS, RFONTS, RSPACING } from '../constants/rescuer/theme';

// ─── Navigator Factories ──────────────────────────────────────────────────────

const RootStack       = createNativeStackNavigator();
const Tab             = createBottomTabNavigator();
const MissionsStack   = createNativeStackNavigator();
const MapStack        = createNativeStackNavigator();

// ─── MissionsNavigator ────────────────────────────────────────────────────────
// Sub-stack cho tab NHIỆM VỤ: ZoneList → ZoneDetail → JoinConfirm → ActiveMission → StatusUpdate → History

const MissionsNavigator = () => (
  <MissionsStack.Navigator screenOptions={{ headerShown: false }}>
    <MissionsStack.Screen name="ZoneListScreen"      component={ZoneListScreen} />
    <MissionsStack.Screen
      name="ZoneDetailScreen"
      component={ZoneDetailScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <MissionsStack.Screen
      name="JoinConfirmScreen"
      component={JoinConfirmScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <MissionsStack.Screen
      name="ActiveMissionScreen"
      component={ActiveMissionScreen}
      options={{ animation: 'slide_from_right', gestureEnabled: false }}
    />
    <MissionsStack.Screen
      name="StatusUpdateScreen"
      component={StatusUpdateScreen}
      options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
    />
    <MissionsStack.Screen
      name="MissionHistoryScreen"
      component={MissionHistoryScreen}
      options={{ animation: 'slide_from_right' }}
    />
  </MissionsStack.Navigator>
);

// ─── MapNavigator ─────────────────────────────────────────────────────────────
// Sub-stack cho tab BẢN ĐỒ: RescuerMap → MissionNav (navigation turn-by-turn)

const MapNavigator = () => (
  <MapStack.Navigator screenOptions={{ headerShown: false }}>
    <MapStack.Screen name="RescuerMapScreen" component={RescuerMapScreen} />
    <MapStack.Screen
      name="MissionNavScreen"
      component={MissionNavScreen}
      options={{ animation: 'slide_from_right' }}
    />
  </MapStack.Navigator>
);

// ─── Tab Bar Icon ─────────────────────────────────────────────────────────────

const TabIcon = ({ emoji, label, focused, hasBadge }) => (
  <View style={tabIconStyles.wrapper}>
    <View style={tabIconStyles.emojiWrap}>
      <Text style={[tabIconStyles.emoji, focused && tabIconStyles.emojiActive]}>{emoji}</Text>
      {hasBadge && <View style={tabIconStyles.badge} />}
    </View>
    <Text style={[tabIconStyles.label, { color: focused ? RCOLORS.primary : RCOLORS.textHint }]}>
      {label}
    </Text>
  </View>
);

const tabIconStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 2, paddingTop: 4 },
  emojiWrap: { position: 'relative' },
  emoji: { fontSize: 20, opacity: 0.5 },
  emojiActive: { opacity: 1 },
  label: { fontSize: RFONTS.xs, fontWeight: RFONTS.semiBold, letterSpacing: 0.3 },
  badge: { position: 'absolute', top: -2, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: RCOLORS.primary, borderWidth: 1.5, borderColor: '#FFF' },
});

// ─── RescuerTabs ─────────────────────────────────────────────────────────────

const RescuerTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: tabBarStyles.bar,
    }}
  >
    {/* ── ĐIỀU HÀNH ──────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="DashboardTab"
      component={DashboardScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon emoji="⊞" label="ĐIỀU HÀNH" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Điều hành',
      }}
    />

    {/* ── NHIỆM VỤ ───────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="MissionsTab"
      component={MissionsNavigator}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon emoji="📋" label="NHIỆM VỤ" focused={focused} hasBadge />
        ),
        tabBarAccessibilityLabel: 'Nhiệm vụ',
      }}
    />

    {/* ── BẢN ĐỒ ─────────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="MapTab"
      component={MapNavigator}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon emoji="🗺" label="BẢN ĐỒ" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Bản đồ',
      }}
    />

    {/* ── THÔNG BÁO ──────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="AlertsTab"
      component={RescuerAlertsScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon emoji="🔔" label="THÔNG BÁO" focused={focused} hasBadge />
        ),
        tabBarAccessibilityLabel: 'Thông báo',
      }}
    />
  </Tab.Navigator>
);

// ─── Tab Bar Styles ───────────────────────────────────────────────────────────

const tabBarStyles = StyleSheet.create({
  bar: {
    backgroundColor: RCOLORS.bgWhite,
    borderTopWidth: 1,
    borderTopColor: '#E8ECEF',
    height: 68,
    paddingBottom: 8,
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 12,
  },
});

// ─── RescuerStack — Root Navigator ───────────────────────────────────────────

const RescuerStack = () => (
  <RootStack.Navigator screenOptions={{ headerShown: false }}>

    {/* Tab navigator là màn hình gốc */}
    <RootStack.Screen name="RescuerTabs" component={RescuerTabs} />

    {/* ── Root-level modals (không có tab bar) ──────────────────────────── */}

    {/* Khai báo Nguồn lực — slide từ dưới, có thể swipe down đóng */}
    <RootStack.Screen
      name="ResourceDeclareScreen"
      component={ResourceDeclareScreen}
      options={{
        animation: 'slide_from_bottom',
        presentation: 'modal',
      }}
    />

    {/* Chế độ Ngoại tuyến — dark full-screen modal */}
    <RootStack.Screen
      name="RescuerOfflineScreen"
      component={RescuerOfflineScreen}
      options={{
        animation: 'slide_from_bottom',
        presentation: 'modal',
      }}
    />

    <RootStack.Screen
      name="RescuerProfileScreen"
      component={RescuerProfileScreen}
      options={{
        animation: 'slide_from_right',
      }}
    />
    <RootStack.Screen
      name="RescuerProfileEdit"
      component={RescuerProfileEdit}
      options={{
        animation: 'slide_from_right',
      }}
    />

    {/*
     * Các màn hình có thể thêm sau:
     * - TeamChatScreen: Giao tiếp nội bộ đội
     * - IncidentReportScreen: Báo cáo sự cố chi tiết
     */}

  </RootStack.Navigator>
);

export default RescuerStack;
