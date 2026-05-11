/**
 * App.js — Entry point của ứng dụng Cứu hộ
 * ---------------------------------------------------------------------------
 * Bọc toàn bộ ứng dụng trong AuthProvider và render RootNavigator.
 *
 * Cấu trúc:
 *   <AuthProvider>        ← Cung cấp userRole, signIn, signOut cho toàn app
 *     <RootNavigator>     ← Phân quyền điều hướng theo role
 *       AuthStack         ← userRole === null
 *       CitizenStack      ← userRole === 'CITIZEN'
 *       RescuerStack      ← userRole === 'RESCUER'
 *     </RootNavigator>
 *   </AuthProvider>
 * ---------------------------------------------------------------------------
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      {/* StatusBar: tự động điều chỉnh theo nền của từng Stack */}
      <StatusBar style="auto" />
      <RootNavigator />
    </AuthProvider>
  );
}
