import React, { useEffect, useState } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icons in React-Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'CRITICAL': return '#B7131A';
    case 'HIGH': return '#E07A00';
    case 'MEDIUM': return '#005FAF';
    case 'LOW': return '#2E7D32';
    default: return '#5B403D';
  }
};

export default function Page() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [rescuers, setRescuers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    summary: {
      total_zones: 0,
      total_sos: 0,
      total_teams: 0,
    },
    zones_by_status: {
      ACTIVE: 0,
      STABILIZING: 0,
      RESOLVED: 0,
      STANDBY: 0,
    },
    latest_sos_detail: {
      sos_data_list: []
    }
  });

  const total =
    (stats.zones_by_status.ACTIVE || 0) +
    (stats.zones_by_status.STABILIZING || 0) +
    (stats.zones_by_status.RESOLVED || 0) +
    (stats.zones_by_status.STANDBY || 0);

  const redPercent = total ? Math.round(((stats.zones_by_status.ACTIVE || 0) / total) * 100) : 0;
  const yellowPercent = total ? Math.round(((stats.zones_by_status.STABILIZING || 0) / total) * 100) : 0;
  const greenPercent = total ? 100 - redPercent - yellowPercent : 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, sosRes, teamRes, zoneRes] = await Promise.all([
          api.dashboard.getStats(),
          api.sos.getAll({ status: 'PENDING' }),
          api.rescuers.getAll(),
          api.zones.getAll()
        ]);

        setStats({
          summary: {
            total_zones: dashRes.data.summary?.total_zones || 0,
            total_sos: dashRes.data.summary?.total_sos || 0,
            total_teams: teamRes.data.count || 0,
          },
          zones_by_status: dashRes.data.zones_by_status || {},
          latest_sos_detail: {
            sos_data_list: sosRes.data.results || []
          }
        });
        setZones(zoneRes.data.results || []);
        setRescuers(teamRes.data.results || []);
      } catch (error) {
        console.error("Lỗi lấy dữ liệu dashboard:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#F8F9FA] overflow-hidden">
      {/* Sidebar Overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setShowSidebar(false)} />
      )}
      
      <div className={`fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-lg transform transition-transform duration-200 md:static md:translate-x-0 md:block ${showSidebar ? "translate-x-0" : "-translate-x-full"} md:w-[260px]`}>
        <SliderBar />
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        <Header onOpenSidebar={() => setShowSidebar(true)} />

        {/* Thống kê nhanh */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 pb-4">
          <StatCard title="Vùng cứu hộ" value={stats.summary.total_zones} sub="+2% so với tuần trước" icon="zone" />
          <StatCard title="Yêu cầu SOS" value={stats.summary.total_sos} sub="Khẩn cấp: HIGH" icon="sos" color="#B7131A" />
          <StatCard title="Đội cứu hộ" value={stats.summary.total_teams} sub="Đang triển khai" icon="team" color="#005FAF" />
        </div>

        {/* Bản đồ & Thông tin chi tiết (Requirement 2.3.1) */}
        <div className="flex flex-col lg:flex-row gap-6 p-8 pt-0">
          <div className="flex-[2] bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800">Bản đồ Giám sát Thời gian thực</h2>
              <div className="flex gap-4 text-xs font-bold">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#B7131A]" /> Nguy cấp</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#005FAF]" /> Đang xử lý</span>
              </div>
            </div>
            <div className="h-[450px] w-full">
              <MapContainer center={[10.762622, 106.660172]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {/* Hiển thị các vùng */}
                {zones.map(zone => (
                  <Circle 
                    key={zone.id}
                    center={[parseFloat(zone.location_lat), parseFloat(zone.location_lng)]}
                    radius={500}
                    pathOptions={{ 
                      color: getSeverityColor(zone.severity),
                      fillColor: getSeverityColor(zone.severity),
                      fillOpacity: 0.3
                    }}
                  >
                    <Popup>
                      <div className="p-1">
                        <h3 className="font-bold text-lg">{zone.name}</h3>
                        <p className="text-sm text-slate-600">Trạng thái: <b>{zone.status}</b></p>
                        <p className="text-sm text-slate-600">Số SOS: <b>{zone.sos_count || 0}</b></p>
                        <p className="text-sm text-slate-600">Số đội: <b>2</b> (Gợi ý)</p>
                        <hr className="my-2" />
                        <button className="text-blue-600 font-bold text-xs">XEM CHI TIẾT →</button>
                      </div>
                    </Popup>
                  </Circle>
                ))}

                {/* Hiển thị vị trí các đội (Mock if real GPS not present) */}
                {rescuers.map(r => (
                  <Marker 
                    key={r.id} 
                    position={[10.76 + Math.random()*0.02, 106.66 + Math.random()*0.02]}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-bold">{r.user_name}</p>
                        <p>Đơn vị: {r.unit_name}</p>
                        <p>Trạng thái: <b>Đang cứu hộ</b></p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-6">
            {/* Cảnh báo ưu tiên cao */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h2 className="font-bold text-[#B7131A] mb-4 text-xl">Cảnh báo Ưu tiên Cao</h2>
              <div className="flex flex-col gap-4">
                {stats.latest_sos_detail.sos_data_list.slice(0, 3).map((sos: any, idx) => (
                  <div key={idx} className="p-4 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex justify-between text-[10px] font-bold text-red-700 mb-1">
                      <span>{sos.emergency_type}</span>
                      <span>{new Date(sos.sent_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium line-clamp-2">{sos.note || "Yêu cầu khẩn cấp tại vị trí"}</p>
                    <div className="mt-2 flex justify-end">
                      <button className="text-red-700 font-bold text-[10px] uppercase">Điều phối ngay →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trạng thái phân bổ (Requirement 2.3.1 - Phân bố vai trò) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h2 className="font-bold text-slate-800 mb-4">Phân bổ Nguồn lực</h2>
              <div className="space-y-4">
                <RoleBar label="Cứu người" percent={65} color="#B7131A" />
                <RoleBar label="Tiếp tế" percent={25} color="#005FAF" />
                <RoleBar label="Y tế" percent={10} color="#2E7D32" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Logs */}
        <div className="px-8 pb-8">
           <div className="bg-[#F3F4F5] p-4 rounded-lg flex justify-between items-center border border-slate-200">
             <div className="flex items-center gap-3">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               <span className="text-xs font-medium text-slate-600">Hệ thống đồng bộ hóa thực tế đang hoạt động...</span>
             </div>
             <button className="text-[10px] font-bold text-blue-600 uppercase">Xem nhật ký đầy đủ</button>
           </div>
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ title, value, sub, icon, color = "#191C1D" }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
    <div>
      <p className="text-slate-500 text-xs mb-1">{title}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
    </div>
    <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-200 rounded-sm" />
    </div>
  </div>
);

const RoleBar = ({ label, percent, color }: any) => (
  <div>
    <div className="flex justify-between text-[11px] font-bold mb-1">
      <span className="text-slate-600">{label}</span>
      <span style={{ color }}>{percent}%</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
    </div>
  </div>
);
