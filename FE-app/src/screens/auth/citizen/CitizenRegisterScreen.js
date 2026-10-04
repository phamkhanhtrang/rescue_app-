/**
 * src/screens/auth/citizen/CitizenRegisterScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Đăng ký — Người dân.
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

const FormField = ({ label, icon, placeholder, value, onChangeText, keyboardType, secureTextEntry, isFocused, onFocus, onBlur, autoCapitalize }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.inputWrap, isFocused && styles.inputWrapFocus]}>
      {icon && <Text style={styles.inputPrefix}>{icon}</Text>}
      <TextInput
        style={styles.inputText}
        placeholder={placeholder}
        placeholderTextColor={C.textHint}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize || 'none'}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
  </View>
);

const CitizenRegisterScreen = ({ navigation }) => {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    setError('');
    if (!name.trim()) { setError('Vui lòng nhập họ và tên.'); shake(); return; }
    if (!phone.trim()) { setError('Vui lòng nhập số điện thoại.'); shake(); return; }
    if (!password) { setError('Vui lòng nhập mật khẩu.'); shake(); return; }
    if (password.length < 8) { setError('Mật khẩu phải có ít nhất 8 ký tự.'); shake(); return; }
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); shake(); return; }
    if (!agreed) { setError('Vui lòng đồng ý với điều khoản sử dụng.'); shake(); return; }

    setLoading(true);
    try {
      const login = await API.citizens.create({
        full_name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: password,
      });

      if (!login.access || login.user?.role !== 'CITIZEN') throw new Error('Không thể tạo phiên đăng nhập.');
      await signIn('CITIZEN', login.user, login.access, login.refresh);
    } catch (e) {
      setError(e?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
      shake();
    } finally {
      setLoading(false);
    }
  };

  const f = (key) => ({
    isFocused: focused === key,
    onFocus: () => setFocused(key),
    onBlur: () => setFocused(null),
  });

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
              <Text style={styles.roleChipText}>👤  TẠO TÀI KHOẢN</Text>
            </View>
          </View>

          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>🧑‍💼</Text>
            </View>
            <Text style={styles.pageTitle}>Tạo tài khoản</Text>
            <Text style={styles.pageSubtitle}>Đăng ký để được bảo vệ bởi hệ thống{'\n'}SENTINEL Blockchain · AI Rescuer</Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>

            <FormField
              label="HỌ VÀ TÊN ĐẦY ĐỦ *"
              icon="🧑"
              placeholder="Nguyễn Văn A"
              value={name}
              onChangeText={setName}
              {...f('name')}
            />

            <FormField
              label="SỐ ĐIỆN THOẠI *"
              icon="📱"
              placeholder="0901 234 567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              {...f('phone')}
            />

            <FormField
              label="EMAIL (TÙY CHỌN)"
              icon="✉️"
              placeholder="email@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              {...f('email')}
            />

            <FormField
              label="MẬT KHẨU *"
              icon="🔒"
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              {...f('password')}
            />

            <FormField
              label="XÁC NHẬN MẬT KHẨU *"
              icon="🔐"
              placeholder="Nhập lại mật khẩu"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              {...f('confirm')}
            />

            {error ? <Text style={styles.errorText}>⚠  {error}</Text> : null}

            {/* Terms */}
            <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(a => !a)}>
              <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                {agreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                Tôi đồng ý với <Text style={styles.termsLink}>Điều khoản sử dụng</Text> và{' '}
                <Text style={styles.termsLink}>Chính sách bảo mật</Text> của SENTINEL
              </Text>
            </TouchableOpacity>

            {/* CTA */}
            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonLoading]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.registerButtonText}>TẠO TÀI KHOẢN  →</Text>
              }
            </TouchableOpacity>

          </Animated.View>

          {/* Link to Login */}
          <TouchableOpacity
            style={styles.loginRow}
            onPress={() => navigation.navigate('CitizenLogin')}
          >
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <Text style={styles.loginLink}>Đăng nhập →</Text>
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
  scroll: { flexGrow: 1, padding: 20, paddingTop: 12, paddingBottom: 80, gap: 20 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3 },
  backIcon: { fontSize: 18, color: C.text, fontWeight: '700' },
  roleChip: { backgroundColor: C.primaryLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: '#BBDEFB' },
  roleChipText: { fontSize: 12, fontWeight: '700', color: C.primary, letterSpacing: 0.5 },

  heroSection: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  avatarCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#BBDEFB' },
  avatarEmoji: { fontSize: 34 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: C.text },
  pageSubtitle: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 19 },

  formCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: C.textSub, letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, gap: 8, height: 52 },
  inputWrapFocus: { borderColor: C.borderFocus, backgroundColor: C.white },
  inputPrefix: { fontSize: 16 },
  inputText: { flex: 1, fontSize: 15, color: C.text },

  errorText: { fontSize: 12, color: C.error, fontWeight: '600' },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  termsText: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 18 },
  termsLink: { color: C.primary, fontWeight: '700' },

  registerButton: { backgroundColor: C.primary, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', shadowColor: 'rgba(21,101,192,0.3)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6 },
  registerButtonLoading: { backgroundColor: C.primaryDark },
  registerButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: 14, color: C.textSub },
  loginLink: { fontSize: 14, color: C.primary, fontWeight: '700' },
});

export default CitizenRegisterScreen;
