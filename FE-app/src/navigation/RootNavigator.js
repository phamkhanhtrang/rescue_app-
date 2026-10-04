/**
 * RootNavigator.js
 * ---------------------------------------------------------------------------
 * Navigator gốc — Điểm điều hướng trung tâm của ứng dụng.
 *
 * Logic phân quyền:
 *   userRole === null      → AuthStack  (Chưa đăng nhập)
 *   userRole === 'CITIZEN' → CitizenStack (Người dân)
 *   userRole === 'RESCUER' → RescuerStack (Đội cứu hộ)
 *
 * Sử dụng NavigationContainer để bọc toàn bộ navigation tree.
 * ---------------------------------------------------------------------------
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import usePushNotifications from '../hooks/usePushNotifications';

import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import CitizenStack from './CitizenStack';
import RescuerStack from './RescuerStack';

// ─── Màn hình Loading ─────────────────────────────────────────────────────────

/**
 * Hiển thị spinner khi đang kiểm tra trạng thái xác thực
 * (ví dụ: đang đọc token từ AsyncStorage khi app khởi động).
 */
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#E53935" />
  </View>
);

// ─── Root Navigator ───────────────────────────────────────────────────────────

const RootNavigator = () => {
  const { userRole, userInfo, isLoading } = useAuth();
  const navigationRef = useNavigationContainerRef();
  const onReady = usePushNotifications(userInfo ? { ...userInfo, role: userRole } : null, navigationRef);

  // Đang kiểm tra auth state (khởi động app, đăng nhập/xuất)
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={onReady}>
      {/* Phân quyền dựa trên userRole */}
      {userRole === 'CITIZEN' && <CitizenStack />}
      {userRole === 'RESCUER' && <RescuerStack />}
      {!['CITIZEN', 'RESCUER'].includes(userRole) && <AuthStack />}
    </NavigationContainer>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default RootNavigator;
