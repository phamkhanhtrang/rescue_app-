import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import SOSDetailModal from "../../components/SOSDetailModal";
import TeamDetailModal from "../../components/TeamDetailModal";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  Tooltip,
  useMap
} from 'react-leaflet';
import "leaflet/dist/leaflet.css";
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { api } from "../../services/api";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";
import {
  ShieldAlert,
  Phone,
  MapPin,
  Users,
  Radio,
  Eye,
  Filter,
  Layers,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation,
  ExternalLink,
  Activity,
  Flame,
  UserCheck
} from "lucide-react";

// Fix default Leaflet icon assets
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Controller for flyTo and FitBounds
function MapController({
  center,
  zoom,
  fitBoundsData
}: {
  center: [number, number] | null;
  zoom?: number;
  fitBoundsData?: [number, number][] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 15, { duration: 1.2 });
    }
  }, [center, zoom, map]);

  useEffect(() => {
    if (fitBoundsData && fitBoundsData.length > 0) {
      const bounds = L.latLngBounds(fitBoundsData);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [fitBoundsData, map]);

  return null;
}

// Helpers create Custom Leaflet DivIcons
const createSosDivIcon = (verificationStatus?: string) => {
  let bg = '#EF4444'; // Red for unverified
  let text = 'SOS';
  let isPulse = true;

  if (verificationStatus === 'CHECKING') {
    bg = '#3B82F6'; // Blue
    text = 'CALL';
  } else if (verificationStatus === 'VERIFIED') {
    bg = '#10B981'; // Green
    text = 'OK';
    isPulse = false;
  }

  return L.divIcon({
    className: 'custom-leaflet-div-icon',
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        ${isPulse ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${bg}; opacity: 0.45;" class="animate-ping"></span>` : ''}
        <div style="width: 28px; height: 28px; border-radius: 50%; background-color: ${bg}; border: 2px solid #FFFFFF; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 10px; font-weight: 800; box-shadow: 0 2px 8px rgba(0,0,0,0.35); cursor: pointer;">
          ${text}
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
};

const createRescuerDivIcon = (isOnDuty: boolean) => {
  const bg = isOnDuty ? '#2563EB' : '#64748B';
  return L.divIcon({
    className: 'custom-leaflet-div-icon',
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background-color: ${bg}; border: 2px solid #FFFFFF; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer;">
          🚑
        </div>
        ${isOnDuty ? '<span style="position: absolute; top: 1px; right: 1px; width: 9px; height: 9px; border-radius: 50%; background-color: #22C55E; border: 2px solid #FFFFFF;"></span>' : ''}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const SEVERITY_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  CRITICAL: { color: '#DC2626', label: 'Nguy cấp', bg: 'bg-red-100 text-red-700' },
  HIGH: { color: '#EA580C', label: 'Mức cao', bg: 'bg-orange-100 text-orange-700' },
  MEDIUM: { color: '#D97706', label: 'Trung bình', bg: 'bg-amber-100 text-amber-700' },
  LOW: { color: '#16A34A', label: 'Mức thấp', bg: 'bg-green-100 text-green-700' },
};

export default function AdminMapPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tacticalOpen, setTacticalOpen] = useState(true);

  // Data states
  const [zones, setZones] = useState<any[]>([]);
  const [rescuers, setRescuers] = useState<any[]>([]);
  const [sosSignals, setSosSignals] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadError, setLoadError] = useState("");
  const requestInFlight = useRef(false);
  const refreshQueued = useRef(false);
  const mounted = useRef(false);

  // Map viewport & targets
  const [targetCenter, setTargetCenter] = useState<[number, number] | null>(null);
  const [targetZoom, setTargetZoom] = useState<number>(13);
  const [fitBoundsPoints, setFitBoundsPoints] = useState<[number, number][] | null>(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showRescuers, setShowRescuers] = useState(true);
  const [showSos, setShowSos] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [sosStatusFilter, setSosStatusFilter] = useState<string>("ALL");

  // Tactical sidebar tab
  const [activeTab, setActiveTab] = useState<'sos' | 'teams' | 'zones'>('sos');

  // SOS Detail & Verification modal
  const [selectedSosId, setSelectedSosId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

  // Fetch all map data
  const fetchData = useCallback(async () => {
    if (requestInFlight.current) { refreshQueued.current = true; return; }
    requestInFlight.current = true;
    setLoading(true);
    try {
      const requests = [
        api.zones.getAll(),
        api.rescuers.getAll(),
        api.sos.getAll(),
        api.missions.getAll()
      ];
      const labels = ['vùng', 'đội cứu hộ', 'SOS', 'nhiệm vụ'];
      const failures = new Map<number, string>();
      await Promise.all(requests.map(async (request, index) => {
        try {
          const response = await request;
          const rows = response?.data?.results || response?.data || [];
          if (!Array.isArray(rows)) throw new Error('Dữ liệu không đúng định dạng');
          if (!mounted.current) return;
          if (index === 0) setZones(rows);
          if (index === 1) setRescuers(rows.filter((team: any) => team.is_active));
          if (index === 2) setSosSignals(rows.filter((s: any) => s.status !== 'RESOLVED' && s.status !== 'CANCELLED'));
          if (index === 3) setMissions(rows);
          setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
        } catch (error) {
          failures.set(index, `${labels[index]}: ${apiErrorMessage(error)}`);
        }
        if (mounted.current) setLoadError(failures.size ? `Không cập nhật được ${[...failures.values()].join('; ')}.` : '');
      }));
    } catch (err) {
      console.error("Lỗi lấy dữ liệu bản đồ:", err);
      if (mounted.current) setLoadError(apiErrorMessage(err));
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setLoading(false);
      if (mounted.current && refreshQueued.current) {
        refreshQueued.current = false;
        void fetchData();
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchData();
    return () => { mounted.current = false; };
  }, [fetchData]);

  // Polling auto-refresh every 25s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!document.hidden) fetchData();
    }, 25000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Helpers to safely extract valid coordinates
  const getZoneCoords = (z: any): [number, number] | null => {
    const lat = Number(z.location_lat);
    const lng = Number(z.location_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && lat !== 0) {
      return [lat, lng];
    }
    return null;
  };

  const getSosCoords = (s: any): [number, number] | null => {
    const lat = Number(s.location_lat);
    const lng = Number(s.location_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && lat !== 0) {
      return [lat, lng];
    }
    return null;
  };

  const getRescuerCoords = (r: any): [number, number] | null => {
    const lat = Number(r.rescuer_profile?.current_lat ?? r.current_lat);
    const lng = Number(r.rescuer_profile?.current_lng ?? r.current_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && lat !== 0) {
      return [lat, lng];
    }
    return null;
  };

  // Filtered lists
  const filteredZones = useMemo(() => {
    return zones.filter(z => {
      if (severityFilter !== "ALL" && z.severity !== severityFilter) return false;
      return true;
    });
  }, [zones, severityFilter]);

  const filteredSos = useMemo(() => {
    return sosSignals.filter(s => {
      if (sosStatusFilter === "UNVERIFIED") {
        return s.verification_status === 'UNVERIFIED' || !s.verification_status;
      }
      if (sosStatusFilter === "CHECKING") {
        return s.verification_status === 'CHECKING';
      }
      if (sosStatusFilter === "VERIFIED") {
        return s.verification_status === 'VERIFIED';
      }
      return true;
    });
  }, [sosSignals, sosStatusFilter]);

  // Handle Search location via Nominatim
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setTargetCenter([lat, lon]);
        setTargetZoom(14);
      } else {
        alert("Không tìm thấy địa điểm này. Vui lòng thử từ khóa khác!");
      }
    } catch (err) {
      console.error("Lỗi tìm kiếm:", err);
      alert("Lỗi kết nối dịch vụ tìm kiếm.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Fit bounds to show all markers
  const handleFitAll = () => {
    const allPoints: [number, number][] = [];
    zones.forEach(z => {
      const c = getZoneCoords(z);
      if (c) allPoints.push(c);
    });
    sosSignals.forEach(s => {
      const c = getSosCoords(s);
      if (c) allPoints.push(c);
    });
    rescuers.forEach(r => {
      const c = getRescuerCoords(r);
      if (c) allPoints.push(c);
    });

    if (allPoints.length > 0) {
      setFitBoundsPoints(allPoints);
    } else {
      setTargetCenter([10.762622, 106.660172]);
      setTargetZoom(12);
    }
  };

  // Focus actions
  const focusOnSos = (s: any) => {
    const coords = getSosCoords(s);
    if (coords) {
      setTargetCenter(coords);
      setTargetZoom(16);
    } else {
      alert("Tín hiệu này chưa có tọa độ hợp lệ.");
    }
  };

  const focusOnRescuer = (r: any) => {
    const coords = getRescuerCoords(r);
    if (coords) {
      setTargetCenter(coords);
      setTargetZoom(16);
    } else {
      alert("Đội cứu hộ này chưa cập nhật định vị GPS.");
    }
  };

  const focusOnZone = (z: any) => {
    const coords = getZoneCoords(z);
    if (coords) {
      setTargetCenter(coords);
      setTargetZoom(14);
    } else {
      alert("Vùng này chưa có tọa độ hợp lệ.");
    }
  };

  // Calculations for quick metrics
  const unverifiedSosCount = sosSignals.filter(s => s.verification_status === 'UNVERIFIED' || !s.verification_status || s.verification_status === 'CHECKING').length;
  const onDutyTeamsCount = rescuers.filter(r => r.rescuer_profile?.is_on_duty).length;
  const criticalZonesCount = zones.filter(z => z.severity === 'CRITICAL').length;

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      {/* Inline style to remove Leaflet default white borders from DivIcon */}
      <style>{`
        .custom-leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
      `}</style>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Navigation Sidebar */}
      <div
        className={`
          fixed lg:relative z-40 lg:z-auto
          h-full overflow-y-auto shrink-0 border-r border-slate-200
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <SliderBar />
      </div>

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="px-4"><DataNotice loading={loading} error={loadError} onRetry={fetchData} hasData={!!lastUpdated} /></div>

        {/* Tactical Sub-Header (Quick Metrics & Fast Controls) */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0 z-20">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto text-xs py-0.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg border border-red-200 font-semibold shrink-0">
              <Radio className="w-3.5 h-3.5 animate-pulse text-red-600" />
              <span>SOS cần xử lý: <b>{sosSignals.length}</b></span>
              {unverifiedSosCount > 0 && (
                <span className="bg-red-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {unverifiedSosCount} chưa xác minh
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 font-medium shrink-0">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>Đội trực chiến: <b>{onDutyTeamsCount}/{rescuers.length}</b></span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 font-medium shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Vùng nguy cấp: <b>{criticalZonesCount}/{zones.length}</b></span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleFitAll}
              title="Thu phóng toàn cảnh"
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1 font-medium transition cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Toàn cảnh</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              title="Làm mới dữ liệu"
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1 font-medium transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              onClick={() => setTacticalOpen(!tacticalOpen)}
              className="px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center gap-1.5 font-semibold transition cursor-pointer shadow-xs"
            >
              {tacticalOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              <span>{tacticalOpen ? "Thu gọn bảng" : "Mở bảng tác chiến"}</span>
            </button>
          </div>
        </div>

        {/* Map Workspace (Split View) */}
        <div className="flex-1 flex overflow-hidden relative">

          {/* Left Column: Interactive Map */}
          <div className="flex-1 h-full relative">

            {/* Leaflet MapContainer */}
            <MapContainer
              center={[10.762622, 106.660172]}
              zoom={12}
              className="h-full w-full z-0 relative"
            >
              <MapController
                center={targetCenter}
                zoom={targetZoom}
                fitBoundsData={fitBoundsPoints}
              />

              {/* Map Floating Toolbar - đặt trong MapContainer để popup (z-1000) đè lên trên */}
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className={`absolute top-3 left-14 z-[450] flex flex-col gap-2 max-w-[calc(100%-70px)] pointer-events-none transition-opacity ${selectedSosId ? 'opacity-0 pointer-events-none' : ''}`}
              >
                {/* Search Box */}
                <form
                  onSubmit={handleSearch}
                  className="flex items-center bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 overflow-hidden pointer-events-auto w-72 sm:w-80"
                >
                  <div className="pl-3 text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm địa điểm (Đà Nẵng, Huế...)"
                    className="w-full px-3 py-2 text-xs outline-none bg-transparent text-slate-800"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 transition cursor-pointer"
                  >
                    {searchLoading ? '...' : 'Tìm'}
                  </button>
                </form>

                {/* Layer Controls Bar */}
                <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 p-2 flex flex-wrap items-center gap-2 text-xs pointer-events-auto">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 pl-1">
                    <Layers className="w-3 h-3 text-slate-600" /> Lớp:
                  </span>

                  <button
                    onClick={() => setShowZones(!showZones)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      showZones ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Vùng sự cố ({filteredZones.length})
                  </button>

                  <button
                    onClick={() => setShowSos(!showSos)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      showSos ? 'bg-red-100 border-red-300 text-red-800' : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Tín hiệu SOS ({filteredSos.length})
                  </button>

                  <button
                    onClick={() => setShowRescuers(!showRescuers)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      showRescuers ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Đội cứu hộ ({rescuers.length})
                  </button>
                </div>
              </div>

              {/* Map Status Timestamp */}
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute bottom-4 left-3 z-[450] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5 pointer-events-none"
              >
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Cập nhật: <b>{lastUpdated || 'Đang tải...'}</b></span>
                <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-500' : 'bg-slate-300'}`} />
              </div>

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* 1. Lớp Vùng sự cố (Incident Zones) */}
              {showZones && filteredZones.map(zone => {
                const coords = getZoneCoords(zone);
                if (!coords) return null;
                const cfg = SEVERITY_CONFIG[zone.severity] || SEVERITY_CONFIG.MEDIUM;
                const radius = zone.radius || 600;

                return (
                  <React.Fragment key={`zone-${zone.id}`}>
                    <Circle
                      center={coords}
                      radius={radius}
                      pathOptions={{
                        color: cfg.color,
                        fillColor: cfg.color,
                        fillOpacity: 0.22,
                        weight: 2,
                      }}
                    >
                      <Tooltip permanent direction="center" className="bg-transparent border-0 shadow-none font-bold text-slate-800 text-[11px]">
                        <span className="px-2 py-0.5 bg-white/90 rounded border border-slate-200 shadow-xs">
                          {zone.name}
                        </span>
                      </Tooltip>

                      <Popup>
                        <div className="p-1 min-w-[220px]">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg}`}>
                              {cfg.label}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {zone.status === 'ACTIVE' ? 'Đang hoạt động' : zone.status}
                            </span>
                          </div>

                          <h3 className="font-bold text-sm text-slate-900 mb-1">{zone.name}</h3>
                          <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-1.5 mb-3">
                            <p>👥 Nạn nhân ước tính: <b>{zone.people_affected || 0} người</b></p>
                            <p>🚨 Số tin SOS trong vùng: <b>{zone.sos_count || 0}</b></p>
                            <p>🚑 Số đội cứu hộ cần: <b>{zone.rescuers_needed || 0}</b></p>
                          </div>

                          <button
                            onClick={() => navigate(`/details-rescue-zone/${zone.id}`)}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>Xem chi tiết & Điều phối</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </Popup>
                    </Circle>
                  </React.Fragment>
                );
              })}

              {/* 2. Lớp Tín hiệu SOS từ người dân */}
              {showSos && filteredSos.map(sos => {
                const coords = getSosCoords(sos);
                if (!coords) return null;

                const icon = createSosDivIcon(sos.verification_status);

                return (
                  <Marker
                    key={`sos-${sos.id}`}
                    position={coords}
                    icon={icon}
                  >
                    <Popup>
                      <div className="p-1 min-w-[250px] max-w-[280px]">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sos.verification_status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                            sos.verification_status === 'CHECKING' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {sos.verification_status === 'VERIFIED' ? '✅ Đã xác minh' :
                             sos.verification_status === 'CHECKING' ? '📞 Đang kiểm tra' :
                             '⚠️ Chưa xác minh'}
                          </span>

                          <span className="text-[10px] text-slate-400">
                            {new Date(sos.sent_at || sos.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm">
                          {sos.emergency_type || 'Yêu cầu Cứu nạn SOS'}
                        </h4>

                        <div className="mt-1 space-y-1 text-xs text-slate-600">
                          <p>👤 Người gửi: <b>{sos.contact_name || sos.citizen_name || 'Ẩn danh'}</b></p>
                          <p className="flex items-center gap-1 text-blue-600 font-semibold">
                            <Phone className="w-3 h-3" />
                            <a href={`tel:${sos.contact_phone || sos.phone}`} className="hover:underline">
                              {sos.contact_phone || sos.phone || 'Chưa có SĐT'}
                            </a>
                          </p>
                          <p className="text-slate-500 line-clamp-2">
                            📝 {sos.description || sos.note || 'Không có mô tả chi tiết'}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100">
                          {sos.verification_status === 'VERIFIED' ? (
                            <button
                              onClick={() => setSelectedSosId(sos.id)}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đã xác minh · Xem chi tiết</span>
                            </button>
                          ) : sos.verification_status === 'CHECKING' ? (
                            <button
                              onClick={() => setSelectedSosId(sos.id)}
                              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5 animate-pulse" />
                              <span>Đang kiểm tra · Tiếp tục gọi</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedSosId(sos.id)}
                              className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Gọi điện & Xác minh ngay</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* 3. Lớp Đội cứu hộ (Rescue Teams) */}
              {showRescuers && rescuers.map(team => {
                const coords = getRescuerCoords(team);
                if (!coords) return null;

                const isOnDuty = Boolean(team.rescuer_profile?.is_on_duty);
                const icon = createRescuerDivIcon(isOnDuty);

                return (
                  <Marker
                    key={`rescuer-${team.id}`}
                    position={coords}
                    icon={icon}
                  >
                    <Popup>
                      <div className="p-1 min-w-[210px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isOnDuty ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isOnDuty ? '🟢 Đang trực chiến' : '⚪ Nghỉ ca'}
                          </span>
                          <span className="text-[10px] text-blue-700 font-bold">
                            {team.rescuer_profile?.specialty || 'Cứu hộ'}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm">
                          {team.rescuer_profile?.unit_name || team.full_name || 'Đội Cứu Hộ'}
                        </h4>

                        <div className="mt-1 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-1.5">
                          <p>Đội trưởng: <b>{team.full_name}</b></p>
                          <p className="flex items-center gap-1 text-blue-600">
                            <Phone className="w-3 h-3" />
                            <a href={`tel:${team.phone}`} className="hover:underline font-semibold">
                              {team.phone || 'Chưa có SĐT'}
                            </a>
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            📍 GPS: {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
                          </p>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => setSelectedTeam(team)}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem chi tiết đội</span>
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Right Column: Tactical Feed Sidebar (Collapsible) */}
          <div className={`
            ${tacticalOpen ? 'w-full md:w-[380px]' : 'w-0 hidden'}
            transition-all duration-300 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 z-10 shadow-lg
          `}>

            {/* Tactical Tabs Header */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('sos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'sos' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>SOS ({sosSignals.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('teams')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'teams' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Đội ({rescuers.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('zones')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'zones' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Vùng ({zones.length})</span>
                </button>
              </div>

              <button
                onClick={() => setTacticalOpen(false)}
                title="Đóng thanh tác chiến"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Tab 1: Live SOS Feed */}
            {activeTab === 'sos' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* SOS Sub-filter */}
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-1 text-[11px] bg-white shrink-0">
                  <span className="text-slate-400 font-medium">Lọc:</span>
                  <div className="flex gap-1">
                    {[
                      { id: 'ALL', label: 'Tất cả' },
                      { id: 'UNVERIFIED', label: 'Chưa xác minh' },
                      { id: 'CHECKING', label: 'Đang gọi' },
                      { id: 'VERIFIED', label: 'Đã xác minh' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSosStatusFilter(f.id)}
                        className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                          sosStatusFilter === f.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SOS List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
                  {filteredSos.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Không có tin SOS nào trong bộ lọc này.
                    </div>
                  ) : (
                    filteredSos.map(s => {
                      const isUnverified = s.verification_status === 'UNVERIFIED' || !s.verification_status;
                      const isChecking = s.verification_status === 'CHECKING';

                      return (
                        <div
                          key={s.id}
                          className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              s.verification_status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                              isChecking ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700 animate-pulse'
                            }`}>
                              {s.verification_status === 'VERIFIED' ? 'Đã xác minh' :
                               isChecking ? 'Đang kiểm tra' : 'Chưa xác minh'}
                            </span>

                            <span className="text-[11px] text-slate-400">
                              {new Date(s.sent_at || s.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <h4 className="font-semibold text-slate-900 text-xs">
                            {s.emergency_type || 'Yêu cầu Cứu nạn SOS'}
                          </h4>

                          <p className="text-xs text-slate-600 font-medium mt-0.5">
                            {s.contact_name || s.citizen_name || 'Người dân ẩn danh'}
                          </p>

                          <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold mt-1">
                            <Phone className="w-3 h-3" />
                            <span>{s.contact_phone || s.phone || 'Chưa có SĐT'}</span>
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 bg-slate-50 p-1.5 rounded">
                            {s.description || s.note || 'Không có mô tả'}
                          </p>

                          {/* Action Buttons */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={() => focusOnSos(s)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition flex items-center gap-1 cursor-pointer"
                            >
                              <MapPin className="w-3 h-3 text-red-500" />
                              <span>Định vị</span>
                            </button>

                            {s.verification_status === 'VERIFIED' ? (
                              <button
                                onClick={() => setSelectedSosId(s.id)}
                                className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Xem chi tiết</span>
                              </button>
                            ) : isChecking ? (
                              <button
                                onClick={() => setSelectedSosId(s.id)}
                                className="px-2.5 py-1 bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Phone className="w-3 h-3 text-blue-600 animate-pulse" />
                                <span>Đang gọi...</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedSosId(s.id)}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Gọi & Xác minh</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Rescue Teams Feed */}
            {activeTab === 'teams' && (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
                {rescuers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Chưa có đội cứu hộ nào kích hoạt.
                  </div>
                ) : (
                  rescuers.map(team => {
                    const isOnDuty = Boolean(team.rescuer_profile?.is_on_duty);
                    const coords = getRescuerCoords(team);

                    return (
                      <div
                        key={team.id}
                        className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isOnDuty ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isOnDuty ? '🟢 Đang trực chiến' : '⚪ Nghỉ ca'}
                          </span>

                          <span className="text-[11px] font-bold text-blue-700">
                            {team.rescuer_profile?.specialty || 'Cứu hộ tổng hợp'}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-xs">
                          {team.rescuer_profile?.unit_name || team.full_name || 'Đội cứu hộ'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Đội trưởng: <b>{team.full_name}</b>
                        </p>

                        <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                          <Phone className="w-3 h-3" />
                          <span>{team.phone || 'Chưa có SĐT'}</span>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setSelectedTeam(team)}
                            className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Chi tiết</span>
                          </button>

                          <button
                            onClick={() => focusOnRescuer(team)}
                            disabled={!coords}
                            className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Định vị trên map</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 3: Zones Feed */}
            {activeTab === 'zones' && (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
                {zones.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Chưa có vùng sự cố nào được ghi nhận.
                  </div>
                ) : (
                  zones.map(zone => {
                    const cfg = SEVERITY_CONFIG[zone.severity] || SEVERITY_CONFIG.MEDIUM;
                    const coords = getZoneCoords(zone);

                    return (
                      <div
                        key={zone.id}
                        className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {zone.status === 'ACTIVE' ? 'Đang hoạt động' : zone.status}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-xs">
                          {zone.name}
                        </h4>

                        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                          <p>Nạn nhân: <b>{zone.people_affected || 0}</b></p>
                          <p>SOS trong vùng: <b>{zone.sos_count || 0}</b></p>
                          <p>Đội cần: <b>{zone.rescuers_needed || 0}</b></p>
                          <p>Bán kính: <b>{zone.radius || 600}m</b></p>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => focusOnZone(zone)}
                            disabled={!coords}
                            className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <MapPin className="w-3 h-3 text-amber-500" />
                            <span>Đến vùng</span>
                          </button>

                          <button
                            onClick={() => navigate(`/details-rescue-zone/${zone.id}`)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>Điều phối →</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* SOS Detail & Verification Modal */}
        <SOSDetailModal
          sosId={selectedSosId}
          isOpen={Boolean(selectedSosId)}
          onClose={() => setSelectedSosId(null)}
          onUpdated={fetchData}
        />

        {/* Rescue Team Detail Modal */}
        <TeamDetailModal
          isOpen={Boolean(selectedTeam)}
          teamId={selectedTeam?.id}
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
          onLocate={(t) => {
            focusOnRescuer(t);
            setSelectedTeam(null);
          }}
        />
      </div>
    </div>
  );
}
