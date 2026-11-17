"""Evaluation and batching shared by both standalone notebooks."""
import numpy as np
import torch
from sklearn.metrics import f1_score, classification_report, confusion_matrix, multilabel_confusion_matrix
from .data import NEEDS, BIO, ENTITIES
from .preprocess import decode_spans


def collate(items, pad_id):
    size = max(len(item['input_ids']) for item in items)
    result = {}
    for key, padding in [('input_ids', pad_id), ('attention_mask', 0), ('labels', -100)]:
        result[key] = torch.tensor([item[key] + [padding] * (size - len(item[key])) for item in items])
    result['targets'] = torch.tensor([[float(item['row']['is_request'])] +
        [float(n in item['row']['needs']) for n in NEEDS] for item in items])
    result['items'] = items
    return result


def choose_thresholds(y, p):
    # Thresholds are chosen ONLY from validation. Scores are not calibrated probabilities.
    values = []
    for j in range(5):
        candidates = np.arange(0.2, 0.81, 0.05)
        values.append(float(max(candidates, key=lambda t: (f1_score(y[:, j], p[:, j] >= t, zero_division=0), -abs(t - .5)))))
    return values


def evaluate_a(model, loader, device, thresholds=None):
    y, p, records = [], [], []
    model.eval()
    with torch.inference_mode():
        for batch in loader:
            request, needs = model(**{k: batch[k].to(device) for k in ['input_ids', 'attention_mask']})
            scores = torch.cat([request.sigmoid()[:, None], needs.sigmoid()], dim=1).cpu().numpy()
            y.extend(batch['targets'].numpy())
            p.extend(scores)
            records.extend({'id': item['row']['id'], 'scores': score.tolist()} for item, score in zip(batch['items'], scores))
    y, p = np.array(y).astype(int), np.array(p)
    thresholds = thresholds or choose_thresholds(y, p)
    predicted = p >= np.array(thresholds)
    gated = predicted[:, 1:] & predicted[:, 0, None]
    metrics = {
        'request': classification_report(y[:, 0], predicted[:, 0], labels=[0, 1], output_dict=True, zero_division=0),
        'needs': classification_report(y[:, 1:], predicted[:, 1:], target_names=NEEDS, output_dict=True, zero_division=0),
        'needs_macro_f1': f1_score(y[:, 1:], predicted[:, 1:], average='macro', zero_division=0),
        'needs_micro_f1': f1_score(y[:, 1:], predicted[:, 1:], average='micro', zero_division=0),
        'gated_needs_macro_f1': f1_score(y[:, 1:], gated, average='macro', zero_division=0),
        'thresholds': thresholds,
        # Ma trận nhầm lẫn dạng [[TN, FP], [FN, TP]]: hàng = nhãn thật, cột = dự đoán.
        'confusion': {
            'request': confusion_matrix(y[:, 0], predicted[:, 0], labels=[0, 1]).tolist(),
            'needs': {need: matrix.tolist() for need, matrix in
                      zip(NEEDS, multilabel_confusion_matrix(y[:, 1:], gated.astype(int), labels=list(range(len(NEEDS)))))},
        },
    }
    metrics['selection_score'] = (metrics['needs_macro_f1'] + f1_score(y[:, 0], predicted[:, 0], zero_division=0)) / 2
    return metrics, records


def evaluate_b(model, loader, device):
    counts = {kind: [0, 0, 0] for kind in ENTITIES}
    records = []
    # Ma trận nhầm lẫn theo từng TỪ: hàng = nhãn thật, cột = dự đoán; 'O' là từ không thuộc cụm nào.
    kinds = ['O'] + ENTITIES
    word_matrix = np.zeros((len(kinds), len(kinds)), dtype=int)
    model.eval()
    with torch.inference_mode():
        for batch in loader:
            logits = model(**{k: batch[k].to(device) for k in ['input_ids', 'attention_mask']}).logits.cpu()
            for item, output in zip(batch['items'], logits):
                row = item['row']
                tags = [BIO[output[i].argmax().item()] for i in item['first']]
                for position, tag in zip(item['first'], tags):
                    truth = BIO[item['labels'][position]]
                    word_matrix[kinds.index(truth.split('-', 1)[-1]), kinds.index(tag.split('-', 1)[-1])] += 1
                spans = decode_spans(row['text'], item['words'], tags)
                predicted = {(e['start'], e['end'], e['label']) for e in spans}
                gold = {(e['start'], e['end'], e['label']) for e in row['entities']}
                for kind in ENTITIES:
                    pred_k, gold_k = {e for e in predicted if e[2] == kind}, {e for e in gold if e[2] == kind}
                    for i, value in enumerate([len(pred_k & gold_k), len(pred_k), len(gold_k)]):
                        counts[kind][i] += value
                records.append({'id': row['id'], 'entities': spans, 'gold': row['entities']})
    def scores(values):
        tp, pred, gold = values
        return {'precision': tp / pred if pred else 0, 'recall': tp / gold if gold else 0,
                'f1': 2 * tp / (pred + gold) if pred + gold else 0, 'gold_count': gold}
    metrics = {kind: scores(values) for kind, values in counts.items()}
    metrics['micro'] = scores([sum(v[i] for v in counts.values()) for i in range(3)])
    metrics['selection_score'] = metrics['micro']['f1']
    metrics['confusion'] = {'labels': kinds, 'matrix': word_matrix.tolist()}
    return metrics, records

