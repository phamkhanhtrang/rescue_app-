import React, { useEffect, useState } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";

// Mock data for demonstration (replace with API data as needed)

const PAGE_SIZE = 3; // Show 3 rows per page for demo

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("rescue"); // rescue, admin, flagged
  const [page, setPage] = useState(1);

  const [data, setData] = useState({
    citizens: [],
    relief_teams: [],
    
    stats: { total_citizens: 0, total_relief_teams: 0 ,unverified_teams_count: 0},
  });
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rescuerRes, citizenRes, summaryRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/accounts/profiles/?role=RESCUER").then(r => r.json()),
          fetch("http://127.0.0.1:8000/accounts/profiles/?role=CITIZEN").then(r => r.json()),
          fetch("http://127.0.0.1:8000/accounts/summary/").then(r => r.json())
        ]);

        setData({
          relief_teams: rescuerRes.results || [],
          citizens: citizenRes.results || [],
          stats: {
             total_citizens: summaryRes.by_role?.CITIZEN || 0,
             total_relief_teams: summaryRes.by_role?.RESCUER || 0,
             unverified_teams_count: (rescuerRes.results || []).filter(r => !r.is_active).length
          }
        });
      } catch (err) {
        console.error("Lỗi lấy dữ liệu accounts:", err);
      }
    };
    fetchData();
  }, []);
  // Reset page to 1 when tab changes
  React.useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const [rescuerRes, citizenRes, summaryRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/accounts/profiles/?role=RESCUER").then(r => r.json()),
        fetch("http://127.0.0.1:8000/accounts/profiles/?role=CITIZEN").then(r => r.json()),
        fetch("http://127.0.0.1:8000/accounts/summary/").then(r => r.json())
      ]);

      setData({
        relief_teams: rescuerRes.results || [],
        citizens: citizenRes.results || [],
        stats: {
           total_citizens: summaryRes.by_role?.CITIZEN || 0,
           total_relief_teams: summaryRes.by_role?.RESCUER || 0,
           unverified_teams_count: (rescuerRes.results || []).filter(r => !r.is_active).length
        }
      });
    } catch (err) {
      console.error("Lỗi lấy dữ liệu accounts:", err);
    }
  };

  const handleActivateAccount = async (userId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/accounts/profiles/${userId}/activate/`, {
        method: "POST",
      });
      if (response.ok) {
        alert("Tài khoản đã được kích hoạt thành công!");
        fetchUsers();
      } else {
        const errorData = await response.json();
        alert(`Lỗi: ${errorData.message || errorData.error}`);
      }
    } catch (error) {
      console.error("Error activating account:", error);
      alert("Đã xảy ra lỗi khi kích hoạt tài khoản.");
    }
  };

  const handleBanAccount = async (userId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/accounts/profiles/${userId}/ban/`, {
        method: "POST",
      });
      if (response.ok) {
        alert("Tài khoản đã bị cấm!");
        fetchUsers();
      } else {
        const errorData = await response.json();
        alert(`Lỗi: ${errorData.message || errorData.error}`);
      }
    } catch (error) {
      console.error("Error banning account:", error);
      alert("Đã xảy ra lỗi khi cấm tài khoản.");
    }
  };

  // Get data for current tab
  let dataset = [];
  if (activeTab === "rescue") dataset = data.relief_teams;
  if (activeTab === "citizen") dataset = data.citizens;
  const total = dataset.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pagedData = dataset.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Helper for status color
  const statusColorClass = (color) => {
    if (color === "green") return "bg-green-100 text-green-700";
    if (color === "amber") return "bg-amber-100 text-amber-700";
    if (color === "red") return "bg-[#FFDAD6] text-[#93000A]";
    if (color === "blue") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

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
        <Header onOpenSidebar={setSidebarOpen} />

        {/* Page Body */}
        <div className="self-stretch p-4 md:p-8">
          {/* Title + Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center self-stretch mb-6 md:mb-8 gap-4 md:gap-7">
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-col items-start self-stretch py-1.5">
                <span className="text-[#191C1D] text-2xl md:text-3xl font-bold">
                  {"Tài khoản & phân quyền"}
                </span>
              </div>
              <div className="flex flex-col items-start self-stretch py-1">
                <span className="text-[#5B403D] text-sm md:text-base">
                  {
                    "Quản lý thông tin người dân dùng app và nhóm cứu hộ và phân quyền truy cập"
                  }
                </span>
              </div>
            </div>
            
            {/* <div className="flex flex-wrap items-center gap-3">
              <button
                className="flex shrink-0 items-center bg-[#E7E8E9] text-left py-3 md:py-[17px] px-4 md:px-6 gap-2 rounded-lg border-0 cursor-pointer"
                onClick={() => alert("Pressed!")}
              >
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/c646fce6-3e48-48bd-a836-29c83a4c95b3"
                  className="w-[18px] h-3 rounded-lg object-fill"
                  alt="filter"
                />
                <span className="text-[#191C1D] text-sm md:text-base font-bold">
                  {"Advanced Filters"}
                </span>
              </button>
              <button
                className="flex shrink-0 items-center bg-[#005FAF] text-left py-3 md:py-4 px-4 md:px-6 gap-[9px] rounded-lg border-0 cursor-pointer"
                style={{ boxShadow: "0px 4px 6px #0000001A" }}
                onClick={() => alert("Pressed!")}
              >
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/ddea7abe-028e-458c-bb22-057c87da8776"
                  className="w-[22px] h-4 rounded-lg object-fill"
                  alt="plus"
                />
                <span className="text-white text-sm md:text-base font-bold">
                  {"Provision New User"}
                </span>
              </button>
            </div> */}
          </div>

          {/* Stat Cards */}
          <div className="flex flex-col sm:flex-row items-stretch self-stretch mb-6 md:mb-8 gap-4 md:gap-6">
            {/* Pending Approvals */}
            <div className="flex-1 bg-[#F3F4F5] p-6 rounded-xl">
              <div className="flex flex-col items-start self-stretch pb-4">
                <span className="text-[#005FAF] text-[10px]">
                  {"Xác thực danh tính"}
                </span>
              </div>
              <div className="flex flex-col self-stretch gap-1">
                <span className="text-[#191C1D] text-4xl">{data.stats.unverified_teams_count}</span>
                <span className="text-[#5B403D] text-sm">
                  {"Đang chờ phê duyệt"}
                </span>
              </div>
            </div>

            {/* Security Alerts */}
            <div className="flex flex-1 justify-between items-center bg-[#EDEEEF] py-6 md:py-[30px] px-6 rounded-xl">
              <div className="flex flex-col shrink-0 items-start">
                <span className="text-[#B7131A] text-[10px] font-bold mb-1">
                  {"Cảnh báo"}
                </span>
                <span className="text-[#191C1D] text-4xl font-bold mb-1">
                  {"03"}
                </span>
                <span className="text-[#5B403D] text-sm">
                  {"Danh tính bị gắn cờ"}
                </span>
              </div>
            </div>

            {/* System Integrity */}
            {/* <div className="flex flex-col shrink-0 items-start bg-[#E1E3E499] py-6 md:py-[29px] px-5 md:px-[25px] rounded-xl border border-solid border-[#FFFFFF33]">
              <span className="text-[#004E5D] text-[10px] mb-2">
                {"System Integrity"}
              </span>
              <div className="flex items-center gap-2 mb-2">
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/8e6de61e-ea22-4647-9126-27745b368b0e"
                  className="w-4 h-5 object-fill"
                  alt="shield"
                />
                <span className="text-[#191C1D] text-xl font-bold">
                  {"100% Secure"}
                </span>
              </div>
              <span className="text-[#5B403D] text-[11px] max-w-[180px]">
                {
                  "All active nodes verified via decentralized ledger protocols."
                }
              </span>
            </div> */}
          </div>

          {/* Users Table */}
          <div
            className="self-stretch bg-white pt-4 mb-8 md:mb-12 rounded-lg overflow-hidden"
            style={{ boxShadow: "0px 1px 2px #0000000D" }}
          >
            {/* Table Header Tabs */}
            <div className="flex flex-wrap justify-between items-center self-stretch p-4 md:p-6 gap-2 border-b border-solid border-b-[#EDEEEF]">
              <div className="flex flex-wrap shrink-0 items-center gap-1">
                <button
                  className={`flex flex-col shrink-0 items-start py-2 md:py-3.5 px-[1px] ${activeTab === "rescue" ? "border-b-2 border-b-[#B7131A]" : ""}`}
                  onClick={() => setActiveTab("rescue")}
                >
                  <span
                    className={`text-sm md:text-base font-bold ${activeTab === "rescue" ? "text-[#B7131A]" : "text-[#5B403D]"}`}
                  >
                    {"Đội cứu hộ"}
                  </span>
                </button>
                <button
                  className={`flex flex-col shrink-0 items-start py-2 md:py-3.5 px-4 md:px-6 ${activeTab === "citizen" ? "border-b-2 border-b-[#005FAF]" : ""}`}
                  onClick={() => setActiveTab("citizen")}
                >
                  <span
                    className={`text-sm md:text-base font-bold ${activeTab === "citizen" ? "text-[#005FAF]" : "text-[#5B403D]"}`}
                  >
                    {"Người dân"}
                  </span>
                </button>
                <button
                  className={`flex shrink-0 items-center pt-1.5 pb-4 md:pb-[18px] pl-4 md:pl-[25px] gap-[9px] ${activeTab === "flagged" ? "border-b-2 border-b-[#BA1A1A]" : ""}`}
                  onClick={() => setActiveTab("flagged")}
                >
                  {/* <span
                    className={`text-sm md:text-base ${activeTab === "flagged" ? "text-[#BA1A1A] font-bold" : "text-[#5B403D]"}`}
                  >
                    {"Người dùng bị gắn cờ"}
                  </span>
                  <div className="flex flex-col shrink-0 items-start bg-[#BA1A1A] py-[5px] px-1.5 rounded-xl">
                    <span className="text-white text-[10px]">{"3"}</span>
                  </div> */}
                </button>
              </div>
              <span className="text-[#5B403D] text-xs md:text-sm">
                {`Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(
                  page * PAGE_SIZE,
                  total,
                )} of ${total} Users`}
              </span>
            </div>

            {/* Table Column Headers - hide on mobile */}
            <div className="hidden md:flex items-center self-stretch bg-[#F3F4F5]">
              {activeTab === "rescue" ? (
                <>
                  <div className="flex flex-1 flex-col items-start py-[18px] pl-6">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Tên người dùng"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-start py-[18px] pl-[25px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Tên tổ chức"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-start py-[18px] pl-[25px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Hình thức vận chuyển"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Số điện thoại"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Trạng thái xác nhận"}
                    </span>
                  </div>
                </>
              ) : activeTab === "citizen" ? (
                <>
                  <div className="flex flex-1 flex-col items-start py-[18px] pl-6">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Tên"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-start py-[18px] pl-[25px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Vị trí gửi"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Số phone"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Email"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Bệnh án"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"CCCD"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"SDT người thân"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Tùy chọn"}
                    </span>
                  </div>
                </>
              ) : (
                // keep original header for flagged or other tabs
                <>
                  {/* <div className="flex flex-1 flex-col items-start py-[18px] pl-6">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Tên người dùng"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-start py-[18px] pl-[25px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Số điện thoại"}
                    </span>
                  </div>
                  <div className="flex flex-col shrink-0 items-start py-[18px] pl-[25px] pr-[69px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Lý do"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col items-end py-[18px] pr-[23px]">
                    <span className="text-[#5B403D] text-[11px] font-bold">
                      {"Tùy chọn"}
                    </span>
                  </div> */}
                </>
              )}
            </div>

            {/* Table Rows - All Tabs Use pagedData */}
            <div className="self-stretch pt-4">
              {pagedData.map((row, idx) => (
                <div
                  key={row.id ?? row.email ?? row.phone_number ?? idx}
                  className={`flex flex-col md:flex-row md:items-center self-stretch mb-4 gap-3 md:gap-0 ${
                    idx % 2 === 1
                      ? "bg-[#F3F4F54D] py-4 md:py-[18px] border-t border-solid border-t-[#EDEEEF]"
                      : "py-4 md:py-[18px]"
                  }`}
                >
                  {/* Rescue Teams layout */}
                  {activeTab === "rescue" && (
                    <>
                      <div className="flex flex-col md:flex-1 items-start gap-1 md:pl-6">
                        <span className="text-[#191C1D] text-sm md:text-base font-bold">
                          {row.username ?? row.full_name ?? row.name ?? "-"}
                        </span>
                        <span className="text-[#5B403D] text-[11px]">
                          {row.email ?? row.identifier ?? ""}
                        </span>
                      </div>

                      <div className="flex flex-col md:flex-1 items-start md:pl-[25px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.rescuer_profile?.unit_name ?? "-"}
                        </span>
                        <span className="text-[#5B403D] text-[11px]">
                          {row.rescuer_profile?.rank ?? ""}
                        </span>
                      </div>

                      <div className="flex flex-col md:flex-1 items-start md:pl-[25px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.rescuer_profile?.specialty ?? "-"}
                        </span>
                        <span className="text-[#5B403D] text-[11px]"></span>
                      </div>

                      <div className="flex flex-col md:flex-1 items-end md:pr-[23px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.phone ?? "-"}
                        </span>
                        <span className="text-[#5B403D] text-[11px]"></span>
                      </div>
                      
                      <div className="flex flex-col md:flex-1 items-end md:pr-[23px]">
                        <button
                          className={`flex flex-col shrink-0 items-start text-left py-2.5 px-[17px] rounded border-0 transition-colors ${
                            row.is_active
                              ? "bg-red-600 cursor-pointer" // Màu đỏ khi đang active -> ấn để cấm
                              : "bg-[#005FAF] cursor-pointer" // Màu xanh khi bị disable -> ấn để kích hoạt
                          }`}
                          onClick={() => {
                            if (row.is_active) {
                              if (window.confirm("Bạn có chắc chắn muốn cấm tài khoản này?")) {
                                handleBanAccount(row.id);
                              }
                            } else {
                              handleActivateAccount(row.id);
                            }
                          }}
                        >
                          <span className="text-white text-xs font-bold">
                            {row.is_active ? "Cấm acc" : "Kích hoạt tài khoản"}
                          </span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Citizen layout */}
                  {activeTab === "citizen" && (
                    <>
                      <div className="flex flex-col md:flex-1 items-start gap-1 md:pl-6">
                        <span className="text-[#191C1D] text-sm md:text-base font-bold">
                          {row.full_name ?? row.name ?? row.username ?? "-"}
                        </span>
                      </div>

                      <div className="flex flex-col md:flex-1 items-start md:pl-[25px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.citizen_profile?.address ?? "-"}
                        </span>
                      </div>

                      <div className="flex flex-col md:flex-1 items-end md:pr-[23px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.phone ?? "-"}
                        </span>
                      </div>
                      <div className="flex flex-col md:flex-1 items-end md:pr-[23px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.email ?? "-"}
                        </span>
                      </div>
                      <div className="flex flex-col md:flex-1 items-end md:pr-[23px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.citizen_profile?.medical_notes ?? "-"}
                        </span>
                      </div>

                      <div className="flex flex-col md:flex-1 items-end md:pr-[23px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.citizen_profile?.id_number ?? "-"}
                        </span>
                      </div>
                      <div className="flex flex-col md:flex-1 items-end md:pr-[23px]">
                        <span className="text-[#191C1D] text-sm">
                          {row.citizen_profile?.emergency_contact_phone ?? "-"}
                        </span>
                      </div>
                      <div className="flex flex-col md:flex-1 items-end md:pr-[23px]">
                        <button
                          className={`flex flex-col shrink-0 items-start text-left py-2.5 px-[17px] rounded border-0 transition-colors ${
                            row.is_active
                              ? "bg-red-600 cursor-pointer" 
                              : "bg-[#005FAF] cursor-pointer" 
                          }`}
                          onClick={() => {
                            if (row.is_active) {
                              if (window.confirm("Bạn có chắc chắn muốn cấm tài khoản này?")) {
                                handleBanAccount(row.id);
                              }
                            } else {
                              handleActivateAccount(row.id);
                            }
                          }}
                        >
                          <span className="text-white text-xs font-bold">
                            {row.is_active ? "Cấm acc" : "Mở khoá"}
                          </span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Flagged / default layout - keep previous view */}
                  {activeTab === "flagged" && (
                    <>
                      <div className="flex items-center gap-3 md:mr-6">
                        <button
                          className="flex flex-col shrink-0 items-start bg-[#005FAF1A] text-left py-[9px] px-2.5 rounded-xl border-0 cursor-pointer"
                          onClick={() => alert("Pressed!")}
                        >
                          <img
                            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/d37f1b8b-73df-42ee-a393-7c83b128e03e"
                            className="w-5 h-5 rounded-xl object-fill"
                            alt="icon"
                          />
                        </button>
                        <div className="flex flex-col shrink-0 items-start">
                          <span className="text-[#191C1D] text-sm md:text-base font-bold">
                            {row.name ?? row.full_name ?? "-"}
                          </span>
                          <span className="text-[#5B403D] text-[11px]">
                            {row.email ?? row.phone ?? ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col shrink-0 items-start md:pl-6 md:mr-12">
                        <span className="text-[#191C1D] text-sm">
                          {row.role}
                        </span>
                        <span className="text-[#5B403D] text-[11px]">
                          {row.permissions}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 md:ml-auto">
                        <div
                          className={`flex shrink-0 items-center py-1 px-2.5 gap-[9px] rounded-xl ${statusColorClass(row.statusColor)}`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-xl ${row.statusColor === "green" ? "bg-green-600" : row.statusColor === "amber" ? "bg-amber-600" : row.statusColor === "red" ? "bg-[#BA1A1A]" : row.statusColor === "blue" ? "bg-blue-600" : "bg-gray-400"}`}
                          ></div>
                          <span className="text-xs font-bold">
                            {row.status}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="flex justify-center items-center gap-2 py-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={`px-3 py-1 rounded ${
                    page === i + 1
                      ? "bg-[#005FAF] text-white font-bold"
                      : "bg-[#E7E8E9] text-[#191C1D]"
                  }`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Section – RBAC + AI Identity */}
          <div className="flex flex-col lg:flex-row items-stretch self-stretch gap-6 md:gap-8 pb-8">
            {/* RBAC Card */}
            {/* <div className="flex flex-1 flex-col bg-[#EDEEEF] p-6 md:p-8 gap-4 rounded-xl">
              <div className="flex flex-col items-start self-stretch pb-[1px]">
                <span className="text-[#191C1D] text-base">
                  {"Quản lý quyền truy cập"}
                </span>
              </div>
              <div className="flex flex-wrap justify-center items-stretch gap-4">
                <div className="flex flex-col items-start bg-white py-4 px-5 gap-1 rounded-lg flex-1 min-w-[120px]">
                  <span className="text-[#191C1D] text-sm font-medium">
                    {"Standard Responder"}
                  </span>
                  <span className="text-[#5B403D] text-[10px]">
                    {"Read: Maps, Alerts"}
                  </span>
                  <span className="text-[#5B403D] text-[10px]">
                    {"Write: Status Updates"}
                  </span>
                </div>
                <div className="flex flex-col items-start bg-white py-4 px-5 gap-1 rounded-lg flex-1 min-w-[120px]">
                  <span className="text-[#191C1D] text-sm font-medium">
                    {"Incident Command"}
                  </span>
                  <span className="text-[#5B403D] text-[10px]">
                    {"Read: All Nodes"}
                  </span>
                  <span className="text-[#5B403D] text-[10px]">
                    {"Write: Dispatch, Broadcast"}
                  </span>
                </div>
                <div className="flex flex-col items-start bg-white py-4 px-5 gap-1 rounded-lg flex-1 min-w-[120px]">
                  <span className="text-[#191C1D] text-sm font-medium">
                    {"System Audit"}
                  </span>
                  <span className="text-[#5B403D] text-[10px]">
                    {"Read: Logs, Identities"}
                  </span>
                  <span className="text-[#5B403D] text-[10px]">
                    {"Write: None"}
                  </span>
                </div>
              </div>
            </div> */}

            {/* AI Identity Verification Card */}
            {/* <div className="flex flex-col items-start bg-[#E1E3E499] py-8 md:py-[34px] px-6 rounded-xl relative">
              <div className="flex items-center pb-4 gap-3">
                <button
                  className="flex flex-col shrink-0 items-start bg-[#B7131A33] text-left p-[13px] rounded-xl border-0 cursor-pointer"
                  onClick={() => alert("Pressed!")}
                >
                  <img
                    src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/5db41659-9fca-42d4-92c6-43eaa975253c"
                    className="w-[22px] h-[22px] rounded-xl object-fill"
                    alt="ai icon"
                  />
                </button>
                <span className="text-[#191C1D] text-sm font-bold">
                  {"Xác minh danh tính bằng AI"}
                </span>
              </div>
              <p className="text-[#5B403D] text-xs mb-4 max-w-[280px]">
                {
                  "The Guardian AI is monitoring 142 login patterns for anomalies. No unusual behavior detected in the last 24 hours."
                }
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[#B7131A] text-xs font-bold">
                  {"Review AI Insights"}
                </span>
                <img
                  src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/f7622610-17f1-4791-b1f6-95361005db92"
                  className="w-[9px] h-[9px] object-fill"
                  alt="arrow"
                />
              </div>
              <div
                className="bg-[#FFFFFF00] w-[200px] md:w-[217px] h-[65px] absolute bottom-[-27px] right-[1px] rounded-xl"
                style={{ boxShadow: "0px 25px 50px #00000040" }}
              ></div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
