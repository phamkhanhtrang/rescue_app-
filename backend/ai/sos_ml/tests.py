import copy
import unittest
from .data import validate_row, validate_splits, BIO
from .preprocess import encode, decode_spans, segmented_words


class TinyTokenizer:
    bos_token_id, eos_token_id = 0, 2
    def encode(self, text, add_special_tokens=False):
        return [3, 4] if text == 'nước_uống' else [5]


class DataAndAlignmentTests(unittest.TestCase):
    def row(self):
        return {'id': 'a', 'group_id': 'a', 'text': 'Cần nước uống.', 'source_url': 'local:fixture',
                'origin': 'synthetic', 'reviewed': False, 'is_request': True, 'needs': ['SUPPLY'],
                'entities': [{'start': 4, 'end': 13, 'label': 'RESOURCE', 'text': 'nước uống'}]}

    def test_span_alignment_first_bpe_and_decode(self):
        row = self.row()
        validate_row(row, require_review=False)
        encoded = encode(row['text'], TinyTokenizer(), row['entities'], lambda _: 'Cần nước_uống .')
        self.assertEqual(encoded['labels'], [-100, 0, BIO.index('B-RESOURCE'), -100, 0, -100])
        spans = decode_spans(row['text'], encoded['words'], ['O', 'B-RESOURCE', 'O'])
        self.assertEqual(spans, row['entities'])

    def test_whitespace_preserves_offsets(self):
        result = segmented_words('Cần  nước\tuống.', lambda _: 'Cần nước_uống .')
        self.assertEqual(result[1], ('nước_uống', 5, 14))

    def test_segmenter_cannot_silently_change_characters(self):
        with self.assertRaises(ValueError):
            segmented_words('can nuoc', lambda _: 'cần nước')

    def test_entity_cannot_cut_segmented_word(self):
        row = self.row()
        row['entities'][0].update(end=8, text='nước')
        with self.assertRaises(ValueError):
            encode(row['text'], TinyTokenizer(), row['entities'], lambda _: 'Cần nước_uống .')

    def test_reject_long_text_instead_of_truncating_labels(self):
        with self.assertRaises(ValueError):
            encode('a ' * 255, TinyTokenizer(), [], lambda x: x)

    def test_require_human_review(self):
        with self.assertRaises(ValueError):
            validate_row(self.row())

    def test_reject_overlap(self):
        row = self.row()
        row['entities'] *= 2
        with self.assertRaises(ValueError):
            validate_row(row, require_review=False)

    def test_reject_cross_split_family(self):
        splits = {}
        for i, name in enumerate(['train', 'validation', 'test']):
            row = self.row()
            row.update(id=name, text=row['text'] + str(i))
            splits[name] = [row]
        with self.assertRaisesRegex(ValueError, 'family'):
            validate_splits(splits, require_real_eval=False, require_review=False)

    def test_reject_synthetic_eval(self):
        splits = {}
        for i, name in enumerate(['train', 'validation', 'test']):
            row = self.row()
            row.update(id=name, group_id=name, reviewed=True, text=row['text'] + str(i))
            splits[name] = [row]
        with self.assertRaisesRegex(ValueError, 'real Vietnamese'):
            validate_splits(splits)

    def test_negatives_cannot_have_active_resource(self):
        row = self.row()
        row['is_request'] = False
        with self.assertRaises(ValueError):
            validate_row(row, require_review=False)

if __name__ == '__main__':
    unittest.main()
