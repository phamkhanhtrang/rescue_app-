import React, { useEffect, useRef, useState } from "react";
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import { apiClient } from "../../services/api";

const states: Record<string, string> = { PENDING: 'Chờ duyệt', ACTIVE: 'Đang hoạt động', REJECTED: 'Bị từ chối', BANNED: 'Bị khóa' };
const roles: Record<string, string> = { CITIZEN: 'Người dân', RESCUER: 'Cứu hộ', ADMIN: 'Quản trị viên' };
const errorText = (e: any) => e?.response?.data?.error || e?.response?.data?.detail || 'Không tải được dữ liệu. Vui lòng thử lại.';
const fieldClass = 'border border-slate-300 rounded-lg px-3 py-2 bg-white';
export default function Account() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [contact, setContact] = useState({ full_name: '', phone: '', email: '', address: '' });
  const detailGeneration = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setPage(1);
    const timer = setTimeout(() => {
      apiClient.get('/accounts/profiles/', { params: { role, status, search }, signal: controller.signal })
        .then(({ data }) => { if (!controller.signal.aborted) setUsers(data.results || []); })
        .catch(e => { if (!controller.signal.aborted) { setUsers([]); setError(errorText(e)); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [role, status, search, reload]);
  useEffect(() => () => { detailGeneration.current += 1; }, []);
  const openDetail = async (id: string) => {
    const generation = ++detailGeneration.current;
    setDetailLoading(true); setSelected(null); setError(''); setAction(''); setReason('');
    try {
      const { data } = await apiClient.get('/accounts/profiles/' + id + '/');
      if (generation === detailGeneration.current) {
        setSelected(data);
        setContact({ full_name: data.full_name || '', phone: data.phone || '', email: data.email || '', address: data.address || '' });
      }
    } catch (e) { if (generation === detailGeneration.current) setError(errorText(e)); }
    finally { if (generation === detailGeneration.current) setDetailLoading(false); }
  };
  const close = () => { if (busy) return; detailGeneration.current++; setSelected(null); setDetailLoading(false); setAction(''); };
  const submit = async () => {
    if (!selected || busy || !action) return;
    if (['ban', 'reject'].includes(action) && !reason.trim()) { setError('Vui lòng nhập lý do.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await apiClient.post('/accounts/profiles/' + selected.id + '/' + action + '/', { reason: reason.trim() });
      setNotice(data.message); setReload(v => v + 1);
      await openDetail(selected.id);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const pages = Math.max(1, Math.ceil(users.length / 10));
  const saveContact = async () => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      await apiClient.put('/accounts/profiles/' + selected.id + '/', contact);
      setNotice('Đã cập nhật thông tin liên hệ.'); setReload(v => v + 1);
      await openDetail(selected.id);
    } catch (e: any) {
      const data = e?.response?.data;
      const first = data && Object.values(data)[0];
      setError(data?.error || (Array.isArray(first) ? first.join(' ') : errorText(e)));
    } finally { setBusy(false); }
  };
  const visible = users.slice((page - 1) * 10, page * 10);
  const child = selected?.rescuer_profile || selected?.citizen_profile || {};
  const detailFields: [string, any][] = selected ? [
    ['Họ tên', selected.full_name], ['Vai trò', roles[selected.role]], ['Trạng thái', states[selected.account_status]],
    ['Số điện thoại', selected.phone], ['Email', selected.email], ['Địa chỉ', selected.address],
    ['CCCD', child.id_number], ['Đơn vị', child.unit_name], ['Số hiệu đội (tự khai)', child.team_code],
    ['Cấp bậc', child.rank], ['Chuyên môn', child.specialty_display],
    ['Bệnh nền / dị ứng', child.medical_notes], ['Liên hệ khẩn cấp', child.emergency_contact_name],
    ['SĐT khẩn cấp', child.emergency_contact_phone], ['Lý do xử lý gần nhất', selected.account_reason]
  ] : [];
  return <div className="flex h-screen bg-slate-50">
    {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <div className={'fixed lg:relative z-30 h-full ' + (sidebarOpen ? '' : '-translate-x-full lg:translate-x-0')}><SliderBar /></div>
    <main className="flex-1 min-w-0 overflow-auto"><Header onOpenSidebar={setSidebarOpen} />
      <div className="p-4 md:p-8 space-y-5">
        <h1 className="text-2xl font-bold">Quản lý tài khoản</h1>
        <p className="text-slate-600">Xem hồ sơ trước khi duyệt; nhập lý do khi từ chối hoặc khóa tài khoản.</p>
        <div className="flex flex-wrap gap-3">
          <input aria-label="Tìm tài khoản" className={fieldClass} placeholder="Tên, số điện thoại, email" value={search} onChange={e => setSearch(e.target.value)} />
          <select aria-label="Vai trò" className={fieldClass} value={role} onChange={e => setRole(e.target.value)}><option value="">Tất cả vai trò</option>{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select aria-label="Trạng thái" className={fieldClass} value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(states).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className={fieldClass} onClick={() => setReload(v => v + 1)}>Tải lại</button>
        </div>
        {notice && <p role="status" className="p-3 bg-green-50 text-green-800">{notice}</p>}
        {error && <p role="alert" className="p-3 bg-red-50 text-red-700">{error}</p>}
        {loading ? <p role="status">Đang tải tài khoản…</p> : <>
          <div className="flex flex-wrap gap-3 text-sm"><strong>{users.length} tài khoản phù hợp</strong>{Object.entries(states).map(([k, v]) => <span key={k}>{v}: {users.filter(u => u.account_status === k).length}</span>)}</div>
          <div className="overflow-x-auto bg-white border rounded-xl"><table className="w-full text-sm text-left">
            <thead className="bg-slate-100"><tr>{['Họ tên', 'Vai trò', 'Liên hệ', 'Trạng thái', 'Hồ sơ'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{visible.map(u => <tr key={u.id} className="border-t hover:bg-slate-50">
              <td className="p-3"><button className="text-blue-700 underline" onClick={() => openDetail(u.id)}>{u.full_name || 'Chưa có tên'}</button></td>
              <td className="p-3">{roles[u.role] || u.role}</td><td className="p-3">{u.phone}<br />{u.email || 'Chưa có email'}</td>
              <td className="p-3">{states[u.account_status] || u.account_status}</td>
              <td className="p-3"><button className={fieldClass} onClick={() => openDetail(u.id)}>Xem chi tiết</button></td>
            </tr>)}</tbody>
          </table>{!users.length && <p className="p-6 text-slate-500">Không có tài khoản phù hợp.</p>}</div>
          <div className="flex gap-4 items-center"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Trước</button><span>Trang {page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Sau →</button></div>
        </>}
      </div>
    </main>
    {(selected || detailLoading) && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={close}>
      <section role="dialog" aria-modal="true" aria-labelledby="account-detail-title" className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h2 id="account-detail-title" className="text-xl font-bold">Chi tiết tài khoản</h2><button disabled={busy} onClick={close}>Đóng ✕</button></div>
        {detailLoading ? <p>Đang tải hồ sơ…</p> : <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">{detailFields.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-slate-500 text-sm">{k}</dt><dd className="whitespace-pre-wrap break-words">{String(v)}</dd></div>)}</dl>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {selected.role !== 'ADMIN' && <details className="border-t pt-3"><summary className="cursor-pointer font-semibold">Sửa thông tin liên hệ</summary>
            <p className="text-sm text-slate-600 my-2">Khi hỗ trợ khôi phục, cần xác minh đúng chủ tài khoản trước khi thay email nhận mã.</p>
            {Object.entries({ full_name: 'Họ tên', phone: 'Số điện thoại', email: 'Email', address: 'Địa chỉ' }).map(([key, label]) => <label key={key} className="block my-2">{label}<input className={fieldClass + ' block w-full'} value={contact[key as keyof typeof contact]} disabled={busy} onChange={e => setContact(v => ({ ...v, [key]: e.target.value }))} /></label>)}
            <button disabled={busy} className={fieldClass} onClick={saveContact}>Lưu thông tin liên hệ</button>
          </details>}
          {selected.role !== 'ADMIN' && <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap gap-3">
              {selected.account_status !== 'ACTIVE' && <button disabled={busy} className={fieldClass} onClick={() => { setAction('activate'); setReason(''); }}>{selected.account_status === 'BANNED' ? 'Mở khóa' : 'Duyệt hồ sơ'}</button>}
              {selected.account_status === 'PENDING' && <button disabled={busy} className={fieldClass} onClick={() => { setAction('reject'); setReason(''); }}>Từ chối</button>}
              {selected.account_status === 'ACTIVE' && <button disabled={busy} className={fieldClass} onClick={() => { setAction('ban'); setReason(''); }}>Khóa tài khoản</button>}
            </div>
            {action && <div className="space-y-3"><p>{action === 'activate' ? 'Xác nhận cho phép tài khoản đăng nhập?' : action === 'ban' ? 'Khóa tài khoản sẽ kết thúc các phiên đăng nhập hiện tại.' : 'Xác nhận từ chối hồ sơ đăng ký?'}</p>
              <textarea aria-label="Lý do xử lý" maxLength={2000} className={fieldClass + ' w-full'} placeholder={action === 'activate' ? 'Ghi chú (không bắt buộc)' : 'Lý do bắt buộc'} value={reason} onChange={e => setReason(e.target.value)} />
              <button disabled={busy} className="bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50" onClick={submit}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button>
            </div>}
          </div>}
          <div className="border-t pt-4"><h3 className="font-bold">Lịch sử xử lý</h3>{selected.history?.length ? selected.history.map((h: any, i: number) => <p key={i} className="py-2 text-sm">{new Date(h.created_at).toLocaleString('vi-VN')} · {h.actor__full_name || 'Quản trị viên'} · {({ activate: 'Duyệt / mở khóa', ban: 'Khóa', reject: 'Từ chối', normalize_profile: 'Chuẩn hóa hồ sơ' } as Record<string, string>)[h.action]}{h.reason ? ' — ' + h.reason : ''}</p>) : <p className="text-slate-500">Chưa có lịch sử xử lý được ghi nhận.</p>}</div>
        </>}
      </section>
    </div>}
  </div>;
}
