import axios from 'axios';

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.error || error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'Máy chủ phản hồi quá lâu. Hãy thử lại.';
    if (!error.response) return 'Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ API.';
    if (error.response.status >= 500) return 'Máy chủ đang gặp lỗi. Hãy thử lại sau.';
    if (error.response.status === 403) return 'Tài khoản không có quyền xem dữ liệu này.';
  }
  return error instanceof Error && error.message ? error.message : 'Không tải được dữ liệu. Hãy thử lại.';
}
