"""Raw-text span schema and leakage checks. No ML dependencies required."""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

NEEDS = ['RESCUE', 'MEDICAL', 'EVACUATION', 'SUPPLY']
ENTITIES = ['LOCATION', 'PEOPLE_COUNT', 'VULNERABLE_GROUP', 'RESOURCE']
BIO = ['O'] + [f'{prefix}-{kind}' for kind in ENTITIES for prefix in ['B', 'I']]


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text(encoding='utf-8-sig').splitlines() if line.strip()]


def write_jsonl(path, rows):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows), encoding='utf-8')


def fingerprint(text):
    value = re.sub(r'\s+', ' ', unicodedata.normalize('NFC', text).casefold()).strip()
    return hashlib.sha256(value.encode()).hexdigest()


def validate_row(row, require_review=True):
    for key in ['id', 'group_id', 'text', 'source_url', 'origin', 'reviewed', 'is_request', 'needs', 'entities']:
        if key not in row:
            raise ValueError(f'Missing {key}: {row.get("id")}')
    text = row['text']
    if not isinstance(text, str) or not text.strip() or text != unicodedata.normalize('NFC', text):
        raise ValueError('Text must be nonempty Unicode NFC; normalize BEFORE annotation.')
    if not row['id'] or not row['group_id'] or not row['source_url']:
        raise ValueError('id, group_id and provenance are required.')
    if row['origin'] not in ['real', 'translated', 'synthetic']:
        raise ValueError('Unknown origin')
    if require_review and row['reviewed'] is not True:
        raise ValueError(f'Human review required: {row["id"]}')
    if type(row['is_request']) is not bool or not isinstance(row['needs'], list):
        raise ValueError('is_request must be boolean; needs must be a list.')
    if len(set(row['needs'])) != len(row['needs']) or set(row['needs']) - set(NEEDS):
        raise ValueError('Unknown or duplicate need')
    if not row['is_request'] and (row['needs'] or row['entities']):
        raise ValueError('v1 annotates active request information only; negative rows have empty labels.')
    end = 0
    for span in sorted(row['entities'], key=lambda s: s['start']):
        a, b = span['start'], span['end']
        if type(a) is not int or type(b) is not int or not 0 <= a < b <= len(text) or a < end:
            raise ValueError(f'Invalid/overlapping span: {row["id"]}')
        if span['label'] not in ENTITIES or text[a:b] != span['text']:
            raise ValueError(f'Span text/label mismatch: {row["id"]}')
        if text[a:b] != text[a:b].strip():
            raise ValueError('Do not include boundary whitespace in spans.')
        end = b


def validate_splits(splits, require_real_eval=True, require_review=True):
    seen_ids, seen_text, seen_groups = set(), {}, {}
    for split in ['train', 'validation', 'test']:
        rows = splits[split]
        if not rows:
            raise ValueError(f'Empty split: {split}')
        for row in rows:
            validate_row(row, require_review=require_review)
            if row['id'] in seen_ids:
                raise ValueError(f'Duplicate id: {row["id"]}')
            seen_ids.add(row['id'])
            key = fingerprint(row['text'])
            if key in seen_text:
                raise ValueError(f'Duplicate text: {row["id"]} and {seen_text[key]}')
            seen_text[key] = row['id']
            group = row['group_id']
            if group in seen_groups and seen_groups[group] != split:
                raise ValueError(f'Event/template family crosses splits: {group}')
            seen_groups[group] = split
            if require_real_eval and split != 'train' and row['origin'] != 'real':
                raise ValueError('Validation/test must contain reviewed real Vietnamese examples only.')
    # Reject an evaluation that cannot measure any one of the declared tasks.
    if require_real_eval:
        for name, rows in splits.items():
            if {r['is_request'] for r in rows} != {True, False}:
                raise ValueError(f'{name}: both request classes required')
            for need in NEEDS:
                values = [need in r['needs'] for r in rows]
                if not any(values) or all(values):
                    raise ValueError(f'{name}: need positive AND negative examples for {need}')
            present = {e['label'] for r in rows for e in r['entities']}
            if set(ENTITIES) - present:
                raise ValueError(f'{name}: missing entity types {set(ENTITIES) - present}')


def load_splits(directory, demo=False, synthetic=False):
    splits = {s: read_jsonl(Path(directory) / f'{s}.jsonl') for s in ['train', 'validation', 'test']}
    validate_splits(splits, require_real_eval=not (demo or synthetic), require_review=not (demo or synthetic))
    if synthetic:
        for name, rows in splits.items():
            for row in rows:
                if row['reviewed'] is not True and not (row['origin'] == 'synthetic' and row.get('annotation_method') == 'authored_template_spans'):
                    raise ValueError('Unreviewed rows must be declared template-labelled synthetic data.')
                if name != 'train' and row['origin'] != 'synthetic':
                    raise ValueError('Synthetic evaluation profile requires synthetic validation/test; use the real profile for real evaluation.')
            if {r['is_request'] for r in rows} != {True, False}:
                raise ValueError(f'{name}: need both request classes')
            if set(NEEDS) - {n for r in rows for n in r['needs']}:
                raise ValueError(f'{name}: missing need labels')
            if set(ENTITIES) - {e['label'] for r in rows for e in r['entities']}:
                raise ValueError(f'{name}: missing entity labels')
    return splits
