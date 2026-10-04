"""Two-model predictions for review; never creates or approves an SOS."""
import re
import unicodedata
from decimal import Decimal
from .sos_service import get_predictor, _lock

NEED_NAMES = {'RESCUE': 'Cứu hộ khẩn cấp', 'MEDICAL': 'Y tế khẩn cấp', 'EVACUATION': 'Sơ tán', 'SUPPLY': 'Nhu yếu phẩm'}


def article_text(title, content):
    title, content = (title or '').strip(), (content or '').strip()
    title_prefix = title[:-3] if title.endswith('...') else title
    return unicodedata.normalize('NFC', content if content.startswith(title_prefix) else '\n'.join(filter(None, [title, content])))


def predict_article(title, content):
    from .sos_ml.preprocess import segmented_words
    text = article_text(title, content)
    if not text or len(text) > 100000:
        raise ValueError('Bài trống hoặc dài hơn 100.000 ký tự; cần kiểm tra thủ công.')
    with _lock:
        predictor = get_predictor('both')
        words = segmented_words(text)
        chunks, start, tokens = [], 0, 0
        # Preserve all words and global Unicode offsets; each model sees <= 256 BPE.
        for word, a, b in words:
            size = max(len(t.encode(word, add_special_tokens=False)) for t in [predictor.ta, predictor.tb])
            if size > 254:
                raise ValueError('Một từ quá dài để phân tích; cần kiểm tra nội dung.')
            if tokens + size > 254:
                chunks.append((start, a))
                start, tokens = a, 0
            tokens += size
        chunks.append((start, len(text)))
        results = []
        for a, b in chunks:
            result = predictor.predict(text[a:b])
            results.append({'start': a, 'end': b, 'prediction': result})
    first = results[0]['prediction']
    entities = []
    for chunk in results:
        for entity in chunk['prediction']['entities']:
            entity = dict(entity, start=entity['start'] + chunk['start'], end=entity['end'] + chunk['start'])
            entities.append(entity)
    return {'method': 'phobert_two_model_v1', 'mode': 'both', 'text': text,
            'is_request': any(c['prediction']['is_request'] for c in results),
            'request_score': max(c['prediction']['request_score'] for c in results),
            'needs': list(dict.fromkeys(n for c in results for n in c['prediction']['needs'])),
            'need_scores': {n: max(c['prediction']['need_scores'][n] for c in results) for n in NEED_NAMES},
            'entities': entities, 'model_versions': first['model_versions'], 'evaluation_domains': first['evaluation_domains'],
            'requires_review': True, 'offset_unit': 'unicode_code_points_in_returned_text',
            'chunks': results, 'aggregation': 'any_request_union_needs; max_scores; all_spans',
            'severity_source': 'need_mapping_not_a_model_prediction'}


def suggested_fields(result):
    def spans(label):
        return list(dict.fromkeys(e['text'] for e in result.get('entities', []) if e['label'] == label))
    locations = spans('LOCATION')
    # Ambiguous multiple counts and unrecognized numbers remain unknown for the operator.
    counts = []
    numbers = {'một':1,'hai':2,'ba':3,'bốn':4,'năm':5,'sáu':6,'bảy':7,'tám':8,'chín':9,'mười':10}
    for value in spans('PEOPLE_COUNT'):
        match = re.fullmatch(r'(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+(?:người|nạn nhân)', value.casefold().strip())
        if match:
            word = match.group(1)
            number = int(word) if word.isdigit() else numbers[word]
            if 1 <= number <= 10000:
                counts.append(number)
    count = counts[0] if len(spans('PEOPLE_COUNT')) == 1 and len(counts) == 1 else None
    needs = result.get('needs', [])
    severity = next((level for n,level in [('RESCUE','CRITICAL'),('MEDICAL','HIGH'),('EVACUATION','HIGH'),('SUPPLY','MEDIUM')] if n in needs), 'LOW')
    return {'extracted_location': '; '.join(locations)[:200], 'extracted_address': '; '.join(locations),
            'extracted_people_count': count, 'extracted_incident_type': ', '.join(NEED_NAMES[n] for n in needs)[:100],
            'extracted_severity': severity, 'confidence_score': Decimal(str(result.get('request_score', 0)))}


def geocode_prediction(result):
    from .nlp.geocoder import geocode_from_text
    locations = list(dict.fromkeys(e['text'] for e in result.get('entities', []) if e['label'] == 'LOCATION'))
    if len(locations) != 1:
        return None, None
    try:
        lat, lng, _ = geocode_from_text(locations[0])
        return (Decimal(str(lat)) if lat is not None else None, Decimal(str(lng)) if lng is not None else None)
    except Exception:
        return None, None  # Geocoding is only a suggestion; review requires coordinates.
