import React, { useEffect, useState, useMemo, useRef } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";
import { useNavigate } from "react-router-dom";
import SOSDetailModal from "../../components/SOSDetailModal";

// Leaflet & Icons
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import {
  Layers,
  Merge,
  Scissors,
  Edit,
  Trash2,
  Maximize2,
  Minimize2,
  Navigation,
  Eye,
  EyeOff,
  Search,
  Plus,
  Sparkles,
  AlertTriangle,
  Users,
  CheckCircle2,
  ChevronRight,
  X,
  Compass,
  MapPin,
  RefreshCw,
  ArrowRight,
  FolderInput,
} from "lucide-react";
import { MdOutlineLocationOn, MdOutlineCrisisAlert } from "react-icons/md";

// Sửa lỗi Leaflet default icon khi build với Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Bảng màu mức độ nguy hiểm
const SEVERITY_COLORS: Record<string, { hex: string; bg: string; text: string; label: string }> = {
  CRITICAL: { hex: "#DC2626", bg: "bg-red-50", text: "text-red-700", label: "🔴 Nguy hiểm" },
  HIGH:     { hex: "#EA580C", bg: "bg-orange-50", text: "text-orange-700", label: "🟠 Khẩn cấp" },
  MEDIUM:   { hex: "#2563EB", bg: "bg-blue-50", text: "text-blue-700", label: "🔵 Trung bình" },
  LOW:      { hex: "#16A34A", bg: "bg-green-50", text: "text-green-700", label: "🟢 Thấp" },
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  STABILIZING: "Đang ổn định",
  RESOLVED: "Đã giải quyết",
  STANDBY: "Đang chờ",
};

// Custom Marker Icon cho Vùng cứu hộ
const createZoneDivIcon = (zone: any) => {
  const isResolved = zone.status === "RESOLVED";
  const color = isResolved ? "#64748B" : (SEVERITY_COLORS[zone.severity]?.hex || "#2563EB");
  const label = zone.sector_code || (zone.name ? zone.name.slice(0, 10) : "VÙNG");
  const count = zone.sos_count || 0;

  return L.divIcon({
    className: "custom-zone-marker",
    html: `
      <div style="transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 4px; background-color: ${color}; color: white; padding: 4px 9px; border-radius: 9999px; font-size: 11px; font-weight: 800; white-space: nowrap; box-shadow: 0 3px 10px rgba(0,0,0,0.35); border: 2px solid white; cursor: pointer; user-select: none;">
        <span>📍</span>
        <span>${label}</span>
        ${count > 0 ? `<span style="background: rgba(255,255,255,0.3); padding: 1px 5px; border-radius: 9999px; font-size: 10px; font-weight: 900;">${count}</span>` : ""}
      </div>
    `,
    iconSize: [0, 0],
  });
};

// Custom Marker Icon cho SOS đơn lẻ (Pulsing Red/Orange dot)
const createSingleSosDivIcon = (sos: any) => {
  const isVerified = sos.verification_status === "VERIFIED";
  const color = isVerified ? "#DC2626" : "#F59E0B";

  return L.divIcon({
    className: "custom-single-sos-marker",
    html: `
      <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; transform: translate(-13px, -13px); cursor: pointer;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${color}; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${color}; border: 2px solid #FFFFFF; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 8px; font-weight: 900; box-shadow: 0 2px 6px rgba(0,0,0,0.35);">
          SOS
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
};

// Component điều khiển bay (FlyTo) và fit bounds của Leaflet
function MapFlyController({
  center,
  zoom,
  fitBoundsPoints,
}: {
  center: [number, number] | null;
  zoom?: number;
  fitBoundsPoints: [number, number][] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 14, { duration: 1.2 });
    }
  }, [center, zoom, map]);

  useEffect(() => {
    if (fitBoundsPoints && fitBoundsPoints.length > 0) {
      const bounds = L.latLngBounds(fitBoundsPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [fitBoundsPoints, map]);

  return null;
}

export default function RescueZoneManagementPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [sosList, setSosList] = useState<any[]>([]);
  const [missionsList, setMissionsList] = useState<any[]>([]);
  const [supportRequests, setSupportRequests] = useState<any[]>([]);
  const [selectedHelpZone, setSelectedHelpZone] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const loadPending = useRef(false);
  const refreshQueued = useRef(false);
  const mounted = useRef(false);
  const lastResponses = useRef<Record<string, any[]>>({});
  const [runningAI, setRunningAI] = useState(false);

  // Tab & Tìm kiếm
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ALL" | "SINGLE" | "RESOLVED">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");

  // Map state
  const mapRef = useRef<HTMLDivElement>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(true);
  const [showSingleOnMap, setShowSingleOnMap] = useState(true);
  const [showResolvedOnMap, setShowResolvedOnMap] = useState(false);
  const [flyCenter, setFlyCenter] = useState<[number, number] | null>(null);
  const [fitBoundsData, setFitBoundsData] = useState<[number, number][] | null>(null);

  // Modal Tạo vùng mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [newZone, setNewZone] = useState({
    name: "",
    sector_code: "",
    location_lat: "10.76",
    location_lng: "106.66",
    severity: "MEDIUM",
    status: "ACTIVE",
  });

  // Modal Sửa vùng
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    sector_code: "",
    severity: "MEDIUM",
    status: "ACTIVE",
    location_lat: "10.76",
    location_lng: "106.66",
    rescuers_needed: 1,
    description: "",
  });
  const [editAddressInput, setEditAddressInput] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal Gộp vùng (Merge Zones)
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetZoneId, setMergeTargetZoneId] = useState("");
  const [mergeSourceZoneIds, setMergeSourceZoneIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  // Modal Tách SOS / Tách vùng (Detach / Move SOS)
  const [showDetachModal, setShowDetachModal] = useState(false);
  const [detachZone, setDetachZone] = useState<any>(null);
  const [selectedDetachSosIds, setSelectedDetachSosIds] = useState<string[]>([]);
  const [detachActionType, setDetachActionType] = useState<"detach" | "move">("detach");
  const [detachTargetZoneId, setDetachTargetZoneId] = useState("");
  const [detaching, setDetaching] = useState(false);

  // Modal GỘP SOS ĐƠN LẺ VÀO VÙNG (DEDICATED MOVE SOS TO ZONE)
  const [showMoveSosModal, setShowMoveSosModal] = useState(false);
  const [moveSosTargetZoneId, setMoveSosTargetZoneId] = useState("");
  const [selectedSingleSosIds, setSelectedSingleSosIds] = useState<string[]>([]);
  const [moveSosSearchQuery, setMoveSosSearchQuery] = useState("");
  const [movingSos, setMovingSos] = useState(false);

  // Modal Điều phối SOS đơn lẻ (giao đội)
  const [rescuers, setRescuers] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [selectedSingleSos, setSelectedSingleSos] = useState<any>(null);
  const [selectedRescuer, setSelectedRescuer] = useState("");
  const [dispatchingSingle, setDispatchingSingle] = useState(false);
  const [loadingDispatchData, setLoadingDispatchData] = useState(false);
  const [dispatchDataLoaded, setDispatchDataLoaded] = useState(false);

  // SOS Detail Modal
  const [selectedSosDetailId, setSelectedSosDetailId] = useState<string | null>(null);

  const navigate = useNavigate();

  // Load danh sách dữ liệu
  const fetchZones = async (showLoader = true) => {
    if (loadPending.current) { refreshQueued.current = true; return; }
    loadPending.current = true;
    try {
      if (showLoader) setLoading(true);
      const requests = [
        api.zones.getAll(),
        api.sos.getAll(),
        api.missions.getAll({ active: true }),
        api.missions.getSupportRequests(),
      ];
      const names = ['zones', 'sos', 'missions', 'support'];
      const labels = ['vùng', 'SOS', 'nhiệm vụ', 'yêu cầu hỗ trợ'];
      const failures = new Map<number, string>();
      const applyData = () => {
      if (!mounted.current) return;
      const rawZones = lastResponses.current.zones || [];
      const rawSos = lastResponses.current.sos || [];
      const rawMissions = lastResponses.current.missions || [];

      // Tính toán số nhiệm vụ đang hoạt động tại từng zone
      const zonesWithMissions = rawZones.map((z: any) => {
        const activeMissions = rawMissions.filter(
          (m: any) =>
            m.zone === z.id &&
            ["PENDING_ACCEPTANCE", "ACCEPTED", "ACTIVE", "ON_MY_WAY", "NEEDS_HELP"].includes(m.status),
        );
        return {
          ...z,
          missionCount: activeMissions.length,
        };
      });

      setZones(zonesWithMissions);
      setSosList(rawSos);
      setMissionsList(rawMissions);
      setSupportRequests(lastResponses.current.support || []);
      setLoadError(failures.size ? `Không cập nhật được ${[...failures.values()].join('; ')}.` : '');
      };
      await Promise.all(requests.map(async (request, index) => {
        try {
          const response = await request;
          const rows = response?.data?.results || [];
          if (!Array.isArray(rows)) throw new Error('Dữ liệu không đúng định dạng');
          lastResponses.current[names[index]] = rows;
        } catch (error) {
          failures.set(index, `${labels[index]}: ${apiErrorMessage(error)}`);
        }
        applyData();
      }));
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu vùng và SOS:", error);
      if (mounted.current) setLoadError(apiErrorMessage(error));
    } finally {
      loadPending.current = false;
      if (mounted.current && showLoader) setLoading(false);
      if (mounted.current && refreshQueued.current) {
        refreshQueued.current = false;
        void fetchZones(false);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    fetchZones();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchZones(false);
    }, 45000);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, []);

  // Logic tính toán số liệu thống kê
  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };

  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();

  const newZonesToday = zones.filter((z) => z.created_at?.startsWith(todayStr)).length;
  const sosToday = sosList.filter((s) => s.sent_at?.startsWith(todayStr)).length;
  const sosYesterday = sosList.filter((s) => s.sent_at?.startsWith(yesterdayStr)).length;

  let sosTrend = "0";
  if (sosYesterday > 0) {
    const diff = ((sosToday - sosYesterday) / sosYesterday) * 100;
    sosTrend = (diff > 0 ? "+" : "") + diff.toFixed(0);
  } else if (sosToday > 0) {
    sosTrend = "+100";
  }

  // Danh sách phân loại
  const activeWithSos = useMemo(
    () => zones.filter((z) => z.status !== "RESOLVED" && (z.sos_count || 0) > 0),
    [zones]
  );
  const singleSos = useMemo(
    () =>
      sosList.filter(
        (s) =>
          !s.zone &&
          !s.assigned_mission &&
          !["RESOLVED", "CANCELLED"].includes(s.status) &&
          s.verification_status !== "INCORRECT"
      ),
    [sosList]
  );
  const resolvedZones = useMemo(() => zones.filter((z) => z.status === "RESOLVED"), [zones]);

  const filteredSingleSos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return singleSos.filter((s) => {
      return (
        !q ||
        [s.contact_name, s.citizen_name, s.address, s.note, s.emergency_type].some((val) =>
          String(val || "").toLowerCase().includes(q)
        )
      );
    });
  }, [singleSos, searchQuery]);

  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = z.name?.toLowerCase().includes(q) || z.sector_code?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (activeTab === "ACTIVE") return z.status !== "RESOLVED" && (z.sos_count || 0) > 0;
      if (activeTab === "SINGLE") return false;
      if (activeTab === "RESOLVED") return z.status === "RESOLVED";
      return true; // ALL
    });
  }, [zones, activeTab, searchQuery]);

  // Các vùng và SOS có tọa độ hợp lệ trên bản đồ
  const mapZones = useMemo(() => {
    return zones.filter((z) => {
      if (!z.location_lat || !z.location_lng || isNaN(parseFloat(z.location_lat))) return false;
      if (!showResolvedOnMap && z.status === "RESOLVED") return false;
      return true;
    });
  }, [zones, showResolvedOnMap]);

  const mapSingleSos = useMemo(() => {
    if (!showSingleOnMap) return [];
    return singleSos.filter(
      (s) => s.location_lat && s.location_lng && !isNaN(parseFloat(s.location_lat))
    );
  }, [singleSos, showSingleOnMap]);

  // Vị trí trung tâm ban đầu của bản đồ (ưu tiên vùng đầu tiên hoặc mặc định Đà Nẵng)
  const defaultCenter = useMemo<[number, number]>(() => {
    const firstZone = mapZones.find((z) => z.location_lat && z.location_lng);
    if (firstZone) {
      return [parseFloat(firstZone.location_lat), parseFloat(firstZone.location_lng)];
    }
    return [16.0544, 108.2022];
  }, [mapZones]);

  // Căn chỉnh toàn cảnh (Fit Bounds)
  const handleFitBounds = () => {
    const points: [number, number][] = [];
    mapZones.forEach((z) => points.push([parseFloat(z.location_lat), parseFloat(z.location_lng)]));
    mapSingleSos.forEach((s) => points.push([parseFloat(s.location_lat), parseFloat(s.location_lng)]));
    if (points.length > 0) {
      setFitBoundsData([...points]);
    } else {
      alert("Chưa có vị trí tọa độ nào trên bản đồ để căn chỉnh.");
    }
  };

  // Di chuyển bản đồ đến một vùng cụ thể
  const handleFlyToZone = (z: any) => {
    if (!z.location_lat || !z.location_lng) {
      alert("Vùng này chưa có tọa độ GPS để hiển thị trên bản đồ.");
      return;
    }
    const target: [number, number] = [parseFloat(z.location_lat), parseFloat(z.location_lng)];
    setFlyCenter(target);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Điều hướng xem chi tiết vùng
  const handleViewDetail = (id: string) => {
    if (!id) {
      alert("Không tìm thấy ID vùng cứu hộ!");
      return;
    }
    navigate(`/details-rescue-zone/${id}`);
  };

  // AI Gom cụm
  const handleRunAIClustering = async () => {
    try {
      setRunningAI(true);
      await api.ai.runPipeline();
      alert("Hệ thống AI đã quét các tín hiệu SOS và tự động gom cụm/cập nhật vùng thành công!");
      await fetchZones();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || "Lỗi khi chạy gom cụm AI");
    } finally {
      setRunningAI(false);
    }
  };

  // ── XÓA VÙNG ──────────────────────────────────────────────────────────────
  const handleDeleteZone = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa khu vực "${name}"?\n\nLưu ý: Chỉ có thể xóa vùng khi không còn tín hiệu SOS hoặc nhiệm vụ đang thực hiện.`
      )
    )
      return;
    try {
      await api.zones.delete(id);
      alert(`Đã xóa khu vực "${name}" thành công!`);
      await fetchZones(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || "Lỗi khi xóa khu vực");
    }
  };

  // ── TẠO VÙNG MỚI ──────────────────────────────────────────────────────────
  const handleCreateZone = async () => {
    try {
      if (!newZone.name.trim()) {
        alert("Vui lòng nhập tên khu vực.");
        return;
      }
      if (!addressInput.trim()) {
        alert("Vui lòng nhập địa chỉ để xác định đúng vị trí vùng.");
        return;
      }
      let lat = newZone.location_lat;
      let lng = newZone.location_lng;

      const address = `${addressInput}, Việt Nam`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        lat = data[0].lat;
        lng = data[0].lon;
      } else {
        alert("Không tìm thấy tọa độ của địa chỉ này. Vui lòng kiểm tra và thử lại.");
        return;
      }

      await api.zones.create({
        ...newZone,
        location_lat: lat,
        location_lng: lng,
      });
      setShowCreateModal(false);
      setAddressInput("");
      setNewZone({
        name: "",
        sector_code: "",
        location_lat: "10.76",
        location_lng: "106.66",
        severity: "MEDIUM",
        status: "ACTIVE",
      });
      alert("Tạo khu vực cứu hộ mới thành công!");
      fetchZones();
    } catch (error) {
      alert("Lỗi khi tạo vùng mới");
    }
  };

  // ── SỬA / ĐIỀU CHỈNH VÙNG ──────────────────────────────────────────────────
  const openEditModal = (z: any) => {
    setEditingZone(z);
    setEditFormData({
      name: z.name || "",
      sector_code: z.sector_code || "",
      severity: z.severity || "MEDIUM",
      status: z.status || "ACTIVE",
      location_lat: z.location_lat ? String(z.location_lat) : "10.76",
      location_lng: z.location_lng ? String(z.location_lng) : "106.66",
      rescuers_needed: z.rescuers_needed || 1,
      description: z.description || "",
    });
    setEditAddressInput("");
    setShowEditModal(true);
  };

  const handleEditGeocode = async () => {
    if (!editAddressInput.trim()) {
      alert("Vui lòng nhập địa chỉ cần tìm kiếm tọa độ.");
      return;
    }
    try {
      const address = `${editAddressInput}, Việt Nam`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setEditFormData((prev) => ({
          ...prev,
          location_lat: String(data[0].lat),
          location_lng: String(data[0].lon),
        }));
        alert(`Đã tìm thấy tọa độ: ${data[0].lat}, ${data[0].lon}`);
      } else {
        alert("Không tìm thấy tọa độ cho địa chỉ này.");
      }
    } catch (err) {
      alert("Lỗi khi tra cứu địa chỉ.");
    }
  };

  const handleUpdateZoneSubmit = async () => {
    if (!editingZone) return;
    if (!editFormData.name.trim()) return alert("Tên vùng không được để trống.");

    setSavingEdit(true);
    try {
      await api.zones.update(editingZone.id, {
        name: editFormData.name,
        sector_code: editFormData.sector_code,
        severity: editFormData.severity,
        status: editFormData.status,
        location_lat: editFormData.location_lat,
        location_lng: editFormData.location_lng,
        rescuers_needed: Number(editFormData.rescuers_needed) || 0,
        description: editFormData.description,
      });
      alert(`Đã cập nhật thông tin vùng "${editFormData.name}" thành công!`);
      setShowEditModal(false);
      setEditingZone(null);
      await fetchZones(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || "Lỗi khi cập nhật khu vực");
    } finally {
      setSavingEdit(false);
    }
  };

  // Cập nhật nhanh trạng thái hoặc mức độ trực tiếp trên bảng
  const handleQuickUpdate = async (id: string, data: any) => {
    try {
      await api.zones.update(id, data);
      await fetchZones(false);
    } catch (error: any) {
      alert(error?.response?.data?.error || error?.message || "Lỗi khi cập nhật");
    }
  };

  // ── GỘP VÙNG (MERGE ZONES) ─────────────────────────────────────────────────
  const openMergeModal = (preselectedZone?: any) => {
    const activeZones = zones.filter((z) => z.status !== "RESOLVED");
    if (activeZones.length < 2) {
      alert("Cần ít nhất 2 vùng đang hoạt động để thực hiện gộp vùng.");
      return;
    }
    if (preselectedZone) {
      setMergeTargetZoneId(preselectedZone.id);
      setMergeSourceZoneIds([]);
    } else {
      setMergeTargetZoneId(activeZones[0]?.id || "");
      setMergeSourceZoneIds([]);
    }
    setShowMergeModal(true);
  };

  const handleExecuteMerge = async () => {
    if (!mergeTargetZoneId) return alert("Vui lòng chọn Vùng đích.");
    if (mergeSourceZoneIds.length === 0) return alert("Vui lòng chọn ít nhất một Vùng nguồn để gộp.");

    const target = zones.find((z) => z.id === mergeTargetZoneId);
    const sourceNames = zones
      .filter((z) => mergeSourceZoneIds.includes(z.id))
      .map((z) => z.name)
      .join(", ");

    if (
      !window.confirm(
        `XÁC NHẬN GỘP VÙNG:\n\nBạn có chắc chắn muốn gộp các vùng:\n👉 [${sourceNames}]\nvào vùng đích:\n🎯 [${target?.name}]?\n\nToàn bộ các tín hiệu SOS từ vùng nguồn sẽ được chuyển sang vùng đích.`
      )
    ) {
      return;
    }

    setMerging(true);
    try {
      const res = await api.zones.manage({
        action: "merge_zones",
        target_zone: mergeTargetZoneId,
        source_zone_ids: mergeSourceZoneIds,
      });
      alert(res.data?.message || "Đã gộp vùng thành công!");
      setShowMergeModal(false);
      setMergeSourceZoneIds([]);
      await fetchZones(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || "Lỗi khi gộp vùng cứu hộ");
    } finally {
      setMerging(false);
    }
  };

  // ── TÁCH SOS / TÁCH VÙNG (DETACH / MOVE SOS) ───────────────────────────────
  const openDetachModal = (zone: any) => {
    setDetachZone(zone);
    setSelectedDetachSosIds([]);
    setDetachActionType("detach");
    setDetachTargetZoneId("");
    setShowDetachModal(true);
  };

  // SOS thuộc vùng đang chọn tách
  const currentZoneSosList = useMemo(() => {
    if (!detachZone) return [];
    return sosList.filter((s) => s.zone === detachZone.id);
  }, [detachZone, sosList]);

  const handleExecuteDetach = async () => {
    if (!detachZone) return;
    if (selectedDetachSosIds.length === 0) {
      alert("Vui lòng tick chọn ít nhất một tín hiệu SOS cần thao tác.");
      return;
    }

    setDetaching(true);
    try {
      if (detachActionType === "detach") {
        await api.zones.manage({
          action: "detach_sos",
          sos_ids: selectedDetachSosIds,
        });
        alert(`Đã tách thành công ${selectedDetachSosIds.length} SOS ra khỏi vùng "${detachZone.name}".`);
      } else {
        if (!detachTargetZoneId) {
          alert("Vui lòng chọn vùng đích để chuyển SOS sang.");
          setDetaching(false);
          return;
        }
        const target = zones.find((z) => z.id === detachTargetZoneId);
        await api.zones.manage({
          action: "move_sos",
          target_zone: detachTargetZoneId,
          sos_ids: selectedDetachSosIds,
        });
        alert(
          `Đã chuyển thành công ${selectedDetachSosIds.length} SOS sang vùng "${target?.name}".`
        );
      }
      setShowDetachModal(false);
      setSelectedDetachSosIds([]);
      setDetachZone(null);
      await fetchZones(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || "Lỗi khi thực hiện tách/chuyển SOS");
    } finally {
      setDetaching(false);
    }
  };

  // ── GỘP SOS ĐƠN LẺ VÀO VÙNG (DEDICATED MOVE SOS MODAL) ────────────────────
  const openMoveSosModal = (preselectedSosIds?: string[]) => {
    if (singleSos.length === 0) {
      alert("Hiện không có tín hiệu SOS đơn lẻ nào để gộp vào vùng.");
      return;
    }
    const activeZones = zones.filter((z) => z.status !== "RESOLVED");
    if (activeZones.length === 0) {
      alert("Hiện chưa có Vùng cứu hộ nào đang mở. Vui lòng tạo Vùng mới trước.");
      return;
    }
    setMoveSosTargetZoneId(activeZones[0]?.id || "");
    if (preselectedSosIds && preselectedSosIds.length > 0) {
      setSelectedSingleSosIds(preselectedSosIds);
    } else if (selectedSingleSosIds.length === 0) {
      setSelectedSingleSosIds([singleSos[0].id]);
    }
    setMoveSosSearchQuery("");
    setShowMoveSosModal(true);
  };

  const handleExecuteMoveSos = async () => {
    if (!moveSosTargetZoneId) return alert("Vui lòng chọn Vùng tiếp nhận.");
    if (selectedSingleSosIds.length === 0) return alert("Vui lòng chọn ít nhất một tín hiệu SOS cần gộp.");

    const target = zones.find((z) => z.id === moveSosTargetZoneId);
    setMovingSos(true);
    try {
      await api.zones.manage({
        action: "move_sos",
        target_zone: moveSosTargetZoneId,
        sos_ids: selectedSingleSosIds,
      });
      alert(
        `Đã gộp thành công ${selectedSingleSosIds.length} tín hiệu SOS vào vùng "${target?.name}"!`
      );
      setShowMoveSosModal(false);
      setSelectedSingleSosIds([]);
      await fetchZones(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || "Lỗi khi gộp SOS vào vùng");
    } finally {
      setMovingSos(false);
    }
  };

  // ── ĐIỀU PHỐI SOS ĐƠN LẺ (GIAO ĐỘI) ───────────────────────────────────────
  const openSingleDispatch = async (sos: any) => {
    setSelectedSingleSos(sos);
    if (dispatchDataLoaded) return;
    setLoadingDispatchData(true);
    try {
      const [rescuerRes, resourceRes] = await Promise.all([
        api.accounts.getRescuers(),
        api.resources.getAll(),
      ]);
      setRescuers(rescuerRes.data.results || rescuerRes.data || []);
      setResources(resourceRes.data.results || []);
      setDispatchDataLoaded(true);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || "Không tải được danh sách đội.");
    } finally {
      setLoadingDispatchData(false);
    }
  };

  const dispatchSingleSos = async () => {
    if (!selectedSingleSos || !selectedRescuer) return alert("Hãy chọn đội cứu hộ.");
    setDispatchingSingle(true);
    try {
      await api.missions.create({
        rescuer: selectedRescuer,
        sos_ids: [selectedSingleSos.id],
        role: "Cứu hộ ca SOS đơn lẻ",
      });
      alert("Đã phân công đội cứu hộ cho SOS đơn lẻ thành công!");
      setSelectedSingleSos(null);
      setSelectedRescuer("");
      await fetchZones(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || "Không thể phân công SOS đơn lẻ.");
    } finally {
      setDispatchingSingle(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <SliderBar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#F8F9FA] flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
          <DataNotice loading={loading} error={loadError} onRetry={() => fetchZones(false)} hasData={Object.keys(lastResponses.current).length > 0} />
          {/* Header Title */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="inline-flex items-center bg-blue-50 py-1 px-3 gap-2 rounded-full mb-2 border border-blue-100">
                <div className="bg-blue-600 w-2 h-2 rounded-full animate-pulse" />
                <span className="text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                  AI Clustering Active
                </span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Quản lý Vùng Cứu hộ
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Quan sát trực quan bản đồ, điều phối và thực hiện các thao tác gộp vùng, gộp SOS đơn lẻ, tách, sửa, xóa vùng cứu hộ.
              </p>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              label="SOS KHẨN HÔM NAY"
              val={sosToday}
              sub={`Trend: ${sosTrend}% so với hôm qua`}
              color="#B7131A"
            />
            <MetricCard
              label="TỔNG KHU VỰC"
              val={zones.length}
              sub={
                newZonesToday > 0 ? `+${newZonesToday} mới trong ngày` : "Cập nhật thời gian thực"
              }
              color="#005FAF"
            />
            <MetricCard
              label="SOS ĐƠN LẺ CHƯA VÀO VÙNG"
              val={singleSos.length}
              sub="Cần gộp vào vùng hoặc giao đội"
              color="#D97706"
            />
            <MetricCard
              label="VÙNG ĐANG HOẠT ĐỘNG"
              val={activeWithSos.length}
              sub={`${resolvedZones.length} vùng đã hoàn thành`}
              color="#16A34A"
            />
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              BẢN ĐỒ TỔNG QUAN VÙNG CỨU HỘ & ĐIỂM SOS (INTERACTIVE OVERVIEW MAP)
              ══════════════════════════════════════════════════════════════════════ */}
          <div
            ref={mapRef}
            className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden transition-all duration-300"
          >
            {/* Map Top Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 flex flex-wrap items-center gap-2">
                    <span>Bản đồ Vùng Cứu hộ & Điểm SOS</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {mapZones.length} vùng hiển thị
                    </span>
                    {showSingleOnMap && mapSingleSos.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {mapSingleSos.length} SOS đơn lẻ
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Nhấp vào Vùng hoặc Điểm SOS để xem nhanh thông tin và thực hiện điều phối
                  </p>
                </div>
              </div>

              {/* Map Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowSingleOnMap(!showSingleOnMap)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showSingleOnMap
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Bật/Tắt hiển thị các điểm SOS đơn lẻ chưa thuộc vùng"
                >
                  {showSingleOnMap ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>SOS đơn lẻ</span>
                </button>

                <button
                  onClick={() => setShowResolvedOnMap(!showResolvedOnMap)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showResolvedOnMap
                      ? "bg-slate-800 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Bật/Tắt hiển thị các vùng đã giải quyết (RESOLVED)"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Vùng đã đóng</span>
                </button>

                <button
                  onClick={handleFitBounds}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Căn chỉnh thu phóng vừa toàn bộ các điểm trên bản đồ"
                >
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>Toàn cảnh</span>
                </button>

                <button
                  onClick={() => setIsMapExpanded(!isMapExpanded)}
                  className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  title={isMapExpanded ? "Thu nhỏ bản đồ" : "Mở rộng bản đồ"}
                >
                  {isMapExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Sub-bar: Bộ 4 nút thao tác gắn liền với bản đồ */}
            <div className="px-4 sm:px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Công cụ quản trị vùng:</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => openMoveSosModal()}
                  className="bg-[#005FAF] hover:bg-blue-700 text-white py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Gộp một hoặc nhiều tín hiệu SOS đơn lẻ vào một vùng cứu hộ"
                >
                  <FolderInput className="w-3.5 h-3.5" />
                  <span>Gộp SOS vào vùng</span>
                </button>

                <button
                  onClick={() => openMergeModal()}
                  className="bg-slate-900 hover:bg-slate-800 text-white py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Gộp các vùng cứu hộ vào một vùng"
                >
                  <Merge className="w-3.5 h-3.5" />
                  <span>Gộp vùng</span>
                </button>

                <button
                  onClick={() => {
                    const activeWithSosList = zones.filter((z) => (z.sos_count || 0) > 0);
                    if (activeWithSosList.length === 0) {
                      alert("Không có vùng nào đang chứa tín hiệu SOS để tách.");
                      return;
                    }
                    openDetachModal(activeWithSosList[0]);
                  }}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Tách các tín hiệu SOS ra khỏi vùng"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Tách SOS</span>
                </button>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-[#B7131A] hover:bg-red-700 text-white py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-red-900/10 cursor-pointer"
                  title="Tạo khu vực cứu hộ mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm khu vực mới</span>
                </button>
              </div>
            </div>

            {/* Map Container View */}
            <div
              className={`w-full transition-all duration-300 relative ${
                isMapExpanded ? "h-[460px]" : "h-72"
              }`}
            >
              <MapContainer
                center={defaultCenter}
                zoom={13}
                scrollWheelZoom={true}
                className="h-full w-full z-0"
                attributionControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
                  url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                  maxZoom={20}
                />
                <MapFlyController
                  center={flyCenter}
                  fitBoundsPoints={fitBoundsData}
                />

                {/* Circles & Markers cho các Vùng */}
                {mapZones.map((z) => {
                  const lat = parseFloat(z.location_lat);
                  const lng = parseFloat(z.location_lng);
                  const isResolved = z.status === "RESOLVED";
                  const sevInfo = SEVERITY_COLORS[z.severity] || SEVERITY_COLORS.MEDIUM;
                  const color = isResolved ? "#64748B" : sevInfo.hex;

                  return (
                    <React.Fragment key={`zone-group-${z.id}`}>
                      {/* Vòng tròn bán kính vùng */}
                      <Circle
                        center={[lat, lng]}
                        radius={1000}
                        pathOptions={{
                          color: color,
                          fillColor: color,
                          fillOpacity: isResolved ? 0.08 : 0.18,
                          weight: isResolved ? 1.5 : 2,
                          dashArray: isResolved ? "6, 6" : undefined,
                        }}
                      />

                      {/* Marker tâm vùng */}
                      <Marker position={[lat, lng]} icon={createZoneDivIcon(z)}>
                        <Popup className="custom-zone-popup">
                          <div className="p-1 min-w-[220px] max-w-[260px] text-xs">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-2">
                              <span className="font-black text-slate-900 text-sm truncate">
                                {z.name}
                              </span>
                              <span
                                className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                  isResolved ? "bg-slate-100 text-slate-600" : sevInfo.bg + " " + sevInfo.text
                                }`}
                              >
                                {isResolved ? "Đã giải quyết" : sevInfo.label}
                              </span>
                            </div>

                            <div className="space-y-1 text-slate-600 mb-3">
                              <p className="flex justify-between">
                                <span className="text-slate-400">Mã Sector:</span>
                                <span className="font-bold text-slate-800">{z.sector_code || "N/A"}</span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-400">Tín hiệu SOS:</span>
                                <span className="font-bold text-red-600">{z.sos_count || 0} yêu cầu</span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-400">Nạn nhân:</span>
                                <span className="font-bold text-slate-800">
                                  {z.people_affected || 0} người
                                </span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-400">Đội có mặt:</span>
                                <span className="font-bold text-blue-600">
                                  {z.missionCount || 0}/{z.rescuers_needed || 0} đội
                                </span>
                              </p>
                            </div>

                            {/* Action Buttons in Popup */}
                            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => handleViewDetail(z.id)}
                                className="px-2 py-1.5 bg-[#005FAF] hover:bg-blue-700 text-white rounded-lg font-bold text-[10px] text-center cursor-pointer"
                              >
                                🔎 Chi tiết
                              </button>
                              <button
                                onClick={() => openEditModal(z)}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] text-center cursor-pointer"
                              >
                                ✏️ Sửa vùng
                              </button>
                              <button
                                onClick={() => openDetachModal(z)}
                                disabled={(z.sos_count || 0) === 0}
                                className="px-2 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 text-slate-700 rounded-lg font-bold text-[10px] text-center cursor-pointer"
                              >
                                ✂️ Tách SOS
                              </button>
                              <button
                                onClick={() => openMergeModal(z)}
                                className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[10px] text-center cursor-pointer"
                              >
                                🔗 Gộp vùng
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  );
                })}

                {/* Markers cho SOS đơn lẻ */}
                {mapSingleSos.map((s) => {
                  const lat = parseFloat(s.location_lat);
                  const lng = parseFloat(s.location_lng);

                  return (
                    <Marker
                      key={`single-sos-${s.id}`}
                      position={[lat, lng]}
                      icon={createSingleSosDivIcon(s)}
                    >
                      <Popup className="custom-sos-popup">
                        <div className="p-1 min-w-[220px] max-w-[260px] text-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1.5">
                            <span className="font-black text-red-600 text-xs uppercase">
                              📍 SOS ĐƠN LẺ
                            </span>
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                s.verification_status === "VERIFIED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {s.verification_status === "VERIFIED" ? "Đã xác minh" : "Chưa xác minh"}
                            </span>
                          </div>

                          <p className="font-bold text-slate-900">
                            {s.contact_name || s.citizen_name || "Người dân ẩn danh"}
                          </p>
                          <p className="text-slate-500 text-[10px]">
                            {s.people_count || 1} người · {s.contact_phone || "Không có SĐT"}
                          </p>
                          <p className="text-slate-600 text-[10px] mt-1 line-clamp-2">
                            {s.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
                          </p>
                          {s.emergency_type && (
                            <p className="text-red-700 font-bold text-[10px] mt-0.5">
                              {s.emergency_type}
                            </p>
                          )}

                          <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                            {/* Nút Gộp SOS vào vùng trực tiếp từ Bản đồ */}
                            <button
                              onClick={() => openMoveSosModal([s.id])}
                              className="w-full py-1.5 bg-[#005FAF] hover:bg-blue-700 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                            >
                              <FolderInput className="w-3.5 h-3.5" />
                              <span>Gộp SOS này vào vùng</span>
                            </button>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => openSingleDispatch(s)}
                                className="flex-1 py-1 bg-red-50 text-[#B7131A] hover:bg-red-100 rounded-lg font-bold text-[10px] cursor-pointer"
                              >
                                🚑 Giao đội
                              </button>
                              <button
                                onClick={() => setSelectedSosDetailId(s.id)}
                                className="flex-1 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold text-[10px] cursor-pointer"
                              >
                                📄 Chi tiết
                              </button>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Chú thích màu sắc (Legend) nổi trên bản đồ - đặt trong MapContainer để popup (z-1000) đè lên trên */}
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute bottom-3 left-3 z-[450] bg-white/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-200/80 shadow-md flex items-center gap-3 text-[10px] font-bold text-slate-700 pointer-events-auto"
                >
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Nguy cấp
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Khẩn cấp
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Trung bình
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-600" /> Thấp
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" /> SOS đơn lẻ
                  </span>
                </div>
              </MapContainer>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              BẢNG DỮ LIỆU & BỘ LỌC QUẢN TRỊ VÙNG
              ══════════════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
            {/* Toolbar: Tabs, Search, and AI Clustering */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-50/50">
              {/* Tab filters */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveTab("ACTIVE")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "ACTIVE"
                      ? "bg-[#B7131A] text-white shadow-md shadow-red-900/20"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <span>🚨 Đang có sự cố (SOS &gt; 0)</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                      activeTab === "ACTIVE" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {activeWithSos.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("ALL")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "ALL"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <span>Tất cả</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                      activeTab === "ALL" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {zones.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("SINGLE")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "SINGLE"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-900/20"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <span>📍 SOS đơn lẻ</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                      activeTab === "SINGLE" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {singleSos.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("RESOLVED")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "RESOLVED"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/20"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <span>✅ Đã giải quyết</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                      activeTab === "RESOLVED" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {resolvedZones.length}
                  </span>
                </button>
              </div>

              {/* Actions & Search */}
              <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
                <input
                  type="text"
                  placeholder={
                    activeTab === "SINGLE" ? "Tìm người gửi, địa chỉ..." : "Tìm theo tên, mã sector..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#B7131A]/30 w-full sm:w-52"
                />

                <button
                  onClick={handleRunAIClustering}
                  disabled={runningAI}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
                  title="Chạy thuật toán AI để tự động phân tích và gom các tín hiệu SOS lân cận vào Vùng"
                >
                  {runningAI ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang gom cụm AI...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>AI Quét & Gom Cụm SOS</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* TAB: SOS ĐƠN LẺ */}
            {activeTab === "SINGLE" ? (
              <div className="p-4 sm:p-6 space-y-4">
                {/* Thanh tác vụ hàng loạt khi đã chọn ít nhất 1 SOS */}
                {selectedSingleSosIds.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                      <p className="text-xs font-black text-blue-950">
                        Đang chọn <strong>{selectedSingleSosIds.length}</strong> tín hiệu SOS đơn lẻ
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openMoveSosModal(selectedSingleSosIds)}
                        className="px-4 py-2 bg-[#005FAF] hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-900/10 cursor-pointer"
                      >
                        <FolderInput className="w-4 h-4" />
                        <span>Gộp {selectedSingleSosIds.length} SOS này vào Vùng</span>
                      </button>

                      <button
                        onClick={() => setSelectedSingleSosIds([])}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Bỏ chọn tất cả
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredSingleSos.length > 0 &&
                              selectedSingleSosIds.length === filteredSingleSos.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSingleSosIds(filteredSingleSos.map((s) => s.id));
                              } else {
                                setSelectedSingleSosIds([]);
                              }
                            }}
                            className="w-4 h-4 rounded text-[#005FAF] cursor-pointer"
                            title="Chọn tất cả SOS trên danh sách"
                          />
                        </th>
                        <th className="px-6 py-4">Người cần hỗ trợ</th>
                        <th className="px-6 py-4">Loại yêu cầu</th>
                        <th className="px-6 py-4">Xác minh</th>
                        <th className="px-6 py-4">Vị trí</th>
                        <th className="px-6 py-4">Thời gian</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSingleSos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-sm font-bold text-slate-400">
                            Không có SOS đơn lẻ đang chờ xử lý.
                          </td>
                        </tr>
                      ) : (
                        filteredSingleSos.map((s: any) => {
                          const isChecked = selectedSingleSosIds.includes(s.id);

                          return (
                            <tr
                              key={s.id}
                              className={`border-t border-slate-50 transition-colors ${
                                isChecked ? "bg-blue-50/50" : "hover:bg-amber-50/40"
                              }`}
                            >
                              <td className="px-4 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedSingleSosIds((prev) => prev.filter((id) => id !== s.id));
                                    } else {
                                      setSelectedSingleSosIds((prev) => [...prev, s.id]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-[#005FAF] cursor-pointer"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm font-black text-slate-900">
                                  {s.contact_name || s.citizen_name || "Người dân ẩn danh"}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {s.people_count || 1} người · {s.contact_phone || "Chưa có SĐT"}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-xs font-black text-red-700">
                                {s.emergency_type || "SOS"}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`text-[10px] font-black px-2 py-1 rounded-full ${
                                    s.verification_status === "VERIFIED"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {s.verification_status === "VERIFIED" ? "Đã xác minh" : "Chưa xác minh"}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-xs">
                                <p className="text-xs font-bold text-slate-700 truncate">
                                  {s.address || `${s.location_lat}, ${s.location_lng}`}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-[10px] text-slate-500">
                                {s.sent_at ? new Date(s.sent_at).toLocaleString("vi-VN") : "N/A"}
                              </td>
                              <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                {/* Nút Gộp SOS vào vùng trực tiếp */}
                                <button
                                  onClick={() => openMoveSosModal([s.id])}
                                  className="px-3 py-1.5 bg-[#005FAF] hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm flex-inline items-center gap-1"
                                  title="Gộp SOS này vào một Vùng cứu hộ"
                                >
                                  <span>📥 Gộp vào vùng</span>
                                </button>

                                <button
                                  onClick={() => openSingleDispatch(s)}
                                  className="px-3 py-1.5 bg-[#B7131A] hover:bg-red-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm"
                                  title="Phân công trực tiếp một đội cứu hộ cho SOS này"
                                >
                                  Phân công đội
                                </button>

                                <button
                                  onClick={() => setSelectedSosDetailId(s.id)}
                                  className="text-xs font-bold text-slate-500 hover:text-[#005FAF] underline cursor-pointer"
                                >
                                  Chi tiết
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* TAB: DANH SÁCH VÙNG CỨU HỘ */
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Khu vực</th>
                      <th className="px-6 py-4">Trạng thái</th>
                      <th className="px-6 py-4">Mức độ</th>
                      <th className="px-6 py-4">Số SOS</th>
                      <th className="px-6 py-4">Nạn nhân</th>
                      <th className="px-6 py-4">Đội có mặt</th>
                      <th className="px-6 py-4">Cập nhật</th>
                      <th className="px-6 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredZones.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-xl text-slate-400">
                              🔍
                            </div>
                            <p className="text-sm font-black text-slate-800">
                              {activeTab === "ACTIVE"
                                ? "Hiện không có khu vực nào có SOS chưa giải quyết."
                                : "Không tìm thấy khu vực nào phù hợp với bộ lọc."}
                            </p>
                            <p className="text-xs text-slate-400">
                              {activeTab === "ACTIVE" && (
                                <span>
                                  Bạn có thể kiểm tra tab{" "}
                                  <button
                                    onClick={() => setActiveTab("ALL")}
                                    className="text-[#005FAF] underline font-bold cursor-pointer"
                                  >
                                    Tất cả
                                  </button>{" "}
                                  hoặc nhấn nút gom cụm AI phía trên.
                                </span>
                              )}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredZones.map((z) => (
                        <tr
                          key={z.id}
                          className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="text-sm font-black text-slate-900">{z.name}</p>
                                <p className="text-[10px] text-slate-400">{z.sector_code || "N/A"}</p>
                              </div>
                              {z.location_lat && z.location_lng && (
                                <button
                                  onClick={() => handleFlyToZone(z)}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Định vị vùng này trên bản đồ"
                                >
                                  <Compass className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={z.status}
                              onChange={(e) => handleQuickUpdate(z.id, { status: e.target.value })}
                              className="text-[10px] font-black uppercase bg-slate-100 px-2 py-1 rounded-full cursor-pointer"
                            >
                              <option value="ACTIVE">{STATUS_LABELS.ACTIVE}</option>
                              <option value="STABILIZING">{STATUS_LABELS.STABILIZING}</option>
                              <option value="RESOLVED">{STATUS_LABELS.RESOLVED}</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={z.severity}
                              onChange={(e) => handleQuickUpdate(z.id, { severity: e.target.value })}
                              className="text-[10px] font-black uppercase bg-red-50 text-red-700 px-2 py-1 rounded-full cursor-pointer"
                            >
                              <option value="CRITICAL">🔴 Nguy hiểm</option>
                              <option value="HIGH">🟠 Khẩn cấp</option>
                              <option value="MEDIUM">🔵 Trung bình</option>
                              <option value="LOW">🟢 Thấp</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            {(z.sos_count || 0) === 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                0 SOS (Trống)
                              </span>
                            ) : (
                              <span className="font-black text-slate-900 text-sm">
                                {z.sos_count} SOS
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-black text-slate-900">
                            {z.people_affected || 0}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900">
                                {`${z.missionCount}/${z.rescuers_needed || 0} ĐỘI`}
                              </span>
                              {supportRequests.some(
                                (request: any) => request.zone === z.id && request.status === "OPEN"
                              ) && (
                                <button
                                  onClick={() => setSelectedHelpZone(z)}
                                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-[#B7131A] rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all border border-red-200 animate-pulse cursor-pointer"
                                  title="Có đội cứu hộ yêu cầu chi viện"
                                >
                                  <span>🚨 Chi viện</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[10px] text-slate-400 font-bold">
                            {z.updated_at ? new Date(z.updated_at).toLocaleString("vi-VN") : "N/A"}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                            <button
                              className="text-[#005FAF] hover:text-blue-800 text-xs font-bold cursor-pointer"
                              onClick={() => handleViewDetail(z.id)}
                            >
                              Chi tiết
                            </button>
                            <button
                              className="text-slate-600 hover:text-slate-900 text-xs font-bold cursor-pointer"
                              onClick={() => openEditModal(z)}
                              title="Chỉnh sửa thông tin vùng"
                            >
                              ✏️ Sửa
                            </button>
                            <button
                              className="text-amber-700 hover:text-amber-900 text-xs font-bold cursor-pointer"
                              onClick={() => openDetachModal(z)}
                              title="Tách hoặc chuyển các SOS ra khỏi vùng"
                            >
                              ✂️ Tách SOS
                            </button>
                            <button
                              className="text-slate-600 hover:text-slate-900 text-xs font-bold cursor-pointer"
                              onClick={() => openMergeModal(z)}
                              title="Gộp vùng này vào vùng khác"
                            >
                              🔗 Gộp
                            </button>
                            <button
                              className="text-slate-300 hover:text-rose-600 text-xs font-bold transition-colors cursor-pointer"
                              onClick={() => handleDeleteZone(z.id, z.name)}
                              title="Xóa khu vực này"
                            >
                              🗑️ Xóa
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS QUẢN TRỊ VÙNG
          ══════════════════════════════════════════════════════════════════════ */}

      {/* SOS Detail Modal */}
      <SOSDetailModal
        sosId={selectedSosDetailId}
        isOpen={!!selectedSosDetailId}
        onClose={() => setSelectedSosDetailId(null)}
        onUpdated={() => fetchZones(false)}
      />

      {/* Modal 1: GỘP SOS ĐƠN LẺ VÀO VÙNG (DEDICATED MODAL) */}
      {showMoveSosModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <FolderInput className="w-5 h-5 text-blue-400" />
                  <h2 className="text-xl font-black">Gộp SOS Đơn Lẻ Vào Vùng Cứu Hộ</h2>
                </div>
                <p className="opacity-70 text-xs mt-1">
                  Đưa các tín hiệu SOS tự do vào một Vùng cứu hộ để điều phối lực lượng tập trung.
                </p>
              </div>
              <button
                onClick={() => setShowMoveSosModal(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Bước 1: Chọn Vùng tiếp nhận */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" /> Bước 1: Chọn Vùng tiếp nhận
                </label>
                <select
                  value={moveSosTargetZoneId}
                  onChange={(e) => setMoveSosTargetZoneId(e.target.value)}
                  className="w-full mt-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="">-- Chọn vùng tiếp nhận --</option>
                  {zones
                    .filter((z) => z.status !== "RESOLVED")
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.sector_code || "N/A"}) · Hiện có {z.sos_count || 0} SOS · Mức độ {SEVERITY_COLORS[z.severity]?.label || z.severity}
                      </option>
                    ))}
                </select>
              </div>

              {/* Bước 2: Chọn các SOS đơn lẻ cần gộp */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Bước 2: Chọn các SOS cần gộp ({selectedSingleSosIds.length}/{singleSos.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSingleSosIds.length === singleSos.length) {
                        setSelectedSingleSosIds([]);
                      } else {
                        setSelectedSingleSosIds(singleSos.map((s) => s.id));
                      }
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {selectedSingleSosIds.length === singleSos.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                </div>

                {/* Ô tìm kiếm nhanh trong modal */}
                <input
                  type="text"
                  placeholder="Lọc nhanh người gửi, địa chỉ..."
                  value={moveSosSearchQuery}
                  onChange={(e) => setMoveSosSearchQuery(e.target.value)}
                  className="w-full mb-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {singleSos
                    .filter((s) => {
                      const q = moveSosSearchQuery.trim().toLowerCase();
                      return (
                        !q ||
                        [s.contact_name, s.citizen_name, s.address, s.emergency_type].some((v) =>
                          String(v || "").toLowerCase().includes(q)
                        )
                      );
                    })
                    .map((s) => {
                      const isSelected = selectedSingleSosIds.includes(s.id);

                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSingleSosIds((prev) => prev.filter((id) => id !== s.id));
                            } else {
                              setSelectedSingleSosIds((prev) => [...prev, s.id]);
                            }
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50 border-blue-300 shadow-sm"
                              : "bg-slate-50/70 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-blue-600 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 truncate">
                                {s.contact_name || s.citizen_name || "Người dân ẩn danh"}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {s.people_count || 1} người · {s.contact_phone || "Không có SĐT"} · {s.address || "Chưa có địa chỉ"}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-red-700 uppercase shrink-0 ml-2">
                            {s.emergency_type || "SOS"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Tóm tắt */}
              {moveSosTargetZoneId && selectedSingleSosIds.length > 0 && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs space-y-1 text-blue-950">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Xác nhận thông tin gộp:</span>
                  </p>
                  <p>
                    Sẽ gộp <strong>{selectedSingleSosIds.length} yêu cầu SOS</strong> vào vùng{" "}
                    <strong>{zones.find((z) => z.id === moveSosTargetZoneId)?.name}</strong>.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowMoveSosModal(false)}
                  className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleExecuteMoveSos}
                  disabled={movingSos || !moveSosTargetZoneId || selectedSingleSosIds.length === 0}
                  className="flex-1 py-3 bg-[#005FAF] hover:bg-blue-700 disabled:opacity-40 text-white font-black rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {movingSos ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang gộp vào vùng...</span>
                    </>
                  ) : (
                    <>
                      <FolderInput className="w-4 h-4" />
                      <span>Xác nhận gộp vào vùng</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Tạo Vùng Mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 bg-[#B7131A] text-white">
              <h2 className="text-2xl font-black">Tạo Vùng Mới</h2>
              <p className="opacity-75 text-sm mt-1">
                Xác định khu vực triển khai cứu hộ AI và điều phối lực lượng.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">Tên khu vực</label>
                <input
                  className="w-full mt-1 p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-[#B7131A]/50 text-sm font-bold"
                  placeholder="VD: Rốn lũ Nam Hòa Xuân..."
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">Mã Sector</label>
                <input
                  className="w-full mt-1 p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-[#B7131A]/50 text-sm font-bold"
                  placeholder="VD: HC-01..."
                  value={newZone.sector_code}
                  onChange={(e) => setNewZone({ ...newZone, sector_code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">
                  Địa chỉ trung tâm (Hệ thống tự tìm tọa độ GPS)
                </label>
                <input
                  className="w-full mt-1 p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-[#B7131A]/50 text-sm font-bold"
                  placeholder="VD: Hải Châu, Đà Nẵng..."
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Mức độ khẩn cấp</label>
                  <select
                    value={newZone.severity}
                    onChange={(e) => setNewZone({ ...newZone, severity: e.target.value })}
                    className="w-full mt-1 p-3 bg-slate-100 rounded-xl text-xs font-bold"
                  >
                    <option value="CRITICAL">🔴 Nguy hiểm</option>
                    <option value="HIGH">🟠 Khẩn cấp</option>
                    <option value="MEDIUM">🔵 Trung bình</option>
                    <option value="LOW">🟢 Thấp</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Trạng thái</label>
                  <select
                    value={newZone.status}
                    onChange={(e) => setNewZone({ ...newZone, status: e.target.value })}
                    className="w-full mt-1 p-3 bg-slate-100 rounded-xl text-xs font-bold"
                  >
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="STABILIZING">Đang ổn định</option>
                    <option value="STANDBY">Đang chờ</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreateZone}
                  className="flex-1 py-3 bg-[#B7131A] hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 cursor-pointer"
                >
                  Xác nhận tạo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Sửa / Điều chỉnh Vùng */}
      {showEditModal && editingZone && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black">Điều chỉnh Vùng Cứu hộ</h2>
                <p className="opacity-70 text-xs mt-0.5">{editingZone.name} · {editingZone.sector_code}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">Tên khu vực</label>
                <input
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Mã Sector</label>
                  <input
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                    value={editFormData.sector_code}
                    onChange={(e) => setEditFormData({ ...editFormData, sector_code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Số đội cần</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                    value={editFormData.rescuers_needed}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, rescuers_needed: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Mức độ khẩn cấp</label>
                  <select
                    value={editFormData.severity}
                    onChange={(e) => setEditFormData({ ...editFormData, severity: e.target.value })}
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="CRITICAL">🔴 Nguy hiểm</option>
                    <option value="HIGH">🟠 Khẩn cấp</option>
                    <option value="MEDIUM">🔵 Trung bình</option>
                    <option value="LOW">🟢 Thấp</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Trạng thái</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="STABILIZING">Đang ổn định</option>
                    <option value="RESOLVED">Đã giải quyết (Đóng vùng)</option>
                  </select>
                </div>
              </div>

              {/* Tọa độ & Geocoding */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-[11px] font-black text-slate-600 uppercase flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" /> Tọa độ trung tâm vùng
                </span>
                <div className="flex gap-2">
                  <input
                    placeholder="Nhập địa chỉ mới để cập nhật tọa độ..."
                    value={editAddressInput}
                    onChange={(e) => setEditAddressInput(e.target.value)}
                    className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                  />
                  <button
                    onClick={handleEditGeocode}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Tìm GPS
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Vĩ độ (Lat)</label>
                    <input
                      value={editFormData.location_lat}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, location_lat: e.target.value })
                      }
                      className="w-full mt-0.5 p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Kinh độ (Lng)</label>
                    <input
                      value={editFormData.location_lng}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, location_lng: e.target.value })
                      }
                      className="w-full mt-0.5 p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">Mô tả tình hình</label>
                <textarea
                  rows={2}
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold"
                  placeholder="Ghi chú thêm về địa hình, thời tiết, khó khăn tiếp cận..."
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateZoneSubmit}
                  disabled={savingEdit}
                  className="flex-1 py-3 bg-[#005FAF] hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Gộp Vùng Cứu Hộ (Merge Zones) */}
      {showMergeModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Merge className="w-5 h-5 text-blue-400" />
                  <h2 className="text-xl font-black">Gộp Vùng Cứu hộ</h2>
                </div>
                <p className="opacity-70 text-xs mt-1">
                  Chuyển toàn bộ các tín hiệu SOS từ các vùng nguồn vào một vùng đích.
                </p>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Chọn Vùng đích */}
              <div>
                <label className="text-[11px] font-black text-slate-600 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" /> Chọn Vùng Đích (Target Zone)
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">
                  Vùng sẽ tiếp nhận toàn bộ các tín hiệu SOS được gộp.
                </p>
                <select
                  value={mergeTargetZoneId}
                  onChange={(e) => {
                    const tid = e.target.value;
                    setMergeTargetZoneId(tid);
                    setMergeSourceZoneIds((prev) => prev.filter((id) => id !== tid));
                  }}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                >
                  <option value="">-- Chọn vùng tiếp nhận --</option>
                  {zones
                    .filter((z) => z.status !== "RESOLVED")
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.sector_code || "N/A"}) · {z.sos_count || 0} SOS
                      </option>
                    ))}
                </select>
              </div>

              {/* Chọn Các Vùng Nguồn */}
              <div>
                <label className="text-[11px] font-black text-slate-600 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Chọn Các Vùng Nguồn Cần Gộp (Source Zones)
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Các vùng này sẽ chuyển toàn bộ SOS sang vùng đích và tự động đóng/xóa nếu không còn nhiệm vụ.
                </p>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {zones
                    .filter((z) => z.id !== mergeTargetZoneId && z.status !== "RESOLVED")
                    .map((z) => {
                      const isSelected = mergeSourceZoneIds.includes(z.id);
                      const hasActiveMissions = (z.missionCount || 0) > 0;

                      return (
                        <div
                          key={z.id}
                          onClick={() => {
                            if (isSelected) {
                              setMergeSourceZoneIds((prev) => prev.filter((id) => id !== z.id));
                            } else {
                              setMergeSourceZoneIds((prev) => [...prev, z.id]);
                            }
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50 border-blue-300 shadow-sm"
                              : "bg-slate-50/70 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                            />
                            <div>
                              <p className="text-xs font-black text-slate-900">{z.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {z.sector_code || "N/A"} · {z.sos_count || 0} SOS
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {hasActiveMissions ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                ⚠️ {z.missionCount} đội đang hoạt động
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">Có thể gộp</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Tóm tắt thao tác */}
              {mergeTargetZoneId && mergeSourceZoneIds.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1 text-amber-900">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>Lưu ý quan trọng:</span>
                  </p>
                  <p>
                    Hệ thống sẽ gộp <strong>{mergeSourceZoneIds.length} vùng</strong> vào{" "}
                    <strong>{zones.find((z) => z.id === mergeTargetZoneId)?.name}</strong>.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Nếu vùng nguồn còn đội đang thực hiện nhiệm vụ, hệ thống backend sẽ từ chối thao tác để bảo vệ an toàn điều phối.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleExecuteMerge}
                  disabled={merging || !mergeTargetZoneId || mergeSourceZoneIds.length === 0}
                  className="flex-1 py-3 bg-[#005FAF] hover:bg-blue-700 disabled:opacity-40 text-white font-black rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {merging ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang gộp vùng...</span>
                    </>
                  ) : (
                    <>
                      <Merge className="w-4 h-4" />
                      <span>Xác nhận gộp</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Tách SOS / Tách Vùng (Detach / Move SOS) */}
      {showDetachModal && detachZone && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-black">Tách SOS khỏi Vùng</h2>
                </div>
                <p className="opacity-70 text-xs mt-1">
                  Khu vực: <strong>{detachZone.name}</strong> ({detachZone.sector_code || "N/A"}) · {currentZoneSosList.length} SOS
                </p>
              </div>
              <button
                onClick={() => setShowDetachModal(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Lựa chọn phương án tách */}
              <div>
                <label className="text-[11px] font-black text-slate-600 uppercase">
                  Hình thức xử lý SOS sau khi tách:
                </label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setDetachActionType("detach")}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      detachActionType === "detach"
                        ? "bg-amber-50 border-amber-400 shadow-sm text-amber-900"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <p className="text-xs font-black">Tách thành SOS đơn lẻ</p>
                    <p className="text-[10px] opacity-75 mt-0.5">
                      SOS độc lập, không thuộc vùng nào
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetachActionType("move")}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      detachActionType === "move"
                        ? "bg-blue-50 border-blue-400 shadow-sm text-blue-900"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <p className="text-xs font-black">Chuyển sang Vùng khác</p>
                    <p className="text-[10px] opacity-75 mt-0.5">
                      Gán các SOS đã chọn sang vùng mới
                    </p>
                  </button>
                </div>
              </div>

              {/* Nếu chọn chuyển sang vùng khác */}
              {detachActionType === "move" && (
                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase">
                    Chọn Vùng Đích mới
                  </label>
                  <select
                    value={detachTargetZoneId}
                    onChange={(e) => setDetachTargetZoneId(e.target.value)}
                    className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="">-- Chọn vùng tiếp nhận --</option>
                    {zones
                      .filter((z) => z.id !== detachZone.id && z.status !== "RESOLVED")
                      .map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} · {z.sos_count || 0} SOS
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Danh sách SOS trong vùng */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-black text-slate-600 uppercase">
                    Chọn các tín hiệu SOS cần tách ({selectedDetachSosIds.length}/{currentZoneSosList.length}):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDetachSosIds.length === currentZoneSosList.length) {
                        setSelectedDetachSosIds([]);
                      } else {
                        setSelectedDetachSosIds(currentZoneSosList.map((s) => s.id));
                      }
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {selectedDetachSosIds.length === currentZoneSosList.length
                      ? "Bỏ chọn tất cả"
                      : "Chọn tất cả"}
                  </button>
                </div>

                {currentZoneSosList.length === 0 ? (
                  <p className="py-8 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl">
                    Vùng này hiện không có tín hiệu SOS nào.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {currentZoneSosList.map((s) => {
                      const isSelected = selectedDetachSosIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDetachSosIds((prev) => prev.filter((id) => id !== s.id));
                            } else {
                              setSelectedDetachSosIds((prev) => [...prev, s.id]);
                            }
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? "bg-amber-50 border-amber-300 shadow-sm"
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-amber-600 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 truncate">
                                {s.contact_name || s.citizen_name || "Người dân ẩn danh"}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {s.people_count || 1} người · {s.address || "Chưa có địa chỉ"}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                              s.status === "RESOLVED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {s.status === "RESOLVED" ? "Đã giải quyết" : "Đang chờ"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowDetachModal(false)}
                  className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleExecuteDetach}
                  disabled={
                    detaching ||
                    selectedDetachSosIds.length === 0 ||
                    (detachActionType === "move" && !detachTargetZoneId)
                  }
                  className="flex-1 py-3 bg-[#B7131A] hover:bg-red-700 disabled:opacity-40 text-white font-black rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {detaching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4" />
                      <span>
                        {detachActionType === "detach" ? "Tách thành SOS đơn lẻ" : "Chuyển sang Vùng mới"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Điều phối SOS đơn lẻ (Phân công đội) */}
      {selectedSingleSos && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black">Phân công Đội cho SOS đơn lẻ</h2>
                <p className="text-sm text-white/70 mt-1">
                  {selectedSingleSos.contact_name || selectedSingleSos.citizen_name || "Người dân"} ·{" "}
                  {selectedSingleSos.people_count || 1} người · {selectedSingleSos.emergency_type || "SOS"}
                </p>
              </div>
              <button
                onClick={() => setSelectedSingleSos(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {selectedSingleSos.verification_status !== "VERIFIED" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800">
                  SOS chưa được xác minh. Đội vẫn có thể đi kiểm tra thực địa và báo kết quả.
                </div>
              )}

              <div>
                <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                  <span>🚑</span> Chọn một đội cứu hộ sẵn sàng
                </label>
                <select
                  disabled={loadingDispatchData}
                  value={selectedRescuer}
                  onChange={(e) => setSelectedRescuer(e.target.value)}
                  className="w-full mt-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  <option value="">-- Chọn đội đang rảnh --</option>
                  {rescuers.map((rescuer: any) => {
                    const busy = missionsList.some(
                      (mission: any) =>
                        mission.rescuer === rescuer.id &&
                        ["PENDING_ACCEPTANCE", "ACCEPTED", "ON_MY_WAY", "ACTIVE", "NEEDS_HELP"].includes(
                          mission.status
                        )
                    );
                    const resource = resources.find((item: any) => item.rescuer === rescuer.id);
                    const unavailable = busy || !rescuer.is_active || !resource?.confirmed_at || !resource?.is_available;
                    return (
                      <option key={rescuer.id} value={rescuer.id} disabled={unavailable}>
                        {rescuer.full_name || rescuer.username}{" "}
                        {busy
                          ? "· Đang có nhiệm vụ"
                          : unavailable
                          ? "· Chưa xác nhận nguồn lực"
                          : "· Sẵn sàng"}
                      </option>
                    );
                  })}
                </select>
                <button
                  disabled={!selectedRescuer || dispatchingSingle}
                  onClick={dispatchSingleSos}
                  className="w-full mt-3 py-3 bg-[#B7131A] hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-black cursor-pointer shadow-md"
                >
                  {dispatchingSingle ? "Đang phân công..." : "Giao SOS đơn lẻ cho đội"}
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <button
                  onClick={() => {
                    const targetSosId = selectedSingleSos.id;
                    setSelectedSingleSos(null);
                    openMoveSosModal([targetSosId]);
                  }}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-[#005FAF] font-black rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FolderInput className="w-4 h-4" />
                  <span>Hoặc đưa SOS này vào một Vùng cứu hộ</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedSingleSos(null);
                  setSelectedRescuer("");
                }}
                className="w-full py-2 text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 7: Yêu cầu Chi viện */}
      {selectedHelpZone && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 bg-[#B7131A] text-white">
              <h2 className="text-2xl font-black">🚨 Chi Viện Cấp Bách</h2>
              <p className="opacity-75 text-sm mt-1">
                Các đội cứu hộ đang yêu cầu thêm lực lượng tại <strong>{selectedHelpZone.name}</strong>.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Danh sách đội yêu cầu hỗ trợ:
              </p>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {supportRequests
                  .filter((request: any) => request.zone === selectedHelpZone.id && request.status !== "CLOSED")
                  .map((request: any) => (
                    <div
                      key={request.id}
                      className="bg-red-50 p-4 rounded-2xl flex justify-between items-center border border-red-100"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="text-sm font-black text-slate-800 truncate">
                          {request.rescuer_name || "Đội cứu hộ"}
                        </p>
                        <p className="text-[10px] text-[#B7131A] font-bold uppercase mt-0.5">
                          {request.resource_type} · số lượng {request.quantity}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">{request.note}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedHelpZone(null);
                          navigate(`/details-rescue-zone/${selectedHelpZone.id}`);
                        }}
                        className="px-3 py-2 bg-[#B7131A] text-white text-[10px] font-black rounded-xl hover:bg-red-700 transition-all shadow-md shrink-0 cursor-pointer"
                      >
                        Mở điều phối
                      </button>
                    </div>
                  ))}
              </div>
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setSelectedHelpZone(null)}
                  className="w-full py-3 font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MetricCard = ({ label, val, sub, color }: any) => (
  <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <h2 className="text-3xl font-black mt-1" style={{ color }}>
      {val}
    </h2>
    <p className="text-[10px] font-bold text-slate-400 mt-1">{sub}</p>
  </div>
);
