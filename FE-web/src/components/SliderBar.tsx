

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function SliderBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: "Trang chủ", path: "/dashboard", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/daf4bffe-34c9-4fb2-9270-19067cfedba9" },
    { name: "Sơ đồ", path: "/map", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/329aef61-bcf8-4795-92d2-ea50ccb8bcf1" },
    { name: "Khu vực", path: "/rescue-zone-management", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/8d2db9a2-9cc7-479c-88bd-38b6fe1ccd2b" },
    { name: "Đội cứu hộ", path: "/follow-the-rescue-team", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/870e1029-27cf-4562-becd-403723f772fc" },
    { name: "Tài khoản", path: "/account", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/8a7f1969-6951-4e47-89e8-10e2996d46d3" },
    { name: "Phát tin", path: "/notification-broadcast", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/712473a9-5f7e-470b-a9af-c6c0b4344178" },
    { name: "Báo cáo", path: "/report", icon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/465fd18e-0c33-4901-842a-de77e7e6c6c4" },
  ];

  const handleLogout = () => {
    // Xóa hết dữ liệu trong localStorage
    localStorage.clear();
    // Chuyển về trang login
    navigate("/");
  };

  return (
    <div className="flex flex-col h-screen w-[260px] bg-slate-100 py-4 shrink-0 border-r border-slate-200">
      
      <div className="flex items-center pb-8 px-6">
        <button
          className="flex flex-col shrink-0 items-start bg-[#DB322F] text-left py-2.5 px-3 mr-3 rounded border-0 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/d4d0c0a9-b995-48f6-907b-293d54dfaa33"
            className="w-4 h-5 rounded object-fill"
          />
        </button>
        <div className="flex flex-col">
          <span className="text-slate-900 text-lg font-bold">Guardian Pulse</span>
          <span className="text-slate-500 text-[10px]">Emergency Command</span>
        </div>
      </div>

      
      <div className="flex flex-col items-start px-4 flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          
          const isActive = location.pathname === item.path;

          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center w-full py-2.5 mb-2 cursor-pointer rounded-md transition-all ${
                isActive 
                  ? "bg-white shadow-sm" 
                  : "hover:bg-slate-200" 
              }`}
            >
              <img
                src={item.icon}
                className={`w-[18px] h-[18px] mx-3 object-fill ${isActive ? "" : "grayscale opacity-70"}`}
              />
              <span
                className={`text-[11px] font-bold ${
                  isActive ? "text-blue-700" : "text-slate-500"
                }`}
              >
                {item.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Status & Links */}
      <div className="flex flex-col items-start py-4 px-6 gap-6 shrink-0">
        <div className="flex items-center bg-[#22C55E1A] py-[7px] px-3 gap-1.5 rounded-xl">
          <div className="bg-green-500 w-1.5 h-1.5 rounded-full shadow-[0_0_5px_#22c55e]"></div>
          <span className="text-green-700 text-[10px] font-bold">System Status: OK</span>
        </div>
        
        <div className="flex flex-col gap-2">
          <div 
            onClick={handleLogout}
            className="flex items-center cursor-pointer hover:text-slate-900 text-slate-500"
          >
             <span className="text-[11px]">Log Out</span>
          </div>
          
        </div>
      </div>
    </div>
  );
}