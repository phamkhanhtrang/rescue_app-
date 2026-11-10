import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiError";
import {
  X,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MessageSquare,
  TrendingDown,
  ShieldCheck,
  XCircle,
  Droplets,
  UserCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Image as ImageIcon,
} from "lucide-react";

interface FieldReportDetailModalProps {
  reportId: string | null;
  initialReport?: any | null;
  isOpen: boolean;
  onClose: () => void;
  onLocate?: (report: any) => void;
  onUpdated?: () => void;
}

const HAZARD_META: Record<string, { icon: string; label: string; color: string }> = {
  FLOOD: { icon: "🌊", label: "Ngập lụt", color: "text-blue-700 bg-blue-50 border-blue-200" },
  FALLEN_TREE: { icon: "🌲", label: "Cây đổ chắn đường", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  LANDSLIDE: { icon: "⛰️", label: "Sạt lở đất đá", color: "text-amber-800 bg-amber-50 border-amber-200" },
  POWER_LINE: { icon: "⚡", label: "Dây điện đứt / Cột đổ", color: "text-purple-700 bg-purple-50 border-purple-200" },
  ROAD_BLOCKED: { icon: "🚧", label: "Đường chia cắt / Cầu hỏng", color: "text-red-700 bg-red-50 border-red-200" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "⏳ Chờ xác thực", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  VERIFIED: { label: "✓ Đã xác thực nguy hiểm", cls: "bg-red-100 text-red-700 border-red-300" },
  RECEDING: { label: "🌊 Nước đang rút (Còn ngập nhẹ)", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  CLEARED: { label: "✅ Đường đã thông", cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  EXPIRED: { label: "⌛ Đã hết hạn (Tự ẩn)", cls: "bg-slate-200 text-slate-600 border-slate-300" },
  REJECTED: { label: "✕ Đã bác bỏ (Báo sai)", cls: "bg-slate-200 text-slate-600 border-slate-300" },
};

const VERDICT_BADGE: Record<string, { label: string; cls: string }> = {
  CONFIRM_DANGER: { label: "Đúng, đang nguy hiểm", cls: "bg-red-100 text-red-700" },
  WORSENED: { label: "Đang nặng thêm", cls: "bg-orange-100 text-orange-700" },
  RECEDING: { label: "Nước đang rút (Còn ngập)", cls: "bg-amber-100 text-amber-800" },
  CLEARED: { label: "Đường đã thông", cls: "bg-emerald-100 text-emerald-700" },
  FALSE_REPORT: { label: "Báo cáo sai", cls: "bg-slate-200 text-slate-600" },
  HIDE: { label: "Admin ẩn đoạn đường", cls: "bg-slate-700 text-white" },
  UNHIDE: { label: "Admin hiện lại đoạn đường", cls: "bg-blue-600 text-white" },
};

export default function FieldReportDetailModal({
  reportId,
  initialReport,
  isOpen,
  onClose,
  onLocate,
  onUpdated,
}: FieldReportDetailModalProps) {
  const [report, setReport] = useState<any | null>(initialReport || null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [waterLevelInput, setWaterLevelInput] = useState<string>("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await api.fieldReports.getDetail(id);
      setReport(res.data);
      if (res.data?.water_level_cm !== undefined && res.data?.water_level_cm !== null) {
        setWaterLevelInput(String(res.data.water_level_cm));
      }
    } catch (err) {
      setFeedbackMsg({ type: "err", text: apiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && reportId) {
      if (initialReport && initialReport.id === reportId) {
        setReport(initialReport);
      }
      void loadDetail(reportId);
    } else if (!isOpen) {
      setFeedbackMsg(null);
      setNote("");
    }
  }, [isOpen, reportId]);

  if (!isOpen || (!report && !loading)) return null;

  const handleAdminToggleHide = async () => {
    if (!report?.id) return;
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      const verdict = report.is_hidden ? "UNHIDE" : "HIDE";
      const res = await api.fieldReports.vote(report.id, {
        verdict,
        voter_role: "ADMIN",
        note: verdict === "HIDE" ? "Admin đã ẩn đoạn đường khỏi bản đồ công khai." : "Admin đã mở lại hiển thị đoạn đường.",
      });
      setReport(res.data);
      setFeedbackMsg({
        type: "ok",
        text: res.data.is_hidden
          ? "Đã ẩn đoạn đường khỏi bản đồ công khai và mở khóa lại định tuyến OSRM!"
          : "Đã hiển thị lại đoạn đường trên bản đồ!",
      });
      if (onUpdated) onUpdated();
    } catch (err) {
      setFeedbackMsg({ type: "err", text: apiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminVote = async (
    verdict: "CONFIRM_DANGER" | "RECEDING" | "CLEARED" | "FALSE_REPORT"
  ) => {
    if (!report?.id) return;
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      const adminName = localStorage.getItem("user_name") || "Ban Chỉ Huy (Admin)";
      const parsedWl =
        verdict === "CLEARED"
          ? 0
          : waterLevelInput.trim() !== "" && !Number.isNaN(Number(waterLevelInput))
          ? Number(waterLevelInput)
          : undefined;

      const defaultNotes: Record<string, string> = {
        CONFIRM_DANGER: "Ban Chỉ Huy xác thực điểm nguy hiểm, gia hạn thời gian cảnh báo trên OSRM.",
        RECEDING: "Ban Chỉ Huy cập nhật: Nước đang rút dần nhưng mặt đường vẫn còn ngập nhẹ/bùn lầy.",
        CLEARED: "Ban Chỉ Huy xác nhận: Đường đã thông hoàn toàn, mở khóa dẫn đường OSRM (hiển thị màu xanh 60 phút).",
        FALSE_REPORT: "Ban Chỉ Huy bác bỏ báo cáo không chính xác và ẩn khỏi bản đồ.",
      };

      const res = await api.fieldReports.vote(report.id, {
        verdict,
        note: note.trim() || defaultNotes[verdict],
        water_level_cm: parsedWl,
        voter_name: adminName,
        voter_role: "ADMIN",
        voter_id: `admin_${localStorage.getItem("user_username") || "hq"}`,
      });
      setReport(res.data);
      setNote("");
      setFeedbackMsg({
        type: "ok",
        text: `Đã cập nhật trạng thái báo cáo sang "${res.data.status_display || res.data.status}"!`,
      });
      if (onUpdated) onUpdated();
    } catch (err) {
      setFeedbackMsg({ type: "err", text: apiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const hazard = HAZARD_META[report?.hazard_type] || HAZARD_META.FLOOD;
  const statusInfo = STATUS_BADGE[report?.status] || STATUS_BADGE.PENDING;
  const votes: any[] = report?.votes || [];
  const summary = report?.vote_summary || {
    confirm_count: 0,
    receding_count: 0,
    cleared_count: 0,
    false_count: 0,
    active_total: 0,
    total: votes.length,
  };

  const formatRemainingMinutes = (mins?: number | null) => {
    if (mins === null || mins === undefined) return null;
    if (mins <= 0) return "Đã hết thời hạn (tự ẩn)";
    if (mins < 60) return `Tự ẩn sau ${mins} phút nếu không ai vote thêm`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `Tự ẩn sau ${h}h${m > 0 ? `${m}p` : ""} nếu không ai vote thêm`;
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{hazard.icon}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">
                  {report?.hazard_display || hazard.label}
                  {report?.water_level_cm > 0 ? ` — Ngập ${report.water_level_cm}cm` : ""}
                </h3>
                {report?.incident_wave > 1 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/40 rounded-full">
                    🔄 Đợt sự cố #{report.incident_wave}
                  </span>
                )}
                {report?.is_hidden && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-slate-700 text-slate-300 rounded-full flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> Đã ẩn khỏi bản đồ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Người báo đầu tiên: <b>{report?.reporter_name || "Người dân"}</b> •{" "}
                {report?.created_at
                  ? new Date(report.created_at).toLocaleString("vi-VN")
                  : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && !report ? (
            <div className="py-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Đang tải dữ liệu hiện trường...</span>
            </div>
          ) : (
            <>
              {/* 1. Status & Location Summary */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                    {report?.remaining_minutes !== undefined && report?.remaining_minutes !== null && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRemainingMinutes(report.remaining_minutes)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onLocate && report && (
                      <button
                        onClick={() => onLocate(report)}
                        className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Phóng tới trên bản đồ</span>
                      </button>
                    )}
                    <button
                      disabled={submitting}
                      onClick={handleAdminToggleHide}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                        report?.is_hidden
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-slate-700 hover:bg-slate-800 text-white"
                      }`}
                    >
                      {report?.is_hidden ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Hiện lại đoạn đường</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Ẩn khỏi bản đồ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-700 space-y-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>
                      {report?.address ||
                        `Tọa độ GPS: ${Number(report?.location_lat).toFixed(5)}, ${Number(
                          report?.location_lng
                        ).toFixed(5)}`}
                    </span>
                    {report?.segment_length_m ? (
                      <span className="text-slate-400 font-normal">
                        (Đoạn đường dài ~{report.segment_length_m}m)
                      </span>
                    ) : null}
                  </p>

                  {/* Ảnh hiện trường đính kèm của báo cáo gốc */}
                  {report?.image_url && (
                    <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-200 bg-white">
                      <div className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 border-b border-slate-200">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>ẢNH HIỆN TRƯỜNG TỪ NGƯỜI DÂN:</span>
                      </div>
                      <img
                        src={report.image_url}
                        alt="Ảnh hiện trường"
                        className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition"
                        onClick={() => window.open(report.image_url, "_blank")}
                      />
                    </div>
                  )}

                  {report?.description && (
                    <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 whitespace-pre-line">
                      <span className="text-[11px] font-bold text-slate-400 block mb-0.5">
                        MÔ TẢ HIỆN TRƯỜNG:
                      </span>
                      {report.description}
                    </div>
                  )}
                </div>

                {/* Vote Summary Counters (Quy tắc 1, 2, 4) */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-center">
                  <div className="p-2 rounded-lg bg-red-50 border border-red-100">
                    <div className="text-base font-extrabold text-red-600">{summary.confirm_count}</div>
                    <div className="text-[11px] font-semibold text-red-700">Đang nguy hiểm</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="text-base font-extrabold text-amber-600">
                      {summary.receding_count || 0}
                    </div>
                    <div className="text-[11px] font-semibold text-amber-800">Nước đang rút</div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="text-base font-extrabold text-emerald-600">
                      {summary.cleared_count}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700">Đường đã thông</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                    <div className="text-base font-extrabold text-slate-600">{summary.false_count}</div>
                    <div className="text-[11px] font-semibold text-slate-600">Báo cáo sai</div>
                  </div>
                </div>
              </div>

              {/* 2. Admin Command Override Section */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Lệnh Xác Thực & Điều Phối Của Ban Chỉ Huy (Admin)</span>
                  </h4>
                  <span className="text-[11px] text-blue-700 font-semibold">
                    Hiệu lực tức thì trên Bản đồ & OSRM
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Ghi chú chỉ huy (lưu vào lịch sử điểm báo):
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="VD: Đã cử đội xuồng máy kiểm tra / Nước rút còn 20cm..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Mức nước (cm):
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={waterLevelInput}
                      onChange={(e) => setWaterLevelInput(e.target.value)}
                      placeholder="VD: 50"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {feedbackMsg && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-semibold ${
                      feedbackMsg.type === "ok"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-red-100 text-red-700 border border-red-300"
                    }`}
                  >
                    {feedbackMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    disabled={submitting}
                    onClick={() => handleAdminVote("CONFIRM_DANGER")}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Xác thực Nguy hiểm</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleAdminVote("RECEDING")}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Nước đang rút</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleAdminVote("CLEARED")}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đường đã thông</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleAdminVote("FALSE_REPORT")}
                    className="px-3 py-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Bác bỏ (Báo sai)</span>
                  </button>
                </div>
              </div>

              {/* 3. Voter & Field Note Timeline */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    <span>
                      Nhật ký Người dân & Cứu hộ xác nhận ({votes.length} lượt —{" "}
                      {summary.active_total || 0} phiếu hiện hành)
                    </span>
                  </h4>
                </div>

                {votes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    Chưa có lượt xác nhận hay ghi chú nào.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {votes.map((v: any) => {
                      const vBadge = VERDICT_BADGE[v.verdict] || {
                        label: v.verdict_display || v.verdict,
                        cls: "bg-slate-100 text-slate-700",
                      };
                      const isActive = v.is_active_vote !== false;
                      const isOfficial = v.voter_role === "ADMIN" || v.voter_role === "RESCUER";

                      return (
                        <div
                          key={v.id}
                          className={`p-3 rounded-xl border transition ${
                            isActive
                              ? "bg-white border-slate-200 shadow-2xs"
                              : "bg-slate-50/70 border-slate-200/70 opacity-70"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                                {v.voter_name || "Người dân"}
                              </span>

                              {isOfficial && (
                                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-blue-600 text-white">
                                  {v.voter_role === "ADMIN" ? "BAN CHỈ HUY" : "ĐỘI CỨU HỘ"}
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                  isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {isActive ? "PHIẾU HIỆN HÀNH" : "LỊCH SỬ CŨ"}
                              </span>

                              {v.incident_wave > 1 && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-sky-100 text-sky-700">
                                  ĐỢT #{v.incident_wave}
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {v.voted_at ? new Date(v.voted_at).toLocaleString("vi-VN") : ""}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${vBadge.cls}`}>
                              {vBadge.label}
                            </span>

                            {v.water_level_cm !== null && v.water_level_cm !== undefined && (
                              <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                                <Droplets className="w-3.5 h-3.5" />
                                Mức nước: {v.water_level_cm}cm
                              </span>
                            )}
                          </div>

                          {v.image_url && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 max-w-sm">
                              <img
                                src={v.image_url}
                                alt="Ảnh xác thực"
                                className="w-full h-36 object-cover cursor-pointer hover:opacity-95 transition"
                                onClick={() => window.open(v.image_url, "_blank")}
                              />
                            </div>
                          )}

                          {v.note && (
                            <p className="mt-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                              “{v.note}”
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
