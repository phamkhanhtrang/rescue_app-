import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Login from "./pages/Login";
import Password from "./pages/Password";
import PageErrorBoundary from "./components/PageErrorBoundary";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const SOSAll = lazy(() => import("./pages/SOSAll"));
const RescueZoneManagement = lazy(() => import("./pages/RescueZoneManagement"));
const FollowTheRescueTeam = lazy(() => import("./pages/FollowTheRescueTeam"));
const RegionStatus = lazy(() => import("./pages/RegionStatus"));
const Account = lazy(() => import("./pages/Account"));
const NotificationBroadcast = lazy(() => import("./pages/NotificationBroadcast"));
const Report = lazy(() => import("./pages/Report"));
const DetailReport = lazy(() => import("./pages/DetailReport"));
const Map = lazy(() => import("./pages/Map"));
const DetailsRescueZone = lazy(() => import("./pages/DetailsRescueZone"));
const AICrawler = lazy(() => import("./pages/AICrawler"));

function parseJwt(token: string): { exp?: number; role?: string } | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function AdminRoutes() {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const payload = parseJwt(token);
  const isRoleAdmin =
    payload?.role === "ADMIN" ||
    localStorage.getItem("user_role") === "ADMIN";
  const isExpired = payload?.exp ? payload.exp * 1000 < Date.now() : false;

  if (!payload || !isRoleAdmin || isExpired) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="text-center">
      <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="mt-3 text-sm text-slate-500 font-medium">Đang tải dữ liệu...</p>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <PageErrorBoundary>
        <Suspense fallback={<div className="min-h-screen bg-page flex items-center justify-center"><LoadingFallback /></div>}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/password" element={<Password />} />
            <Route element={<AdminRoutes />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sos" element={<SOSAll />} />
              <Route path="/map" element={<Map />} />
              <Route path="/rescue-zone-management" element={<RescueZoneManagement />} />
              <Route path="/follow-the-rescue-team" element={<FollowTheRescueTeam />} />
              <Route path="/region-status" element={<RegionStatus />} />
              <Route path="/region-status/:id" element={<RegionStatus />} />
              <Route path="/account" element={<Account />} />
              <Route path="/notification-broadcast" element={<NotificationBroadcast />} />
              <Route path="/report" element={<Report />} />
              <Route path="/detail-report" element={<DetailReport />} />
              <Route path="/details-rescue-zone/:id" element={<DetailsRescueZone />} />
              <Route path="/ai-crawler" element={<AICrawler />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </PageErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
