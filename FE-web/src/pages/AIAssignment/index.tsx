import { useState, useEffect } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import {
  Users, Zap, RefreshCw, MapPin, Star,
  CheckCircle, ChevronRight, AlertTriangle, Info
} from "lucide-react";

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  CRITICAL: { label: "Nguy cấp",    bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  HIGH:     { label: "Cao",         bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  MEDIUM:   { label: "Trung bình",  bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  LOW:      { label: "Thấp",        bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
};

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-blue-500" : score >= 40 ? "bg-orange-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-800 w-10 text-right">{score}</span>
    </div>
  );
}

export default function AIAssignment({ isModal = false, onAssigned }: { isModal?: boolean; onAssigned?: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  useEffect(() => { fetchRecommendations(); }, []);

  const handleAccept = async (rec: any) => {
    setAccepting(rec.rescuer_id);
    try {
      // Tạo Mission từ gợi ý AI
      await api.missions.create({
        rescuer: rec.rescuer_id,
        zone: rec.zone_id,
        notes: `[AI Gợi ý] Điểm phù hợp: ${rec.match_score}/100. ${rec.reasons?.join(". ")}`,
      });
      setAccepted(prev => new Set(prev).add(rec.rescuer_id));
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
        <div className={`p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6 ${isModal ? 'pt-10' : ''}`}>

          {/* ── Tiêu đề ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Zap className="text-amber-500" size={28} />
                AI Gợi ý Phân công Rescuer
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Hệ thống AI tự động tính toán và đề xuất Rescuer phù hợp nhất cho từng Zone đang cần người.
              </p>
            </div>
            <button
              onClick={fetchRecommendations}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Tính lại
            </button>
          </div>

          {/* ── Thống kê nhanh ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Rescuer đang rảnh</p>
              <p className="text-3xl font-bold text-blue-600">{summary.rescuers_available}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Zone cần thêm người</p>
              <p className="text-3xl font-bold text-red-600">{summary.zones_needing_help}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Đề xuất hôm nay</p>
              <p className="text-3xl font-bold text-green-600">{recommendations.length}</p>
            </div>
          </div>

          {/* ── Chú giải điểm ── */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700">
              <strong>Điểm phù hợp (0–100)</strong> được tính từ:
              khoảng cách GPS <strong>(35%)</strong> + chuyên môn phù hợp <strong>(30%)</strong> + mức ưu tiên Zone AI <strong>(25%)</strong> + thiếu hụt nhân lực <strong>(10%)</strong>.
              Điểm càng cao → phân công càng tối ưu.
            </p>
          </div>

          {/* ── Danh sách gợi ý ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-16 flex justify-center">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : recommendations.length === 0 ? (
              <div className="p-12 text-center">
                <AlertTriangle size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  {summary.message || "Không có đề xuất phân công nào. Có thể tất cả Zone đã đủ nhân lực hoặc không có Rescuer đang rảnh."}
                </p>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <span className="col-span-1 text-center">#</span>
                  <span className="col-span-3">Rescuer</span>
                  <span className="col-span-1 text-center"><ChevronRight size={14} className="inline" /></span>
                  <span className="col-span-3">Zone được đề xuất</span>
                  <span className="col-span-2 text-center">Điểm phù hợp</span>
                  <span className="col-span-2 text-right">Hành động</span>
                </div>

                <div className="divide-y divide-gray-50">
                  {recommendations.map((rec, index) => {
                    const sev = SEVERITY_CONFIG[rec.zone_severity] || SEVERITY_CONFIG.LOW;
                    const isAccepted = accepted.has(rec.rescuer_id);
                    const isAccepting = accepting === rec.rescuer_id;

                    return (
                      <div
                        key={`${rec.rescuer_id}-${rec.zone_id}`}
                        className={`px-6 py-4 grid grid-cols-12 items-center gap-2 transition-colors ${isAccepted ? "bg-green-50" : "hover:bg-slate-50"}`}
                      >
                        {/* Số thứ tự */}
                        <div className="col-span-1 text-center">
                          {index === 0 ? (
                            <Star size={16} className="text-amber-400 mx-auto" fill="currentColor" />
                          ) : (
                            <span className="text-sm text-gray-400 font-medium">{index + 1}</span>
                          )}
                        </div>

                        {/* Rescuer */}
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                              {rec.rescuer_name?.charAt(0) || "R"}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{rec.rescuer_name}</p>
                              <p className="text-xs text-gray-400">Đang rảnh</p>
                            </div>
                          </div>
                        </div>

                        {/* Mũi tên */}
                        <div className="col-span-1 flex justify-center">
                          <ChevronRight size={18} className="text-gray-300" />
                        </div>

                        {/* Zone */}
                        <div className="col-span-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-gray-400 shrink-0" />
                              <p className="text-sm font-semibold text-gray-900 truncate">{rec.zone_name}</p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${sev.bg} ${sev.text} border ${sev.border}`}>
                              {sev.label}
                            </span>
                            {/* Lý do gợi ý */}
                            <div className="flex flex-col gap-0.5 mt-1">
                              {rec.reasons?.map((r: string, i: number) => (
                                <span key={i} className="text-xs text-gray-400">• {r}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="col-span-2 flex justify-center">
                          <ScoreMeter score={rec.match_score} />
                        </div>

                        {/* Hành động */}
                        <div className="col-span-2 flex justify-end">
                          {isAccepted ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                              <CheckCircle size={16} />
                              Đã giao
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAccept(rec)}
                              disabled={isAccepting}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-all
                                ${isAccepting ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-sm"}`}
                            >
                              {isAccepting ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <CheckCircle size={14} />
                              )}
                              Giao việc
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </div>
  );

  if (isModal) {
    return content;
  }

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      <div className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <SliderBar />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {content}
      </div>
    </div>
  );
}
