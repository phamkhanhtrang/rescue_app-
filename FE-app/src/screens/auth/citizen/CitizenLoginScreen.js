/**
 * src/screens/auth/citizen/CitizenLoginScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Đăng nhập — Người dân.
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
import CustomModal from '../../../components/common/CustomModal';

const C = {
  bg: '#F7F9FC',
  white: '#FFFFFF',
  primary: '#1565C0',
  primaryLight: '#E3F2FD',
  primaryDark: '#0D47A1',
  text: '#0D1A2D',
  textSub: '#546E7A',
  textHint: '#90A4AE',
  border: '#CFD8DC',
  borderFocus: '#1565C0',
  error: '#D32F2F',
  shadow: 'rgba(21,101,192,0.15)',
};

const CitizenLoginScreen = ({ navigation }) => {
  const { signIn } = useAuth();
  const [data, setData] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    setError('');
    if (!data.trim()) {
      setError('Vui lòng nhập số điện thoại hoặc email.');
      shake(); return;
    }
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu.');
      shake(); return;
    }

    setLoading(true);
    try {
      const result = await API.auth.login({
        login_input: data.trim(),
        password: password,
      });

      if (result && (result.ok || result.access || result.data?.access)) {
        const responseData = result.data ? result.data : result;
        const { user, access, refresh } = responseData;
        if (!access || user?.role !== 'CITIZEN') {
          API.auth.logout();
          setError('Vui lòng dùng màn đăng nhập phù hợp với vai trò tài khoản.');
          return;
        }
        await signIn('CITIZEN', user, access, refresh);
      } else {
        const errorMsg = result.data?.error || result.message || "Đăng nhập thất bại";
        setError(errorMsg);
        shake();
      }
    } catch (e) {
      const errorMsg = e?.message || 'Đăng nhập thất bại';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const handleForgotPassword = () => {
    setModalConfig({
      visible: true,
      type: 'info',
      title: 'Quên mật khẩu',
      message: 'Vui lòng liên hệ quản trị viên hệ thống để được hỗ trợ khôi phục mật khẩu.',
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>👤  NGƯỜI DÂN</Text>
            </View>
          </View>

          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
            <Text style={styles.pageTitle}>Xin chào!</Text>
            <Text style={styles.pageSubtitle}>
              Đăng nhập để nhận cảnh báo khẩn cấp{'\n'}và gửi tín hiệu SOS khi cần thiết.
            </Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>

            {/* Phone/Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Số điện thoại / Email</Text>
              <View style={[styles.inputWrap, focusedField === 'phone' && styles.inputWrapFocus]}>
                <Text style={styles.inputPrefix}>{data.includes('@') ? '✉️' : '📱'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0901 234 567 hoặc email@..."
                  placeholderTextColor={C.textHint}
                  value={data}
                  onChangeText={setData}
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mật khẩu</Text>
              <View style={[styles.inputWrap, focusedField === 'pass' && styles.inputWrapFocus]}>
                <Text style={styles.inputPrefix}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={C.textHint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  onFocus={() => setFocusedField('pass')}
                  onBlur={() => setFocusedField(null)}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPass(s => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.togglePass}>{showPass ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>⚠  {error}</Text> : null}

            <TouchableOpacity style={styles.forgotRow} onPress={() => navigation.navigate('Password', { mode: 'reset' })}>
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonLoading]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.loginButtonText}>ĐĂNG NHẬP</Text>
              }
            </TouchableOpacity>

          </Animated.View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>HOẶC</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register Link */}
          <TouchableOpacity
            style={styles.registerRow}
            onPress={() => navigation.navigate('CitizenRegister')}
          >
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <Text style={styles.registerLink}>Đăng ký ngay →</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
      <CustomModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={() => setModalConfig(prev => ({ ...prev, visible: false }))}
        onCancel={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  scroll: { flexGrow: 1, padding: 20, paddingTop: 12, paddingBottom: 80, gap: 20 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3 },
  backIcon: { fontSize: 18, color: C.text, fontWeight: '700' },
  roleChip: { backgroundColor: C.primaryLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: '#BBDEFB' },
  roleChipText: { fontSize: 12, fontWeight: '700', color: C.primary, letterSpacing: 0.5 },

  heroSection: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#BBDEFB' },
  avatarEmoji: { fontSize: 36 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: C.text },
  pageSubtitle: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 19 },

  formCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: C.textSub, letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, gap: 8, height: 52 },
  inputWrapFocus: { borderColor: C.borderFocus, backgroundColor: C.white },
  inputPrefix: { fontSize: 16 },
  input: { flex: 1, fontSize: 15, color: C.text, height: '100%' },
  togglePass: { fontSize: 16 },

  errorText: { fontSize: 12, color: C.error, fontWeight: '600' },
  forgotRow: { alignItems: 'flex-end' },
  forgotText: { fontSize: 13, color: C.primary, fontWeight: '600' },

  loginButton: { backgroundColor: C.primary, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', shadowColor: C.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6 },
  loginButtonLoading: { backgroundColor: C.primaryDark },
  loginButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 11, color: C.textHint, fontWeight: '600' },

  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { fontSize: 14, color: C.textSub },
  registerLink: { fontSize: 14, color: C.primary, fontWeight: '700' },
});

export default CitizenLoginScreen;
