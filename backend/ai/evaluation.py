"""
ai/evaluation.py
================
Đo chất lượng luồng NLP trên một tập test và so với các phương pháp đơn giản hơn.

Trả lời ba câu hỏi cho báo cáo:
  1. Model làm đúng bao nhiêu trên tập test này?            (bảng điểm)
  2. PhoBERT có hơn luật từ khóa / học máy cổ điển không?    (bảng so sánh)
  3. Model hay bộ luật guardrails đang ra quyết định?        (thống kê can thiệp)

Điểm chỉ có nghĩa với đúng tập test đã dùng. Báo cáo luôn ghi nguồn gốc dữ liệu
(tổng hợp hay thực) để không trình bày nhầm điểm trên dữ liệu tổng hợp thành
độ chính xác thực tế.

Dùng qua lệnh:  python manage.py ai_evaluate
"""

import re
import unicodedata
from collections import Counter

from openpyxl import load_workbook

from .sos_ml.data import NEEDS, ENTITIES
from .sos_ml.excel_data import excel_bool, parse_marked_text
from .sos_ml.hybrid_guardrails import check_emergency, is_asking_help, refine_entities
from .sos_ml.text_normalizer import clean_text_for_pipeline

# ─── Đọc dữ liệu ─────────────────────────────────────────────────────────────

def read_rows(path, sheet: str, task: str) -> list:
    """
    Đọc một sheet theo định dạng Excel của notebook huấn luyện.
      task 'a': cột text, is_request, needs (ngăn cách bằng ;)
      task 'b': cột text_annotated với nhãn dạng [LOCATION|xã A]
    Khác `load_excel_data`: đọc một sheet bất kỳ và không yêu cầu đủ ba tập.
    """
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        if sheet not in workbook.sheetnames:
            raise ValueError(f'{path}: không có sheet {sheet!r}. Các sheet: {workbook.sheetnames}')
        iterator = workbook[sheet].iter_rows(values_only=True)
        headers = [str(h).strip() if h is not None else '' for h in next(iterator, ())]
        required = ['text', 'is_request'] if task == 'a' else ['text_annotated']
        missing = [c for c in required if c not in headers]
        if missing:
            raise ValueError(f'{path} [{sheet}]: thiếu cột {missing}')
        rows = []
        for number, values in enumerate(iterator, 2):
            if all(v is None or v == '' for v in values):
                continue
            cells = dict(zip(headers, values))
            try:
                if task == 'a':
                    text, entities = unicodedata.normalize('NFC', str(cells['text'])), []
                    is_request = excel_bool(cells['is_request'])
                    needs = [v.strip() for v in str(cells.get('needs') or '').split(';') if v.strip()]
                    if set(needs) - set(NEEDS):
                        raise ValueError(f'needs không hợp lệ: {needs}')
                    if not is_request:
                        needs = []
                else:
                    text, entities = parse_marked_text(cells['text_annotated'])
                    is_request, needs = bool(entities), []
            except (ValueError, TypeError) as exc:
                raise ValueError(f'{path} [{sheet}], dòng {number}: {exc}') from exc
            rows.append({'id': str(cells.get('id') or f'{sheet}-{number}'), 'text': text,
                         'is_request': is_request, 'needs': needs, 'entities': entities,
                         'origin': str(cells.get('origin') or 'unknown').strip()})
        return rows
    finally:
        workbook.close()


# ─── Các phương pháp so sánh cho bài toán A ──────────────────────────────────

RULE_NEED_KEYWORDS = {
    'RESCUE':     ['cứu', 'mắc kẹt', 'kẹt', 'thuyền', 'ca nô', 'xuồng', 'cô lập', 'chìm', 'ngập sâu', 'cuốn trôi'],
    'MEDICAL':    ['y tế', 'bác sĩ', 'thuốc', 'cấp cứu', 'bị thương', 'khó thở', 'sốt', 'bệnh', 'chuyển dạ', 'băng gạc'],
    'EVACUATION': ['sơ tán', 'di dời', 'di tản', 'đưa ra khỏi', 'nơi an toàn', 'chỗ trú'],
    'SUPPLY':     ['nước uống', 'nước sạch', 'lương thực', 'thực phẩm', 'mì tôm', 'mì gói', 'gạo', 'nhu yếu phẩm',
                   'áo phao', 'chăn', 'tiếp tế', 'sữa', 'đồ ăn'],
}


def rule_predict(text: str):
    """Baseline luật: câu có ngỏ lời nhờ giúp / dấu hiệu nguy cấp → yêu cầu; nhu cầu theo từ khóa."""
    cleaned = clean_text_for_pipeline(text)
    is_request = check_emergency(cleaned)[0] or is_asking_help(cleaned)
    lowered = cleaned.lower()
    needs = [n for n, words in RULE_NEED_KEYWORDS.items() if any(w in lowered for w in words)]
    return is_request, (needs if is_request else [])


class TfidfBaseline:
    """Học máy cổ điển: TF-IDF (từ + ký tự) → Logistic Regression cho từng nhãn."""

    def fit(self, rows):
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import FeatureUnion

        self.features = FeatureUnion([
            ('word', TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
            ('char', TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 5), sublinear_tf=True, min_df=1)),
        ])
        x = self.features.fit_transform([clean_text_for_pipeline(r['text']).lower() for r in rows])
        self.models = {}
        for name, labels in [('request', [r['is_request'] for r in rows])] + [
                (need, [need in r['needs'] for r in rows]) for need in NEEDS]:
            if len(set(labels)) < 2:   # Không đủ hai lớp để học nhãn này
                self.models[name] = None
                continue
            self.models[name] = LogisticRegression(max_iter=2000, class_weight='balanced').fit(x, labels)
        return self

    def predict(self, text: str):
        x = self.features.transform([clean_text_for_pipeline(text).lower()])

        def yes(name):
            model = self.models[name]
            return bool(model.predict(x)[0]) if model is not None else False

        is_request = yes('request')
        return is_request, ([n for n in NEEDS if yes(n)] if is_request else [])


V1_LABEL_NEEDS = {'RESCUE': ['RESCUE'], 'MEDICAL': ['MEDICAL'], 'EVACUATION': ['EVACUATION'], 'SUPPLY': ['SUPPLY']}


def phobert_v1_predict(text: str):
    """PhoBERT v1 (6 nhãn, mỗi câu một nhãn) quy về cùng đầu ra: INFO/SPAM → không phải yêu cầu."""
    from .nlp.phobert_analyzer import classify
    result = classify(text)
    if result is None:
        raise RuntimeError('PhoBERT v1 chưa sẵn sàng')
    needs = V1_LABEL_NEEDS.get(result.label, [])
    return bool(needs), needs


# ─── Chấm điểm ───────────────────────────────────────────────────────────────

def _prf(tp, predicted, gold):
    precision = tp / predicted if predicted else 0.0
    recall = tp / gold if gold else 0.0
    f1 = 2 * tp / (predicted + gold) if predicted + gold else 0.0
    return {'precision': round(precision, 4), 'recall': round(recall, 4), 'f1': round(f1, 4)}


def score_a(rows, predictions) -> dict:
    """predictions: list (is_request, needs) cùng thứ tự với rows."""
    gold_req = [r['is_request'] for r in rows]
    pred_req = [bool(p[0]) for p in predictions]
    tp = sum(g and p for g, p in zip(gold_req, pred_req))
    request = _prf(tp, sum(pred_req), sum(gold_req))
    request['accuracy'] = round(sum(g == p for g, p in zip(gold_req, pred_req)) / len(rows), 4)

    per_need, totals = {}, [0, 0, 0]
    for need in NEEDS:
        gold = [need in r['needs'] for r in rows]
        pred = [need in p[1] for p in predictions]
        counts = [sum(g and p for g, p in zip(gold, pred)), sum(pred), sum(gold)]
        per_need[need] = _prf(*counts)
        totals = [a + b for a, b in zip(totals, counts)]
    return {'request': request, 'needs': per_need,
            'needs_macro_f1': round(sum(v['f1'] for v in per_need.values()) / len(NEEDS), 4),
            'needs_micro_f1': _prf(*totals)['f1']}


def _entity_key(label, text):
    """So khớp theo (nhãn, nội dung cụm) sau cùng bước chuẩn hóa mà model dùng."""
    return label, re.sub(r'\s+', ' ', clean_text_for_pipeline(text)).casefold().strip()


def score_b(rows, predictions) -> dict:
    """predictions: list các danh sách entity {'label', 'text'} cùng thứ tự với rows."""
    counts = {kind: [0, 0, 0] for kind in ENTITIES}
    for row, predicted in zip(rows, predictions):
        gold = Counter(_entity_key(e['label'], e['text']) for e in row['entities'])
        pred = Counter(_entity_key(e['label'], e['text']) for e in predicted)
        for kind in ENTITIES:
            g = Counter({k: v for k, v in gold.items() if k[0] == kind})
            p = Counter({k: v for k, v in pred.items() if k[0] == kind})
            for i, value in enumerate([sum((g & p).values()), sum(p.values()), sum(g.values())]):
                counts[kind][i] += value
    result = {kind: dict(_prf(*values), gold_count=values[2]) for kind, values in counts.items()}
    result['micro'] = _prf(*[sum(v[i] for v in counts.values()) for i in range(3)])
    return result


# ─── Đánh giá bài toán A (nhận diện yêu cầu + nhu cầu) ───────────────────────

def evaluate_a(test_rows, train_rows, predictor=None, with_v1=False, progress=None) -> dict:
    report = {'task': 'a', 'rows': len(test_rows), 'methods': {}, 'notes': []}

    report['methods']['Luật từ khóa'] = score_a(test_rows, [rule_predict(r['text']) for r in test_rows])

    if train_rows:
        test_texts = {clean_text_for_pipeline(r['text']).casefold() for r in test_rows}
        train = [r for r in train_rows if clean_text_for_pipeline(r['text']).casefold() not in test_texts]
        if len(train) != len(train_rows):
            report['notes'].append(f'Đã bỏ {len(train_rows) - len(train)} câu train trùng nội dung với tập test.')
        baseline = TfidfBaseline().fit(train)
        report['methods']['TF-IDF + Logistic Regression'] = score_a(
            test_rows, [baseline.predict(r['text']) for r in test_rows])
        report['tfidf_train_rows'] = len(train)

    if with_v1:
        try:
            report['methods']['PhoBERT v1 (6 nhãn, model cũ)'] = score_a(
                test_rows, [phobert_v1_predict(r['text']) for r in test_rows])
        except Exception as exc:
            report['notes'].append(f'Không chạy được PhoBERT v1: {exc}')

    if predictor is None:
        report['notes'].append('Không nạp được Model A nên thiếu các dòng PhoBERT.')
        return report

    raw, final, records, errors = [], [], [], 0
    for index, row in enumerate(test_rows):
        try:
            out = predictor.predict(row['text'], mode='a')
        except ValueError:
            errors += 1
            out = {'raw_model_is_request': False, 'is_request': False, 'needs': [], 'candidate_needs': [],
                   'decision_source': 'ERROR'}
        raw_request = bool(out.get('raw_model_is_request'))
        raw.append((raw_request, list(out.get('candidate_needs') or []) if raw_request else []))
        final.append((bool(out.get('is_request')), list(out.get('needs') or [])))
        records.append({'id': row['id'], 'gold': row['is_request'], 'raw': raw_request,
                        'final': bool(out.get('is_request')), 'source': out.get('decision_source', 'MODEL'),
                        'guardrail': out.get('guardrail_applied')})
        if progress:
            progress(index + 1, len(test_rows))

    report['methods']['PhoBERT Model A (chỉ model)'] = score_a(test_rows, raw)
    report['methods']['PhoBERT Model A + guardrails (đang dùng)'] = score_a(test_rows, final)
    report['guardrails'] = guardrail_stats(records)
    report['model_versions'] = [predictor.metadata['a']['run_id']]
    if errors:
        report['notes'].append(f'{errors} câu không phân tích được (quá dài hoặc ký tự lạ), tính là dự đoán "không".')
    return report


def guardrail_stats(records) -> dict:
    """Bao nhiêu quyết định là của model, bao nhiêu do luật; luật sửa đúng hay sửa sai."""
    total = len(records)
    by_source = Counter(r['source'] for r in records)
    changed = [r for r in records if r['raw'] != r['final']]
    fixed = sum(r['final'] == r['gold'] for r in changed)       # model sai → luật sửa thành đúng
    return {
        'total': total,
        'by_source': dict(by_source),
        'model_decided': by_source.get('MODEL', 0),
        'rule_intervened': total - by_source.get('MODEL', 0) - by_source.get('ERROR', 0),
        'label_changed': len(changed),
        'changed_to_correct': fixed,
        'changed_to_wrong': len(changed) - fixed,
        'changed_by_rule': dict(Counter(r['guardrail'] or r['source'] for r in changed)),
    }


# ─── Đánh giá bài toán B (trích xuất thông tin) ──────────────────────────────

def evaluate_b(test_rows, predictor=None, progress=None) -> dict:
    report = {'task': 'b', 'rows': len(test_rows), 'methods': {}, 'notes': [
        'So khớp theo nhãn + nội dung cụm từ (sau chuẩn hóa), không so vị trí ký tự.']}

    rule_only = [refine_entities(clean_text_for_pipeline(r['text']), []) for r in test_rows]
    report['methods']['Chỉ luật regex'] = score_b(test_rows, rule_only)

    if predictor is None:
        report['notes'].append('Không nạp được Model B nên thiếu các dòng PhoBERT.')
        return report

    raw, final, errors = [], [], 0
    for index, row in enumerate(test_rows):
        try:
            out = predictor.predict(row['text'], mode='b')
        except ValueError:
            errors += 1
            out = {}
        raw.append(out.get('raw_model_entities', []))
        final.append(out.get('entities', []))
        if progress:
            progress(index + 1, len(test_rows))

    report['methods']['PhoBERT Model B (chỉ model)'] = score_b(test_rows, raw)
    report['methods']['PhoBERT Model B + luật (đang dùng)'] = score_b(test_rows, final)
    report['model_versions'] = [predictor.metadata['b']['run_id']]
    if errors:
        report['notes'].append(f'{errors} câu không phân tích được, tính là không trích xuất được gì.')
    return report


# ─── Xuất báo cáo Markdown ───────────────────────────────────────────────────

def origin_summary(rows) -> str:
    counts = Counter(r['origin'] for r in rows)
    names = {'synthetic': 'tổng hợp', 'real': 'thực', 'translated': 'dịch', 'unknown': 'không rõ'}
    return ', '.join(f'{n} câu {names.get(o, o)}' for o, n in counts.most_common())


def to_markdown(report: dict, source: str, rows) -> str:
    lines = []
    title = 'Bài toán A: nhận diện yêu cầu cứu trợ và nhu cầu' if report['task'] == 'a' \
        else 'Bài toán B: trích xuất thông tin'
    lines += [f'## {title}', '', f'- Tập test: `{source}` ({report["rows"]} câu: {origin_summary(rows)})']
    if report.get('model_versions'):
        lines.append(f'- Phiên bản model: {", ".join(report["model_versions"])}')
    if report.get('tfidf_train_rows'):
        lines.append(f'- TF-IDF + LR huấn luyện trên {report["tfidf_train_rows"]} câu train.')
    if all(r['origin'] == 'synthetic' for r in rows):
        lines.append('- **Lưu ý: toàn bộ tập test là câu tổng hợp theo mẫu. Điểm dưới đây KHÔNG phải '
                     'độ chính xác trên tin thực.**')
    lines += [f'- {note}' for note in report['notes']] + ['']

    if report['task'] == 'a':
        lines += ['| Phương pháp | Yêu cầu: P | Yêu cầu: R | Yêu cầu: F1 | Accuracy | Nhu cầu: macro-F1 | Nhu cầu: micro-F1 |',
                  '|---|---:|---:|---:|---:|---:|---:|']
        for name, m in report['methods'].items():
            r = m['request']
            lines.append(f'| {name} | {r["precision"]:.3f} | {r["recall"]:.3f} | {r["f1"]:.3f} | '
                         f'{r["accuracy"]:.3f} | {m["needs_macro_f1"]:.3f} | {m["needs_micro_f1"]:.3f} |')
        lines += ['', 'F1 theo từng nhu cầu:', '', '| Phương pháp | ' + ' | '.join(NEEDS) + ' |',
                  '|---|' + '---:|' * len(NEEDS)]
        for name, m in report['methods'].items():
            lines.append(f'| {name} | ' + ' | '.join(f'{m["needs"][n]["f1"]:.3f}' for n in NEEDS) + ' |')
        g = report.get('guardrails')
        if g:
            def pct(n):
                return f'{n} ({n / g["total"]:.1%})' if g['total'] else '0'
            lines += ['', '### Model hay luật ra quyết định?', '', '| Chỉ số | Số câu |', '|---|---:|',
                      f'| Model tự quyết, luật không can thiệp | {pct(g["model_decided"])} |',
                      f'| Luật có can thiệp | {pct(g["rule_intervened"])} |',
                      f'| Luật làm đổi kết luận "có phải yêu cầu" | {pct(g["label_changed"])} |',
                      f'| … trong đó sửa thành ĐÚNG | {g["changed_to_correct"]} |',
                      f'| … trong đó sửa thành SAI | {g["changed_to_wrong"]} |']
            if g['changed_by_rule']:
                lines += ['', 'Số lần đổi kết luận theo từng luật: ' +
                          ', '.join(f'`{k}`: {v}' for k, v in g['changed_by_rule'].items())]
    else:
        lines += ['| Phương pháp | P | R | F1 | ' + ' | '.join(f'{k} F1' for k in ENTITIES) + ' |',
                  '|---|---:|---:|---:|' + '---:|' * len(ENTITIES)]
        for name, m in report['methods'].items():
            lines.append(f'| {name} | {m["micro"]["precision"]:.3f} | {m["micro"]["recall"]:.3f} | '
                         f'{m["micro"]["f1"]:.3f} | ' + ' | '.join(f'{m[k]["f1"]:.3f}' for k in ENTITIES) + ' |')
    return '\n'.join(lines) + '\n'
