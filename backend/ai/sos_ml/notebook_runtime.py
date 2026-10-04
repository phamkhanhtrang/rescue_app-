"""Visible training steps embedded into Colab, also importable for offline tests."""
import gc
import hashlib
import json
import math
import platform
import random
import shutil
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import torch
import transformers
from torch.utils.data import DataLoader
from transformers import AutoTokenizer, AutoModel, AutoModelForTokenClassification
from tqdm.auto import tqdm
from .data import NEEDS, BIO, ENTITIES, write_jsonl
from .preprocess import encode, decode_spans, PREPROCESSOR, MAX_LENGTH
from .modeling import RequestNeedsModel
from .continuation import read_parent, load_parent_model
from .excel_data import semantic_hash, check_excel_parent
from .metrics import collate, evaluate_a, evaluate_b


def save_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


class NotebookRun:
    def __init__(self, task, splits, workbook_path, output, *, parent=None,
                 epochs=5, batch_size=8, lr=2e-5, seed=42, evaluation_domain='synthetic'):
        if task not in {'a', 'b'} or type(epochs) is not int or epochs < 1:
            raise ValueError('Task/epochs không hợp lệ')
        if type(batch_size) is not int or batch_size < 1 or not math.isfinite(lr) or lr <= 0:
            raise ValueError('Batch size và learning rate phải là số dương hữu hạn')
        self.task, self.splits, self.workbook_path = task, splits, Path(workbook_path)
        self.output, self.parent_path = Path(output), Path(parent) if parent else None
        if self.output.exists():
            raise ValueError(f'Run đã tồn tại: {self.output}. Đổi RUN_NAME để giữ kết quả cũ.')
        self.epochs, self.batch_size, self.lr, self.seed = epochs, batch_size, lr, seed
        self.domain, self.backbone = evaluation_domain, 'vinai/phobert-base-v2'
        self.checkpoint = self.output / f'model_{task}'
        self.evaluate = evaluate_a if task == 'a' else evaluate_b
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.ready = self.baseline_done = self.training_done = self.evaluation_done = False

    def prepare(self):
        random.seed(self.seed)
        np.random.seed(self.seed)
        torch.manual_seed(self.seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(self.seed)
        parent, lineage = (read_parent(self.parent_path, self.task) if self.parent_path else (None, None))
        if parent:
            check_excel_parent(parent, self.splits, self.task)
        self.parent = parent
        self.tokenizer = AutoTokenizer.from_pretrained(str(self.parent_path or self.backbone),
            use_fast=False, local_files_only=bool(parent))
        prepared = {}
        for split, rows in self.splits.items():
            prepared[split] = []
            for index, row in enumerate(tqdm(rows, desc=f'Kiểm tra {split}'), 2):
                try:
                    item = encode(row['text'], self.tokenizer, row['entities'] if self.task == 'b' else None)
                except ValueError as exc:
                    raise ValueError(f'{split}, dòng Excel {index}, ID={row["id"]}: {exc}') from exc
                item['row'] = row
                prepared[split].append(item)
        self.loaders = {name: DataLoader(rows, batch_size=self.batch_size, shuffle=name == 'train',
            collate_fn=lambda items: collate(items, self.tokenizer.pad_token_id)) for name, rows in prepared.items()}
        if parent:
            self.model = load_parent_model(self.parent_path, self.task)
        elif self.task == 'a':
            self.model = RequestNeedsModel(AutoModel.from_pretrained(self.backbone))
        else:
            self.model = AutoModelForTokenClassification.from_pretrained(self.backbone,
                num_labels=len(BIO), id2label=dict(enumerate(BIO)), label2id={v:i for i,v in enumerate(BIO)})
        self.model.to(self.device)
        self.metadata = {'schema_version': 1, 'run_id': self.output.name, 'task': self.task,
            'created_at': datetime.now(timezone.utc).isoformat(), 'backbone': parent['backbone'] if parent else self.backbone,
            'preprocessor': PREPROCESSOR, 'max_length': MAX_LENGTH, 'needs': NEEDS, 'bio_labels': BIO,
            'demo': False, 'evaluation_domain': self.domain,
            'initialization': 'continued_fine_tuning' if parent else 'pretrained_backbone_random_task_heads',
            'parent_checkpoint': lineage, 'optimizer_resumed': False,
            'hyperparameters': {'epochs': self.epochs, 'batch_size': self.batch_size, 'lr': self.lr, 'seed': self.seed},
            'versions': {'python': platform.python_version(), 'torch': torch.__version__, 'transformers': transformers.__version__},
            'backbone_revision': getattr(self.model.encoder.config if self.task == 'a' else self.model.config, '_commit_hash', None),
            'excel_split_sha256': {s: semantic_hash(rows, self.task) for s, rows in self.splits.items()},
            'data_counts': {s: len(rows) for s, rows in self.splits.items()},
            'data_origins': {s: {origin: sum(r['origin'] == origin for r in rows) for origin in ['real', 'synthetic', 'translated']} for s, rows in self.splits.items()}}
        self.output.mkdir(parents=True, exist_ok=False)
        shutil.copy2(self.workbook_path, self.output / self.workbook_path.name)
        self.ready = True
        self._status('prepared')
        print(f'Sẵn sàng: {self.device}, {self.metadata["data_counts"]}\nLưu tại: {self.output}')

    def _status(self, phase):
        save_json(self.output / 'status.json', {'phase': phase, 'run': self.output.name})

    def _threshold_kwargs(self, metadata):
        if self.task == 'a' and 'thresholds' in metadata:
            return {'thresholds': [metadata['thresholds']['request']] + metadata['thresholds']['needs']}
        return {}

    def measure_before(self):
        if not self.ready:
            raise RuntimeError('Chạy bước chuẩn bị model trước.')
        if self.baseline_done:
            print('Đã đo baseline, giữ nguyên kết quả trước train.')
            return self.before
        parent_thresholds = self._threshold_kwargs(self.parent or {})
        self.before_validation, _ = self.evaluate(self.model, self.loaders['validation'], self.device, **parent_thresholds)
        kwargs = {'thresholds': self.before_validation['thresholds']} if self.task == 'a' else {}
        self.before, predictions = self.evaluate(self.model, self.loaders['test'], self.device, **kwargs)
        self.before['evaluation_domain'] = self.domain
        self.before['baseline_type'] = 'parent_model' if self.parent else 'pretrained_encoder_random_task_heads'
        save_json(self.output / 'before_metrics.json', self.before)
        write_jsonl(self.output / 'before_predictions.jsonl', predictions)
        self.baseline_done = True
        self._status('baseline_measured')
        return self.before

    def _save_best(self, metrics, epoch):
        self.metadata['best_epoch'] = epoch
        if self.task == 'a':
            t = metrics['thresholds']
            self.metadata['thresholds'] = {'request': t[0], 'needs': t[1:]}
            self.model.save_bundle(self.checkpoint, self.tokenizer, self.metadata)
        else:
            self.model.save_pretrained(self.checkpoint, safe_serialization=True)
            self.tokenizer.save_pretrained(self.checkpoint)
            save_json(self.checkpoint / 'metadata.json', self.metadata)

    def train(self):
        if not self.baseline_done:
            raise RuntimeError('Chạy bước đánh giá trước fine-tune trước khi train.')
        if self.training_done or getattr(self, 'training_started', False):
            raise RuntimeError('Run này đã train hoặc từng bị gián đoạn. Tạo RUN_NAME mới; dùng continue từ checkpoint nếu có.')
        self.training_started = True
        self._status('training')
        best, self.history = -1.0, []
        if self.parent:
            best = self.before_validation['selection_score']
            self._save_best(self.before_validation, 0)
        optimizer = torch.optim.AdamW(self.model.parameters(), lr=self.lr, weight_decay=.01)
        # A fresh optimizer is intentional for a new data version (continued fine-tuning).
        try:
            for epoch in range(1, self.epochs + 1):
                self.model.train()
                losses = []
                progress = tqdm(self.loaders['train'], desc=f'Epoch {epoch}/{self.epochs}')
                for batch in progress:
                    optimizer.zero_grad(set_to_none=True)
                    inputs = {k: batch[k].to(self.device) for k in ['input_ids', 'attention_mask']}
                    if self.task == 'a':
                        request, needs = self.model(**inputs)
                        targets = batch['targets'].to(self.device)
                        loss = torch.nn.functional.binary_cross_entropy_with_logits(request, targets[:, 0])
                        loss = loss + torch.nn.functional.binary_cross_entropy_with_logits(needs, targets[:, 1:])
                    else:
                        loss = self.model(**inputs, labels=batch['labels'].to(self.device)).loss
                    if not torch.isfinite(loss):
                        raise RuntimeError('Loss không hữu hạn. Kiểm tra dữ liệu và learning rate.')
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                    optimizer.step()
                    losses.append(loss.item())
                    progress.set_postfix(loss=f'{loss.item():.4f}')
                metrics, _ = self.evaluate(self.model, self.loaders['validation'], self.device)
                self.history.append({'epoch': epoch, 'loss': float(np.mean(losses)), 'validation': metrics})
                if metrics['selection_score'] > best:
                    best = metrics['selection_score']
                    self._save_best(metrics, epoch)
                save_json(self.output / 'history.json', self.history)
                print(f'Epoch {epoch}: loss={np.mean(losses):.4f}, validation={metrics["selection_score"]:.4f}, best={best:.4f}')
            self.training_done = True
            self._status('trained')
        except BaseException:
            self._status('interrupted')
            raise
        finally:
            del optimizer
            gc.collect()

    def finish(self):
        if not self.training_done:
            raise RuntimeError('Train chưa hoàn thành. Xem lỗi tại ô Train; chưa có báo cáo test cuối cùng.')
        if self.evaluation_done:
            return self.comparison
        del self.model
        gc.collect()
        if self.device.type == 'cuda':
            torch.cuda.empty_cache()
        self.model = load_parent_model(self.checkpoint, self.task).to(self.device)
        self.saved = json.loads((self.checkpoint / 'metadata.json').read_text(encoding='utf-8'))
        after, predictions = self.evaluate(self.model, self.loaders['test'], self.device, **self._threshold_kwargs(self.saved))
        after.update(evaluation_domain=self.domain, demo_not_research_result=False,
                     synthetic_only=self.domain == 'synthetic', best_epoch=self.saved['best_epoch'])
        save_json(self.output / 'test_metrics.json', after)
        write_jsonl(self.output / 'test_predictions.jsonl', predictions)
        def compact(report):
            if self.task == 'a':
                return {'Request F1': report['request']['1']['f1-score'], 'Needs macro F1': report['needs_macro_f1'],
                        'Needs micro F1': report['needs_micro_f1'], 'Needs F1 sau lọc yêu cầu': report['gated_needs_macro_f1']}
            return {'Span micro F1': report['micro']['f1'], **{label + ' F1': report[label]['f1'] for label in ENTITIES}}
        before_values, after_values = compact(self.before), compact(after)
        self.comparison = [{'Chỉ số': k, 'Trước': before_values[k], 'Sau': after_values[k],
                            'Chênh lệch': after_values[k] - before_values[k]} for k in before_values]
        save_json(self.output / 'comparison.json', {'baseline_type': self.before['baseline_type'],
            'evaluation_domain': self.domain, 'best_epoch': self.saved['best_epoch'], 'metrics': self.comparison})
        self.evaluation_done = True
        self._status('evaluated')
        return self.comparison

    def predict(self, text):
        if not self.evaluation_done:
            raise RuntimeError('Hoàn thành đánh giá model tốt nhất trước khi thử câu mới.')
        text = unicodedata.normalize('NFC', text)
        item = encode(text, self.tokenizer)
        inputs = {k: torch.tensor([item[k]], device=self.device) for k in ['input_ids', 'attention_mask']}
        self.model.eval()
        with torch.inference_mode():
            if self.task == 'a':
                req, needs = self.model(**inputs)
                score, scores = req.sigmoid().item(), needs.sigmoid()[0].tolist()
                thresholds = self.saved['thresholds']
                request = score >= thresholds['request']
                return {'text': text, 'is_request': request, 'request_score': score,
                    'needs': [n for n, p, t in zip(NEEDS, scores, thresholds['needs']) if request and p >= t],
                    'need_scores': dict(zip(NEEDS, scores))}
            logits = self.model(**inputs).logits[0]
            tags = [BIO[logits[i].argmax().item()] for i in item['first']]
            return {'text': text, 'entities': decode_spans(text, item['words'], tags)}

    def export(self):
        if not self.evaluation_done:
            raise RuntimeError('Chạy đánh giá sau train trước khi xuất model.')
        # The archive contains model_a/ OR model_b/, matching SOSPredictor's root layout.
        archive = shutil.make_archive(str(self.output / f'model_{self.task}'), 'zip',
                                      root_dir=self.output, base_dir=f'model_{self.task}')
        digest = hashlib.sha256()
        with open(archive, 'rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        save_json(self.output / 'export.json', {'archive': str(archive), 'sha256': digest.hexdigest()})
        print(f'Model đã lưu trên Drive: {self.checkpoint}\nZIP để tích hợp: {archive}')
        return archive
