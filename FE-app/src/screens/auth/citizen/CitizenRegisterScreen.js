/**
 * src/screens/auth/citizen/CitizenRegisterScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Đăng ký — Người dân.
 *
 * Bố cục (light theme, blue accent):
 *  1. Header: back arrow + "ĐĂNG KÝ" chip
 *  2. Hero: icon + title + subtitle
 *  3. Form:
 *     - Họ và tên
 *     - Số điện thoại
 *     - Email
 *     - Địa chỉ thường trú (tỉnh/thành)
 *     - Mật khẩu (hiện/ẩn)
 *     - Xác nhận mật khẩu
 *  4. Điều khoản (checkbox)
 *  5. Nút ĐĂNG KÝ (blue, loading)
 *  6. Link → Đã có tài khoản? Đăng nhập
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef } from 'react';
import API from '../../../services/api'; 
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, ActivityIndicator,
  StatusBar, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
const C = {
  bg:           '#F7F9FC',
  white:        '#FFFFFF',
  primary:      '#1565C0',
  primaryLight: '#E3F2FD',
  primaryDark:  '#0D47A1',
  green:        '#2E7D32',
  greenLight:   '#E8F5E9',
  text:         '#0D1A2D',
  textSub:      '#546E7A',
  textHint:     '#90A4AE',
  border:       '#CFD8DC',
  borderFocus:  '#1565C0',
  error:        '#D32F2F',
};

const PROVINCES = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Khác'];

// ── Reusable FormField ────────────────────────────────────────────────────────
const FormField = ({ label, icon, placeholder, value, onChangeText, keyboardType, secureTextEntry, suffix, onFocus, onBlur, isFocused }) => (
  <View style={ffStyles.group}>
    <Text style={ffStyles.label}>{label}</Text>
    <View style={[ffStyles.wrap, isFocused && ffStyles.wrapFocus]}>
      <Text style={ffStyles.icon}>{icon}</Text>
      <TextInput
        style={ffStyles.input}
        placeholder={placeholder}
        placeholderTextColor={C.textHint}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {suffix}
    </View>
  </View>
);

const ffStyles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: C.textSub, letterSpacing: 0.5 },
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, gap: 8, height: 52 },
  wrapFocus: { borderColor: C.borderFocus, backgroundColor: C.white },
  icon: { fontSize: 16 },
  input: { flex: 1, fontSize: 15, color: C.text },
});

// ── CitizenRegisterScreen ─────────────────────────────────────────────────────
const CitizenRegisterScreen = ({ navigation }) => {
  const { signIn } = useAuth();

  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [email,      setEmail]      = useState('');
  const [province,   setProvince]   = useState('');
  const [showProv,   setShowProv]   = useState(false);
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [agreed,     setAgreed]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [focused,    setFocused]    = useState(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  
  const handleRegister = async () => {
    setError('');
    if (!name.trim())    { setError('Vui lòng nhập họ và tên.'); shake(); return; }
    if (!phone.trim())   { setError('Vui lòng nhập số điện thoại.'); shake(); return; }
    if (!password)       { setError('Vui lòng nhập mật khẩu.'); shake(); return; }
    if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); shake(); return; }
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); shake(); return; }
    if (!agreed) { setError('Vui lòng đồng ý với điều khoản sử dụng.'); shake(); return; }

    setLoading(true);
    try {
      const result = await API.citizens.create({
        full_name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: password,
      }); 

      // Lưu token và thông tin user (tùy API trả về)
      // await storage.set('token', result.data.token);
      await signIn('CITIZEN', {
        username: result.user.username,
        password: result.user.password,
        email: result.user.email,
        phone: result.user.phone,
      });
    } catch (e) {
      setError('Đăng ký thất bại. Vui lòng thử lại.');
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

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>👤  TẠO TÀI KHOẢN</Text>
            </View>
          </View>

          {/* ── Hero ───────────────────────────────────────────────────────── */}
          <View style={styles.heroSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>🧑‍💼</Text>
            </View>
            <Text style={styles.pageTitle}>Tạo tài khoản</Text>
            <Text style={styles.pageSubtitle}>Đăng ký để được bảo vệ bởi hệ thống{'\n'}SENTINEL Blockchain · AI Rescuer</Text>
          </View>

          {/* ── Form ───────────────────────────────────────────────────────── */}
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>

            <FormField
              label="HỌ VÀ TÊN ĐẦY ĐỦ"
              icon="🧑"
              placeholder="Nguyễn Văn A"
              value={name}
              onChangeText={setName}
              {...f('name')}
            />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="SỐ ĐIỆN THOẠI"
                  icon="📱"
                  placeholder="0901 234 567"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  {...f('phone')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="EMAIL"
                  icon="✉️"
                  placeholder="email@..."
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  {...f('email')}
                />
              </View>
            </View>

            {/* Province picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TỈNH / THÀNH PHỐ</Text>
              <TouchableOpacity
                style={[styles.inputWrap, focused === 'prov' && styles.inputWrapFocus]}
                onPress={() => setShowProv(s => !s)}
              >
                <Text style={styles.inputPrefix}>📍</Text>
                <Text style={[styles.inputText, !province && { color: C.textHint }]}>
                  {province || 'Chọn tỉnh / thành phố'}
                </Text>
                <Text style={styles.dropIcon}>{showProv ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showProv && (
                <View style={styles.dropdownList}>
                  {PROVINCES.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.dropdownItem, province === p && styles.dropdownItemActive]}
                      onPress={() => { setProvince(p); setShowProv(false); }}
                    >
                      <Text style={[styles.dropdownText, province === p && styles.dropdownTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={styles.sectionDivider}>
              <View style={styles.dividerLine} /><Text style={styles.dividerLabel}>Bảo mật</Text><View style={styles.dividerLine} />
            </View>

            {/* Mật khẩu */}
            <FormField
              label="MẬT KHẨU"
              icon="🔒"
              placeholder="Tối thiểu 6 ký tự"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              suffix={
                <TouchableOpacity onPress={() => setShowPass(s => !s)}>
                  <Text>{showPass ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              }
              {...f('pass')}
            />

            <FormField
              label="XÁC NHẬN MẬT KHẨU"
              icon="🔐"
              placeholder="Nhập lại mật khẩu"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConf}
              suffix={
                <TouchableOpacity onPress={() => setShowConf(s => !s)}>
                  <Text>{showConf ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              }
              {...f('conf')}
            />

            {/* Strength bar */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                <Text style={styles.strengthLabel}>Độ mạnh: </Text>
                {[1,2,3,4].map(i => (
                  <View key={i} style={[styles.strengthBar, { backgroundColor: password.length >= i * 3 ? (password.length >= 10 ? C.green : C.primary) : C.border }]} />
                ))}
              </View>
            )}

            {/* Error */}
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

          {/* ── Link to Login ─────────────────────────────────────────────── */}
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
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3 },
  backIcon: { fontSize: 18, color: C.text, fontWeight: '700' },
  roleChip: { backgroundColor: C.primaryLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: '#BBDEFB' },
  roleChipText: { fontSize: 12, fontWeight: '700', color: C.primary, letterSpacing: 0.5 },

  // Hero
  heroSection: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  avatarCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#BBDEFB' },
  avatarEmoji: { fontSize: 34 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: C.text },
  pageSubtitle: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 19 },

  // Form
  formCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  row2: { flexDirection: 'row', gap: 12 },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: C.textSub, letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, gap: 8, height: 52 },
  inputWrapFocus: { borderColor: C.borderFocus, backgroundColor: C.white },
  inputPrefix: { fontSize: 16 },
  inputText: { flex: 1, fontSize: 15, color: C.text },
  dropIcon: { fontSize: 10, color: C.textHint },

  dropdownList: { backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownItemActive: { backgroundColor: C.primaryLight },
  dropdownText: { fontSize: 14, color: C.text },
  dropdownTextActive: { color: C.primary, fontWeight: '700' },

  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: { fontSize: 11, color: C.textHint, fontWeight: '600' },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strengthLabel: { fontSize: 11, color: C.textSub },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },

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
