/**
 * useDashboardStats.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom Hook để fetch và quản lý dashboard stats.
 *
 * Dùng:
 *   const { totalZones, totalSOS, loading, error, refetch } = useDashboardStats();
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import dashboardApi from '../services/dashboardApi';

export const useDashboardStats = () => {
    const [totalZones, setTotalZones] = useState(0);
    const [totalSOS, setTotalSOS] = useState(0);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await dashboardApi.getStats();

            if (result.ok && result.data) {
                setStats(result.data);
                setTotalZones(result.data.summary?.total_zones || 0);
                setTotalSOS(result.data.summary?.total_sos || 0);
            } else {
                setError(result.message || 'Không thể lấy dữ liệu');
                // Đặt giá trị mặc định khi lỗi
                setTotalZones(0);
                setTotalSOS(0);
            }
        } catch (err) {
            console.error('Dashboard Stats Error:', err);
            setError(err.message || 'Lỗi kết nối');
            setTotalZones(0);
            setTotalSOS(0);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch khi component mount
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return {
        totalZones,
        totalSOS,
        stats,
        loading,
        error,
        refetch: fetchStats,
    };
};

export default useDashboardStats;
