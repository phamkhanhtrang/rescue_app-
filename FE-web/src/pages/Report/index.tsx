import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";

const SOS_STATUS_MAP: Record<string, string> = {
  PENDING: "Chờ xử lý",
  ACKNOWLEDGED: "Đã tiếp nhận",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  CANCELLED: "Đã hủy"
};

const SOS_TYPE_MAP: Record<string, string> = {
  MEDICAL: "Y tế",
  FIRE: "Hỏa hoạn",
  FLOOD: "Lũ lụt",
  ACCIDENT: "Tai nạn",
  EARTHQUAKE: "Động đất",
  OTHER: "Khác",
  SOS: "Khẩn cấp",
  PING: "Ping vị trí",
  RESCUE :"Cứu hộ",
  FOOD:"Lương thực",
};

export default function Page() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [sosList, setSosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashRes, sosRes] = await Promise.allSettled([
          api.dashboard.getStats(),
          api.sos.getAll()
        ]);
        const failures: string[] = [];
        if (dashRes.status === 'fulfilled') setStats(dashRes.value.data);
        else failures.push(`thống kê: ${apiErrorMessage(dashRes.reason)}`);
        if (sosRes.status === 'fulfilled') setSosList(sosRes.value.data.results || []);
        else failures.push(`SOS: ${apiErrorMessage(sosRes.reason)}`);
        setLoadError(failures.length ? `Không cập nhật được ${failures.join('; ')}.` : '');
      } catch (e) {
        console.error(e);
        setLoadError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reload]);

  const totalSos = stats?.summary?.total_sos || 0;
  const resolvedSos = stats?.sos_by_status?.RESOLVED || 0;
  const resolutionRate = totalSos > 0 ? ((resolvedSos / totalSos) * 100).toFixed(1) : "0.0";
  
  const resolvedZones = stats?.zones_by_status?.RESOLVED || 0;
  
  const criticalCount = stats?.zones_by_severity?.CRITICAL || 0;
  const highCount = stats?.zones_by_severity?.HIGH || 0;
  const mediumCount = stats?.zones_by_severity?.MEDIUM || 0;

  const zoneStats = sosList.reduce((acc: any, sos: any) => {
    const zoneName = sos.zone_name || "Chưa phân vùng";
    if (!acc[zoneName]) {
      acc[zoneName] = { total: 0, resolved: 0 };
    }
    acc[zoneName].total += 1;
    if (sos.status === "RESOLVED") {
      acc[zoneName].resolved += 1;
    }
    return acc;
  }, {});
  
  const zoneProgress = Object.entries(zoneStats).map(([name, data]: any) => {
    const percent = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
    return { name, total: data.total, resolved: data.resolved, percent };
  }).sort((a, b) => b.total - a.total).slice(0, 5);

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (sosList.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }
    const headers = ["Thời gian", "Loại sự cố", "Trạng thái", "ID", "Vùng"];
    const rows = sosList.map((sos: any) => [
      `"${new Date(sos.sent_at).toLocaleString()}"`,
      `"${SOS_TYPE_MAP[sos.emergency_type?.toUpperCase()] || sos.emergency_type || "Khẩn cấp"}"`,
      `"${SOS_STATUS_MAP[sos.status] || sos.status}"`,
      `"${sos.id}"`,
      `"${sos.zone_name || "Chưa phân vùng"}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers, ...rows].map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bao_cao_cuu_ho.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      <div className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <SliderBar />
      </div>

      <div className="flex-1 bg-[#F8F9FA] flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="p-8 space-y-10">
          <DataNotice loading={loading} error={loadError} onRetry={() => setReload(value => value + 1)} hasData={!!stats || sosList.length > 0} />
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
            <div>
              <h1 className="text-4xl font-black text-slate-900 leading-none mb-2">Báo cáo & Phân tích</h1>
              <p className="text-slate-500">Dữ liệu lịch sử và chỉ số hiệu suất hoạt động hệ thống.</p>
            </div>
            <div className="flex flex-wrap gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
               
               <button 
                  onClick={handleExportPDF}
                  className="px-6 py-3 bg-[#B7131A] text-white text-xs font-black rounded-xl shadow-lg shadow-red-900/20 uppercase tracking-widest"
               >
                 Xuất PDF
               </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-[#191C1D] text-white p-10 rounded-[3rem] relative overflow-hidden group">
               <div className="relative z-10">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Hiệu suất đội cứu trợ</span>
                 <h2 className="text-7xl font-black mt-4 mb-8">{resolutionRate}% <span className="text-xl text-emerald-400 font-bold">↑</span></h2>
                 <p className="text-sm opacity-60 max-w-sm">Tỷ lệ xử lý các yêu cầu cứu trợ khẩn cấp trên toàn hệ thống.</p>
               </div>
               <div className="absolute right-[-10%] bottom-[-10%] w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-20 group-hover:opacity-40 transition-opacity" />
            </div>

            <div className="space-y-6">
               <ReportMiniCard label="Số vùng đã xử lý" value={resolvedZones} trend="Hoàn thành" color="#B7131A" />
               <ReportMiniCard label="Số yêu cầu được hỗ trợ" value={resolvedSos} trend="Đã giải quyết" color="#2E7D32" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                <h3 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-xs">Tốc độ xử lý theo khu vực</h3>
                <div className="flex-1 flex flex-col gap-5 overflow-y-auto pr-2">
                   {zoneProgress.map((zone, idx) => (
                     <div key={idx} className="w-full">
                       <div className="flex justify-between items-center mb-2">
                         <span className="text-sm font-bold text-slate-700">{zone.name}</span>
                         <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{zone.resolved}/{zone.total} ({zone.percent}%)</span>
                       </div>
                       <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                         <div className="bg-[#B7131A] h-full rounded-full transition-all duration-500" style={{ width: `${zone.percent}%` }} />
                       </div>
                     </div>
                   ))}
                   {zoneProgress.length === 0 && (
                     <div className="flex items-center justify-center h-full text-slate-400 text-sm font-bold">Chưa có dữ liệu sự cố</div>
                   )}
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                <h3 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-xs">Vùng sự cố theo mức độ</h3>
                <div className="flex-1 flex items-center justify-center relative">
                   <div className="w-40 h-40 border-[20px] border-slate-100 rounded-full border-t-[#B7131A] border-r-[#005FAF] border-b-[#f59e0b] rotate-45" />
                   <div className="absolute text-center">
                      <p className="text-2xl font-black">{stats?.summary?.total_zones || 0}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Tổng Vùng</p>
                   </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-6">
                   <LegendItem color="#B7131A" label="Nguy cấp" val={criticalCount} />
                   <LegendItem color="#f59e0b" label="Cao" val={highCount} />
                   <LegendItem color="#005FAF" label="Trung bình" val={mediumCount} />
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Nhật ký sự cố đã xác minh</h3>
                {/* <button onClick={() => navigate('/detail-report')} className="text-[10px] font-black text-blue-600 uppercase">
                  Mở trang Cài đặt Xuất Báo Cáo
                </button> */}
                <button 
                  onClick={handleExportExcel}
                  className="px-6 py-3 bg-[#005FAF] text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 uppercase tracking-widest"
               >
                 Xuất Excel
               </button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Thời gian</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Loại sự cố</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Vùng</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Trạng thái</th>
                        {/* <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Mã Blockchain</th> */}
                      </tr>
                   </thead>
                   <tbody>
                      {sosList.slice(0, 5).map((sos: any, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                           <td className="px-8 py-5 text-sm font-bold text-slate-600">{new Date(sos.sent_at).toLocaleString()}</td>
                           <td className="px-8 py-5">
                              <span className="px-3 py-1 bg-red-50 text-red-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-100">
                                {SOS_TYPE_MAP[sos.emergency_type?.toUpperCase()] || sos.emergency_type || "Khẩn cấp"}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-sm font-black text-slate-900">{sos.zone_name || "Chưa phân vùng"}</td>
                           <td className="px-8 py-5 text-sm font-bold text-slate-500">{SOS_STATUS_MAP[sos.status] || sos.status}</td>
                           {/* <td className="px-8 py-5">
                              <code className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-blue-700">{sos.id.substring(0, 12)}...</code>
                           </td> */}
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ReportMiniCard = ({ label, value, trend, color }: any) => (
  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex justify-between items-end">
    <div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <h2 className="text-4xl font-black mt-2" style={{ color }}>{value}</h2>
    </div>
    <span className="text-xs font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">{trend}</span>
  </div>
);

const LegendItem = ({ color, label, val }: any) => (
  <div className="text-center">
    <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: color }} />
    <p className="text-[10px] font-black text-slate-400 uppercase">{label}</p>
    <p className="text-sm font-black text-slate-900">{val}</p>
  </div>
);
