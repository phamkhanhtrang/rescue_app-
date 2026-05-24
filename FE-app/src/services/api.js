/**
 * src/services/api.js
 * Centralized API service functions calling apiClient.
 */

import { apiClient, setAuthToken } from './apiClient';

const API = {
  // --------------------------------------------------
  // 1. AUTH & ACCOUNTS
  // --------------------------------------------------
  auth: {
    login: async (credentials) => {
      // credentials: { username, password }
      const response = await apiClient('/accounts/login/', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      // Tùy theo response của Django trả về 'access' hay 'token'
      if (response.access || response.token) {
        setAuthToken(response.access || response.token);
      }
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
    create: (data) => apiClient('/rescue_operations/sos/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    // Upload image phải dùng multipart/form-data
    uploadImages: (sosId, formData) => apiClient(`/rescue_operations/sos/${sosId}/images/`, {
      method: 'POST',
      body: formData,
    }),
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiClient(`/rescue_operations/sos/${query ? `?${query}` : ''}`);
    },
    getDetails: (id) => apiClient(`/rescue_operations/sos/${id}/`),
    updateStatus: (id, status) => apiClient(`/rescue_operations/sos/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, timestamp }),
    }),
    cancel: (id) => apiClient(`/rescue_operations/sos/${id}/`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'CANCELLED' }),
    }),
  },

  // --------------------------------------------------
  // 3. COMMUNICATIONS (Alerts)
  // --------------------------------------------------
  alerts: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiClient(`/communications/alerts/${query ? `?${query}` : ''}`);
    },
    getDetails: (id) => apiClient(`/communications/alerts/${id}/`),
    vote: (id, voteData) => apiClient(`/communications/alerts/${id}/vote/`, {
      method: 'POST',
      body: JSON.stringify(voteData),
    }),
  },

  // --------------------------------------------------
  // 4. REPORTING (Missions, Resources)
  // --------------------------------------------------
  missions: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiClient(`/reporting/missions/${query ? `?${query}` : ''}`);
    },
    create: (data) => apiClient('/reporting/missions/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getDetails: (id) => apiClient(`/reporting/missions/${id}/`),
    // updateStatus: (id, data,timestamp) => apiClient(`/reporting/missions/${id}/`, {
    //   method: 'PATCH',
    //   body: JSON.stringify(data,timestamp),
    // }),
    complete: (id, data = {}) => apiClient(`/reporting/missions/${id}/complete/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  },
  resources: {
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
};

export default API;
