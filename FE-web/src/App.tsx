import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RescueZoneManagement from "./pages/RescueZoneManagement";
import FollowTheRescueTeam from "./pages/FollowTheRescueTeam";
import RegionStatus from "./pages/RegionStatus";
import Account from "./pages/Account";
import NotificationBroadcast from "./pages/NotificationBroadcast";
import Report from "./pages/Report";
import DetailReport from "./pages/DetailReport";
import Map from "./pages/Map";
import DetailsRescueZone from "./pages/DetailsRescueZone";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/rescue-zone-management" element={<RescueZoneManagement />} />
        <Route path="/follow-the-rescue-team" element={<FollowTheRescueTeam />} />
        <Route path="/region-status" element={<RegionStatus />} />
        <Route path="/account" element={<Account />} />
        <Route path="/notification-broadcast" element={<NotificationBroadcast />} />
        <Route path="/report" element={<Report />} />
        <Route path="/detail-report" element={<DetailReport />} />
        <Route path="/map" element={<Map />} />
        <Route path="/details-rescue-zone/:id" element={<DetailsRescueZone />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
