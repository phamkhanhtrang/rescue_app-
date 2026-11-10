import React, { useState, useEffect, useMemo, useRef } from "react";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../services/api";
import SOSDetailModal from "../../components/SOSDetailModal";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";
import {
  Search,
  Filter,
  Phone,
  Clock,
  MapPin,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Users,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const VERIFICATION_CONFIG: Record<string, { label: string; bg: string }> = {
  UNVERIFIED: { label: "Chưa xác minh", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  CHECKING: { label: "Đang kiểm tra", bg: "bg-blue-50 text-blue-700 border-blue-200" },
  VERIFIED: { label: "Đã xác thực", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  INCORRECT: { label: "Tin giả / Hủy", bg: "bg-rose-50 text-rose-700 border-rose-200" },
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  PENDING: { label: "Chờ xử lý", dot: "bg-amber-500", text: "text-amber-700" },
  ACKNOWLEDGED: { label: "Đã tiếp nhận", dot: "bg-blue-500", text: "text-blue-700" },
  IN_PROGRESS: { label: "Đang cứu nạn", dot: "bg-purple-500", text: "text-purple-700" },
  RESOLVED: { label: "Đã giải quyết", dot: "bg-emerald-500", text: "text-emerald-700" },
  CANCELLED: { label: "Đã hủy", dot: "bg-slate-400", text: "text-slate-500" },
};

const EMERGENCY_MAP: Record<string, { label: string; icon: string }> = {
  RESCUE: { label: "Cứu hộ khẩn cấp", icon: "🚨" },
  MEDICAL: { label: "Cấp cứu y tế", icon: "🏥" },
  FOOD: { label: "Lương thực", icon: "📦" },
  FIRE: { label: "Hỏa hoạn", icon: "🔥" },
  FLOOD: { label: "Lũ lụt", icon: "🌊" },
  ACCIDENT: { label: "Tai nạn", icon: "⚠️" },
  OTHER: { label: "Khác", icon: "ℹ️" },
};

const SEVERITY_CONFIG: Record<string, { label: string; bg: string }> = {
  CRITICAL: { label: "Khẩn cấp", bg: "bg-red-50 text-red-700 border-red-200" },
  HIGH: { label: "Cao", bg: "bg-orange-50 text-orange-700 border-orange-200" },
  WARNING: { label: "Cảnh báo", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  MEDIUM: { label: "Trung bình", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  NORMAL: { label: "Bình thường", bg: "bg-green-50 text-green-700 border-green-200" },
  LOW: { label: "Thấp", bg: "bg-green-50 text-green-700 border-green-200" },
};

const ITEMS_PER_PAGE = 12;

export default function SOSAll() {
  const [sosList, setSosList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [verifyFilter, setVerifyFilter] = useState("ALL");
  const [emergencyFilter, setEmergencyFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [selectedSosId, setSelectedSosId] = useState<string | null>(null);

  const mounted = useRef(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.sos.getAll({ limit: 1000 });
      const data = res?.data?.results || res?.data || [];
      if (mounted.current) {
        setSosList(Array.isArray(data) ? data : []);
        setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
      }
    } catch (err) {
      if (mounted.current) {
        setErrorMsg(apiErrorMessage(err));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    fetchData();
    return () => {
      mounted.current = false;
    };
  }, []);

  // Filtered results
  const filteredSos = useMemo(() => {
    return sosList.filter((item) => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const contactName = (item.contact_name || item.user_full_name || item.citizen_name || "").toLowerCase();
        const phone = (item.contact_phone || item.phone || "").toLowerCase();
        const address = (item.address || "").toLowerCase();
        const note = (item.note || item.description || "").toLowerCase();
        const matchesSearch =
          contactName.includes(query) ||
          phone.includes(query) ||
          address.includes(query) ||
          note.includes(query);
        if (!matchesSearch) return false;
      }

      // Status
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }

      // Verification
      if (verifyFilter !== "ALL") {
        const vStatus = item.verification_status || "UNVERIFIED";
        if (vStatus !== verifyFilter) return false;
      }

      // Emergency type
      if (emergencyFilter !== "ALL") {
        const eType = (item.emergency_type || item.type || "").toUpperCase();
        if (eType !== emergencyFilter) return false;
      }

      // Severity
      if (severityFilter !== "ALL") {
        const sev = (item.severity || "").toUpperCase();
        if (sev !== severityFilter) return false;
      }

      return true;
    });
  }, [sosList, searchTerm, statusFilter, verifyFilter, emergencyFilter, severityFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSos.length / ITEMS_PER_PAGE));
  const paginatedSos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSos.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSos, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, verifyFilter, emergencyFilter, severityFilter]);

  // Quick KPI counts
  const kpis = useMemo(() => {
    const unverified = sosList.filter(
      (s) =>
        s.status !== "RESOLVED" &&
        s.status !== "CANCELLED" &&
        (!s.verification_status || s.verification_status === "UNVERIFIED" || s.verification_status === "CHECKING")
    ).length;
    const critical = sosList.filter(
      (s) => s.severity === "CRITICAL" || s.emergency_type === "CRITICAL"
    ).length;
    const inProgress = sosList.filter(
      (s) => s.status === "IN_PROGRESS" || s.status === "ACKNOWLEDGED"
    ).length;
    const resolved = sosList.filter((s) => s.status === "RESOLVED").length;

    return { total: sosList.length, unverified, critical, inProgress, resolved };
  }, [sosList]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Top Heading & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Danh sách toàn bộ yêu cầu SOS</h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý, xác thực cuộc gọi và điều phối các tín hiệu cứu nạn gửi từ người dân
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="btn-secondary flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Cập nhật</span>
            </button>
            {lastUpdated && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                Cập nhật lúc: {lastUpdated}
              </span>
            )}
          </div>
        </div>

        {/* Notice */}
        <DataNotice loading={loading} error={errorMsg} onRetry={fetchData} hasData={sosList.length > 0} />

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div
            onClick={() => {
              setStatusFilter("ALL");
              setVerifyFilter("ALL");
            }}
            className="stat-card cursor-pointer hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số SOS</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.total}</p>
            <p className="text-xs text-slate-400 mt-1">Toàn bộ hồ sơ</p>
          </div>

          <div
            onClick={() => setVerifyFilter("UNVERIFIED")}
            className="stat-card cursor-pointer border-amber-200 bg-amber-50/30 hover:border-amber-300 transition-colors"
          >
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Cần xác minh</p>
            <p className="text-2xl font-bold text-amber-800 mt-1">{kpis.unverified}</p>
            <p className="text-xs text-amber-600 mt-1">Cần gọi điện kiểm chứng</p>
          </div>

          <div
            onClick={() => setSeverityFilter("CRITICAL")}
            className="stat-card cursor-pointer border-red-200 bg-red-50/30 hover:border-red-300 transition-colors"
          >
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Khẩn cấp</p>
            <p className="text-2xl font-bold text-red-800 mt-1">{kpis.critical}</p>
            <p className="text-xs text-red-600 mt-1">Ưu tiên cứu nạn</p>
          </div>

          <div
            onClick={() => setStatusFilter("IN_PROGRESS")}
            className="stat-card cursor-pointer hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đang cứu nạn</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{kpis.inProgress}</p>
            <p className="text-xs text-slate-400 mt-1">Đội đang xử lý</p>
          </div>

          <div
            onClick={() => setStatusFilter("RESOLVED")}
            className="stat-card cursor-pointer hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã an toàn</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{kpis.resolved}</p>
            <p className="text-xs text-slate-400 mt-1">Đã hoàn thành</p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên người dân, SĐT, địa chỉ, ghi chú..."
                className="input-field w-full pl-10 text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field text-sm md:w-44"
            >
              <option value="ALL">Mọi trạng thái cứu hộ</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="ACKNOWLEDGED">Đã tiếp nhận</option>
              <option value="IN_PROGRESS">Đang xử lý</option>
              <option value="RESOLVED">Đã giải quyết</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>

            {/* Verification Filter */}
            <select
              value={verifyFilter}
              onChange={(e) => setVerifyFilter(e.target.value)}
              className="input-field text-sm md:w-44"
            >
              <option value="ALL">Mọi trạng thái xác minh</option>
              <option value="UNVERIFIED">⚠️ Chưa xác minh</option>
              <option value="CHECKING">📞 Đang kiểm tra</option>
              <option value="VERIFIED">✓ Đã xác minh đúng</option>
              <option value="INCORRECT">✕ Tin giả / Hủy</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="input-field text-sm md:w-36"
            >
              <option value="ALL">Mức độ nguy hại</option>
              <option value="CRITICAL">Khẩn cấp</option>
              <option value="HIGH">Cao</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="LOW">Thấp</option>
            </select>
          </div>

          {/* Quick Active Filter Badges */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Tìm thấy <strong className="text-slate-900">{filteredSos.length}</strong> yêu cầu phù hợp
            </span>
            {(searchTerm || statusFilter !== "ALL" || verifyFilter !== "ALL" || severityFilter !== "ALL") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setVerifyFilter("ALL");
                  setEmergencyFilter("ALL");
                  setSeverityFilter("ALL");
                }}
                className="text-brand hover:underline font-medium"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* SOS Cards Grid */}
        {filteredSos.length === 0 && !loading ? (
          <div className="card p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Không tìm thấy yêu cầu SOS nào</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Không có dữ liệu phù hợp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedSos.map((item) => {
              const vConfig =
                VERIFICATION_CONFIG[item.verification_status || "UNVERIFIED"] ||
                VERIFICATION_CONFIG.UNVERIFIED;
              const sStatus = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
              const eType = EMERGENCY_MAP[item.emergency_type?.toUpperCase()] || {
                label: item.emergency_type || "Cứu hộ",
                icon: "🚨",
              };
              const sev = SEVERITY_CONFIG[item.severity?.toUpperCase()] || null;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedSosId(item.id)}
                  className="card p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`badge border text-[11px] ${vConfig.bg}`}>
                        {vConfig.label}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.sent_at
                          ? new Date(item.sent_at).toLocaleString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>

                    {/* Contact Person & Status */}
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-accent transition-colors truncate">
                          {item.contact_name || item.user_full_name || item.citizen_name || "Người dân ẩn danh"}
                        </h3>
                        {sev && (
                          <span className={`badge border text-[10px] ml-2 ${sev.bg}`}>
                            {sev.label}
                          </span>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {item.contact_phone || item.phone || "Chưa có SĐT"}
                        </span>
                        {item.people_count && (
                          <span className="text-xs text-slate-500">
                            · 👥 <strong>{item.people_count}</strong> người
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    <div className="text-xs text-slate-600 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">{item.address || "Chưa rõ địa chỉ cụ thể"}</span>
                    </div>

                    {/* Note */}
                    {(item.note || item.description) && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 line-clamp-2 leading-relaxed">
                        {item.note || item.description}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${sStatus.dot}`} />
                      <span className={`font-semibold ${sStatus.text}`}>{sStatus.label}</span>
                    </div>
                    <span className="text-accent font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Chi tiết & Xác minh →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between card p-3">
            <span className="text-xs text-slate-500">
              Trang <strong className="text-slate-800">{currentPage}</strong> / {totalPages} (Tổng{" "}
              {filteredSos.length} bản ghi)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Detail & Verification Modal */}
        <SOSDetailModal
          sosId={selectedSosId}
          isOpen={Boolean(selectedSosId)}
          onClose={() => setSelectedSosId(null)}
          onUpdated={fetchData}
        />
      </div>
    </AdminLayout>
  );
}
