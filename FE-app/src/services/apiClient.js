/**
 * src/services/apiClient.js
 * Wrapper for fetch API with common config, headers, and error handling.
 */

// Define Base URL for API (Replace with your actual backend IP/URL)
// For Android emulator: use 'http://10.0.2.2:8000'
// For iOS simulator: use 'http://127.0.0.1:8000'
// For physical device: use your computer's local IP address e.g. 'http://192.168.x.x:8000'
export const BASE_URL = 'http://192.168.1.76:8000';

let authToken = null;

// Hàm lưu token vào biến tạm
export const setAuthToken = (token) => {
  authToken = token;
};

// Hàm lấy token hiện tại
export const getAuthToken = () => {
  return authToken;
};

export const apiClient = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
   'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true', // THÊM DÒNG NÀY ĐỂ BỎ QUA TRANG CẢNH BÁO NGROK
  };

  // Tự động đính kèm token vào header nếu đã đăng nhập
  if (authToken) {
    // Điều chỉnh chữ "Bearer" hoặc "Token" tùy thuộc vào cấu hình của Django REST Framework
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  // Nếu là FormData (upload file), ta phải để Fetch tự động set Content-Type kèm boundary
  if (options.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
    if (options.headers) {
      delete options.headers['Content-Type'];
    }
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // Parse dữ liệu an toàn
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = text;
    }

    // Xử lý khi API trả về lỗi
    if (!response.ok) {
      console.log("--- API ERROR DETAIL ---");
      console.log("Status:", response.status);
      console.log("Response Data:", data);
      const error = new Error(data.message || data.detail || `API Error ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[API Error] ${options.method || 'GET'} ${url}`, error);
    throw error;
  }
};
