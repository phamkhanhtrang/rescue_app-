import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../services/api";
import {
  Users,
  Zap,
  RefreshCw,
  MapPin,
  Star,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Info,
} from "lucide-react";

const SEVERITY_CONFIG: Record<string, { label: string; badge: string }> = {
  CRITICAL: { label: "Nguy cấp", badge: "bg-red-50 text-red-700 border-red-200" },
  HIGH: { label: "Cao", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  MEDIUM: { label: "Trung bình", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  LOW: { label: "Thấp", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function ScoreMeter({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-500"
      : score >= 60
      ? "bg-blue-500"
      : score >= 40
      ? "bg-amber-500"
      : "bg-slate-300";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-800 w-8 text-right">{score}</span>
    </div>
  );
}

export default function AIAssignment({
  isModal = false,
  onAssigned,
}: {
  isModal?: boolean;
  onAssigned?: () => void;
}) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [summary, setSummary] = useState({ rescuers_available: 0, zones_needing_help: 0, message: "" });
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await api.ai.getRecommendations({ top_n: 15 });
      setRecommendations(res.data.recommendations || []);
      setSummary({
        rescuers_available: res.data.rescuers_available || 0,
        zones_needing_help: res.data.zones_needing_help || 0,
        message: res.data.message || "",
      });
    } catch (err) {
      console.error("Lỗi lấy gợi ý phân công:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleAccept = async (rec: any) => {
    setAccepting(rec.rescuer_id);
    try {
      await api.missions.create({
        rescuer: rec.rescuer_id,
        zone: rec.zone_id,
        notes: `[AI Gợi ý] Điểm phù hợp: ${rec.match_score}/100. ${rec.reasons?.join(". ")}`,
      });
      setAccepted((prev) => new Set(prev).add(rec.rescuer_id));
      if (onAssigned) {
        onAssigned();
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.response?.data?.error || "Không thể tạo nhiệm vụ. Kiểm tra lại API.");
    } finally {
      setAccepting(null);
    }
  };

  const content = (
    <div className={`space-y-6 ${isModal ? "p-4" : ""}`}>
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="text-amber-500 w-5 h-5" />
            <span>AI Gợi ý phân công lực lượng cứu hộ</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hệ thống AI tự động tính toán khoảng cách và chuyên môn để đề xuất đội phù hợp nhất
          </p>
        </div>
        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Tính toán lại</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cứu hộ viên đang rảnh</p>
          <p className="text-2xl font-bold text-accent mt-1">{summary.rescuers_available}</p>
          <p className="text-xs text-slate-400 mt-1">Sẵn sàng nhận nhiệm vụ</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Khu vực cần thêm người</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{summary.zones_needing_help}</p>
          <p className="text-xs text-slate-400 mt-1">Đang thiếu nhân lực cứu hộ</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đề xuất tối ưu hôm nay</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{recommendations.length}</p>
          <p className="text-xs text-slate-400 mt-1">Phương án phân công</p>
        </div>
      </div>

      {/* Explanation banner */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
        <Info size={16} className="text-accent mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong>Điểm phù hợp (0–100)</strong> được AI tính toán dựa trên: khoảng cách GPS <strong>(35%)</strong> +
          chuyên môn phù hợp <strong>(30%)</strong> + mức ưu tiên khu vực <strong>(25%)</strong> + tình trạng thiếu quân{" "}
          <strong>(10%)</strong>.
        </p>
      </div>

      {/* Recommendations List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 mt-2">Đang phân tích và tối ưu phương án...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="py-16 text-center p-6 space-y-2">
            <AlertTriangle size={36} className="text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Không có đề xuất phân công nào</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {summary.message || "Tất cả các khu vực đã có đủ lực lượng cứu hộ hoặc hiện không có nhân sự rảnh."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recommendations.map((rec) => {
              const isAccepted = accepted.has(rec.rescuer_id);
              const isBusy = accepting === rec.rescuer_id;
              const sev = SEVERITY_CONFIG[rec.zone_severity?.toUpperCase()] || {
                label: rec.zone_severity || "Bình thường",
                badge: "bg-slate-100 text-slate-700 border-slate-200",
              };

              return (
                <div key={rec.rescuer_id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{rec.rescuer_name}</h3>
                      <span className="badge border text-[11px] bg-slate-50 text-slate-600 border-slate-200">
                        {rec.rescuer_specialty || "Cứu hộ tổng hợp"}
                      </span>
                      <ChevronRight size={14} className="text-slate-300" />
                      <span className="text-xs font-semibold text-slate-800">{rec.zone_name}</span>
                      <span className={`badge border text-[10px] ${sev.badge}`}>{sev.label}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {rec.distance_km != null && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          Cách {Number(rec.distance_km).toFixed(1)} km
                        </span>
                      )}
                      {rec.reasons?.map((r: string, i: number) => (
                        <span key={i} className="text-slate-600">
                          · {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Score & Assign Button */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium text-right mb-0.5">Điểm phù hợp</p>
                      <ScoreMeter score={rec.match_score} />
                    </div>

                    <button
                      onClick={() => handleAccept(rec)}
                      disabled={isAccepted || isBusy}
                      className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                        isAccepted
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                          : "btn-primary"
                      }`}
                    >
                      {isAccepted ? (
                        <>
                          <CheckCircle size={14} />
                          <span>Đã phân công</span>
                        </>
                      ) : isBusy ? (
                        <span>Đang giao...</span>
                      ) : (
                        <span>Giao việc ngay</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return content;
  }

  return <AdminLayout>{content}</AdminLayout>;
}
