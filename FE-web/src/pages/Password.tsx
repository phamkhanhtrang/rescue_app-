import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Shield, KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient, API_BASE_URL, clearSession } from '../services/api';

export default function Password() {
  const [params] = useSearchParams();
  const reset = params.get('mode') !== 'change';
  const navigate = useNavigate();
  const [email, setEmail] = useState(reset ? '' : localStorage.getItem('user_email') || '');
  const [current, setCurrent] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [sentAt, setSentAt] = useState(0);

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (e: any) {
      const data = e.response?.data;
      const first = data && Object.values(data)[0];
      setError(data?.error || data?.detail || (Array.isArray(first) ? first.join(' ') : typeof first === 'string' ? first : e.message) || 'Không thể xử lý.');
    } finally { setBusy(false); }
  };

  const send = () => run(async () => {
    if (Date.now() - sentAt < 60000) throw new Error('Vui lòng chờ 60 giây trước khi gửi lại.');
    const { data } = await axios.post(API_BASE_URL + '/accounts/password/reset/', { email: email.trim() }, { timeout: 15000 });
    setSentAt(Date.now()); setMessage(data.message);
  });

  const saveEmail = () => run(async () => {
    const { data: user } = await apiClient.get('/accounts/me/');
    const { data } = await apiClient.put('/accounts/profiles/' + user.id + '/', { email: email.trim(), current_password: current });
    localStorage.setItem('user_email', data.email || ''); setCurrent(''); setMessage('Đã lưu email khôi phục.');
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự.');
      if (password !== confirm) throw new Error('Mật khẩu xác nhận không khớp.');
      const { data } = reset
        ? await axios.post(API_BASE_URL + '/accounts/password/reset/confirm/', { code: code.trim(), new_password: password }, { timeout: 15000 })
        : await apiClient.post('/accounts/password/change/', { current_password: current, new_password: password });
      setMessage(data.message); setDone(true); setPassword(''); setConfirm(''); setCurrent(''); setCode('');
      if (!reset) clearSession();
    });
  };

  return (
    <main className="min-h-screen bg-page flex items-center justify-center p-4 sm:p-6">
      <section className="card max-w-lg w-full space-y-5 shadow-md">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-btn bg-brand/10 text-brand flex items-center justify-center">
            {reset ? <KeyRound size={20} /> : <Shield size={20} />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {reset ? 'Khôi phục mật khẩu' : 'Email & Mật khẩu'}
            </h1>
            <p className="text-xs text-slate-500">
              {reset ? 'Trung tâm điều phối cứu nạn khẩn cấp' : 'Cập nhật bảo mật tài khoản quản trị'}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {reset
            ? 'Nhập email đã đăng ký trong hồ sơ, sau đó dán toàn bộ mã nhận được qua email (hết hạn sau 15 phút). Nếu chưa có email, liên hệ quản trị viên để xác minh.'
            : 'Đổi mật khẩu sẽ tự động đăng xuất phiên làm việc hiện tại trên tất cả thiết bị để bảo vệ tài khoản.'}
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-btn bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="flex items-center gap-2 p-3 rounded-btn bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {done ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-800">Cập nhật mật khẩu thành công!</p>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary inline-flex items-center gap-2"
            >
              Đăng nhập lại
            </button>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email khôi phục
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full"
                placeholder="admin@cuuho.vn"
                disabled={busy}
              />
            </div>

            {!reset && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="input-field w-full"
                  disabled={busy}
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={reset ? send : saveEmail}
                className="btn-secondary text-xs !py-1.5"
              >
                {reset ? 'Gửi mã khôi phục qua email' : 'Lưu email'}
              </button>
            </div>

            {reset && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã khôi phục (dán toàn bộ mã)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="input-field w-full font-mono text-xs"
                  placeholder="Dán mã bảo mật tại đây"
                  disabled={busy}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full"
                  placeholder="Tối thiểu 8 ký tự"
                  disabled={busy}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-field w-full"
                  placeholder="Nhập lại mật khẩu"
                  disabled={busy}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 mt-2"
            >
              {busy ? 'Đang xử lý…' : reset ? 'Đặt lại mật khẩu' : 'Đổi mật khẩu'}
            </button>
          </form>
        )}

        {!done && (
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            <button
              disabled={busy}
              onClick={() => navigate(reset ? '/login' : '/account')}
              className="btn-ghost flex items-center gap-1.5 text-xs"
            >
              <ArrowLeft size={14} />
              Quay lại
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
