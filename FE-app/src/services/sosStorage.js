import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Web keys last only for the tab session; native keys use the OS keychain.
const read = async key => Platform.OS === 'web' ? sessionStorage.getItem(key) : SecureStore.getItemAsync(key);
const write = async (key, value) => Platform.OS === 'web' ? sessionStorage.setItem(key, value) : SecureStore.setItemAsync(key, value);
const remove = async key => Platform.OS === 'web' ? sessionStorage.removeItem(key) : SecureStore.deleteItemAsync(key);
const INDEX = 'guardian_sos_records_v1';
export async function records() { return JSON.parse(await AsyncStorage.getItem(INDEX) || '[]'); }
export async function remember(sos, token) {
  await write(`sos_${sos.id}`, token);
  const old = await records();
  await AsyncStorage.setItem(INDEX, JSON.stringify([{ id: sos.id, sent_at: sos.sent_at }, ...old.filter(x => x.id !== sos.id)]));
}
export const trackingKey = id => read(`sos_${id}`);
export const getDraft = () => read('sos_draft');
export const setDraft = token => write('sos_draft', token);
export const clearDraft = () => remove('sos_draft');
