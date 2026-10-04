# Backend Scripts & Debug Tools

Thư mục này chứa các kịch bản chạy thủ công (manual scripts) và công cụ debug cho hệ thống backend:

- **`debug_fb_*.py`**: Các script kiểm tra và phân tích DOM Facebook, đếm bài đăng, trích xuất text phục vụ gỡ lỗi crawler Facebook.
- **`manual_crawl_fb.py`**: Chạy crawler Facebook thủ công độc lập.
- **`manual_playwright_crawler.py`**: Chạy crawler dùng Playwright độc lập.
- **`manual_full_pipeline.py`**: Chạy thử nghiệm toàn bộ luồng pipeline từ crawl đến xử lý AI mà không cần kích hoạt qua Celery/Cron.
- **`fb_page_dump.html` & `fb_group_debug.png`**: Dữ liệu snapshot và ảnh chụp màn hình khi debug crawler Facebook.
