import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import TeamDetailModal from "../../components/TeamDetailModal";
import { api } from "../../services/api";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import AIAssignment from "../AIAssignment";
import {
  Users,
  Phone,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Navigation,
  Radio,
  Flame,
  Crosshair,
  X,
  Clock,
  Maximize2,
  Minimize2,
  UserPlus,
  Zap,
  ExternalLink,
  Eye,
  Mail,
  Truck,
  Award,
  Info,
  Check,
  Copy,
  MapPin,
  AlertCircle,
  Package,
  Activity,
} from "lucide-react";

// Fix Leaflet default icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Hàm tính khoảng cách Haversine giữa 2 tọa độ GPS (trả về km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    0.5 -
    Math.cos(dLat) / 2 +
    (Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      (1 - Math.cos(dLon))) /
      2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Controller bản đồ hỗ trợ FlyTo và FitBounds
function MapController({
  center,
  zoom,
  bounds,
}: {
  center: [number, number] | null;
  zoom?: number;
  bounds?: [number, number][] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 15, { duration: 1.2 });
    }
  }, [center, zoom, map]);

  useEffect(() => {
    if (bounds && bounds.length > 0) {
      const b = L.latLngBounds(bounds);
      map.fitBounds(b, { padding: [50, 50], maxZoom: 15 });
    }
  }, [bounds, map]);

  return null;
}

// Hàm tạo Leaflet DivIcon tùy biến cao cho Đội cứu hộ
const createRescuerDivIcon = (status: string, specialty?: string, unitName?: string) => {
  let bgColor = "#16A34A"; // Sẵn sàng (Green)
  let iconEmoji = "🛡️";
  let isPulse = false;

  if (status === "CẦN HỖ TRỢ") {
    bgColor = "#DC2626"; // Red
    iconEmoji = "🚨";
    isPulse = true;
  } else if (status === "ĐANG CỨU HỘ") {
    bgColor = "#EA580C"; // Amber/Orange
    iconEmoji = specialty === "MEDICAL" ? "🚑" : specialty === "LOGISTICS" ? "📦" : "🛟";
  } else if (status === "ĐANG DI CHUYỂN") {
    bgColor = "#2563EB"; // Blue
    iconEmoji = "🚐";
  } else if (status === "TẠM DỪNG" || status === "NGHỈ CA") {
    bgColor = "#64748B"; // Slate Gray
    iconEmoji = "⏸️";
  }

  const shortName = (unitName || "Đội").slice(0, 10);

  return L.divIcon({
    className: "custom-rescuer-marker",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
          ${
            isPulse
              ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${bgColor}; opacity: 0.5;" class="animate-ping"></span>`
              : ""
          }
          <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${bgColor}; border: 2.5px solid #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
            ${iconEmoji}
          </div>
        </div>
        <span style="background: rgba(15, 23, 42, 0.85); color: #FFFFFF; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-top: -2px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3); max-width: 80px; overflow: hidden; text-overflow: ellipsis;">
          ${shortName}
        </span>
      </div>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 25],
    popupAnchor: [0, -25],
  });
};

// DivIcon cho tín hiệu SOS
const createSosDivIcon = () => {
  return L.divIcon({
    className: "custom-sos-marker",
    html: `
      <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: #EF4444; opacity: 0.5;" class="animate-ping"></span>
        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #DC2626; border: 2px solid #FFFFFF; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 9px; font-weight: 900; box-shadow: 0 2px 8px rgba(0,0,0,0.35);">
          SOS
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

const SPECIALTY_LABELS: Record<string, string> = {
  SEARCH_RESCUE: "Tìm kiếm & Cứu nạn",
  MEDICAL: "Y tế cấp cứu",
  LOGISTICS: "Hậu cần & Tiếp tế",
  COMMAND: "Chỉ huy tác chiến",
};

export default function FollowTheRescueTeamPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rescuers, setRescuers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [, setMissions] = useState<any[]>([]);
  const [sosSignals, setSosSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const loadPending = useRef(false);
  const mounted = useRef(false);
  const fittedInitialBounds = useRef(false);

  // Bản đồ controls
  const [mapCenter, setMapCenter] = useState<[number, number] | null>([16.0544, 108.2022]); // Mặc định miền Trung (Đà Nẵng)
  const [mapZoom, setMapZoom] = useState<number>(10);
  const [mapBounds, setMapBounds] = useState<[number, number][] | null>(null);
  const [mapExpanded, setMapExpanded] = useState<boolean>(false);
  const [searchMapQuery, setSearchMapQuery] = useState("");
  const [searchMapLoading, setSearchMapLoading] = useState(false);

  // Bộ lọc danh sách đội
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [specialtyFilter, setSpecialtyFilter] = useState("ALL");

  // Cảnh báo & Gợi ý
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [dismissedAnomalyIds, setDismissedAnomalyIds] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Modals
  const [showAIAssignment, setShowAIAssignment] = useState(false);
  const [assigningTeam, setAssigningTeam] = useState<any | null>(null);
  const [assignZoneId, setAssignZoneId] = useState<string>("");
  const [assignNotes, setAssignNotes] = useState<string>("");
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [selectedDetailTeam, setSelectedDetailTeam] = useState<any | null>(null);

  // Ref lưu lịch sử vị trí để phát hiện đứng yên thời gian thực (> 5 phút)
  const movementHistoryRef = useRef<Record<string, { lat: number; lng: number; lastMovedAt: number }>>({});

  // ── Lấy toàn bộ dữ liệu ───────────────────────────────────────────
  const fetchRescuers = useCallback(async (isManual = false) => {
    if (loadPending.current) return;
    loadPending.current = true;
    if (isManual) setIsRefreshing(true);
    try {
      const [rescuersRes, zonesRes, missionsRes, sosRes, resourcesRes] = await Promise.all([
        api.rescuers.getAll(),
        api.zones.getAll(),
        api.missions.getAll(),
        api.sos.getAll(),
        api.resources.getAll().catch(() => ({ data: { results: [] } })),
      ]);
      if (!mounted.current) return;

      const fetchedZones = zonesRes.data?.results || zonesRes.data || [];
      const fetchedRescuers = rescuersRes.data?.results || rescuersRes.data || [];
      const fetchedMissions = missionsRes.data?.results || missionsRes.data || [];
      const fetchedSos = sosRes.data?.results || sosRes.data || [];
      const fetchedResources = resourcesRes.data?.results || resourcesRes.data || [];

      setZones(fetchedZones);
      setMissions(fetchedMissions);
      setSosSignals(
        fetchedSos.filter(
          (s: any) => s.status === "PENDING" || s.status === "ACKNOWLEDGED"
        )
      );

      const now = Date.now();
      const detectedAnomalies: any[] = [];
      const validCoordinates: [number, number][] = [];

      // Xử lý từng đội cứu hộ
      const processed = fetchedRescuers.map((team: any) => {
        const profile = team.rescuer_profile || {};
        const rawLat = parseFloat(profile.current_lat);
        const rawLng = parseFloat(profile.current_lng);
        const hasGps = !isNaN(rawLat) && !isNaN(rawLng) && rawLat !== 0 && rawLng !== 0;

        const lat = hasGps ? rawLat : null;
        const lng = hasGps ? rawLng : null;

        if (hasGps && lat !== null && lng !== null) {
          validCoordinates.push([lat, lng]);
        }

        // Tìm mission đang hoạt động của đội
        const activeMission = fetchedMissions.find(
          (m: any) =>
            m.rescuer === team.id &&
            ["PENDING_ACCEPTANCE", "ACCEPTED", "ON_MY_WAY", "ACTIVE", "NEEDS_HELP"].includes(m.status)
        );

        // Xác định vùng gần nhất nếu có GPS
        let closestZone: any = null;
        let minDistance = Infinity;

        if (hasGps && lat !== null && lng !== null) {
          fetchedZones.forEach((z: any) => {
            const zLat = parseFloat(z.location_lat);
            const zLng = parseFloat(z.location_lng);
            if (!isNaN(zLat) && !isNaN(zLng)) {
              const dist = calculateDistance(lat, lng, zLat, zLng);
              if (dist < minDistance) {
                minDistance = dist;
                closestZone = z;
              }
            }
          });
        }

        // Đang trong phạm vi vùng (bán kính <= 3km)
        const isInZone = hasGps && minDistance <= 3 && closestZone !== null;
        const currentZone = isInZone ? closestZone : null;
        const assignedZoneName = activeMission ? activeMission.zone_name : null;
        const assignedZoneId = activeMission ? (typeof activeMission.zone === "object" ? activeMission.zone?.id : activeMission.zone) : null;

        // Xác định trạng thái nghiệp vụ chuẩn xác
        let computedStatus = "TẠM DỪNG";
        if (activeMission) {
          if (activeMission.status === "NEEDS_HELP") {
            computedStatus = "CẦN HỖ TRỢ";
          } else if (activeMission.status === "ACTIVE" || isInZone) {
            computedStatus = "ĐANG CỨU HỘ";
          } else if (activeMission.status === "ON_MY_WAY" || activeMission.status === "ACCEPTED") {
            computedStatus = "ĐANG DI CHUYỂN";
          } else {
            computedStatus = "ĐANG DI CHUYỂN";
          }
        } else {
          if (profile.is_on_duty) {
            computedStatus = "SẴN SÀNG";
          } else {
            computedStatus = "NGHỈ CA";
          }
        }

        // ── Logic phát hiện bất thường hợp lý ──
        const teamAnomalies: string[] = [];

        // 1. Cảnh báo đội gặp nguy hiểm
        if (computedStatus === "CẦN HỖ TRỢ") {
          teamAnomalies.push("YÊU CẦU CHI VIỆN");
          detectedAnomalies.push({
            id: `sos-${team.id}`,
            type: "danger",
            title: "ĐỘI PHÁT TÍN HIỆU CẦN HỖ TRỢ",
            desc: `Đội ${profile.unit_name || team.full_name} đang gặp nguy hiểm hoặc quá tải tại khu vực ${assignedZoneName || "chưa rõ"}.`,
            teamId: team.id,
          });
        }

        // 2. Cảnh báo không di chuyển (> 5 phút)
        if (hasGps && lat !== null && lng !== null) {
          const history = movementHistoryRef.current[team.id];
          if (!history) {
            movementHistoryRef.current[team.id] = { lat, lng, lastMovedAt: now };
          } else {
            const distMoved = calculateDistance(history.lat, history.lng, lat, lng);
            if (distMoved > 0.05) {
              // Đã di chuyển hơn 50 mét
              movementHistoryRef.current[team.id] = { lat, lng, lastMovedAt: now };
            } else {
              const stationaryDurationMs = now - history.lastMovedAt;
              // Nếu đang có trạng thái DI CHUYỂN mà đứng yên hơn 5 phút
              if (computedStatus === "ĐANG DI CHUYỂN" && stationaryDurationMs > 5 * 60 * 1000) {
                const minutes = Math.floor(stationaryDurationMs / 60000);
                teamAnomalies.push(`ĐỨNG YÊN (${minutes}p)`);
                detectedAnomalies.push({
                  id: `stationary-${team.id}`,
                  type: "warning",
                  title: "ĐỨNG YÊN BẤT THƯỜNG",
                  desc: `Đội ${profile.unit_name || team.full_name} đang nhận nhiệm vụ di chuyển nhưng không thay đổi vị trí trong ${minutes} phút.`,
                  teamId: team.id,
                });
              }
            }
          }
        }

        // 3. Cảnh báo sai vùng phân công (chỉ khi đang ở trạng thái CỨU HỘ)
        if (
          computedStatus === "ĐANG CỨU HỘ" &&
          currentZone &&
          assignedZoneName &&
          currentZone.name !== assignedZoneName
        ) {
          teamAnomalies.push("SAI VÙNG PHÂN CÔNG");
          detectedAnomalies.push({
            id: `wrong-zone-${team.id}`,
            type: "danger",
            title: "SAI VÙNG PHÂN CÔNG",
            desc: `Đội ${profile.unit_name || team.full_name} đang cứu hộ tại ${currentZone.name} nhưng nhiệm vụ được phân công là ở ${assignedZoneName}.`,
            teamId: team.id,
          });
        }

        // Gắn tài nguyên (nếu có)
        const teamResource = fetchedResources.find(
          (r: any) => r.rescuer === team.id || r.rescuer?.id === team.id
        );

        return {
          ...team,
          computed: {
            hasGps,
            lat,
            lng,
            minDistance: hasGps ? minDistance : null,
            status: computedStatus,
            currentZone,
            assignedZoneName,
            assignedZoneId,
            activeMission,
            anomalies: teamAnomalies,
            resource: teamResource || null,
          },
        };
      });

      setRescuers(processed);
      setSelectedDetailTeam((prev: any) => (prev ? processed.find((t: any) => t.id === prev.id) || prev : null));
      setAnomalies(detectedAnomalies);

      // Gợi ý phân bổ thông minh
      const newSuggestions: any[] = [];
      fetchedZones.forEach((z: any) => {
        if (z.status === "ACTIVE") {
          const activeTeams = fetchedMissions.filter((m: any) => {
            const zId = typeof m.zone === "object" ? m.zone?.id : m.zone;
            return zId === z.id && !["COMPLETED", "CANCELLED"].includes(m.status);
          }).length;

          if (z.severity === "CRITICAL" && activeTeams < 2) {
            newSuggestions.push({
              id: `sug-crit-${z.id}`,
              type: "danger",
              title: `VÙNG NGUY CẤP THIẾU QUÂN`,
              desc: `Vùng ${z.name} mức độ NGUY CẤP nhưng chỉ có ${activeTeams} đội phụ trách. Đề xuất bổ sung gấp.`,
            });
          } else if ((z.people_affected || 0) > 30 && activeTeams < 2) {
            newSuggestions.push({
              id: `sug-peo-${z.id}`,
              type: "warning",
              title: `CẦN TĂNG CƯỜNG NHÂN LỰC`,
              desc: `Vùng ${z.name} có ${z.people_affected} người bị nạn nhưng chỉ có ${activeTeams} đội hoạt động.`,
            });
          }
        }
      });
      setSuggestions(newSuggestions);

      // Tự động căn khung hình (FitBounds) nếu chưa có thao tác tay
      if (validCoordinates.length > 0 && !fittedInitialBounds.current) {
        fittedInitialBounds.current = true;
        setMapBounds(validCoordinates);
      }

      if (mounted.current) { setLastUpdated(new Date()); setLoadError(''); }
    } catch (error) {
      console.error("Lỗi cập nhật dữ liệu đội cứu trợ:", error);
      if (mounted.current) setLoadError(apiErrorMessage(error));
    } finally {
      loadPending.current = false;
      if (mounted.current) { setLoading(false); setIsRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchRescuers();
    const interval = setInterval(() => { if (!document.hidden) fetchRescuers(); }, 20000);
    return () => { mounted.current = false; clearInterval(interval); };
  }, [fetchRescuers]);

  // Căn bản đồ bao quát tất cả
  const handleFitBoundsAll = () => {
    const coords: [number, number][] = [];
    rescuers.forEach((r) => {
      if (r.computed.hasGps && r.computed.lat && r.computed.lng) {
        coords.push([r.computed.lat, r.computed.lng]);
      }
    });
    zones.forEach((z) => {
      const zLat = parseFloat(z.location_lat);
      const zLng = parseFloat(z.location_lng);
      if (!isNaN(zLat) && !isNaN(zLng)) {
        coords.push([zLat, zLng]);
      }
    });

    if (coords.length > 0) {
      setMapBounds([...coords]);
    } else {
      alert("Không có tọa độ nào để định vị bao quát.");
    }
  };

  // Định vị tới một đội cụ thể
  const handleLocateTeam = (team: any) => {
    if (!team.computed.hasGps) {
      alert(`Đội "${team.rescuer_profile?.unit_name || team.full_name}" chưa kích hoạt hoặc chưa gửi tín hiệu GPS!`);
      return;
    }
    setMapCenter([team.computed.lat, team.computed.lng]);
    setMapZoom(16);
    window.scrollTo({ top: 180, behavior: "smooth" });
  };

  // Tìm kiếm địa điểm trên bản đồ
  const handleSearchMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchMapQuery.trim()) return;
    setSearchMapLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchMapQuery
        )}&countrycodes=vn&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setMapCenter([lat, lon]);
        setMapZoom(13);
      } else {
        alert("Không tìm thấy địa điểm này trong lãnh thổ Việt Nam!");
      }
    } catch (err) {
      console.error("Lỗi tìm địa điểm:", err);
      alert("Không thể kết nối dịch vụ bản đồ.");
    } finally {
      setSearchMapLoading(false);
    }
  };

  // Xử lý gán nhiệm vụ nhanh
  const handleQuickAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningTeam || !assignZoneId) {
      alert("Vui lòng chọn Vùng sự cố cần phân công!");
      return;
    }

    setSubmittingAssign(true);
    try {
      await api.missions.create({
        rescuer: assigningTeam.id,
        zone: assignZoneId,
        notes: assignNotes || "Phân công trực tiếp từ Trung tâm Chỉ huy Admin.",
      });
      alert(`Đã gán nhiệm vụ thành công cho ${assigningTeam.rescuer_profile?.unit_name || assigningTeam.full_name}!`);
      setAssigningTeam(null);
      setAssignZoneId("");
      setAssignNotes("");
      fetchRescuers();
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.response?.data?.error || "Lỗi khi gán nhiệm vụ.");
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Bỏ qua cảnh báo
  const handleDismissAnomaly = (id: string) => {
    setDismissedAnomalyIds((prev) => new Set(prev).add(id));
  };

  // Thống kê đếm quân số
  const counts = useMemo(() => {
    return {
      total: rescuers.length,
      ready: rescuers.filter((r) => r.computed.status === "SẴN SÀNG").length,
      moving: rescuers.filter((r) => r.computed.status === "ĐANG DI CHUYỂN").length,
      rescuing: rescuers.filter((r) => r.computed.status === "ĐANG CỨU HỘ").length,
      needsHelp: rescuers.filter((r) => r.computed.status === "CẦN HỖ TRỢ").length,
      offDuty: rescuers.filter((r) => r.computed.status === "NGHỈ CA" || r.computed.status === "TẠM DỪNG").length,
    };
  }, [rescuers]);

  // Lọc danh sách đội hiển thị
  const filteredRescuers = useMemo(() => {
    return rescuers.filter((team) => {
      const profile = team.rescuer_profile || {};
      const unitName = (profile.unit_name || "").toLowerCase();
      const leaderName = (team.full_name || "").toLowerCase();
      const phone = (team.phone || "").toLowerCase();
      const assignedZone = (team.computed.assignedZoneName || "").toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchSearch =
        !q ||
        unitName.includes(q) ||
        leaderName.includes(q) ||
        phone.includes(q) ||
        assignedZone.includes(q);

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "READY" && team.computed.status === "SẴN SÀNG") ||
        (statusFilter === "MOVING" && team.computed.status === "ĐANG DI CHUYỂN") ||
        (statusFilter === "RESCUING" && team.computed.status === "ĐANG CỨU HỘ") ||
        (statusFilter === "NEEDS_HELP" && team.computed.status === "CẦN HỖ TRỢ") ||
        (statusFilter === "OFF_DUTY" && (team.computed.status === "NGHỈ CA" || team.computed.status === "TẠM DỪNG"));

      const matchSpecialty =
        specialtyFilter === "ALL" || profile.specialty === specialtyFilter;

      return matchSearch && matchStatus && matchSpecialty;
    });
  }, [rescuers, searchQuery, statusFilter, specialtyFilter]);

  const activeAnomalies = useMemo(() => {
    return anomalies.filter((a) => !dismissedAnomalyIds.has(a.id));
  }, [anomalies, dismissedAnomalyIds]);

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar Navigation */}
      <div
        className={`fixed lg:relative z-40 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <SliderBar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#F8FAFC] flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-8">
          <DataNotice loading={loading} error={loadError} onRetry={() => fetchRescuers(true)} hasData={rescuers.length > 0 || zones.length > 0} />
          {/* Header Action Bar */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 pb-2 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                  Theo dõi Đội cứu trợ
                </h1>
                <span className="bg-blue-100 text-blue-700 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Live GPS
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                Giám sát thực địa, phát hiện bất thường tác chiến và điều phối lực lượng cứu hộ thời gian thực.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm mr-auto xl:mr-0">
                <Clock size={14} className="text-slate-400" />
                <span>Cập nhật: {lastUpdated.toLocaleTimeString("vi-VN")}</span>
                <button
                  onClick={() => fetchRescuers(true)}
                  disabled={isRefreshing}
                  title="Làm mới ngay"
                  className="ml-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                </button>
              </div>

              <button
                onClick={() => setShowFilterBar(!showFilterBar)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition border ${
                  showFilterBar
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Filter size={15} />
                LỌC ĐỘI {statusFilter !== "ALL" || specialtyFilter !== "ALL" ? "(1+)" : ""}
              </button>

              <button
                onClick={() => navigate("/notification-broadcast")}
                className="flex items-center gap-2 bg-[#DC2626] hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-red-600/20 transition"
              >
                <Radio size={16} />
                THÔNG BÁO KHẨN
              </button>

              <button
                onClick={() => setShowAIAssignment(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 transition"
              >
                <Zap size={16} />
                ĐIỀU PHỐI AI
              </button>
            </div>
          </div>

          {/* ── KPI Thống kê Quân số (Đưa lên đầu trang) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                TỔNG QUÂN SỐ
              </span>
              <p className="text-2xl font-black text-slate-900">{counts.total} <span className="text-xs text-slate-400 font-medium">Đội</span></p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-green-200 shadow-sm bg-green-50/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-green-700 uppercase tracking-wider">
                  SẴN SÀNG / RẢNH
                </span>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              </div>
              <p className="text-2xl font-black text-green-700">{counts.ready} <span className="text-xs text-green-600/70 font-medium">Đội</span></p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm bg-blue-50/30">
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                ĐANG DI CHUYỂN
              </span>
              <p className="text-2xl font-black text-blue-700">{counts.moving} <span className="text-xs text-blue-600/70 font-medium">Đội</span></p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm bg-amber-50/30">
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider block mb-1">
                ĐANG CỨU HỘ
              </span>
              <p className="text-2xl font-black text-amber-700">{counts.rescuing} <span className="text-xs text-amber-600/70 font-medium">Đội</span></p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm bg-red-50/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-red-700 uppercase tracking-wider">
                  CẦN HỖ TRỢ GẤP
                </span>
                {counts.needsHelp > 0 && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>}
              </div>
              <p className="text-2xl font-black text-red-700">{counts.needsHelp} <span className="text-xs text-red-600/70 font-medium">Đội</span></p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                TẠM DỪNG / NGHỈ
              </span>
              <p className="text-2xl font-black text-slate-600">{counts.offDuty} <span className="text-xs text-slate-400 font-medium">Đội</span></p>
            </div>
          </div>

          {/* ── Thanh bộ lọc mở rộng (Khi ấn nút LỌC ĐỘI) ── */}
          {showFilterBar && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex-1 min-w-[240px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Tìm kiếm đội
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên đội, đội trưởng, SĐT, vùng..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full sm:w-auto min-w-[180px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Trạng thái
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="READY">🟢 Sẵn sàng / Rảnh</option>
                  <option value="MOVING">🔵 Đang di chuyển</option>
                  <option value="RESCUING">🟠 Đang cứu hộ</option>
                  <option value="NEEDS_HELP">🔴 Cần hỗ trợ khẩn</option>
                  <option value="OFF_DUTY">⚫ Tạm dừng / Nghỉ ca</option>
                </select>
              </div>

              <div className="w-full sm:w-auto min-w-[180px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Chuyên môn
                </label>
                <select
                  value={specialtyFilter}
                  onChange={(e) => setSpecialtyFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả chuyên môn</option>
                  <option value="SEARCH_RESCUE">🛟 Tìm kiếm & Cứu nạn</option>
                  <option value="MEDICAL">🚑 Y tế cấp cứu</option>
                  <option value="LOGISTICS">📦 Hậu cần & Tiếp tế</option>
                  <option value="COMMAND">🛡️ Chỉ huy tác chiến</option>
                </select>
              </div>

              {(searchQuery || statusFilter !== "ALL" || specialtyFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setSpecialtyFilter("ALL");
                  }}
                  className="mt-auto px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition"
                >
                  Đặt lại lọc
                </button>
              )}
            </div>
          )}

          {/* ── KHU VỰC BẢN ĐỒ TÁC CHIẾN & CẢNH BÁO ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Bản đồ định vị GPS */}
            <div
              className={`bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all duration-300 ${
                mapExpanded ? "lg:col-span-3 h-[700px]" : "lg:col-span-2 h-[560px]"
              }`}
            >
              {/* Header điều khiển bản đồ */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div>
                  <h2 className="font-black text-slate-800 text-sm uppercase tracking-wide">
                    Bản đồ Vị trí trực tiếp
                  </h2>
                  <span className="text-xs text-slate-400">
                    ({rescuers.filter((r) => r.computed.hasGps).length}/{rescuers.length} đội phát GPS)
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
                  {/* Ô tìm kiếm địa điểm bản đồ */}
                  <form onSubmit={handleSearchMap} className="flex flex-1 max-w-xs">
                    <input
                      type="text"
                      placeholder="Tìm địa điểm (Đà Nẵng, Huế...)..."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-l-xl text-xs outline-none focus:border-blue-500"
                      value={searchMapQuery}
                      onChange={(e) => setSearchMapQuery(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={searchMapLoading}
                      className="bg-slate-800 text-white px-3 py-1.5 rounded-r-xl text-xs font-bold hover:bg-slate-900 disabled:opacity-50"
                    >
                      {searchMapLoading ? "..." : "TÌM"}
                    </button>
                  </form>

                  {/* Nút FitBounds */}
                  <button
                    onClick={handleFitBoundsAll}
                    title="Căn bản đồ bao quát tất cả lực lượng"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Crosshair size={15} />
                    <span className="hidden sm:inline">Bao quát</span>
                  </button>

                  {/* Nút Mở rộng bản đồ */}
                  <button
                    onClick={() => setMapExpanded(!mapExpanded)}
                    title={mapExpanded ? "Thu gọn bản đồ" : "Mở rộng bản đồ"}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shrink-0"
                  >
                    {mapExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                </div>
              </div>

              {/* Khung bản đồ Leaflet */}
              <div className="flex-1 w-full relative">
                <MapContainer
                  center={mapCenter || [16.0544, 108.2022]}
                  zoom={mapZoom}
                  style={{ height: "100%", width: "100%", position: "absolute", inset: 0 }}
                >
                  <MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Vòng tròn các Vùng sự cố (Zones) */}
                  {zones.map((z) => {
                    const lat = parseFloat(z.location_lat);
                    const lng = parseFloat(z.location_lng);
                    if (isNaN(lat) || isNaN(lng)) return null;

                    const isCritical = z.severity === "CRITICAL";
                    const strokeColor = isCritical ? "#DC2626" : z.status === "ACTIVE" ? "#EA580C" : "#2563EB";

                    return (
                      <Circle
                        key={`zone-${z.id}`}
                        center={[lat, lng]}
                        radius={2500} // Bán kính 2.5km
                        pathOptions={{
                          color: strokeColor,
                          fillColor: strokeColor,
                          fillOpacity: 0.12,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="p-1 max-w-[220px]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Khu vực sự cố
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm mt-0.5">{z.name}</h4>
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <span className={`px-2 py-0.5 rounded font-bold ${isCritical ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                                {z.severity}
                              </span>
                              <span className="text-slate-600">Nạn nhân: <b>{z.people_affected || 0}</b></span>
                            </div>
                          </div>
                        </Popup>
                      </Circle>
                    );
                  })}

                  {/* Marker Tín hiệu SOS */}
                  {sosSignals.map((sos) => {
                    const sLat = parseFloat(sos.location_lat);
                    const sLng = parseFloat(sos.location_lng);
                    if (isNaN(sLat) || isNaN(sLng)) return null;

                    return (
                      <Marker
                        key={`sos-${sos.id}`}
                        position={[sLat, sLng]}
                        icon={createSosDivIcon()}
                      >
                        <Popup>
                          <div className="p-1 max-w-[240px]">
                            <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs uppercase mb-1">
                              <Flame size={14} /> Tín hiệu SOS
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm">
                              {sos.emergency_type || "Cứu nạn khẩn cấp"}
                            </h4>
                            <p className="text-xs text-slate-600 mt-1">
                              Người gửi: <b>{sos.citizen_name || "Người dân"}</b> ({sos.phone_number || "Không có SĐT"})
                            </p>
                            <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-1.5 rounded">
                              {sos.note || "Không có ghi chú thêm."}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {/* Marker Các Đội cứu hộ */}
                  {rescuers.map((team) => {
                    if (!team.computed.hasGps || !team.computed.lat || !team.computed.lng) return null;
                    const profile = team.rescuer_profile || {};

                    return (
                      <Marker
                        key={`team-${team.id}`}
                        position={[team.computed.lat, team.computed.lng]}
                        icon={createRescuerDivIcon(
                          team.computed.status,
                          profile.specialty,
                          profile.unit_name || team.full_name
                        )}
                      >
                        <Popup>
                          <div className="p-2 min-w-[240px]">
                            <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
                              <div>
                                <h3 className="font-black text-slate-900 text-sm">
                                  {profile.unit_name || team.full_name}
                                </h3>
                                <p className="text-xs text-slate-500">
                                  Chỉ huy: {team.full_name}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  team.computed.status === "CẦN HỖ TRỢ"
                                    ? "bg-red-100 text-red-700"
                                    : team.computed.status === "ĐANG CỨU HỘ"
                                    ? "bg-amber-100 text-amber-700"
                                    : team.computed.status === "ĐANG DI CHUYỂN"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {team.computed.status}
                              </span>
                            </div>

                            <div className="space-y-1 text-xs text-slate-600">
                              <p>
                                🎯 Chuyên môn: <b>{SPECIALTY_LABELS[profile.specialty] || "Cứu hộ tổng hợp"}</b>
                              </p>
                              <p>
                                📍 Vùng phụ trách: <b>{team.computed.assignedZoneName ? `Vùng ${team.computed.assignedZoneName}` : "Chưa có"}</b>
                              </p>
                              <p>
                                📞 Số điện thoại: <b>{team.phone || "Chưa cập nhật"}</b>
                              </p>
                              {team.computed.anomalies?.length > 0 && (
                                <p className="text-red-600 font-bold bg-red-50 p-1.5 rounded mt-2">
                                  ⚠️ {team.computed.anomalies.join(", ")}
                                </p>
                              )}
                            </div>

                            {/* Nút thao tác từ popup */}
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => setSelectedDetailTeam(team)}
                                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                              >
                                <Eye size={13} />
                                <span>Chi tiết đội</span>
                              </button>
                              {team.computed.status === "SẴN SÀNG" && (
                                <button
                                  onClick={() => setAssigningTeam(team)}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                >
                                  <UserPlus size={13} />
                                  <span>Giao việc</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {/* Chú giải trạng thái trên bản đồ - đặt trong MapContainer để popup (z-1000) đè lên trên */}
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute bottom-4 left-4 z-[450] bg-white/95 backdrop-blur-sm p-3 rounded-2xl border border-slate-200 shadow-lg text-[11px] font-semibold space-y-1.5 pointer-events-auto"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-600"></span>
                      <span>Sẵn sàng / Rảnh</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                      <span>Đang di chuyển</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-600"></span>
                      <span>Đang cứu hộ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></span>
                      <span>Cần hỗ trợ khẩn / SOS</span>
                    </div>
                  </div>
                </MapContainer>
              </div>
            </div>

            {/* Cột Cảnh báo Tác chiến & Gợi ý Điều phối */}
            {!mapExpanded && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[560px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" size={20} />
                    Cảnh báo & Điều phối
                  </h2>
                  <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {activeAnomalies.length} cảnh báo
                  </span>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  {/* Bất thường GPS / Tác chiến */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Bất thường phát hiện
                    </p>
                    {activeAnomalies.length > 0 ? (
                      <div className="space-y-2.5">
                        {activeAnomalies.map((a) => (
                          <div
                            key={a.id}
                            className={`p-3.5 rounded-2xl border transition relative ${
                              a.type === "danger"
                                ? "bg-red-50/80 border-red-200 text-red-900"
                                : "bg-amber-50/80 border-amber-200 text-amber-900"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-black uppercase tracking-wide">
                                {a.title}
                              </span>
                              <button
                                onClick={() => handleDismissAnomaly(a.id)}
                                title="Đã xử lý / Bỏ qua cảnh báo"
                                className="text-slate-400 hover:text-slate-700 p-0.5"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <p className="text-xs mt-1 font-medium leading-relaxed opacity-90">
                              {a.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                        <CheckCircle2 size={24} className="text-green-500 mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-slate-600">
                          Không có bất thường tác chiến nào.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Gợi ý cân bằng nguồn lực */}
                  <div className="pt-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Gợi ý phân bổ lực lượng
                    </p>
                    {suggestions.length > 0 ? (
                      <div className="space-y-2.5">
                        {suggestions.map((s) => (
                          <div
                            key={s.id}
                            className={`p-3.5 rounded-2xl border ${
                              s.type === "danger"
                                ? "bg-red-50/60 border-red-200 text-red-900"
                                : "bg-blue-50/60 border-blue-200 text-blue-900"
                            }`}
                          >
                            <span className="text-xs font-black uppercase tracking-wide block">
                              {s.title}
                            </span>
                            <p className="text-xs mt-1 font-medium leading-relaxed opacity-90">
                              {s.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                        <p className="text-xs text-slate-500 italic">
                          Nguồn lực tại các vùng đang được cân đối tốt.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowAIAssignment(true)}
                  className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Zap size={16} className="text-amber-400" />
                  Mở Tự động Điều phối AI
                </button>
              </div>
            )}
          </div>

          {/* ── DANH SÁCH CÁC ĐỘI CỨU TRỢ ── */}
          <div className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Danh sách Lực lượng Cứu trợ
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hiển thị {filteredRescuers.length} / {rescuers.length} đội theo bộ lọc
                </p>
              </div>
            </div>

            {loading ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
                <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-600">Đang tải dữ liệu lực lượng cứu trợ...</p>
              </div>
            ) : filteredRescuers.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
                <Users size={36} className="text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">Không tìm thấy đội cứu trợ nào</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Hãy thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRescuers.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onLocate={() => handleLocateTeam(team)}
                    onQuickAssign={() => setAssigningTeam(team)}
                    onViewDetail={() => setSelectedDetailTeam(team)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL GIAO NHIỆM VỤ TRỰC TIẾP ── */}
      {assigningTeam && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Giao nhiệm vụ Cứu hộ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân công cho: <b>{assigningTeam.rescuer_profile?.unit_name || assigningTeam.full_name}</b>
                </p>
              </div>
              <button
                onClick={() => setAssigningTeam(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickAssignSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Chọn Vùng sự cố mục tiêu *
                </label>
                <select
                  required
                  value={assignZoneId}
                  onChange={(e) => setAssignZoneId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:border-blue-600 bg-white"
                >
                  <option value="">-- Chọn khu vực cần cứu trợ --</option>
                  {zones
                    .filter((z) => z.status === "ACTIVE")
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.severity} - {z.people_affected || 0} nạn nhân)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Ghi chú & Mệnh lệnh chỉ huy
                </label>
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Ghi chú chi tiết mục tiêu, điểm tập kết hoặc lưu ý an toàn..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningTeam(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
                >
                  {submittingAssign ? "Đang giao..." : "Xác nhận Giao việc"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL AI TỰ ĐỘNG ĐIỀU PHỐI ── */}
      {showAIAssignment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col relative shadow-2xl">
            <div className="absolute top-0 left-0 w-full flex justify-end p-4 z-10 pointer-events-none">
              <button
                onClick={() => setShowAIAssignment(false)}
                className="w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-700 pointer-events-auto transition"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <AIAssignment
                isModal={true}
                onAssigned={() => {
                  fetchRescuers();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CHI TIẾT ĐỘI CỨU HỘ ── */}
      <TeamDetailModal
        isOpen={Boolean(selectedDetailTeam)}
        team={selectedDetailTeam}
        onClose={() => setSelectedDetailTeam(null)}
        onLocate={(t) => {
          handleLocateTeam(t || selectedDetailTeam);
          setSelectedDetailTeam(null);
        }}
        onAssign={(t) => {
          setAssigningTeam(t || selectedDetailTeam);
          setSelectedDetailTeam(null);
        }}
      />
    </div>
  );
}

// ── COMPONENT THẺ TỪNG ĐỘI CỨU TRỢ (TeamCard) ─────────────────────────
interface TeamCardProps {
  team: any;
  onLocate: () => void;
  onQuickAssign: () => void;
  onViewDetail: () => void;
}

function TeamCard({ team, onLocate, onQuickAssign, onViewDetail }: TeamCardProps) {
  const navigate = useNavigate();
  const profile = team.rescuer_profile || {};
  const computed = team.computed || {};

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const resp = await api.missions.getHistory(team.id);
      const data = resp?.data ?? resp;
      setHistory(data.results || []);
    } catch (err) {
      console.error("Lỗi lấy lịch sử cứu hộ:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistory = () => {
    setShowHistory(true);
    fetchHistory();
  };

  const handleCopyPhone = () => {
    if (!team.phone) return;
    navigator.clipboard.writeText(team.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const isNeedsHelp = computed.status === "CẦN HỖ TRỢ";

  return (
    <>
      <div
        className={`bg-white rounded-2xl shadow-sm border p-5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 transition-all hover:shadow-md ${
          isNeedsHelp
            ? "border-red-400 bg-red-50/20 shadow-red-100 ring-2 ring-red-400/30"
            : computed.anomalies?.length > 0
            ? "border-amber-300 bg-amber-50/10"
            : "border-slate-200"
        }`}
      >
        {/* Nhóm thông tin cốt lõi */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
          {/* Đơn vị & Tên */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                  computed.status === "CẦN HỖ TRỢ"
                    ? "bg-red-600 text-white animate-pulse"
                    : computed.status === "ĐANG CỨU HỘ"
                    ? "bg-amber-100 text-amber-800"
                    : computed.status === "ĐANG DI CHUYỂN"
                    ? "bg-blue-100 text-blue-800"
                    : computed.status === "SẴN SÀNG"
                    ? "bg-green-100 text-green-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {computed.status}
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {SPECIALTY_LABELS[profile.specialty] || profile.specialty || "Cứu hộ"}
              </span>
            </div>

            <h3
              onClick={onViewDetail}
              className="text-base font-black text-slate-900 leading-snug cursor-pointer hover:text-blue-600 transition flex items-center gap-1.5 group"
              title="Nhấp để xem chi tiết đội cứu hộ"
            >
              <span>{profile.unit_name || team.full_name}</span>
              <Eye size={14} className="opacity-0 group-hover:opacity-100 text-blue-600 transition shrink-0" />
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>Đội trưởng: <b>{team.full_name}</b></span>
              {team.phone && (
                <button
                  onClick={handleCopyPhone}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 text-xs font-semibold"
                  title="Sao chép số điện thoại"
                >
                  <Phone size={12} />
                  <span>{team.phone}</span>
                  {copiedPhone && <span className="text-[10px] text-green-600 font-bold">Đã sao chép</span>}
                </button>
              )}
            </p>
          </div>

          {/* Vùng phụ trách */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
              VÙNG PHỤ TRÁCH
            </span>
            <p className="text-sm font-bold text-slate-800">
              {computed.assignedZoneName ? `Vùng ${computed.assignedZoneName}` : <span className="text-slate-400 italic">Chưa giao việc</span>}
            </p>
            {computed.currentZone && (
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Có mặt tại: <b>{computed.currentZone.name}</b>
              </span>
            )}
          </div>

          {/* Tọa độ GPS */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
              TÍN HIỆU GPS
            </span>
            {computed.hasGps ? (
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>{computed.lat.toFixed(4)}, {computed.lng.toFixed(4)}</span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                Chưa có GPS
              </span>
            )}
          </div>

          {/* Cấp bậc & Cảnh báo */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
              CẤP BẬC / TRỰC
            </span>
            <p className="text-xs font-bold text-slate-700">
              {profile.rank || "Hạng 1"} • {profile.is_on_duty ? "Đang trực ca" : "Nghỉ ca"}
            </p>
            {computed.anomalies?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {computed.anomalies.map((anom: string, i: number) => (
                  <span key={i} className="text-[10px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                    ⚠️ {anom}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nút hành động thao tác nhanh */}
        <div className="flex items-center gap-2 shrink-0 w-full xl:w-auto justify-end border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-100">
          <button
            onClick={onViewDetail}
            title="Xem chi tiết hồ sơ & năng lực đội"
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
          >
            <Eye size={14} />
            <span>Chi tiết</span>
          </button>

          {computed.hasGps && (
            <button
              onClick={onLocate}
              title="Xem vị trí trên bản đồ"
              className="flex items-center gap-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition"
            >
              <Navigation size={14} />
              <span>Định vị</span>
            </button>
          )}

          {computed.status === "SẴN SÀNG" && (
            <button
              onClick={onQuickAssign}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <UserPlus size={14} />
              <span>Giao việc</span>
            </button>
          )}

          <button
            onClick={handleOpenHistory}
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            <Clock size={14} />
            <span>Lịch sử</span>
          </button>
        </div>
      </div>

      {/* ── MODAL LỊCH SỬ NHIỆM VỤ CỦA ĐỘI ── */}
      {showHistory && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Lịch sử Nhiệm vụ Tác chiến
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đội: <b>{profile.unit_name || team.full_name}</b> ({team.phone || "Không SĐT"})
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center">
                <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Đang tải lịch sử nhiệm vụ...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl">
                <Shield size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Chưa có lịch sử nhiệm vụ nào</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đội chưa được phân công hoặc chưa hoàn thành nhiệm vụ nào.
                </p>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="p-3.5">Khu vực</th>
                      <th className="p-3.5">Vai trò</th>
                      <th className="p-3.5">Trạng thái</th>
                      <th className="p-3.5">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {history.map((item: any, idx: number) => {
                      const isComplete = item.status === "COMPLETED";
                      const isCancelled = item.status === "CANCELLED";

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-3.5 font-bold">
                            {(() => {
                              const zoneId = typeof item.zone === "object" ? item.zone?.id : item.zone;
                              return zoneId ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/details-rescue-zone/${zoneId}`)}
                                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline font-bold text-left transition cursor-pointer group"
                                  title="Xem chi tiết khu vực cứu hộ này"
                                >
                                  <span>Vùng {item.zone_name || item.zone || "N/A"}</span>
                                  <ExternalLink size={12} className="opacity-70 group-hover:opacity-100 transition shrink-0" />
                                </button>
                              ) : (
                                <span className="text-slate-900">Vùng {item.zone_name || item.zone || "N/A"}</span>
                              );
                            })()}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {item.role || "Cứu hộ"}
                          </td>
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
                              {item.status || "ĐANG XỬ LÝ"}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-500">
                            {item.completed_at
                              ? new Date(item.completed_at).toLocaleString("vi-VN")
                              : item.joined_at
                              ? `Bắt đầu: ${new Date(item.joined_at).toLocaleDateString("vi-VN")}`
                              : "N/A"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowHistory(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
