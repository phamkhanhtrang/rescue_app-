import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const PROVIDER_GOOGLE = null;
export const Marker = () => null;
export const Circle = () => null;
export const Callout = () => null;
export const Polyline = () => null;

export default function AppMap({ style }) {
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.title}>Bản đồ khả dụng trên ứng dụng điện thoại</Text>
      <Text style={styles.text}>Trên web, hãy nhập địa chỉ hoặc tọa độ để tiếp tục.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#E9EEF5' },
  icon: { fontSize: 26, marginBottom: 6 },
  title: { color: '#1A2236', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  text: { color: '#657184', fontSize: 11, textAlign: 'center', marginTop: 3 },
});
