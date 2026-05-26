import { useState, useEffect } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import { useNavigate } from "react-router-dom";


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
    sos_critical: 0,
    active_zones: 0,
    critical_zones: 0,
    teams_on_mission: 0,
    teams_available: 0,
    completed_today: 0,
    completed_yesterday: 0
  });
  const [zones, setZones] = useState([]);
  const [teams, setTeams] = useState([]);
  const [sosList, setSosList] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [zonesRes, teamsRes, sosRes, missionsRes, alertsRes] = await Promise.all([
        api.zones.getAll(),
        api.rescuers.getAll(),
        api.sos.getAll(),
        api.missions.getAll(),
        api.alerts.getAll()
      ]);

      const zonesData = zonesRes?.data?.results || zonesRes?.data || [];
      const teamsData = teamsRes?.data?.results || teamsRes?.data || [];
      const sosData = sosRes?.data?.results || sosRes?.data || [];
      const missionsData = missionsRes?.data?.results || missionsRes?.data || [];
      const alertsData = alertsRes?.data?.results || alertsRes?.data || [];

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
        const assigned = missionsData.filter((m: any) => m.zone === z.id && ['ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP'].includes(m.status)).length;
        return {
          id: z.id,
          name: z.name,
          severity: mapSeverity(z.severity),
          teams_assigned: assigned,
          teams_required: z.rescuers_needed || 0,
          type: "Khu vực sự cố",
        };
      });

      // Map Teams
      const mappedTeams = teamsData.map((t: any) => {
        const activeM = missionsData.find((m: any) => m.rescuer === t.id && ['ACTIVE', 'ON_MY_WAY'].includes(m.status));
        const zoneName = activeM ? (zonesData.find((z: any) => z.id === activeM.zone)?.name || "Khu vực") : "—";
        return {
          id: t.id,
          name: t.rescuer_profile?.unit_name || t.full_name || "Đội cứu hộ",
          zone: zoneName,
          status: activeM ? (activeM.status === 'ON_MY_WAY' ? 'MOVING' : 'ON_SITE') : 'AVAILABLE',
          type: t.rescuer_profile?.specialty || "Cứu hộ",
        };
      });

      // Map Alerts
      const mappedAlerts = alertsData.map((a: any) => ({
        id: a.id,
        title: a.title,
        severity: mapSeverity(a.severity),
        time: new Date(a.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}),
        votes_danger: a.vote_count?.downvotes || 0,
        votes_safe: a.vote_count?.upvotes || 0,
        votes_total: (a.vote_count?.upvotes || 0) + (a.vote_count?.downvotes || 0)
      }));

      // Calculate Stats
      const calculatedStats = {
        sos_pending: sosData.filter((s: any) => s.status === 'PENDING').length,
        sos_critical: sosData.filter((s: any) => s.severity === 'CRITICAL' || s.emergency_type === 'CRITICAL').length,
        active_zones: zonesData.filter((z: any) => z.status === 'ACTIVE').length,
        critical_zones: zonesData.filter((z: any) => z.severity === 'CRITICAL').length,
        teams_on_mission: mappedTeams.filter((t: any) => t.status !== 'AVAILABLE').length,
        teams_available: mappedTeams.filter((t: any) => t.status === 'AVAILABLE').length,
        completed_today: missionsData.filter((m: any) => m.status === 'COMPLETED').length,
        completed_yesterday: 0
      };

      setStats(calculatedStats);
      setZones(mappedZones);
      setTeams(mappedTeams);
      setSosList(sosData); // if we render SOS later
      setAlerts(mappedAlerts);
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setErrorMsg(err?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  const navigate = useNavigate();
  const handleViewNotification = async () => {
    navigate(`/notification-broadcast`);
  }   // ← đóng function
  // ← dư cái này — đóng cái gì?

  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{errorMsg}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Thử lại</button>
        </div>
      </div>
    );
  }

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
                {zones.map((z) => (
                  <ZoneCard key={z.id} zone={z} />
                ))}
              </div>
            </div>

            {/* Teams */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-md">
              <h2 className="text-base font-bold text-gray-900 mb-5">
                Các đội cứu hộ
              </h2>
              <div className="divide-y divide-gray-100">
                {teams.map((t) => (
                  <TeamRow key={t.id} team={t} />
                ))}
              </div>
              {/* Distribution */}
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
                {alerts.map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
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

function StatCard({ label, value, sub, subColor = "text-gray-400" }) {
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
function ZoneCard({ zone }) {
  const pct = zone.teams_required > 0 ? Math.round((zone.teams_assigned / zone.teams_required) * 100) : 100;
  const cfg = SEVERITY_CONFIG[zone.severity] || SEVERITY_CONFIG.NORMAL;
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
      <button className="text-xs text-blue-600 hover:text-blue-800 shrink-0">
        Xem →
      </button>
    </div>
  );
}

function TeamRow({ team }) {
  const cfg = TEAM_STATUS_CONFIG[team.status] || TEAM_STATUS_CONFIG.AVAILABLE;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{team.name}</p>
        
      </div>
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${cfg.badge}`}>
        {team.type}
      </span>
    </div>
  );
}

function AlertRow({ alert }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.INFO;
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

function DistributionBar({ label, count, total, color }) {
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

