/**
 * src/screens/auth/rescuer/RescuerRegisterScreen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Đăng ký — Đội cứu hộ.
 *
 * Design: TỐI (Navy/Dark + Red) — chuyên nghiệp.
 *
 * Bố cục (multi-step 3 bước):
 *  Bước 1 - THÔNG TIN CÁ NHÂN:
 *    - Họ và tên
 *    - Số điện thoại
 *    - Email
 *  Bước 2 - THÔNG TIN ĐỘI:
 *    - Đơn vị cứu hộ / Tổ chức
 *    - Số hiệu đội
 *    - Tỉnh/Thành phố
 *    - Chuyên môn (Multi-select: Tìm kiếm/Y tế/Hậu cần)
 *  Bước 3 - XÁC THỰC & BẢO MẬT:
 *    - Số chứng chỉ cứu hộ (ID)
 *    - Mật khẩu + Xác nhận
 *    - Điều khoản
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
  bg:           '#0B1220',
  bgCard:       '#111E30',
  bgInput:      '#0F1B2D',
  primary:      '#E53935',
  primaryDark:  '#B71C1C',
  primaryGlow:  'rgba(229,57,53,0.2)',
  blue:         '#1E88E5',
  teal:         '#00BCD4',
  white:        '#FFFFFF',
  textWhite:    'rgba(255,255,255,0.95)',
  textDim:      'rgba(255,255,255,0.55)',
  textHint:     'rgba(255,255,255,0.3)',
  border:       'rgba(255,255,255,0.10)',
  borderFocus:  '#E53935',
  error:        '#FF5252',
  green:        '#43A047',
  greenGlow:    'rgba(67,160,71,0.2)',
};

const SPECIALTIES = ['Tìm kiếm cứu nạn', 'Hỗ trợ y tế', 'Cứu hộ nước', 'Hậu cần', 'Kỹ thuật'];
const PROVINCES   = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Quảng Ngãi', 'Khác'];
const TOTAL_STEPS = 3;

// ── Step Progress Bar ──────────────────────────────────────────────────────────
const StepBar = ({ current }) => (
  <View style={spStyles.container}>
    {[1, 2, 3].map(s => (
      <React.Fragment key={s}>
        <View style={[spStyles.dot, s <= current && spStyles.dotActive, s === current && spStyles.dotCurrent]}>
          {s < current
            ? <Text style={spStyles.check}>✓</Text>
            : <Text style={spStyles.num}>{s}</Text>
          }
        </View>
        {s < 3 && <View style={[spStyles.line, s < current && spStyles.lineActive]} />}
      </React.Fragment>
    ))}
  </View>
);

const spStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  dotActive: { backgroundColor: 'rgba(229,57,53,0.15)', borderColor: C.primary },
  dotCurrent: { shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  num: { color: C.textDim, fontSize: 12, fontWeight: '700' },
  check: { color: C.primary, fontSize: 13, fontWeight: '900' },
  line: { flex: 1, height: 2, backgroundColor: C.border, maxWidth: 50 },
  lineActive: { backgroundColor: C.primary },
});

// ── DarkField ─────────────────────────────────────────────────────────────────
const DarkField = ({ label, icon, placeholder, value, onChange, keyboard, secure, suffix, focused, onFocus, onBlur, hint }) => (
  <View style={dfStyles.group}>
    <Text style={dfStyles.label}>◈  {label}</Text>
    <View style={[dfStyles.wrap, focused && dfStyles.wrapFocus]}>
      {icon && <Text style={dfStyles.icon}>{icon}</Text>}
      <TextInput
        style={dfStyles.input}
        placeholder={placeholder}
        placeholderTextColor={C.textHint}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard || 'default'}
        secureTextEntry={secure}
        autoCapitalize="none"
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {suffix}
    </View>
    {hint && <Text style={dfStyles.hint}>{hint}</Text>}
  </View>
);

const dfStyles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontSize: 10, fontWeight: '800', color: C.textDim, letterSpacing: 1 },
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, gap: 8, height: 52 },
  wrapFocus: { borderColor: C.borderFocus },
  icon: { fontSize: 16 },
  input: { flex: 1, fontSize: 14, color: C.textWhite },
  hint: { fontSize: 10, color: C.textHint },
});

// ── RescuerRegisterScreen ─────────────────────────────────────────────────────
export default function RescuerRegisterScreen({ navigation }) {
  const { signIn } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1 — Personal
  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [email,   setEmail]   = useState('');

  // Step 2 — Team
  const [unit,      setUnit]      = useState('');
  const [teamId,    setTeamId]    = useState('');
  const [province,  setProvince]  = useState('');
  const [showProv,  setShowProv]  = useState(false);
  const [specs,     setSpecs]     = useState([]);

  // Step 3 — Security
  const [certId,    setCertId]    = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [agreed,    setAgreed]    = useState(false);
  const [rank, setRank] = useState('');
  
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [focused,   setFocused]   = useState(null);
  

  const slideAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => Animated.sequence([
    Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
  ]).start();

  const slideToNextStep = () => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const validateStep = () => {
    setError('');
    if (step === 1) {
      if (!name.trim())  { setError('Vui lòng nhập họ và tên.'); shake(); return false; }
      if (!phone.trim()) { setError('Vui lòng nhập số điện thoại.'); shake(); return false; }
    }
    if (step === 2) {
      if (!unit.trim())     { setError('Vui lòng nhập đơn vị cứu hộ.'); shake(); return false; }
      if (!province)        { setError('Vui lòng chọn tỉnh/thành phố.'); shake(); return false; }
      if (specs.length < 1) { setError('Chọn ít nhất 1 chuyên môn.'); shake(); return false; }
    }
    if (step === 3) {
      if (!password)            { setError('Vui lòng nhập mật khẩu.'); shake(); return false; }
      if (password.length < 6)  { setError('Mật khẩu phải có ít nhất 6 ký tự.'); shake(); return false; }
      if (password !== confirm)  { setError('Mật khẩu xác nhận không khớp.'); shake(); return false; }
      if (!agreed)              { setError('Vui lòng đồng ý điều khoản.'); shake(); return false; }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS) {
      slideToNextStep();
      setStep(s => s + 1);
      return;
    }
    // Step 3: Submit
    setLoading(true);
    setError('');
    try {
      const registerData = {
        full_name: name,
        phone: phone,
        email: email || undefined,
        unit_name: unit,
        rank: rank,
        specialty: specs.join(', '),
        password: password,
        address: province,
      };

      console.log("📤 Đang gửi dữ liệu đăng ký cứu hộ:", registerData);
      
      const response = await API.rescuers.create(registerData);
      console.log("✅ Đăng ký thành công:", response);

       
      Alert.alert(
        "Đăng ký thành công",
        "Tài khoản của bạn đã được gửi. Vui lòng chờ quản trị viên phê duyệt trước khi đăng nhập.",
        [{ text: "OK", onPress: () => navigation.navigate('RescuerLogin') }]
      ); 
      
    } catch (e) {
      console.error("❌ Lỗi đăng ký cứu hộ:", e);
      const msg = e.data?.error || e.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      setError(msg);
      shake();
    } finally {
      setLoading(false);
    }
  };

  const toggleSpec = (s) => setSpecs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const f = (key) => ({ focused: focused === key, onFocus: () => setFocused(key), onBlur: () => setFocused(null) });

  const STEP_LABELS = ['THÔNG TIN CÁ NHÂN', 'THÔNG TIN ĐỘI', 'XÁC THỰC & BẢO MẬT'];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.bgGlow} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => step > 1 ? setStep(s => s - 1) : navigation.goBack()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>ĐĂNG KÝ ĐỘI CỨU HỘ</Text>
              <Text style={styles.headerSub}>{STEP_LABELS[step - 1]}</Text>
            </View>
            <View style={styles.stepCounter}>
              <Text style={styles.stepCounterText}>{step}/{TOTAL_STEPS}</Text>
            </View>
          </View>

          {/* ── Step bar ───────────────────────────────────────────────────── */}
          <StepBar current={step} />

          {/* ── Form ───────────────────────────────────────────────────────── */}
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }, { translateY: slideAnim }] }]}>

            {/* BƯỚC 1: Cá nhân */}
            {step === 1 && (
              <>
                <View style={styles.stepHeading}>
                  <Text style={styles.stepHeadingIcon}>🧑‍🚒</Text>
                  <View>
                    <Text style={styles.stepTitle}>Thông tin cá nhân</Text>
                    <Text style={styles.stepDesc}>Để xác minh danh tính của bạn trong đội</Text>
                  </View>
                </View>
                <DarkField label="HỌ VÀ TÊN ĐẦY ĐỦ" icon="🧑" placeholder="Nguyễn Văn A" value={name} onChange={setName} {...f('name')} />
                <DarkField label="SỐ ĐIỆN THOẠI" icon="📱" placeholder="0901 234 567" value={phone} onChange={setPhone} keyboard="phone-pad" {...f('phone')} />
                <DarkField label="EMAIL (TÙY CHỌN)" icon="✉️" placeholder="email@rescue.gov.vn" value={email} onChange={setEmail} keyboard="email-address" {...f('email')} />
              </>
            )}

            {/* BƯỚC 2: Đội */}
            {step === 2 && (
              <>
                <View style={styles.stepHeading}>
                  <Text style={styles.stepHeadingIcon}>🚒</Text>
                  <View>
                    <Text style={styles.stepTitle}>Thông tin đội cứu hộ</Text>
                    <Text style={styles.stepDesc}>Để AI phân công nhiệm vụ chính xác</Text>
                  </View>
                </View>

                <DarkField label="ĐƠN VỊ / TỔ CHỨC" icon="🏛" placeholder="PCCC Q1 / UBND TP.HCM / ..." value={unit} onChange={setUnit} {...f('unit')} hint="Tên cơ quan chủ quản của đội bạn" />
                <DarkField label="SỐ HIỆU ĐỘI (TÙY CHỌN)" icon="🔖" placeholder="TEAM-01" value={teamId} onChange={t => setTeamId(t.toUpperCase())} hint="Nếu đội đã có mã từ chỉ huy" {...f('tid')} />

                {/* Province picker */}
                <View style={dfStyles.group}>
                  <Text style={dfStyles.label}>◈  TỈNH / THÀNH PHỐ HOẠT ĐỘNG</Text>
                  <TouchableOpacity
                    style={[dfStyles.wrap, focused === 'prov' && dfStyles.wrapFocus]}
                    onPress={() => { setShowProv(s => !s); setFocused('prov'); }}
                  >
                    <Text style={dfStyles.icon}>📍</Text>
                    <Text style={[dfStyles.input, !province && { color: C.textHint }]}>
                      {province || 'Chọn địa bàn hoạt động...'}
                    </Text>
                    <Text style={{ color: C.textHint, fontSize: 10 }}>{showProv ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showProv && (
                    <View style={styles.dropdown}>
                      {PROVINCES.map(p => (
                        <TouchableOpacity key={p} style={[styles.dropItem, province === p && styles.dropItemActive]} onPress={() => { setProvince(p); setShowProv(false); }}>
                          <Text style={[styles.dropText, province === p && styles.dropTextActive]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Specialty multi-select */}
                <View style={dfStyles.group}>
                  <Text style={dfStyles.label}>◈  CHUYÊN MÔN (Chọn nhiều)</Text>
                  <View style={styles.specGrid}>
                    {SPECIALTIES.map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.specChip, specs.includes(s) && styles.specChipActive]}
                        onPress={() => toggleSpec(s)}
                      >
                        <Text style={[styles.specText, specs.includes(s) && styles.specTextActive]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* BƯỚC 3: Bảo mật */}
            {step === 3 && (
              <>
                <View style={styles.stepHeading}>
                  <Text style={styles.stepHeadingIcon}>🔐</Text>
                  <View>
                    <Text style={styles.stepTitle}>Xác thực & Bảo mật</Text>
                    <Text style={styles.stepDesc}>Mọi thông tin được ghi lên blockchain</Text>
                  </View>
                </View>

                <DarkField
                  label="Vai trò trong nhóm "
                  icon="🎓"
                  placeholder="Nhập cấp bậc trong nhóm ( chỉ áp dụng cho đội trưởng hoặc đội phó) "
                  value={rank}
                  onChange={setRank}
                  hint="Cấp bậc của bạn"
                  {...f('cert')}
                />

                <DarkField
                  label="MẬT KHẨU"
                  icon="🔒"
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={setPassword}
                  secure={!showPass}
                  suffix={
                    <TouchableOpacity onPress={() => setShowPass(s => !s)}>
                      <Text>{showPass ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  }
                  {...f('pass')}
                />

                {password.length > 0 && (
                  <View style={styles.strengthRow}>
                    <Text style={styles.strengthLabel}>Độ mạnh: </Text>
                    {[1,2,3,4].map(i => (
                      <View key={i} style={[styles.sBar, { backgroundColor: password.length >= i * 3 ? (password.length >= 10 ? C.green : C.primary) : C.border }]} />
                    ))}
                  </View>
                )}

                <DarkField
                  label="XÁC NHẬN MẬT KHẨU"
                  icon="🔐"
                  placeholder="Nhập lại mật khẩu"
                  value={confirm}
                  onChange={setConfirm}
                  secure={!showConf}
                  suffix={
                    <TouchableOpacity onPress={() => setShowConf(s => !s)}>
                      <Text>{showConf ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  }
                  {...f('conf')}
                />

                {/* Blockchain badge */}
                {/* <View style={styles.blockchainBadge}>
                  <Text style={styles.bbIcon}>⛓</Text>
                  <Text style={styles.bbText}>
                    Thông tin đăng ký sẽ được mã hóa và lưu trữ trên blockchain SENTINEL. Không thể chỉnh sửa sau khi xác nhận.
                  </Text>
                </View> */}

                {/* Terms */}
                <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(a => !a)}>
                  <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                    {agreed && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    Tôi xác nhận thông tin là chính xác và đồng ý với{' '}
                    <Text style={styles.termsLink}>Quy chế Đội cứu hộ SENTINEL</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.nextButtonLoading]}
              onPress={handleNext}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFF" size="small" />
                : (
                  <Text style={styles.nextButtonText}>
                    {step < TOTAL_STEPS ? `TIẾP THEO  ›  Bước ${step + 1}/${TOTAL_STEPS}` : 'XÁC NHẬN ĐĂNG KÝ  →'}
                  </Text>
                )
              }
            </TouchableOpacity>

          </Animated.View>

          {/* ── Link to Login ─────────────────────────────────────────────── */}
          <TouchableOpacity style={styles.loginRow} onPress={() => navigation.navigate('RescuerLogin')}>
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
  bgGlow: { position: 'absolute', top: -60, right: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(229,57,53,0.06)' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backIcon: { fontSize: 18, color: C.white, fontWeight: '700' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 10, fontWeight: '800', color: C.textDim, letterSpacing: 1.5 },
  headerSub: { fontSize: 14, fontWeight: '700', color: C.textWhite, marginTop: 1 },
  stepCounter: { backgroundColor: 'rgba(229,57,53,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(229,57,53,0.3)' },
  stepCounterText: { fontSize: 12, fontWeight: '800', color: C.primary },

  // Form
  formCard: { backgroundColor: C.bgCard, borderRadius: 20, padding: 20, gap: 16, borderWidth: 1, borderColor: C.border },
  stepHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 },
  stepHeadingIcon: { fontSize: 32 },
  stepTitle: { fontSize: 17, fontWeight: '800', color: C.textWhite },
  stepDesc: { fontSize: 12, color: C.textDim, marginTop: 2 },

  // Province dropdown
  dropdown: { backgroundColor: '#0F1B2D', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginTop: 4 },
  dropItem: { padding: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  dropItemActive: { backgroundColor: 'rgba(229,57,53,0.12)' },
  dropText: { fontSize: 14, color: C.textWhite },
  dropTextActive: { color: C.primary, fontWeight: '700' },

  // Specialty
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  specChipActive: { backgroundColor: 'rgba(229,57,53,0.15)', borderColor: C.primary },
  specText: { fontSize: 12, fontWeight: '600', color: C.textDim },
  specTextActive: { color: C.primary },

  // Strength bar
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  strengthLabel: { fontSize: 11, color: C.textDim },
  sBar: { flex: 1, height: 4, borderRadius: 2 },

  // Blockchain badge
  blockchainBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(0,188,212,0.07)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,188,212,0.15)' },
  bbIcon: { fontSize: 13, marginTop: 1 },
  bbText: { flex: 1, fontSize: 11, color: 'rgba(0,188,212,0.75)', lineHeight: 17 },

  // Terms
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  checkmark: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  termsText: { flex: 1, fontSize: 12, color: C.textDim, lineHeight: 18 },
  termsLink: { color: C.primary, fontWeight: '700' },

  // Error
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,82,82,0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,82,82,0.25)' },
  errorIcon: { fontSize: 12, marginTop: 1 },
  errorText: { flex: 1, fontSize: 12, color: C.error, fontWeight: '600', lineHeight: 18 },

  // Button
  nextButton: { backgroundColor: C.primary, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  nextButtonLoading: { backgroundColor: C.primaryDark },
  nextButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },

  // Login link
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: 14, color: C.textDim },
  loginLink: { fontSize: 14, color: C.primary, fontWeight: '700' },
});
