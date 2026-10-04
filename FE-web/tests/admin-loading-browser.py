"""Run against the local Vite preview on port 4179; API responses are fixtures."""
import json
from playwright.sync_api import expect, sync_playwright


def main():
    state = {'mode': 'partial'}

    def api(route):
        path = route.request.url.split('?', 1)[0]
        if state['mode'] == 'all_fail' or (state['mode'] == 'partial' and path.endswith('/communications/alerts/')):
            route.fulfill(status=500, content_type='application/json', body='{"error":"Lỗi máy chủ thử nghiệm"}')
            return
        if path.endswith('/rescue_operations/zones/'):
            rows = [{'id': 'zone-fixture', 'name': 'Vùng kiểm thử', 'status': 'ACTIVE',
                     'severity': 'HIGH', 'rescuers_needed': 1}]
        elif path.endswith('/rescue_operations/dashboard/'):
            route.fulfill(status=200, content_type='application/json', body=json.dumps({
                'summary': {'total_zones': 1, 'total_sos': 0}, 'sos_by_status': {},
                'zones_by_status': {'ACTIVE': 1}, 'zones_by_severity': {'HIGH': 1}}))
            return
        elif path.endswith('/accounts/profiles/'):
            rows = []
        elif path.endswith('/rescue_operations/sos/'):
            rows = []
        elif path.endswith('/reporting/missions/'):
            rows = []
        elif path.endswith('/reporting/support/'):
            rows = []
        elif path.endswith('/communications/alerts/'):
            rows = []
        else:
            raise AssertionError(f'Unexpected request: {path}')
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'results': rows}))

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context()
        context.add_init_script("localStorage.setItem('access_token', 'fixture'); localStorage.setItem('user_role', 'ADMIN');")
        context.route('**/rescue_operations/**', api)
        context.route('**/accounts/profiles/**', api)
        context.route('**/reporting/missions/**', api)
        context.route('**/reporting/support/**', api)
        context.route('**/communications/alerts/**', api)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:4179/dashboard')
        expect(page.get_by_text('Vùng kiểm thử')).to_be_visible()
        expect(page.get_by_role('alert').get_by_text('Không cập nhật được cảnh báo', exact=False)).to_be_visible()
        state['mode'] = 'all_fail'
        page.get_by_role('button', name='Thử lại').click()
        expect(page.get_by_role('alert').get_by_text('Không cập nhật được vùng', exact=False)).to_be_visible()
        expect(page.get_by_text('Vùng kiểm thử')).to_be_visible()
        state['mode'] = 'ok'
        page.get_by_role('button', name='Thử lại').click()
        expect(page.get_by_role('alert')).to_have_count(0)
        state['mode'] = 'all_fail'
        page.goto('http://127.0.0.1:4179/map')
        expect(page.get_by_role('alert').get_by_text('Không cập nhật được vùng', exact=False)).to_be_visible()
        page.goto('http://127.0.0.1:4179/rescue-zone-management')
        expect(page.get_by_role('alert').get_by_text('Không cập nhật được vùng', exact=False)).to_be_visible()
        assert not errors, errors
        browser.close()
        print('PASS: dashboard partial/total failure and recovery; map and zone failures stay visible')


if __name__ == '__main__':
    main()
