"""One preprocessing implementation for training and serving, including raw offsets.

PhoBERT has a slow tokenizer: do NOT call word_ids()/offset_mapping on it.
We tokenize each segmented word and supervise its first BPE piece only.
"""
import re
import unicodedata
from .data import BIO

MAX_LENGTH = 256
PREPROCESSOR = 'pyvi-0.1.1-nfc-offset-v1'


def segmented_words(text, segmenter=None):
    if text != unicodedata.normalize('NFC', text):
        raise ValueError('Text must be NFC normalized.')
    if '_' in text:
        raise ValueError('Literal underscores are unsupported in v1. Review/normalize the source first.')
    if segmenter is None:
        from pyvi import ViTokenizer
        segmenter = ViTokenizer.tokenize
    tokens = segmenter(text).split()
    result, cursor = [], 0
    for token in tokens:
        parts = token.split('_')
        pattern = r'\s+'.join(re.escape(p) for p in parts)
        while cursor < len(text) and text[cursor].isspace():
            cursor += 1
        match = re.compile(pattern).match(text, cursor)
        if not match:
            raise ValueError(f'Segmenter changed source characters near offset {cursor}; review the text.')
        result.append((token, match.start(), match.end()))
        cursor = match.end()
    if text[cursor:].strip():
        raise ValueError('Segmenter dropped source text.')
    return result


def encode(text, tokenizer, entities=None, segmenter=None):
    words = segmented_words(text, segmenter)
    labels = ['O'] * len(words)
    if entities is not None:
        for ent in entities:
            indices = [i for i, (_, a, b) in enumerate(words) if a < ent['end'] and b > ent['start']]
            if not indices or words[indices[0]][1] != ent['start'] or words[indices[-1]][2] != ent['end']:
                raise ValueError(f'Entity boundary cuts a segmented word: {ent}. Review annotation.')
            for j, i in enumerate(indices):
                labels[i] = ('B-' if j == 0 else 'I-') + ent['label']
    ids, targets, first = [tokenizer.bos_token_id], [-100], []
    for i, (word, _, _) in enumerate(words):
        pieces = tokenizer.encode(word, add_special_tokens=False)
        if not pieces:
            raise ValueError('Empty BPE word')
        first.append(len(ids))
        ids.extend(pieces)
        targets.extend([BIO.index(labels[i])] + [-100] * (len(pieces) - 1))
    ids.append(tokenizer.eos_token_id)
    targets.append(-100)
    if len(ids) > MAX_LENGTH:
        raise ValueError(f'Text has {len(ids)} BPE tokens; v1 accepts at most {MAX_LENGTH}. Split and relabel first.')
    return {'input_ids': ids, 'attention_mask': [1] * len(ids), 'labels': targets,
            'words': words, 'first': first}


def decode_spans(text, words, tags):
    spans, current = [], None
    for (_, a, b), tag in zip(words, tags):
        if tag == 'O':
            current = None
            continue
        prefix, kind = tag.split('-', 1)
        if prefix == 'I' and current is not None and current['label'] == kind:
            current['end'] = b
            current['text'] = text[current['start']:b]
        else:
            current = {'start': a, 'end': b, 'label': kind, 'text': text[a:b]}
            spans.append(current)
    return spans
