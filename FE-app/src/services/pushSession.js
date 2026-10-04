import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import API from './api';
import { alertLocationParams } from './alertPolicy';

let generation = 0;
let pending = null;
export function cancelPushRegistration() { ++generation; }

export function notificationModule() {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient' || !Device.isDevice) return null;
  return require('expo-notifications');
}

export async function registerPushDevice() {
  if (pending) return pending;
  const session = generation;
  pending = (async () => {
    const Notifications = notificationModule();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!Notifications || !projectId) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Cảnh báo & chỉ đạo', importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (session !== generation) return;
    if (!permission.granted) {
      const token = await AsyncStorage.getItem('alertPushToken');
      if (token) await API.alerts.unregisterDevice(token);
      return;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (session !== generation) return;
    const oldToken = await AsyncStorage.getItem('alertPushToken');
    if (oldToken && oldToken !== token) await API.alerts.unregisterDevice(oldToken);
    if (session !== generation) return;
    await API.alerts.registerDevice({ token, ...alertLocationParams() });
    await AsyncStorage.setItem('alertPushToken', token);
  })().finally(() => { pending = null; });
  return pending;
}

export async function unregisterPushDevice() {
  cancelPushRegistration();
  await pending?.catch(() => {});
  const token = await AsyncStorage.getItem('alertPushToken');
  if (token) {
    await API.alerts.unregisterDevice(token);
    await AsyncStorage.removeItem('alertPushToken');
  }
}
