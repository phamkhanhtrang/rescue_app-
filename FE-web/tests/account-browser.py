"""Browser regression against the local Vite server; all API calls use fixtures."""
import json
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect


def main():
    users = [dict(id='test-team', full_name='Đội kiểm thử', phone='0901234567', email='team@example.com',
                  role='RESCUER', is_active=False, account_status='PENDING', account_reason='',
                  address='Đà Nẵng', rescuer_profile={'unit_name': 'Đơn vị thử', 'team_code': 'TEAM-01',
                  'specialty_display': 'Y tế'}, history=[])]
    calls = []

    def api(route):
        req = route.request
        parsed = urlparse(req.url)
        path = parsed.path
        data = req.post_data_json if req.post_data else {}
        calls.append((req.method, path, data))
        if req.method == 'OPTIONS':
            route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'})
            return
        result = {}
        if path == '/accounts/profiles/':
            query = parse_qs(parsed.query)
            rows = [u for u in users if (not query.get('status') or u['account_status'] == query['status'][0])
                    and (not query.get('role') or u['role'] == query['role'][0])
                    and (not query.get('search') or query['search'][0].lower() in (u['full_name'] + u['phone'] + u['email']).lower())]
            result = {'results': rows, 'count': len(rows)}
        elif path == '/accounts/profiles/test-team/':
            if req.method == 'PUT':
                users[0].update(data)
            result = users[0]
        elif path.endswith('/reject/') or path.endswith('/activate/') or path.endswith('/ban/'):
            action = path.rstrip('/').split('/')[-1]
            users[0]['account_status'] = {'reject': 'REJECTED', 'activate': 'ACTIVE', 'ban': 'BANNED'}[action]
            users[0]['account_reason'] = data.get('reason', '')
            result = {'message': 'Đã xử lý tài khoản.'}
        elif path == '/accounts/password/reset/':
            result = {'message': 'Kiểm tra hộp thư.'}
        elif path == '/accounts/password/reset/confirm/':
            result = {'message': 'Đã đặt lại mật khẩu.'}
        else:
            raise AssertionError('Unexpected API: ' + path)
        route.fulfill(status=200, content_type='application/json', body=json.dumps(result), headers={'Access-Control-Allow-Origin': '*'})

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 900})
        context.add_init_script("localStorage.setItem('access_token', 'fixture'); localStorage.setItem('refresh_token', 'fixture-refresh'); localStorage.setItem('user_role', 'ADMIN');")
        context.route('http://127.0.0.1:8000/**', api)
        context.route('http://127.0.0.1:4179/accounts/**', api)
        context.route('https://**', lambda route: route.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:4179/account')
        page.get_by_role('button', name='Xem chi tiết').click()
        dialog = page.get_by_role('dialog')
        expect(dialog.get_by_text('TEAM-01', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Từ chối', exact=True).click()
        dialog.get_by_role('button', name='Xác nhận', exact=True).click()
        expect(dialog.get_by_role('alert')).to_have_text('Vui lòng nhập lý do.')
        dialog.get_by_role('textbox', name='Lý do xử lý').fill('Thiếu thông tin xác minh')
        dialog.get_by_role('button', name='Xác nhận', exact=True).click()
        expect(dialog.get_by_text('Bị từ chối', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Duyệt hồ sơ', exact=True).click()
        dialog.get_by_role('button', name='Xác nhận', exact=True).click()
        expect(dialog.get_by_text('Đang hoạt động', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Khóa tài khoản', exact=True).click()
        dialog.get_by_role('textbox', name='Lý do xử lý').fill('Khóa thử')
        dialog.get_by_role('button', name='Xác nhận', exact=True).click()
        expect(dialog.get_by_role('button', name='Mở khóa', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Đóng ✕').click()
        page.get_by_role('combobox', name='Trạng thái', exact=True).select_option('PENDING')
        expect(page.get_by_text('Không có tài khoản phù hợp.')).to_be_visible()
        page.get_by_role('combobox', name='Trạng thái', exact=True).select_option('BANNED')
        page.get_by_role('button', name='Xem chi tiết').click()
        dialog.get_by_text('Sửa thông tin liên hệ', exact=True).click()
        dialog.get_by_label('Email', exact=True).fill('updated@example.com')
        dialog.get_by_role('button', name='Lưu thông tin liên hệ').click()
        expect(dialog.get_by_text('updated@example.com', exact=True)).to_be_visible()
        page.goto('http://127.0.0.1:4179/password')
        page.get_by_label('Email khôi phục', exact=True).fill('team@example.com')
        page.get_by_role('button', name='Gửi mã khôi phục').click()
        expect(page.get_by_role('status')).to_have_text('Kiểm tra hộp thư.')
        page.get_by_label('Mã khôi phục (dán toàn bộ mã)', exact=True).fill('fixture-code')
        page.get_by_label('Mật khẩu mới (ít nhất 8 ký tự)', exact=True).fill('StrongPassword!42')
        page.get_by_label('Nhập lại mật khẩu mới', exact=True).fill('StrongPassword!42')
        page.get_by_role('button', name='Đặt lại mật khẩu', exact=True).click()
        expect(page.get_by_role('button', name='Về đăng nhập')).to_be_visible()
        assert not errors, errors
        assert any(path.endswith('/reject/') and data.get('reason') for _, path, data in calls)
        browser.close()
        print('PASS: detail, required reason, reject, activate, ban, filtering, contact edit, password reset; no page errors')


if __name__ == '__main__':
    main()
