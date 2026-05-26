import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  MapPinned,
  Users,
  UserCog,
  Bell,
  FileText
} from "lucide-react";

export default function SliderBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
  { name: "Trang chủ", path: "/dashboard", icon: LayoutDashboard },
  { name: "Sơ đồ", path: "/map", icon: Map },
  { name: "Khu vực", path: "/rescue-zone-management", icon: MapPinned },
  { name: "Đội cứu hộ", path: "/follow-the-rescue-team", icon: Users },
  { name: "Tài khoản", path: "/account", icon: UserCog },
  { name: "Phát tin", path: "/notification-broadcast", icon: Bell },
  { name: "Báo cáo", path: "/report", icon: FileText },
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
    const Icon = item.icon;

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
        <Icon
          size={18}
          className={`mx-3 ${
            isActive
              ? "text-blue-700"
              : "text-slate-500 opacity-70"
          }`}
        />

        <span
          className={`text-[11px] font-bold ${
            isActive
              ? "text-blue-700"
              : "text-slate-500"
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