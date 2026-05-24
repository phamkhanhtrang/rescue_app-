import React, { useEffect, useState } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    scope: 'zone',
    selectedId: '',
    title: '',
    message: '',
    priority: 'NORMAL'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [zoneRes, rescuerRes] = await Promise.all([
          api.zones.getAll(),
          api.rescuers.getAll()
        ]);
        setZones(zoneRes.data.results || []);
        setTeams(rescuerRes.data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSend = async () => {
    if (!formData.title || !formData.message) {
      alert("Vui lòng nhập đầy đủ tiêu đề và nội dung");
      return;
    }
    try {
      const payload = {
        zone: formData.scope === "zone" && formData.selectedId ? formData.selectedId : null,
        title: formData.title,
        description: formData.message,
        severity: formData.priority,
        category: formData.scope,
        source: "SYSTEM",
      };
      
      const res = await api.communications.createAlert(payload);
      
      console.log("Sending Alert:", res.data);
      alert("Thông báo đã được gửi thành công!");
      setFormData({ ...formData, title: '', message: '' });
    } catch (err) {
      console.error(err);
      alert("Gửi thất bại!");
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      <div className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <SliderBar />
      </div>

      <div className="flex-1 bg-[#F8F9FA] flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="p-8 max-w-6xl mx-auto w-full space-y-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-black text-slate-900">Tin nhắn thông báo</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
              {/* Phạm vi */}
              <div className="space-y-4">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Chọn phạm vi</label>
                <div className="grid grid-cols-3 gap-4">
                  <ScopeBtn active={formData.scope === 'system'} label="Toàn dân" onClick={() => setFormData({...formData, scope: 'system'})} />
                  <ScopeBtn active={formData.scope === 'zone'} label="Theo khu vực" onClick={() => setFormData({...formData, scope: 'zone'})} />
                  <ScopeBtn active={formData.scope === 'teams'} label="Đội cứu hộ" onClick={() => setFormData({...formData, scope: 'teams'})} />
                </div>
                {formData.scope === 'zone' && (
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                    value={formData.selectedId}
                    onChange={e => setFormData({...formData, selectedId: e.target.value})}
                  >
                    <option value="">-- Chọn khu vực --</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                )}
                {/* {formData.scope === 'teams' && (
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                    value={formData.selectedId}
                    onChange={e => setFormData({...formData, selectedId: e.target.value})}
                  >
                    <option value="">-- Chọn đội cứu trợ --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.rescuer_profile?.unit_name || t.full_name || t.username}
                      </option>
                    ))}
                  </select>
                )} */}
              </div>

              {/* Mức độ */}
              <div className="space-y-4">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Mức độ ưu tiên</label>
                <div className="grid grid-cols-2 gap-4">
                  <PriorityBtn 
                    active={formData.priority === 'CRITICAL'} 
                    label="Nguy hiểm" 
                    desc="Cần hành động ngay" 
                    color="red"
                    onClick={() => setFormData({...formData, priority: 'CRITICAL'})} 
                  />
                  <PriorityBtn 
                    active={formData.priority === 'NORMAL'} 
                    label="Ổn định" 
                    desc="Thông báo định kỳ" 
                    color="blue"
                    onClick={() => setFormData({...formData, priority: 'NORMAL'})} 
                  />
                </div>
              </div>

              {/* Nội dung */}
              <div className="space-y-4">
                <input 
                  className="w-full p-4 bg-slate-100 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  placeholder="Tiêu đề thông báo..."
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
                <textarea 
                  className="w-full h-40 p-4 bg-slate-100 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Nội dung chi tiết..."
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-4">
                <button className="px-8 py-4 rounded-xl bg-slate-100 font-bold hover:bg-slate-200 transition-all">Lưu nháp</button>
                <button 
                  onClick={handleSend}
                  className="px-8 py-4 rounded-xl bg-[#005FAF] text-white font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  Gửi thông báo
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-8">
               <div className="bg-slate-900 rounded-[3rem] p-4 shadow-2xl border-[6px] border-slate-800">
                  <div className="bg-white rounded-[2.5rem] aspect-[9/19] flex flex-col p-6 space-y-4">
                    <div className="h-6 w-1/2 bg-slate-100 rounded-full mx-auto" />
                    <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-100 space-y-2">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-red-600" />
                         <span className="text-[10px] font-black text-red-600 uppercase">Alert</span>
                       </div>
                       <h4 className="text-xs font-black">{formData.title || "Evacuation Directive"}</h4>
                       <p className="text-[10px] text-slate-500 leading-tight">{formData.message || "Proceed to high-ground assembly points. AI paths verified."}</p>
                    </div>
                  </div>
               </div>

               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reach Estimation</p>
                  <h2 className="text-3xl font-black text-slate-900">12,482</h2>
                  <p className="text-[10px] font-bold text-blue-600 mt-2 uppercase">Active Devices in System</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ScopeBtn = ({ active, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`py-4 px-2 rounded-xl border-2 font-bold text-xs transition-all ${active ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
  >
    {label}
  </button>
);

const PriorityBtn = ({ active, label, desc, color, onClick }: any) => {
  const activeClass = color === 'red' ? 'border-red-600 bg-red-50 ring-2 ring-red-100' : 'border-blue-600 bg-blue-50 ring-2 ring-blue-100';
  return (
    <button 
      onClick={onClick}
      className={`p-4 rounded-xl border-2 text-left transition-all ${active ? activeClass : 'border-transparent bg-slate-50 hover:border-slate-200'}`}
    >
      <p className={`text-base font-black ${color === 'red' ? 'text-red-600' : 'text-blue-600'}`}>{label}</p>
      <p className="text-[10px] text-slate-500 font-bold uppercase">{desc}</p>
    </button>
  );
}
