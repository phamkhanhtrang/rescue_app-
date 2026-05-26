/**
 * src/screens/auth/rescuer/RescuerLoginScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Đăng nhập — Đội cứu hộ.
 *
 * Design theme: TỐI — Navy/Dark, red accent, chuyên nghiệp quân sự.
 *
 * Bố cục:
 *  1. Status bar tối + Background pattern
 *  2. Logo SENTINEL + "COMMAND ACCESS" badge
 *  3. "XÁC THỰC DANH TÍNH" title lớn
 *  4. Form:
 *     - ID Đội / Email (icon)
 *     - Mật khẩu
 *     - Mã xác thực đội (Team Code)
 *  5. Blockchain note
 *  6. Nút "XÁC NHẬN DANH TÍNH →" (đỏ, loading)
 *  7. Link → Chưa có tài khoản? Đăng ký đội
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, ActivityIndicator,
  StatusBar, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../services/api';

// ─── Design tokens (tối) ─────────────────────────────────────────────────────
const C = {
  bg: '#0B1220',
  bgCard: '#111E30',
  bgCardLight: '#162030',
  bgInput: '#0F1B2D',
  primary: '#E53935',       // red
  primaryDark: '#B71C1C',
  primaryGlow: 'rgba(229,57,53,0.25)',
  blue: '#1E88E5',
  teal: '#00BCD4',
  white: '#FFFFFF',
  textWhite: 'rgba(255,255,255,0.95)',
  textDim: 'rgba(255,255,255,0.55)',
  textHint: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.10)',
  borderFocus: '#E53935',
  error: '#FF5252',
  green: '#43A047',
};

const RescuerLoginScreen = ({ navigation }) => {
  const { signIn } = useAuth();
  const [teamId, setTeamId] = useState('');
  const [password, setPassword] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);

  // Senior Tip: Sử dụng useMemo để object trả về từ f('id') không bị tạo mới liên tục, 
  // tránh việc TextInput bị re-mount hoặc mất focus khi đang gõ.
  const f = React.useMemo(() => (id) => ({
    onFocus: () => setFocused(id),
    onBlur: () => setFocused(null),
  }), []);

  // Typing animation for title
  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Shake
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    console.log("🔘 Nút Đăng nhập đã được bấm!");
    setError('');
    if (!teamId.trim()) { setError('Vui lòng nhập ID đội hoặc email.'); shake(); return; }
    if (!password.trim()) { setError('Vui lòng nhập mật khẩu.'); shake(); return; }
    // if (!teamCode.trim()) { setError('Vui lòng nhập mã xác thực đội.'); shake(); return; }

    setLoading(true);
    try {
      console.log("📡 Đang gửi yêu cầu đăng nhập với:", { login_input: teamId });
      const result = await API.auth.login({
        login_input: teamId,
        password: password,
      });
      console.log("📥 Kết quả nhận về từ Server:", result);
      if (result && (result.access || result.token)) {
        const token = result.access || result.token;
        const user = result.user;

        // KIỂM TRA ROLE: Chỉ cho phép RESCUER
        if (user.role !== 'RESCUER') {
          console.log("🚫 Từ chối truy cập: Vai trò không phải RESCUER", user.role);
          setError('Tài khoản này không có quyền truy cập vào cổng Cứu hộ.');
          shake();
          return;
        }

        console.log("✅ Đăng nhập cứu hộ thành công!");

        // signIn(role, info, token)
        await signIn('RESCUER', user, token);
      } else {
        const errorMsg = result.error || "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
        setError(errorMsg);
        shake();
      }
    } catch (e) {
      console.error("🔥 Lỗi hệ thống khi đăng nhập:", e);
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

      {/* Background pattern */}
      <View style={styles.bgPattern} pointerEvents="none">
        {[...Array(6)].map((_, i) => (
          <View key={i} style={[styles.bgLine, { top: `${i * 18}%`, opacity: 0.03 + i * 0.005 }]} />
        ))}
      </View>
      <View style={styles.bgGlow} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.commandBadge}>
              <View style={styles.commandDot} />
              <Text style={styles.commandText}>COMMAND ACCESS</Text>
            </View>
          </View>

          {/* ── Logo + Title ───────────────────────────────────────────────── */}
          <View style={styles.heroSection}>
            <View style={styles.shieldOuter}>
              <View style={styles.shieldInner}>
                <MaterialCommunityIcons
                  name="shield-outline"
                  size={38}
                  color="#fff"
                />
              </View>
            </View>

            <Text style={styles.pageTitle}>XÁC THỰC{'\n'}DANH TÍNH</Text>

          </View>

          {/* ── Form ───────────────────────────────────────────────────────── */}
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>

            {/* ID Đội */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>◈  ID ĐỘI / EMAIL ĐĂNG KÝ</Text>
              <View style={[styles.inputWrap, focused === 'id' && styles.inputWrapFocus]}>
                <MaterialCommunityIcons
                  name="shield-cross"
                  size={20}
                  color="#666"
                />
                <TextInput
                  style={styles.input}
                  placeholder="TEAM-01 hoặc email@rescue..."
                  placeholderTextColor={C.textHint}
                  value={teamId}
                  onChangeText={setTeamId}
                  autoCapitalize="none"

                />
              </View>
            </View>

            {/* Mật khẩu */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>◈  MẬT KHẨU</Text>
              <View style={[styles.inputWrap, focused === 'pass' && styles.inputWrapFocus]}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={20}
                  color="#666"
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={C.textHint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}

                />
                <TouchableOpacity
                  onPress={() => setShowPass(s => !s)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
            </View>


            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Blockchain note */}
            {/* <View style={styles.blockchainNote}>
              <Text style={styles.bnIcon}>⛓</Text>
              <Text style={styles.bnText}>
                Phiên đăng nhập được mã hóa và ghi nhận trên blockchain SENTINEL
              </Text>
            </View> */}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonLoading]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFF" size="small" />
                : (
                  <View style={styles.loginButtonInner}>
                    <Text style={styles.loginButtonText}>XÁC NHẬN DANH TÍNH</Text>
                    <Text style={styles.loginButtonArrow}> →</Text>
                  </View>
                )
              }
            </TouchableOpacity>

          </Animated.View>



          {/* ── Register link ─────────────────────────────────────────────── */}
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
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 22 },

  // BG
  bgPattern: { position: 'absolute', inset: 0 },
  bgLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#FFF' },
  bgGlow: { position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(229,57,53,0.07)' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backIcon: { fontSize: 18, color: C.white, fontWeight: '700' },
  commandBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(229,57,53,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(229,57,53,0.3)' },
  commandDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary },
  commandText: { fontSize: 11, fontWeight: '800', color: C.primary, letterSpacing: 1 },

  // Hero
  heroSection: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  shieldOuter: { width: 88, height: 88, borderRadius: 24, backgroundColor: 'rgba(229,57,53,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(229,57,53,0.3)' },
  shieldInner: { width: 64, height: 64, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 10 },
  shieldText: { fontSize: 32 },
  systemLabel: { fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 4 },
  pageTitle: { fontSize: 34, fontWeight: '900', color: C.white, textAlign: 'center', lineHeight: 42, letterSpacing: 1 },
  cursorWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pageTitleSub: { fontSize: 11, color: C.textDim, letterSpacing: 2 },
  cursor: { fontSize: 14, color: C.primary, fontWeight: '900' },

  // Form card
  formCard: { backgroundColor: C.bgCard, borderRadius: 20, padding: 20, gap: 16, borderWidth: 1, borderColor: C.border },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: C.textDim, letterSpacing: 1.2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, gap: 8, height: 52 },
  inputWrapFocus: { borderColor: C.borderFocus, shadowColor: C.primaryGlow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  inputPfx: { fontSize: 16 },
  input: { flex: 1, fontSize: 15, color: C.textWhite, height: '100%' },
  codeInput: { letterSpacing: 3, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  fieldHint: { fontSize: 11, color: C.textHint },

  // Error
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,82,82,0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,82,82,0.25)' },
  errorIcon: { fontSize: 13, marginTop: 1 },
  errorText: { flex: 1, fontSize: 12, color: C.error, fontWeight: '600', lineHeight: 18 },

  // Blockchain note
  blockchainNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(0,188,212,0.08)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,188,212,0.15)' },
  bnIcon: { fontSize: 13, marginTop: 1 },
  bnText: { flex: 1, fontSize: 11, color: 'rgba(0,188,212,0.8)', lineHeight: 17 },

  // Login button
  loginButton: { backgroundColor: C.primary, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  loginButtonLoading: { backgroundColor: C.primaryDark },
  loginButtonInner: { flexDirection: 'row', alignItems: 'center' },
  loginButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  loginButtonArrow: { color: '#FFF', fontSize: 18, fontWeight: '900' },

  // Demo
  demoButton: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  demoText: { fontSize: 13, color: C.textDim, fontWeight: '600' },

  // Register
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { fontSize: 14, color: C.textDim },
  registerLink: { fontSize: 14, color: C.primary, fontWeight: '700' },
});

export default RescuerLoginScreen;
