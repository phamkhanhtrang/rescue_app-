import React, { useState, useEffect } from "react";
import SliderBar from "../../components/SliderBar";
import { api } from '../../services/api';

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.dashboard.getStats();
        setStats(res.data.summary);
      } catch (e) {
        console.error(e);
      }
    };
    fetchStats();
  }, []);
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
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
          <div className="flex flex-col self-stretch gap-2 mb-8">
            <div className="flex flex-col items-start self-stretch pb-[1px]">
              <span className="text-[#005FAF] text-xs font-bold uppercase tracking-wider">
                {"Central Repository"}
              </span>
            </div>
            <div className="flex flex-col items-start self-stretch pb-[1px]">
              <h1 className="text-[#191C1D] text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                {"Export Reports & Transparency Logs"}
              </h1>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row items-start self-stretch gap-8">
            <div className="flex flex-1 flex-col gap-8 w-full">
              <div className="flex flex-col self-stretch bg-[#F3F4F5] p-6 md:p-8 gap-6 rounded-lg">
                <div className="flex items-center self-stretch gap-3">
                  <img
                    src={
                      "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/b94acf17-947d-4379-aad9-19b5394f9850"
                    }
                    className="w-[18px] h-[18px] object-fill"
                    alt="params"
                  />
                  <div className="flex flex-col shrink-0 items-start">
                    <span className="text-[#191C1D] text-lg font-bold">
                      {"Report Parameters"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="flex flex-col items-start gap-3 w-full">
                    <span className="text-[#906F6C] text-[10px] font-bold uppercase tracking-widest">
                      {"Time Period"}
                    </span>
                    <div className="flex justify-between items-center bg-[#E7E8E9] p-4 rounded w-full cursor-pointer hover:bg-slate-200 transition-colors">
                      <span className="text-[#191C1D] text-base">
                        {"Last 24 Hours"}
                      </span>
                      <img
                        src={
                          "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/c2452a73-d459-4bfb-9882-4eedddb0e0fc"
                        }
                        className="w-6 h-6 object-fill"
                        alt="dropdown"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-3 w-full">
                    <span className="text-[#906F6C] text-[10px] font-bold uppercase tracking-widest">
                      {"Specific Zones"}
                    </span>
                    <div className="flex justify-between items-center bg-[#E7E8E9] p-4 rounded w-full cursor-pointer hover:bg-slate-200 transition-colors">
                      <span className="text-[#191C1D] text-base">
                        {"All Operations Zones"}
                      </span>
                      <img
                        src={
                          "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/3edd8330-61c4-40fe-97e7-003b8d106519"
                        }
                        className="w-6 h-6 object-fill"
                        alt="dropdown"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col self-stretch bg-[#EDEEEF] p-6 md:p-8 gap-6 rounded-lg">
                <div className="flex items-center self-stretch gap-3">
                  <img
                    src={
                      "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/14a2d99a-0abb-403a-9983-b9683f24f418"
                    }
                    className="w-4 h-4 object-fill"
                    alt="format"
                  />
                  <div className="flex flex-col shrink-0 items-start">
                    <span className="text-[#191C1D] text-lg font-bold">
                      {"Export Format"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 items-stretch">
                  <div className="flex items-center justify-between bg-white p-4 lg:p-6 rounded-lg border-2 border-solid border-[#00000000] cursor-pointer hover:border-slate-300 transition-all">
                    <div className="flex items-center gap-4">
                      <img
                        src={
                          "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/67532176-2314-4e98-9beb-4e791fd3eb1c"
                        }
                        className="w-10 h-10 lg:w-12 lg:h-12 object-fill"
                        alt="pdf"
                      />
                      <div className="flex flex-col">
                        <span className="text-[#191C1D] text-sm lg:text-base font-bold">
                          {"PDF Document"}
                        </span>
                        <span className="text-[#906F6C] text-[10px] lg:text-xs">
                          {"Optimized for archiving"}
                        </span>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-slate-200"></div>
                  </div>
                  <div className="flex items-center justify-between bg-white p-4 lg:p-6 rounded-lg border-2 border-solid border-[#005FAF] cursor-pointer shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      <img
                        src={
                          "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/9a3451b1-5668-413a-98b8-c3e6f1c60dbd"
                        }
                        className="w-10 h-10 lg:w-12 lg:h-12 object-fill"
                        alt="excel"
                      />
                      <div className="flex flex-col">
                        <span className="text-[#191C1D] text-sm lg:text-base font-bold">
                          {"Excel Sheet"}
                        </span>
                        <span className="text-[#906F6C] text-[10px] lg:text-xs">
                          {"Raw data for analysis"}
                        </span>
                      </div>
                    </div>
                    <img
                      src={
                        "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/a856c45e-ecf2-43e2-ae47-8fd511823c52"
                      }
                      className="w-5 h-5 object-fill"
                      alt="selected"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between md:items-center self-stretch bg-slate-800 py-6 px-6 md:px-8 gap-4 rounded-lg shadow-lg">
                <div className="flex shrink-0 items-center gap-4">
                  <div className="w-9 h-9 border-t-2 border-l-2 border-white rounded-full animate-spin"></div>
                  <div className="flex flex-col">
                    <span className="text-white text-base font-bold">
                      {"Exporting..."}
                    </span>
                    <span className="text-slate-300 text-[10px] uppercase tracking-wider">
                      {"Gathering cryptographically secured logs"}
                    </span>
                  </div>
                </div>
                <button
                  className="bg-[#B7131A] hover:bg-[#9E1016] text-white py-3 px-8 rounded-lg font-bold transition-all shadow-md active:scale-95"
                  onClick={() => alert("Generating Report...")}
                >
                  {"Generate Report"}
                </button>
              </div>
            </div>

            <div className="flex flex-col shrink-0 items-start gap-6 lg:w-[380px] w-full">
              <div
                className="flex flex-col items-start bg-[#2E3132] p-6 md:p-8 rounded-lg w-full"
                style={{
                  boxShadow: "0px 25px 50px #00000040",
                }}
              >
                <div className="flex flex-col gap-6 w-full mb-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="bg-[#005FAF] w-2 h-2 rounded-full shadow-[0_0_8px_#1E90FF]"></div>
                       <span className="text-[#F0F1F2] text-[10px] font-bold uppercase tracking-widest">
                        {"Blockchain Integrity Hash"}
                      </span>
                    </div>
                    <div className="bg-[#005FAF33] py-1 px-3 rounded-full border border-[#005FAF4D]">
                      <span className="text-[#54A0FE] text-[10px] font-bold">{"LIVE FEED"}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[#F0F1F2] text-2xl font-bold">
                      {"Transparency Ledger"}
                    </span>
                    <span className="text-[#F0F1F2]/60 text-xs text-balance">
                      {"Immutability protocol active"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col bg-[#FFFFFF0D] p-4 rounded border border-[#FFFFFF1A] gap-2">
                      <div className="flex flex-wrap justify-between items-center text-[#F0F1F2] text-[10px] gap-2">
                        <span>{"TIMESTAMP: 2023-10-24 14:32:01"}</span>
                        <span>{"BLOCK #882,901"}</span>
                      </div>
                      <span className="text-[#54A0FE] text-xs font-mono break-all leading-relaxed">
                        {"0x8f2a...e912b4097f33d1a8c991b023910c"}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="bg-green-500 w-1.5 h-1.5 rounded-full"></div>
                        <span className="text-green-400 text-[10px] font-bold uppercase">
                          {"Verified Rescue Log"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col bg-[#FFFFFF0D] p-4 rounded border border-[#FFFFFF1A] gap-2">
                      <div className="flex flex-wrap justify-between items-center text-[#F0F1F2] text-[10px] gap-2">
                        <span>{"TIMESTAMP: 2023-10-24 14:31:45"}</span>
                        <span>{"BLOCK #882,900"}</span>
                      </div>
                      <span className="text-[#F0F1F2] text-xs font-mono break-all leading-relaxed">
                        {"0x4d11...f009a21b44c88211b0338190d"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-700 w-full">
                  <span className="text-[#F0F1F2] text-xs leading-relaxed opacity-80">
                    {"All exports include an immutable SHA-256 digital signature to ensure data veracity in legal and emergency audits."}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start bg-[#E7E8E9] p-6 lg:p-8 gap-6 rounded-lg w-full">
                <span className="text-[#906F6C] text-[10px] font-bold uppercase tracking-widest">
                  {"Data Preview"}
                </span>
                <div className="flex flex-col w-full gap-4">
                  <div className="flex items-center justify-between py-2 border-b border-solid border-[#E4BEB94D]">
                    <span className="text-[#5B403D] text-sm">{"Total Alert Logs"}</span>
                    <span className="text-[#191C1D] text-xl font-bold">{stats?.total_sos || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-solid border-[#E4BEB94D]">
                    <span className="text-[#5B403D] text-sm">{"Total Operations Zones"}</span>
                    <span className="text-[#005FAF] text-xl font-bold">{stats?.total_zones || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[#5B403D] text-sm">{"Total Rescue Missions"}</span>
                    <span className="text-[#191C1D] text-xl font-bold">{stats?.total_missions || 0}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start p-5 gap-4 rounded-lg bg-orange-50 border border-orange-100 w-full">
                <img
                  src={
                    "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/54fe17f4-8298-4429-b8a3-0bf82c73cd5f"
                  }
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  alt="info"
                />
                <p className="text-[#906F6C] text-[10px] leading-relaxed">
                  {"Data transparency is central to the Sentinel Ethos. Exports are encrypted with AES-256 standard and logged on the decentralized command ledger for 7 years."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
