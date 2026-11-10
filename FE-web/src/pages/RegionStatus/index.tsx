import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../services/api";
import { apiErrorMessage } from "../../utils/apiError";
import DataNotice from "../../components/DataNotice";
import {
  MapPin,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Users,
  AlertTriangle,
  ArrowLeft,
  Save,
  Activity,
} from "lucide-react";

const SEVERITY_CONFIG: Record<string, { label: string; badge: string }> = {
  CRITICAL: { label: "Nguy cấp", badge: "bg-red-50 text-red-700 border-red-200" },
  HIGH: { label: "Mức độ cao", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  MEDIUM: { label: "Trung bình", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  LOW: { label: "Thấp", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Đang diễn ra sự cố" },
  { value: "RESCUING", label: "Đang triển khai ứng cứu" },
  { value: "STABILIZED", label: "Tạm thời ổn định" },
  { value: "RESOLVED", label: "Đã an toàn / Hoàn thành" },
];

export default function RegionStatusPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [zone, setZone] = useState<any>(null);
  const [zonesList, setZonesList] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentary, setCommentary] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setLoadError("");
      try {
        if (id) {
          const res = await api.zones.getDetail(id);
          setZone(res.data);
          setSelectedStatus(res.data?.status || "ACTIVE");
          setCommentary(res.data?.description || "");
        } else {
          const res = await api.zones.getAll();
          const list = res.data?.results || res.data || [];
          setZonesList(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        setLoadError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleUpdateStatus = async () => {
    if (!id || !zone) return;
    setUpdating(true);
    setUpdateSuccess("");
    try {
      await api.zones.update(id, {
        status: selectedStatus,
        description: commentary,
      });
      setUpdateSuccess("Cập nhật trạng thái khu vực thành công!");
      setTimeout(() => setUpdateSuccess(""), 4000);
    } catch (e) {
      alert("Lỗi cập nhật: " + apiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {id && (
                <button
                  onClick={() => navigate("/rescue-zone-management")}
                  className="text-slate-400 hover:text-slate-600 mr-1"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <h1 className="text-xl font-bold text-slate-900">
                {id ? `Trạng thái khu vực: ${zone?.name || "Đang tải..."}` : "Danh sách trạng thái khu vực"}
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              {id
                ? "Thẩm định thực tế, tiến độ kiểm soát và xác nhận an toàn khu vực sự cố"
                : "Giám sát cấp độ nguy hiểm và tiến độ ổn định theo từng địa bàn tác chiến"}
            </p>
          </div>

          {id && (
            <button
              onClick={() => navigate(`/details-rescue-zone/${id}`)}
              className="btn-secondary text-xs self-start sm:self-auto"
            >
              Xem chi tiết điều phối vùng →
            </button>
          )}
        </div>

        <DataNotice loading={loading} error={loadError} onRetry={() => window.location.reload()} hasData={Boolean(zone || zonesList.length)} />

        {/* If no ID: display list of zones to choose from */}
        {!id && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zonesList.map((z) => {
              const sev = SEVERITY_CONFIG[z.severity?.toUpperCase()] || {
                label: z.severity || "Bình thường",
                badge: "bg-slate-100 text-slate-600 border-slate-200",
              };
              return (
                <div
                  key={z.id}
                  onClick={() => navigate(`/region-status/${z.id}`)}
                  className="card p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className={`badge border text-[11px] ${sev.badge}`}>{sev.label}</span>
                      <span className="text-xs text-slate-400">Trạng thái: <strong>{z.status}</strong></span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-accent transition-colors">
                      {z.name}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {z.description || "Không có ghi chú mô tả khu vực."}
                    </p>
                  </div>
                  <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-accent font-semibold">
                    <span>Thẩm định hiện trường →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detail for specific zone ID */}
        {id && zone && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 cols: Audit & Operations */}
            <div className="lg:col-span-2 space-y-6">
              {/* Status Select & Summary */}
              <div className="card p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand" />
                  <span>Cập nhật trạng thái kiểm soát thực địa</span>
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedStatus(opt.value)}
                      className={`p-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                        selectedStatus === opt.value
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Commentary */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nhận định chỉ huy & ghi chú hiện trường
                  </label>
                  <textarea
                    rows={4}
                    value={commentary}
                    onChange={(e) => setCommentary(e.target.value)}
                    placeholder="Ghi nhận tình hình nước lũ, đường giao thông, sạt lở hoặc yêu cầu chi viện..."
                    className="input-field w-full text-sm resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {updateSuccess && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={14} /> {updateSuccess}
                    </span>
                  )}
                  <button
                    onClick={handleUpdateStatus}
                    disabled={updating}
                    className="btn-primary text-xs flex items-center gap-1.5 ml-auto"
                  >
                    <Save size={14} />
                    <span>{updating ? "Đang lưu..." : "Lưu thay đổi trạng thái"}</span>
                  </button>
                </div>
              </div>

              {/* Field Verification Checklist */}
              <div className="card p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Quy trình thẩm định thực tế tại khu vực</h2>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-900">Xác nhận phạm vi tọa độ GPS hiện trường</p>
                      <p className="text-emerald-700 mt-0.5">
                        Tọa độ tâm vùng: {zone.latitude}, {zone.longitude} · Bán kính kiểm soát 1.000m
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-blue-900">Khảo sát nguy cơ sạt lở & ngập úng</p>
                      <p className="text-blue-700 mt-0.5">
                        Đội phụ trách đã kiểm tra tình trạng nước rút và đảm bảo đường tiếp cận an toàn cho phương tiện.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Xác nhận sơ tán & cứu hộ hoàn tất</p>
                      <p className="text-slate-500 mt-0.5">
                        Đối chiếu danh sách toàn bộ các hộ dân và người cần trợ giúp khẩn cấp trong khu vực.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right col: Zone Meta */}
            <div className="space-y-6">
              <div className="card p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Thông tin phân vùng
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Mã định danh:</span>
                    <strong className="font-mono text-slate-800">{zone.id?.slice(0, 12)}</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Mức độ nguy hại:</span>
                    <strong className="text-red-600 font-semibold">{zone.severity || "Bình thường"}</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Đội cứu hộ yêu cầu:</span>
                    <strong className="text-slate-800">{zone.rescuers_needed || 1} đội</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Tọa độ GPS:</span>
                    <strong className="text-slate-800 font-mono">
                      {zone.latitude ? `${Number(zone.latitude).toFixed(4)}, ${Number(zone.longitude).toFixed(4)}` : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
