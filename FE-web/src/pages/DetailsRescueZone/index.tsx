import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import { MdOutlineHealthAndSafety } from 'react-icons/md';
import { MdOutlineCrisisAlert } from 'react-icons/md';
import { MdOutlineWarningAmber } from 'react-icons/md';
import { RiClipboardLine } from 'react-icons/ri';
import { MdOutlineLocationOn } from 'react-icons/md';
import { RiBarChartGroupedLine } from 'react-icons/ri';
import { RiCheckboxCircleLine } from 'react-icons/ri';

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
  PENDING:     { label: "Chờ xử lý",   dot: "bg-yellow-400" },
  ACKNOWLEDGED:{ label: "Đã tiếp nhận",dot: "bg-blue-400"   },
  IN_PROGRESS: { label: "Đang xử lý",  dot: "bg-orange-400" },
  RESOLVED:    { label: "Đã giải quyết",dot:"bg-green-400"  },
  CANCELLED:   { label: "Đã hủy",      dot: "bg-slate-300"  },
};
const LEVEL_MAP : Record<string, string>  = {
  LOW: "Thấp",
  MEDIUM: "Trung Bình",
  HIGH: "Cao",
  CRITICAL: "Nguy Hiểm"
}
const STATUS : Record<string, string> = {
  ACTIVE : "Đang hoạt động",
  STABILIZING : "Đang ổn định",
  RESOLVED : "Đã giải quyết",
  STANDBY : "Chờ xử lý"
}
// ────────────────────────────────────────────────────────────────────────────

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zone, setZone] = useState<any>(null);
  const [sosList, setSosList] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [zoneRes, sosRes, missionRes] = await Promise.all([
          api.zones.getDetail(id),
          api.sos.getAll({ zone: id }),
          api.missions.getAll({ zone_id: id }),
        ]);
        setZone(zoneRes.data);
        setSosList(sosRes.data.results || []);
        setMissions(missionRes.data.results || []);
      } catch (e) {
        console.error("Lỗi tải dữ liệu chi tiết vùng:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-[#B7131A] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 text-sm font-bold">Đang tải dữ liệu...</p>
      </div>
    </div>
  );

  if (!zone) return (
    <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
      <div className="text-center space-y-2">
        <p className="text-2xl font-black text-slate-800 flex items-center justify-center gap-2">
          <MdOutlineWarningAmber className="text-yellow-500" />
          Không tìm thấy vùng
        </p>
        <button onClick={() => navigate(-1)} className="text-[#005FAF] text-sm font-bold underline">← Quay lại</button>
      </div>
    </div>
  );

  // Derived stats
  const sev = SEVERITY_MAP[zone.severity] ?? SEVERITY_MAP.MEDIUM;
  const activeMissions = missions.filter(m => ['ACTIVE','ON_MY_WAY','NEEDS_HELP'].includes(m.status));
  const sosActive = sosList.filter(s => !['RESOLVED','CANCELLED'].includes(s.status)).length;
  const needsHelpCount = missions.filter(m => m.status === 'NEEDS_HELP').length;

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <SliderBar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="px-6 md:px-10 pb-16 space-y-8">

          {/* ── BREADCRUMB & BACK ── */}
          
          {/* ── HERO: ZONE TITLE & SEVERITY ── */}
          <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
            <div className="flex-1 min-w-0">
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
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-3">
                {zone.name}
              </h1>
              <p className="text-slate-500 text-sm max-w-2xl leading-relaxed">
                {zone.description || "Chưa có mô tả chi tiết cho vùng cứu hộ này."}
              </p>
            </div>

            {/* Risk severity card */}
            <div className={`${sev.bgCard} border border-current/10 rounded-3xl p-6 w-full lg:w-72 shrink-0`}>
              <p className={`${sev.textColor} text-[10px] font-black uppercase tracking-widest mb-2`}>Mức độ khẩn cấp</p>
              <p className={`${sev.textColor} text-3xl font-black mb-4`}>{LEVEL_MAP[zone.severity || "N/A"]}</p>
              
              <p className="text-slate-400 text-[10px] font-bold mt-3 flex items-center gap-1">
                <MdOutlineLocationOn className="text-xs" />
                {zone.location_lat
                  ? `${parseFloat(zone.location_lat).toFixed(5)}, ${parseFloat(zone.location_lng).toFixed(5)}`
                  : 'Chưa có tọa độ'}
              </p>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Tổng SOS" total={sosList.length} unit="tín hiệu" color="text-[#B7131A]" />
            <StatCard label="Đội Cứu Hộ Có Mặt"  total={zone.rescuers_needed || 0} unit="đội" color="text-[#005FAF]" />
            <StatCard label="Người Bị Ảnh Hưởng" value={zone.people_affected || 0} total={null} unit="người" color="text-orange-600" />
            <StatCard label="Ưu Tiên AI" value={zone.ai_priority_score ? zone.ai_priority_score.toFixed(1) : 'N/A'} total={null} unit="điểm" color="text-purple-600" />
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
                    return (
                      <div key={m.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl ${m.status === 'NEEDS_HELP' ? 'bg-red-100' : 'bg-blue-50'} flex items-center justify-center text-base shrink-0`}>
                            {m.status === 'NEEDS_HELP' ? '🆘' : '🧑‍🚒'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{m.rescuer_name || 'Cứu hộ viên'}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{m.role || 'Đội cứu hộ'} · Tham gia {new Date(m.joined_at).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</p>
                          </div>
                        </div>
                        <span className={`${ms.bg} ${ms.text} text-[10px] font-black px-2 py-1 rounded-lg shrink-0`}>
                          {ms.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Completed missions — full list */}
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
                      .map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between px-6 py-3 bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center text-sm shrink-0">
                              <RiCheckboxCircleLine className="text-green-600 text-base" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-700 truncate">Tên đội trưởng: {m.rescuer_name || 'Cứu hộ viên'}</p>
                              <p className="text-[10px] text-slate-400 font-bold">
                                {m.role || 'Đội cứu hộ'}
                                {m.completed_at
                                  ? ` · Hoàn thành lúc ${new Date(m.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${new Date(m.completed_at).toLocaleDateString('vi-VN')}`
                                  : ''}
                              </p>
                            </div>
                          </div>
                          <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded-lg shrink-0">
                            Hoàn thành
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            {/* SOS Signals */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-black text-slate-900"> Tín Hiệu SOS</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{sosList.length} tín hiệu tổng</p>
                </div>
                <span className="bg-red-50 text-[#B7131A] text-[10px] font-black px-2 py-1 rounded-lg border border-red-200">
                  {sosActive} chưa xử lý
                </span>
              </div>
              <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                {sosList.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-400 text-sm font-bold">
                    Chưa có tín hiệu SOS nào tại vùng này.
                  </div>
                ) : (
                  sosList.map((s: any) => {
                    const ss = SOS_STATUS_MAP[s.status] ?? { label: s.status, dot: "bg-slate-300" };
                    return (
                      <div key={s.id} className="flex items-start gap-3 px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className={`w-2 h-2 rounded-full ${ss.dot} shrink-0 mt-1.5`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-900 truncate">
                              {s.citizen_name || 'Người dân'} · {s.signal_type || 'SOS'}
                            </p>
                            <span className="text-[10px] text-slate-400 font-bold shrink-0">
                              {new Date(s.sent_at).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {ss.label}
                            {s.emergency_type ? ` · ${s.emergency_type}` : ''}
                            {s.people_count ? ` · ${s.people_count} người` : ''}
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
              <MetaItem label="Điểm ưu tiên AI" value={zone.ai_priority_score != null ? zone.ai_priority_score.toFixed(2) : 'N/A'} />
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
      </div>
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
