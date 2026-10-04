/**
 * src/screens/auth/rescuer/RescuerLoginScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Đăng nhập — Đội cứu hộ (Theme tối).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, ActivityIndicator,
  StatusBar, Animated, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../services/api';

const C = {
  bg: '#0B1220',
  bgCard: '#111E30',
  bgInput: '#0F1B2D',
  primary: '#E53935',
  primaryDark: '#B71C1C',
  primaryGlow: 'rgba(229,57,53,0.2)',
  blue: '#1E88E5',
  teal: '#00BCD4',
  white: '#FFFFFF',
  textWhite: 'rgba(255,255,255,0.95)',
  textDim: 'rgba(255,255,255,0.55)',
  textHint: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.10)',
  borderFocus: '#E53935',
  error: '#FF5252',
};

const RescuerLoginScreen = ({ navigation }) => {
  const { signIn } = useAuth();

  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    setError('');
    if (!loginInput.trim()) {
      setError('Vui lòng nhập Số điện thoại hoặc Mã cứu hộ.');
      shake(); return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      shake(); return;
    }

    setLoading(true);
    try {
      const result = await API.auth.login({
        login_input: loginInput.trim(),
        password: password,
      });

      if (result && (result.access || result.token)) {
        const token = result.access || result.token;
        const user = result.user;

        if (user.role !== 'RESCUER') {
          setError('Tài khoản này không có quyền truy cập vào cổng Cứu hộ.');
          shake();
          return;
        }
        await signIn('RESCUER', user, token, result.refresh);
      } else {
        const errorMsg = result.error || "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
        setError(errorMsg);
        shake();
      }
    } catch (e) {
      const errorMsg = e?.message || e?.data?.error || 'Xác thực thất bại. Kiểm tra lại thông tin đội.';
      setError(errorMsg);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <TouchableOpacity onPress={() => navigation.navigate('Password', { mode: 'reset' })} style={{ padding: 16 }}>
        <Text style={{ color: '#90CAF9', textAlign: 'right' }}>Quên mật khẩu?</Text>
      </TouchableOpacity>
      <View style={styles.bgGlow} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.commandBadge}>
              <View style={styles.commandDot} />
              <Text style={styles.commandText}>RESCUER PORTAL</Text>
            </View>
          </View>

          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={styles.shieldOuter}>
              <View style={styles.shieldInner}>
                <Text style={styles.shieldText}>🛡</Text>
              </View>
            </View>
            <Text style={styles.systemLabel}>TRUNG TÂM ĐIỀU PHỐI</Text>
            <Text style={styles.pageTitle}>Đăng nhập Cứu hộ</Text>
          </View>

          {/* Form Card */}
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>

            {/* Login Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SỐ ĐIỆN THOẠI / MÃ CỨU HỘ</Text>
              <View style={[styles.inputWrap, focusedField === 'login' && styles.inputWrapFocus]}>
                <Text style={styles.inputPfx}>📱</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập SĐT hoặc Mã định danh"
                  placeholderTextColor={C.textHint}
                  value={loginInput}
                  onChangeText={setLoginInput}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('login')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>MẬT KHẨU</Text>
              <View style={[styles.inputWrap, focusedField === 'pass' && styles.inputWrapFocus]}>
                <Text style={styles.inputPfx}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={C.textHint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  onFocus={() => setFocusedField('pass')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPass(s => !s)}>
                  <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonLoading]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.loginButtonText}>ĐĂNG NHẬP HỆ THỐNG  →</Text>
              }
            </TouchableOpacity>

          </Animated.View>

          {/* Register Row */}
          <TouchableOpacity
            style={styles.registerRow}
            onPress={() => navigation.navigate('RescuerRegister')}
          >
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <Text style={styles.registerLink}>Đăng ký đội cứu hộ →</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  scroll: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: 22 },
  bgGlow: { position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(229,57,53,0.07)' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backIcon: { fontSize: 18, color: C.white, fontWeight: '700' },
  commandBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(229,57,53,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(229,57,53,0.3)' },
  commandDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary },
  commandText: { fontSize: 11, fontWeight: '800', color: C.primary, letterSpacing: 1 },

  heroSection: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  shieldOuter: { width: 88, height: 88, borderRadius: 24, backgroundColor: 'rgba(229,57,53,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(229,57,53,0.3)' },
  shieldInner: { width: 64, height: 64, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 10 },
  shieldText: { fontSize: 32 },
  systemLabel: { fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 4 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: C.white, textAlign: 'center' },

  formCard: { backgroundColor: C.bgCard, borderRadius: 20, padding: 20, gap: 16, borderWidth: 1, borderColor: C.border },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: C.textDim, letterSpacing: 1.2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, gap: 8, height: 52 },
  inputWrapFocus: { borderColor: C.borderFocus },
  inputPfx: { fontSize: 16 },
  input: { flex: 1, fontSize: 15, color: C.textWhite, height: '100%' },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,82,82,0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,82,82,0.25)' },
  errorIcon: { fontSize: 13, marginTop: 1 },
  errorText: { flex: 1, fontSize: 12, color: C.error, fontWeight: '600', lineHeight: 18 },

  loginButton: { backgroundColor: C.primary, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  loginButtonLoading: { backgroundColor: C.primaryDark },
  loginButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },

  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { fontSize: 14, color: C.textDim },
  registerLink: { fontSize: 14, color: C.primary, fontWeight: '700' },
});

export default RescuerLoginScreen;
