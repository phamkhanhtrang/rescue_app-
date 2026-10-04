"""Warm-start from a complete model artifact; not an optimizer-state resume."""
import hashlib
import json
from pathlib import Path
from .data import NEEDS, BIO
from .preprocess import PREPROCESSOR, MAX_LENGTH


def read_parent(directory, task, demo=False):
    directory = Path(directory)
    raw = (directory / 'metadata.json').read_bytes()
    meta = json.loads(raw)
    if meta.get('task') != task:
        raise ValueError(f'Checkpoint is not model {task.upper()}')
    if meta.get('schema_version') != 1 or meta.get('preprocessor') != PREPROCESSOR or meta.get('max_length') != MAX_LENGTH:
        raise ValueError('Checkpoint preprocessing/schema differs; cannot continue with these labels.')
    expected_key, expected_labels = ('needs', NEEDS) if task == 'a' else ('bio_labels', BIO)
    if meta.get(expected_key) != expected_labels:
        raise ValueError('Checkpoint label names/order differ.')
    if meta.get('demo') and not demo:
        raise ValueError('Tiny demo checkpoint cannot initialize a non-demo run.')
    return meta, {'path': str(directory.resolve()), 'run_id': meta['run_id'],
                  'metadata_sha256': hashlib.sha256(raw).hexdigest()}


def load_parent_model(directory, task):
    from .modeling import RequestNeedsModel
    from transformers import AutoModelForTokenClassification
    if task == 'a':
        return RequestNeedsModel.from_bundle(directory)
    model = AutoModelForTokenClassification.from_pretrained(directory, local_files_only=True)
    if [model.config.id2label.get(i) for i in range(len(BIO))] != BIO:
        raise ValueError('Model B checkpoint config has incompatible label order.')
    return model
