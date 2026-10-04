import { useState, useEffect, useRef } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import { useNavigate } from "react-router-dom";
import SOSDetailModal from "../../components/SOSDetailModal";
import TeamDetailModal from "../../components/TeamDetailModal";
import { ShieldAlert, Phone, Clock, AlertTriangle, Eye } from "lucide-react";
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
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    bar: "bg-green-500",
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
    label: "Đang xử lý",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700",
  },
  MOVING: {
    label: "Di chuyển",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700",
  },
  COMPLETED: {
    label: "Hoàn thành",
    dot: "bg-green-500",
    badge: "bg-green-50 text-green-700",
  },
  AVAILABLE: {
    label: "Sẵn sàng",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700",
  },
  ASSIGNED: {
    label: "Đã phân công",
    dot: "bg-purple-500",
    badge: "bg-purple-50 text-purple-700",
  },
};


export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({
    sos_pending: 0,
    sos_unverified: 0,
    sos_critical: 0,
    active_zones: 0,
    critical_zones: 0,
    teams_on_mission: 0,
    teams_available: 0,
    completed_today: 0,
    completed_yesterday: 0
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
    if (pending.current) { refreshQueued.current = true; return; }
    pending.current = true;
    if (!Object.keys(lastData.current).length) setLoading(true);
    try {
      const requests = [
        api.zones.getAll(),
        api.rescuers.getAll(),
        api.sos.getAll(),
        api.missions.getAll(),
        api.alerts.getAll(),
        api.dashboard.getStats()
      ];
      const names = ['zones', 'teams', 'sos', 'missions', 'alerts', 'summary'];
      const labels = ['vùng', 'đội cứu hộ', 'SOS', 'nhiệm vụ', 'cảnh báo', 'thống kê'];
      const failures = new Map<number, string>();
      const applyData = (updated: boolean) => {
      if (!mounted.current) return;
      setErrorMsg(failures.size ? `Không cập nhật được ${[...failures.values()].join('; ')}.` : '');
      const zonesData = lastData.current.zones || [];
      const teamsData = (lastData.current.teams || []).filter((team: any) => team.is_active);
      const sosData = lastData.current.sos || [];
      const missionsData = lastData.current.missions || [];
      const alertsData = lastData.current.alerts || [];
      const activeStatuses = new Set(['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP']);
      const missionsByZone = new Map<string, number>();
      const missionsByRescuer = new Map<string, any>();
      const zoneNames = new Map<string, string>(zonesData.map((zone: any) => [zone.id, zone.name]));
      for (const mission of missionsData) {
        if (!activeStatuses.has(mission.status)) continue;
        if (mission.zone) missionsByZone.set(mission.zone, (missionsByZone.get(mission.zone) || 0) + 1);
        if (mission.rescuer && !missionsByRescuer.has(mission.rescuer)) missionsByRescuer.set(mission.rescuer, mission);
      }

      const mapSeverity = (sev: string) => {
        if (!sev) return 'NORMAL';
        const s = sev.toUpperCase();
        if (s === 'CRITICAL' || s === 'HIGH') return 'CRITICAL';
        if (s === 'MEDIUM' || s === 'WARNING') return 'WARNING';
        if (s === 'LOW' || s === 'NORMAL') return 'NORMAL';
        return 'INFO';
      };

      // Map Zones
      const mappedZones = zonesData.map((z: any) => {
        return {
          id: z.id,
          name: z.name,
          severity: mapSeverity(z.severity),
          teams_assigned: missionsByZone.get(z.id) || 0,
          teams_required: z.rescuers_needed || 0,
          type: "Khu vực sự cố",
        };
      });

      // Map Teams
      const mappedTeams = teamsData.map((t: any) => {
        const activeM = missionsByRescuer.get(t.id);
        const zoneName = activeM ? (zoneNames.get(activeM.zone) || "Khu vực") : "—";
        return {
          id: t.id,
          name: t.rescuer_profile?.unit_name || t.full_name || "Đội cứu hộ",
          zone: zoneName,
          status: activeM ? (['PENDING_ACCEPTANCE','ACCEPTED'].includes(activeM.status) ? 'ASSIGNED' : activeM.status === 'ON_MY_WAY' ? 'MOVING' : 'ON_SITE') : 'AVAILABLE',
          type: t.rescuer_profile?.specialty || "Cứu hộ",
          rawTeam: t,
        };
      });

      // Map Alerts
      const mappedAlerts = alertsData.map((a: any) => ({
        id: a.id,
        title: a.title,
        severity: mapSeverity(a.severity),
        time: new Date(a.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}),
        votes_danger: a.vote_count?.downvotes || 0,
        votes_safe: typeof a.vote_count === 'number' ? a.vote_count : (a.vote_count?.upvotes || 0),
        votes_total: typeof a.vote_count === 'number' ? a.vote_count : (a.vote_count?.upvotes || 0) + (a.vote_count?.downvotes || 0)
      }));

      // Calculate Stats
      const calculatedStats = {
        sos_pending: lastSummary.current?.sos_by_status?.PENDING ?? sosData.filter((s: any) => s.status === 'PENDING').length,
        sos_unverified: sosData.filter((s: any) => s.status !== 'RESOLVED' && s.status !== 'CANCELLED' && (s.verification_status === 'UNVERIFIED' || !s.verification_status || s.verification_status === 'CHECKING')).length,
        sos_critical: sosData.filter((s: any) => s.severity === 'CRITICAL' || s.emergency_type === 'CRITICAL').length,
        active_zones: lastSummary.current?.zones_by_status?.ACTIVE ?? zonesData.filter((z: any) => z.status === 'ACTIVE').length,
        critical_zones: lastSummary.current?.zones_by_severity?.CRITICAL ?? zonesData.filter((z: any) => z.severity === 'CRITICAL').length,
        teams_on_mission: mappedTeams.filter((t: any) => t.status !== 'AVAILABLE').length,
        teams_available: mappedTeams.filter((t: any) => t.status === 'AVAILABLE').length,
        completed_today: missionsData.filter((m: any) => m.status === 'COMPLETED' && m.completed_at && new Date(m.completed_at).toDateString() === new Date().toDateString()).length,
        completed_yesterday: missionsData.filter((m: any) => {
          if (m.status !== 'COMPLETED' || !m.completed_at) return false;
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          return new Date(m.completed_at).toDateString() === yesterday.toDateString();
        }).length
      };

      setStats(calculatedStats);
      setZones(mappedZones);
      setTeams(mappedTeams);
      setSosList(sosData);
      setAlerts(mappedAlerts);
      if (updated) setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
      };
      await Promise.all(requests.map(async (request, index) => {
        let updated = false;
        try {
          const response = await request;
          if (names[index] === 'summary') {
            if (!response?.data?.summary) throw new Error('Dữ liệu thống kê không đúng định dạng');
            lastSummary.current = response.data;
            updated = true;
            applyData(updated);
            return;
          }
          const rows = response?.data?.results || response?.data || [];
          if (!Array.isArray(rows)) throw new Error('Dữ liệu không đúng định dạng');
          lastData.current[names[index]] = rows;
          updated = true;
        } catch (error) {
          failures.set(index, `${labels[index]}: ${apiErrorMessage(error)}`);
        }
        applyData(updated);
      }));
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
    return () => { mounted.current = false; };
  }, []);
  const navigate = useNavigate();
  const handleViewNotification = async () => {
    navigate(`/notification-broadcast`);
  }   // ← đóng function
  // ← dư cái này — đóng cái gì?

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // if (loading) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3"></div>
  //         <p className="text-sm text-gray-400">Đang tải dữ liệu...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      <div
        className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <SliderBar />
      </div>

      <div className="flex-1 bg-[#F8F9FA] flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
          <DataNotice loading={loading} error={errorMsg} onRetry={fetchData} hasData={Object.keys(lastData.current).length > 0} />
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard
              label="SOS chờ xử lý"
              value={stats.sos_pending}
              sub={`${stats.sos_critical} khẩn cấp chưa có đội`}
              subColor="text-red-500"
            />
            <StatCard
              label="Vùng đang hoạt động"
              value={stats.active_zones}
              sub={`${stats.critical_zones} vùng nguy cấp`}
              subColor="text-red-500"
            />
            <StatCard
              label="Đội đang làm nhiệm vụ"
              value={stats.teams_on_mission}
              sub={`${stats.teams_available} đội đang rảnh`}
              subColor="text-green-500"
            />
            <StatCard
              label="Ca hoàn thành hôm nay"
              value={stats.completed_today}
              sub={`+${stats.completed_today - stats.completed_yesterday} so với hôm qua`}
              subColor="text-green-500"
            />
          </div>

          {/* Triage: SOS chờ xác minh */}
          {stats.sos_unverified > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                    <ShieldAlert className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Cần gọi xác minh SOS khẩn cấp ({stats.sos_unverified})
                    </h2>
                    <p className="text-xs text-amber-800">
                      Có tin cứu nạn mới gửi từ người dân cần Admin gọi điện thoại kiểm chứng trước hoặc song song điều phối
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sosList
                  .filter((s: any) => s.status !== 'RESOLVED' && s.status !== 'CANCELLED' && (s.verification_status === 'UNVERIFIED' || !s.verification_status || s.verification_status === 'CHECKING'))
                  .slice(0, 6)
                  .map((s: any) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSosId(s.id)}
                      className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            s.verification_status === 'CHECKING' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700 animate-pulse'
                          }`}>
                            {s.verification_status === 'CHECKING' ? '📞 Đang kiểm tra' : '⚠️ Chưa xác minh'}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {new Date(s.sent_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 text-sm truncate">
                          {s.contact_name || s.user_full_name || "Người dân ẩn danh"}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{s.contact_phone || s.phone || "Chưa có số"}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                          {s.description || s.note || "Không có mô tả chi tiết"}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="text-gray-400 truncate max-w-[120px]">{s.address || "Chưa rõ vị trí"}</span>
                        <span className="text-amber-700 font-semibold hover:underline">
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
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-md">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <LiveDot />
                  <h2 className="text-base font-bold text-gray-900">
                    Vùng đang theo dõi
                  </h2>
                </div>
                <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded font-semibold shadow-sm">
                  {stats.critical_zones} nguy cấp
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {zones.slice(0, 8).map((z: any) => (
                  <ZoneCard key={z.id} zone={z} onSelect={() => navigate(`/details-rescue-zone/${z.id}`)} />
                ))}
              </div>
              {zones.length > 8 && <button type="button" onClick={() => navigate('/rescue-zone-management')} className="mt-4 text-sm font-semibold text-blue-700 underline">Xem tất cả {zones.length} vùng</button>}
            </div>

            {/* Teams */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-md">
              <h2 className="text-base font-bold text-gray-900 mb-5">
                Các đội cứu hộ
              </h2>
              <div className="divide-y divide-gray-100">
                {teams.slice(0, 8).map((t: any) => (
                  <TeamRow
                    key={t.id}
                    team={t}
                    onSelect={() => setSelectedTeam(t.rawTeam || t)}
                  />
                ))}
              </div>
              {teams.length > 8 && <button type="button" onClick={() => navigate('/follow-the-rescue-team')} className="mt-4 text-sm font-semibold text-blue-700 underline">Xem tất cả {teams.length} đội</button>}
            </div>
          </div>

          {/* SOS + Alerts */}
          <div className="w-full gap-6">
            {/* Alerts */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-md">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">
                  Cảnh báo
                </h2>
                <button className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                onClick={() => handleViewNotification()}
                >
                  + Tạo mới
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {alerts.slice(0, 8).map((a: any) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </div>
              {alerts.length > 8 && <button type="button" onClick={() => navigate('/notification-broadcast')} className="mt-4 text-sm font-semibold text-blue-700 underline">Xem tất cả {alerts.length} cảnh báo</button>}
            </div>
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
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const cfg = (SEVERITY_CONFIG as any)[severity || 'INFO'] || SEVERITY_CONFIG.INFO;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
    </span>
  );
}

function StatCard({ label, value, sub, subColor = "text-gray-400" }: { label: string; value: any; sub: string; subColor?: string }) {
  return (
    <div className="border border-blue-200 border-4 rounded-xl p-4 bg-gray-50">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>
    </div>
  );
}

function ZoneCard({ zone, onSelect }: { zone: any; onSelect?: () => void }) {
  const pct = zone.teams_required > 0 ? Math.round((zone.teams_assigned / zone.teams_required) * 100) : 100;
  const cfg = (SEVERITY_CONFIG as any)[zone.severity] || SEVERITY_CONFIG.NORMAL;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <SeverityBadge severity={zone.severity} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {zone.name}
        </p>
        <p className="text-xs text-gray-400">{zone.type}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-24 h-1.5 bg-gray-100 rounded-full">
          <div
            className={`h-1.5 rounded-full ${cfg.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-10 text-right">
          {zone.teams_assigned}/{zone.teams_required}
        </span>
      </div>
      <button
        onClick={onSelect}
        className="text-xs text-blue-600 hover:text-blue-800 shrink-0 cursor-pointer"
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
      className="flex items-center gap-3 py-2.5 px-2.5 -mx-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group border-b border-gray-100 last:border-0"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
          {team.name}
        </p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${cfg.badge} shrink-0`}>
        {team.type}
      </span>
      <span className="text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        Chi tiết →
      </span>
    </div>
  );
}

function AlertRow({ alert }: { alert: any }) {
  const dangerPct =
    alert.votes_total > 0
      ? Math.round((alert.votes_danger / alert.votes_total) * 100)
      : 0;
  const safePct =
    alert.votes_total > 0
      ? Math.round((alert.votes_safe / alert.votes_total) * 100)
      : 0;
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <SeverityBadge severity={alert.severity} />
        <p className="text-sm font-medium text-gray-900 flex-1">
          {alert.title}
        </p>
        <span className="text-xs text-gray-400">{alert.time}</span>
      </div>
      {alert.votes_total > 0 && (
        <div className="mt-2 pl-1">
          <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
            <div
              className="bg-red-400 h-full"
              style={{ width: `${dangerPct}%` }}
            />
            <div
              className="bg-green-400 h-full"
              style={{ width: `${safePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {alert.votes_danger} vẫn nguy hiểm · {alert.votes_safe} đã ổn
          </p>
        </div>
      )}
    </div>
  );
}

function DistributionBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex-1 w-full ">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="h-1.5 bg-gray-100 rounded-full">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{count} đội</p>
    </div>
  );
}

