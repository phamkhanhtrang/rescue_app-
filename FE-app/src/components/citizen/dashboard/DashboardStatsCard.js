/**
 * DashboardStatsCard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Component hiển thị các thống kê dashboard dưới dạng card.
 *
 * Dùng:
 *   <DashboardStatsCard />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
    ScrollView,
} from 'react-native';
import useDashboardStats from '../../hooks/useDashboardStats';
import { COLORS, SPACING, RADIUS, FONTS } from '../../constants/citizen/theme';

const DashboardStatsCard = () => {
    const { totalZones, totalSOS, stats, loading, error, refetch } = useDashboardStats();
    const [refreshing, setRefreshing] = React.useState(false);

    const handleRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    if (loading && !stats) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Đang tải thống kê...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>❌ {error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
                    <Text style={styles.retryBtnText}>Thử lại</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
            {/* ─── Header ─────────────────────────────────────────────────────────── */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>📊 Thống Kê Tổng Quan</Text>
                <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
                    <Text style={styles.refreshBtnText}>🔄</Text>
                </TouchableOpacity>
            </View>

            {/* ─── Stats Cards Grid ───────────────────────────────────────────────── */}
            <View style={styles.statsGrid}>
                {/* Vùng Cứu Hộ */}
                <View style={[styles.statCard, styles.zoneCard]}>
                    <Text style={styles.statIcon}>🚨</Text>
                    <Text style={styles.statLabel}>Vùng Cứu Hộ</Text>
                    <Text style={styles.statValue}>{totalZones}</Text>
                    <Text style={styles.statUnit}>khu vực</Text>
                </View>

                {/* Yêu Cầu SOS */}
                <View style={[styles.statCard, styles.sosCard]}>
                    <Text style={styles.statIcon}>📞</Text>
                    <Text style={styles.statLabel}>Yêu Cầu SOS</Text>
                    <Text style={styles.statValue}>{totalSOS}</Text>
                    <Text style={styles.statUnit}>tín hiệu</Text>
                </View>
            </View>

            {/* ─── Breakdown Stats ────────────────────────────────────────────────── */}
            {stats && (
                <>
                    {/* Vùng theo Severity */}
                    <View style={styles.breakdownCard}>
                        <Text style={styles.breakdownTitle}>📈 Vùng theo Mức Độ</Text>
                        <View style={styles.breakdownList}>
                            {stats.zones_by_severity && (
                                <>
                                    {Object.entries(stats.zones_by_severity).map(([severity, count]) => (
                                        <View key={severity} style={styles.breakdownItem}>
                                            <Text style={styles.breakdownLabel}>
                                                {severity === 'HIGH'
                                                    ? '🔴 Cao'
                                                    : severity === 'MEDIUM'
                                                        ? '🟡 Trung bình'
                                                        : '🟢 Thấp'}
                                            </Text>
                                            <Text style={styles.breakdownCount}>{count}</Text>
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>
                    </View>

                    {/* Vùng theo Status */}
                    <View style={styles.breakdownCard}>
                        <Text style={styles.breakdownTitle}>✅ Vùng theo Trạng Thái</Text>
                        <View style={styles.breakdownList}>
                            {stats.zones_by_status && (
                                <>
                                    {Object.entries(stats.zones_by_status).map(([status, count]) => (
                                        <View key={status} style={styles.breakdownItem}>
                                            <Text style={styles.breakdownLabel}>
                                                {status === 'ACTIVE' ? '🔵 Hoạt động' : '✅ Hoàn tất'}
                                            </Text>
                                            <Text style={styles.breakdownCount}>{count}</Text>
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>
                    </View>

                    {/* SOS theo Status */}
                    <View style={[styles.breakdownCard, styles.lastBreakdown]}>
                        <Text style={styles.breakdownTitle}>📢 SOS theo Trạng Thái</Text>
                        <View style={styles.breakdownList}>
                            {stats.sos_by_status && (
                                <>
                                    {Object.entries(stats.sos_by_status).map(([status, count]) => (
                                        <View key={status} style={styles.breakdownItem}>
                                            <Text style={styles.breakdownLabel}>
                                                {status === 'PENDING' ? '⏳ Chờ xử lý' : '🚁 Đã phản ứng'}
                                            </Text>
                                            <Text style={styles.breakdownCount}>{count}</Text>
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>
                    </View>
                </>
            )}

            {/* ─── Footer ─────────────────────────────────────────────────────────── */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>Cập nhật: Thời gian thực</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },

    // ─── Loading / Error ────────────────────────────────────────────────────
    loadingText: {
        marginTop: SPACING.sm,
        fontSize: 14,
        color: COLORS.textHint,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 16,
        color: COLORS.error,
        textAlign: 'center',
        fontWeight: '600',
    },
    retryBtn: {
        marginTop: SPACING.md,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
        alignSelf: 'center',
    },
    retryBtnText: {
        color: '#FFF',
        fontWeight: '600',
    },

    // ─── Header ─────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        backgroundColor: COLORS.primary,
        marginBottom: SPACING.md,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
    },
    refreshBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    refreshBtnText: {
        fontSize: 20,
    },

    // ─── Stats Grid ─────────────────────────────────────────────────────────
    statsGrid: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.md,
        gap: SPACING.md,
        marginBottom: SPACING.lg,
    },
    statCard: {
        flex: 1,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
    },
    zoneCard: {
        backgroundColor: '#FFE5E5',
    },
    sosCard: {
        backgroundColor: '#E5F3FF',
    },
    statIcon: {
        fontSize: 32,
        marginBottom: SPACING.sm,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textHint,
        marginBottom: SPACING.xs,
        fontWeight: '600',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.primary,
        marginBottom: SPACING.xs,
    },
    statUnit: {
        fontSize: 11,
        color: COLORS.textHint,
    },

    // ─── Breakdown Cards ────────────────────────────────────────────────────
    breakdownCard: {
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.md,
        backgroundColor: '#FFF',
        borderRadius: RADIUS.md,
        padding: SPACING.lg,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 2,
    },
    lastBreakdown: {
        marginBottom: SPACING.lg,
    },
    breakdownTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: SPACING.md,
    },
    breakdownList: {
        gap: SPACING.sm,
    },
    breakdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        backgroundColor: '#F9F9F9',
        borderRadius: RADIUS.sm,
    },
    breakdownLabel: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
    },
    breakdownCount: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
        minWidth: 40,
        textAlign: 'right',
    },

    // ─── Footer ─────────────────────────────────────────────────────────────
    footer: {
        paddingVertical: SPACING.lg,
        paddingHorizontal: SPACING.md,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: COLORS.textHint,
    },
});

export default DashboardStatsCard;
