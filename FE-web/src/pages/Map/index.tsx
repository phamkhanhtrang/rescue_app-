import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import SOSDetailModal from "../../components/SOSDetailModal";
import TeamDetailModal from "../../components/TeamDetailModal";
import FieldReportDetailModal from "../../components/FieldReportDetailModal";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  Tooltip,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { api } from "../../services/api";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";
import {
  Phone,
  MapPin,
  Users,
  Radio,
  Eye,
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
  Droplets,
  Info,
  Map as MapIcon,
  MessageSquare,
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

// Map tile styles
const MAP_TILES: Record<
  "streets" | "satellite" | "clean",
  { label: string; url: string; subdomains?: string[]; attribution: string }
> = {
  streets: {
    label: "🗺️ Đường phố",
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
  },
  satellite: {
    label: "🛰️ Vệ tinh",
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: '&copy; <a href="https://maps.google.com">Google Satellite</a>',
  },
  clean: {
    label: "🏢 Nền sáng rõ",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: ["a", "b", "c", "d"],
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
};

// Custom Controller for flyTo, FitBounds & Zoom tracking
function MapController({
  center,
  zoom,
  fitBoundsData,
  onZoomChange,
}: {
  center: [number, number] | null;
  zoom?: number;
  fitBoundsData?: [number, number][] | null;
  onZoomChange: (z: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 15, { duration: 1.0 });
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

// ============================================================================
// THUẬT TOÁN TÁCH ĐIỂM TRÙNG / GẦN NHAU (SPIDERFY / RADIAL DE-COLLISION)
// Giúp các icon SOS, Điểm ngập, Đội cứu hộ không bao giờ đè chồng lên nhau
// ============================================================================
interface PositionedPoint<T> {
  item: T;
  origCoords: [number, number];
  displayCoords: [number, number];
  isOffset: boolean;
}

function decollidePoints<T>(
  items: { id: string; kind: string; coords: [number, number]; raw: T }[],
  zoom: number
): Map<string, PositionedPoint<T>> {
  const result = new Map<string, PositionedPoint<T>>();
  // Khoảng cách tối thiểu (độ vĩ/kinh) tùy theo mức zoom để 2 pin 28px không chạm nhau
  const thresholdDeg =
    zoom >= 17
      ? 0.00014
      : zoom === 16
      ? 0.00026
      : zoom === 15
      ? 0.00048
      : zoom === 14
      ? 0.00085
      : 0.0016;

  const groups: { centerLat: number; centerLng: number; members: typeof items }[] = [];

  items.forEach((pt) => {
    let foundGroup = null;
    for (const g of groups) {
      const dLat = Math.abs(pt.coords[0] - g.centerLat);
      const dLng = Math.abs(pt.coords[1] - g.centerLng);
      if (Math.hypot(dLat, dLng) < thresholdDeg) {
        foundGroup = g;
        break;
      }
    }
    if (foundGroup) {
      foundGroup.members.push(pt);
    } else {
      groups.push({
        centerLat: pt.coords[0],
        centerLng: pt.coords[1],
        members: [pt],
      });
    }
  });

  groups.forEach((g) => {
    const count = g.members.length;
    if (count === 1) {
      const m = g.members[0];
      result.set(`${m.kind}:${m.id}`, {
        item: m.raw,
        origCoords: m.coords,
        displayCoords: m.coords,
        isOffset: false,
      });
      return;
    }

    // Xếp thành vòng tròn đều xung quanh tâm để tách biệt hoàn toàn
    const radius = thresholdDeg * (count <= 4 ? 0.72 : count <= 8 ? 0.95 : 1.25);
    g.members.forEach((m, idx) => {
      const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
      const latOffset = radius * Math.sin(angle);
      const lngOffset = radius * Math.cos(angle);
      result.set(`${m.kind}:${m.id}`, {
        item: m.raw,
        origCoords: m.coords,
        displayCoords: [g.centerLat + latOffset, g.centerLng + lngOffset],
        isOffset: true,
      });
    });
  });

  return result;
}

// ============================================================================
// COMPACT ICONS (28px - Không dùng nhãn chữ dài cố định trên mặt bản đồ)
// ============================================================================

// 1. SOS Icon (Gọn 28px, không có nhãn phụ thò ra ngoài)
const createSosDivIcon = (verificationStatus?: string) => {
  let bg = "#DC2626"; // Đỏ: Chưa xác minh
  let label = "SOS";
  let isPulse = true;

  if (verificationStatus === "CHECKING") {
    bg = "#2563EB"; // Xanh dương: Đang gọi
    label = "📞";
  } else if (verificationStatus === "VERIFIED") {
    bg = "#059669"; // Xanh lá: Đã xác minh
    label = "✓";
    isPulse = false;
  }

  return L.divIcon({
    className: "custom-leaflet-div-icon",
    html: `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        ${
          isPulse
            ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${bg}; opacity: 0.4;" class="animate-ping"></span>`
            : ""
        }
        <div style="width: 24px; height: 24px; border-radius: 7px; transform: rotate(45deg); background-color: ${bg}; border: 2px solid #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.35); cursor: pointer;">
          <span style="transform: rotate(-45deg); color: #FFFFFF; font-size: 9px; font-weight: 900; line-height: 1;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

// 2. SOS Cluster Icon (Khi thu nhỏ bản đồ zoom <= 13, gom nhóm SOS gần nhau)
const createSosClusterIcon = (count: number, hasUnverified: boolean) => {
  const bg = hasUnverified ? "#DC2626" : "#059669";
  return L.divIcon({
    className: "custom-leaflet-div-icon",
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${bg}; border: 2.5px solid #FFFFFF; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 11px; font-weight: 900; box-shadow: 0 3px 10px rgba(0,0,0,0.4); cursor: pointer;">
          🆘${count}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -16],
  });
};

// 3. Rescuer Icon (Gọn 28px)
const createRescuerDivIcon = (isOnDuty: boolean) => {
  const bg = isOnDuty ? "#1D4ED8" : "#64748B";
  return L.divIcon({
    className: "custom-leaflet-div-icon",
    html: `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 26px; height: 26px; border-radius: 50%; background-color: ${bg}; border: 2px solid #FFFFFF; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 13px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;">
          🚑
        </div>
        ${
          isOnDuty
            ? '<span style="position: absolute; top: 0px; right: 0px; width: 8px; height: 8px; border-radius: 50%; background-color: #22C55E; border: 1.5px solid #FFFFFF;"></span>'
            : ""
        }
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

// 4. Citizen Field Report Icon (Tròn 28px chỉ chứa Icon sự cố — không dùng thanh chữ dài gây đè)
const HAZARD_ICON_MAP: Record<string, string> = {
  FLOOD: "🌊",
  FALLEN_TREE: "🌲",
  LANDSLIDE: "⛰️",
  POWER_LINE: "⚡",
  ROAD_BLOCKED: "🚧",
};

const createFieldReportDivIcon = (rep: any) => {
  const emoji = HAZARD_ICON_MAP[rep.hazard_type] || "⚠️";
  let bg = "#EA580C"; // PENDING cam
  let border = "#FFFFFF";
  if (rep.status === "VERIFIED") {
    bg = "#DC2626"; // Đã xác thực đỏ
  } else if (rep.status === "RECEDING") {
    bg = "#D97706"; // Nước đang rút vàng
    border = "#FEF08A";
  } else if (rep.status === "CLEARED") {
    bg = "#16A34A"; // Đã thông xanh
  }

  return L.divIcon({
    className: "custom-leaflet-div-icon",
    html: `
      <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 26px; height: 26px; border-radius: 50%; background-color: ${bg}; border: 2px solid ${border}; display: flex; align-items: center; justify-content: center; font-size: 13px; box-shadow: 0 2px 6px rgba(0,0,0,0.35); cursor: pointer;">
          ${emoji}
        </div>
        ${
          rep.is_verified && rep.status !== "CLEARED"
            ? '<span style="position: absolute; bottom: -1px; right: -1px; width: 11px; height: 11px; border-radius: 50%; background-color: #DC2626; color: #FFF; font-size: 8px; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 1.5px solid #FFF;">✓</span>'
            : ""
        }
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
};

const SEVERITY_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  CRITICAL: { color: "#DC2626", label: "Nguy cấp", bg: "bg-red-100 text-red-700" },
  HIGH: { color: "#EA580C", label: "Mức cao", bg: "bg-orange-100 text-orange-700" },
  MEDIUM: { color: "#D97706", label: "Trung bình", bg: "bg-amber-100 text-amber-700" },
  LOW: { color: "#16A34A", label: "Mức thấp", bg: "bg-green-100 text-green-700" },
};

const ACTIVE_MISSION_STATUSES = new Set([
  "PENDING_ACCEPTANCE",
  "ACCEPTED",
  "ACTIVE",
  "ON_MY_WAY",
  "NEEDS_HELP",
]);

export default function AdminMapPage() {
  const navigate = useNavigate();
  const [tacticalOpen, setTacticalOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite" | "clean">("streets");
  const [currentZoom, setCurrentZoom] = useState<number>(12);

  // Data states
  const [zones, setZones] = useState<any[]>([]);
  const [rescuers, setRescuers] = useState<any[]>([]);
  const [sosSignals, setSosSignals] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [fieldReports, setFieldReports] = useState<any[]>([]);
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

  // Search & Layer Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showRescuers, setShowRescuers] = useState(true);
  const [showSos, setShowSos] = useState(true);
  const [showFieldReports, setShowFieldReports] = useState(true);
  const [severityFilter] = useState<string>("ALL");
  const [sosStatusFilter, setSosStatusFilter] = useState<string>("ALL");
  const [fieldReportStatusFilter, setFieldReportStatusFilter] = useState<string>("ACTIVE");

  // Tactical sidebar tab
  const [activeTab, setActiveTab] = useState<"sos" | "reports" | "teams" | "zones">("sos");

  // Modals
  const [selectedSosId, setSelectedSosId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Fetch all map data
  const fetchData = useCallback(async () => {
    if (requestInFlight.current) {
      refreshQueued.current = true;
      return;
    }
    requestInFlight.current = true;
    if (!lastUpdated) setLoading(true);
    try {
      const requests = [
        api.zones.getAll(),
        api.rescuers.getAll(),
        api.sos.getAll(),
        api.missions.getAll(),
        api.fieldReports.getAll(),
      ];
      const labels = ["vùng", "đội cứu hộ", "SOS", "nhiệm vụ", "báo cáo hiện trường"];
      const failures = new Map<number, string>();
      await Promise.all(
        requests.map(async (request, index) => {
          try {
            const response = await request;
            const rows = response?.data?.results || response?.data || [];
            if (!Array.isArray(rows)) throw new Error("Dữ liệu không đúng định dạng");
            if (!mounted.current) return;
            if (index === 0) setZones(rows.filter((z: any) => z.status !== "RESOLVED"));
            if (index === 1) setRescuers(rows.filter((team: any) => team.is_active));
            if (index === 2)
              setSosSignals(
                rows.filter((s: any) => s.status !== "RESOLVED" && s.status !== "CANCELLED")
              );
            if (index === 3) setMissions(rows);
            if (index === 4) setFieldReports(rows);
            setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
          } catch (error) {
            failures.set(index, `${labels[index]}: ${apiErrorMessage(error)}`);
          }
          if (mounted.current) {
            setLoadError(
              failures.size ? `Không cập nhật được ${[...failures.values()].join("; ")}.` : ""
            );
          }
        })
      );
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
  }, [lastUpdated]);

  useEffect(() => {
    mounted.current = true;
    void fetchData();
    return () => {
      mounted.current = false;
    };
  }, [fetchData]);

  // Polling auto-refresh every 25s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!document.hidden) void fetchData();
    }, 25000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Active mission zone IDs
  const activeMissionZoneIds = useMemo(() => {
    const ids = new Set<string>();
    missions.forEach((m: any) => {
      if (ACTIVE_MISSION_STATUSES.has(m.status) && m.zone) {
        ids.add(String(m.zone));
      }
    });
    return ids;
  }, [missions]);

  // Coordinate helpers
  const getZoneCoords = (z: any): [number, number] | null => {
    const lat = Number(z.location_lat);
    const lng = Number(z.location_lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      lat !== 0
    ) {
      return [lat, lng];
    }
    return null;
  };

  const getSosCoords = (s: any): [number, number] | null => {
    const lat = Number(s.location_lat);
    const lng = Number(s.location_lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      lat !== 0
    ) {
      return [lat, lng];
    }
    return null;
  };

  const getRescuerCoords = (r: any): [number, number] | null => {
    const lat = Number(r.rescuer_profile?.current_lat ?? r.current_lat);
    const lng = Number(r.rescuer_profile?.current_lng ?? r.current_lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      lat !== 0
    ) {
      return [lat, lng];
    }
    return null;
  };

  const getReportCoords = (rep: any): [number, number] | null => {
    if (Array.isArray(rep?.road_geometry) && rep.road_geometry.length >= 2) {
      const mid = rep.road_geometry[Math.floor(rep.road_geometry.length / 2)];
      if (Array.isArray(mid) && mid.length >= 2) {
        const mLat = Number(mid[0]);
        const mLng = Number(mid[1]);
        if (
          Number.isFinite(mLat) &&
          Number.isFinite(mLng) &&
          Math.abs(mLat) <= 90 &&
          Math.abs(mLng) <= 180 &&
          mLat !== 0
        ) {
          return [mLat, mLng];
        }
      }
    }
    const lat = Number(rep.location_lat);
    const lng = Number(rep.location_lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      lat !== 0
    ) {
      return [lat, lng];
    }
    return null;
  };

  // Filtered lists
  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      if (severityFilter !== "ALL" && z.severity !== severityFilter) return false;
      return true;
    });
  }, [zones, severityFilter]);

  const filteredSos = useMemo(() => {
    return sosSignals.filter((s) => {
      if (sosStatusFilter === "UNVERIFIED") {
        return s.verification_status === "UNVERIFIED" || !s.verification_status;
      }
      if (sosStatusFilter === "CHECKING") {
        return s.verification_status === "CHECKING";
      }
      if (sosStatusFilter === "VERIFIED") {
        return s.verification_status === "VERIFIED";
      }
      return true;
    });
  }, [sosSignals, sosStatusFilter]);

  const filteredFieldReports = useMemo(() => {
    return fieldReports.filter((rep) => {
      if (fieldReportStatusFilter === "ACTIVE") {
        return ["PENDING", "VERIFIED", "RECEDING"].includes(rep.status);
      }
      if (fieldReportStatusFilter === "DANGER") {
        return ["PENDING", "VERIFIED"].includes(rep.status);
      }
      if (fieldReportStatusFilter === "RECEDING") {
        return rep.status === "RECEDING";
      }
      if (fieldReportStatusFilter === "CLEARED") {
        return rep.status === "CLEARED";
      }
      return true;
    });
  }, [fieldReports, fieldReportStatusFilter]);

  // ==========================================================================
  // GOM CỤM SOS KHI THU NHỎ (ZOOM <= 13) & TÁCH ĐIỂM TRÙNG KHI PHÓNG TO
  // ==========================================================================
  const { sosClusters, decollidedMap } = useMemo(() => {
    // 1. Nếu đang thu nhỏ (zoom <= 13): gom các SOS nằm gần nhau (< 600m ~ 0.0055 độ) thành 1 Cluster
    const clusters: {
      id: string;
      coords: [number, number];
      members: any[];
      hasUnverified: boolean;
    }[] = [];

    if (currentZoom <= 13 && showSos) {
      filteredSos.forEach((s) => {
        const c = getSosCoords(s);
        if (!c) return;
        let targetCluster = null;
        for (const cl of clusters) {
          if (Math.hypot(c[0] - cl.coords[0], c[1] - cl.coords[1]) < 0.006) {
            targetCluster = cl;
            break;
          }
        }
        const isUnv = s.verification_status !== "VERIFIED";
        if (targetCluster) {
          targetCluster.members.push(s);
          if (isUnv) targetCluster.hasUnverified = true;
        } else {
          clusters.push({
            id: `cluster-${s.id}`,
            coords: c,
            members: [s],
            hasUnverified: isUnv,
          });
        }
      });
    }

    // 2. Gom tất cả các điểm đơn lẻ đang hiển thị để chạy thuật toán tách điểm trùng (Spiderfy)
    const allVisiblePoints: {
      id: string;
      kind: string;
      coords: [number, number];
      raw: any;
    }[] = [];

    if (showSos) {
      if (currentZoom <= 13) {
        clusters.forEach((cl) => {
          if (cl.members.length === 1) {
            allVisiblePoints.push({
              id: String(cl.members[0].id),
              kind: "sos",
              coords: cl.coords,
              raw: cl.members[0],
            });
          } else {
            allVisiblePoints.push({
              id: cl.id,
              kind: "cluster",
              coords: cl.coords,
              raw: cl,
            });
          }
        });
      } else {
        filteredSos.forEach((s) => {
          const c = getSosCoords(s);
          if (c) allVisiblePoints.push({ id: String(s.id), kind: "sos", coords: c, raw: s });
        });
      }
    }

    if (showFieldReports) {
      filteredFieldReports.forEach((rep) => {
        const c = getReportCoords(rep);
        if (c)
          allVisiblePoints.push({ id: String(rep.id), kind: "report", coords: c, raw: rep });
      });
    }

    if (showRescuers) {
      rescuers.forEach((r) => {
        const c = getRescuerCoords(r);
        if (c)
          allVisiblePoints.push({ id: String(r.id), kind: "rescuer", coords: c, raw: r });
      });
    }

    const posMap = decollidePoints(allVisiblePoints, currentZoom);
    return { sosClusters: clusters, decollidedMap: posMap };
  }, [
    currentZoom,
    showSos,
    showFieldReports,
    showRescuers,
    filteredSos,
    filteredFieldReports,
    rescuers,
  ]);

  // Search via Nominatim
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}`
      );
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
    zones.forEach((z) => {
      const c = getZoneCoords(z);
      if (c) allPoints.push(c);
    });
    sosSignals.forEach((s) => {
      const c = getSosCoords(s);
      if (c) allPoints.push(c);
    });
    rescuers.forEach((r) => {
      const c = getRescuerCoords(r);
      if (c) allPoints.push(c);
    });
    filteredFieldReports.forEach((rep) => {
      const c = getReportCoords(rep);
      if (c) allPoints.push(c);
    });

    if (allPoints.length > 0) {
      setFitBoundsPoints(allPoints);
    } else {
      setTargetCenter([16.0544, 108.2022]);
      setTargetZoom(12);
    }
  };

  // Focus actions
  const focusOnSos = (s: any) => {
    const coords = getSosCoords(s);
    if (coords) {
      setTargetCenter(coords);
      setTargetZoom(17);
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
      setTargetZoom(15);
    } else {
      alert("Vùng này chưa có tọa độ hợp lệ.");
    }
  };

  const focusOnReport = (rep: any) => {
    const coords = getReportCoords(rep);
    if (coords) {
      setTargetCenter(coords);
      setTargetZoom(17);
    }
  };

  // Quick metrics
  const unverifiedSosCount = sosSignals.filter(
    (s) =>
      s.verification_status === "UNVERIFIED" ||
      !s.verification_status ||
      s.verification_status === "CHECKING"
  ).length;
  const onDutyTeamsCount = rescuers.filter((r) => r.rescuer_profile?.is_on_duty).length;
  const criticalZonesCount = zones.filter((z) => z.severity === "CRITICAL").length;
  const activeFieldReportsCount = fieldReports.filter((r) =>
    ["PENDING", "VERIFIED", "RECEDING"].includes(r.status)
  ).length;
  const verifiedFieldReportsCount = fieldReports.filter((r) => r.status === "VERIFIED").length;

  const currentTile = MAP_TILES[mapStyle];

  return (
    <AdminLayout fullWidth={true}>
      <style>{`
        .custom-leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
      `}</style>

      <div className="px-4 pt-2">
        <DataNotice
          loading={loading}
          error={loadError}
          onRetry={fetchData}
          hasData={!!lastUpdated}
        />
      </div>

      {/* Tactical Sub-Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto text-xs py-0.5">
          <button
            onClick={() => {
              setTacticalOpen(true);
              setActiveTab("sos");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 font-semibold shrink-0 transition cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-red-600" />
            <span>
              SOS cần xử lý: <b>{sosSignals.length}</b>
            </span>
            {unverifiedSosCount > 0 && (
              <span className="bg-red-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {unverifiedSosCount} chưa xác minh
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setTacticalOpen(true);
              setActiveTab("reports");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-lg border border-orange-200 font-semibold shrink-0 transition cursor-pointer"
          >
            <Droplets className="w-3.5 h-3.5 text-orange-600" />
            <span>
              Điểm ngập / Sự cố đường: <b>{activeFieldReportsCount}</b>
            </span>
            {verifiedFieldReportsCount > 0 && (
              <span className="bg-orange-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {verifiedFieldReportsCount} đã xác thực
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setTacticalOpen(true);
              setActiveTab("teams");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 font-medium shrink-0 transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Đội trực chiến: <b>{onDutyTeamsCount}/{rescuers.length}</b>
            </span>
          </button>

          <button
            onClick={() => {
              setTacticalOpen(true);
              setActiveTab("zones");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 font-medium shrink-0 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>
              Vùng sự cố: <b>{criticalZonesCount} nguy cấp / {zones.length}</b>
            </span>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 text-xs">
          <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(["streets", "satellite", "clean"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setMapStyle(st)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  mapStyle === st
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {MAP_TILES[st].label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowLegend(!showLegend)}
            title="Bật/Tắt bảng chú giải ký hiệu"
            className={`px-2.5 py-1.5 border rounded-lg flex items-center gap-1 font-medium transition cursor-pointer ${
              showLegend
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ký hiệu</span>
          </button>

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
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            onClick={() => setTacticalOpen(!tacticalOpen)}
            className="px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center gap-1.5 font-semibold transition cursor-pointer shadow-xs"
          >
            {tacticalOpen ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
            <span>{tacticalOpen ? "Thu gọn bảng" : "Mở bảng tác chiến"}</span>
          </button>
        </div>
      </div>

      {/* Map Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 h-full relative">
          <MapContainer
            center={[16.0544, 108.2022]}
            zoom={12}
            className="h-full w-full z-0 relative"
          >
            <MapController
              center={targetCenter}
              zoom={targetZoom}
              fitBoundsData={fitBoundsPoints}
              onZoomChange={setCurrentZoom}
            />

            {/* Floating Search & Layer Filter Bar */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className={`absolute top-3 left-14 z-[450] flex flex-col gap-2 max-w-[calc(100%-70px)] pointer-events-none transition-opacity ${
                selectedSosId || selectedReport ? "opacity-0 pointer-events-none" : ""
              }`}
            >
              <form
                onSubmit={handleSearch}
                className="flex items-center bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 overflow-hidden pointer-events-auto w-72 sm:w-80"
              >
                <div className="pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Tìm địa điểm (Đà Nẵng, Huế, Hà Nội...)"
                  className="w-full px-3 py-2 text-xs outline-none bg-transparent text-slate-800"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 transition cursor-pointer"
                >
                  {searchLoading ? "..." : "Tìm"}
                </button>
              </form>

              <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 p-2 flex flex-wrap items-center gap-1.5 text-xs pointer-events-auto">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 pl-1 mr-1">
                  <Layers className="w-3 h-3 text-slate-600" /> Lớp:
                </span>

                <button
                  onClick={() => setShowZones(!showZones)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    showZones
                      ? "bg-amber-100 border-amber-300 text-amber-900"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-red-600 bg-red-500/20" />
                  <span>Vùng sự cố ({filteredZones.length})</span>
                </button>

                <button
                  onClick={() => setShowSos(!showSos)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    showSos
                      ? "bg-red-100 border-red-300 text-red-800"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                >
                  <span>🆘</span>
                  <span>Tín hiệu SOS ({filteredSos.length})</span>
                </button>

                <button
                  onClick={() => setShowFieldReports(!showFieldReports)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    showFieldReports
                      ? "bg-orange-100 border-orange-300 text-orange-900"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                >
                  <span>🌊</span>
                  <span>Điểm ngập/Sự cố ({filteredFieldReports.length})</span>
                </button>

                <button
                  onClick={() => setShowRescuers(!showRescuers)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    showRescuers
                      ? "bg-blue-100 border-blue-300 text-blue-800"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                >
                  <span>🚑</span>
                  <span>Đội cứu hộ ({rescuers.length})</span>
                </button>
              </div>
            </div>

            {/* Interactive Visual Map Legend (Bottom Left) */}
            {showLegend && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute bottom-11 left-3 z-[450] bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-200 text-[11px] text-slate-700 w-64 space-y-2 pointer-events-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <MapIcon className="w-3.5 h-3.5 text-blue-600" />
                    Chú giải ký hiệu (Tự tách điểm)
                  </span>
                  <button
                    onClick={() => setShowLegend(false)}
                    className="text-slate-400 hover:text-slate-700 font-bold px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-red-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                      SOS
                    </span>
                    <span>Điểm SOS (Đỏ: Chờ • Xanh lá: Đã xác minh)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[11px] shrink-0">
                      🌊
                    </span>
                    <span>Điểm ngập / Cây đổ / Sạt lở (Có ✓ là đã xác thực)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center text-[11px] shrink-0">
                      🚑
                    </span>
                    <span>Đội cứu hộ (Chấm xanh: Đang trực chiến)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full border-2 border-red-600 bg-red-500/15 shrink-0" />
                    <span>Vùng sự cố (Viền liền: Chưa có đội • Đứt: Đã cử đội)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Map Status Timestamp */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute bottom-3 left-3 z-[450] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5 pointer-events-none"
            >
              <Clock className="w-3 h-3 text-slate-400" />
              <span>
                Cập nhật: <b>{lastUpdated || "Đang tải..."}</b> • Zoom: <b>{currentZoom}x</b>
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autoRefresh ? "bg-green-500" : "bg-slate-300"
                }`}
              />
            </div>

            <TileLayer
              key={mapStyle}
              attribution={currentTile.attribution}
              url={currentTile.url}
              subdomains={currentTile.subdomains}
              maxZoom={20}
            />

            {/* 1. Lớp Vùng sự cố (CHỈ VẼ VÒNG TRÒN MỜ — không đặt nhãn cứng ở tâm để không đè lên các điểm SOS bên trong) */}
            {showZones &&
              filteredZones.map((zone) => {
                const coords = getZoneCoords(zone);
                if (!coords) return null;
                const cfg = SEVERITY_CONFIG[zone.severity] || SEVERITY_CONFIG.MEDIUM;
                const hasTeam = activeMissionZoneIds.has(String(zone.id));
                const strokeColor =
                  zone.status === "RESOLVED"
                    ? "#16A34A"
                    : hasTeam
                    ? "#D97706"
                    : cfg.color;
                const radius = Number(zone.radius_meters || zone.radius) || 600;

                return (
                  <Circle
                    key={`zone-${zone.id}`}
                    center={coords}
                    radius={radius}
                    pathOptions={{
                      color: strokeColor,
                      fillColor: strokeColor,
                      fillOpacity: currentZoom >= 15 ? 0.07 : 0.12,
                      weight: hasTeam ? 2 : 2.5,
                      dashArray: hasTeam ? "8, 6" : undefined,
                    }}
                  >
                    <Tooltip sticky direction="top">
                      <div className="text-xs font-bold">
                        🎯 {zone.name} ({zone.sos_count || 0} SOS) —{" "}
                        {hasTeam ? "Đã cử đội" : "Chưa có đội"}
                      </div>
                    </Tooltip>

                    <Popup>
                      <div className="p-1 min-w-[230px]">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              hasTeam
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {hasTeam ? "🚑 Đã cử đội cứu hộ" : "🔴 Chưa có đội"}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-slate-900 mb-1">{zone.name}</h3>
                        <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-1.5 mb-3">
                          <p>
                            👥 Nạn nhân ước tính: <b>{zone.people_affected || 0} người</b>
                          </p>
                          <p>
                            🆘 Số tin SOS trong vùng: <b>{zone.sos_count || 0}</b>
                          </p>
                          <p>
                            🚑 Số đội cứu hộ cần: <b>{zone.rescuers_needed || 0}</b>
                          </p>
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
                );
              })}

            {/* 2. Lớp Báo cáo đoạn đường sự cố (Vẽ Polyline bám sát mặt đường thực tế + Pin 28px ở điểm giữa) */}
            {showFieldReports &&
              filteredFieldReports.map((rep) => {
                const pos = decollidedMap.get(`report:${rep.id}`);
                if (!pos) return null;
                const { origCoords, displayCoords, isOffset } = pos;
                const isVer = rep.status === "VERIFIED";
                const isReceding = rep.status === "RECEDING";
                const isCleared = rep.status === "CLEARED";

                const roadColor = isCleared
                  ? "#16A34A"
                  : isReceding
                  ? "#D97706"
                  : isVer
                  ? "#DC2626"
                  : "#EA580C";

                const roadGeometry: [number, number][] =
                  Array.isArray(rep.road_geometry) && rep.road_geometry.length >= 2
                    ? rep.road_geometry.map((pt: number[]) => [Number(pt[0]), Number(pt[1])])
                    : [
                        [origCoords[0] - 0.00055, origCoords[1] - 0.00055],
                        origCoords,
                        [origCoords[0] + 0.00055, origCoords[1] + 0.00055],
                      ];

                const icon = createFieldReportDivIcon(rep);

                return (
                  <React.Fragment key={`field-rep-${rep.id}`}>
                    {/* Vẽ đoạn đường sự cố bám sát mặt đường thực tế (kiểu Google Maps Traffic) */}
                    <Polyline
                      positions={roadGeometry}
                      pathOptions={{
                        color: "#FFFFFF",
                        weight: currentZoom >= 15 ? 11 : 8,
                        opacity: 0.92,
                        lineCap: "round",
                        lineJoin: "round",
                      }}
                    />
                    <Polyline
                      positions={roadGeometry}
                      pathOptions={{
                        color: roadColor,
                        weight: currentZoom >= 15 ? 7 : 5,
                        opacity: isCleared ? 0.75 : 0.95,
                        dashArray: isReceding ? "8, 6" : isVer || isCleared ? undefined : "6, 6",
                        lineCap: "round",
                        lineJoin: "round",
                      }}
                      eventHandlers={{
                        click: () => setSelectedReport(rep),
                      }}
                    >
                      <Tooltip sticky direction="top">
                        <span className="font-bold text-xs">
                          🛣️ Đoạn đường sự cố (~{rep.segment_length_m || 150}m):{" "}
                          {rep.hazard_display || rep.hazard_type}
                          {rep.water_level_cm > 0 ? ` (${rep.water_level_cm}cm)` : ""}
                        </span>
                      </Tooltip>
                    </Polyline>

                    {/* Đường chỉ mảnh nối từ tâm đoạn đường tới icon nếu đã tách trùng */}
                    {isOffset && (
                      <Polyline
                        positions={[origCoords, displayCoords]}
                        pathOptions={{
                          color: "#64748B",
                          weight: 1.5,
                          dashArray: "3, 3",
                          opacity: 0.75,
                        }}
                      />
                    )}

                    <Marker position={displayCoords} icon={icon}>
                      <Tooltip direction="top" offset={[0, -14]}>
                        <span className="font-bold text-xs">
                          {HAZARD_ICON_MAP[rep.hazard_type] || "⚠️"}{" "}
                          {rep.hazard_display || rep.hazard_type}
                          {rep.water_level_cm > 0 ? ` (${rep.water_level_cm}cm)` : ""} —{" "}
                          {isCleared
                            ? "Đường đã thông"
                            : isReceding
                            ? "Nước đang rút"
                            : isVer
                            ? `Đã xác thực (+${rep.report_count})`
                            : "Chờ xác thực"}
                        </span>
                      </Tooltip>

                      <Popup>
                        <div className="p-1 min-w-[250px] max-w-[290px]">
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isCleared
                                  ? "bg-emerald-100 text-emerald-700"
                                  : isReceding
                                  ? "bg-amber-100 text-amber-800"
                                  : isVer
                                  ? "bg-red-100 text-red-700"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {isCleared
                                ? "✅ Đường đã thông"
                                : isReceding
                                ? "🌊 Nước đang rút (Còn ngập)"
                                : isVer
                                ? `✓ Đã xác thực (+${rep.report_count})`
                                : "⏳ Chờ xác thực"}
                            </span>

                            {rep.incident_wave > 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">
                                Đợt #{rep.incident_wave}
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm">
                            {HAZARD_ICON_MAP[rep.hazard_type] || "⚠️"}{" "}
                            {rep.hazard_display || rep.hazard_type}
                            {rep.water_level_cm > 0 ? ` — Ngập ${rep.water_level_cm}cm` : ""}
                          </h4>

                          <div className="mt-1 space-y-1 text-xs text-slate-600">
                            <p>
                              📍 <b>{rep.address || "Tọa độ GPS thực địa"}</b>
                            </p>
                            <p>
                              👤 Người báo: <b>{rep.reporter_name || "Người dân"}</b>
                            </p>
                            {rep.description && (
                              <p className="text-slate-500 line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                                📝 {rep.description}
                              </p>
                            )}
                            {rep.vote_summary && (
                              <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold">
                                <span className="text-red-600">
                                  🔴 Nguy hiểm: {rep.vote_summary.confirm_count}
                                </span>
                                <span className="text-amber-600">
                                  🟡 Đang rút: {rep.vote_summary.receding_count || 0}
                                </span>
                                <span className="text-emerald-600">
                                  🟢 Đã thông: {rep.vote_summary.cleared_count}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => setSelectedReport(rep)}
                              className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Xem ghi chú ({rep.votes?.length || 0}) & Duyệt nhanh</span>
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  </React.Fragment>
                );
              })}

            {/* 3A. Lớp Cụm SOS khi thu nhỏ bản đồ (Zoom <= 13) */}
            {showSos &&
              currentZoom <= 13 &&
              sosClusters.map((cl) => {
                if (cl.members.length <= 1) return null;
                const pos = decollidedMap.get(`cluster:${cl.id}`);
                const coords = pos ? pos.displayCoords : cl.coords;
                const icon = createSosClusterIcon(cl.members.length, cl.hasUnverified);

                return (
                  <Marker
                    key={cl.id}
                    position={coords}
                    icon={icon}
                    eventHandlers={{
                      click: () => {
                        setTargetCenter(cl.coords);
                        setTargetZoom(15);
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -16]}>
                      <span className="font-bold text-xs">
                        🆘 Cụm {cl.members.length} tín hiệu SOS — Bấm để phóng to tách điểm
                      </span>
                    </Tooltip>
                  </Marker>
                );
              })}

            {/* 3B. Lớp Tín hiệu SOS đơn lẻ (Tự động tách vòng tròn khi trùng tọa độ) */}
            {showSos &&
              filteredSos.map((sos) => {
                const pos = decollidedMap.get(`sos:${sos.id}`);
                if (!pos) return null;
                const { origCoords, displayCoords, isOffset } = pos;
                const icon = createSosDivIcon(sos.verification_status);

                return (
                  <React.Fragment key={`sos-${sos.id}`}>
                    {isOffset && (
                      <Polyline
                        positions={[origCoords, displayCoords]}
                        pathOptions={{
                          color: "#EF4444",
                          weight: 1.5,
                          dashArray: "3, 3",
                          opacity: 0.7,
                        }}
                      />
                    )}

                    <Marker position={displayCoords} icon={icon}>
                      <Tooltip direction="top" offset={[0, -14]}>
                        <span className="font-bold text-xs">
                          🆘 {sos.contact_name || sos.citizen_name || "Người dân"} (
                          {sos.people_count || 1} người)
                        </span>
                      </Tooltip>

                      <Popup>
                        <div className="p-1 min-w-[250px] max-w-[280px]">
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sos.verification_status === "VERIFIED"
                                  ? "bg-green-100 text-green-700"
                                  : sos.verification_status === "CHECKING"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {sos.verification_status === "VERIFIED"
                                ? "✅ Đã xác minh"
                                : sos.verification_status === "CHECKING"
                                ? "📞 Đang kiểm tra"
                                : "⚠️ Chưa xác minh"}
                            </span>

                            <span className="text-[10px] text-slate-400">
                              {new Date(sos.sent_at || sos.created_at).toLocaleTimeString(
                                "vi-VN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between gap-1">
                            <span>{sos.emergency_type || "Yêu cầu Cứu nạn SOS"}</span>
                            {sos.location_source === 'BLE_OFFLINE' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-300">
                                📡 BLE OFFLINE
                              </span>
                            )}
                          </h4>

                          <div className="mt-1 space-y-1 text-xs text-slate-600">
                            <p>
                              👤 Người gửi:{" "}
                              <b>{sos.contact_name || sos.citizen_name || "Ẩn danh"}</b> (
                              {sos.people_count || 1} người)
                            </p>
                            <p className="flex items-center gap-1 text-blue-600 font-semibold">
                              <Phone className="w-3 h-3" />
                              <a
                                href={`tel:${sos.contact_phone || sos.phone}`}
                                className="hover:underline"
                              >
                                {sos.contact_phone || sos.phone || "Chưa có SĐT"}
                              </a>
                            </p>
                            <p className="text-slate-500 line-clamp-2">
                              📝 {sos.description || sos.note || "Không có mô tả chi tiết"}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => setSelectedSosId(sos.id)}
                              className={`w-full py-1.5 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                                sos.verification_status === "VERIFIED"
                                  ? "bg-emerald-600 hover:bg-emerald-700"
                                  : sos.verification_status === "CHECKING"
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : "bg-amber-500 hover:bg-amber-600"
                              }`}
                            >
                              {sos.verification_status === "VERIFIED" ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Đã xác minh · Xem chi tiết</span>
                                </>
                              ) : (
                                <>
                                  <Phone className="w-3.5 h-3.5" />
                                  <span>Gọi điện & Xác minh ngay</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  </React.Fragment>
                );
              })}

            {/* 4. Lớp Đội cứu hộ (Rescue Teams) */}
            {showRescuers &&
              rescuers.map((team) => {
                const pos = decollidedMap.get(`rescuer:${team.id}`);
                if (!pos) return null;
                const { origCoords, displayCoords, isOffset } = pos;
                const isOnDuty = Boolean(team.rescuer_profile?.is_on_duty);
                const icon = createRescuerDivIcon(isOnDuty);

                return (
                  <React.Fragment key={`rescuer-${team.id}`}>
                    {isOffset && (
                      <Polyline
                        positions={[origCoords, displayCoords]}
                        pathOptions={{
                          color: "#2563EB",
                          weight: 1.5,
                          dashArray: "3, 3",
                          opacity: 0.7,
                        }}
                      />
                    )}
                    <Marker position={displayCoords} icon={icon}>
                      <Tooltip direction="top" offset={[0, -14]}>
                        <span className="font-bold text-xs">
                          🚑 {team.rescuer_profile?.unit_name || team.full_name}
                        </span>
                      </Tooltip>
                      <Popup>
                        <div className="p-1 min-w-[210px]">
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isOnDuty
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {isOnDuty ? "🟢 Đang trực chiến" : "⚪ Nghỉ ca"}
                            </span>
                            <span className="text-[10px] text-blue-700 font-bold">
                              {team.rescuer_profile?.specialty || "Cứu hộ"}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm">
                            {team.rescuer_profile?.unit_name || team.full_name || "Đội Cứu Hộ"}
                          </h4>

                          <div className="mt-1 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-1.5">
                            <p>
                              Đội trưởng: <b>{team.full_name}</b>
                            </p>
                            <p className="flex items-center gap-1 text-blue-600">
                              <Phone className="w-3 h-3" />
                              <a
                                href={`tel:${team.phone}`}
                                className="hover:underline font-semibold"
                              >
                                {team.phone || "Chưa có SĐT"}
                              </a>
                            </p>
                            <p className="text-slate-400 text-[11px]">
                              📍 GPS: {origCoords[0].toFixed(4)}, {origCoords[1].toFixed(4)}
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
                  </React.Fragment>
                );
              })}
          </MapContainer>
        </div>

        {/* Right Column: Tactical Feed Sidebar */}
        <div
          className={`
            ${tacticalOpen ? "w-full md:w-[400px]" : "w-0 hidden"}
            transition-all duration-300 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 z-10 shadow-lg
          `}
        >
          <div className="p-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-1 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab("sos")}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                  activeTab === "sos"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>SOS ({sosSignals.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("reports")}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                  activeTab === "reports"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Droplets className="w-3 h-3" />
                <span>Điểm ngập ({activeFieldReportsCount})</span>
              </button>

              <button
                onClick={() => setActiveTab("teams")}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                  activeTab === "teams"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Đội ({rescuers.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("zones")}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                  activeTab === "zones"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Vùng ({zones.length})</span>
              </button>
            </div>

            <button
              onClick={() => setTacticalOpen(false)}
              title="Đóng thanh tác chiến"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tab 1: Live SOS Feed */}
          {activeTab === "sos" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-1 text-[11px] bg-white shrink-0">
                <span className="text-slate-400 font-medium">Lọc:</span>
                <div className="flex gap-1">
                  {[
                    { id: "ALL", label: "Tất cả" },
                    { id: "UNVERIFIED", label: "Chưa xác minh" },
                    { id: "CHECKING", label: "Đang gọi" },
                    { id: "VERIFIED", label: "Đã xác minh" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSosStatusFilter(f.id)}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                        sosStatusFilter === f.id
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
                {filteredSos.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Không có tin SOS nào trong bộ lọc này.
                  </div>
                ) : (
                  filteredSos.map((s) => {
                    const isChecking = s.verification_status === "CHECKING";

                    return (
                      <div
                        key={s.id}
                        className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              s.verification_status === "VERIFIED"
                                ? "bg-green-100 text-green-700"
                                : isChecking
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700 animate-pulse"
                            }`}
                          >
                            {s.verification_status === "VERIFIED"
                              ? "Đã xác minh"
                              : isChecking
                              ? "Đang kiểm tra"
                              : "Chưa xác minh"}
                          </span>

                          <span className="text-[11px] text-slate-400">
                            {new Date(s.sent_at || s.created_at).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <h4 className="font-semibold text-slate-900 text-xs flex items-center justify-between gap-1">
                          <span>{s.emergency_type || "Yêu cầu Cứu nạn SOS"}</span>
                          {s.location_source === 'BLE_OFFLINE' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
                              📡 BLE 0xGP
                            </span>
                          )}
                        </h4>

                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                          {s.contact_name || s.citizen_name || "Người dân ẩn danh"} (
                          {s.people_count || 1} người)
                        </p>

                        <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold mt-1">
                          <Phone className="w-3 h-3" />
                          <span>{s.contact_phone || s.phone || "Chưa có SĐT"}</span>
                        </div>

                        <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 bg-slate-50 p-1.5 rounded">
                          {s.description || s.note || "Không có mô tả"}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => focusOnSos(s)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 text-red-500" />
                            <span>Định vị</span>
                          </button>

                          <button
                            onClick={() => setSelectedSosId(s.id)}
                            className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              s.verification_status === "VERIFIED"
                                ? "bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                : isChecking
                                ? "bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100"
                                : "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                            }`}
                          >
                            {s.verification_status === "VERIFIED" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Xem chi tiết</span>
                              </>
                            ) : (
                              <>
                                <Phone className="w-3 h-3" />
                                <span>{isChecking ? "Đang gọi..." : "Gọi & Xác minh"}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Citizen Field Reports Feed */}
          {activeTab === "reports" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-1 text-[11px] bg-white shrink-0">
                <span className="text-slate-400 font-medium">Lọc:</span>
                <div className="flex gap-1 flex-wrap">
                  {[
                    { id: "ACTIVE", label: "Đang mở" },
                    { id: "DANGER", label: "Nguy hiểm" },
                    { id: "RECEDING", label: "Đang rút" },
                    { id: "CLEARED", label: "Đã thông" },
                    { id: "ALL", label: "Tất cả" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFieldReportStatusFilter(f.id)}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                        fieldReportStatusFilter === f.id
                          ? "bg-orange-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
                {filteredFieldReports.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Không có báo cáo hiện trường nào trong bộ lọc này.
                  </div>
                ) : (
                  filteredFieldReports.map((rep) => {
                    const isVer = rep.status === "VERIFIED";
                    const isReceding = rep.status === "RECEDING";
                    const isCleared = rep.status === "CLEARED";
                    const latestVote = rep.votes && rep.votes.length > 0 ? rep.votes[0] : null;

                    return (
                      <div
                        key={rep.id}
                        className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                rep.is_hidden
                                  ? "bg-slate-200 text-slate-600 border border-slate-300"
                                  : isCleared
                                  ? "bg-emerald-100 text-emerald-700"
                                  : isReceding
                                  ? "bg-amber-100 text-amber-800"
                                  : isVer
                                  ? "bg-red-100 text-red-700"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {rep.is_hidden
                                ? "👁️ Đã ẩn"
                                : isCleared
                                ? "✅ Đường đã thông"
                                : isReceding
                                ? "🌊 Nước đang rút"
                                : isVer
                                ? `✓ Đã xác thực (+${rep.report_count})`
                                : "⏳ Chờ xác thực"}
                            </span>
                            {rep.incident_wave > 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">
                                Đợt #{rep.incident_wave}
                              </span>
                            )}
                            {rep.remaining_minutes !== undefined && rep.remaining_minutes !== null && (
                              <span className="text-[10px] text-sky-700 font-semibold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                ⏳ {rep.remaining_minutes <= 0 ? "Hết hạn" : `${rep.remaining_minutes}p`}
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-slate-400">
                            {new Date(rep.updated_at || rep.created_at).toLocaleTimeString(
                              "vi-VN",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        </div>

                        <div className="flex items-start gap-2.5">
                          {rep.image_url ? (
                            <img
                              src={rep.image_url}
                              alt="Hiện trường"
                              className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1">
                              <span>{HAZARD_ICON_MAP[rep.hazard_type] || "⚠️"}</span>
                              <span className="truncate">
                                {rep.hazard_display || rep.hazard_type}
                                {rep.water_level_cm > 0 ? ` — Ngập ${rep.water_level_cm}cm` : ""}
                              </span>
                            </h4>

                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                              📍{" "}
                              {rep.address ||
                                `${Number(rep.location_lat).toFixed(4)}, ${Number(
                                  rep.location_lng
                                ).toFixed(4)}`}
                            </p>
                          </div>
                        </div>

                        {latestVote?.note ? (
                          <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                            <span className="font-bold text-slate-700">
                              💬 {latestVote.voter_name}:
                            </span>{" "}
                            “{latestVote.note}”
                          </div>
                        ) : rep.description ? (
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1 bg-slate-50 p-1.5 rounded">
                            {rep.description}
                          </p>
                        ) : null}

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => focusOnReport(rep)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 text-orange-500" />
                            <span>Định vị</span>
                          </button>

                          <button
                            onClick={() => setSelectedReport(rep)}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Ghi chú ({rep.votes?.length || 0}) & Duyệt</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Rescue Teams Feed */}
          {activeTab === "teams" && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
              {rescuers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Chưa có đội cứu hộ nào kích hoạt.
                </div>
              ) : (
                rescuers.map((team) => {
                  const isOnDuty = Boolean(team.rescuer_profile?.is_on_duty);
                  const coords = getRescuerCoords(team);

                  return (
                    <div
                      key={team.id}
                      className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all shadow-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isOnDuty
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {isOnDuty ? "🟢 Đang trực chiến" : "⚪ Nghỉ ca"}
                        </span>

                        <span className="text-[11px] font-bold text-blue-700">
                          {team.rescuer_profile?.specialty || "Cứu hộ tổng hợp"}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs">
                        {team.rescuer_profile?.unit_name || team.full_name || "Đội cứu hộ"}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Đội trưởng: <b>{team.full_name}</b>
                      </p>

                      <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                        <Phone className="w-3 h-3" />
                        <span>{team.phone || "Chưa có SĐT"}</span>
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

          {/* Tab 4: Zones Feed */}
          {activeTab === "zones" && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
              {zones.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Chưa có vùng sự cố nào đang hoạt động.
                </div>
              ) : (
                zones.map((zone) => {
                  const cfg = SEVERITY_CONFIG[zone.severity] || SEVERITY_CONFIG.MEDIUM;
                  const coords = getZoneCoords(zone);
                  const hasTeam = activeMissionZoneIds.has(String(zone.id));

                  return (
                    <div
                      key={zone.id}
                      className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all shadow-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            hasTeam
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {hasTeam ? "🚑 Đã cử đội" : "🔴 Chưa có đội"}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs">{zone.name}</h4>

                      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                        <p>
                          Nạn nhân: <b>{zone.people_affected || 0}</b>
                        </p>
                        <p>
                          SOS trong vùng: <b>{zone.sos_count || 0}</b>
                        </p>
                        <p>
                          Đội cần: <b>{zone.rescuers_needed || 0}</b>
                        </p>
                        <p>
                          Bán kính: <b>{zone.radius_meters || zone.radius || 600}m</b>
                        </p>
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

      {/* Modals */}
      <SOSDetailModal
        sosId={selectedSosId}
        isOpen={Boolean(selectedSosId)}
        onClose={() => setSelectedSosId(null)}
        onUpdated={fetchData}
      />

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

      <FieldReportDetailModal
        reportId={selectedReport?.id || null}
        initialReport={selectedReport}
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        onLocate={(rep) => {
          focusOnReport(rep);
          setSelectedReport(null);
        }}
        onUpdated={fetchData}
      />
    </AdminLayout>
  );
}
