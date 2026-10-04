import PasswordScreen from '../screens/auth/PasswordScreen';
import SOSRequestsScreen from '../screens/citizen/sos/SOSRequestsScreen';
/**
 * src/navigation/AuthStack.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Stack điều hướng cho luồng XÁC THỰC (khi userRole === null).
 *
 * Cấu trúc:
 *   AuthStack (NativeStack)
 *   ├── Welcome           → WelcomeScreen        (Chọn vai trò)
 *   ├── CitizenLogin      → CitizenLoginScreen    (Đăng nhập Người dân - sáng)
 *   ├── CitizenRegister   → CitizenRegisterScreen (Đăng ký Người dân - sáng)
 *   ├── RescuerLogin      → RescuerLoginScreen    (Đăng nhập Cứu hộ - tối)
 *   └── RescuerRegister   → RescuerRegisterScreen (Đăng ký Cứu hộ 3 bước - tối)
 *
 * Màn hình Welcome dùng animation 'fade'.
 * Các màn hình con dùng 'slide_from_right' hoặc 'slide_from_bottom'.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen          from '../screens/auth/WelcomeScreen';
import CitizenLoginScreen     from '../screens/auth/citizen/CitizenLoginScreen';
import CitizenRegisterScreen  from '../screens/auth/citizen/CitizenRegisterScreen';
import RescuerLoginScreen     from '../screens/auth/rescuer/RescuerLoginScreen';
import RescuerRegisterScreen  from '../screens/auth/rescuer/RescuerRegisterScreen';
import AnonymousSOSScreen     from '../screens/citizen/sos/AnonymousSOSScreen';
import SOSConfirmScreen     from '../screens/citizen/sos/SOSConfirmScreen';
import SOSTrackingScreen        from '../screens/citizen/sos/SOSTrackingScreen';

const Stack = createNativeStackNavigator();

const AuthStack = () => (
  <Stack.Navigator
    initialRouteName="Welcome"
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      gestureEnabled: true,
    }}
  >
    {/* ── Màn hình gốc: Chọn vai trò ──────────────────────────────────── */}
    <Stack.Screen name="Password" component={PasswordScreen} options={{ headerShown: true, title: "Tài khoản & mật khẩu" }} />
    <Stack.Screen name="SOSRequestsScreen" component={SOSRequestsScreen} />
    <Stack.Screen
      name="Welcome"
      component={WelcomeScreen}
      options={{
        animation: 'fade',
        gestureEnabled: false,
      }}
    />

    {/* ── Anonymous SOS ────────────────────────────────────────────────── */}
    <Stack.Screen
      name="AnonymousSOSScreen"
      component={AnonymousSOSScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
    <Stack.Screen
      name="SOSScreen"
      component={AnonymousSOSScreen}
      options={{ animation: 'slide_from_bottom' }}
    />

    <Stack.Screen
      name="SOSConfirmScreen"
      component={SOSConfirmScreen}
      options={{ animation: 'slide_from_right', gestureEnabled: false }}
    />

    <Stack.Screen
      name="SOSTrackingScreen"
      component={SOSTrackingScreen}
      options={{ animation: 'slide_from_right' }}
    />

    {/* ── CITIZEN: Đăng nhập ───────────────────────────────────────────── */}
    <Stack.Screen
      name="CitizenLogin"
      component={CitizenLoginScreen}
      options={{ animation: 'slide_from_right' }}
    />

    {/* ── CITIZEN: Đăng ký ─────────────────────────────────────────────── */}
    <Stack.Screen
      name="CitizenRegister"
      component={CitizenRegisterScreen}
      options={{ animation: 'slide_from_right' }}
    />

    {/* ── RESCUER: Đăng nhập ───────────────────────────────────────────── */}
    <Stack.Screen
      name="RescuerLogin"
      component={RescuerLoginScreen}
      options={{ animation: 'slide_from_right' }}
    />

    {/* ── RESCUER: Đăng ký (3-step wizard) ────────────────────────────── */}
    <Stack.Screen
      name="RescuerRegister"
      component={RescuerRegisterScreen}
      options={{ animation: 'slide_from_right' }}
    />

    {/*
     * TODO: Thêm các màn hình auth nâng cao:
     * - ForgotPasswordScreen
     * - OTPVerifyScreen
     * - BiometricSetupScreen
     */}
  </Stack.Navigator>
);

export default AuthStack;
