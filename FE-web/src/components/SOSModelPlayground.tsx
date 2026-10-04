import { useState } from 'react';
import { api } from '../services/api';
import ModelResults from './ModelResults';

export default function SOSModelPlayground() {
  const [mode, setMode] = useState<'a' | 'b' | 'both'>('both');
  const [text, setText] = useState('Nhờ cứu 5 người tại xã An Bình, có 2 trẻ em, đang cần nước uống.');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy || !text.trim()) return;
    setBusy(true); setResult(null);
    try { const response = await api.ai.analyzeSOS(text, mode); setResult(response.data); }
    catch (e: any) { setResult({ error: e.response?.data?.error || 'Không kết nối được API. Kiểm tra backend rồi thử lại.' }); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
    <div><h2 className="font-bold text-lg">Thử hai model SOS</h2><p className="text-sm text-slate-500">Chỉ dự đoán để kiểm tra. Thao tác này không tạo bài viết hoặc SOS.</p></div>
    <label className="block text-sm font-medium">Chọn model
      <select aria-label="Chọn model" value={mode} disabled={busy} onChange={e => { setMode(e.target.value as typeof mode); setResult(null); }} className="ml-3 rounded-lg border px-3 py-2">
        <option value="both">Cả A và B</option><option value="a">Model A · Yêu cầu và nhu cầu</option><option value="b">Model B · Trích xuất thông tin</option>
      </select>
    </label>
    <label className="block text-sm">Nội dung tiếng Việt
      <textarea aria-label="Nội dung thử model" value={text} disabled={busy} maxLength={4000} onChange={e => { setText(e.target.value); setResult(null); }} rows={4}
        className="mt-2 w-full rounded-lg border p-3 focus:outline-blue-500" />
    </label>
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <span className="text-xs text-slate-500">{text.length}/4.000 ký tự · Câu thử tối đa 256 token; ô lỗi sẽ báo nếu quá dài.</span>
      <button type="button" disabled={busy || !text.trim()} onClick={run} className="rounded-lg bg-blue-700 px-5 py-2 text-white disabled:opacity-50">
        {busy ? 'Đang chạy model…' : 'Chạy thử'}
      </button>
    </div>
    {busy && <p role="status" className="text-sm text-blue-700">Lần đầu có thể chậm do nạp trọng số. Vui lòng chờ.</p>}
    <ModelResults result={result} />
  </section>;
}
