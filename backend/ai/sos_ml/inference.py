"""Offline inference for A, B or both, using the same weights and preprocessing as training."""
import json
import unicodedata
from pathlib import Path
import torch
from transformers import AutoTokenizer, AutoModelForTokenClassification
from .data import NEEDS, BIO
from .modeling import RequestNeedsModel
from .preprocess import encode, decode_spans, PREPROCESSOR

class SOSPredictor:
    def __init__(self, root, device='cpu', *, allow_demo=False, lazy=False):
        self.root = Path(root)
        self.device = torch.device(device)
        self.allow_demo = allow_demo
        self.metadata = {}
        if not lazy:
            self.ensure('both')

    def ensure(self, mode):
        if mode not in {'a', 'b', 'both'}:
            raise ValueError('mode phải là a, b hoặc both')
        for task in (['a', 'b'] if mode == 'both' else [mode]):
            if task in self.metadata:
                continue
            folder = self.root / ('model_' + task)
            meta = json.loads((folder / 'metadata.json').read_text(encoding='utf-8'))
            if (meta.get('task') != task or meta.get('schema_version') != 1
                    or meta.get('preprocessor') != PREPROCESSOR
                    or meta.get('max_length') != 256 or (meta.get('demo') and not self.allow_demo)):
                raise ValueError('Model không tương thích với tác vụ/tiền xử lý.')
            if meta.get('needs' if task == 'a' else 'bio_labels') != (NEEDS if task == 'a' else BIO):
                raise ValueError('Label order mismatch')
            tokenizer = AutoTokenizer.from_pretrained(folder, use_fast=False, local_files_only=True)
            model = (RequestNeedsModel.from_bundle(folder) if task == 'a'
                     else AutoModelForTokenClassification.from_pretrained(folder, local_files_only=True))
            if task == 'b' and [model.config.id2label.get(i) for i in range(len(BIO))] != BIO:
                raise ValueError('Model B config label order mismatch')
            setattr(self, 't' + task, tokenizer)
            setattr(self, task, model.to(self.device).eval())
            self.metadata[task] = meta

    def predict(self, raw_text, mode='both'):
        self.ensure(mode)
        text = unicodedata.normalize('NFC', raw_text)
        tasks = ['a', 'b'] if mode == 'both' else [mode]
        meta = [self.metadata[t] for t in tasks]
        result = {'method': 'phobert_two_model_v1', 'mode': mode, 'text': text,
                  'demo': any(m.get('demo', False) for m in meta),
                  'evaluation_domains': [m.get('evaluation_domain', 'unknown') for m in meta],
                  'model_versions': [m['run_id'] for m in meta], 'requires_review': True,
                  'offset_unit': 'unicode_code_points_in_returned_text'}
        with torch.inference_mode():
            for task in tasks:
                item = encode(text, getattr(self, 't' + task))
                inputs = {k: torch.tensor([item[k]], device=self.device) for k in ['input_ids', 'attention_mask']}
                if task == 'a':
                    req, needs = self.a(**inputs)
                    score, scores = req.sigmoid().item(), needs.sigmoid()[0].cpu().tolist()
                    thresholds = self.metadata['a']['thresholds']
                    is_request = score >= thresholds['request']
                    candidates = [n for n,p,t in zip(NEEDS,scores,thresholds['needs']) if p >= t]
                    result.update(is_request=is_request, request_score=round(score,4),
                                  needs=candidates if is_request else [], candidate_needs=candidates,
                                  need_scores=dict(zip(NEEDS,[round(p,4) for p in scores])),
                                  thresholds=thresholds)
                else:
                    logits = self.b(**inputs).logits[0]
                    tags = [BIO[logits[index].argmax().item()] for index in item['first']]
                    result['entities'] = decode_spans(text, item['words'], tags)
        return result
