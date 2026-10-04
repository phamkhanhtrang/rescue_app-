import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
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
  const input = (label: string, value: string, setter: (s: string) => void, type = 'text') => <label className="block space-y-1">{label}<input type={type} value={value} onChange={e => setter(e.target.value)} className="block border rounded-lg p-3 w-full" disabled={busy} autoComplete={type === 'password' ? 'new-password' : 'off'} /></label>;
  return <main className="min-h-screen bg-slate-50 p-6 flex justify-center items-start">
    <section className="bg-white rounded-xl shadow p-6 max-w-lg w-full space-y-4">
      <h1 className="text-2xl font-bold">{reset ? 'Khôi phục mật khẩu' : 'Email & mật khẩu'}</h1>
      <p>{reset ? 'Nhập email đã lưu trong hồ sơ, sau đó dán toàn bộ mã nhận được. Mã hết hạn sau 15 phút. Nếu chưa có email, cần liên hệ quản trị viên để xác minh và bổ sung.' : 'Đổi mật khẩu sẽ kết thúc phiên đăng nhập trên các thiết bị.'}</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {message && <p role="status" className="text-green-700">{message}</p>}
      {done ? <button onClick={() => navigate('/login')} className="text-blue-700 underline">Về đăng nhập</button> : <form onSubmit={save} className="space-y-4">
        {input('Email khôi phục', email, setEmail, 'email')}
        {!reset && input('Mật khẩu hiện tại', current, setCurrent, 'password')}
        <button type="button" disabled={busy} onClick={reset ? send : saveEmail} className="border rounded-lg p-2">{reset ? 'Gửi mã khôi phục' : 'Lưu email'}</button>
        {reset && input('Mã khôi phục (dán toàn bộ mã)', code, setCode)}
        {input('Mật khẩu mới (ít nhất 8 ký tự)', password, setPassword, 'password')}
        {input('Nhập lại mật khẩu mới', confirm, setConfirm, 'password')}
        <button disabled={busy} className="bg-blue-700 text-white p-3 rounded-lg w-full">{busy ? 'Đang xử lý…' : reset ? 'Đặt lại mật khẩu' : 'Đổi mật khẩu'}</button>
      </form>}
      {!done && <button disabled={busy} onClick={() => navigate(reset ? '/login' : '/account')} className="text-slate-600">Quay lại</button>}
    </section>
  </main>;
}

