# Guardian Pulse - Hệ Thống Điều Phối Cứu Hộ Thiên Tai (DACN3)

Guardian Pulse là hệ thống tích hợp hỗ trợ điều phối cứu hộ và quản lý sự cố thiên tai, bao gồm:
- **Backend API & AI Engine**: Quản lý dữ liệu, phân tích NLP tiếng Việt với PhoBERT, phân cụm SOS và đề xuất đội cứu hộ.
- **Frontend Web Dashboard**: Giao diện quản trị, bản đồ theo dõi thời gian thực, duyệt tin và phân phối nhiệm vụ.
- **Mobile App (React Native / Expo)**: Ứng dụng di động cho Người dân (gửi SOS, xem tin, bản đồ an toàn) và Đội cứu hộ (nhận nhiệm vụ, cập nhật trạng thái).

---

## 📁 Cấu Trúc Dự Án (Project Structure)

```text
rescue_app/
├── docs/                    # Toàn bộ tài liệu chi tiết (flows, ai, roadmap, database, mobile)
│   ├── ai/                  # Báo cáo và tích hợp mô hình PhoBERT
│   ├── database/            # Thiết kế CSDL Web & Mobile
│   ├── flows/               # Luồng tài khoản, cảnh báo, tổng hợp luồng hệ thống
│   ├── mobile/              # Sơ đồ điều hướng màn hình và yêu cầu API
│   └── roadmap/             # Tính năng và kế hoạch nâng cấp dài hạn
├── backend/                 # Máy chủ Django REST Framework & AI Pipeline
│   ├── sentinel/            # Cấu hình dự án Django chính
│   ├── accounts/            # Quản lý người dùng, phân quyền Citizen & Rescuer
│   ├── ai/                  # Mô hình NLP, PhoBERT, Crawlers RSS/GDACS
│   ├── communications/      # Cảnh báo, thông báo đẩy (Push Notifications/FCM)
│   ├── reporting/           # Báo cáo thiệt hại, nhiệm vụ cứu hộ
│   ├── rescue_operations/   # Quản lý tín hiệu SOS, đội cứu hộ, vùng cứu hộ
│   ├── tracking/            # Định vị GPS thời gian thực
│   └── scripts/             # Kịch bản chạy crawler và debug thủ công
├── FE-app/                  # Ứng dụng di động React Native (Expo)
└── FE-web/                  # Bảng điều khiển Web React 19 + TypeScript + Vite
```

> 📖 **Xem chi tiết tài liệu tại:** [Thư mục docs/](docs/README.md)

---

## 🛠 Công Nghệ Sử Dụng

- **Backend:** Python 3.10+, Django, Django REST Framework, PostgreSQL / Supabase, PyTorch & Transformers (PhoBERT).
- **Frontend Web:** React 19, TypeScript, Vite, Tailwind CSS, Leaflet / React-Leaflet.
- **Mobile App:** React Native, Expo 54+, React Navigation, AsyncStorage, Expo Location/Notifications.
- **Xác Thực:** JWT (SimpleJWT) với hỗ trợ thu hồi token phiên (RevokedSession).

---

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Khởi chạy Backend

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### 2. Khởi chạy Frontend Web

```bash
cd FE-web
npm install
npm run dev
```

### 3. Khởi chạy Mobile App

```bash
cd FE-app
npm install
npx expo start
```
