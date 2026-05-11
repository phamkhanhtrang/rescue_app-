import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken } from '../services/apiClient';

// ─── Định nghĩa Context ───────────────────────────────────────────────────────

const AuthContext = createContext(null);

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

        if (storedToken && storedRole && storedUserData) {
          setUserToken(storedToken);
          setUserRole(storedRole);
          setUserInfo(JSON.parse(storedUserData));
          
          // QUAN TRỌNG: Thiết lập token cho apiClient
          setAuthToken(storedToken);
        }
      } catch (e) {
        console.error('Lỗi khi tải dữ liệu từ AsyncStorage:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadStorageData();
  }, []);

  /**
   * Đăng nhập: Lưu token và thông tin vào AsyncStorage
   */
  const signIn = useCallback(async (role, info = {}, token) => {
    setIsLoading(true);
    try {
      setUserInfo(info);
      setUserRole(role);
      setUserToken(token);
      
      // Thiết lập token cho apiClient
      setAuthToken(token);

      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(info));
      await AsyncStorage.setItem('userRole', role);
    } catch (e) {
      console.error('Lỗi khi lưu thông tin đăng nhập:', e);
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
      // Xóa token khỏi apiClient
      setAuthToken(null);

      // Xóa các key liên quan đến xác thực
      const keys = ['userToken', 'userData', 'userRole'];
      await AsyncStorage.multiRemove(keys);

      // Reset state về null
      setUserInfo(null);
      setUserRole(null);
      setUserToken(null);
    } catch (e) {
      console.error('Lỗi khi đăng xuất:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoize giá trị context để tránh re-render không cần thiết
  const value = useMemo(
    () => ({
      userRole,
      userInfo,
      userToken,
      isLoading,
      signIn,
      signOut,
      isCitizen: userRole === 'CITIZEN',
      isRescuer: userRole === 'RESCUER',
      isAuthenticated: userToken !== null,
    }),
    [userRole, userInfo, userToken, isLoading, signIn, signOut]
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


