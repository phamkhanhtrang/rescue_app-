import React, {useState} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function HomeLogin() {
  const [showPassword, setShowPassword] = React.useState(false);
  const navigate = useNavigate();

  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Kiểm tra nếu đã có token thì chuyển hướng luôn
  React.useEffect(() => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    if (token) {
      if (role === "ADMIN") {
        navigate("/dashboard");
      } else {
        navigate("/home");
      }
    }
  }, [navigate]);
  // 4. Hàm xử lý gửi dữ liệu cho Django
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Reset lỗi cũ

    try {
      const response = await axios.post("http://192.168.1.100:8000/accounts/login/", {
        login_input: loginInput,
        password: password,
      });

      // Nếu thành công:
      console.log("Thành công:", response.data);
      
      // Lưu Token vào LocalStorage để dùng cho các trang sau
      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("user_role", response.data.user.role);
      localStorage.setItem("user_name", response.data.user.full_name);
      localStorage.setItem("user_username", response.data.user.username);
      localStorage.setItem("user_email", response.data.user.email);

      // Chuyển hướng dựa trên Role
      if (response.data.user.role === "ADMIN") {
        navigate("/dashboard");
      } else {
        navigate("/home"); 
      }
    } catch (err: any) {
      // Nếu lỗi (Sai pass, thiếu trường...)
      console.error("Chi tiết lỗi:", err);
      
      if (err.response) {
        // Backend trả về response với status error
        setError(err.response.data?.error || `Lỗi từ server: ${err.response.status}`);
      } else if (err.request) {
        // Request được gửi nhưng không nhận được response
        setError("Không thể kết nối tới server. Kiểm tra xem Django server đã chạy chưa?");
      } else {
        // Lỗi khác
        setError(err.message || "Đã có lỗi xảy ra, vui lòng thử lại.");
      }
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm flex flex-col items-center">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-red-600 rounded-lg p-3 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="white"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 17v.01M12 13a4 4 0 100-8 4 4 0 000 8zm0 0v4m0 0h.01"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">SENTINEL</h1>
          <span className="text-xs tracking-widest text-blue-700 font-semibold">
            TRUNG TÂM CỨU HỘ
          </span>
        </div>
        {error && (
          <div className="w-full p-2 mb-4 text-xs text-white bg-red-500 rounded-md text-center">
            {error}
          </div>
        )}
        <form
          className="w-full flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              EMAIL OR PHONE
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 12a4 4 0 01-8 0m8 0V8a4 4 0 00-8 0v4m8 0v4a4 4 0 01-8 0v-4"
                  />
                </svg>
              </span>
              <input
                type="text"
                required value={loginInput} 
                onChange={(e) => setLoginInput(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-md border border-gray-300 bg-gray-100 text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="administrator@sentinel.hq"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              PASSWORD OR OTP
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m0-6v2m-6 4V7a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z"
                  />
                </svg>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-md border border-gray-300 bg-gray-100 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={0}
                role="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-6 0a6 6 0 1112 0 6 6 0 01-12 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 3l18 18M9.88 9.88A3 3 0 0112 9c1.66 0 3 1.34 3 3 0 .39-.07.76-.18 1.11M6.1 6.1A9.77 9.77 0 003 12c2.28 4 7 7 9 7 1.13 0 2.22-.19 3.24-.54M17.9 17.9A9.77 9.77 0 0021 12c-1.11-1.95-3.07-3.87-5.1-5.1"
                    />
                  </svg>
                )}
              </span>
            </div>
            <div className="flex justify-end mt-1">
              <a
                href="#"
                className="text-xs text-blue-600 font-semibold hover:underline"
              >
                Quên mật khẩu?
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-xs text-gray-500">
              QUANTUM-SECURE LOGIN ENABLED
            </span>
          </div>
          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-md shadow transition-all flex items-center justify-center gap-2"
          >
            Đăng nhập
          </button>
        </form>
        <div className="mt-6">
          <button
            type="button"
            className="flex items-center gap-2 text-gray-500 text-xs hover:underline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Đăng nhập với Google
          </button>
        </div>
      </div>
    </div>
  );
}
