# Guardian Pulse - Hệ thống điều phối cứu hộ (DACN3)

Guardian Pulse là một hệ thống hỗ trợ điều phối cứu hộ và quản lý thiên tai, bao gồm hệ thống Backend quản lý dữ liệu, Dashboard Web dành cho Admin và Ứng dụng di động dành cho người dân & đội cứu hộ.

---

## 🛠 Công nghệ sử dụng

- **Backend:** Django Framework, Django REST Framework (DRF), PostgreSQL (Supabase).
- **Frontend Web:** React (Vite), Tailwind CSS, Axios.
- **Mobile (FE-app):** React Native (Expo).
- **Xác thực:** JWT (SimpleJWT).

---

## 📂 Cấu trúc thư mục

- `/backend`: Mã nguồn server Django.
- `/FE-web`: Mã nguồn giao diện quản trị (Web Dashboard).
- `/FE-app`: Mã nguồn ứng dụng di động (Mobile App).

---

## 🚀 Hướng dẫn cài đặt

### 1. Cài đặt Backend
Di chuyển vào thư mục backend:
```bash
cd backend
```

**Khởi tạo môi trường ảo (Windows):**
```bash
python -m venv venv
.\venv\Scripts\activate
```

**Cài đặt các thư viện cần thiết:**
```bash
pip install -r requirements.txt
```

**Cấu hình biến môi trường:**
Tạo file `.env` trong thư mục `backend/` với nội dung sau (thay đổi thông tin phù hợp):
```env
DB_USER=your_db_user
PASS_DB=your_db_password
IP_ADDRESS=your_db_host (e.g. db.supabase.co)
DB_PORT=5432
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
```

**Chạy Migrations:**
```bash
python manage.py migrate
```

**Khởi động Server:**
```bash
python manage.py runserver 0.0.0.0:8000
```

---

### 2. Cài đặt Frontend Web
Di chuyển vào thư mục FE-web:
```bash
cd FE-web
```

**Cài đặt dependencies:**
```bash
npm install
```

**Cấu hình API URL:**
Kiểm tra file `src/services/api.ts` và cập nhật `API_BASE_URL` trỏ về địa chỉ IP của Backend.

**Chạy ứng dụng:**
```bash
npm run dev
```

---

### 3. Cài đặt Mobile App (FE-app)
Di chuyển vào thư mục FE-app:
```bash
cd FE-app
```

**Cài đặt dependencies:**
```bash
npm install
```

**Chạy ứng dụng với Expo:**
```bash
npx expo start
```

---

## 📝 Lưu ý quan trọng
- Luôn đảm bảo Backend đang chạy trước khi khởi động Frontend.
- Kiểm tra địa chỉ IP trong các file cấu hình API để đảm bảo kết nối giữa các thành phần (đặc biệt khi chạy trên điện thoại thật).
- File `.env` đã được đưa vào `.gitignore` để bảo mật, hãy tự tạo file này ở máy cục bộ.

---

