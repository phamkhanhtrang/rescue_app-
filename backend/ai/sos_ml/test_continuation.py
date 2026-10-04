"""Small serialization/validation checks, no PhoBERT training or network access."""
import json
import tempfile
import unittest
from pathlib import Path
import torch
from transformers import RobertaConfig, RobertaModel, RobertaForTokenClassification
from .modeling import RequestNeedsModel
from .continuation import read_parent, load_parent_model
from .data import NEEDS, BIO
from .preprocess import PREPROCESSOR


class DummyTokenizer:
    def save_pretrained(self, directory):
        pass


class ContinuationTests(unittest.TestCase):
    def metadata(self, task):
        return {'schema_version': 1, 'task': task, 'preprocessor': PREPROCESSOR, 'max_length': 256,
                'needs': NEEDS, 'bio_labels': BIO, 'demo': True, 'run_id': 'test-only', 'backbone': 'random-tiny'}

    def test_a_restores_encoder_and_both_heads(self):
        config = RobertaConfig(vocab_size=16, hidden_size=8, num_hidden_layers=1,
                               num_attention_heads=2, intermediate_size=12)
        model = RequestNeedsModel(RobertaModel(config)).eval()
        with torch.no_grad():
            model.heads['request'].bias.fill_(1.234)
            model.heads['needs'].bias.fill_(2.345)
        with tempfile.TemporaryDirectory() as directory:
            model.save_bundle(directory, DummyTokenizer(), self.metadata('a'))
            meta, lineage = read_parent(directory, 'a', demo=True)
            restored = load_parent_model(directory, 'a').eval()
            for key, tensor in model.state_dict().items():
                self.assertTrue(torch.equal(tensor, restored.state_dict()[key]), key)
            self.assertEqual(lineage['run_id'], meta['run_id'])
            with self.assertRaises(ValueError):
                read_parent(directory, 'b', demo=True)
            with self.assertRaises(ValueError):
                read_parent(directory, 'a', demo=False)

    def test_b_restores_head_and_rejects_label_change(self):
        config = RobertaConfig(vocab_size=16, hidden_size=8, num_hidden_layers=1,
            num_attention_heads=2, intermediate_size=12, num_labels=len(BIO),
            id2label=dict(enumerate(BIO)), label2id={v:i for i,v in enumerate(BIO)})
        model = RobertaForTokenClassification(config).eval()
        with tempfile.TemporaryDirectory() as directory:
            model.save_pretrained(directory, safe_serialization=True)
            path = Path(directory) / 'metadata.json'
            meta = self.metadata('b')
            path.write_text(json.dumps(meta))
            restored = load_parent_model(directory, 'b')
            for key, tensor in model.state_dict().items():
                self.assertTrue(torch.equal(tensor, restored.state_dict()[key]), key)
            meta['bio_labels'] = list(reversed(BIO))
            path.write_text(json.dumps(meta))
            with self.assertRaises(ValueError):
                read_parent(directory, 'b', demo=True)
