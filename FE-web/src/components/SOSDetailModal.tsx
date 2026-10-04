import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  X, Phone, MapPin, Users, AlertTriangle, CheckCircle,
  Clock, ShieldAlert, FileText, Image as ImageIcon,
  ExternalLink, ChevronRight, MessageSquare, Package
} from 'lucide-react';

interface SOSDetailModalProps {
  sosId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

const VERIFICATION_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  UNVERIFIED: { label: 'Chưa xác minh', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  CHECKING:   { label: 'Đang gọi kiểm tra', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  VERIFIED:   { label: 'Đã xác minh đúng', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  INCORRECT:  { label: 'Thông tin sai / Tin giả', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

const EMERGENCY_MAP: Record<string, { label: string; icon: string }> = {
  RESCUE:  { label: 'Cứu hộ khẩn cấp', icon: '🚨' },
  MEDICAL: { label: 'Cấp cứu Y tế', icon: '🏥' },
  FOOD:    { label: 'Cứu trợ Lương thực', icon: '🍽️' },
  FIRE:    { label: 'Hỏa hoạn', icon: '🔥' },
  OTHER:   { label: 'Khác', icon: '⚠️' },
};

const PRESET_FAKE_REASONS = [
  'Số điện thoại thuê bao / Không liên lạc được',
  'Tin quấy rối / Báo đùa',
  'Người dân báo nhầm / Đã tự an toàn',
  'Địa chỉ và tọa độ không có thật',
];
const SUPPLY_LABELS: Record<string, string> = {
  water: 'Nước uống', food: 'Thực phẩm/mì', medicine: 'Thuốc men',
  life_jacket: 'Áo phao', rice: 'Gạo/muối',
};

export default function SOSDetailModal({ sosId, isOpen, onClose, onUpdated }: SOSDetailModalProps) {
  const [sos, setSos] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [supplyNeeds, setSupplyNeeds] = useState<Record<string, string>>({ water: '0', food: '0', medicine: '0', life_jacket: '0' });

  // Reject / Fake modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState(PRESET_FAKE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  const fetchDetail = async () => {
    if (!sosId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.sos.getDetail(sosId);
      setSos(res.data);
      setSupplyNeeds({
        water: String(res.data.supplies_needed?.water || 0),
        food: String(res.data.supplies_needed?.food || 0),
        medicine: String(res.data.supplies_needed?.medicine || 0),
        life_jacket: String(res.data.supplies_needed?.life_jacket || 0),
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Không thể tải thông tin SOS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && sosId) {
      fetchDetail();
      setShowRejectModal(false);
      setSelectedImage(null);
    } else {
      setSos(null);
    }
  }, [isOpen, sosId]);

  if (!isOpen) return null;

  const handleVerify = async (status: 'CHECKING' | 'VERIFIED' | 'INCORRECT' | 'UNVERIFIED', message: string) => {
    if (!sosId) return;
    setSubmitting(true);
    try {
      const res = await api.sos.action(sosId, {
        action: 'verify',
        verification_status: status,
        message,
      });
      setSos(res.data);
      if (onUpdated) onUpdated();
      if (status === 'INCORRECT') {
        setShowRejectModal(false);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Thao tác thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const vInfo = VERIFICATION_MAP[sos?.verification_status || 'UNVERIFIED'] || VERIFICATION_MAP.UNVERIFIED;
  const eInfo = EMERGENCY_MAP[sos?.emergency_type?.toUpperCase()] || { label: sos?.emergency_type || 'Cứu hộ', icon: '🚨' };

  const saveSupplyNeeds = async () => {
    if (!sosId) return;
    setSubmitting(true);
    try {
      const supplies_needed = Object.fromEntries(Object.entries(supplyNeeds).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]));
      const res = await api.sos.action(sosId, { action: 'update_supplies_needed', supplies_needed, message: 'Admin cập nhật nhu cầu tiếp tế.' });
      setSos(res.data);
      onUpdated?.();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Không thể cập nhật nhu cầu tiếp tế.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{eInfo.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Chi tiết Yêu cầu SOS</h2>
                <span className="text-xs font-mono text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {sos?.id?.slice(0, 8) || '...'}
                </span>
              </div>
              <p className="text-xs text-slate-500">{eInfo.label} · Gửi lúc {sos?.sent_at ? new Date(sos.sent_at).toLocaleString('vi-VN') : '...'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-9 h-9 border-4 border-[#B7131A] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-500">Đang tải dữ liệu SOS...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 text-red-700 rounded-2xl text-center">
              <AlertTriangle className="mx-auto mb-2 text-red-500" size={32} />
              <p className="font-bold">{error}</p>
            </div>
          ) : sos ? (
            <>
              {/* Status Banner (Phân biệt rõ ràng ĐÃ XỬ LÝ vs CHƯA XỬ LÝ vs ĐANG XỬ LÝ) */}
              {sos.status === 'RESOLVED' ? (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                          YÊU CẦU ĐÃ ĐƯỢC XỬ LÝ & CỨU HỘ HOÀN TẤT
                        </span>
                        <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-md">
                          ✓ ĐÃ AN TOÀN
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5 font-medium">
                        Nạn nhân đã được đội cứu nạn tiếp cận và cứu trợ an toàn. Hồ sơ yêu cầu này đã được đóng thành công.
                      </p>
                    </div>
                  </div>
                  {sos.assigned_rescuer ? (
                    <div className="text-xs font-bold text-emerald-900 bg-white/90 px-3.5 py-2 rounded-xl border border-emerald-200">
                      🧑‍🚒 Đội cứu nạn: <strong>{sos.assigned_rescuer.name}</strong> ({sos.assigned_rescuer.phone || 'Không có SĐT'})
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
                      Đã ghi nhận hoàn thành ca
                    </span>
                  )}
                </div>
              ) : sos.status === 'PENDING' ? (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-sm animate-pulse">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-amber-950 uppercase tracking-wide">
                          TÍN HIỆU ĐANG CHỜ CỨU NẠN (CHƯA XỬ LÝ)
                        </span>
                        <span className="text-[10px] bg-amber-600 text-white font-black px-2.5 py-0.5 rounded-md animate-pulse">
                          ⚠️ CẦN TIẾP ỨNG GẤP
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 mt-0.5 font-medium">
                        Người dân đang chờ trợ giúp tại hiện trường! Cần gọi đối chiếu thông tin và phân công đội cứu trợ tiếp cận ngay.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-xl border text-xs font-black ${vInfo.bg} ${vInfo.text} ${vInfo.border} flex items-center gap-1.5`}>
                      <ShieldAlert size={15} />
                      <span>{vInfo.label}</span>
                    </div>
                  </div>
                </div>
              ) : sos.status === 'IN_PROGRESS' || sos.status === 'ACKNOWLEDGED' ? (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50 border-2 border-blue-300 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                      <Clock size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-blue-950 uppercase tracking-wide">
                          ĐỘI CỨU HỘ ĐANG TRÊN ĐƯỜNG TIẾP CẬN / ỨNG CỨU
                        </span>
                        <span className="text-[10px] bg-blue-600 text-white font-black px-2.5 py-0.5 rounded-md">
                          🚨 ĐANG XỬ LÝ
                        </span>
                      </div>
                      <p className="text-xs text-blue-800 mt-0.5 font-medium">
                        {sos.assigned_rescuer ? `Đội ${sos.assigned_rescuer.name} đang trực tiếp triển khai nhiệm vụ tại vị trí nạn nhân.` : 'Lực lượng cứu trợ đang triển khai di chuyển đến hiện trường.'}
                      </p>
                    </div>
                  </div>
                  {sos.assigned_rescuer && (
                    <div className="text-xs font-bold text-blue-900 bg-white px-3.5 py-2 rounded-xl border border-blue-200">
                      🧑‍🚒 Đội phụ trách: <strong>{sos.assigned_rescuer.name}</strong> ({sos.assigned_rescuer.phone || 'Không có SĐT'})
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-xl border text-xs font-black ${vInfo.bg} ${vInfo.text} ${vInfo.border} flex items-center gap-1.5`}>
                      <ShieldAlert size={15} />
                      <span>Trạng thái: {vInfo.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                      Trạng thái ứng cứu: <strong className="text-slate-900">{sos.status}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Main Grid: Left = Contact & Location, Right = Verify Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left 7 cols: Citizen Info */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Citizen Contact Card */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users size={14} /> Thông tin Người Cần Cứu
                      </span>
                      {sos.status === 'RESOLVED' ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-md">
                          ✓ ĐÃ AN TOÀN
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-md animate-pulse">
                          ⚠️ ĐANG CẦN CỨU
                        </span>
                      )}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[11px] text-slate-400 font-bold">Họ và tên</p>
                        <p className="text-sm font-black text-slate-900">{sos.contact_name || sos.citizen_name || 'Người dân ẩn danh'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 font-bold">Số lượng người</p>
                        <p className="text-sm font-black text-[#B7131A]">{sos.people_count || 1} người</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-slate-400 font-bold">Số điện thoại liên hệ</p>
                        <p className="text-base font-black text-slate-900 font-mono">{sos.contact_phone || sos.phone || 'Chưa cung cấp'}</p>
                      </div>
                      {sos.contact_phone || sos.phone ? (
                        <a
                          href={`tel:${sos.contact_phone || sos.phone}`}
                          className={`px-4 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 ${
                            sos.status === 'RESOLVED'
                              ? 'bg-slate-700 hover:bg-slate-800'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          <Phone size={14} /> {sos.status === 'RESOLVED' ? 'Gọi liên hệ lại' : 'Gọi xác minh ngay'}
                        </a>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                        <MapPin size={12} /> Địa chỉ / Vị trí khai báo
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{sos.address || 'Không có mô tả địa chỉ cụ thể'}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Tọa độ: {sos.location_lat}, {sos.location_lng} ({sos.location_source || 'GPS'})
                      </p>
                    </div>

                    {sos.note && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                          <FileText size={12} /> Ghi chú từ người gửi
                        </p>
                        <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-xs text-slate-700 mt-1 whitespace-pre-line leading-relaxed font-medium">
                          {sos.note}
                        </div>
                      </div>
                    )}

                    {/* Assigned Rescuer Status */}
                    {sos.assigned_rescuer ? (
                      <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                            <span>🧑‍🚒</span>
                            Đội Cứu Hộ Phụ Trách
                          </p>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-200 text-blue-800">
                            {sos.mission_status || 'Đang tiếp cận'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-slate-800">
                          {sos.assigned_rescuer.name || 'Cứu hộ viên'}
                        </p>
                        {sos.assigned_rescuer.phone && (
                          <p className="text-xs text-slate-600 font-bold flex items-center gap-1">
                            <Phone size={12} className="text-blue-600" />
                            <span>SĐT: {sos.assigned_rescuer.phone}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 text-xs text-amber-800 font-bold flex items-center gap-2">
                        <span>⚡</span>
                        <span>Yêu cầu này chưa được phân công cho đội cứu hộ nào.</span>
                      </div>
                    )}

                    {/* Relief Supplies Needs & Delivered */}
                    {(sos.supplies_needed || sos.supplies_delivered) && (
                      <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                          <Package size={14} className="text-[#B7131A]" /> Sổ Tiếp Tế & Nhu Cầu Cứu Trợ
                        </h4>

                        {/* Needs */}
                        {sos.supplies_needed && Object.keys(sos.supplies_needed).length > 0 && (
                          <div>
                            <p className="text-[11px] text-slate-500 font-bold mb-1">Nhu cầu cần hỗ trợ:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(sos.supplies_needed).map(([item, qty]: any) => (
                                <span key={item} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-xs font-black">
                                  {SUPPLY_LABELS[item] || item}: cần {qty} · còn {Math.max(0, Number(qty) - Number(sos.supplies_delivered?.[item] || 0))}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Delivered */}
                        {sos.supplies_delivered && Object.keys(sos.supplies_delivered).length > 0 ? (
                          <div className="pt-2 border-t border-slate-100">
                            <p className="text-[11px] text-emerald-600 font-bold mb-1 flex items-center gap-1">
                              <CheckCircle size={12} /> Đã nhận hàng cứu trợ:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(sos.supplies_delivered).map(([item, qty]: any) => (
                                <span key={item} className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md text-xs font-black">
                                  ✓ {SUPPLY_LABELS[item] || item}: {qty}
                                </span>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-400 italic mt-1.5">
                              ⚠️ Đã có đoàn phát hàng. Vui lòng kiểm tra kỹ tránh phát trùng đồ cứu trợ.
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">Chưa có ghi nhận phát hàng tại điểm này.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Attached Images */}
                  {sos.images && sos.images.length > 0 && (
                    <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <ImageIcon size={14} /> Ảnh Hiện Trường ({sos.images.length})
                      </h3>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {sos.images.map((img: any, idx: number) => {
                          const src = img.image.startsWith('http') ? img.image : `http://127.0.0.1:8000${img.image}`;
                          return (
                            <img
                              key={img.id || idx}
                              src={src}
                              alt="Hiện trường"
                              onClick={() => setSelectedImage(src)}
                              className="w-24 h-24 object-cover rounded-xl border border-slate-200 hover:opacity-90 cursor-pointer shadow-sm transition-all"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Events Log */}
                  {sos.events && sos.events.length > 0 && (
                    <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Clock size={14} /> Nhật Ký Xử Lý
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto divide-y divide-slate-50">
                        {sos.events.map((ev: any) => (
                          <div key={ev.id} className="pt-2 first:pt-0 text-xs">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-black text-slate-600">{ev.kind}</span>
                              <span>{new Date(ev.created_at).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="text-slate-700 mt-0.5">{ev.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Right 5 cols: Verification Actions OR Completed Result */}
                <div className="lg:col-span-5 space-y-5">
                  {sos.status === 'RESOLVED' ? (
                    <div className="p-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 space-y-4">
                      <div className="flex items-center gap-2 text-emerald-950 font-black text-sm">
                        <CheckCircle className="text-emerald-600 shrink-0" size={20} />
                        <span>Hồ Sơ Cứu Trợ Đã Hoàn Thành</span>
                      </div>
                      <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                        Yêu cầu này đã được lực lượng cứu nạn xử lý xong. Nạn nhân đã nhận trợ giúp an toàn tại hiện trường.
                      </p>

                      {sos.assigned_rescuer && (
                        <div className="p-4 bg-white rounded-xl border border-emerald-200 text-xs space-y-1 shadow-2xs">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Đội Cứu Trợ Hoàn Thành</p>
                          <p className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                            <span>🧑‍🚒</span> {sos.assigned_rescuer.name}
                          </p>
                          {sos.assigned_rescuer.phone && (
                            <p className="text-slate-600 font-mono text-[11px] mt-0.5">📞 {sos.assigned_rescuer.phone}</p>
                          )}
                        </div>
                      )}

                      {sos.supplies_delivered && Object.keys(sos.supplies_delivered).length > 0 && (
                        <div className="p-4 bg-white rounded-xl border border-emerald-200 text-xs space-y-2 shadow-2xs">
                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                            <Package size={13} /> Nhu yếu phẩm đã bàn giao
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(sos.supplies_delivered).map(([k, v]) => (
                              <div key={k} className="flex justify-between bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                                <span className="text-slate-600 font-medium">{SUPPLY_LABELS[k] || k}:</span>
                                <strong className="text-emerald-900">{String(v)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between">
                        <span>Trạng thái hồ sơ:</span>
                        <span className="bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-md">
                          ✓ ĐÃ ĐÓNG HỒ SƠ
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><Package size={17} className="text-[#B7131A]" /> Khai báo nhu cầu tiếp tế</h3>
                          <p className="text-[11px] text-slate-500 mt-1">Nhập tổng nhu cầu của hộ. Hệ thống tự trừ phần các đội đã giao.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ['water', 'Nước uống'], ['food', 'Thực phẩm/mì'],
                            ['medicine', 'Thuốc men'], ['life_jacket', 'Áo phao'],
                          ].map(([key, label]) => (
                            <label key={key} className="text-[11px] font-bold text-slate-600">
                              {label}
                              <input type="number" min="0" value={supplyNeeds[key]} onChange={event => setSupplyNeeds(current => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black" />
                            </label>
                          ))}
                        </div>
                        <button onClick={saveSupplyNeeds} disabled={submitting} className="w-full py-2.5 bg-slate-900 disabled:opacity-40 text-white rounded-xl text-xs font-black">Lưu nhu cầu tiếp tế</button>
                      </div>
                      <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <ShieldAlert className="text-[#B7131A]" size={18} />
                            Thao Tác Xác Minh
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Admin gọi điện đối chiếu thông tin để xác thực trước khi điều phối đội cứu hộ.
                          </p>
                        </div>

                        {/* Status Feedback Banner */}
                        {sos.verification_status === 'VERIFIED' ? (
                          <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-1.5">
                            <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wide">
                              <CheckCircle size={17} className="text-emerald-600 shrink-0" />
                              <span>Yêu cầu ĐÃ ĐƯỢC XÁC THỰC THÀNH CÔNG</span>
                            </div>
                            <p className="text-xs text-emerald-700 leading-relaxed">
                              Thông tin và vị trí người dân đã được kiểm chứng chuẩn xác. Đã sẵn sàng hoặc đang trong quá trình điều phối cứu hộ.
                            </p>
                          </div>
                        ) : sos.verification_status === 'CHECKING' ? (
                          <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-2xl space-y-1.5">
                            <div className="flex items-center gap-2 text-blue-800 font-black text-xs uppercase tracking-wide">
                              <Phone size={17} className="text-blue-600 animate-pulse shrink-0" />
                              <span>ĐANG GỌI KIỂM TRA ĐỐI CHIẾU</span>
                            </div>
                            <p className="text-xs text-blue-700 leading-relaxed">
                              Admin đang liên hệ với người dân. Sau khi trao đổi xong, hãy bấm <strong>"Xác thực tin đúng"</strong> bên dưới.
                            </p>
                          </div>
                        ) : sos.verification_status === 'INCORRECT' ? (
                          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-1.5">
                            <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wide">
                              <X size={17} className="text-rose-600 shrink-0" />
                              <span>YÊU CẦU ĐÃ BỊ HỦY / BÁO TIN GIẢ</span>
                            </div>
                            <p className="text-xs text-rose-700 leading-relaxed">
                              Yêu cầu đã được loại khỏi danh sách cứu nạn của Vùng để tránh điều phối nhầm.
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-800">
                            <p className="font-bold flex items-center gap-1.5 text-amber-900">
                              <AlertTriangle size={14} className="text-amber-600" />
                              Tin mới gửi · Chưa xác minh
                            </p>
                            <p className="text-[11px] leading-relaxed">
                              Bấm nút gọi trực tiếp cho người dân để kiểm tra trước khi bấm nút xác thực.
                            </p>
                          </div>
                        )}

                        <div className="space-y-2.5">
                          {/* Trạng thái VERIFIED */}
                          {sos.verification_status === 'VERIFIED' ? (
                            <>
                              <div className="w-full py-3.5 px-4 bg-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-between shadow-sm">
                                <span className="flex items-center gap-2">
                                  <CheckCircle size={16} /> ✓ Đã xác thực tin đúng (Hiện tại)
                                </span>
                                <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                                  ĐẠT CHUẨN
                                </span>
                              </div>

                              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                                <p className="text-[11px] text-slate-400 font-medium">Thay đổi trạng thái nếu cần điều chỉnh:</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleVerify('CHECKING', 'Admin gọi lại kiểm tra bổ sung thông tin với người dân.')}
                                    disabled={submitting}
                                    className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-xl border border-slate-200 transition"
                                  >
                                    📞 Gọi lại
                                  </button>
                                  <button
                                    onClick={() => setShowRejectModal(true)}
                                    disabled={submitting}
                                    className="flex-1 py-2 px-3 bg-white hover:bg-red-50 text-red-600 font-bold text-[11px] rounded-xl border border-red-200 transition"
                                  >
                                    ✕ Báo hủy / Tin giả
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : sos.verification_status === 'CHECKING' ? (
                            <>
                              <div className="w-full py-3 px-4 bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center justify-between shadow-sm">
                                <span className="flex items-center gap-2">
                                  <Phone size={15} className="animate-pulse" /> 1. Đang gọi kiểm tra (Hiện tại)
                                </span>
                                <span className="text-[10px] bg-blue-800 px-2 py-0.5 rounded">ĐANG XỬ LÝ</span>
                              </div>

                              <button
                                onClick={() => handleVerify('VERIFIED', 'Admin đã liên hệ người dân, xác nhận đúng thông tin và vị trí cứu trợ.')}
                                disabled={submitting}
                                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-between shadow-md transition-all active:scale-95 cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <CheckCircle size={16} /> 2. Xác thực tin đúng (Sau khi gọi xong)
                                </span>
                                <span className="text-[10px] bg-emerald-800 px-2.5 py-0.5 rounded font-bold">XÁC NHẬN</span>
                              </button>

                              <button
                                onClick={() => setShowRejectModal(true)}
                                disabled={submitting}
                                className="w-full py-2.5 px-4 bg-white hover:bg-red-50 text-red-600 font-bold text-xs rounded-xl border border-red-200 flex items-center justify-between shadow-xs transition"
                              >
                                <span className="flex items-center gap-2">
                                  <X size={15} /> 3. Báo tin giả / Hủy yêu cầu
                                </span>
                              </button>
                            </>
                          ) : sos.verification_status === 'INCORRECT' ? (
                            <>
                              <div className="w-full py-3 px-4 bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center justify-between shadow-sm">
                                <span className="flex items-center gap-2">
                                  <X size={15} /> ✕ Đã hủy / Báo tin giả (Hiện tại)
                                </span>
                                <span className="text-[10px] bg-rose-800 px-2 py-0.5 rounded">ĐÃ HỦY</span>
                              </div>

                              <div className="pt-2 border-t border-slate-200/80">
                                <button
                                  onClick={() => handleVerify('UNVERIFIED', 'Admin phục hồi lại trạng thái chờ xác minh.')}
                                  disabled={submitting}
                                  className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition"
                                >
                                  ↺ Phục hồi về "Chờ xác minh"
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleVerify('CHECKING', 'Admin bắt đầu gọi điện đối chiếu thông tin với người dân.')}
                                disabled={submitting}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-between shadow-sm transition-all active:scale-95 cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <Phone size={15} /> 1. Bắt đầu gọi kiểm tra
                                </span>
                                <span className="text-[10px] bg-blue-800 px-2 py-0.5 rounded">BẮT ĐẦU</span>
                              </button>

                              <button
                                onClick={() => handleVerify('VERIFIED', 'Admin xác nhận thông tin chính xác.')}
                                disabled={submitting}
                                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-between shadow-sm transition-all active:scale-95 cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <CheckCircle size={15} /> 2. Xác thực tin đúng
                                </span>
                                <span className="text-[10px] bg-emerald-800 px-2.5 py-0.5 rounded font-bold">XÁC MINH</span>
                              </button>

                              <button
                                onClick={() => setShowRejectModal(true)}
                                disabled={submitting}
                                className="w-full py-2.5 px-4 bg-white hover:bg-red-50 text-red-600 font-bold text-xs rounded-xl border border-red-200 flex items-center justify-between shadow-xs transition cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <X size={15} /> 3. Báo tin giả / Hủy yêu cầu
                                </span>
                              </button>
                            </>
                          )}
                        </div>

                        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                          💡 <strong>Lưu ý:</strong> Khi đánh dấu <em>Tin giả</em>, hệ thống sẽ tự động loại bỏ SOS này khỏi Vùng để các đội cứu hộ không tiếp nhận nhầm.
                        </div>
                      </div>
                    </>
                  )}
                </div>

              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>

      {/* Mini Reject / Fake Confirmation Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={20} />
              Lý do Báo Tin Giả / Hủy SOS
            </h3>
            <p className="text-xs text-slate-500">
              Vui lòng chọn lý do để lưu vào nhật ký và hủy điều phối yêu cầu này:
            </p>

            <div className="space-y-2">
              {PRESET_FAKE_REASONS.map((r, i) => (
                <label key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 text-xs font-medium cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="rejectReason"
                    value={r}
                    checked={rejectReason === r && !customReason}
                    onChange={() => { setRejectReason(r); setCustomReason(''); }}
                    className="text-red-600"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div>
              <input
                type="text"
                placeholder="Hoặc nhập lý do khác..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
              >
                Quay lại
              </button>
              <button
                onClick={() => handleVerify('INCORRECT', customReason.trim() || rejectReason)}
                disabled={submitting}
                className="flex-1 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận Hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Full View Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh]">
            <img src={selectedImage} alt="Phóng to ảnh" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center font-bold shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
