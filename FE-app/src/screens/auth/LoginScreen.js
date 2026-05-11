/**
 * LoginScreen.js — Màn hình đăng nhập
 * Placeholder: Kết nối API xác thực thực tế ở đây.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const LoginScreen = ({ navigation }) => {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    // TODO: Gọi API đăng nhập thực tế
    // const response = await authApi.login({ phone, password });
    // const role = response.data.role; // 'CITIZEN' hoặc 'RESCUER'
    // await signIn(role, response.data.user);

    // Demo: chỉ mock
    console.warn('LoginScreen: Cần tích hợp API đăng nhập thực tế');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text>← Quay lại</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Đăng nhập</Text>
      <TextInput
        style={styles.input}
        placeholder="Số điện thoại"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Đăng nhập</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#FFF' },
  backButton: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#1565C0', padding: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

export default LoginScreen;
