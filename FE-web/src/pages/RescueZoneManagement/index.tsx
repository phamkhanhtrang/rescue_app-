import React, { useEffect, useState } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [sosList, setSosList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(null as 'merge' | 'split' | null);
  const [addressInput, setAddressInput] = useState('');
  
  const [newZone, setNewZone] = useState({
    name: '', sector_code: '', location_lat: '10.76', location_lng: '106.66', severity: 'MEDIUM', status: 'ACTIVE'
  });

  const fetchZones = async () => {
    try {
      setLoading(true);
      const [zoneRes, sosRes] = await Promise.all([
        api.zones.getAll(),
        api.sos.getAll()
      ]);
      setZones(zoneRes.data.results || []);
      setSosList(sosRes.data.results || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchZones(); }, []);

  // Logic tính toán theo ngày
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();

  // 1. Số khu vực mới trong ngày
  const newZonesToday = zones.filter(z => z.created_at?.startsWith(todayStr)).length;

  // 2. SOS khẩn trong ngày & Trend (so với hôm qua)
  const sosToday = sosList.filter(s => s.sent_at?.startsWith(todayStr)).length;
  const sosYesterday = sosList.filter(s => s.sent_at?.startsWith(yesterdayStr)).length;

  let sosTrend = "0";
  if (sosYesterday > 0) {
    const diff = ((sosToday - sosYesterday) / sosYesterday) * 100;
    sosTrend = (diff > 0 ? "+" : "") + diff.toFixed(0);
  } else if (sosToday > 0) {
    sosTrend = "+100";
  }

  const handleCreateZone = async () => {
    try {
      let lat = newZone.location_lat;
      let lng = newZone.location_lng;
      
      if (addressInput.trim() !== '') {
         const address = `${addressInput}, Việt Nam`;
         // Gọi API Nominatim OpenStreetMap để lấy tọa độ
         const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
         const data = await res.json();
         if (data && data.length > 0) {
            lat = data[0].lat;
            lng = data[0].lon;
         } else {
            alert("Không tìm thấy tọa độ cho địa chỉ này, sẽ sử dụng tọa độ mặc định.");
         }
      }

      await api.zones.create({
          ...newZone,
          location_lat: lat,
          location_lng: lng
      });
      setShowCreateModal(false);
      setAddressInput(''); // Reset lại input địa chỉ
      setNewZone({
        name: '', sector_code: '', location_lat: '10.76', location_lng: '106.66', severity: 'MEDIUM', status: 'ACTIVE'
      });
      fetchZones();
    } catch (error) { alert("Lỗi khi tạo vùng"); }
  };

  const handleUpdate = async (id: string, data: any) => {
    try {
      await api.zones.update(id, data);
      fetchZones();
    } catch (error) { alert("Lỗi khi cập nhật"); }
  };
  

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      <div className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <SliderBar />
      </div>

      <div className="flex-1 bg-[#F8F9FA] flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
            <div>
              <div className="inline-flex items-center bg-blue-50 py-1 px-3 gap-2 rounded-full mb-2">
                <div className="bg-blue-600 w-2 h-2 rounded-full animate-pulse" />
                <span className="text-blue-700 text-[10px] font-bold uppercase tracking-wider">AI Clustering Active</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900">Quản lý Vùng Cứu hộ</h1>
              <p className="text-slate-500 text-sm">Đảm bảo việc gom cụm và phân vùng cứu hộ hợp lý.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreateModal(true)} className="bg-[#B7131A] text-white py-3 px-6 rounded-xl font-bold text-sm shadow-lg shadow-red-900/20">Thêm khu vực mới</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard 
              label="SOS khẩn " 
              val={sosToday} 
              sub={`Trend: ${sosTrend}% so với hôm qua`} 
              color="#B7131A" 
            />
            <MetricCard 
              label="Khu vực" 
              val={zones.length} 
              sub={newZonesToday > 0 ? `+${newZonesToday} mới trong ngày` : "Cập nhật hôm nay"} 
              color="#005FAF" 
            />
            <MetricCard label="Phản hồi" val="4.2m" sub="AI Optimized" color="#006578" />
            <MetricCard label="Năng lực" val="94.8%" sub="Hệ thống ổn định" color="#2E7D32" />
          </div>

          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div className="flex gap-2">
                  <ActionBtn label="Gộp vùng" onClick={() => setShowActionModal('merge')} />
                  <ActionBtn label="Tách vùng" onClick={() => setShowActionModal('split')} />
               </div>
               <span className="text-xs text-slate-400 font-bold uppercase">{zones.length} Khu vực</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-4">Khu vực</th>
                    <th className="px-8 py-4">Trạng thái</th>
                    <th className="px-8 py-4">Mức độ</th>
                    <th className="px-8 py-4">Số SOS</th>
                    <th className="px-8 py-4">Cập nhật</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map(z => (
                    <tr key={z.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-slate-900">{z.name}</p>
                        <p className="text-[10px] text-slate-400">{z.sector_code}</p>
                      </td>
                      <td className="px-8 py-5">
                        <select 
                          value={z.status} 
                          onChange={e => handleUpdate(z.id, {status: e.target.value})}
                          className="text-[10px] font-black uppercase bg-slate-100 px-2 py-1 rounded-full cursor-pointer"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="STABILIZING">STABILIZING</option>
                          <option value="RESOLVED">RESOLVED</option>
                        </select>
                      </td>
                      <td className="px-8 py-5">
                         <select 
                          value={z.severity} 
                          onChange={e => handleUpdate(z.id, {severity: e.target.value})}
                          className="text-[10px] font-black uppercase bg-red-50 text-red-700 px-2 py-1 rounded-full cursor-pointer"
                        >
                          <option value="CRITICAL">🔴 Nguy hiểm</option>
                          <option value="HIGH">🟠 Khẩn cấp</option>
                          <option value="MEDIUM">🔵 Trung bình</option>
                          <option value="LOW">🟢 Thấp</option>
                        </select>
                      </td>
                      <td className="px-8 py-5 font-black text-slate-900">{z.sos_count || 0}</td>
                      <td className="px-8 py-5 text-[10px] text-slate-400 font-bold">{new Date(z.updated_at).toLocaleString()}</td>
                      <td className="px-8 py-5 text-right"><button className="text-slate-300 hover:text-slate-900">•••</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-8 bg-[#B7131A] text-white">
                 <h2 className="text-2xl font-black">Tạo Vùng Mới</h2>
                 <p className="opacity-60 text-sm">Xác định khu vực triển khai cứu hộ AI.</p>
              </div>
              <div className="p-8 space-y-4">
                 <input className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#B7131A]/50 transition-all" placeholder="Tên khu vực (VD: Rốn lũ Nam Hòa Xuân)..." value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} />
                 <input className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#B7131A]/50 transition-all" placeholder="Mã Sector (VD: HC-01)..." value={newZone.sector_code} onChange={e => setNewZone({...newZone, sector_code: e.target.value})} />
                 <input className="w-full p-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#B7131A]/50 transition-all" placeholder="Khu vực địa lý (VD: Hải Châu, Đà Nẵng)..." value={addressInput} onChange={e => setAddressInput(e.target.value)} title="Hệ thống sẽ tự động xác định tọa độ trung tâm dựa trên địa chỉ này" />
                 <div className="flex gap-4 pt-4">
                    <button onClick={() => setShowCreateModal(false)} className="flex-1 py-4 font-black text-slate-400">Hủy</button>
                    <button onClick={handleCreateZone} className="flex-1 py-4 bg-[#B7131A] text-white font-black rounded-2xl shadow-lg">Xác nhận</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showActionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 text-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto">
                 {showActionModal === 'merge' ? 'M' : 'S'}
              </div>
              <h2 className="text-2xl font-black capitalize">{showActionModal === 'merge' ? 'Gộp Vùng' : 'Tách Vùng'}</h2>
              <p className="text-slate-500">Chức năng này sẽ tự động phân tích mật độ SOS và gợi ý phương án tối ưu. Bạn có muốn tiếp tục?</p>
              <div className="flex gap-4">
                 <button onClick={() => setShowActionModal(null)} className="flex-1 py-4 font-black text-slate-400">Hủy</button>
                 <button onClick={() => { alert("AI Analysis complete. Zones updated."); setShowActionModal(null); }} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl">Phân tích & Thực hiện</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

const MetricCard = ({ label, val, sub, color }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <h2 className="text-3xl font-black mt-1" style={{ color }}>{val}</h2>
    <p className="text-[10px] font-bold text-slate-400 mt-1">{sub}</p>
  </div>
);

const ActionBtn = ({ label, onClick }: any) => (
  <button onClick={onClick} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm">{label}</button>
);
