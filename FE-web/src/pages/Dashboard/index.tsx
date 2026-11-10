import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../services/api";
import { useNavigate } from "react-router-dom";
import SOSDetailModal from "../../components/SOSDetailModal";
import TeamDetailModal from "../../components/TeamDetailModal";
import { ShieldAlert, Phone, AlertTriangle, ArrowRight, Radio } from "lucide-react";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";

const SEVERITY_CONFIG = {
  CRITICAL: {
    label: "Khẩn cấp",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
  WARNING: {
    label: "Cảnh báo",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  NORMAL: {
    label: "Bình thường",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  INFO: {
    label: "Thông báo",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
  },
};

const TEAM_STATUS_CONFIG = {
  ON_SITE: {
    label: "Đang cứu nạn",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
  MOVING: {
    label: "Đang di chuyển",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  COMPLETED: {
    label: "Hoàn thành",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  AVAILABLE: {
    label: "Sẵn sàng",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  ASSIGNED: {
    label: "Đã phân công",
    dot: "bg-purple-500",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({
    sos_pending: 0,
    sos_unverified: 0,
    sos_critical: 0,
    active_zones: 0,
    critical_zones: 0,
    teams_on_mission: 0,
    teams_available: 0,
    completed_today: 0,
    completed_yesterday: 0,
  });
  const [zones, setZones] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [sosList, setSosList] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedSosId, setSelectedSosId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const lastData = useRef<Record<string, any[]>>({});
  const lastSummary = useRef<any>(null);
  const pending = useRef(false);
  const refreshQueued = useRef(false);
  const mounted = useRef(false);

  const fetchData = async () => {
    if (pending.current) {
      refreshQueued.current = true;
      return;
    }
    pending.current = true;
    if (!Object.keys(lastData.current).length) setLoading(true);
    try {
      const requests = [
        api.zones.getAll(),
        api.rescuers.getAll(),
        api.sos.getAll(),
        api.missions.getAll(),
        api.alerts.getAll(),
        api.dashboard.getStats(),
      ];
      const names = ["zones", "teams", "sos", "missions", "alerts", "summary"];
      const labels = ["vùng", "đội cứu hộ", "SOS", "nhiệm vụ", "cảnh báo", "thống kê"];
      const failures = new Map<number, string>();

      const applyData = (updated: boolean) => {
        if (!mounted.current) return;
        setErrorMsg(failures.size ? `Không cập nhật được ${[...failures.values()].join("; ")}.` : "");
        const zonesData = lastData.current.zones || [];
        const teamsData = (lastData.current.teams || []).filter((team: any) => team.is_active);
        const sosData = lastData.current.sos || [];
        const missionsData = lastData.current.missions || [];
        const alertsData = lastData.current.alerts || [];
        const activeStatuses = new Set(["PENDING_ACCEPTANCE", "ACCEPTED", "ACTIVE", "ON_MY_WAY", "NEEDS_HELP"]);
        const missionsByZone = new Map<string, number>();
        const missionsByRescuer = new Map<string, any>();
        const zoneNames = new Map<string, string>(zonesData.map((zone: any) => [zone.id, zone.name]));

        for (const mission of missionsData) {
          if (!activeStatuses.has(mission.status)) continue;
          if (mission.zone) missionsByZone.set(mission.zone, (missionsByZone.get(mission.zone) || 0) + 1);
          if (mission.rescuer && !missionsByRescuer.has(mission.rescuer)) missionsByRescuer.set(mission.rescuer, mission);
        }

        const mapSeverity = (sev: string) => {
          if (!sev) return "NORMAL";
          const s = sev.toUpperCase();
          if (s === "CRITICAL" || s === "HIGH") return "CRITICAL";
          if (s === "MEDIUM" || s === "WARNING") return "WARNING";
          if (s === "LOW" || s === "NORMAL") return "NORMAL";
          return "INFO";
        };

        const mappedZones = zonesData.map((z: any) => ({
          id: z.id,
          name: z.name,
          severity: mapSeverity(z.severity),
          teams_assigned: missionsByZone.get(z.id) || 0,
          teams_required: z.rescuers_needed || 0,
          type: "Khu vực sự cố",
        }));

        const mappedTeams = teamsData.map((t: any) => {
          const activeM = missionsByRescuer.get(t.id);
          const zoneName = activeM ? zoneNames.get(activeM.zone) || "Khu vực" : "—";
          return {
            id: t.id,
            name: t.rescuer_profile?.unit_name || t.full_name || "Đội cứu hộ",
            zone: zoneName,
            status: activeM
              ? ["PENDING_ACCEPTANCE", "ACCEPTED"].includes(activeM.status)
                ? "ASSIGNED"
                : activeM.status === "ON_MY_WAY"
                ? "MOVING"
                : "ON_SITE"
              : "AVAILABLE",
            type: t.rescuer_profile?.specialty || "Cứu hộ",
            rawTeam: t,
          };
        });

        const mappedAlerts = alertsData.map((a: any) => ({
          id: a.id,
          title: a.title,
          severity: mapSeverity(a.severity),
          time: new Date(a.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          votes_danger: a.vote_count?.downvotes || 0,
          votes_safe: typeof a.vote_count === "number" ? a.vote_count : a.vote_count?.upvotes || 0,
          votes_total:
            typeof a.vote_count === "number"
              ? a.vote_count
              : (a.vote_count?.upvotes || 0) + (a.vote_count?.downvotes || 0),
        }));

        const calculatedStats = {
          sos_pending:
            lastSummary.current?.sos_by_status?.PENDING ??
            sosData.filter((s: any) => s.status === "PENDING").length,
          sos_unverified: sosData.filter(
            (s: any) =>
              s.status !== "RESOLVED" &&
              s.status !== "CANCELLED" &&
              (s.verification_status === "UNVERIFIED" || !s.verification_status || s.verification_status === "CHECKING")
          ).length,
          sos_critical: sosData.filter((s: any) => s.severity === "CRITICAL" || s.emergency_type === "CRITICAL").length,
          active_zones:
            lastSummary.current?.zones_by_status?.ACTIVE ??
            zonesData.filter((z: any) => z.status === "ACTIVE").length,
          critical_zones:
            lastSummary.current?.zones_by_severity?.CRITICAL ??
            zonesData.filter((z: any) => z.severity === "CRITICAL").length,
          teams_on_mission: mappedTeams.filter((t: any) => t.status !== "AVAILABLE").length,
          teams_available: mappedTeams.filter((t: any) => t.status === "AVAILABLE").length,
          completed_today: missionsData.filter(
            (m: any) =>
              m.status === "COMPLETED" &&
              m.completed_at &&
              new Date(m.completed_at).toDateString() === new Date().toDateString()
          ).length,
          completed_yesterday: missionsData.filter((m: any) => {
            if (m.status !== "COMPLETED" || !m.completed_at) return false;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return new Date(m.completed_at).toDateString() === yesterday.toDateString();
          }).length,
        };

        setStats(calculatedStats);
        setZones(mappedZones);
        setTeams(mappedTeams);
        setSosList(sosData);
        setAlerts(mappedAlerts);
        if (updated) setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
      };

      await Promise.all(
        requests.map(async (request, index) => {
          let updated = false;
          try {
            const response = await request;
            if (names[index] === "summary") {
              if (!response?.data?.summary) throw new Error("Dữ liệu thống kê không đúng định dạng");
              lastSummary.current = response.data;
              updated = true;
              applyData(updated);
              return;
            }
            const rows = response?.data?.results || response?.data || [];
            if (!Array.isArray(rows)) throw new Error("Dữ liệu không đúng định dạng");
            lastData.current[names[index]] = rows;
            updated = true;
          } catch (error) {
            failures.set(index, `${labels[index]}: ${apiErrorMessage(error)}`);
          }
          applyData(updated);
        })
      );
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      if (mounted.current) setErrorMsg(apiErrorMessage(err));
    } finally {
      pending.current = false;
      if (mounted.current) setLoading(false);
      if (mounted.current && refreshQueued.current) {
        refreshQueued.current = false;
        void fetchData();
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <DataNotice loading={loading} error={errorMsg} onRetry={fetchData} hasData={Object.keys(lastData.current).length > 0} />

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => navigate("/sos")}
            className="stat-card cursor-pointer hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              SOS chờ xử lý
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.sos_pending}</p>
            <p className="text-xs mt-1 text-red-600 font-medium">
              {stats.sos_critical} khẩn cấp chưa có đội
            </p>
          </div>

          <div
            onClick={() => navigate("/rescue-zone-management")}
            className="stat-card cursor-pointer hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Vùng đang hoạt động
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.active_zones}</p>
            <p className="text-xs mt-1 text-red-600 font-medium">
              {stats.critical_zones} vùng nguy cấp
            </p>
          </div>

          <div
            onClick={() => navigate("/follow-the-rescue-team")}
            className="stat-card cursor-pointer hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đội đang làm nhiệm vụ
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.teams_on_mission}</p>
            <p className="text-xs mt-1 text-emerald-600 font-medium">
              {stats.teams_available} đội đang sẵn sàng
            </p>
          </div>

          <div
            onClick={() => navigate("/report")}
            className="stat-card cursor-pointer hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ca hoàn thành hôm nay
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.completed_today}</p>
            <p className="text-xs mt-1 text-emerald-600 font-medium">
              +{stats.completed_today - stats.completed_yesterday} so với hôm qua
            </p>
          </div>
        </div>

        {/* Triage: SOS cần gọi xác minh */}
        {stats.sos_unverified > 0 && (
          <div className="card border-amber-200 bg-amber-50/40 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Cần gọi xác minh SOS khẩn cấp ({stats.sos_unverified})
                  </h2>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Tin cứu nạn mới gửi từ người dân cần Admin gọi điện thoại kiểm chứng trước hoặc song song điều phối
                  </p>
                </div>
              </div>

              {/* Direct link to all SOS page */}
              <button
                onClick={() => navigate("/sos")}
                className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 font-semibold text-amber-900 border-amber-300 hover:bg-amber-100"
              >
                <span>Xem tất cả SOS ({sosList.length})</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sosList
                .filter(
                  (s: any) =>
                    s.status !== "RESOLVED" &&
                    s.status !== "CANCELLED" &&
                    (s.verification_status === "UNVERIFIED" ||
                      !s.verification_status ||
                      s.verification_status === "CHECKING")
                )
                .slice(0, 6)
                .map((s: any) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSosId(s.id)}
                    className="bg-white p-4 rounded-xl border border-amber-200/90 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`badge border text-[11px] ${
                            s.verification_status === "CHECKING"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {s.verification_status === "CHECKING" ? "📞 Đang kiểm tra" : "⚠️ Chưa xác minh"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(s.sent_at).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 text-sm truncate">
                        {s.contact_name || s.user_full_name || "Người dân ẩn danh"}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-accent mt-0.5">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{s.contact_phone || s.phone || "Chưa có số"}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                        {s.description || s.note || "Không có mô tả chi tiết"}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 truncate max-w-[140px]">
                        {s.address || "Chưa rõ vị trí"}
                      </span>
                      <span className="text-brand font-semibold hover:underline">
                        Gọi & Xác minh →
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Zones + Teams */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Zones */}
          <div className="lg:col-span-2 card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h2 className="text-base font-bold text-slate-900">Khu vực đang theo dõi</h2>
              </div>
              <span className="badge border bg-red-50 text-red-700 border-red-200 text-xs">
                {stats.critical_zones} nguy cấp
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {zones.slice(0, 6).map((z: any) => (
                <ZoneCard
                  key={z.id}
                  zone={z}
                  onSelect={() => navigate(`/details-rescue-zone/${z.id}`)}
                />
              ))}
            </div>
            {zones.length > 6 && (
              <button
                type="button"
                onClick={() => navigate("/rescue-zone-management")}
                className="text-xs font-semibold text-accent hover:underline pt-2 block"
              >
                Xem tất cả {zones.length} khu vực →
              </button>
            )}
          </div>

          {/* Teams */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Đội cứu hộ trực chiến</h2>
              <span className="text-xs text-slate-400">
                {teams.filter((t) => t.status === "AVAILABLE").length} sẵn sàng
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {teams.slice(0, 6).map((t: any) => (
                <TeamRow
                  key={t.id}
                  team={t}
                  onSelect={() => setSelectedTeam(t.rawTeam || t)}
                />
              ))}
            </div>
            {teams.length > 6 && (
              <button
                type="button"
                onClick={() => navigate("/follow-the-rescue-team")}
                className="text-xs font-semibold text-accent hover:underline pt-2 block"
              >
                Xem tất cả {teams.length} đội cứu hộ →
              </button>
            )}
          </div>
        </div>

        {/* Alerts Section */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cảnh báo và bản tin phát thanh</h2>
              <p className="text-xs text-slate-500 mt-0.5">Thông điệp khẩn cấp gửi tới người dân và lực lượng cứu nạn</p>
            </div>
            <button
              className="btn-primary text-xs flex items-center gap-1.5"
              onClick={() => navigate("/notification-broadcast")}
            >
              + Tạo cảnh báo mới
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.slice(0, 6).map((a: any) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
          {alerts.length > 6 && (
            <button
              type="button"
              onClick={() => navigate("/notification-broadcast")}
              className="text-xs font-semibold text-accent hover:underline pt-2 block"
            >
              Xem tất cả {alerts.length} bản tin cảnh báo →
            </button>
          )}
        </div>

        {/* Modal chi tiết & xác minh SOS */}
        <SOSDetailModal
          sosId={selectedSosId}
          isOpen={Boolean(selectedSosId)}
          onClose={() => setSelectedSosId(null)}
          onUpdated={fetchData}
        />

        {/* Modal chi tiết đội cứu hộ */}
        <TeamDetailModal
          isOpen={Boolean(selectedTeam)}
          teamId={selectedTeam?.id}
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      </div>
    </AdminLayout>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const cfg = (SEVERITY_CONFIG as any)[severity || "INFO"] || SEVERITY_CONFIG.INFO;
  return (
    <span className={`badge border text-[11px] ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function ZoneCard({ zone, onSelect }: { zone: any; onSelect?: () => void }) {
  const pct = zone.teams_required > 0 ? Math.round((zone.teams_assigned / zone.teams_required) * 100) : 100;
  const cfg = (SEVERITY_CONFIG as any)[zone.severity] || SEVERITY_CONFIG.NORMAL;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <SeverityBadge severity={zone.severity} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{zone.name}</p>
        <p className="text-xs text-slate-400">{zone.type}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-1.5 rounded-full ${cfg.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-xs text-slate-500 w-10 text-right">
          {zone.teams_assigned}/{zone.teams_required}
        </span>
      </div>
      <button
        onClick={onSelect}
        className="text-xs font-semibold text-accent hover:underline shrink-0 cursor-pointer ml-1"
      >
        Xem →
      </button>
    </div>
  );
}

function TeamRow({ team, onSelect }: { team: any; onSelect?: () => void }) {
  const cfg = (TEAM_STATUS_CONFIG as any)[team.status] || TEAM_STATUS_CONFIG.AVAILABLE;
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group border-b border-slate-100 last:border-0"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 group-hover:text-accent transition-colors truncate">
          {team.name}
        </p>
        <p className="text-xs text-slate-400 truncate">{team.zone}</p>
      </div>
      <span className={`badge border text-[11px] ${cfg.badge} shrink-0`}>
        {cfg.label}
      </span>
      <span className="text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        Chi tiết →
      </span>
    </div>
  );
}

function AlertRow({ alert }: { alert: any }) {
  const dangerPct =
    alert.votes_total > 0 ? Math.round((alert.votes_danger / alert.votes_total) * 100) : 0;
  const safePct =
    alert.votes_total > 0 ? Math.round((alert.votes_safe / alert.votes_total) * 100) : 0;
  return (
    <div className="py-3 border-b border-slate-100 last:border-0 space-y-1.5">
      <div className="flex items-center gap-3">
        <SeverityBadge severity={alert.severity} />
        <p className="text-sm font-semibold text-slate-900 flex-1 truncate">{alert.title}</p>
        <span className="text-xs text-slate-400 shrink-0">{alert.time}</span>
      </div>
      {alert.votes_total > 0 && (
        <div className="pl-1">
          <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-red-400 h-full" style={{ width: `${dangerPct}%` }} />
            <div className="bg-emerald-400 h-full" style={{ width: `${safePct}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {alert.votes_danger} vẫn nguy hiểm · {alert.votes_safe} đã an toàn
          </p>
        </div>
      )}
    </div>
  );
}
