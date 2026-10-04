import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import SliderBar from "../../components/SliderBar";
import { api } from "../../services/api";
import { apiErrorMessage } from "../../utils/apiError";

export default function Page() {
  const { id } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zone, setZone] = useState<any>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    const fetchZoneDetail = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await api.zones.getDetail(id);
        setZone(res.data);
        setLoadError('');
      } catch (e) {
        console.error(e);
        setLoadError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchZoneDetail();
  }, [id]);

  if (!zone && id) return <div className="min-h-screen bg-slate-50 p-8 text-center" role={loadError ? 'alert' : 'status'}>
    <p>{loadError || (loading ? 'Đang tải dữ liệu khu vực...' : 'Không tìm thấy khu vực.')}</p>
    {loadError && <button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-white">Thử lại</button>}
  </div>;

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:relative z-30 lg:z-auto
          h-full overflow-y-auto shrink-0 border-r border-slate-200
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <SliderBar />
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-[#F8F9FA] flex flex-col h-full overflow-y-auto min-w-0">
        {/* Header */}
        <div
          className="flex flex-col self-stretch bg-slate-50 pt-3 mb-4 gap-3"
          style={{ boxShadow: "0px 1px 2px #0000000D" }}
        >
          <div className="flex justify-between items-center self-stretch mx-4 md:mx-6">
            <div className="flex shrink-0 items-center gap-3 md:gap-[31px]">
              {/* Mobile menu button */}
              <button
                className="lg:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 rounded border-0 bg-transparent cursor-pointer"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <span className="w-5 h-0.5 bg-slate-700 rounded" />
                <span className="w-5 h-0.5 bg-slate-700 rounded" />
                <span className="w-5 h-0.5 bg-slate-700 rounded" />
              </button>

              <div className="flex flex-col shrink-0 items-start py-1.5">
                <span className="text-slate-900 text-base md:text-xl font-bold">
                  {"Sentinel Ethos"}
                </span>
              </div>

              <div className="hidden sm:flex shrink-0 items-center bg-slate-200 py-[7px] px-3.5 gap-[15px] rounded">
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/a22b0998-b5ff-48aa-be37-b378f672ab86"
                  className="w-2.5 h-2.5 object-fill"
                  alt="search"
                />
                <div className="flex flex-col shrink-0 items-start pb-[1px]">
                  <span className="text-gray-500 text-sm">{"Tìm kiếm..."}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 md:gap-8">
              <img
                src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/609c9e4e-c0c0-45b8-aa59-b9bab93992f9"
                className="hidden md:block w-[108px] h-9 object-fill"
                alt="logo"
              />
              <div className="flex shrink-0 items-center gap-2 md:gap-3">
                <div className="flex flex-col shrink-0 items-start">
                  <div className="flex flex-col items-start py-0.5 px-[1px]">
                    <span className="text-slate-900 text-xs font-bold">
                      {"Admin_Primary"}
                    </span>
                  </div>
                  <div className="flex flex-col items-start py-[3px]">
                    <span className="text-slate-500 text-[10px]">
                      {"Sector 7-G"}
                    </span>
                  </div>
                </div>
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/c827b9a9-d27c-48a0-8301-ba6f7b6d0802"
                  className="w-8 h-9 md:w-[39px] md:h-10 object-fill"
                  alt="avatar"
                />
              </div>
            </div>
          </div>
          <div className="self-stretch bg-slate-200 h-[1px]"></div>
        </div>
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-8 space-y-10">
          
          {/* Section 1: Hero Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
            <div className="space-y-4 max-w-3xl">
              <div className="inline-flex items-center bg-[#008097]/10 py-1.5 px-3 rounded-full border border-[#008097]/20 gap-2">
                <div className="bg-[#008097] w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_#008097]"></div>
                <span className="text-[#008097] text-[10px] font-black uppercase tracking-widest leading-none">
                  {"AI Verified Feed: Live"}
                </span>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-[#191C1D] text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
                  {zone?.name || "Sector: Unknown"}
                </h1>
                <p className="text-[#5B403D] text-lg opacity-80 leading-relaxed">
                  {zone?.description || "Chưa có mô tả chi tiết."}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-2 group">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                {"Blockchain Hash"}
              </span>
              <button 
                className="bg-[#003567] hover:bg-[#004a8f] py-3 px-5 rounded-xl border border-blue-400/20 transition-all flex items-center gap-3 active:scale-95 group shadow-lg shadow-blue-900/20"
                onClick={() => alert("Blockchain proof verified.")}
              >
                <div className="w-1.5 h-1.5 bg-[#54A0FE] rounded-full"></div>
                <span className="text-[#54A0FE] text-xs font-mono font-bold tracking-tight">
                  {zone?.id || "N/A"}
                </span>
              </button>
            </div>
          </div>
          {/* Section 2: Status Visualization Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Waiting for Team", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/27342d4b-82f5-4c40-8ad9-3111148c2886", active: zone?.status === 'REPORTED' },
              { label: "Responding", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/eb839866-0949-438a-a889-075f18ce5bbd", active: zone?.status === 'VERIFIED' || zone?.status === 'RESCUING' },
              { label: "Partially Stabilized", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/813992fb-a981-403c-9eb3-07a08d813ae1", active: zone?.status === 'STABILIZED' },
              { label: "Stabilized", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/55a28965-3bdf-4b45-be79-dabf77ef6df3", active: zone?.status === 'RESOLVED' },
              { label: "Needs Support", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/c1f69bd7-6733-4c75-9c98-506dfd0077c5", active: false, alert: zone?.severity === 'CRITICAL' }
            ].map((status, i) => (
              <div 
                key={i} 
                className={`
                  flex flex-col items-center justify-center p-6 rounded-[2rem] border-b-[6px] transition-all cursor-pointer group
                  ${status.active ? 'bg-[#54A0FE] border-blue-600 shadow-xl shadow-blue-500/20 -translate-y-1' : ''}
                  ${!status.active && !status.alert ? 'bg-white border-slate-200 hover:bg-slate-50' : ''}
                  ${status.alert ? 'bg-[#FFDAD6] border-red-300 hover:bg-[#ffcfcb]' : ''}
                `}
              >
                <div className={`mb-4 p-3 rounded-2xl transition-transform group-hover:scale-110 ${status.active ? 'bg-blue-400/30' : 'bg-slate-50'}`}>
                  <img src={status.img} className={`w-6 h-6 object-fill ${status.active ? 'brightness-0 invert' : ''}`} alt={status.label} />
                </div>
                <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-center leading-tight ${status.active ? 'text-white' : status.alert ? 'text-[#93000A]' : 'text-slate-600'}`}>
                  {status.label}
                </span>
              </div>
            ))}
          </div>
          {/* Section 3: Main Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left/Middle Column: Audit & Commentary */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Audit Checklist */}
              <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-[#191C1D] text-xl font-black uppercase tracking-tight">
                    {"Audit Verification Checklist"}
                  </h3>
                  <span className="bg-blue-50 text-[#005FAF] py-1 px-3 rounded-full text-xs font-black">
                    {"3/5 COMPLETED"}
                  </span>
                </div>

                <div className="space-y-4">
                  {[
                    { title: "Team Bravo-6 Visual Confirmation", desc: "Confirmed structural integrity of secondary firewalls.", time: "14:22 GMT", status: "success", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/fe1fd1ad-b99d-479f-bff9-5ab46da2dec4" },
                    { title: "GPS Perimeter Geofencing", desc: "Ground unit telemetry matches assigned zone boundaries.", time: "14:18 GMT", status: "success", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/df783a96-1c8b-485e-b621-9bc133426a8c" },
                    { title: "Community Verification (Aggregate)", desc: "Processing 14 independent citizen reports.", progress: 82, status: "progress", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/d62bcedb-e9b9-49a0-b513-97a57093fa04" },
                    { title: "Final Administrative Overlook", desc: "Awaiting final manual override from Lead Guardian.", status: "pending", img: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/242bad95-ec71-4b92-a26a-dd3e5a389cde" }
                  ].map((item, i) => (
                    <div key={i} className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-2xl border transition-all ${item.status === 'pending' ? 'bg-slate-100/50 border-dashed border-slate-300 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className={`p-3 rounded-xl ${item.status === 'success' ? 'bg-green-50' : item.status === 'progress' ? 'bg-blue-50' : 'bg-slate-200'}`}>
                        <img src={item.img} className="w-5 h-5" alt="icon" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className={`text-sm font-bold ${item.status === 'pending' ? 'text-slate-500' : 'text-slate-900'}`}>{item.title}</h4>
                        <p className="text-slate-500 text-xs">{item.desc}</p>
                        {item.progress && (
                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.progress}%` }}></div>
                            </div>
                            <span className="text-[10px] font-black text-blue-600">{item.progress}%</span>
                          </div>
                        )}
                      </div>
                      {item.time && (
                        <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                          {item.time}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Commentary Section */}
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-[#191C1D] text-lg font-black uppercase tracking-tight">
                  {"Administrator Commentary"}
                </h3>
                <div className="relative group">
                  <textarea 
                    className="w-full h-32 bg-slate-50 p-6 rounded-2xl border-0 focus:ring-2 focus:ring-blue-100 outline-none text-[#191C1D] text-base placeholder:text-slate-400 resize-none transition-all"
                    placeholder="Enter high-trust situational notes here..."
                  ></textarea>
                  <div className="absolute bottom-4 right-5 flex items-center gap-2 opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <span className="text-[10px] font-black uppercase tracking-widest">{"Auto-Encrypting"}</span>
                    <img src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/e054f3c0-dd46-4611-ae9c-3d15fcdbb3bf" className="w-2 h-2.5" alt="lock" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Tactical Map & AI Insights */}
            <div className="space-y-8">
              
              {/* Tactical View */}
              <div className="relative rounded-[2.5rem] overflow-hidden group shadow-2xl aspect-[4/5] lg:aspect-square">
                <img 
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/1df930c3-cd21-4163-86d3-8b50358b52f9" 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  alt="map" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent p-8 flex flex-col justify-end">
                   <div className="flex justify-between items-end">
                     <div className="space-y-1">
                       <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{"Tactical Map"}</span>
                       <h4 className="text-white text-2xl font-black">{"Sector 7-G View"}</h4>
                     </div>
                     <button className="bg-white/20 hover:bg-white/30 p-4 rounded-2xl backdrop-blur-md transition-all active:scale-90">
                       <img src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/1df930c3-cd21-4163-86d3-8b50358b52f9" className="w-5 h-5 brightness-0 invert" alt="expand" />
                     </button>
                   </div>
                </div>
              </div>

              {/* AI Insights Card */}
              <div className="bg-[#E1E3E4]/80 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] border border-white/40 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                  <img src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/72b4d271-42dc-4ed1-9fec-471e19153f38" className="w-5 h-5" alt="ai" />
                  <span className="text-[#B7131A] text-xs font-black uppercase tracking-widest">{"Guardian AI Insights"}</span>
                </div>
                <p className="text-slate-800 text-sm leading-relaxed font-bold">
                  {"Anomaly detected in ground moisture levels. Risk of secondary subsidence increased by 14.2%. Recommend prioritizing \"Stabilized\" status only after water main verification."}
                </p>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{"Confidence Score"}</span>
                    <span className="text-[#005FAF] text-sm font-black">{"94.8%"}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#005FAF] w-[94.8%] rounded-full shadow-[0_0_8px_#005FAF]"></div>
                  </div>
                </div>
              </div>

              {/* Final Action */}
              <div className="space-y-4">
                <button 
                  className="w-full bg-[#005FAF] hover:bg-blue-700 py-6 p-4 rounded-[2rem] shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-4 transition-all active:scale-95 group overflow-hidden relative"
                  onClick={() => alert("Updating network status...")}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
                  <img src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/158a6f6d-cad7-467d-b1e5-6692e740bb6f" className="w-5 h-6 brightness-0 invert" alt="update" />
                  <span className="text-white text-xl font-black tracking-tight leading-none">
                    {"Finalize Status Update"}
                  </span>
                </button>
                <p className="text-slate-400 text-[10px] font-bold text-center px-4 leading-relaxed uppercase tracking-tighter opacity-70">
                  {"By finalizing, you verify that all data points have been manually audited according to Sentinel Protocol 44-B."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
