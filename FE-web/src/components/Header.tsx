import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, RefreshCw, Settings, User } from "lucide-react";

interface HeaderProps {
  onOpenSidebar?: (open?: boolean) => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Trang chủ",
  "/map": "Bản đồ tác chiến",
  "/sos": "Tất cả SOS",
  "/rescue-zone-management": "Quản lý khu vực",
  "/follow-the-rescue-team": "Đội cứu hộ",
  "/ai-crawler": "AI Tìm tin",
  "/account": "Quản lý tài khoản",
  "/notification-broadcast": "Phát tin cảnh báo",
  "/report": "Báo cáo",
  "/region-status": "Trạng thái khu vực",
  "/password": "Đổi mật khẩu",
};

export default function Header({ onOpenSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem("user_username") || "Admin";
  const userRole = localStorage.getItem("user_role") || "ADMIN";

  const getPageTitle = () => {
    if (location.pathname.startsWith("/details-rescue-zone/")) return "Chi tiết khu vực";
    if (location.pathname.startsWith("/detail-report")) return "Chi tiết báo cáo";
    if (location.pathname.startsWith("/region-status/")) return "Trạng thái khu vực";
    return PAGE_TITLES[location.pathname] || "Trung Tâm Chỉ Huy Cứu Hộ";
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 md:px-6">
      <div className="flex items-center justify-between h-14">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 -ml-2 rounded-btn text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => onOpenSidebar?.(true)}
            aria-label="Mở menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-base md:text-lg font-semibold text-slate-900">
            {getPageTitle()}
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="btn-ghost flex items-center gap-1.5 text-xs"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            onClick={() => navigate("/password?mode=change")}
            className="btn-ghost flex items-center gap-1.5 text-xs"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Cài đặt</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <div className="flex items-center gap-2 pl-1">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <User size={16} className="text-slate-500" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-900 leading-tight">
                {userName}
              </p>
              <p className="text-xs text-slate-500 leading-tight">
                {userRole === "ADMIN" ? "Quản trị viên" : userRole}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
