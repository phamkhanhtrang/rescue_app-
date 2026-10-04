export const NEED_NAMES: Record<string, string> = {
  RESCUE: 'Cứu hộ', MEDICAL: 'Y tế', EVACUATION: 'Sơ tán', SUPPLY: 'Tiếp tế',
};
const ENTITY_NAMES: Record<string, string> = {
  LOCATION: 'Địa điểm', PEOPLE_COUNT: 'Số người', VULNERABLE_GROUP: 'Nhóm dễ tổn thương', RESOURCE: 'Vật tư cần',
};

export default function ModelResults({ result }: { result: any }) {
  if (!result) return null;
  if (result.error) return <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">{result.error}</p>;
  return <div className="space-y-4 text-sm" aria-live="polite">
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      {result.elapsed_ms != null && <span>Thời gian: {(result.elapsed_ms / 1000).toFixed(2)} giây (gồm nạp model lần đầu)</span>}
      {result.chunks?.length > 1 && <span>Bài được phân tích thành {result.chunks.length} đoạn, giữ toàn bộ nội dung.</span>}
    </div>
    {typeof result.is_request === 'boolean' && <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
      <h3 className="font-semibold">Model A · Nhận diện yêu cầu và nhu cầu</h3>
      <p>{result.is_request ? 'Có yêu cầu hỗ trợ' : 'Không nhận diện yêu cầu hỗ trợ'} · Điểm mô hình: {(result.request_score * 100).toFixed(1)}%</p>
      <p>Nhu cầu: {result.needs?.length ? result.needs.map((n: string) => NEED_NAMES[n] || n).join(', ') : 'Chưa xác định'}</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(result.need_scores || {}).map(([name, score]) => <div key={name} className="rounded border bg-white p-2">
          {NEED_NAMES[name] || name}: {(Number(score) * 100).toFixed(1)}%
        </div>)}
      </div>
      <p className="text-xs text-slate-500">Các điểm trên là điểm dự đoán, không phải độ chính xác đã kiểm chứng.</p>
    </section>}
    {Array.isArray(result.entities) && <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
      <h3 className="font-semibold">Model B · Thông tin trích xuất</h3>
      {!result.entities.length ? <p>Không trích xuất được thông tin thuộc bốn loại nhãn.</p> : <div className="overflow-x-auto">
        <table className="w-full text-left"><thead><tr><th className="py-2">Loại thông tin</th><th>Cụm từ</th><th>Vị trí ký tự</th></tr></thead>
          <tbody>{result.entities.map((e: any, i: number) => <tr key={`${e.start}-${i}`} className="border-t border-violet-100">
            <td className="py-2 pr-3">{ENTITY_NAMES[e.label] || e.label}</td><td className="pr-3 font-medium">{e.text}</td><td>{e.start}–{e.end}</td>
          </tr>)}</tbody></table>
      </div>}
      <p className="text-xs text-slate-500">Vị trí tính từ 0 trong văn bản đã chuẩn hóa; ký tự kết thúc không nằm trong cụm.</p>
    </section>}
    {result.evaluation_domains?.includes('synthetic') && <p className="text-xs text-amber-800">Model hiện được đánh giá trên dữ liệu tổng hợp. Cần kiểm tra kết quả trước khi sử dụng.</p>}
    <details className="text-xs text-slate-500"><summary className="cursor-pointer">Phiên bản và kết quả đầy đủ</summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</pre>
    </details>
  </div>;
}
