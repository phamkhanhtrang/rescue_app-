import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../services/api";
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default function DetailReportPage() {
  const [stats, setStats] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedZone, setSelectedZone] = useState("all");
  const [exportFormat, setExportFormat] = useState<"excel" | "pdf" | "json">("excel");
  const [loading, setLoading] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, zonesRes] = await Promise.allSettled([
          api.dashboard.getStats(),
          api.zones.getAll(),
        ]);
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data?.summary || statsRes.value.data);
        if (zonesRes.status === "fulfilled") {
          const list = zonesRes.value.data?.results || zonesRes.value.data || [];
          setZones(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        console.error("Lỗi tải thông số báo cáo:", e);
      }
    };
    fetchData();
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    setExportedSuccess(false);
    try {
      if (exportFormat === "pdf") {
        window.print();
        setLoading(false);
        return;
      }

      // Fetch SOS data to export
      const params: any = { limit: 1000 };
      if (selectedZone !== "all") params.zone = selectedZone;
      const res = await api.sos.getAll(params);
      const sosList = res.data?.results || res.data || [];

      if (exportFormat === "json") {
        const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sosList, null, 2));
        const link = document.createElement("a");
        link.setAttribute("href", jsonContent);
        link.setAttribute("download", `bao_cao_chi_tiet_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Excel/CSV
        const headers = ["ID", "Thời gian", "Người liên hệ", "SĐT", "Địa chỉ", "Loại sự cố", "Mức độ", "Trạng thái", "Khu vực"];
        const rows = sosList.map((s: any) => [
          `"${s.id || ""}"`,
          `"${s.sent_at ? new Date(s.sent_at).toLocaleString("vi-VN") : ""}"`,
          `"${s.contact_name || s.user_full_name || s.citizen_name || "Ẩn danh"}"`,
          `"${s.contact_phone || s.phone || ""}"`,
          `"${(s.address || "").replace(/"/g, '""')}"`,
          `"${s.emergency_type || ""}"`,
          `"${s.severity || ""}"`,
          `"${s.status || ""}"`,
          `"${s.zone_name || ""}"`,
        ]);
        const csvContent =
          "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].map((e) => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `bao_cao_chi_tiet_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setExportedSuccess(true);
      setTimeout(() => setExportedSuccess(false), 4000);
    } catch (err: any) {
      alert("Không thể xuất báo cáo: " + (err.message || "Lỗi kết nối"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cấu hình & Xuất báo cáo chi tiết</h1>
          <p className="text-sm text-slate-500 mt-1">
            Trích xuất dữ liệu hoạt động cứu trợ, nhật ký tín hiệu SOS và hiệu suất khu vực
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Controls (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Parameters */}
            <div className="card p-5 space-y-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                <span>Tham số trích xuất dữ liệu</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Khoảng thời gian</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="24h">24 giờ qua</option>
                    <option value="7d">7 ngày qua</option>
                    <option value="30d">30 ngày qua</option>
                    <option value="all">Toàn bộ lịch sử</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phạm vi khu vực</label>
                  <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="all">Tất cả các khu vực cứu hộ</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.severity || "NORMAL"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Format Selection */}
            <div className="card p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-accent" />
                <span>Định dạng tệp xuất</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setExportFormat("excel")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    exportFormat === "excel"
                      ? "border-accent bg-blue-50/40 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Bảng Excel (.csv)</p>
                      <p className="text-xs text-slate-500 mt-0.5">Phân tích số liệu</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setExportFormat("pdf")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    exportFormat === "pdf"
                      ? "border-accent bg-blue-50/40 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Printer className="w-6 h-6 text-brand" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Tài liệu PDF</p>
                      <p className="text-xs text-slate-500 mt-0.5">In ấn & lưu trữ</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setExportFormat("json")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    exportFormat === "json"
                      ? "border-accent bg-blue-50/40 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-amber-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Dữ liệu JSON</p>
                      <p className="text-xs text-slate-500 mt-0.5">Tích hợp phần mềm</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Dữ liệu được mã hóa chuẩn UTF-8 tương thích tiếng Việt đầy đủ.
                </span>
                <button
                  onClick={handleGenerateReport}
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang xuất dữ liệu...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Tải xuống báo cáo</span>
                    </>
                  )}
                </button>
              </div>

              {exportedSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Báo cáo đã được tạo và tải xuống thiết bị thành công!</span>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Metrics (1 col) */}
          <div className="space-y-6">
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
                Tổng quan dữ liệu hiện có
              </h3>
              <div className="divide-y divide-slate-100 text-sm">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-600">Tổng yêu cầu SOS:</span>
                  <strong className="text-slate-900">{stats?.total_sos || 0}</strong>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-600">Khu vực sự cố:</span>
                  <strong className="text-slate-900">{stats?.total_zones || zones.length}</strong>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-600">Nhiệm vụ cứu hộ:</span>
                  <strong className="text-slate-900">{stats?.total_missions || 0}</strong>
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-3 bg-slate-50 border-slate-200">
              <div className="flex items-center gap-2 text-slate-800 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Tiêu chuẩn dữ liệu chính thức</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tất cả các bản ghi được lưu trữ tập trung phục vụ công tác thanh tra, bàn giao ca trực và lưu trữ
                hồ sơ sự cố thiên tai theo quy định của ban chỉ huy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
