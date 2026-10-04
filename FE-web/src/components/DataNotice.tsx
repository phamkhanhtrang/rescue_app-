import { useEffect, useState } from 'react';

export default function DataNotice({ loading, error, onRetry, hasData = false }: {
  loading: boolean;
  error: string;
  onRetry: () => void;
  hasData?: boolean;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const timer = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(timer);
  }, [loading]);
  if (!loading && !error) return null;
  return <div role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-100 bg-blue-50 text-blue-900'}`}>
    <span>{error || (slow ? 'Máy chủ phản hồi chậm. Đang tiếp tục tải dữ liệu…' : hasData ? 'Đang cập nhật dữ liệu…' : 'Đang tải dữ liệu…')}</span>
    {error && <button type="button" onClick={onRetry} className="ml-3 font-semibold underline">Thử lại</button>}
    {error && hasData && <span className="ml-2 text-slate-600">Đang hiển thị dữ liệu lần tải trước.</span>}
  </div>;
}
