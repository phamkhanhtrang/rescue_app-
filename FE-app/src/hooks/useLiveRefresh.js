import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Only refresh visible screens. Ignore requests from an old focus/session/location.
export default function useLiveRefresh(load, interval = 15000) {
  const refreshRef = useRef(() => {});
  useFocusEffect(useCallback(() => {
    let active = true;
    let generation = 0;
    let running = null;
    const refresh = async () => {
      if (!active || (AppState.currentState && AppState.currentState !== 'active')) return;
      if (running !== null) return;
      const request = ++generation;
      running = request;
      try { await load(() => active && request === generation); }
      finally { if (running === request) running = null; }
    };
    refreshRef.current = refresh;
    refresh();
    const timer = setInterval(refresh, interval);
    const subscription = AppState.addEventListener('change', state => {
      ++generation;
      running = null;
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      ++generation;
      refreshRef.current = () => {};
      clearInterval(timer);
      subscription.remove();
    };
  }, [load, interval]));
  return useCallback(() => refreshRef.current(), []);
}
