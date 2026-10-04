import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import API from '../services/api';
import { apiClient } from '../services/apiClient';
import { setAuthSession, setAuthFailureHandler } from '../services/apiClient';
import { unregisterPushDevice, cancelPushRegistration } from '../services/pushSession';
import { setAlertLocation } from '../services/alertPolicy';

// ─── Định nghĩa Context ───────────────────────────────────────────────────────

const AuthContext = createContext(null);

const decodeJwtPayload = (token) => {
  try {
    const parts = (token || '').split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'function') {
      return JSON.parse(atob(base64));
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = base64.replace(/=+$/, '');
    let output = '';
    for (let bc = 0, bs = 0, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
      buffer = chars.indexOf(buffer);
    }
    return JSON.parse(output);
  } catch {
    return null;
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null); // null | 'CITIZEN' | 'RESCUER'
  const [userInfo, setUserInfo] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Mặc định là true để kiểm tra token khi khởi động

  /**
   * Tự động kiểm tra trạng thái đăng nhập khi khởi động ứng dụng
   */
  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedRole = await AsyncStorage.getItem('userRole');
        const storedUserData = await AsyncStorage.getItem('userData');
        const storedRefresh = await AsyncStorage.getItem('refreshToken');

        if (storedToken && storedRole && storedUserData) {
          const storedInfo = JSON.parse(storedUserData);
          const payload = decodeJwtPayload(storedToken);
          if (payload?.role && payload.role !== storedRole) throw new Error('Vai trò phiên không khớp.');
          if (payload?.exp && payload.exp * 1000 < Date.now()) throw new Error('Phiên đăng nhập đã hết hạn.');
          if (!storedInfo?.id || !['CITIZEN', 'RESCUER'].includes(storedRole)) throw new Error('Phiên lưu không hợp lệ.');
          setUserToken(storedToken);
          setUserRole(storedRole);
          setUserInfo(storedInfo);
          
          // QUAN TRỌNG: Thiết lập token cho apiClient
          setAuthSession(storedToken, storedRefresh);
        }
      } catch (e) {
        console.error('Lỗi khi tải dữ liệu từ AsyncStorage:', e);
        setAuthSession(null, null);
        setUserInfo(null); setUserRole(null); setUserToken(null);
        await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'userData', 'userRole']).catch(() => {});
      } finally {
        setIsLoading(false);
      }
    };

    loadStorageData();
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => {
      cancelPushRegistration();
      setAlertLocation(null);
      setUserInfo(null); setUserRole(null); setUserToken(null); setIsLoading(false);
    });
    return () => setAuthFailureHandler(null);
  }, []);

  /**
   * Đăng nhập: Lưu token và thông tin vào AsyncStorage
   */
  const signIn = useCallback(async (role, info = {}, token, refresh) => {
    setIsLoading(true);
    try {
      if (!token) throw new Error('Không nhận được phiên đăng nhập từ máy chủ.');
      const payload = decodeJwtPayload(token);
      if (payload?.role && payload.role !== role) {
        throw new Error('Vai trò tài khoản không khớp với luồng đăng nhập.');
      }
      setUserInfo(info);
      setUserRole(role);
      setUserToken(token);
      
      // Thiết lập token cho apiClient
      setAuthSession(token, refresh);

      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(info));
      await AsyncStorage.setItem('userRole', role);
      if (refresh) await AsyncStorage.setItem('refreshToken', refresh);
      else await AsyncStorage.removeItem('refreshToken');
    } catch (e) {
      console.error('Lỗi khi lưu thông tin đăng nhập:', e);
      setAuthSession(null, null);
      setUserInfo(null); setUserRole(null); setUserToken(null);
      await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'userData', 'userRole']).catch(() => {});
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Đăng xuất: Xóa sạch dữ liệu khỏi AsyncStorage và State
   */
  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await unregisterPushDevice().catch(() => console.warn('Chưa hủy được push do mất kết nối. Nội dung push không chứa chi tiết bản tin.'));
      const refresh = await AsyncStorage.getItem('refreshToken');
      if (refresh) await apiClient('/accounts/logout/', { method: 'POST', body: JSON.stringify({ refresh }) }).catch(() => {});
      setAlertLocation(null);
      // Xóa token khỏi apiClient
      setAuthSession(null, null);

      // Xóa các key liên quan đến xác thực
      const keys = ['userToken', 'refreshToken', 'userData', 'userRole'];
      await AsyncStorage.multiRemove(keys);

      // Reset state về null
      setUserInfo(null);
      setUserRole(null);
      setUserToken(null);
    } catch (e) {
      console.error('Lỗi khi đăng xuất:', e);
    } finally {
      cancelPushRegistration();
      setAlertLocation(null);
      setAuthSession(null, null);
      setUserInfo(null); setUserRole(null); setUserToken(null);
      await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'userData', 'userRole']).catch(() => {});
      setIsLoading(false);
    }
  }, []);

  const updateUserInfo = useCallback(async (nextInfo) => {
    const value = typeof nextInfo === 'function' ? nextInfo(userInfo) : nextInfo;
    if (!value) return;
    setUserInfo(value);
    await AsyncStorage.setItem('userData', JSON.stringify(value));
  }, [userInfo]);

  useEffect(() => {
    if (!userToken || isLoading) return;
    let alive = true;
    const sync = async () => {
      try {
        const fresh = await API.auth.me();
        if (!alive) return;
        if (!['CITIZEN', 'RESCUER'].includes(fresh.role)) { await signOut(); return; }
        setUserInfo(fresh); setUserRole(fresh.role);
        await AsyncStorage.multiSet([['userData', JSON.stringify(fresh)], ['userRole', fresh.role]]);
      } catch { /* API client ends invalid sessions; retain offline access on network failure. */ }
    };
    sync();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    return () => { alive = false; listener.remove(); };
  }, [userToken, isLoading, signOut]);

  // Memoize giá trị context để tránh re-render không cần thiết
  const value = useMemo(
    () => ({
      userRole,
      userInfo,
      userToken,
      isLoading,
      signIn,
      signOut,
      updateUserInfo,
      isCitizen: userRole === 'CITIZEN',
      isRescuer: userRole === 'RESCUER',
      isAuthenticated: userToken !== null,
    }),
    [userRole, userInfo, userToken, isLoading, signIn, signOut, updateUserInfo]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Custom Hook ──────────────────────────────────────────────────────────────

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() phải được dùng bên trong <AuthProvider>');
  }
  return context;
};

export default AuthContext;


