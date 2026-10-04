import { NEED_NAMES } from './ModelResults';
import ModelResults from './ModelResults';

export function reviewDefaults(article: any) {
  const ai = article.ai_analysis || {};
  const existing = article.reviewed_analysis || {};
  const entities = (kind: string) => [...new Set<string>((ai.entities || []).filter((e: any) => e.label === kind).map((e: any) => e.text))].join('; ');
  return { is_request: false, needs: existing.needs || ai.needs || [],
    resources: (existing.resources || []).join('; ') || entities('RESOURCE'),
    vulnerable_groups: (existing.vulnerable_groups || []).join('; ') || entities('VULNERABLE_GROUP'),
    extracted_people_count: article.extracted_people_count ?? '', extracted_lat: article.extracted_lat ?? '', extracted_lng: article.extracted_lng ?? '',
    extracted_address: article.extracted_address || article.extracted_location || '',
    extracted_location: article.extracted_location || '', extracted_phone: article.extracted_phone || '', facebook_author: article.facebook_author || '' };
}

export default function SOSArticleReview({ article, value, onChange, busy, onAnalyze }: {
  article: any; value: any; onChange: (value: any) => void; busy: boolean; onAnalyze: () => void;
}) {
  const editable = ['RAW', 'ANALYZED'].includes(article.status);
  const fields = [['extracted_address', 'Địa chỉ cần hỗ trợ'], ['extracted_location', 'Địa danh'],
    ['extracted_lat', 'Vĩ độ'], ['extracted_lng', 'Kinh độ'], ['extracted_people_count', 'Số người (bắt buộc xác nhận)'],
    ['facebook_author', 'Người liên hệ'], ['extracted_phone', 'Số điện thoại'],
    ['vulnerable_groups', 'Nhóm dễ tổn thương (ngăn cách bằng ;)'], ['resources', 'Vật tư cần (ngăn cách bằng ;)']];
  return <section className="mx-5 my-4 space-y-4 text-sm">
    <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Kết quả hai model và xác nhận của admin</h3>
      {editable && <button type="button" disabled={busy} onClick={onAnalyze} className="border rounded-lg px-3 py-2 text-blue-700 disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Phân tích lại bằng A + B'}</button>}
    </div>
    {Object.keys(article.ai_analysis || {}).length ? <ModelResults result={article.ai_analysis} /> : <p className="text-amber-800">Bài cũ chưa có kết quả hai model. Có thể phân tích lại hoặc nhập thông tin xác nhận.</p>}
    {editable ? <fieldset disabled={busy} className="rounded-xl border p-4 space-y-4 disabled:opacity-60">
      <legend className="font-semibold px-2">Thông tin sẽ dùng để tạo SOS</legend>
      <p className="text-xs text-slate-500">Tọa độ chỉ là gợi ý. Kiểm tra vị trí và số người thực tế trước khi xác nhận. Sửa tại đây không thay đổi bản dự đoán gốc.</p>
      <label className="flex gap-2 font-semibold"><input type="checkbox" checked={value.is_request} onChange={e => onChange({ ...value, is_request: e.target.checked })} />Tôi xác nhận đây là yêu cầu đang cần hỗ trợ</label>
      <div className="flex flex-wrap gap-4">{Object.entries(NEED_NAMES).map(([code, title]) => <label key={code} className="flex gap-2"><input type="checkbox" checked={value.needs.includes(code)} onChange={e => onChange({ ...value, needs: e.target.checked ? [...value.needs, code] : value.needs.filter((n: string) => n !== code) })} />{title}</label>)}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{fields.map(([key, title]) => <label key={key} className="block">{title}
        <input aria-label={title} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" />
      </label>)}</div>
    </fieldset> : article.reviewed_analysis?.reviewed_at && <div className="border rounded-lg p-3">
      <p>Đã xác nhận: {new Date(article.reviewed_analysis.reviewed_at).toLocaleString('vi-VN')}</p>
      <p>Nhu cầu: {(article.reviewed_analysis.needs || []).map((n: string) => NEED_NAMES[n] || n).join(', ') || 'Chưa xác định'}</p>
      <p>Vật tư: {(article.reviewed_analysis.resources || []).join('; ') || 'Không ghi nhận'}</p>
      <p>Nhóm dễ tổn thương: {(article.reviewed_analysis.vulnerable_groups || []).join('; ') || 'Không ghi nhận'}</p>
    </div>}
  </section>;
}
