import time
from django.core.management.base import BaseCommand, CommandError
from communications.push import process_push


class Command(BaseCommand):
    help = 'Send queued alert pushes and check Expo receipts. Use --watch for a persistent worker.'

    def add_arguments(self, parser):
        parser.add_argument('--watch', action='store_true')

    def handle(self, *args, **options):
        try:
            while True:
                if not process_push():
                    raise CommandError('Push đang tắt. Cấu hình EXPO_PUSH_ENABLED=True trước khi chạy worker.')
                if not options['watch']:
                    break
                time.sleep(10)
        except KeyboardInterrupt:
            self.stdout.write('Đã dừng worker push.')
