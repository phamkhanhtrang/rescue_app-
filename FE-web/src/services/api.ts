import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.118:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor để thêm Token vào Header mỗi khi gọi API
apiClient.interceptors.request.use(
  (config) => {
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

export const api = {
  dashboard: {
    getStats: () => apiClient.get('/rescue_operations/dashboard/'),
  },
  zones: {
    getAll: (params?: any) => apiClient.get('/rescue_operations/zones/', { params }),
    getDetail: (id: string) => apiClient.get(`/rescue_operations/zones/${id}/`),
    create: (data: any) => apiClient.post('/rescue_operations/zones/create/', data),
    update: (id: string, data: any) => apiClient.put(`/rescue_operations/zones/${id}/`, data),
    delete: (id: string) => apiClient.delete(`/rescue_operations/zones/${id}/`),
  },
  sos: {
    getAll: (params?: any) => apiClient.get('/rescue_operations/sos/', { params }),
    updateStatus: (id: string, status: string) => apiClient.patch(`/rescue_operations/sos/${id}/`, { status }),
  },
  rescuers: {
    getAll: () => apiClient.get('/accounts/profiles/', { params: { role: 'RESCUER' } }),
  },
  missions: {
    getAll: (params?: any) => apiClient.get('/reporting/missions/', { params }),
    updateStatus: (id: string, data: any) => apiClient.patch(`/reporting/missions/${id}/`, data),
    getHistory: (id: string) => apiClient.get(`/reporting/missions/${id}/history/`),
  },
  alerts: {
    getAll: (params?: any) => apiClient.get('/communications/alerts/', { params }),
  },
  communications: {
    createAlert: (data: any) => apiClient.post('/communications/alerts/create/', data),
  },
  accounts: {
    getRescuers: () => apiClient.get('/accounts/profiles/', { params: { role: 'RESCUER' } }),
    getCitizens: () => apiClient.get('/accounts/profiles/', { params: { role: 'CITIZEN' } }),
    getSummary: () => apiClient.get('/accounts/summary/'),
    activate: (userId: string) => apiClient.post(`/accounts/profiles/${userId}/activate/`),
    ban: (userId: string) => apiClient.post(`/accounts/profiles/${userId}/ban/`),
  },
};

export default api;
