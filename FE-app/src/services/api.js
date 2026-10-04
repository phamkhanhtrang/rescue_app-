/**
 * src/services/api.js
 * Centralized API service functions calling apiClient.
 */

import { apiClient, setAuthToken } from './apiClient';
import { trackingKey } from './sosStorage';

const sosRequest = async (id, options = {}) => {
  const key = await trackingKey(id);
  return apiClient(`/rescue_operations/sos/${id}/`, { ...options, headers: key ? { 'X-SOS-Key': key } : {} });
};

const API = {
  // --------------------------------------------------
  // 1. AUTH & ACCOUNTS
  // --------------------------------------------------
  auth: {
    me: () => apiClient('/accounts/me/'),
    updateAccount: (id, data) => apiClient('/accounts/profiles/' + id + '/', { method: 'PUT', body: JSON.stringify(data) }),
    requestReset: data => apiClient('/accounts/password/reset/', { method: 'POST', body: JSON.stringify(data), public: true }),
    confirmReset: data => apiClient('/accounts/password/reset/confirm/', { method: 'POST', body: JSON.stringify(data), public: true }),
    changePassword: data => apiClient('/accounts/password/change/', { method: 'POST', body: JSON.stringify(data) }),
    login: async (credentials) => {
      // credentials: { username, password }
      const response = await apiClient('/accounts/login/', {
        public: true,
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return response;
    },
    logout: () => {
      setAuthToken(null);
    }
  },
  citizens: {
    create: (data) => apiClient('/accounts/citizens/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getProfile: (id) => apiClient(`/accounts/citizens/${id}/`),
    updateProfile: (id, data) => apiClient(`/accounts/citizens/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },
  rescuers: {
    getAll: () => apiClient('/accounts/profiles/?role=RESCUER'),
    create: (data) => apiClient('/accounts/rescuers/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getProfile: (id) => apiClient(`/accounts/rescuers/${id}/`),
    updateProfile: (id, data) => apiClient(`/accounts/rescuers/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateLocation: (id, coords) => apiClient(`/accounts/rescuers/${id}/location/`, {
      method: 'PATCH',
      body: JSON.stringify(coords), // VD: { latitude, longitude }
    }),
  },

  // --------------------------------------------------
  // 2. RESCUE OPERATIONS (Zones, SOS)
  // --------------------------------------------------
  zones: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiClient(`/rescue_operations/zones/${query ? `?${query}` : ''}`);
    },
    getDetails: (id) => apiClient(`/rescue_operations/zones/${id}/`),
    getDashboardStats: () => apiClient('/rescue_operations/dashboard/'),
  },
  sos: {
    draft: (key = '') => apiClient('/rescue_operations/sos/draft/', {
      headers: key ? { 'X-SOS-Key': key } : {},
    }),
    submit: (data, key) => apiClient('/rescue_operations/sos/create/', {
      method: 'POST',
      headers: key ? { 'X-SOS-Key': key } : {},
      body: (typeof FormData !== 'undefined' && data instanceof FormData) ? data : JSON.stringify(data),
    }),
    action: (id, action, message = '') => sosRequest(id, { method: 'POST', body: JSON.stringify({ action, message }) }),
    create: (data) => apiClient('/rescue_operations/sos/create/', {
      method: 'POST',
      body: (typeof FormData !== 'undefined' && data instanceof FormData) ? data : JSON.stringify(data),
    }),
    createAnonymous: (data) => apiClient('/rescue_operations/sos/anonymous/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    // Upload image phải dùng multipart/form-data
    uploadImages: async (sosId, formData) => apiClient(`/rescue_operations/sos/${sosId}/images/`, {
      method: 'POST',
      headers: { 'X-SOS-Key': await trackingKey(sosId) || '' },
      body: formData,
    }),
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiClient(`/rescue_operations/sos/${query ? `?${query}` : ''}`);
    },
    getDetails: (id) => sosRequest(id),
    updateStatus: (id, status) => apiClient(`/rescue_operations/sos/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    }),
    cancel: (id, reason) => sosRequest(id, { method: 'POST', body: JSON.stringify({ action: 'cancel', message: reason }) }),
  },

  // --------------------------------------------------
  // 3. COMMUNICATIONS (Alerts)
  // --------------------------------------------------
  alerts: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiClient(`/communications/alerts/${query ? `?${query}` : ''}`);
    },
    getDetails: (id, params = {}) => apiClient(`/communications/alerts/${id}/?${new URLSearchParams(params)}`),
    markRead: (id, publication, params = {}) => apiClient(`/communications/alerts/${id}/read/?${new URLSearchParams(params)}`, {
      method: 'POST', body: JSON.stringify({ publication }),
    }),
    registerDevice: data => apiClient('/communications/push-devices/', { method: 'POST', body: JSON.stringify(data) }),
    unregisterDevice: token => apiClient('/communications/push-devices/', { method: 'DELETE', body: JSON.stringify({ token }) }),
    vote: (id, voteData, params = {}) => apiClient(`/communications/alerts/${id}/vote/?${new URLSearchParams(params)}`, {
      method: 'POST',
      body: JSON.stringify(voteData),
    }),
  },

  // --------------------------------------------------
  // 4. REPORTING (Missions, Resources)
  // --------------------------------------------------
  missions: {
    action: (id, action, data = {}) => apiClient(`/reporting/missions/${id}/`, {
      method: 'POST', body: JSON.stringify({ ...data, action }),
    }),
    support: () => apiClient('/reporting/support/'),
    acceptSupport: id => apiClient('/reporting/support/', { method: 'POST', body: JSON.stringify({ id }) }),
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiClient(`/reporting/missions/${query ? `?${query}` : ''}`);
    },
    create: (data) => apiClient('/reporting/missions/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getDetails: (id) => apiClient(`/reporting/missions/${id}/`),
    updateStatus: (id, data = {}) => apiClient(`/reporting/missions/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    complete: (id, data = {}) => apiClient(`/reporting/missions/${id}/complete/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    leave: (id) => apiClient(`/reporting/missions/${id}/leave/`, {
      method: 'PATCH',
    }),
  },
  resources: {
    current: () => apiClient('/reporting/resources/current/'),
    save: data => apiClient('/reporting/resources/current/', { method: 'PUT', body: JSON.stringify(data) }),
    getAll: () => apiClient('/reporting/resources/'),
    create: (data) => apiClient('/reporting/resources/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
   rescueOperations: {
    // API lấy lộ trình dẫn đường thông minh
    getRoute: (start, target) => apiClient('/rescue_operations/get-route/', {
      method: 'POST',
      body: JSON.stringify({ start, target }),
    }),
  },

  // --------------------------------------------------
  // 5. AI MODULE
  // --------------------------------------------------
  ai: {
    // Gợi ý phân công Rescuer → Zone tối ưu
    getRecommendations: (topN = 5) => apiClient(`/ai/recommend/?top_n=${topN}`),
    // Danh sách Zone xếp theo điểm ưu tiên AI
    getPriorityZones: () => apiClient('/ai/priority-zones/'),
  },

  // --------------------------------------------------
  // 6. NEWS / BẢN TIN BÁO CHÍ THIÊN TAI
  // --------------------------------------------------
  news: {
    getDetails: (id, params = {}) => apiClient(`/ai/news/${id}/?${new URLSearchParams(params)}`),
    getPublished: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiClient(`/ai/news/${query ? `?${query}` : ''}`);
    },
  },
};

export default API;
