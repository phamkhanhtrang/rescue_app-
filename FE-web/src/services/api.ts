import axios from 'axios';

// Set VITE_API_BASE_URL when the API is hosted separately from the web app.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:8000` : window.location.origin)).replace(/\/$/, '');

export function clearSession() {
  ['access_token', 'refresh_token', 'user_role', 'user_name', 'user_username', 'user_email'].forEach(key => localStorage.removeItem(key));
}

let refreshPromise: Promise<string> | null = null;
let redirecting = false;
function endSession() {
  clearSession();
  if (!redirecting) {
    redirecting = true;
    window.location.replace('/login?expired=1');
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor để thêm Token vào Header mỗi khi gọi API
apiClient.interceptors.request.use(
  (config) => {
    if (!Object.prototype.hasOwnProperty.call(config, '_sessionRefresh')) (config as any)._sessionRefresh = localStorage.getItem('refresh_token');
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Share one refresh across simultaneous dashboard requests; retry each only once.
apiClient.interceptors.response.use(response => response, async error => {
  const config = error.config;
  if (error.response?.status !== 401 || !config) return Promise.reject(error);
  if (config._sessionRefresh !== localStorage.getItem('refresh_token')) return Promise.reject(error);
  const current = localStorage.getItem('access_token');
  if (config._authRetried) {
    endSession();
    return Promise.reject(error);
  }
  config._authRetried = true;
  // A different request may already have refreshed this session.
  if (current && config.headers.Authorization !== `Bearer ${current}`) {
    config.headers.Authorization = `Bearer ${current}`;
    return apiClient(config);
  }
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) {
    endSession();
    return Promise.reject(error);
  }
  try {
    if (!refreshPromise) {
      refreshPromise = axios.post(`${API_BASE_URL}/accounts/token/refresh/`, { refresh }, { timeout: 15000 })
        .then(({ data }) => {
          if (!data.access) throw new Error('Không nhận được token mới.');
          // Do not restore a session that was logged out while refreshing.
          if (localStorage.getItem('refresh_token') !== refresh) throw new Error('Phiên đăng nhập đã thay đổi.');
          localStorage.setItem('access_token', data.access);
          if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
          return data.access;
        }).finally(() => { refreshPromise = null; });
    }
    const access = await refreshPromise;
    config.headers.Authorization = `Bearer ${access}`;
    return apiClient(config);
  } catch (refreshError: any) {
    // Preserve the session on a temporary network/server failure.
    if (localStorage.getItem('refresh_token') === refresh && ([400, 401, 403].includes(refreshError.response?.status) || !refreshError.response && refreshError.message === 'Không nhận được token mới.')) endSession();
    return Promise.reject(refreshError);
  }
});

export const api = {
  dashboard: {
    getStats: () => apiClient.get('/rescue_operations/dashboard/'),
  },
  zones: {
    getAll: (params?: any) => apiClient.get('/rescue_operations/zones/', { params: { limit: 500, ...(params || {}) } }),
    getDetail: (id: string) => apiClient.get(`/rescue_operations/zones/${id}/`),
    create: (data: any) => apiClient.post('/rescue_operations/zones/create/', data),
    update: (id: string, data: any) => apiClient.put(`/rescue_operations/zones/${id}/`, data),
    delete: (id: string) => apiClient.delete(`/rescue_operations/zones/${id}/`),
    manage: (data: any) => apiClient.post('/rescue_operations/zones/manage/', data),
  },
  sos: {
    getAll: (params?: any) => apiClient.get('/rescue_operations/sos/', { params: { include_images: 0, limit: 500, ...(params || {}) } }),
    getDetail: (id: string) => apiClient.get(`/rescue_operations/sos/${id}/`),
    updateStatus: (id: string, status: string) => apiClient.patch(`/rescue_operations/sos/${id}/`, { status }),
    action: (id: string, data: { action: string; message?: string; verification_status?: string; [key: string]: any }) =>
      apiClient.post(`/rescue_operations/sos/${id}/`, data),
  },
  rescuers: {
    getAll: () => apiClient.get('/accounts/profiles/', { params: { role: 'RESCUER' } }),
  },
  missions: {
    getAll: (params?: any) => apiClient.get('/reporting/missions/', { params }),
    getSupportRequests: (params?: any) => apiClient.get('/reporting/support/', { params }),
    acceptSupport: (id: string, rescuer: string) => apiClient.post('/reporting/support/', { id, rescuer }),
    updateStatus: (id: string, data: any) => apiClient.patch(`/reporting/missions/${id}/`, data),
    getHistory: (id: string) => apiClient.get(`/reporting/missions/${id}/history/`),
    create: (data: any) => apiClient.post('/reporting/missions/create/', data),
  },
  resources: {
    getAll: () => apiClient.get('/reporting/resources/'),
  },
  alerts: {
    getAll: (params?: any) => apiClient.get('/communications/alerts/', { params }),
  },
  communications: {
    getAll: (params?: any) => apiClient.get('/communications/alerts/', { params }),
    createAlert: (data: any) => apiClient.post('/communications/alerts/create/', data),
    updateAlert: (id: string, data: any) => apiClient.put(`/communications/alerts/${id}/`, data),
    deleteAlert: (id: string) => apiClient.delete(`/communications/alerts/${id}/`),
  },
  accounts: {
    getRescuers: () => apiClient.get('/accounts/profiles/', { params: { role: 'RESCUER' } }),
    getCitizens: () => apiClient.get('/accounts/profiles/', { params: { role: 'CITIZEN' } }),
    getSummary: () => apiClient.get('/accounts/summary/'),
    activate: (userId: string) => apiClient.post(`/accounts/profiles/${userId}/activate/`),
    ban: (userId: string) => apiClient.post(`/accounts/profiles/${userId}/ban/`),
  },
  ai: {
    runPipeline: () => apiClient.post('/ai/run/'),
    getPriorityZones: (params?: any) => apiClient.get('/ai/priority-zones/', { params }),
    
    // AI Crawler Endpoints
    runCrawl: (data?: any) => apiClient.post('/ai/crawl/', data),
    runFacebookCrawl: (data?: { group_ids?: string[], lookback_hours?: number }) =>
      apiClient.post('/ai/crawl/facebook/', data, { timeout: 600000 }),
    getCrawledArticles: (params?: any) => apiClient.get('/ai/crawled/', { params }),
    getCrawledArticle: (id: string) => apiClient.get(`/ai/crawled/${id}/`),
    deleteCrawledArticle: (id: string) => apiClient.delete(`/ai/crawled/${id}/`),
    getPublishedNews: (params?: any) => apiClient.get('/ai/news/', { params }),
    setNewsPublication: (id: string, action: 'publish' | 'unpublish') => apiClient.post(`/ai/crawled/${id}/publication/`, { action }),
    createNewsAlert: (id: string, data: any) => apiClient.post(`/ai/crawled/${id}/alert/`, data),
    reviewCrawledArticle: (
      id: string,
      data: { action: 'approve' | 'reject'; reason?: string; create_alert?: boolean; corrections?: Record<string, unknown> }
    ) => apiClient.post(`/ai/crawled/${id}/review/`, data),

    // AI Assignment Recommendation
    getRecommendations: (params?: { zone_ids?: string[], top_n?: number }) =>
      apiClient.get('/ai/recommend/', { params }),

    // PhoBERT Classification
    classifyText: (text: string) => apiClient.post('/ai/classify/', { text }),
    analyzeSOS: (text: string, mode: 'a' | 'b' | 'both') => apiClient.post('/ai/analyze-sos/', { text, mode }, { timeout: 180000 }),
    analyzeCrawledArticle: (id: string) => apiClient.post(`/ai/crawled/${id}/analyze/`, {}, { timeout: 180000 }),
  },
};

export default api;
