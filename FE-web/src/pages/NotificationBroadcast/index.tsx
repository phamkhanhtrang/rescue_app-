import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from 'react-router-dom';
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { api } from "../../services/api";
import { contentParts } from '../../utils/contentLinks';
import {
  Bell,
  AlertTriangle,
  Send,
  RefreshCw,
  Trash2,
  Power,
  Layers,
  Clock,
  Radio
} from "lucide-react";

export default function Page() {
  const [searchParams] = useSearchParams();
  const articleId = searchParams.get('article');
  const focusAlertId = searchParams.get('alert');
  const [sourceArticle, setSourceArticle] = useState<any>(null);
  const [sourceError, setSourceError] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoneError, setZoneError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const alertsRequest = useRef(0);
  const mounted = useRef(false);

  // Danh sách các cảnh báo / thông báo đã phát
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'EMERGENCY' | 'BROADCAST' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [formData, setFormData] = useState<{
    msgType: 'EMERGENCY' | 'BROADCAST';
    scope: 'system' | 'zone';
    audience: 'ALL' | 'CITIZEN' | 'RESCUER';
    expiresAt: string;
    selectedId: string;
    title: string;
    message: string;
  }>({
    msgType: 'EMERGENCY',
    scope: 'system',
    audience: 'ALL',
    expiresAt: '',
    selectedId: '',
    title: '',
    message: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const zoneRes = await api.zones.getAll();
      if (!mounted.current) return;
      setZones(zoneRes.data.results || []);
      setZoneError('');
    } catch (err) {
      console.error(err);
      if (mounted.current) setZoneError('Không tải được khu vực. Vui lòng thử lại.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    const requestId = ++alertsRequest.current;
    try {
      setAlertsLoading(true);
      const res = await api.communications.getAll({ tab: 'all' });
      if (!mounted.current || requestId !== alertsRequest.current) return;
      setAlertsList(res.data.results || []);
      setError('');
    } catch (err) {
      console.error("Lỗi lấy danh sách cảnh báo:", err);
      if (mounted.current && requestId === alertsRequest.current) setError('Không tải được danh sách bản tin. Vui lòng làm mới.');
    } finally {
      if (mounted.current && requestId === alertsRequest.current) setAlertsLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    fetchData();
    fetchAlerts();
    const timer = window.setInterval(() => { if (!document.hidden) fetchAlerts(); }, 30000);
    return () => { mounted.current = false; ++alertsRequest.current; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    setSourceArticle(null);
    setSourceError('');
    if (!articleId) { setSourceLoading(false); return; }
    setSourceLoading(true);
    api.ai.getCrawledArticle(articleId).then(res => {
      if (!active) return;
      if (res.data.source_platform === 'FACEBOOK' || !res.data.is_published) {
        setSourceError('Bài báo chưa xuất bản hoặc đã được gỡ. Hãy kiểm tra ở AI Tìm tin.');
        return;
      }
      setSourceArticle(res.data);
      const sourceText = (res.data.raw_content || '').trim();
      const sourceUrl = res.data.source_url ? `\n\nNguồn bài viết: ${res.data.source_url}` : '';
      setFormData(prev => ({ ...prev, title: res.data.raw_title?.slice(0, 255) || '', message: `${sourceText.slice(0, 10000)}${sourceUrl}`, scope: 'zone', selectedId: '' }));
    }).catch(() => { if (active) setSourceError('Không tải được bài nguồn. Hãy mở lại từ AI Tìm tin.'); })
      .finally(() => { if (active) setSourceLoading(false); });
    return () => { active = false; };
  }, [articleId]);

  useEffect(() => {
    if (focusAlertId && alertsList.length) document.getElementById(`alert-${focusAlertId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusAlertId, alertsList.length]);

  const handleSend = async () => {
    if (submitting || sourceLoading || (articleId && (!sourceArticle || sourceArticle.linked_alert_id))) return;
    if (!formData.title.trim() || !formData.message.trim()) {
      alert("Vui lòng nhập đầy đủ tiêu đề và nội dung!");
      return;
    }
    if (formData.scope === 'zone' && !formData.selectedId) {
      alert("Vui lòng chọn khu vực nhận tin!");
      return;
    }

    if (formData.expiresAt && new Date(formData.expiresAt).getTime() <= Date.now()) {
      alert('Thời điểm hết hạn phải ở tương lai.');
      return;
    }
    setSubmitting(true);
    try {
      const isEmergency = formData.msgType === 'EMERGENCY';
      const payload = {
        zone: formData.scope === "zone" && formData.selectedId ? formData.selectedId : null,
        title: formData.title.trim(),
        description: formData.message.trim(),
        severity: isEmergency ? 'CRITICAL' : 'NORMAL',
        message_type: formData.msgType,
        audience: formData.audience,
        expires_at: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        source: "SYSTEM",
        is_active: true,
      };

      const result = articleId ? await api.ai.createNewsAlert(articleId, payload) : await api.communications.createAlert(payload);
      if (articleId) setSourceArticle((prev: any) => ({ ...prev, linked_alert_id: result.data.id }));
      alert('Đã đăng bản tin. Kết quả gửi push và lượt đọc được cập nhật trong danh sách bên dưới.');
      setFormData(prev => ({ ...prev, title: '', message: '' }));
      fetchAlerts();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data ? JSON.stringify(err.response.data) : 'Gửi thất bại, vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (alertItem: any) => {
    if (busyId) return;
    const nextStatus = !alertItem.is_active;
    const confirmMsg = nextStatus
      ? `Kích hoạt lại cảnh báo "${alertItem.title}"?`
      : `Thu hồi / Tắt cảnh báo "${alertItem.title}"?`;
    if (!window.confirm(confirmMsg)) return;
    setBusyId(alertItem.id);
    try {
      await api.communications.updateAlert(alertItem.id, { is_active: nextStatus });
      fetchAlerts();
    } catch (err: any) {
      alert(err.response?.data ? JSON.stringify(err.response.data) : 'Lỗi khi cập nhật trạng thái cảnh báo');
    } finally { setBusyId(null); }
  };

  const handleDeleteAlert = async (id: string, title: string) => {
    if (busyId) return;
    if (!window.confirm(`Bạn có chắc muốn XÓA hẳn bản tin "${title}" khỏi hệ thống?`)) return;
    setBusyId(id);
    try {
      await api.communications.deleteAlert(id);
      fetchAlerts();
    } catch (err) {
      alert("Lỗi khi xóa cảnh báo");
    } finally { setBusyId(null); }
  };

  const displayedAlerts = alertsList.filter(item => {
    if (alertFilter === 'EMERGENCY') return item.message_type === 'EMERGENCY';
    if (alertFilter === 'BROADCAST') return item.message_type !== 'EMERGENCY';
    if (alertFilter === 'ACTIVE') return item.is_active && (!item.expires_at || new Date(item.expires_at).getTime() > Date.now());
    if (alertFilter === 'INACTIVE') return !item.is_active || (item.expires_at && new Date(item.expires_at).getTime() <= Date.now());
    return true;
  });

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden">
      <div className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <SliderBar />
      </div>

      <div className="flex-1 bg-[#F8F9FA] flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="p-8 max-w-6xl mx-auto w-full space-y-10">
          {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
          {sourceLoading && <p>Đang tải bài nguồn...</p>}
          {sourceError && <p role="alert" className="text-red-700">{sourceError}</p>}
          {sourceArticle && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm space-y-2">
            <p className="font-bold">Tạo cảnh báo từ tin tức: {sourceArticle.raw_title}</p>
            <p>Nguồn: {sourceArticle.source_platform} · Địa điểm trong bài: {sourceArticle.extracted_location || 'Chưa xác định'}</p>
            {contentParts(sourceArticle.source_url || '').filter(part => part.url).map(part => <a key={part.url} href={part.url!} target="_blank" rel="noopener noreferrer" className="block text-blue-700 underline break-all">Mở bài báo gốc ↗</a>)}
            <p>Nhập hướng dẫn hành động và chọn phạm vi phát bên dưới. Mức độ trong bài báo không tự quyết định mức độ cảnh báo.</p>
            {sourceArticle.linked_alert_id && <p>Bài đã có cảnh báo liên quan. <a className="underline" href={`?alert=${sourceArticle.linked_alert_id}`}>Mở cảnh báo để quản lý</a></p>}
          </div>}
          {zoneError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{zoneError} <button onClick={fetchData} className="underline">Tải lại khu vực</button></div>}
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Radio className="w-8 h-8 text-blue-600" />
              Phát thanh Cảnh báo & Thông báo
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Phân tách rõ ràng giữa 🚨 Cảnh báo khẩn cấp (thiên tai, nguy hiểm) và 🔔 Thông báo điều phối chỉ đạo chung.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              {/* Chọn loại thông điệp */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">
                  1. Chọn loại thông điệp
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, msgType: 'EMERGENCY' })}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      formData.msgType === 'EMERGENCY'
                        ? 'border-red-500 bg-red-50 ring-2 ring-red-100 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🚨</span>
                      <p className="text-base font-black text-red-600">CẢNH BÁO KHẨN CẤP</p>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      Bão lũ, sạt lở, lệnh sơ tán, nguy hiểm tính mạng. Ưu tiên cao cho đối tượng nhận đã chọn.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, msgType: 'BROADCAST' })}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      formData.msgType === 'BROADCAST'
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🔔</span>
                      <p className="text-base font-black text-blue-700">THÔNG BÁO CHỈ ĐẠO</p>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      Thông tin điều phối định kỳ, hướng dẫn tiếp nhận cứu trợ, lịch phân bổ nhu yếu phẩm.
                    </p>
                  </button>
                </div>
              </div>

              {/* Phạm vi */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">
                  2. Chọn người nhận và khu vực
                </label>
                <select aria-label="Người nhận" className="w-full p-3.5 border rounded-xl" value={formData.audience}
                  onChange={e => setFormData({ ...formData, audience: e.target.value as 'ALL' | 'CITIZEN' | 'RESCUER' })}>
                  <option value="ALL">Tất cả người dân và lực lượng cứu hộ</option>
                  <option value="CITIZEN">Chỉ người dân</option>
                  <option value="RESCUER">Chỉ lực lượng cứu hộ</option>
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <ScopeBtn
                    active={formData.scope === 'system'}
                    label="Toàn hệ thống"
                    onClick={() => setFormData({ ...formData, scope: 'system', selectedId: '' })}
                  />
                  <ScopeBtn
                    active={formData.scope === 'zone'}
                    label="Theo khu vực"
                    onClick={() => setFormData({ ...formData, scope: 'zone' })}
                  />
                </div>
                {formData.scope === 'zone' && (
                  <select
                    disabled={loading}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.selectedId}
                    onChange={(e) => setFormData({ ...formData, selectedId: e.target.value })}
                  >
                    <option value="">-- Chọn khu vực mục tiêu --</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.code || z.id})
                      </option>
                    ))}
                  </select>
                )}
                <label className="block text-sm text-slate-600">
                  Hết hạn lúc (bỏ trống để có hiệu lực đến khi thu hồi)
                  <input type="datetime-local" value={formData.expiresAt}
                    onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="mt-2 w-full p-3 border rounded-xl" />
                </label>
              </div>

              {/* Nội dung */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">
                  3. Nội dung phát thanh
                </label>
                <input
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900"
                  placeholder={
                    formData.msgType === 'EMERGENCY'
                      ? "Tiêu đề cảnh báo (VD: CẢNH BÁO LŨ QUÉT TẠI HUYỆN HÒA VANG...)"
                      : "Tiêu đề thông báo (VD: Thông báo điểm tập kết nhu yếu phẩm mới...)"
                  }
                  value={formData.title}
                  maxLength={255}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
                <textarea
                  className="w-full h-36 p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none font-medium text-slate-800"
                  placeholder="Nội dung chi tiết, hướng dẫn hành động cụ thể cho người dân hoặc lực lượng..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, title: '', message: '' }))}
                  className="px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all text-sm"
                >
                  Xóa trắng
                </button>
                <button
                  type="button"
                  disabled={submitting || sourceLoading || !!sourceError || (!!articleId && (!sourceArticle || !!sourceArticle.linked_alert_id))}
                  onClick={handleSend}
                  className={`px-8 py-3.5 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all text-sm flex items-center gap-2 ${
                    formData.msgType === 'EMERGENCY'
                      ? 'bg-red-600 hover:bg-red-700 shadow-red-500/25'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Send className="w-4 h-4" />
                  {submitting
                    ? 'Đang phát...'
                    : formData.msgType === 'EMERGENCY'
                    ? 'Phát Cảnh Báo Khẩn Cấp'
                    : 'Gửi Thông Báo Chỉ Đạo'}
                </button>
              </div>
            </div>

            {/* Mobile Preview */}
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-[3rem] p-4 shadow-2xl border-[6px] border-slate-800">
                <div className="bg-white rounded-[2.5rem] aspect-[9/18] flex flex-col p-5 space-y-4">
                  <div className="h-4 w-1/3 bg-slate-200 rounded-full mx-auto" />
                  <div className="text-[10px] text-center font-bold text-slate-400 uppercase tracking-wider">
                    Mô phỏng trên App Di Động
                  </div>

                  {formData.msgType === 'EMERGENCY' ? (
                    <div className="p-4 bg-red-50 rounded-2xl shadow-sm border border-red-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🚨</span>
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-wide">
                          CẢNH BÁO KHẨN CẤP
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {formData.title || "Tiêu đề cảnh báo khẩn cấp..."}
                      </h4>
                      <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-4">
                        {formData.message || "Nội dung chỉ đạo ứng phó thiên tai, người dân cần tuân thủ hướng dẫn sơ tán ngay lập tức..."}
                      </p>
                      <div className="text-[9px] font-bold text-red-500 pt-1">
                        {formData.audience === 'ALL' ? 'Tất cả' : formData.audience === 'CITIZEN' ? 'Người dân' : 'Cứu hộ'} · {formData.scope === 'system' ? 'Toàn hệ thống' : zones.find(z => z.id === formData.selectedId)?.name || 'Chọn khu vực'}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-blue-50 rounded-2xl shadow-sm border border-blue-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🔔</span>
                        <span className="text-[10px] font-black text-blue-700 uppercase tracking-wide">
                          THÔNG BÁO CHỈ ĐẠO
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {formData.title || "Tiêu đề thông báo..."}
                      </h4>
                      <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-4">
                        {formData.message || "Nội dung hướng dẫn tiếp nhận cứu trợ, lịch biểu phối hợp..."}
                      </p>
                      <div className="text-[9px] font-bold text-blue-600 pt-1">
                        {formData.audience === 'ALL' ? 'Tất cả' : formData.audience === 'CITIZEN' ? 'Người dân' : 'Cứu hộ'} · {formData.scope === 'system' ? 'Toàn hệ thống' : zones.find(z => z.id === formData.selectedId)?.name || 'Chọn khu vực'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Đối tượng nhận tin
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-black text-slate-900">
                    {formData.audience === 'ALL' ? 'Người dân & cứu hộ' : formData.audience === 'CITIZEN' ? 'Người dân' : 'Lực lượng cứu hộ'}
                  </h2>
                </div>
                <p className="text-xs font-medium text-slate-500">
                  Bản tin được đăng ngay. Push cần thiết bị đã bật thông báo. Lượt đọc chỉ ghi nhận khi người nhận mở chi tiết.
                </p>
              </div>
            </div>
          </div>

          {/* Quản lý danh sách các Cảnh báo & Thông báo đã phát */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-slate-700" />
                  Danh sách Cảnh báo & Thông báo Đã Phát
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Theo dõi trạng thái phát, tắt / bật hoặc xóa các thông báo, cảnh báo khẩn cấp trên hệ thống.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAlerts}
                disabled={alertsLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all w-fit"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${alertsLoading ? 'animate-spin' : ''}`} />
                Làm mới danh sách
              </button>
              <select aria-label="Lọc cảnh báo" value={alertFilter} onChange={e => setAlertFilter(e.target.value as any)} className="px-3 py-2 border rounded-xl text-xs font-bold">
                <option value="ALL">Tất cả</option>
                <option value="EMERGENCY">Cảnh báo khẩn cấp</option>
                <option value="BROADCAST">Thông báo chỉ đạo</option>
                <option value="ACTIVE">Đang hiệu lực</option>
                <option value="INACTIVE">Đã thu hồi / hết hạn</option>
              </select>
            </div>

            {alertsLoading && alertsList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Đang tải danh sách cảnh báo...
              </div>
            ) : alertsList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Chưa có cảnh báo hoặc thông báo nào được phát trên hệ thống.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[11px] font-black tracking-wider">
                      <th className="py-3 px-3">Loại</th>
                      <th className="py-3 px-3">Tiêu đề & Nội dung</th>
                      <th className="py-3 px-3">Phạm vi / Khu vực</th>
                      <th className="py-3 px-3">Thời gian</th>
                      <th className="py-3 px-3 text-center">Trạng thái</th>
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedAlerts.map((item) => {
                      const isCritical = item.message_type === 'EMERGENCY';
                      const isAi = item.source === 'AI';
                      const expired = item.expires_at && new Date(item.expires_at).getTime() <= Date.now();

                      return (
                        <tr id={`alert-${item.id}`} key={item.id} onClick={() => setSelectedAlert(item)} className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${focusAlertId === item.id ? 'bg-amber-50 ring-1 ring-amber-300' : ''}`}>
                          <td className="py-4 px-3 align-top whitespace-nowrap">
                            {isAi ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                🤖 AI Cảnh báo
                              </span>
                            ) : isCritical ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                🚨 Khẩn cấp
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                🔔 Thông báo
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-3 align-top max-w-xs sm:max-w-md">
                            <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                              {item.description}
                            </p>
                          </td>
                          <td className="py-4 px-3 align-top whitespace-nowrap text-xs text-slate-600 font-medium">
                            {item.zone_name || (item.zone ? `Khu vực #${item.zone}` : "Toàn hệ thống")}
                            <p>{item.audience === 'RESCUER' ? 'Chỉ cứu hộ' : item.audience === 'CITIZEN' ? 'Chỉ người dân' : 'Người dân & cứu hộ'}</p>
                          </td>
                          <td className="py-4 px-3 align-top whitespace-nowrap text-xs text-slate-500 font-medium">
                            {item.created_at ? new Date(item.created_at).toLocaleString("vi-VN") : "---"}
                            {item.expires_at && <p>Hết hạn: {new Date(item.expires_at).toLocaleString('vi-VN')}</p>}
                          </td>
                          <td className="py-4 px-3 align-top text-center whitespace-nowrap">
                            {item.is_active && !expired ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                                Đang hiệu lực
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
                                {expired ? 'Đã hết hạn' : 'Đã thu hồi'}
                              </span>
                            )}
                            {item.delivery_status && <div className="mt-2 text-xs text-slate-500 text-left">
                              {!item.delivery_status.push_enabled && <p>Push chưa bật · Bản tin vẫn có trên app</p>}
                              <p>Đã đăng · Đã đọc: {item.delivery_status.read_count}</p>
                              <p>Chờ push: {item.delivery_status.queued} · Expo tiếp nhận: {item.delivery_status.expo_accepted}</p>
                              <p>Dịch vụ push xác nhận: {item.delivery_status.push_service_confirmed}</p>
                              <p>Lỗi: {item.delivery_status.failed} · Chưa rõ kết quả: {item.delivery_status.unknown}</p>
                            </div>}
                          </td>
                          <td className="py-4 px-3 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                title={item.is_active ? "Tắt phát cảnh báo này" : "Bật lại cảnh báo này"}
                                disabled={!!busyId || (!item.is_active && !!expired)}
                                onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  item.is_active
                                    ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                }`}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="Xóa bỏ cảnh báo này"
                                disabled={!!busyId}
                                onClick={(e) => { e.stopPropagation(); handleDeleteAlert(item.id, item.title); }}
                                className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {selectedAlert && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedAlert(null)}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-7 space-y-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4"><div>
                <p className={`text-xs font-black uppercase ${selectedAlert.message_type === 'EMERGENCY' ? 'text-red-600' : 'text-blue-700'}`}>{selectedAlert.message_type === 'EMERGENCY' ? 'Cảnh báo khẩn cấp' : 'Thông báo chỉ đạo'}</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{selectedAlert.title}</h3>
              </div><button className="text-2xl text-slate-400" onClick={() => setSelectedAlert(null)} aria-label="Đóng">×</button></div>
              <div className="grid grid-cols-2 gap-3 text-sm"><p><b>Người nhận:</b> {selectedAlert.audience === 'RESCUER' ? 'Lực lượng cứu hộ' : selectedAlert.audience === 'CITIZEN' ? 'Người dân' : 'Người dân & cứu hộ'}</p><p><b>Khu vực:</b> {selectedAlert.zone_name || 'Toàn hệ thống'}</p><p><b>Đăng lúc:</b> {new Date(selectedAlert.published_at || selectedAlert.created_at).toLocaleString('vi-VN')}</p><p><b>Trạng thái:</b> {selectedAlert.is_active ? 'Đang hiệu lực' : 'Đã thu hồi'}</p>{selectedAlert.expires_at && <p><b>Hết hạn:</b> {new Date(selectedAlert.expires_at).toLocaleString('vi-VN')}</p>}</div>
              <div className="rounded-2xl bg-slate-50 border p-4 whitespace-pre-wrap break-words text-slate-800 leading-relaxed">{contentParts(selectedAlert.description || 'Không có nội dung.').map((part, index) => part.url
                ? <a key={index} href={part.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all">{part.text}</a>
                : <React.Fragment key={index}>{part.text}</React.Fragment>)}</div>
              {selectedAlert.source_article && <div className="rounded-xl bg-blue-50 p-4 text-sm"><b>Tin nguồn:</b> {selectedAlert.source_article.title}<br/><span className="text-slate-600">Đây là cảnh báo được tạo từ một bài tin tức đã duyệt.</span></div>}
              {selectedAlert.delivery_status && <div className="text-sm text-slate-600"><b>Phân phối:</b> Đã đọc {selectedAlert.delivery_status.read_count}; chờ push {selectedAlert.delivery_status.queued}; Expo tiếp nhận {selectedAlert.delivery_status.expo_accepted}; lỗi {selectedAlert.delivery_status.failed}.</div>}
              <div className="flex justify-end"><button className="px-4 py-2 rounded-xl bg-slate-100 font-bold" onClick={() => setSelectedAlert(null)}>Đóng</button></div>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

const ScopeBtn = ({ active, label, onClick }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`py-3 px-3 rounded-xl border-2 font-bold text-xs transition-all ${
      active
        ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm'
        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
    }`}
  >
    {label}
  </button>
);
