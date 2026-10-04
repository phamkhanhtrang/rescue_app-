import React, { useState, useEffect, useMemo, useCallback, Component } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import {
  X,
  Phone,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Navigation,
  UserPlus,
  ExternalLink,
  Mail,
  Truck,
  Check,
  Copy,
  Activity,
  RefreshCw,
} from "lucide-react";

export interface TeamDetailModalProps {
  isOpen: boolean;
  teamId?: string | null;
  team?: any | null;
  onClose: () => void;
  onLocate?: (team: any) => void;
  onAssign?: (team: any) => void;
}

const SPECIALTY_LABELS: Record<string, string> = {
  SEARCH_RESCUE: "Tìm kiếm & Cứu nạn",
  MEDICAL: "Y tế cấp cứu",
  LOGISTICS: "Hậu cần & Tiếp tế",
  COMMAND: "Chỉ huy tác chiến",
};

// ── Helper phòng vệ dữ liệu an toàn ───────────────────────────────────────
const toSafeString = (val: any, fallback = ""): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    return val.name || val.title || val.label || val.unit_name || val.full_name || fallback;
  }
  return String(val);
};

const toSafeDateString = (val: any, includeTime = false): string => {
  if (!val) return "N/A";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "N/A";
    return includeTime
      ? d.toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : d.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  } catch {
    return "N/A";
  }
};

// ── Error Boundary bảo vệ Modal chống crash toàn ứng dụng ─────────────────
interface ErrorBoundaryState {
  hasError: boolean;
}

class TeamDetailErrorBoundary extends Component<
  { children: React.ReactNode; onClose: () => void },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("TeamDetailModal caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center shadow-2xl border border-red-200 space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Không thể hiển thị chi tiết đội này
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Dữ liệu của đội cứu hộ này chưa đồng bộ đủ trường hoặc gặp sự cố định dạng. Hệ thống đã bảo vệ ứng dụng không bị gián đoạn.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={this.props.onClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function TeamDetailModalContent({
  isOpen,
  teamId,
  team: initialTeam,
  onClose,
  onLocate,
  onAssign,
}: TeamDetailModalProps) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"profile" | "history">("profile");
  const [loading, setLoading] = useState(false);
  const [teamData, setTeamData] = useState<any>(initialTeam || null);
  const [resourceData, setResourceData] = useState<any>(null);
  const [activeMission, setActiveMission] = useState<any>(null);
  const [, setZonesList] = useState<any[]>([]);

  // Lịch sử nhiệm vụ
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Copy feedback
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const targetId = useMemo(() => {
    const raw = teamId ?? initialTeam?.id ?? initialTeam?.rescuer ?? null;
    return raw !== null && raw !== undefined ? String(raw).trim() : null;
  }, [teamId, initialTeam]);

  // Load đầy đủ thông tin đội khi mở modal
  const fetchFullData = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const [rescuersRes, resourcesRes, missionsRes, zonesRes] = await Promise.all([
        api.rescuers.getAll().catch(() => ({ data: [] })),
        api.resources.getAll().catch(() => ({ data: [] })),
        api.missions.getAll().catch(() => ({ data: [] })),
        api.zones.getAll().catch(() => ({ data: [] })),
      ]);

      const rescuers = Array.isArray(rescuersRes?.data?.results)
        ? rescuersRes.data.results
        : Array.isArray(rescuersRes?.data)
        ? rescuersRes.data
        : [];
      const resources = Array.isArray(resourcesRes?.data?.results)
        ? resourcesRes.data.results
        : Array.isArray(resourcesRes?.data)
        ? resourcesRes.data
        : [];
      const missions = Array.isArray(missionsRes?.data?.results)
        ? missionsRes.data.results
        : Array.isArray(missionsRes?.data)
        ? missionsRes.data
        : [];
      const zones = Array.isArray(zonesRes?.data?.results)
        ? zonesRes.data.results
        : Array.isArray(zonesRes?.data)
        ? zonesRes.data
        : [];

      setZonesList(zones);

      // Tìm thông tin Rescuer theo ID
      const foundRescuer = rescuers.find(
        (r: any) =>
          String(r.id) === targetId ||
          String(r.rescuer) === targetId ||
          (r.user && String(r.user) === targetId)
      );

      // Nếu đã có initialTeam và có profile thì gộp lại
      const mergedTeam = foundRescuer || initialTeam || { id: targetId };
      setTeamData(mergedTeam);

      // Tìm Resource tương ứng
      const foundResource = resources.find((res: any) => {
        const resRescuerId =
          typeof res.rescuer === "object" ? String(res.rescuer?.id) : String(res.rescuer);
        return (
          resRescuerId === targetId ||
          (mergedTeam?.id && resRescuerId === String(mergedTeam.id))
        );
      });
      setResourceData(foundResource || initialTeam?.computed?.resource || null);

      // Tìm Active Mission
      const foundActiveMission = missions.find((m: any) => {
        const mRescuerId =
          typeof m.rescuer === "object" ? String(m.rescuer?.id) : String(m.rescuer);
        return (
          mRescuerId === targetId &&
          ["PENDING_ACCEPTANCE", "ACCEPTED", "ON_MY_WAY", "ACTIVE", "NEEDS_HELP"].includes(
            m.status
          )
        );
      });
      setActiveMission(foundActiveMission || initialTeam?.computed?.activeMission || null);
    } catch (err) {
      console.error("Lỗi tải chi tiết đội cứu hộ:", err);
    } finally {
      setLoading(false);
    }
  }, [targetId, initialTeam]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("profile");
      setHistoryLoaded(false);
      setHistory([]);
      if (initialTeam) {
        setTeamData(initialTeam);
        setResourceData(initialTeam.computed?.resource || null);
        setActiveMission(initialTeam.computed?.activeMission || null);
      }
      fetchFullData();
    }
  }, [isOpen, initialTeam, fetchFullData]);

  // Tải lịch sử nhiệm vụ khi chuyển tab
  useEffect(() => {
    if (isOpen && activeTab === "history" && !historyLoaded && targetId) {
      setHistoryLoading(true);
      api.missions
        .getHistory(targetId)
        .then((resp) => {
          const data = resp?.data ?? resp;
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
            ? data.results
            : [];
          setHistory(list);
          setHistoryLoaded(true);
        })
        .catch((err) => {
          console.error("Lỗi tải lịch sử cứu hộ:", err);
          setHistory([]);
        })
        .finally(() => setHistoryLoading(false));
    }
  }, [isOpen, activeTab, historyLoaded, targetId]);

  if (!isOpen) return null;

  // Dữ liệu an toàn tuyệt đối
  const profile = teamData?.rescuer_profile || {};
  const computed = teamData?.computed || {};
  const resource = resourceData || computed?.resource || null;

  const rawFullName = teamData?.full_name || teamData?.rescuer_name || profile?.full_name;
  const fullName = toSafeString(rawFullName, "Cứu hộ viên");

  const rawUnitName = profile?.unit_name || teamData?.name || fullName;
  const unitName = toSafeString(rawUnitName, fullName || "Đội Cứu Hộ");

  const specialty = toSafeString(profile?.specialty || teamData?.type, "SEARCH_RESCUE");
  const specialtyLabel = SPECIALTY_LABELS[specialty] || specialty || "Cứu hộ tổng hợp";

  const rawPhone = teamData?.phone || profile?.phone || teamData?.rescuer_phone;
  const phone = toSafeString(rawPhone, "");

  const email = toSafeString(teamData?.email, "");
  const idNumber = toSafeString(profile?.id_number || teamData?.id_number, "Chưa cập nhật");
  const rank = toSafeString(profile?.rank, "Hạng 1");
  const isOnDuty = Boolean(profile?.is_on_duty);
  const isActive = teamData?.is_active !== false;

  // GPS an toàn
  const rawLat = Number(computed?.lat ?? profile?.current_lat ?? teamData?.current_lat);
  const rawLng = Number(computed?.lng ?? profile?.current_lng ?? teamData?.current_lng);
  const hasGps = !isNaN(rawLat) && !isNaN(rawLng) && rawLat !== 0 && rawLng !== 0;

  // Trạng thái tác chiến
  let computedStatus = toSafeString(computed?.status, "");
  if (!computedStatus) {
    if (activeMission) {
      if (activeMission.status === "NEEDS_HELP") computedStatus = "CẦN HỖ TRỢ";
      else if (activeMission.status === "ACTIVE") computedStatus = "ĐANG CỨU HỘ";
      else computedStatus = "ĐANG DI CHUYỂN";
    } else {
      computedStatus = isOnDuty ? "SẴN SÀNG" : "NGHỈ CA";
    }
  }

  // Vùng phân công an toàn
  const rawAssignedZone =
    computed?.assignedZoneName ||
    activeMission?.zone_name ||
    (teamData?.zone && teamData.zone !== "—" ? teamData.zone : null);
  const assignedZoneName = toSafeString(rawAssignedZone, "");

  const rawAssignedZoneId =
    computed?.assignedZoneId ||
    (typeof activeMission?.zone === "object" ? activeMission?.zone?.id : activeMission?.zone);
  const assignedZoneId =
    typeof rawAssignedZoneId === "object" ? rawAssignedZoneId?.id : rawAssignedZoneId;

  // Vùng hiện tại
  const rawCurrentZone = computed?.currentZone?.name || computed?.currentZone;
  const currentZoneName = toSafeString(rawCurrentZone, "");
  const minDistance = Number(computed?.minDistance);

  // Cảnh báo an toàn
  const anomalies: any[] = Array.isArray(computed?.anomalies) ? computed.anomalies : [];

  const handleCopyPhone = () => {
    if (!phone) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleCopyEmail = () => {
    if (!email) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const renderStatusBadge = (status: string) => {
    let bg = "bg-slate-100 text-slate-700 border-slate-200";
    let dot = "bg-slate-400";
    let pulse = false;

    if (status === "CẦN HỖ TRỢ") {
      bg = "bg-red-50 text-red-700 border-red-200";
      dot = "bg-red-600";
      pulse = true;
    } else if (status === "ĐANG CỨU HỘ") {
      bg = "bg-amber-50 text-amber-700 border-amber-200";
      dot = "bg-amber-500";
      pulse = true;
    } else if (status === "ĐANG DI CHUYỂN" || status === "MOVING") {
      bg = "bg-blue-50 text-blue-700 border-blue-200";
      dot = "bg-blue-600";
    } else if (status === "SẴN SÀNG" || status === "AVAILABLE") {
      bg = "bg-emerald-50 text-emerald-700 border-emerald-200";
      dot = "bg-emerald-500";
      pulse = true;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${bg}`}>
        <span className={`w-2 h-2 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`}></span>
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white relative shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
                {specialty === "MEDICAL" ? "🚑" : specialty === "LOGISTICS" ? "📦" : specialty === "COMMAND" ? "🛡️" : "🛟"}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black tracking-tight text-white">
                    {unitName}
                  </h3>
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {specialtyLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                  <span>Chỉ huy: <b className="text-white">{fullName}</b></span>
                  <span>•</span>
                  <span>Cấp bậc: <b className="text-white">{rank}</b></span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                {renderStatusBadge(computedStatus)}
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="sm:hidden mt-3">
            {renderStatusBadge(computedStatus)}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-5 border-t border-white/10 pt-3">
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "profile"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-slate-300"
              }`}
            >
              <Shield size={14} />
              <span>Hồ sơ & Năng lực Tác chiến</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "history"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-slate-300"
              }`}
            >
              <Clock size={14} />
              <span>Lịch sử Nhiệm vụ</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]">
          {loading && !teamData ? (
            <div className="py-16 text-center">
              <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-500">Đang tải hồ sơ dữ liệu đội...</p>
            </div>
          ) : activeTab === "profile" ? (
            <>
              {/* Cảnh báo tác chiến nếu có */}
              {anomalies.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl animate-in fade-in">
                  <div className="flex items-center gap-2 text-red-800 font-black text-sm">
                    <AlertTriangle size={18} className="text-red-600 shrink-0" />
                    <span>PHÁT HIỆN BẤT THƯỜNG TÁC CHIẾN</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {anomalies.map((anom: any, i: number) => {
                      const text =
                        typeof anom === "object"
                          ? anom.title || anom.desc || anom.label || anom.name || JSON.stringify(anom)
                          : String(anom);
                      return (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 font-bold text-xs border border-red-200"
                        >
                          ⚠️ {text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4 Khối thông tin */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Khối 1: Thông tin Chỉ huy & Tài khoản */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 text-slate-800 font-black text-xs uppercase tracking-wider">
                    <Users size={16} className="text-blue-600" />
                    <span>Chỉ huy & Tài khoản</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Chỉ huy trưởng:</span>
                      <span className="font-bold text-slate-800">{fullName}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Số điện thoại:</span>
                      {phone ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${phone}`}
                            className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Phone size={12} />
                            <span>{phone}</span>
                          </a>
                          <button
                            onClick={handleCopyPhone}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                            title="Sao chép SĐT"
                          >
                            {copiedPhone ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa cập nhật</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Email:</span>
                      {email ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`mailto:${email}`}
                            className="font-bold text-slate-700 hover:text-blue-600 truncate max-w-[180px]"
                            title={email}
                          >
                            {email}
                          </a>
                          <button
                            onClick={handleCopyEmail}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                            title="Sao chép Email"
                          >
                            {copiedEmail ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa có</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Số CCCD / CMND:</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {idNumber}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Trực ban tác chiến:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        isOnDuty ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {isOnDuty ? "🟢 Đang trong ca trực" : "⚪ Nghỉ ca"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Trạng thái tài khoản:</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        <span>{isActive ? "Hoạt động bình thường" : "Tạm khóa"}</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Ngày tham gia:</span>
                      <span className="text-slate-600">
                        {toSafeDateString(teamData?.created_at, false)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khối 2: Năng lực Nguồn lực & Phương tiện */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 text-slate-800 font-black text-xs uppercase tracking-wider">
                    <Truck size={16} className="text-emerald-600" />
                    <span>Năng lực & Nguồn lực Đội</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Quân số thành viên:</span>
                      <span className="font-bold text-slate-800">
                        {resource?.number_staff ? `${resource.number_staff} cán bộ / chiến sĩ` : <span className="text-slate-400 italic">Chưa khai báo</span>}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Phương tiện cơ động:</span>
                      <span className="font-bold text-slate-800">
                        {resource?.vehicle_type ? (
                          `${resource.vehicle_count || 1} x ${toSafeString(resource.vehicle_type)}`
                        ) : (
                          <span className="text-slate-400 italic">Chưa cập nhật phương tiện</span>
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Vật tư & Trang thiết bị cứu trợ:</span>
                      <div className="bg-slate-50 p-2.5 rounded-xl text-slate-700 font-medium leading-relaxed border border-slate-100">
                        {(() => {
                          const supplies = resource?.supplies;
                          if (!supplies) return "Chưa cập nhật danh mục vật tư chi tiết.";
                          if (typeof supplies === "string") return supplies;
                          if (Array.isArray(supplies)) {
                            return supplies
                              .map((s: any) =>
                                typeof s === "object"
                                  ? s.name || s.item || s.title || JSON.stringify(s)
                                  : String(s)
                              )
                              .join(", ");
                          }
                          if (typeof supplies === "object") {
                            return Object.entries(supplies)
                              .map(
                                ([k, v]) =>
                                  `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`
                              )
                              .join(", ");
                          }
                          return String(supplies);
                        })()}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-400 font-semibold">Thẩm định nguồn lực:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        resource?.verification_status === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-700"
                          : resource?.verification_status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {resource?.verification_status === "VERIFIED"
                          ? "✓ Đã thẩm định đạt chuẩn"
                          : resource?.verification_status === "REJECTED"
                          ? "✕ Chưa đạt thẩm định"
                          : "Chờ thẩm định"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Tình trạng sẵn sàng:</span>
                      <span className={`font-bold ${
                        resource?.is_available !== false ? "text-green-600" : "text-slate-500"
                      }`}>
                        {resource?.is_available !== false ? "Sẵn sàng xuất kích" : "Tạm ngưng / Bảo dưỡng"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khối 3: Trạng thái Thực địa & GPS */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 text-slate-800 font-black text-xs uppercase tracking-wider">
                    <MapPin size={16} className="text-red-500" />
                    <span>Giám sát Thực địa & GPS</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Tọa độ GPS trực tiếp:</span>
                      {hasGps ? (
                        <span className="font-bold text-slate-800 font-mono flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                          <span>{rawLat.toFixed(5)}, {rawLng.toFixed(5)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa phát tín hiệu GPS</span>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <span className="text-slate-400 font-semibold">Vị trí hiện tại:</span>
                      <div className="text-right">
                        {currentZoneName ? (
                          <>
                            <span className="font-bold text-slate-800 block">{currentZoneName}</span>
                            {!isNaN(minDistance) && isFinite(minDistance) && (
                              <span className="text-[11px] text-slate-500">
                                (Cách tâm vùng ~{minDistance.toFixed(1)} km)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-500 font-medium">Ngoài các vùng sự cố chính</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-start">
                      <span className="text-slate-400 font-semibold">Vùng được phân công:</span>
                      <div className="text-right">
                        {assignedZoneName ? (
                          assignedZoneId ? (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                navigate(`/details-rescue-zone/${assignedZoneId}`);
                              }}
                              className="font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                              title="Xem chi tiết khu vực này"
                            >
                              <span>Vùng {assignedZoneName}</span>
                              <ExternalLink size={12} />
                            </button>
                          ) : (
                            <span className="font-bold text-slate-800">Vùng {assignedZoneName}</span>
                          )
                        ) : (
                          <span className="text-slate-400 italic">Chưa giao khu vực</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Tình trạng thực địa:</span>
                      <span className={`font-bold ${
                        computedStatus === "CẦN HỖ TRỢ" ? "text-red-600" : "text-emerald-600"
                      }`}>
                        {computedStatus === "CẦN HỖ TRỢ" ? "CẦN HỖ TRỢ KHẨN CẤP" : "Đang hoạt động ổn định"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khối 4: Nhiệm vụ Hiện tại */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 text-slate-800 font-black text-xs uppercase tracking-wider">
                    <Activity size={16} className="text-amber-500" />
                    <span>Nhiệm vụ Tác chiến Hiện tại</span>
                  </div>

                  {activeMission ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Mục tiêu cứu trợ:</span>
                        <span className="font-bold text-slate-900">
                          {activeMission.zone_name ? `Vùng ${toSafeString(activeMission.zone_name)}` : "Vùng sự cố"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Trạng thái:</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          activeMission.status === "NEEDS_HELP"
                            ? "bg-red-100 text-red-700 animate-pulse font-black"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {activeMission.status === "NEEDS_HELP" ? "🚨 CẦN CHI VIỆN" : toSafeString(activeMission.status, "ĐANG TIẾN HÀNH")}
                        </span>
                      </div>

                      {activeMission.status === "NEEDS_HELP" && (
                        <div className="bg-red-50 border border-red-300 p-3 rounded-xl text-red-900 shadow-sm">
                          <p className="font-black text-xs flex items-center gap-1.5 text-red-700 uppercase tracking-wide">
                            🚨 TÍN HIỆU CẦN CHI VIỆN KHẨN CẤP
                          </p>
                          <p className="mt-1 font-semibold text-xs text-red-800 leading-relaxed">
                            {toSafeString(activeMission.outcome_note, "Đội đang gặp khó khăn và cần chi viện tại thực địa.")}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Vai trò phụ trách:</span>
                        <span className="font-bold text-slate-700">
                          {toSafeString(activeMission.role, "Cứu nạn cứu hộ")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Thời điểm nhận lệnh:</span>
                        <span className="text-slate-600">
                          {toSafeDateString(activeMission.joined_at || activeMission.created_at, true)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">Mệnh lệnh & Ghi chú chỉ huy:</span>
                        <div className="bg-slate-50 p-2.5 rounded-xl text-slate-700 font-medium leading-relaxed border border-slate-100 italic">
                          "{toSafeString(activeMission.notes, "Không có ghi chú thêm từ chỉ huy.")}"
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center bg-slate-50 rounded-2xl">
                      <CheckCircle2 size={28} className="text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">Đang sẵn sàng nhận lệnh mới</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                        Đội hiện không phụ trách nhiệm vụ nào và có thể nhận phân công tác chiến ngay lập tức.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Tab 2: Lịch sử nhiệm vụ */
            <div className="space-y-4">
              {historyLoading ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
                  <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-500">Đang tải lịch sử nhiệm vụ tác chiến...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
                  <Shield size={36} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Chưa có lịch sử nhiệm vụ nào</p>
                  <p className="text-xs text-slate-400 mt-1">Đội chưa được phân công hoặc hoàn thành nhiệm vụ nào.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3.5">Khu vực</th>
                        <th className="p-3.5">Vai trò</th>
                        <th className="p-3.5">Trạng thái</th>
                        <th className="p-3.5">Thời gian thực hiện</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {history.map((item: any, idx: number) => {
                        const isComplete = item.status === "COMPLETED";
                        const isCancelled = item.status === "CANCELLED";
                        const zoneId = typeof item.zone === "object" ? item.zone?.id || null : item.zone;
                        const zoneNameText = toSafeString(
                          item.zone_name || (typeof item.zone === "object" ? item.zone?.name : item.zone),
                          "N/A"
                        );

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="p-3.5 font-bold">
                              {zoneId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    navigate(`/details-rescue-zone/${zoneId}`);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline font-bold text-left transition cursor-pointer group"
                                  title="Xem chi tiết khu vực này"
                                >
                                  <span>Vùng {zoneNameText}</span>
                                  <ExternalLink size={12} className="opacity-70 group-hover:opacity-100 transition shrink-0" />
                                </button>
                              ) : (
                                <span className="text-slate-900">Vùng {zoneNameText}</span>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-600">{toSafeString(item.role, "Cứu hộ")}</td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isComplete
                                    ? "bg-green-100 text-green-700"
                                    : isCancelled
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {toSafeString(item.status, "ĐANG XỬ LÝ")}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-500">
                              {item.completed_at
                                ? `Hoàn thành: ${toSafeDateString(item.completed_at, true)}`
                                : item.joined_at
                                ? `Bắt đầu: ${toSafeDateString(item.joined_at, true)}`
                                : "N/A"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Phone size={13} />
                <span>Gọi điện ({phone})</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hasGps && onLocate && (
              <button
                onClick={() => onLocate(teamData)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Navigation size={14} />
                <span>Định vị bản đồ</span>
              </button>
            )}

            {(computedStatus === "SẴN SÀNG" || computedStatus === "AVAILABLE") && onAssign && (
              <button
                onClick={() => onAssign(teamData)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <UserPlus size={14} />
                <span>Giao việc ngay</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Đóng lại
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export bọc Error Boundary bảo vệ toàn diện ──────────────────────────────
export default function TeamDetailModal(props: TeamDetailModalProps) {
  if (!props.isOpen) return null;
  return (
    <TeamDetailErrorBoundary onClose={props.onClose}>
      <TeamDetailModalContent {...props} />
    </TeamDetailErrorBoundary>
  );
}
