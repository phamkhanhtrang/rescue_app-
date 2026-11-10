import PasswordScreen from '../screens/auth/PasswordScreen';
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
import AlertDetailScreen from '../screens/AlertDetailScreen';
import NewsDetailScreen from '../screens/NewsDetailScreen';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

const TabIcon = ({ iconName, label, focused, hasBadge }) => (
  <View style={tabIconStyles.wrapper}>
    <View style={tabIconStyles.iconWrap}>
      <MaterialCommunityIcons
        name={iconName}
        size={24}
        color={focused ? RCOLORS.primary : RCOLORS.textHint}
      />
      {hasBadge && <View style={tabIconStyles.badge} />}
    </View>
    <Text
      style={[
        tabIconStyles.label,
        { color: focused ? RCOLORS.primary : RCOLORS.textSecondary, fontWeight: focused ? '700' : '500' }
      ]}
      numberOfLines={1}
      ellipsizeMode="tail"
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {label}
    </Text>
  </View>
);

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 76,
    maxWidth: 84,
    paddingTop: 2,
    gap: 3,
  },
  iconWrap: { position: 'relative' },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RCOLORS.primary,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
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
    {/* ── 1. TÁC CHIẾN ─────────────────────────────────────────────────── */}
    <Tab.Screen
      name="DashboardTab"
      component={DashboardScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon iconName="shield-alert-outline" label="Tác chiến" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Tác chiến',
      }}
    />

    {/* ── 2. BẢN ĐỒ ─────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="MapTab"
      component={MapNavigator}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon iconName="map-marker-radius-outline" label="Bản đồ" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Bản đồ',
      }}
    />

    {/* ── 3. KHU VỰC ────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="MissionsTab"
      component={MissionsNavigator}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon iconName="format-list-bulleted-square" label="Khu vực" focused={focused} />
        ),
        tabBarAccessibilityLabel: 'Khu vực',
      }}
      listeners={({ navigation }) => ({
        tabPress: (e) => {
          navigation.navigate('MissionsTab', { screen: 'ZoneListScreen' });
        },
      })}
    />

    {/* ── 4. ĐỘI NGŨ ────────────────────────────────────────────────────── */}
    <Tab.Screen
      name="AlertsTab"
      component={RescuerAlertsScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <TabIcon iconName="account-group-outline" label="Đội ngũ" focused={focused} hasBadge />
        ),
        tabBarAccessibilityLabel: 'Đội ngũ',
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
    height: 62,
    paddingBottom: 4,
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
    <RootStack.Screen name="Password" component={PasswordScreen} options={{ headerShown: true, title: "Tài khoản & mật khẩu" }} />
    <RootStack.Screen name="AlertDetail" component={AlertDetailScreen} options={{ headerShown: true, title: 'Chi tiết thông báo' }} />
    <RootStack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ headerShown: true, title: 'Chi tiết tin tức' }} />

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
