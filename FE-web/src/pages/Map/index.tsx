import React, { useEffect, useState } from "react";
import SliderBar from "../../components/SliderBar";
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import "leaflet/dist/leaflet.css";
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import api from "../../services/api";
export default function Page() {
  // Default Leaflet icon fix
  const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
  });
  L.Marker.prototype.options.icon = DefaultIcon;
  // Helper to map severity to color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '#B7131A';
      case 'HIGH': return '#E07A00';
      case 'MEDIUM': return '#005FAF';
      case 'LOW': return '#2E7D32';
      default: return '#5B403D';
    }
  };

  const [input1, onChangeInput1] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [rescuers, setRescuers] = useState<any[]>([]);
  useEffect(() => {
      const fetchData = async () => {
        try {
          const [dashRes, sosRes, teamRes, zoneRes] = await Promise.all([
            api.dashboard.getStats(),
            api.sos.getAll({ status: 'PENDING' }),
            api.rescuers.getAll(),
            api.zones.getAll()
          ]);
          // Update state with fetched data
          setZones(zoneRes?.data?.results || []);
          setRescuers(teamRes?.data?.results || []);
        } catch (error) {
          console.error("Lỗi lấy dữ liệu dashboard:", error);
        }
      };
      fetchData();
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
      <div className="flex flex-1 overflow-hidden">
        {/* Bản đồ chính */}
        <div className="flex-[2] flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
            <h2 className="font-bold text-slate-800">Bản đồ Giám sát Thời gian thực</h2>
            <div className="flex gap-4 text-xs font-bold">
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#B7131A]" /> Nguy cấp</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#E07A00]" /> Cao</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#005FAF]" /> Đang xử lý</span>
            </div>
          </div>
          <div style={{ height: '500px', width: '100%' }}>
            <MapContainer center={[10.762622, 106.660172]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
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
                      <hr className="my-2" />
                      <button className="text-blue-600 font-bold text-xs">XEM CHI TIẾT →</button>
                    </div>
                  </Popup>
                </Circle>
              ))}
              {/* Hiển thị vị trí các đội */}
              {rescuers.map(r => (
                <Marker
                  key={r.id}
                  position={[10.76 + Math.random() * 0.02, 106.66 + Math.random() * 0.02]}
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
        <div className="flex flex-col shrink-0 items-start bg-[#F8F9FA] px-[1px]">
          <div className="flex flex-col items-start p-6 gap-6 border-b border-solid border-b-slate-100">
            <div className="flex items-center py-1">
              <span className="text-[#191C1D] text-base font-bold mr-[86px]">
                {"Operational Control"}
              </span>
              <div className="flex flex-col shrink-0 items-start py-[3px] px-[1px]">
                <span className="text-slate-400 text-xs">
                  {"24 ACTIVE LOGS"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-6">
              <div className="flex flex-col items-start gap-3">
                <div className="flex flex-col items-start pb-[1px] pr-[253px]">
                  <span className="text-slate-500 text-[10px]">
                    {"Risk Severity"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col shrink-0 items-center bg-[#FFDAD6] py-[13px] px-[34px] gap-0.5 rounded-lg border border-solid border-[#BA1A1A1A]">
                    <span className="text-[#93000A] text-lg font-bold">
                      {"08"}
                    </span>
                    <div className="flex flex-col items-start pt-[7px] pb-[3px]">
                      <span className="text-[#93000A] text-[9px] font-bold">
                        {"Critical"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col shrink-0 items-center bg-[#EDEEEF] py-[13px] px-8 gap-0.5 rounded-lg border border-solid border-[#00000000]">
                    <span className="text-slate-700 text-lg font-bold">
                      {"12"}
                    </span>
                    <div className="flex flex-col items-start pt-[7px] pb-[3px]">
                      <span className="text-slate-700 text-[9px] font-bold">
                        {"Warning"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col shrink-0 items-center bg-[#EDEEEF] py-[13px] px-[38px] gap-0.5 rounded-lg border border-solid border-[#00000000]">
                    <span className="text-slate-700 text-lg font-bold">
                      {"41"}
                    </span>
                    <div className="flex flex-col items-start pt-[7px] pb-[3px]">
                      <span className="text-slate-700 text-[9px] font-bold">
                        {"Stable"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start gap-3">
                <div className="flex flex-col items-start pr-[210px]">
                  <span className="text-slate-500 text-[10px]">
                    {"Operational Status"}
                  </span>
                </div>
                <div className="flex flex-col items-start pr-[61px] gap-2">
                  <div className="flex items-center">
                    <button
                      className="flex flex-col shrink-0 items-start bg-[#005FAF] text-left py-[9px] px-3 mr-2 rounded-xl border-0"
                      onClick={() => alert("Pressed!")}
                    >
                      <span className="text-white text-[10px] font-bold">
                        {"All Active"}
                      </span>
                    </button>
                    <button
                      className="flex flex-col shrink-0 items-start bg-[#EDEEEF] text-left py-[9px] px-[13px] mr-[9px] rounded-xl border-0"
                      onClick={() => alert("Pressed!")}
                    >
                      <span className="text-[#5B403D] text-[10px] font-bold">
                        {"En Route"}
                      </span>
                    </button>
                    <button
                      className="flex flex-col shrink-0 items-start bg-[#EDEEEF] text-left py-[9px] px-3 rounded-xl border-0"
                      onClick={() => alert("Pressed!")}
                    >
                      <span className="text-[#5B403D] text-[10px] font-bold">
                        {"On Scene"}
                      </span>
                    </button>
                  </div>
                  <button
                    className="flex flex-col items-start bg-[#EDEEEF] text-left py-[9px] px-3 rounded-xl border-0"
                    onClick={() => alert("Pressed!")}
                  >
                    <span className="text-[#5B403D] text-[10px] font-bold">
                      {"Resolved"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start bg-[#F3F4F5] pt-6 pb-[27px] px-6 mb-[1px] gap-4">
            <div className="flex flex-col items-start pr-[205px]">
              <span className="text-slate-500 text-[10px]">
                {"High Priority Alerts"}
              </span>
            </div>
            <div className="flex flex-col items-start gap-4">
              <div
                className="flex flex-col items-start bg-white py-4 px-5 gap-2 rounded-lg"
                style={{
                  boxShadow: "0px 1px 2px #0000000D",
                }}
              >
                <div className="flex items-center">
                  <span className="text-[#191C1D] text-base font-bold mr-[179px]">
                    {"04:12"}
                  </span>
                  <div className="flex flex-col shrink-0 items-start bg-[#FFDAD6] py-[5px] px-2 rounded-sm">
                    <span className="text-[#93000A] text-[9px] font-bold">
                      {"Medical SOS"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start pr-[34px]">
                  <span className="text-[#191C1D] text-sm w-[265px]">
                    {
                      "Multiple casualties reported at Sector 7-\nAlpha Intersection"
                    }
                  </span>
                </div>
                <div className="flex items-center py-2">
                  <div className="flex shrink-0 items-center py-[3px] mr-[72px] gap-1">
                    <img
                      src={
                        "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/0b536dcd-e8a2-43df-8571-ba51504c0066"
                      }
                      className="w-2 h-2.5 object-fill"
                    />
                    <span className="text-slate-400 text-[10px] font-bold">
                      {"San Francisco, S7"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-[7px]">
                    <img
                      src={
                        "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/dff264fa-2baf-4f18-8090-af8adfc9f00f"
                      }
                      className="w-2.5 h-[5px] object-fill"
                    />
                    <div className="flex flex-col shrink-0 items-start py-[3px]">
                      <span className="text-[#005FAF] text-[10px] font-bold">
                        {"Verified Log"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="flex flex-col items-start bg-white py-4 px-5 gap-2 rounded-lg"
                style={{
                  boxShadow: "0px 1px 2px #0000000D",
                }}
              >
                <div className="flex items-center">
                  <span className="text-[#191C1D] text-base font-bold mr-[170px]">
                    {"12:05"}
                  </span>
                  <div className="flex flex-col shrink-0 items-start bg-yellow-100 py-[5px] px-[9px] rounded-sm">
                    <span className="text-yellow-700 text-[9px] font-bold">
                      {"Hazmat Alert"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start pr-[62px]">
                  <span className="text-[#191C1D] text-sm w-[237px]">
                    {"Minor gas leak detected in industrial\ncomplex basement"}
                  </span>
                </div>
                <div className="flex items-center py-2 gap-[46px]">
                  <div className="flex shrink-0 items-center py-[3px] gap-1">
                    <img
                      src={
                        "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/da4c6781-ef3f-4917-afa0-eda2c8b3ed87"
                      }
                      className="w-2 h-2.5 object-fill"
                    />
                    <span className="text-slate-400 text-[10px] font-bold">
                      {"Richmond District"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center py-[3px] gap-1">
                    <img
                      src={
                        "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/bca017f5-0683-4553-9af2-f8e424692de7"
                      }
                      className="w-2 h-2.5 object-fill"
                    />
                    <span className="text-green-600 text-[10px] font-bold">
                      {"UNIT 12 EN ROUTE"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start bg-[#008097] py-3.5 px-4 rounded-lg">
                <div className="flex items-center mb-[3px] gap-[62px]">
                  <div className="flex flex-col shrink-0 items-start gap-[5px]">
                    <span className="text-white text-[10px] mr-[61px]">
                      {"AI Predicted Activity"}
                    </span>
                    <span className="text-white text-lg">
                      {"Crowd Density Warning"}
                    </span>
                  </div>
                  <img
                    src={
                      "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/6e835d96-fc73-4b8f-ab7b-22b35ae9a0b9"
                    }
                    className="w-[47px] h-[50px] rounded-lg object-fill"
                  />
                </div>
                <div className="flex flex-col items-start py-[7px] pr-12 mb-1">
                  <span className="text-white text-xs w-[255px]">
                    {
                      "Traffic analysis suggests a 70% probability of\ngridlock in Tunnel B within 20 mins."
                    }
                  </span>
                </div>
                <button
                  className="flex flex-col items-start bg-[#FFFFFF33] text-left py-[11px] px-[98px] rounded border-0"
                  onClick={() => alert("Pressed!")}
                >
                  <span className="text-white text-xs font-bold">
                    {"ADJUST ROUTING"}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start bg-[#F8F9FA] p-6 border-t border-solid border-t-slate-100">
            <button
              className="flex items-center bg-[#FFFFFF00] text-left py-4 px-[23px] gap-2.5 rounded-lg border-0"
              style={{
                boxShadow: "0px 4px 6px #0000001A",
              }}
              onClick={() => alert("Pressed!")}
            >
              <img
                src={
                  "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/e127460c-1530-45a6-9e10-5430f8138ed8"
                }
                className="w-[15px] h-6 rounded-lg object-fill"
              />
              <span className="text-white text-sm font-bold">
                {"BROADCAST EMERGENCY ALERT"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
	</div>
  );
}
