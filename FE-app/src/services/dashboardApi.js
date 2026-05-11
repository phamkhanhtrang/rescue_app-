/**
 * dashboardApi.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Service để gọi các API thống kê dashboard từ backend.
 *
 * Endpoints:
 *   GET /api/rescue/dashboard/ → Toàn bộ stats
 *   GET /api/rescue/zones/ → Danh sách vùng
 *   GET /api/rescue/sos/ → Danh sách SOS
 * ─────────────────────────────────────────────────────────────────────────────
 */

import API from './api';

export const dashboardApi = {
    /**
     * Lấy toàn bộ thống kê dashboard
     * @returns {Promise<{
     *   ok: boolean,
     *   data: {
     *     summary: {
     *       total_zones: number,
     *       total_sos: number
     *     },
     *     zones_by_severity: { HIGH: number, MEDIUM: number, LOW: number },
     *     zones_by_status: { ACTIVE: number, RESOLVED: number },
     *     sos_by_status: { PENDING: number, RESPONDED: number }
     *   },
     *   message: string
     * }>}
     */
    getStats: async () => {
        try {
            return await API.get('/rescue/dashboard/');
        } catch (error) {
            return {
                ok: false,
                message: error.message || 'Không thể lấy dữ liệu dashboard',
                data: null,
            };
        }
    },

    /**
     * Lấy tổng số Vùng cứu hộ
     * @returns {Promise<number>}
     */
    getTotalZones: async () => {
        const result = await dashboardApi.getStats();
        if (result.ok && result.data?.summary?.total_zones !== undefined) {
            return result.data.summary.total_zones;
        }
        return 0;
    },

    /**
     * Lấy tổng số yêu cầu SOS
     * @returns {Promise<number>}
     */
    getTotalSOS: async () => {
        const result = await dashboardApi.getStats();
        if (result.ok && result.data?.summary?.total_sos !== undefined) {
            return result.data.summary.total_sos;
        }
        return 0;
    },

    /**
     * Lấy danh sách vùng với lọc
     * @param {Object} filters - { status, severity }
     * @returns {Promise}
     */
    getZones: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.severity) params.append('severity', filters.severity);

        const url = `/rescue/zones/${params.toString() ? '?' + params.toString() : ''}`;
        return await API.get(url);
    },

    /**
     * Lấy danh sách SOS với lọc
     * @param {Object} filters - { status, signal_type, zone }
     * @returns {Promise}
     */
    getSOSSignals: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.signal_type) params.append('signal_type', filters.signal_type);
        if (filters.zone) params.append('zone', filters.zone);

        const url = `/rescue/sos/${params.toString() ? '?' + params.toString() : ''}`;
        return await API.get(url);
    },

    /**
     * Tạo vùng cứu hộ mới
     * @param {Object} data - { name, location, severity, status, etc }
     * @returns {Promise}
     */
    createZone: async (data) => {
        return await API.post('/rescue/zones/create/', data);
    },

    /**
     * Cập nhật vùng cứu hộ
     * @param {string|number} zoneId
     * @param {Object} data
     * @returns {Promise}
     */
    updateZone: async (zoneId, data) => {
        return await API.put(`/rescue/zones/${zoneId}/`, data);
    },

    /**
     * Xóa vùng cứu hộ
     * @param {string|number} zoneId
     * @returns {Promise}
     */
    deleteZone: async (zoneId) => {
        return await API.delete(`/rescue/zones/${zoneId}/`);
    },

    /**
     * Gửi tín hiệu SOS mới
     * @param {Object} data - { zone_id, signal_type, location, message }
     * @returns {Promise}
     */
    sendSOS: async (data) => {
        return await API.post('/rescue/sos/create/', data);
    },

    /**
     * Cập nhật trạng thái SOS
     * @param {string|number} sosId
     * @param {Object} data - { status }
     * @returns {Promise}
     */
    updateSOS: async (sosId, data) => {
        return await API.put(`/rescue/sos/${sosId}/`, data);
    },

    /**
     * Đính kèm hình ảnh cho SOS
     * @param {string|number} sosId
     * @param {FormData} formData - chứa file ảnh
     * @returns {Promise}
     */
    uploadSOSImage: async (sosId, formData) => {
        return await API.post(`/rescue/sos/${sosId}/images/`, formData);
    },
};

export default dashboardApi;
