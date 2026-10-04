import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function PasswordScreen({ route, navigation }) {
  const reset = route.params?.mode === 'reset';
  const { userInfo, updateUserInfo, signOut } = useAuth();
  const [email, setEmail] = useState(reset ? '' : userInfo?.email || '');
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const run = async task => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (e) { setError(e?.message || 'Không thể xử lý. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };
  const requestCode = () => run(async () => {
    if (Date.now() - sentAt < 60000) throw new Error('Vui lòng chờ 60 giây trước khi gửi lại mã.');
    const result = await API.auth.requestReset({ email: email.trim() });
    setSentAt(Date.now()); setMessage(result.message);
  });
  const saveEmail = () => run(async () => {
    const result = await API.auth.updateAccount(userInfo.id, { email: email.trim(), current_password: current });
    await updateUserInfo(result); setMessage('Đã lưu email khôi phục.'); setCurrent('');
  });
  const savePassword = () => run(async () => {
    if (password.length < 8) throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');
    if (password !== confirm) throw new Error('Mật khẩu xác nhận không khớp.');
    const result = reset
      ? await API.auth.confirmReset({ code: code.trim(), new_password: password })
      : await API.auth.changePassword({ current_password: current, new_password: password });
    setPassword(''); setConfirm(''); setCurrent(''); setCode(''); setMessage(result.message); setDone(true);
  });
  const field = (label, value, change, secure = false, keyboardType = 'default') => <React.Fragment key={label}>
    <Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={change} secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} keyboardType={keyboardType} editable={!busy} />
  </React.Fragment>;
  const button = (label, onPress) => <TouchableOpacity disabled={busy} style={[styles.button, busy && { opacity: 0.5 }]} onPress={onPress}><Text style={styles.buttonText}>{busy ? 'Đang xử lý…' : label}</Text></TouchableOpacity>;
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{reset ? 'Khôi phục mật khẩu' : 'Email & mật khẩu'}</Text>
    <Text>{reset ? 'Nhập email đã lưu trong hồ sơ. Nếu chưa có email, bạn cần liên hệ quản trị viên để xác minh và bổ sung email trước.' : 'Email dùng để nhận mã khôi phục. Đổi email cần mật khẩu hiện tại. Đổi mật khẩu sẽ kết thúc phiên đăng nhập trên các thiết bị.'}</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    {done ? button('Về đăng nhập', async () => { if (reset) navigation.goBack(); else await signOut(); }) : <>
      {field('Email', email, setEmail, false, 'email-address')}
      {!reset && field('Mật khẩu hiện tại', current, setCurrent, true)}
      {button(reset ? 'Gửi mã khôi phục' : 'Lưu email', reset ? requestCode : saveEmail)}
      {reset && field('Mã khôi phục từ email (dán toàn bộ mã)', code, setCode)}
      {field('Mật khẩu mới (ít nhất 8 ký tự)', password, setPassword, true)}
      {field('Nhập lại mật khẩu mới', confirm, setConfirm, true)}
      {button(reset ? 'Đặt lại mật khẩu' : 'Đổi mật khẩu', savePassword)}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 14, backgroundColor: '#F7F9FC', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '700', color: '#102A43' },
  label: { fontWeight: '600', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#BCCCDC', borderRadius: 8, padding: 12, backgroundColor: '#FFF', color: '#102A43' },
  button: { backgroundColor: '#1565C0', padding: 14, borderRadius: 8 },
  buttonText: { color: '#FFF', textAlign: 'center', fontWeight: '700' },
  error: { color: '#B91C1C' }, message: { color: '#166534' },
});
