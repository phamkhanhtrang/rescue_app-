import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { notificationModule, registerPushDevice, cancelPushRegistration } from '../services/pushSession';

export default function usePushNotifications(user, navigationRef) {
  const pending = useRef(null);
  const handled = useRef(null);
  const openPending = useCallback(() => {
    if (!navigationRef.isReady() || !user?.id || !pending.current) return;
    const data = pending.current;
    pending.current = null;
    if (data.userId === user.id && typeof data.alertId === 'string') {
      navigationRef.navigate('AlertDetail', { alertId: data.alertId });
    }
  }, [user?.id, navigationRef]);

  useEffect(() => {
    if (!user?.id || !['CITIZEN', 'RESCUER'].includes(user.role)) return;
    const Notifications = notificationModule();
    if (!Notifications) return;
    let active = true;
    Notifications.setNotificationHandler({ handleNotification: async notification => {
      const own = notification.request.content.data?.userId === user.id;
      return { shouldShowBanner: own, shouldShowList: own, shouldPlaySound: own, shouldSetBadge: false };
    } });
    const register = () => registerPushDevice().catch(() => {
      if (active) console.warn('Chưa đăng ký được push. Sẽ thử lại khi app hoạt động.');
    });
    const receiveResponse = response => {
      if (!active || !response) return;
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      handled.current = id;
      pending.current = response.notification.request.content.data;
      openPending();
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    register();
    Notifications.getLastNotificationResponseAsync().then(receiveResponse).catch(() => {});
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(receiveResponse);
    const tokenSubscription = Notifications.addPushTokenListener(register);
    const appSubscription = AppState.addEventListener('change', state => { if (state === 'active') register(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') register(); }, 10 * 60 * 1000);
    return () => {
      active = false;
      pending.current = null;
      cancelPushRegistration();
      responseSubscription.remove(); tokenSubscription.remove(); appSubscription.remove(); clearInterval(timer);
      Notifications.setNotificationHandler(null);
    };
  }, [user?.id, user?.role, openPending]);
  return openPending;
}
