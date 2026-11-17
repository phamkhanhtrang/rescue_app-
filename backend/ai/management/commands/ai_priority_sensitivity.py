"""
Phân tích độ nhạy của điểm ưu tiên Zone theo trọng số.

Trọng số trong ai/priority_scorer.py là lựa chọn thiết kế. Lệnh này trả lời:
"nếu một trọng số lệch ±X% thì thứ hạng ưu tiên các Zone thay đổi nhiều không?"

    python manage.py ai_priority_sensitivity                  # Zone đang hoạt động trong DB
    python manage.py ai_priority_sensitivity --simulate 500   # 500 Zone giả lập ngẫu nhiên

Với mỗi trọng số: tăng/giảm X%, chuẩn hóa lại để tổng vẫn là 100, rồi so thứ hạng
mới với thứ hạng gốc bằng hệ số tương quan hạng Spearman (1.0 = không đổi) và
tỷ lệ Zone trong top-k vẫn giữ nguyên.
"""
import random
import sys
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from ai.priority_scorer import WEIGHTS, SEVERITY_SCORES, score_from_features, zone_features

LABELS = {'sos': 'Số SOS', 'people': 'Số nạn nhân', 'severity': 'Mức nghiêm trọng',
          'wait': 'Thời gian chờ', 'deficit': 'Thiếu cứu hộ', 'vulnerable': 'Người yếu thế / y tế'}


def perturbed(weights: dict, name: str, factor: float) -> dict:
    """Nhân một trọng số với factor rồi chuẩn hóa để tổng vẫn bằng tổng ban đầu."""
    changed = dict(weights, **{name: weights[name] * factor})
    scale = sum(weights.values()) / sum(changed.values())
    return {key: value * scale for key, value in changed.items()}


def ranking(features: list, weights: dict) -> list:
    scores = [score_from_features(f, weights) for f in features]
    return sorted(range(len(features)), key=lambda i: (-scores[i], i))


def spearman(order_a: list, order_b: list) -> float:
    n = len(order_a)
    if n < 2:
        return 1.0
    rank_b = {item: position for position, item in enumerate(order_b)}
    d2 = sum((position - rank_b[item]) ** 2 for position, item in enumerate(order_a))
    return 1 - 6 * d2 / (n * (n * n - 1))


def simulated_features(count: int, seed: int) -> list:
    """Zone giả lập: mỗi thành phần lấy ngẫu nhiên trong miền giá trị thực tế của nó."""
    rng = random.Random(seed)
    severities = list(SEVERITY_SCORES.values())
    return [{'sos': rng.random(), 'people': rng.random(), 'severity': rng.choice(severities),
             'wait': rng.random(), 'deficit': rng.choice([0, 0.25, 0.5, 0.75, 1.0]),
             'vulnerable': rng.choice([0, 0, 0.4, 0.6, 1.0])} for _ in range(count)]


class Command(BaseCommand):
    help = 'Kiểm tra thứ hạng ưu tiên Zone ổn định thế nào khi trọng số thay đổi.'

    def add_arguments(self, parser):
        parser.add_argument('--simulate', type=int, default=0, help='Dùng N Zone giả lập thay cho DB')
        parser.add_argument('--percent', type=float, default=20.0, help='Mức thay đổi mỗi trọng số (%%)')
        parser.add_argument('--top', type=int, default=5, help='Kích thước top-k để so sánh')
        parser.add_argument('--seed', type=int, default=42)
        parser.add_argument('--out', default=str(Path('ai') / 'reports'))

    def handle(self, *args, **options):
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if options['simulate']:
            features = simulated_features(options['simulate'], options['seed'])
            source = f'{len(features)} Zone giả lập (seed={options["seed"]})'
        else:
            from rescue_operations.models import Zone
            zones = list(Zone.objects.filter(status__in=['ACTIVE', 'STABILIZING']))
            features = [zone_features(zone) for zone in zones]
            source = f'{len(features)} Zone đang hoạt động trong cơ sở dữ liệu'
        if len(features) < 3:
            raise CommandError('Cần ít nhất 3 Zone để so sánh thứ hạng. Dùng --simulate 500 để chạy với Zone giả lập.')

        top = min(options['top'], len(features))
        base = ranking(features, WEIGHTS)
        delta = options['percent'] / 100
        lines = ['# Độ nhạy của điểm ưu tiên Zone theo trọng số', '',
                 f'Tạo lúc {timezone.localtime().strftime("%d/%m/%Y %H:%M")} bằng '
                 '`python manage.py ai_priority_sensitivity`.', '',
                 f'- Dữ liệu: {source}',
                 f'- Mỗi lần đổi một trọng số ±{options["percent"]:g}%, các trọng số khác co giãn để tổng vẫn là 100.',
                 '- Spearman = 1.000 nghĩa là thứ hạng không đổi. '
                 f'Top-{top} giữ nguyên = tỷ lệ Zone trong top-{top} gốc vẫn còn trong top-{top} mới.', '',
                 f'| Trọng số | Giá trị gốc | Spearman (−{options["percent"]:g}%) | Spearman (+{options["percent"]:g}%) | '
                 f'Top-{top} giữ nguyên (−) | Top-{top} giữ nguyên (+) |', '|---|---:|---:|---:|---:|---:|']
        worst = 1.0
        for name in WEIGHTS:
            cells = []
            for factor in (1 - delta, 1 + delta):
                order = ranking(features, perturbed(WEIGHTS, name, factor))
                rho = spearman(base, order)
                worst = min(worst, rho)
                cells.append((rho, len(set(base[:top]) & set(order[:top])) / top))
            lines.append(f'| {LABELS[name]} | {WEIGHTS[name]:g} | {cells[0][0]:.3f} | {cells[1][0]:.3f} | '
                         f'{cells[0][1]:.0%} | {cells[1][1]:.0%} |')
        lines += ['', f'Spearman thấp nhất: {worst:.3f}.']
        markdown = '\n'.join(lines) + '\n'

        out = Path(options['out'])
        if not out.is_absolute():
            out = Path(settings.BASE_DIR) / out
        out.mkdir(parents=True, exist_ok=True)
        (out / 'priority_sensitivity.md').write_text(markdown, encoding='utf-8')
        self.stdout.write(markdown)
        self.stdout.write(f'Đã lưu: {out / "priority_sensitivity.md"}')
