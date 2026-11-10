import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  MapPinned,
  Users,
  UserCog,
  Bell,
  FileText,
  AlertTriangle,
  LogOut,
} from "lucide-react";

import { apiClient, clearSession } from "../services/api";

const menuItems = [
  { name: "Trang chủ", path: "/dashboard", icon: LayoutDashboard },
  { name: "Bản đồ", path: "/map", icon: Map },
  { name: "Tất cả SOS", path: "/sos", icon: AlertTriangle },
  { name: "Khu vực", path: "/rescue-zone-management", icon: MapPinned },
  { name: "Đội cứu hộ", path: "/follow-the-rescue-team", icon: Users },
  { name: "AI Tìm tin", path: "/ai-crawler", icon: FileText },
  { name: "Tài khoản", path: "/account", icon: UserCog },
  { name: "Phát tin", path: "/notification-broadcast", icon: Bell },
  { name: "Báo cáo", path: "/report", icon: FileText },
];

export default function SliderBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    try {
      if (refresh) await apiClient.post("/accounts/logout/", { refresh });
    } catch {
      /* Clear local session even offline. */
    }
    clearSession();
    navigate("/");
  };

  return (
    <div className="flex flex-col h-screen w-[240px] bg-slate-900 py-5 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pb-6">
        <div className="w-9 h-9 bg-brand rounded-btn flex items-center justify-center">
          <span className="text-white text-lg">🆘</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white text-sm font-bold leading-tight">
            CỨU NẠN KHẨN CẤP
          </span>
          <span className="text-slate-400 text-xs">Ban Chỉ Huy & Điều Phối</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-slate-700/50 mb-3" />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path + "/"));
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-btn text-left transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="text-sm font-medium truncate">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 pt-4 space-y-3 shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-btn bg-emerald-500/10">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-emerald-400 text-xs font-medium">
            Hệ thống hoạt động
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-2 py-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-btn transition-colors"
        >
          <LogOut size={16} />
          <span className="text-sm">Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}