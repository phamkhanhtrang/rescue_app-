import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import SliderBar from "../../components/SliderBar";
import axios from "axios";

export default function Page() {
  const { id } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zone, setZone] = useState<any>(null);
  const [sosCount, setSosCount] = useState(0);

  useEffect(() => {
    const fetchZoneDetail = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:8000/rescue_operations/zones/${id}/`);
        setZone(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    const fetchSos = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:8000/rescue_operations/sos/?zone=${id}`);
        setSosCount(res.data.count);
      } catch (e) {
        console.error(e);
      }
    };
    if (id) {
      fetchZoneDetail();
      fetchSos();
    }
  }, [id]);

  if (!zone) return <div className="p-8 text-center">Đang tải dữ liệu...</div>;

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

        {/* === SECTION 1: Zone Title & Risk === */}
        <div className="flex flex-col lg:flex-row justify-between items-start self-stretch px-4 md:px-6 gap-4 pb-4">
          {/* Left: Zone info */}
          <div className="flex flex-col shrink-0 items-start gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="flex flex-col shrink-0 items-start bg-[#E7E8E9] text-left py-[7px] px-3 rounded border-0"
              >
                <span className="text-[#191C1D] text-xs font-bold">
                  {`ID: ${zone.id}`}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-[7px]">
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/efaabfc8-8f6f-4108-b55e-353e042cdc1a"
                  className="w-3 h-3 object-fill"
                />
                <span className="text-[#005FAF] text-xs font-bold">
                  {`Sector: ${zone.sector_code || 'N/A'}`}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start py-1.5 px-[1px]">
              <span className="text-[#191C1D] text-2xl sm:text-3xl lg:text-5xl font-bold leading-tight">
                {zone.name}
              </span>
            </div>
            <div className="flex flex-col items-start py-1">
              <span className="text-[#5B403D] text-sm sm:text-base max-w-xl">
                {zone.description || "Chưa có mô tả chi tiết."}
              </span>
            </div>
          </div>

          {/* Right: Risk card */}
          <div className={`flex flex-col shrink-0 items-start p-6 rounded-lg w-full lg:w-auto ${zone.severity === 'CRITICAL' ? 'bg-[#FFDAD6]' : 'bg-[#D3E3FD]'}`}>
            <div className="flex flex-col items-start pb-1">
              <span className={`${zone.severity === 'CRITICAL' ? 'text-[#93000A]' : 'text-[#005FAF]'} text-[11px] font-bold`}>
                {"Risk Assessment"}
              </span>
            </div>
            <div className="flex items-center mb-2 gap-4">
              <span className={`${zone.severity === 'CRITICAL' ? 'text-[#93000A]' : 'text-[#005FAF]'} text-2xl sm:text-3xl font-bold`}>
                {zone.severity || "NORMAL"}
              </span>
              <img
                src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/0a1262f0-bad0-433c-a186-83e4d59f35a4"
                className="w-[33px] h-7 object-fill"
              />
            </div>
            <div className="items-start bg-[#93000A33] pr-6 mt-2 rounded-xl w-full">
              <div className="bg-[#B7131A] w-[168px] h-1.5"></div>
            </div>
          </div>
        </div>

        {/* === SECTION 2: Main content (map + sidebar) === */}
        <div className="flex flex-col xl:flex-row items-start self-stretch gap-6 px-4 md:px-6 pb-6">
          {/* Left column: stats + map + actions */}
          <div className="flex flex-col flex-1 gap-6 min-w-0">
            {/* Stat Cards */}
            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-4">
              {/* Active SOS */}
              <div className="flex flex-col shrink-0 items-start bg-[#F3F4F5] p-6 gap-[22px] rounded-lg flex-1">
                <div className="flex flex-col items-start pb-[1px]">
                  <span className="text-[#5B403D] text-[11px]">
                    {"Active SOS Signals"}
                  </span>
                </div>
                <div className="flex flex-col items-start pt-1.5 gap-[15px]">
                  <span className="text-[#B7131A] text-4xl sm:text-5xl font-bold ml-[1px]">
                    {sosCount}
                  </span>
                  <span className="text-[#5B403D] text-xs">
                    {`Tín hiệu khẩn cấp`}
                  </span>
                </div>
              </div>
              {/* Assigned Teams */}
              <div className="flex flex-col shrink-0 items-start bg-[#F3F4F5] p-6 gap-[22px] rounded-lg flex-1">
                <div className="flex flex-col items-start pb-[1px]">
                  <span className="text-[#5B403D] text-[11px]">
                    {"Rescuers Needed"}
                  </span>
                </div>
                <div className="flex flex-col items-start pt-1.5 gap-[15px]">
                  <span className="text-[#005FAF] text-4xl sm:text-5xl font-bold ml-0.5">
                    {zone.rescuers_needed || 0}
                  </span>
                  <span className="text-[#5B403D] text-xs">
                    {"Nhân sự"}
                  </span>
                </div>
              </div>
              {/* Missing Roles */}
              <div className="flex flex-col shrink-0 items-start bg-[#008097] p-6 gap-[15px] rounded-lg flex-1">
                <span className="text-[#F9FDFF] text-[11px] pb-[1px]">
                  {"Missing Roles"}
                </span>
                <div className="flex flex-col items-start gap-2 w-full">
                  {[
                    { role: "Rescue", val: "-02" },
                    { role: "Supply", val: "-04" },
                    { role: "Medical", val: "-01" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between w-full">
                      <span className="text-[#F9FDFF] text-xs">{item.role}</span>
                      <span className="text-[#F9FDFF] text-base font-bold">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Feed / Map Area */}
            <div
              className="flex items-start self-stretch px-4 sm:px-6 min-h-[220px] sm:min-h-[280px] rounded-lg"
              style={{ background: "linear-gradient(180deg, #00000099, #00000000)" }}
            >
              <div className="flex flex-col shrink-0 items-start bg-[#E1E3E499] py-4 px-4 mt-[60px] sm:mt-[100px] mb-4 gap-[7px] rounded-lg border border-solid border-[#FFFFFF33]">
                <span className="text-white text-[10px] font-bold">
                  {"Live Feed"}
                </span>
                <div className="flex items-center gap-2">
                  <div className="bg-[#B7131A] w-2 h-2 rounded-xl"></div>
                  <span className="text-white text-sm sm:text-base font-bold">
                    {"DRONE-7 VERIFYING"}
                  </span>
                </div>
              </div>
              <div className="flex-1 self-stretch"></div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 mt-[60px] sm:mt-[100px] mb-4">
                <button
                  className="flex flex-col shrink-0 items-start bg-[#FFFFFF1A] text-left py-[11px] px-4 rounded border-0"
                  onClick={() => alert("Pressed!")}
                >
                  <span className="text-white text-xs font-bold">{"EXPAND VIEW"}</span>
                </button>
                <button
                  className="flex flex-col shrink-0 items-start bg-[#FFFFFF1A] text-left py-[11px] px-4 rounded border-0"
                  onClick={() => alert("Pressed!")}
                >
                  <span className="text-white text-xs font-bold">{"LAYER: TOPOLOGY"}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex shrink-0 items-center bg-[#E7E8E9] py-4 sm:py-5 px-4 sm:px-[35px] gap-[11px] rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/0f603779-5284-44ab-bf8f-92a16b0df17d"
                  className="w-[18px] h-4 rounded-lg object-fill"
                />
                <span className="text-[#191C1D] text-xs font-bold whitespace-nowrap">
                  {"Update Risk"}
                </span>
              </div>
              <div
                className="flex shrink-0 items-center bg-[#FFFFFF00] py-3 gap-[11px] rounded-lg cursor-pointer"
                style={{ boxShadow: "0px 4px 6px #0000001A" }}
              >
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/d3e307e6-b368-444a-82c1-b2e2dff83516"
                  className="w-[19px] h-4 rounded-lg object-fill"
                />
                <span className="text-white text-xs text-center w-[108px]">
                  {"Dispatch More Teams"}
                </span>
              </div>
              <div className="flex-1" />
              <div className="flex shrink-0 items-center bg-[#E7E8E9] py-4 sm:py-5 px-4 sm:px-[13px] gap-[11px] rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/f50fcfd1-fbf0-4855-8b68-2c2361bfdbf5"
                  className="w-4 h-4 rounded-lg object-fill"
                />
                <span className="text-[#191C1D] text-xs font-bold whitespace-nowrap">
                  {"Merge/Split Zone"}
                </span>
              </div>
            </div>
          </div>

          {/* Right column: AI Insights + Active Units */}
          <div className="flex flex-col shrink-0 items-start gap-6 w-full xl:w-[320px]">
            {/* AI Insights */}
            <div className="flex flex-col items-start bg-[#EDEEEF] p-[25px] gap-6 rounded-lg border border-solid border-[#E4BEB926] w-full">
              <div className="flex items-center gap-[7px]">
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/b511ce48-f4a6-4f21-9cc5-60ed62d87fc8"
                  className="w-[19px] h-5 object-fill"
                />
                <span className="text-[#191C1D] text-xs font-bold">
                  {"AI Situational Insight"}
                </span>
              </div>
              <div className="flex flex-col items-start gap-4 w-full">
                {/* Insight 1 */}
                <div className="flex items-center bg-white py-4 rounded w-full">
                  <div className="bg-[#006578] w-1 mx-4 self-stretch rounded"></div>
                  <div className="flex flex-col shrink-0 items-start gap-1 min-w-0">
                    <span className="text-[#191C1D] text-sm font-bold">
                      {"Projected flood peak in 42 minutes."}
                    </span>
                    <span className="text-[#5B403D] text-xs">
                      {"Recommended evacuation of sector 7-B via high-ground route 4."}
                    </span>
                  </div>
                </div>
                {/* Insight 2 */}
                <div className="flex items-center bg-white py-4 rounded w-full">
                  <div className="bg-[#BA1A1A] w-1 mx-4 self-stretch rounded"></div>
                  <div className="flex flex-col shrink-0 items-start gap-1 min-w-0">
                    <span className="text-[#191C1D] text-sm font-bold">
                      {"Power Grid Instability"}
                    </span>
                    <span className="text-[#5B403D] text-xs">
                      {"Ground sensors indicate substation 4 failure is imminent."}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Unit Status */}
            <div className="flex flex-col items-start w-full">
              <div className="flex flex-col items-start pb-4 pl-2">
                <span className="text-[#191C1D] text-xs">{"Active Unit Status"}</span>
              </div>
              <div className="flex flex-col items-start gap-3 w-full">
                {/* Aqua-Rescue 1 */}
                <div className="flex items-center justify-between bg-white p-4 rounded-lg w-full">
                  <div className="flex shrink-0 items-center gap-4">
                    <button
                      className="flex flex-col shrink-0 items-start bg-[#005FAF1A] text-left py-2.5 px-3 rounded-xl border-0"
                      onClick={() => alert("Pressed!")}
                    >
                      <img
                        src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/f1588b68-e643-4218-a376-456ef468399f"
                        className="w-4 h-5 rounded-xl object-fill"
                      />
                    </button>
                    <div className="flex flex-col shrink-0 items-start py-1 gap-[5px]">
                      <span className="text-[#191C1D] text-sm font-bold">{"Aqua-Rescue 1"}</span>
                      <span className="text-[#5B403D] text-[10px]">{"En Route - ETA 4m"}</span>
                    </div>
                  </div>
                  <button
                    className="flex flex-col shrink-0 items-start bg-[#E7E8E9] text-left py-[7px] px-2 rounded-sm border-0"
                    onClick={() => alert("Pressed!")}
                  >
                    <span className="text-[#191C1D] text-[10px] font-bold">{"Active"}</span>
                  </button>
                </div>
                {/* Med-Response Delta */}
                <div className="flex items-center justify-between bg-[#F3F4F5] p-4 rounded-lg w-full">
                  <div className="flex shrink-0 items-center gap-4">
                    <button
                      className="flex flex-col shrink-0 items-start bg-[#B7131A1A] text-left p-2.5 rounded-xl border-0"
                      onClick={() => alert("Pressed!")}
                    >
                      <img
                        src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/e98036ce-e4dd-44f5-8ad7-ef630f09d89d"
                        className="w-5 h-5 rounded-xl object-fill"
                      />
                    </button>
                    <div className="flex flex-col shrink-0 items-start py-1 gap-[5px]">
                      <span className="text-[#191C1D] text-sm font-bold ml-[1px]">{"Med-Response Delta"}</span>
                      <span className="text-[#5B403D] text-[10px]">{"On Site - Deploying"}</span>
                    </div>
                  </div>
                  <button
                    className="flex flex-col shrink-0 items-start bg-[#BA1A1A1A] text-left py-[7px] px-2 rounded-sm border-0"
                    onClick={() => alert("Pressed!")}
                  >
                    <span className="text-[#BA1A1A] text-[10px] font-bold">{"Busy"}</span>
                  </button>
                </div>
                {/* Air-Lift 7 */}
                <div className="flex items-center justify-between bg-white p-4 rounded-lg w-full">
                  <div className="flex shrink-0 items-center gap-4">
                    <button
                      className="flex flex-col shrink-0 items-start bg-slate-200 text-left py-2.5 px-[9px] rounded-xl border-0"
                      onClick={() => alert("Pressed!")}
                    >
                      <img
                        src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/b1c27805-c376-4491-9c46-7da7f9996af1"
                        className="w-[22px] h-5 rounded-xl object-fill"
                      />
                    </button>
                    <div className="flex flex-col shrink-0 items-start pb-[3px] gap-[3px]">
                      <span className="text-[#191C1D] text-sm font-bold">{"Air-Lift 7"}</span>
                      <span className="text-[#5B403D] text-[10px]">{"Standby - Refueling"}</span>
                    </div>
                  </div>
                  <button
                    className="flex flex-col shrink-0 items-start bg-[#E7E8E9] text-left py-[7px] px-[9px] rounded-sm border-0"
                    onClick={() => alert("Pressed!")}
                  >
                    <span className="text-[#191C1D] text-[10px] font-bold">{"Ready"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === SECTION 3: Command Log (Blockchain Ledger) === */}
        <div className="bg-slate-50 border-t border-slate-200 p-6 md:p-12 relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="bg-[#005FAF] p-2 rounded-lg">
                  <img
                    src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/blockchain-icon-placeholder"
                    className="w-5 h-5 object-fill invert"
                    alt="chain"
                  />
                </div>
                <h3 className="text-[#191C1D] text-lg font-black tracking-tight">
                  {"Immutable Command Log"}
                </h3>
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest ml-12">
                {"Chain ID: Sentinel-Mainnet-01"}
              </p>
            </div>
            <button className="text-[#005FAF] text-xs font-black uppercase tracking-widest hover:underline decoration-2 underline-offset-4">
              {"Verify Entire Zone History"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { hash: "0x8f2...ae19", title: "Zone Risk Upgraded to CRITICAL", meta: "14:22:09 UTC | Admin: Jonas_K", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/518a58df-7b63-4547-b7de-3f2c8e7f780d" },
              { hash: "0x41c...90bb", title: "Team Dispatch: Aqua-Rescue 1", meta: "14:18:45 UTC | Admin: Auto_Dispatch", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/0b95a22e-46b9-4858-86fc-eb503fc5346c" },
              { hash: "0x221...fe04", title: "Satellite Telemetry Verified", meta: "14:15:22 UTC | System: Sentinel_Orbital", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/50cbfd52-b580-42f1-9f35-563acc94bbfb" }
            ].map((log, idx) => (
              <div key={idx} className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[#5B403D] text-[10px] font-black font-mono opacity-40 bg-slate-50 py-1 px-2 rounded-md group-hover:opacity-100 transition-opacity">
                    {log.hash}
                  </span>
                  <img src={log.icon} className="w-3 h-3 object-fill opacity-20" alt="verified" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[#191C1D] text-[15px] font-black tracking-tight">{log.title}</h4>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed">{log.meta}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Floating Action Button */}
          <button
            className="flex flex-col items-center justify-center bg-white w-14 h-14 absolute -bottom-7 right-8 rounded-2xl shadow-2xl border border-slate-100 hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-[#005FAF]"
            onClick={() => alert("Loading full ledger...")}
          >
            <img
              src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/d48473a0-a6d5-419a-8cc5-2d365167a859"
              className="w-6 h-6 object-fill"
              alt="ledger"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
