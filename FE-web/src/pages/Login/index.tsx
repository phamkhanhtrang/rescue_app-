import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, clearSession } from "../../services/api";
import { ShieldCheck, Eye, EyeOff, Lock, User, AlertCircle } from "lucide-react";

export default function HomeLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    new URLSearchParams(window.location.search).has("expired")
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : ""
  );
  const [loading, setLoading] = useState(false);

  // Kiểm tra nếu đã có token thì chuyển hướng luôn
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    if (token && !new URLSearchParams(window.location.search).has("expired")) {
      if (role === "ADMIN") {
        navigate("/dashboard");
      } else {
        clearSession();
      }
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API_BASE_URL}/accounts/login/`, {
        login_input: loginInput,
        password: password,
      });

      if (response.data.user.role !== "ADMIN") {
        clearSession();
        setError("Cổng thông tin này chỉ dành cho tài khoản Quản trị viên (ADMIN).");
        return;
      }

      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);
      localStorage.setItem("user_role", response.data.user.role);
      localStorage.setItem("user_name", response.data.user.full_name);
      localStorage.setItem("user_username", response.data.user.username);
      localStorage.setItem("user_email", response.data.user.email);

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error("Chi tiết lỗi đăng nhập:", err);
      if (err.response) {
        setError(err.response.data?.error || `Lỗi máy chủ (${err.response.status}). Vui lòng thử lại.`);
      } else if (err.request) {
        setError("Không thể kết nối đến máy chủ API. Vui lòng kiểm tra mạng.");
      } else {
        setError(err.message || "Đã xảy ra lỗi không xác định.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="w-full max-w-sm">
        {/* Main Card */}
        <div className="card p-8 space-y-6 shadow-sm">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-brand rounded-btn flex items-center justify-center mx-auto shadow-xs">
              <span className="text-white text-2xl font-bold">🆘</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">CỨU NẠN KHẨN CẤP</h1>
              <p className="text-xs text-slate-500 font-medium">Hệ Thống Chỉ Huy & Điều Phối Cứu Hộ 24/7</p>
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-btn flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tài khoản hoặc Email
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  required
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="input-field w-full pl-10 text-sm"
                  placeholder="admin@rescue.vn"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Mật khẩu</label>
                <button
                  type="button"
                  onClick={() => navigate("/password")}
                  className="text-xs text-accent hover:underline font-medium"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pl-10 pr-10 text-sm"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Xác thực an toàn & phân quyền Admin</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <span>Đăng nhập hệ thống</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6">
          © 2026 Hệ Thống Cứu Nạn Khẩn Cấp · Trung Tâm Điều Phối Cứu Hộ
        </p>
      </div>
    </div>
  );
}
