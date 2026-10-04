/** API client with a single shared JWT refresh for the whole app. */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Có thể đổi máy chủ bằng EXPO_PUBLIC_API_URL mà không sửa mã nguồn.
// Điện thoại thật phải truy cập được địa chỉ LAN của máy chạy Django.
export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.88.86:8000').replace(/\/$/, '');

let authToken = null;
let refreshToken = null;
let refreshPromise = null;
let authFailureHandler = null;
let failureDelivered = false;
let sessionGeneration = 0;

export const setAuthSession = (access, refresh = null) => {
  sessionGeneration += 1;
  authToken = access || null;
  refreshToken = refresh || null;
  if (access) failureDelivered = false;
};

// Kept for older callers which only need to clear the current session.
export const setAuthToken = token => setAuthSession(token, token ? refreshToken : null);
export const getAuthToken = () => authToken;
export const setAuthFailureHandler = handler => { authFailureHandler = handler; };

async function readBody(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return text; }
}

function apiError(response, data) {
  let message = data?.message || data?.detail || data?.error;
  if (!message && data && typeof data === 'object') {
    const first = data[Object.keys(data)[0]];
    message = Array.isArray(first) ? first[0] : typeof first === 'string' ? first : null;
  }
  const error = new Error(message || `Máy chủ trả về lỗi ${response.status}`);
  error.status = response.status;
  error.data = data;
  return error;
}

async function endExpiredSession() {
  if (failureDelivered) return;
  failureDelivered = true;
  setAuthSession(null, null);
  try { await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'userData', 'userRole']); }
  finally { authFailureHandler?.(); }
}

async function timedFetch(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try { return await fetch(url, { ...options, signal: options.signal || controller.signal }); }
  finally { clearTimeout(timer); }
}

async function refreshAccessToken() {
  const generation = sessionGeneration;
  const originalRefresh = refreshToken;
  if (!refreshToken) {
    const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    error.status = 401;
    throw error;
  }
  let response;
  try {
    response = await timedFetch(`${BASE_URL}/accounts/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh: originalRefresh }),
    });
  } catch (cause) {
    const error = new Error(`Không thể kết nối máy chủ tại ${BASE_URL}. Kiểm tra Wi-Fi và backend.`);
    error.status = 0;
    error.cause = cause;
    throw error;
  }
  const data = await readBody(response);
  if (generation !== sessionGeneration || originalRefresh !== refreshToken) {
    throw new Error('Phiên đăng nhập đã thay đổi.');
  }
  if (!response.ok || !data.access) throw apiError(response, data);
  authToken = data.access;
  if (data.refresh) refreshToken = data.refresh;
  await AsyncStorage.multiSet([
    ['userToken', authToken],
    ['refreshToken', refreshToken],
  ]);
  return authToken;
}

function headersFor(options, token) {
  const headers = { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true', ...options.headers };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  else delete headers['Content-Type'];
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export const apiClient = async (endpoint, options = {}) => {
  const requestToken = options.public ? null : authToken;
  const generation = sessionGeneration;
  let response;
  try {
    response = await timedFetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: headersFor(options, requestToken),
    });
  } catch (cause) {
    const error = new Error(`Không thể kết nối máy chủ tại ${BASE_URL}. Kiểm tra Wi-Fi và backend.`);
    error.status = 0;
    error.cause = cause;
    throw error;
  }
  const data = await readBody(response);
  if (response.ok) return data;

  if (response.status === 401 && options.__authRetried && generation === sessionGeneration) await endExpiredSession();
  if (response.status === 401 && !options.public && generation === sessionGeneration && !options.__authRetried && endpoint !== '/accounts/token/refresh/' && authToken) {
    try {
      // Another request may already have completed the refresh.
      if (requestToken === authToken) {
        if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
        await refreshPromise;
      }
      return apiClient(endpoint, { ...options, __authRetried: true });
    } catch (error) {
      // Invalid/expired refresh means the session is over. Network failure stays recoverable.
      if (generation === sessionGeneration && (!refreshToken || [400, 401, 403].includes(error.status))) await endExpiredSession();
      throw error;
    }
  }
  throw apiError(response, data);
};
