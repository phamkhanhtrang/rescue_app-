import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import SOSDetailModal from "../../components/SOSDetailModal";
import TeamDetailModal from "../../components/TeamDetailModal";
import { api } from "../../services/api";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";

// Icons
import { MdOutlineHealthAndSafety, MdOutlineCrisisAlert, MdOutlineWarningAmber, MdOutlineLocationOn } from 'react-icons/md';
import { RiClipboardLine, RiBarChartGroupedLine, RiCheckboxCircleLine } from 'react-icons/ri';
import { ChevronRight } from 'lucide-react';

// Leaflet
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Status & Severity helpers ────────────────────────────────────────────────

const SEVERITY_MAP: Record<string, { label: string; bgCard: string; textColor: string; barColor: string }> = {
  CRITICAL: { label: "🔴 Nguy Hiểm", bgCard: "bg-red-50",    textColor: "text-red-700",  barColor: "bg-red-600" },
  HIGH:     { label: "🟠 Khẩn Cấp",  bgCard: "bg-orange-50", textColor: "text-orange-700",barColor: "bg-orange-500" },
  MEDIUM:   { label: "🔵 Trung Bình", bgCard: "bg-blue-50",   textColor: "text-blue-700", barColor: "bg-blue-500" },
  LOW:      { label: "🟢 Thấp",       bgCard: "bg-green-50",  textColor: "text-green-700",barColor: "bg-green-500" },
};

const MISSION_STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE:      { label: "Đang hoạt động", bg: "bg-green-100",  text: "text-green-700" },
  ON_MY_WAY:   { label: "Đang đến",       bg: "bg-blue-100",   text: "text-blue-700" },
  NEEDS_HELP:  { label: "Cần hỗ trợ",     bg: "bg-red-100",    text: "text-red-700" },
  COMPLETED:   { label: "Hoàn thành",     bg: "bg-slate-100",  text: "text-slate-500" },
  CANCELLED:   { label: "Đã hủy",         bg: "bg-slate-100",  text: "text-slate-400" },
};

const SOS_STATUS_MAP: Record<string, { label: string; dot: string }> = {
  PENDING:     { label: "Chờ xử lý",    dot: "bg-yellow-400" },
  ACKNOWLEDGED:{ label: "Đã tiếp nhận", dot: "bg-blue-400"   },
  IN_PROGRESS: { label: "Đang xử lý",   dot: "bg-orange-400" },
  RESOLVED:    { label: "Đã giải quyết",dot: "bg-green-400"  },
  CANCELLED:   { label: "Đã hủy",       dot: "bg-slate-300"  },
};

const LEVEL_MAP: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung Bình",
  HIGH: "Cao",
  CRITICAL: "Nguy Hiểm"
};

const STATUS: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  STABILIZING: "Đang ổn định",
  RESOLVED: "Đã giải quyết",
  STANDBY: "Chờ xử lý"
};

const createSosDotIcon = (status: string) => {
  let color = '#f59e0b';
  if (status === 'RESOLVED') color = '#10b981';
  else if (status === 'IN_PROGRESS' || status === 'ACKNOWLEDGED') color = '#3b82f6';
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 9999px; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.35);"></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

// ────────────────────────────────────────────────────────────────────────────

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zone, setZone] = useState<any>(null);
  const [sosList, setSosList] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // SOS Detail Modal
  const [selectedSosId, setSelectedSosId] = useState<string | null>(null);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);

  // Team Detail Modal
  const [selectedRescuerId, setSelectedRescuerId] = useState<string | null>(null);

  // SOS Status Filter
  const [sosFilter, setSosFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');

  const fetchAll = async () => {
    if (!id) return;
    if (!zone) setLoading(true);
    try {
      const [zoneRes, sosRes, missionRes] = await Promise.allSettled([
        api.zones.getDetail(id),
        api.sos.getAll({ zone: id }),
        api.missions.getAll({ zone_id: id }),
      ]);
      const failures: string[] = [];
      if (zoneRes.status === 'fulfilled') setZone(zoneRes.value.data);
      else failures.push(`khu vực: ${apiErrorMessage(zoneRes.reason)}`);
      if (sosRes.status === 'fulfilled') setSosList(Array.isArray(sosRes.value.data) ? sosRes.value.data : sosRes.value.data.results || []);
      else failures.push(`SOS: ${apiErrorMessage(sosRes.reason)}`);
      if (missionRes.status === 'fulfilled') setMissions(Array.isArray(missionRes.value.data) ? missionRes.value.data : missionRes.value.data.results || []);
      else failures.push(`nhiệm vụ: ${apiErrorMessage(missionRes.reason)}`);
      setLoadError(failures.length ? `Không cập nhật được ${failures.join('; ')}.` : '');
    } catch (e) {
      console.error("Lỗi tải dữ liệu chi tiết vùng:", e);
      setLoadError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [id]);

  // Derived stats
  const sev = zone ? (SEVERITY_MAP[zone.severity] ?? SEVERITY_MAP.MEDIUM) : SEVERITY_MAP.MEDIUM;
  const activeMissions = missions.filter(m => ['ACTIVE', 'ON_MY_WAY', 'NEEDS_HELP'].includes(m.status));
  const sosActive = sosList.filter(s => !['RESOLVED', 'CANCELLED'].includes(s.status)).length;
  const needsHelpCount = missions.filter(m => m.status === 'NEEDS_HELP').length;

  const sosPendingCount = sosList.filter(s => s.status === 'PENDING').length;
  const sosInProgressCount = sosList.filter(s => ['IN_PROGRESS', 'ACKNOWLEDGED'].includes(s.status)).length;
  const sosResolvedCount = sosList.filter(s => s.status === 'RESOLVED').length;

  const filteredSosList = useMemo(() => {
    if (sosFilter === 'PENDING') return sosList.filter(s => s.status === 'PENDING');
    if (sosFilter === 'IN_PROGRESS') return sosList.filter(s => ['IN_PROGRESS', 'ACKNOWLEDGED'].includes(s.status));
    if (sosFilter === 'RESOLVED') return sosList.filter(s => s.status === 'RESOLVED');
    return sosList;
  }, [sosList, sosFilter]);

  const hasCoordinates = zone?.location_lat && zone?.location_lng && !isNaN(parseFloat(zone.location_lat));
  const zoneCenter: [number, number] = hasCoordinates
    ? [parseFloat(zone.location_lat), parseFloat(zone.location_lng)]
    : [16.0544, 108.2022];

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <SliderBar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="px-6 pt-4"><DataNotice loading={loading} error={loadError} onRetry={fetchAll} hasData={!!zone} /></div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-[#B7131A] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-500 text-sm font-bold">Đang tải dữ liệu khu vực...</p>
            </div>
          </div>
        ) : !zone ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center space-y-2">
              <p className="text-2xl font-black text-slate-800 flex items-center justify-center gap-2">
                <MdOutlineWarningAmber className="text-yellow-500 text-3xl" />
                {loadError ? 'Không tải được khu vực cứu hộ' : 'Không tìm thấy khu vực cứu hộ'}
              </p>
              <p className="text-xs text-slate-500">{loadError ? 'Hãy thử tải lại dữ liệu.' : 'Khu vực không tồn tại hoặc đã bị xóa.'}</p>
              <button onClick={() => navigate("/rescue-zone-management")} className="mt-2 text-[#005FAF] text-sm font-bold underline">
                ← Quay lại Quản lý Vùng Cứu hộ
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 md:px-10 pb-16 space-y-8">

            {/* ── BREADCRUMB & BACK ── */}
            <div className="pt-6 flex items-center justify-between">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#B7131A] transition-colors cursor-pointer"
              >
                <span>←</span>
                <span>Quay lại</span>
              </button>
            </div>

            {/* ── TIÊU ĐỀ VÙNG CỨU HỘ ── */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full font-mono">
                  ID: {zone.id?.slice(0, 8)}…
                </span>
                <span className="bg-blue-50 text-[#005FAF] text-[10px] font-black px-3 py-1 rounded-full">
                  🗺 {zone.sector_code || 'N/A'}
                </span>
                <span className={`${sev.bgCard} ${sev.textColor} text-[10px] font-black px-3 py-1 rounded-full`}>
                  {sev.label}
                </span>
                {needsHelpCount > 0 && (
                  <span className="bg-red-50 text-[#B7131A] text-[10px] font-black px-2 py-1 rounded-lg border border-red-200 flex items-center gap-1">
                    <MdOutlineCrisisAlert className="text-sm" />
                    {needsHelpCount} đội cần hỗ trợ
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 leading-tight">
                {zone.name}
              </h1>
            </div>

            {/* ── HÀNG DƯỚI TIÊU ĐỀ: BẢN ĐỒ (GÓC PHẦN TƯ TRÊN TRÁI) + MỨC ĐỘ & KPI (BÊN PHẢI) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Bản đồ hình vuông ở góc phần tư trên trái */}
              <div className="lg:col-span-4">
                <div className="w-full aspect-square rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative bg-white">
                  {hasCoordinates ? (
                    <MapContainer
                      center={zoneCenter}
                      zoom={14}
                      scrollWheelZoom={false}
                      className="h-full w-full"
                      attributionControl={false}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Circle
                        center={zoneCenter}
                        radius={1000}
                        pathOptions={{
                          color: zone.severity === 'CRITICAL' ? '#dc2626' : '#2563eb',
                          fillColor: zone.severity === 'CRITICAL' ? '#fee2e2' : '#dbeafe',
                          fillOpacity: 0.25,
                          weight: 2,
                        }}
                      />
                      <Marker position={zoneCenter}>
                        <Popup>
                          <div className="p-1 text-xs">
                            <p className="font-bold text-slate-900">{zone.name}</p>
                            <p className="text-slate-500">Mã: {zone.sector_code || 'N/A'}</p>
                          </div>
                        </Popup>
                      </Marker>
                      {sosList
                        .filter(s => s.location_lat && s.location_lng && !isNaN(parseFloat(s.location_lat)))
                        .map(s => (
                          <Marker
                            key={s.id}
                            position={[parseFloat(s.location_lat), parseFloat(s.location_lng)]}
                            icon={createSosDotIcon(s.status)}
                            eventHandlers={{
                              click: () => {
                                setSelectedSosId(s.id);
                                setIsSosModalOpen(true);
                              },
                            }}
                          />
                        ))}
                    </MapContainer>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-slate-50">
                      <MdOutlineLocationOn className="text-3xl text-slate-300 mb-1" />
                      <p className="text-xs font-bold text-slate-400">Chưa có tọa độ GPS</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Phần bên phải: Thẻ mức độ khẩn cấp + 4 Thẻ thống kê KPI */}
              <div className="lg:col-span-8 flex flex-col justify-between gap-4">
                {/* Risk severity card */}
                <div className={`${sev.bgCard} border border-current/10 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                  <div>
                    <p className={`${sev.textColor} text-[10px] font-black uppercase tracking-widest mb-1`}>Mức độ khẩn cấp</p>
                    <p className={`${sev.textColor} text-3xl font-black`}>{LEVEL_MAP[zone.severity || "N/A"]}</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-xl leading-relaxed">
                      {zone.description || "Chưa có mô tả chi tiết cho vùng cứu hộ này."}
                    </p>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <span className="text-slate-400 text-[10px] font-bold flex items-center sm:justify-end gap-1">
                      <MdOutlineLocationOn className="text-xs" />
                      {hasCoordinates
                        ? `${parseFloat(zone.location_lat).toFixed(5)}, ${parseFloat(zone.location_lng).toFixed(5)}`
                        : 'Chưa có tọa độ'}
                    </span>
                  </div>
                </div>

                {/* 4 Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard label="Tổng SOS" total={sosList.length} unit="tín hiệu" color="text-[#B7131A]" />
                  <StatCard label="Đội Cứu Hộ Có Mặt" total={zone.rescuers_needed || 0} unit="đội" color="text-[#005FAF]" />
                  <StatCard label="Người Bị Ảnh Hưởng" value={zone.people_affected || 0} total={null} unit="người" color="text-orange-600" />
                  <StatCard
                    label="Ưu Tiên AI"
                    value={zone.ai_priority_score != null && !isNaN(Number(zone.ai_priority_score)) ? Number(zone.ai_priority_score).toFixed(1) : 'N/A'}
                    total={null}
                    unit="điểm"
                    color="text-purple-600"
                  />
                </div>
              </div>

            </div>

            {/* ── MAIN GRID: Active Units + SOS List ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Active Units (from real missions) */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <MdOutlineHealthAndSafety className="text-red-600 text-lg" />
                      Đội Cứu Hộ
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{activeMissions.length} / {zone.rescuers_needed || 0} đội theo yêu cầu</p>
                  </div>
                  {needsHelpCount > 0 && (
                    <span className="bg-red-50 text-[#B7131A] text-[10px] font-black px-2 py-1 rounded-lg border border-red-200 flex items-center gap-1">
                      <MdOutlineCrisisAlert className="text-sm" />
                      {needsHelpCount} cần hỗ trợ
                    </span>
                  )}
                </div>
                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                  {activeMissions.length === 0 ? (
                    <div className="px-6 py-10 text-center text-slate-400 text-sm font-bold">
                      Chưa có đội cứu hộ nào tại vùng này.
                    </div>
                  ) : (
                    activeMissions.map((m: any) => {
                      const ms = MISSION_STATUS_MAP[m.status] ?? { label: m.status, bg: "bg-slate-100", text: "text-slate-500" };
                      const rescuerId = typeof m.rescuer === 'object' ? m.rescuer?.id : (m.rescuer || m.rescuer_id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            if (rescuerId) setSelectedRescuerId(String(rescuerId));
                          }}
                          className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl ${m.status === 'NEEDS_HELP' ? 'bg-red-100' : 'bg-blue-50'} flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform`}>
                              {m.status === 'NEEDS_HELP' ? '🆘' : '🧑‍🚒'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                {m.rescuer_name || 'Cứu hộ viên'}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold">
                                {m.role || 'Đội cứu hộ'} · Tham gia {new Date(m.joined_at).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`${ms.bg} ${ms.text} text-[10px] font-black px-2 py-1 rounded-lg`}>
                              {ms.label}
                            </span>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Completed missions */}
                {missions.filter(m => m.status === 'COMPLETED').length > 0 && (
                  <div className="border-t border-slate-100">
                    <div className="px-6 py-3 bg-slate-50 flex items-center gap-2">
                      <RiCheckboxCircleLine className="text-green-600 text-base" />
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                        {missions.filter(m => m.status === 'COMPLETED').length} đội đã hoàn thành nhiệm vụ
                      </p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {missions
                        .filter(m => m.status === 'COMPLETED')
                        .map((m: any) => {
                          const rescuerId = typeof m.rescuer === 'object' ? m.rescuer?.id : (m.rescuer || m.rescuer_id);
                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                if (rescuerId) setSelectedRescuerId(String(rescuerId));
                              }}
                              className="flex items-center justify-between px-6 py-3 bg-slate-50/60 hover:bg-slate-100/80 transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition-transform">
                                  <RiCheckboxCircleLine className="text-green-600 text-base" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                                    Tên đội trưởng: {m.rescuer_name || 'Cứu hộ viên'}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold">
                                    {m.role || 'Đội cứu hộ'}
                                    {m.completed_at
                                      ? ` · Hoàn thành lúc ${new Date(m.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${new Date(m.completed_at).toLocaleDateString('vi-VN')}`
                                      : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded-lg">
                                  Hoàn thành
                                </span>
                                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* SOS Signals with Filter & Clickable detail */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Tín Hiệu SOS</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{sosList.length} tín hiệu tổng</p>
                  </div>
                  <span className="bg-red-50 text-[#B7131A] text-[10px] font-black px-2 py-1 rounded-lg border border-red-200">
                    {sosActive} chưa xử lý
                  </span>
                </div>

                {/* Bộ lọc SOS (Filter tabs) */}
                <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
                  {[
                    { key: 'ALL', label: `Tất cả (${sosList.length})` },
                    { key: 'PENDING', label: `Chờ xử lý (${sosPendingCount})` },
                    { key: 'IN_PROGRESS', label: `Đang xử lý (${sosInProgressCount})` },
                    { key: 'RESOLVED', label: `Đã xong (${sosResolvedCount})` },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setSosFilter(tab.key as any)}
                      className={`px-3 py-1 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                        sosFilter === tab.key
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-500 hover:bg-slate-200/70'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* SOS List (Bấm vào xem chi tiết) */}
                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                  {filteredSosList.length === 0 ? (
                    <div className="px-6 py-10 text-center text-slate-400 text-sm font-bold">
                      Không có tín hiệu SOS nào cho bộ lọc này.
                    </div>
                  ) : (
                    filteredSosList.map((s: any) => {
                      const isResolved = s.status === 'RESOLVED';
                      const isPending = s.status === 'PENDING';
                      const ss = SOS_STATUS_MAP[s.status] ?? { label: s.status, dot: "bg-slate-300" };
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedSosId(s.id);
                            setIsSosModalOpen(true);
                          }}
                          className={`flex items-start gap-3 px-6 py-4 transition-colors cursor-pointer group ${
                            isResolved
                              ? 'bg-emerald-50/20 hover:bg-emerald-50/50'
                              : isPending
                              ? 'bg-amber-50/25 hover:bg-amber-50/60'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${ss.dot} shrink-0 mt-1.5 ${isPending ? 'ring-4 ring-amber-200 animate-pulse' : ''}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 truncate">
                                <p className={`text-sm font-black truncate transition-colors ${
                                  isResolved ? 'text-slate-800' : 'text-slate-900 group-hover:text-[#B7131A]'
                                }`}>
                                  {s.contact_name || s.citizen_name || 'Người dân'} · {s.signal_type || 'SOS'}
                                </p>
                                {isResolved ? (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded shrink-0">
                                    ✓ ĐÃ XỬ LÝ XONG
                                  </span>
                                ) : isPending ? (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded shrink-0">
                                    ⚠️ CHƯA XỬ LÝ
                                  </span>
                                ) : (
                                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded shrink-0">
                                    🚨 ĐANG ỨNG CỨU
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {new Date(s.sent_at).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                                </span>
                                <ChevronRight size={14} className="text-slate-300 group-hover:text-[#B7131A] transition-colors" />
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {ss.label}
                              {s.contact_phone ? ` · 📞 ${s.contact_phone}` : ''}
                              {s.emergency_type ? ` · ${s.emergency_type}` : ''}
                              {s.people_count ? ` · ${s.people_count} người` : ''}
                              {isResolved && s.assigned_rescuer_name ? ` · 🧑‍🚒 Đã được cứu bởi: ${s.assigned_rescuer_name}` : ''}
                            </p>
                            {s.note && <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{s.note}</p>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ── ZONE META INFO ── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-black text-slate-900 mb-5 flex items-center gap-2">
                <RiClipboardLine className="text-red-600 text-base" />
                Thông Tin Vùng Cứu Hộ
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <MetaItem label="Mã Sector" value={zone.sector_code || 'N/A'} />
                <MetaItem label="Trạng thái" value={STATUS[zone.status] || 'N/A'} />
                <MetaItem label="Loại sự cố" value={zone.incident_type || 'N/A'} />
                <MetaItem label="Người ảnh hưởng" value={`${zone.people_affected || 0} người`} />
                <MetaItem label="Cứu hộ cần thiết" value={`${zone.rescuers_needed || 0} đội`} />
                <MetaItem
                  label="Điểm ưu tiên AI"
                  value={zone.ai_priority_score != null && !isNaN(Number(zone.ai_priority_score)) ? Number(zone.ai_priority_score).toFixed(2) : 'N/A'}
                />
                <MetaItem label="Tạo lúc" value={zone.created_at ? new Date(zone.created_at).toLocaleString('vi-VN') : 'N/A'} />
                <MetaItem label="Cập nhật" value={zone.updated_at ? new Date(zone.updated_at).toLocaleString('vi-VN') : 'N/A'} />
              </div>
            </div>

            {/* ── SOS BY TYPE SUMMARY ── */}
            {sosList.length > 0 && (() => {
              const byStatus = Object.entries(SOS_STATUS_MAP).map(([key, val]) => ({
                key, ...val,
                count: sosList.filter(s => s.status === key).length
              })).filter(x => x.count > 0);
              return (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-sm font-black text-slate-900 mb-5 flex items-center gap-2">
                    <RiBarChartGroupedLine className="text-red-600 text-base" />
                    Phân Loại Tín Hiệu SOS
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {byStatus.map(b => (
                      <div key={b.key} className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <div className={`w-2 h-2 rounded-full ${b.dot}`} />
                        <span className="text-xs font-black text-slate-700">{b.label}</span>
                        <span className="text-xs font-black text-slate-400">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          </div>
        )}
      </div>

      {/* ── SOS DETAIL & HISTORY MODAL ── */}
      <SOSDetailModal
        sosId={selectedSosId}
        isOpen={isSosModalOpen}
        onClose={() => {
          setIsSosModalOpen(false);
          setSelectedSosId(null);
        }}
        onUpdated={() => {
          fetchAll();
        }}
      />

      {/* ── RESCUE TEAM DETAIL MODAL ── */}
      <TeamDetailModal
        teamId={selectedRescuerId}
        isOpen={Boolean(selectedRescuerId)}
        onClose={() => setSelectedRescuerId(null)}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, total, unit, color }: any) => (
  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
    <div className="flex items-baseline gap-1">
      <span className={`text-3xl font-black ${color}`}>{total}</span>
      <span className={`text-3xl font-black ${color}`}>{value}</span>
    </div>
    <p className="text-[10px] text-slate-400 font-bold mt-1">{unit}</p>
  </div>
);

const MetaItem = ({ label, value }: any) => (
  <div className="bg-slate-50 rounded-2xl p-4">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-sm font-black text-slate-800">{value}</p>
  </div>
);
