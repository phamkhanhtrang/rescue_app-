"""
Xuất các bài Facebook admin đã duyệt thành dữ liệu thực cho Model A/B.

    python manage.py ai_export_reviewed                # xuất bài đã duyệt
    python manage.py ai_export_reviewed --merge-train  # + tạo Excel sẵn sàng upload lên Colab

Tạo trong ai/reports/:
    real_model_a.xlsx        Train / Validation / Test từ bài thật (nhãn là quyết định của admin)
    real_model_b_draft.xlsx  bản nháp đã đánh dấu sẵn cho Model B, cần người kiểm tra lại
    data_model_a_real.xlsx   (--merge-train) Train = câu tổng hợp + bài thật; Validation/Test toàn bài thật
    data_model_b_real.xlsx   (--merge-train) như trên, chỉ lấy các dòng nháp đã kiểm tra (reviewed=1)

Dùng tiếp:
    Colab: upload data_model_<a|b>_real.xlsx, chọn TRAIN_MODE=new, EVALUATION_DOMAIN=real_vietnamese
    Đo model đang chạy trên tập test thật:
        python manage.py ai_evaluate --task a --excel-a ai/reports/real_model_a.xlsx --name real
"""
import sys
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ai import dataset_export
from ai.models import CrawledArticle
from ai.sos_ml.excel_data import excel_bool, load_excel_data

GUIDE_A = [
    'Dữ liệu THỰC từ các bài Facebook admin đã duyệt (origin=real, reviewed=1).',
    'Train: dùng để huấn luyện. Validation: để notebook chọn checkpoint và ngưỡng. Test: chỉ để chấm điểm cuối.',
    'KHÔNG chép dòng của Validation/Test vào Train.',
    'Một bài luôn nằm ở cùng một tập trong mọi lần xuất (chia theo mã băm group_id).',
    'is_request=1: admin duyệt tạo SOS. is_request=0: admin từ chối và xác nhận không phải yêu cầu cứu trợ.',
]
GUIDE_B = [
    'BẢN NHÁP cho Model B: các cụm admin đã xác nhận được đánh dấu sẵn dạng [NHÃN|cụm từ].',
    'Admin không gắn nhãn đủ mọi cụm trong bài, nên phải đọc lại từng dòng trước khi dùng.',
    'Việc cần làm: bổ sung cụm còn thiếu, sửa cụm sai, xem cột can_kiem_tra, rồi đặt reviewed=1.',
    'Nhãn hợp lệ: LOCATION, PEOPLE_COUNT, VULNERABLE_GROUP, RESOURCE. Không lồng nhãn.',
    'Chạy lại lệnh xuất KHÔNG ghi đè các dòng đã có trong file này; chỉ thêm bài mới.',
    'Xong thì chạy: python manage.py ai_export_reviewed --merge-train để tạo data_model_b_real.xlsx.',
]


class Command(BaseCommand):
    help = 'Xuất bài Facebook admin đã duyệt thành Excel dữ liệu thực cho Model A/B.'

    def add_arguments(self, parser):
        training = Path('ai') / 'training'
        parser.add_argument('--out', default=str(Path('ai') / 'reports'))
        parser.add_argument('--test-percent', type=int, default=25,
                            help='Tỷ lệ %% bài dành làm tập Test thực (mặc định 25)')
        parser.add_argument('--validation-percent', type=int, default=15,
                            help='Tỷ lệ %% bài dành làm tập Validation thực (mặc định 15)')
        parser.add_argument('--merge-train', action='store_true',
                            help='Tạo thêm Excel sẵn sàng cho notebook: Train tổng hợp + thật, Validation/Test thật')
        parser.add_argument('--train-excel-a', default=str(training / 'data_model_a.xlsx'))
        parser.add_argument('--train-excel-b', default=str(training / 'data_model_b.xlsx'))

    def handle(self, *args, **options):
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        test, validation = options['test_percent'], options['validation_percent']
        if test < 0 or validation < 0 or test + validation > 100:
            raise CommandError('--test-percent và --validation-percent phải không âm và có tổng không quá 100.')

        articles = (CrawledArticle.objects.filter(source_platform='FACEBOOK')
                    .exclude(reviewed_analysis={}).order_by('crawled_at'))
        data = dataset_export.build_rows(articles, test, validation)

        out = Path(options['out'])
        if not out.is_absolute():
            out = Path(settings.BASE_DIR) / out
        out.mkdir(parents=True, exist_ok=True)

        skipped = [{'id': i, 'ly_do': reason} for i, reason in data['skipped']]
        path_a, path_b = out / 'real_model_a.xlsx', out / 'real_model_b_draft.xlsx'
        columns_a, columns_b = dataset_export.COLUMNS_A, dataset_export.COLUMNS_B
        dataset_export.write_workbook(path_a, {
            **{name: (columns_a, data['a'][name]) for name in dataset_export.SPLITS},
            'Bo_qua': (['id', 'ly_do'], skipped)}, GUIDE_A)
        # Không ghi đè công gắn nhãn tay của lần trước.
        drafts = dataset_export.keep_checked_drafts(path_b, data['b'])
        dataset_export.write_workbook(path_b, {
            'Nhap_' + name: (columns_b, drafts[name]) for name in dataset_export.SPLITS}, GUIDE_B)

        counts = {name: len(data['a'][name]) for name in dataset_export.SPLITS}
        total = sum(counts.values())
        positives = sum(row['is_request'] for rows in data['a'].values() for row in rows)
        checked = {name: [row for row in drafts[name] if self._reviewed(row)] for name in dataset_export.SPLITS}
        self.stdout.write(f'Bài đã có nhãn của admin: {total} '
                          f'({positives} là yêu cầu cứu trợ, {total - positives} không phải)')
        self.stdout.write(f'  Train: {counts["Train"]} | Validation: {counts["Validation"]} | '
                          f'Test: {counts["Test"]} | Bỏ qua: {len(skipped)}')
        self.stdout.write(f'Model A: {path_a}')
        self.stdout.write(f'Model B (bản nháp): {path_b} — đã kiểm tra '
                          f'{sum(len(rows) for rows in checked.values())}/{total} dòng')

        if options['merge_train']:
            self._merge('a', options['train_excel_a'], data['a'], out / 'data_model_a_real.xlsx')
            self._merge('b', options['train_excel_b'], checked, out / 'data_model_b_real.xlsx')

        if counts['Test'] < 100:
            self.stdout.write(f'Lưu ý: tập Test thực mới có {counts["Test"]} bài. Nên có ít nhất vài trăm bài tổng cộng, '
                              'đủ cả hai lớp và bốn nhóm nhu cầu, thì điểm F1 mới đáng tin.')
        if not positives or positives == total:
            self.stdout.write('Lưu ý: dữ liệu mới chỉ có một lớp. Khi từ chối bài không phải lời cầu cứu, '
                              'hãy xác nhận "Không phải yêu cầu cứu trợ" để có mẫu âm tính.')

    @staticmethod
    def _reviewed(row) -> bool:
        try:
            return excel_bool(row.get('reviewed'))
        except ValueError:
            return False

    def _merge(self, task, source, real, output):
        """Tạo Excel cho notebook rồi kiểm tra bằng chính bộ đọc của notebook."""
        if not any(real[name] for name in dataset_export.SPLITS):
            self.stdout.write(f'Model {task.upper()}: chưa có dòng thật nào'
                              + (' đã kiểm tra (reviewed=1) trong bản nháp' if task == 'b' else '') + '; bỏ qua.')
            return
        try:
            counts = dataset_export.build_real_workbook(source, real, output)
        except (OSError, ValueError, KeyError) as exc:
            raise CommandError(f'Không tạo được Excel cho Model {task.upper()}: {exc}')
        self.stdout.write(f'Model {task.upper()} cho notebook: {output} '
                          f'(thêm {counts["Train"]} dòng Train thật, Validation {counts["Validation"]}, Test {counts["Test"]})')
        try:
            load_excel_data(output, task, 'real_vietnamese')
            self.stdout.write('  Hợp lệ: upload file này lên Colab với TRAIN_MODE=new, EVALUATION_DOMAIN=real_vietnamese.')
        except ValueError as exc:
            self.stdout.write(f'  CHƯA train được với file này: {exc}')
            self.stdout.write('  Cần duyệt/gắn nhãn thêm bài để mỗi tập Validation và Test có đủ các loại nhãn.')
