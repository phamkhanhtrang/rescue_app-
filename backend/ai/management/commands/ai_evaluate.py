"""
Đo Model A/B trên một tập test và so sánh với các phương pháp đơn giản hơn.

Ví dụ:
    # Tập test tổng hợp đi kèm repo
    python manage.py ai_evaluate

    # Tập test thực xuất từ các bài admin đã duyệt (xem ai_export_reviewed)
    python manage.py ai_evaluate --task a --excel-a ai/reports/real_model_a.xlsx --name real

Kết quả ghi vào ai/reports/eval_<name>.md và .json.
"""
import json
import sys
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from ai import evaluation


class Command(BaseCommand):
    help = 'Đánh giá Model A/B + guardrails và so sánh với baseline trên một tập test Excel.'

    def add_arguments(self, parser):
        training = Path('ai') / 'training'
        parser.add_argument('--task', choices=['a', 'b', 'both'], default='both')
        parser.add_argument('--excel-a', default=str(training / 'data_model_a.xlsx'), help='Excel chứa tập test cho Model A')
        parser.add_argument('--excel-b', default=str(training / 'data_model_b.xlsx'), help='Excel chứa tập test cho Model B')
        parser.add_argument('--sheet', default='Test', help='Tên sheet dùng làm tập test')
        parser.add_argument('--train-excel-a', default=str(training / 'data_model_a.xlsx'),
                            help='Excel có sheet Train để huấn luyện baseline TF-IDF')
        parser.add_argument('--train-sheet', default='Train')
        parser.add_argument('--with-v1', action='store_true', help='Thêm dòng PhoBERT v1 (6 nhãn) vào bảng so sánh')
        parser.add_argument('--limit', type=int, default=0, help='Chỉ lấy N câu đầu (để chạy thử nhanh)')
        parser.add_argument('--out', default=str(Path('ai') / 'reports'))
        parser.add_argument('--name', default='synthetic', help='Hậu tố tên file báo cáo')

    def handle(self, *args, **options):
        if hasattr(sys.stdout, 'reconfigure'):   # Console Windows mặc định không in được tiếng Việt
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        tasks = ['a', 'b'] if options['task'] == 'both' else [options['task']]

        predictor = None
        try:
            from ai.sos_service import get_predictor
            predictor = get_predictor('both' if len(tasks) == 2 else tasks[0])
        except Exception as exc:
            self.stderr.write(f'Không nạp được model ({exc}); chỉ chạy các baseline.')

        def progress(done, total):
            if done % 20 == 0 or done == total:
                self.stderr.write(f'  {done}/{total} câu', ending='\r' if done != total else '\n')

        sections, payload = [], {'created_at': timezone.now().isoformat(), 'reports': []}
        for task in tasks:
            path = options['excel_a'] if task == 'a' else options['excel_b']
            try:
                rows = evaluation.read_rows(path, options['sheet'], task)
            except (ValueError, OSError) as exc:
                raise CommandError(str(exc))
            if options['limit']:
                rows = rows[:options['limit']]
            if not rows:
                raise CommandError(f'{path} [{options["sheet"]}] không có dòng nào.')
            self.stderr.write(f'Đang đánh giá bài toán {task.upper()} trên {len(rows)} câu…')
            if task == 'a':
                try:
                    train = evaluation.read_rows(options['train_excel_a'], options['train_sheet'], 'a')
                except (ValueError, OSError) as exc:
                    self.stderr.write(f'Bỏ qua baseline TF-IDF: {exc}')
                    train = []
                report = evaluation.evaluate_a(rows, train, predictor, options['with_v1'], progress)
            else:
                report = evaluation.evaluate_b(rows, predictor, progress)
            source = f'{path} [{options["sheet"]}]'
            report['source'] = source
            report['origins'] = evaluation.origin_summary(rows)
            sections.append(evaluation.to_markdown(report, source, rows))
            payload['reports'].append(report)

        header = (f'# Kết quả đánh giá luồng NLP ({options["name"]})\n\n'
                  f'Tạo lúc {timezone.localtime().strftime("%d/%m/%Y %H:%M")} bằng `python manage.py ai_evaluate`.\n\n')
        markdown = header + '\n'.join(sections)

        out = Path(options['out'])
        if not out.is_absolute():
            out = Path(settings.BASE_DIR) / out
        out.mkdir(parents=True, exist_ok=True)
        (out / f'eval_{options["name"]}.md').write_text(markdown, encoding='utf-8')
        (out / f'eval_{options["name"]}.json').write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

        self.stdout.write(markdown)
        self.stdout.write(f'Đã lưu: {out / ("eval_" + options["name"] + ".md")}')
