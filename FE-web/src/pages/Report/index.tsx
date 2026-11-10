import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../services/api";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";
import { Download, Printer, TrendingUp, CheckCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";

const SOS_STATUS_MAP: Record<string, { label: string; badge: string }> = {
  PENDING: { label: "Chờ xử lý", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  ACKNOWLEDGED: { label: "Đã tiếp nhận", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "Đang cứu hộ", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  RESOLVED: { label: "Đã giải quyết", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Đã hủy", badge: "bg-slate-100 text-slate-500 border-slate-200" },
};

const SOS_TYPE_MAP: Record<string, string> = {
  MEDICAL: "Y tế",
  FIRE: "Hỏa hoạn",
  FLOOD: "Lũ lụt",
  ACCIDENT: "Tai nạn",
  EARTHQUAKE: "Động đất",
  OTHER: "Khác",
  SOS: "Khẩn cấp",
  PING: "Ping vị trí",
  RESCUE: "Cứu hộ",
  FOOD: "Lương thực",
};

export default function ReportPage() {
  const [stats, setStats] = useState<any>(null);
  const [sosList, setSosList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashRes, sosRes] = await Promise.allSettled([
          api.dashboard.getStats(),
          api.sos.getAll(),
        ]);
        const failures: string[] = [];
        if (dashRes.status === "fulfilled") setStats(dashRes.value.data);
        else failures.push(`thống kê: ${apiErrorMessage(dashRes.reason)}`);
        if (sosRes.status === "fulfilled") setSosList(sosRes.value.data.results || []);
        else failures.push(`SOS: ${apiErrorMessage(sosRes.reason)}`);
        setLoadError(failures.length ? `Không cập nhật được ${failures.join("; ")}.` : "");
      } catch (e) {
        console.error(e);
        setLoadError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reload]);

  const totalSos = stats?.summary?.total_sos || 0;
  const resolvedSos = stats?.sos_by_status?.RESOLVED || 0;
  const resolutionRate = totalSos > 0 ? ((resolvedSos / totalSos) * 100).toFixed(1) : "0.0";

  const resolvedZones = stats?.zones_by_status?.RESOLVED || 0;
  const totalZones = stats?.summary?.total_zones || 0;

  const criticalCount = stats?.zones_by_severity?.CRITICAL || 0;
  const highCount = stats?.zones_by_severity?.HIGH || 0;
  const mediumCount = stats?.zones_by_severity?.MEDIUM || 0;

  const zoneStats = sosList.reduce((acc: any, sos: any) => {
    const zoneName = sos.zone_name || "Chưa phân vùng";
    if (!acc[zoneName]) {
      acc[zoneName] = { total: 0, resolved: 0 };
    }
    acc[zoneName].total += 1;
    if (sos.status === "RESOLVED") {
      acc[zoneName].resolved += 1;
    }
    return acc;
  }, {});

  const zoneProgress = Object.entries(zoneStats)
    .map(([name, data]: any) => {
      const percent = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
      return { name, total: data.total, resolved: data.resolved, percent };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (sosList.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }
    const headers = ["Thời gian", "Loại sự cố", "Trạng thái", "ID", "Vùng"];
    const rows = sosList.map((sos: any) => [
      `"${new Date(sos.sent_at).toLocaleString("vi-VN")}"`,
      `"${SOS_TYPE_MAP[sos.emergency_type?.toUpperCase()] || sos.emergency_type || "Khẩn cấp"}"`,
      `"${SOS_STATUS_MAP[sos.status]?.label || sos.status}"`,
      `"${sos.id}"`,
      `"${sos.zone_name || "Chưa phân vùng"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bao_cao_cuu_ho_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Top Heading & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Báo cáo & Thống kê tổng hợp</h1>
            <p className="text-sm text-slate-500 mt-1">
              Chỉ số hiệu suất điều phối và nhật ký cứu hộ trên toàn hệ thống
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportExcel} className="btn-secondary text-xs flex items-center gap-1.5">
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
            <button onClick={handleExportPDF} className="btn-primary text-xs flex items-center gap-1.5">
              <Printer size={14} />
              <span>In / Xuất PDF</span>
            </button>
          </div>
        </div>

        <DataNotice
          loading={loading}
          error={loadError}
          onRetry={() => setReload((v) => v + 1)}
          hasData={!!stats || sosList.length > 0}
        />

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tỷ lệ xử lý thành công</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900">{resolutionRate}%</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
                <TrendingUp size={12} /> Tốt
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{resolvedSos} / {totalSos} yêu cầu đã giải quyết</p>
          </div>

          <div className="stat-card">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số yêu cầu SOS</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalSos}</p>
            <p className="text-xs text-slate-400 mt-1">{totalSos - resolvedSos} ca đang cần tiếp tục hỗ trợ</p>
          </div>

          <div className="stat-card">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Khu vực đã an toàn</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{resolvedZones}</p>
            <p className="text-xs text-slate-400 mt-1">trên tổng số {totalZones} khu vực ghi nhận</p>
          </div>

          <div className="stat-card">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Khu vực nguy cấp</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{criticalCount}</p>
            <p className="text-xs text-slate-400 mt-1">{highCount} vùng mức độ cao · {mediumCount} vùng trung bình</p>
          </div>
        </div>

        {/* Charts & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Zone Resolution Progress */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Tiến độ giải quyết theo khu vực</h2>
              <span className="text-xs text-slate-400">Top khu vực có nhiều SOS</span>
            </div>
            <div className="space-y-3.5">
              {zoneProgress.map((zone, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800 truncate">{zone.name}</span>
                    <span className="text-slate-500 font-medium shrink-0 ml-2">
                      {zone.resolved}/{zone.total} ({zone.percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-brand h-full rounded-full transition-all duration-300"
                      style={{ width: `${zone.percent}%` }}
                    />
                  </div>
                </div>
              ))}
              {zoneProgress.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">Chưa có dữ liệu sự cố khu vực.</div>
              )}
            </div>
          </div>

          {/* Severity Breakdown */}
          <div className="card p-5 space-y-4 flex flex-col justify-between">
            <h2 className="text-base font-bold text-slate-900">Phân bố mức độ nghiêm trọng khu vực</h2>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-red-800">Nguy cấp (Cần ứng cứu khẩn cấp)</span>
                <strong className="text-sm text-red-900">{criticalCount} vùng</strong>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-800">Mức độ Cao (Nguy cơ sạt lở/lũ quét)</span>
                <strong className="text-sm text-amber-900">{highCount} vùng</strong>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-800">Trung bình (Đang theo dõi kiểm soát)</span>
                <strong className="text-sm text-blue-900">{mediumCount} vùng</strong>
              </div>
            </div>
            <div className="pt-2 text-xs text-slate-400 border-t border-slate-100 flex items-center justify-between">
              <span>Tổng số vùng phân loại:</span>
              <strong className="text-slate-700">{totalZones} vùng</strong>
            </div>
          </div>
        </div>

        {/* Recent SOS Table */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Nhật ký sự cố tiếp nhận gần đây</h2>
              <p className="text-xs text-slate-500 mt-0.5">Dữ liệu các yêu cầu cứu trợ đã chuyển tới trung tâm chỉ huy</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="table-head">
                <tr>
                  <th className="p-3.5 pl-5">Thời gian gửi</th>
                  <th className="p-3.5">Loại sự cố</th>
                  <th className="p-3.5">Khu vực</th>
                  <th className="p-3.5 pr-5">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sosList.slice(0, 10).map((sos: any, i) => {
                  const sStatus = SOS_STATUS_MAP[sos.status] || {
                    label: sos.status,
                    badge: "bg-slate-100 text-slate-600 border-slate-200",
                  };
                  return (
                    <tr key={i} className="table-row">
                      <td className="p-3.5 pl-5 text-xs text-slate-600">
                        {new Date(sos.sent_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="p-3.5">
                        <span className="badge border text-[11px] bg-slate-50 text-slate-700 border-slate-200">
                          {SOS_TYPE_MAP[sos.emergency_type?.toUpperCase()] || sos.emergency_type || "Khẩn cấp"}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-900 text-xs">
                        {sos.zone_name || "Chưa phân vùng"}
                      </td>
                      <td className="p-3.5 pr-5">
                        <span className={`badge border text-[11px] ${sStatus.badge}`}>
                          {sStatus.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sosList.length === 0 && !loading && (
              <div className="p-10 text-center text-sm text-slate-400">Chưa có nhật ký sự cố nào.</div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
