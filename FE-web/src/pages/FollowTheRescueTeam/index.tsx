import React, { useEffect, useState, useRef } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L, { map } from 'leaflet';

const RescuerIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/9440/9440268.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Hàm tính khoảng cách Haversine giữa 2 tọa độ GPS (trả về Kilomet)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Bán kính trái đất (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    0.5 - Math.cos(dLat)/2 + 
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    (1 - Math.cos(dLon))/2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rescuers, setRescuers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [zoneStats, setZoneStats] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  // Dùng useRef để lưu trữ lịch sử vị trí các đội (tránh render lại không cần thiết)
  const historyRef = useRef<any>({});

  const fetchRescuers = async () => {
    try {
      // 1. Gọi API lấy dữ liệu Đội cứu trợ và Vùng sự cố
      const [rescuersRes, zonesRes, missionsRes, sosRes] = await Promise.all([
        api.rescuers.getAll(),
        api.zones.getAll(),
        api.missions.getAll(),
        api.sos.getAll(),
      ]);
      
      const fetchedZones = zonesRes.data.results || [];
      const fetchedRescuers = rescuersRes.data.results || [];
      const fetchedMissions = missionsRes.data.results || [];
      const fetchedSos = sosRes.data.results || [];
      
      const newAnomalies: any[] = [];
      
      // 2. Xử lý logic và xác định trạng thái / bất thường
      const processedRescuers = fetchedRescuers.map(team => {
        // Fallback tọa độ nếu thiếu
        const lat = parseFloat(team.rescuer_profile?.current_lat || 0);
        const lng = parseFloat(team.rescuer_profile?.current_lng || 0);

        let closestZone = null;
        let minDistance = Infinity;

        // Xác định đội đang ở vùng nào (Tính khoảng cách)
        fetchedZones.forEach((z) => {
          const zLat = parseFloat(z.location_lat);
          const zLng = parseFloat(z.location_lng);
          const d = calculateDistance(lat, lng, zLat, zLng);
          if (d < minDistance) {
            minDistance = d;
            closestZone = z;
          }
        });

        // Giả sử bán kính 5km là đang ở trong vùng sự cố
        const isInZone = minDistance <= 5 && closestZone !== null;
        const currentZone = isInZone ? closestZone : null;

        // Xác định Vùng phụ trách dựa trên Mission
        const activeMission = fetchedMissions.find(
          (m: any) =>
            m.rescuer === team.id &&
            (m.status === "ACTIVE" || m.status === "NEEDS_HELP"),
        );
        const assignedZoneName = activeMission ? activeMission.zone_name : null;

        // Xác định trạng thái
        // let status = 'TẠM DỪNG';
        // if (team.rescuer_profile?.is_on_duty) {
        //     status = isInZone ? 'ĐANG CỨU HỘ' : 'ĐANG DI CHUYỂN';
        // }

        // 3. Logic phát hiện bất thường
        const prevData = historyRef.current[team.id];
        const teamAnomalies = [];

        if (prevData) {
          // Bất thường: Đội không di chuyển (Trong khi trạng thái là Đang di chuyển)
          if (
            status === "ĐANG DI CHUYỂN" &&
            prevData.lat === lat &&
            prevData.lng === lng
          ) {
            teamAnomalies.push("KHÔNG DI CHUYỂN");
            newAnomalies.push({
              type: "warning",
              title: `Bất thường di chuyển`,
              desc: `Đội ${team.rescuer_profile?.unit_name || team.full_name} đang đứng yên không di chuyển.`,
            });
          }

          // Bất thường: Rời vùng sớm (Vùng vẫn đang ACTIVE nhưng đội lại đi ra ngoài)
          if (
            prevData.currentZone &&
            !currentZone &&
            prevData.currentZone.status === "ACTIVE" &&
            status !== "TẠM DỪNG"
          ) {
            teamAnomalies.push("RỜI VÙNG SỚM");
            newAnomalies.push({
              type: "danger",
              title: `Cảnh báo rời vùng`,
              desc: `Đội ${team.rescuer_profile?.unit_name || team.full_name} rời vùng ${prevData.currentZone.name} khi sự cố chưa giải quyết xong.`,
            });
          }

          // Bất thường: Hoạt động không khớp nhiệm vụ (Ví dụ: Đội đang ở vùng khác với vùng được phân công)
          if (
            currentZone &&
            assignedZoneName &&
            currentZone.name !== assignedZoneName
          ) {
            teamAnomalies.push("SAI VÙNG PHÂN CÔNG");
            newAnomalies.push({
              type: "danger",
              title: `Sai vùng phân công`,
              desc: `Đội ${team.rescuer_profile?.unit_name || team.full_name} đang ở ${currentZone.name} nhưng nhiệm vụ là ở ${assignedZoneName}.`,
            });
          } else if (
            currentZone &&
            team.rescuer_profile?.specialty === "MEDICAL" &&
            currentZone.people_affected === 0
          ) {
            teamAnomalies.push("SAI NHIỆM VỤ");
            newAnomalies.push({
              type: "danger",
              title: `Sai nhiệm vụ`,
              desc: `Đội Y tế ${team.rescuer_profile?.unit_name} được phân vào vùng không có thương vong.`,
            });
          }
        }

        // Lưu lại dữ liệu cho lần check sau
        historyRef.current[team.id] = {
          lat,
          lng,
          currentZone,
          assignedZoneName,
          status,
        };

        return {
          ...team,
          computed: {
            lat,
            lng,
            currentZone,
            assignedZoneName,
            status,
            anomalies: teamAnomalies,
          },
        };
      });

      setRescuers(processedRescuers);
      setAnomalies(newAnomalies); // Cập nhật danh sách bất thường cho Insight Card
      
      // 4. Phân tích Điều phối & Cân bằng nguồn lực
      const calculatedZoneStats = fetchedZones.map(z => {
          // Tính số đội phân công dựa trên mission (giống missionsCount ở ZoneDetailScreen)
          const activeTeams = fetchedMissions.filter((m: any) => {
              const zId = typeof m.zone === 'object' ? m.zone?.id : m.zone;
              return zId === z.id && m.status !== 'COMPLETED' && m.status !== 'CANCELLED';
          }).length;
          
          // Kiểm tra xem vùng có SOS đang chờ/xử lý hay không
          const hasSOS = fetchedSos.some((s: any) => {
              const zId = typeof s.zone === 'object' ? s.zone?.id : s.zone;
              return zId === z.id && (s.status === 'PENDING' || s.status === 'ACKNOWLEDGED' || s.status === 'IN_PROGRESS');
          });
          
          // Kiểm tra xem vùng có đội nào báo NEEDS_HELP không
          const needsHelp = fetchedMissions.some((m: any) => {
              const zId = typeof m.zone === 'object' ? m.zone?.id : m.zone;
              return zId === z.id && m.status === 'NEEDS_HELP';
          });
          
          return { ...z, activeTeams, hasSOS, needsHelp };
      });
      setZones(calculatedZoneStats);
      
      const newSuggestions: any[] = [];
      calculatedZoneStats.forEach(z => {
          if (z.status === 'ACTIVE') {
              if (z.severity === 'CRITICAL' && z.activeTeams < 3) {
                  newSuggestions.push({ type: 'danger', title: 'VÙNG ƯU TIÊN', desc: `Vùng ${z.name} mức độ CRITICAL nhưng chỉ có ${z.activeTeams} đội.` });
              }
              if (z.people_affected > 50 && z.activeTeams < 2) {
                  newSuggestions.push({ type: 'warning', title: 'THIẾU ĐỘI', desc: `Vùng ${z.name} có ${z.people_affected} người bị nạn nhưng chỉ có ${z.activeTeams} đội. Yêu cầu hỗ trợ thêm.` });
              }
              if (z.people_affected < 10 && z.activeTeams > 3) {
                  newSuggestions.push({ type: 'info', title: 'DƯ THỪA NGUỒN LỰC', desc: `Vùng ${z.name} có ${z.people_affected} nạn nhân nhưng có ${z.activeTeams} đội. Đề xuất chuyển đội sang vùng khác.` });
              }
          }
      });
      setSuggestions(newSuggestions);

    } catch (error) {
      console.error("Lỗi lấy dữ liệu đội cứu trợ:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRescuers();
    // Tự động cập nhật mỗi 15s để theo dõi GPS thời gian thực
    const interval = setInterval(fetchRescuers, 15000); 
    return () => clearInterval(interval);
  }, []);

  // Tổng hợp thống kê
  const movingCount = rescuers.filter(r => r.computed.status === 'ĐANG DI CHUYỂN').length;
  const rescuingCount = rescuers.filter(r => r.computed.status === 'ĐANG CỨU HỘ').length;
  const pausedCount = rescuers.filter(r => r.computed.status === 'TẠM DỪNG').length;

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      <div
        className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <SliderBar />
      </div>

      <div className="flex-1 bg-[#F8F9FA] flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-8">
            <div className="flex-1">
              <h1 className="text-4xl font-black text-[#191C1D] mb-2">
                Theo dõi Đội cứu trợ
              </h1>
              <p className="text-slate-500 text-lg">
                Giám sát vị trí GPS, trạng thái hoạt động và phát hiện bất
                thường thời gian thực.
              </p>
            </div>
            <div className="flex gap-3">
              <button className="bg-white border border-slate-200 py-3 px-6 rounded-xl font-bold text-sm shadow-sm">
                LỌC ĐỘI
              </button>
              <button className="bg-[#B7131A] text-white py-3 px-6 rounded-xl font-bold text-sm shadow-lg shadow-red-900/20">
                THÔNG BÁO KHẨN
              </button>
            </div>
          </div>

          {/* Bản đồ Theo dõi */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-[500px]">
              <MapContainer
                center={[10.762622, 106.660172]}
                zoom={11}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {/* Vẽ vùng sự cố */}
                {zones.map((z) => (
                  <Circle
                    key={z.id}
                    center={[
                      parseFloat(z.location_lat),
                      parseFloat(z.location_lng),
                    ]}
                    pathOptions={{
                      color: z.status === "ACTIVE" ? "#B7131A" : "#005FAF",
                      fillColor: z.status === "ACTIVE" ? "#B7131A" : "#005FAF",
                    }}
                    radius={5000} // Bán kính 5km
                  >
                    <Popup>
                      Vùng: {z.name} - Trạng thái: {z.status}
                    </Popup>
                  </Circle>
                ))}

                {/* Vẽ marker Đội cứu hộ */}
                {rescuers.map((team) => (
                  <Marker
                    key={team.id}
                    position={[team.computed.lat, team.computed.lng]}
                    icon={RescuerIcon}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-bold text-blue-800">
                          {team.rescuer_profile?.unit_name || team.full_name}
                        </h3>
                        <p className="text-xs mt-1">
                          Trạng thái: <b>{team.computed.status}</b>
                        </p>
                        <p className="text-xs">
                          Vùng hiện tại:{" "}
                          <b>
                            {team.computed.currentZone?.name ||
                              "Ngoài khu vực sự cố"}
                          </b>
                        </p>
                        {team.computed.anomalies?.length > 0 && (
                          <p className="text-xs text-red-600 font-bold mt-1">
                            ⚠️ Cảnh báo: {team.computed.anomalies.join(", ")}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Gợi ý điều phối thông minh & Bất thường */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[500px] overflow-y-auto">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                <span className="text-[#005FAF]">🤖</span> Cảnh báo & Gợi ý Điều
                phối
              </h2>
              <div className="space-y-4 flex-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-2">
                  Bất thường GPS
                </p>
                {anomalies.length > 0 ? (
                  anomalies.map((a, i) => (
                    <InsightCard
                      key={`a-${i}`}
                      type={a.type}
                      title={a.title}
                      desc={a.desc}
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic mb-4">
                    Không phát hiện bất thường về vị trí.
                  </p>
                )}

                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-2 mt-4">
                  Gợi ý phân bổ
                </p>
                {suggestions.length > 0 ? (
                  suggestions.map((s, i) => (
                    <InsightCard
                      key={`s-${i}`}
                      type={s.type}
                      title={s.title}
                      desc={s.desc}
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Nguồn lực đang được cân bằng tốt.
                  </p>
                )}
              </div>
              <button className="mt-8 w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm shrink-0 hover:bg-slate-800 transition-colors">
                TỰ ĐỘNG ĐIỀU PHỐI AI
              </button>
            </div>
          </div>

          {/* Theo dõi Phân bổ Nguồn lực theo Vùng */}
          {/* <div className="mb-12">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-900">Phân bổ nguồn lực các vùng</h2>
                <button className="text-sm font-bold text-blue-600 bg-blue-50 py-2 px-4 rounded-lg">XEM BÁO CÁO TỔNG THỂ</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {zones.filter(z => z.hasSOS || z.needsHelp).map(z => (
                 <div key={z.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                   <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">{z.name}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded inline-block ${z.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{z.severity}</span>
                          {z.hasSOS && <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded inline-block bg-red-600 text-white animate-pulse">CÓ SOS</span>}
                          {z.needsHelp && <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded inline-block bg-yellow-400 text-yellow-900">CẦN HỖ TRỢ</span>}
                        </div>
                      </div>
                      <div className={`px-3 h-12 min-w-[3rem] rounded-2xl flex flex-col items-center justify-center ${z.activeTeams >= z.rescuers_needed && z.rescuers_needed > 0 ? 'bg-green-100' : 'bg-slate-100'}`}>
                        <span className={`text-lg font-black leading-none ${z.activeTeams >= z.rescuers_needed && z.rescuers_needed > 0 ? 'text-green-700' : 'text-blue-700'}`}>
                          {z.rescuers_needed > 0 ? `${z.activeTeams}/${z.rescuers_needed}` : 'ĐỦ'}
                        </span>
                        <span className={`text-[8px] font-bold uppercase mt-0.5 ${z.activeTeams >= z.rescuers_needed && z.rescuers_needed > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                          {z.rescuers_needed > 0 ? 'Đội' : 'QUÂN SỐ'}
                        </span>
                      </div>
                   </div>
                   <div className="flex items-center gap-4 text-sm font-bold text-slate-600">
                      <div className="flex items-center gap-1">
                        <span>👥 Nạn nhân:</span> <span className="text-slate-900">{z.people_affected}</span>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-slate-100">
                      <button className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-xl text-xs font-bold hover:bg-blue-100">ĐIỀU ĐỘI ĐẾN</button>
                      <button className="flex-1 bg-red-50 text-red-700 py-2 rounded-xl text-xs font-bold hover:bg-red-100">YÊU CẦU HỖ TRỢ</button>
                   </div>
                 </div>
               ))}
             </div>
          </div> */}

          {/* Danh sách đội chi tiết */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-slate-900">
              Danh sách các Đội đang hoạt động
            </h2>
            {rescuers.map((team, idx) => (
              <TeamRow key={idx} team={team} />
            ))}
          </div>

          {/* Thống kê phân bổ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 mb-20">
            <StatsCard
              label="ĐANG DI CHUYỂN"
              value={`${movingCount} Đội`}
              color="#005FAF"
            />
            <StatsCard
              label="ĐANG CỨU HỘ"
              value={`${rescuingCount} Đội`}
              color="#2E7D32"
            />
            <StatsCard
              label="TẠM DỪNG"
              value={`${pausedCount} Đội`}
              color="#E07A00"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const TeamRow = ({ team }: any) => {
  const profile = team.rescuer_profile;
  const computed = team.computed;
  const name_leader = profile?.leader_name;


  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (showHistory) {
      const fetchHistory = async () => {
        try {
          const resp = await api.missions.getHistory(team.id);
          // Expect response data shape { status, count, results }
          const data = resp?.data ?? resp;
          setHistory(data.results || []);
        } catch (err) {
          console.error('Failed to fetch mission history', err);
          setHistory([]);
        }
      };
      fetchHistory();
    }
  }, [showHistory, team.id]);

  return (
    <>
      <div
        className={`bg-white rounded-3xl shadow-sm border ${
          computed.anomalies?.length > 0
            ? "border-red-400 shadow-red-100"
            : "border-slate-200"
        } p-6 flex flex-col md:flex-row items-center gap-8 transition-all hover:shadow-lg`}
      >
        <div className="flex-1 flex flex-col lg:flex-row items-center md:items-start lg:items-center gap-6 w-full">
          
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Đơn vị cứu hộ
            </span>
            <p className="text-sm font-black text-slate-900">
              {profile?.unit_name || "Chưa cập nhật"}
            </p>
          </div>
          
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Đội trưởng
            </span>
            <p className="text-sm font-black text-slate-900">
              {team.full_name || "Chưa cập nhật"}
            </p>
          </div>

          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Chuyên môn
            </span>
            <p className="text-sm font-black text-blue-700">
              {profile?.specialty || "Cứu hộ tổng hợp"}
            </p>
          </div>

          <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-6 w-full">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Vị trí GPS
              </span>

              <p className="text-sm font-black text-slate-900">
                {`${computed.lat.toFixed(4)}, ${computed.lng.toFixed(4)}`}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Vùng phụ trách
              </span>

              <p className="text-sm font-black text-blue-700">
                {computed.assignedZoneName
                  ? `Vùng ${computed.assignedZoneName}`
                  : "Chưa có nhiệm vụ"}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Đang có mặt tại
              </span>

              <p className="text-sm font-black text-slate-900">
                {computed.currentZone
                  ? `Vùng ${computed.currentZone.name}`
                  : "Ngoài vùng"}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Cấp bậc
              </span>

              <p className="text-sm font-black text-slate-900">
                {profile?.rank || "Hạng 1"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowHistory(true)}
            className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition"
          >
            <span className="text-xs font-bold">LỊCH SỬ</span>
          </button>
        </div>
      </div>

      {/* POPUP */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Lịch sử cứu hộ
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {profile?.unit_name || team.full_name}
                </p>
              </div>

              <button
                onClick={() => setShowHistory(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black"
              >
                ✕
              </button>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Tên vùng cứu hộ
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Vai trò
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Ngày hoàn thành
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item: any, index: number) => (
                    <tr
                      key={index}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm font-bold text-slate-900">
                        Vùng {item.zone_name || item.zone}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{item.role || "Cứu hộ"}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {item.completed_at ? new Date(item.completed_at).toLocaleString('vi-VN') : 'Đang xử lý'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowHistory(false)}
                className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:opacity-90"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const InsightCard = ({ type, title, desc }: any) => {
  const colors = {
    danger: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-orange-50 border-orange-200 text-orange-700",
    info: "bg-blue-50 border-blue-200 text-blue-700"
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[type as keyof typeof colors]}`}>
      <p className="text-xs font-black uppercase mb-1">{title}</p>
      <p className="text-xs opacity-80 font-medium">{desc}</p>
    </div>
  );
};

const StatsCard = ({ label, value, color }: any) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <h2 className="text-4xl font-black mt-2" style={{ color }}>{value}</h2>
  </div>
);
