import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../services/api";
import { contentParts } from "../../utils/contentLinks";
import {
  Bell,
  AlertTriangle,
  Send,
  RefreshCw,
  Trash2,
  Power,
  Layers,
  Clock,
  Radio,
  X,
  Smartphone,
  ExternalLink,
} from "lucide-react";

export default function NotificationBroadcastPage() {
  const [searchParams] = useSearchParams();
  const articleId = searchParams.get("article");
  const focusAlertId = searchParams.get("alert");
  const [sourceArticle, setSourceArticle] = useState<any>(null);
  const [sourceError, setSourceError] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoneError, setZoneError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const alertsRequest = useRef(0);
  const mounted = useRef(false);

  // Danh sách các cảnh báo / thông báo đã phát
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [alertFilter, setAlertFilter] = useState<"ALL" | "EMERGENCY" | "BROADCAST" | "ACTIVE" | "INACTIVE">("ALL");

  const [formData, setFormData] = useState<{
    msgType: "EMERGENCY" | "BROADCAST";
    scope: "system" | "zone";
    audience: "ALL" | "CITIZEN" | "RESCUER";
    expiresAt: string;
    selectedId: string;
    title: string;
    message: string;
  }>({
    msgType: "EMERGENCY",
    scope: "system",
    audience: "ALL",
    expiresAt: "",
    selectedId: "",
    title: "",
    message: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const zoneRes = await api.zones.getAll();
      if (!mounted.current) return;
      setZones(zoneRes.data.results || []);
      setZoneError("");
    } catch (err) {
      console.error(err);
      if (mounted.current) setZoneError("Không tải được khu vực. Vui lòng thử lại.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    const requestId = ++alertsRequest.current;
    try {
      setAlertsLoading(true);
      const res = await api.communications.getAll({ tab: "all" });
      if (!mounted.current || requestId !== alertsRequest.current) return;
      setAlertsList(res.data.results || []);
      setError("");
    } catch (err) {
      console.error("Lỗi lấy danh sách cảnh báo:", err);
      if (mounted.current && requestId === alertsRequest.current)
        setError("Không tải được danh sách bản tin. Vui lòng làm mới.");
    } finally {
      if (mounted.current && requestId === alertsRequest.current) setAlertsLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    fetchData();
    fetchAlerts();
    const timer = window.setInterval(() => {
      if (!document.hidden) fetchAlerts();
    }, 30000);
    return () => {
      mounted.current = false;
      ++alertsRequest.current;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setSourceArticle(null);
    setSourceError("");
    if (!articleId) {
      setSourceLoading(false);
      return;
    }
    setSourceLoading(true);
    api.ai
      .getCrawledArticle(articleId)
      .then((res) => {
        if (!active) return;
        if (res.data.source_platform === "FACEBOOK" || !res.data.is_published) {
          setSourceError("Bài báo chưa xuất bản hoặc đã được gỡ. Hãy kiểm tra ở AI Tìm tin.");
          return;
        }
        setSourceArticle(res.data);
        const sourceText = (res.data.raw_content || "").trim();
        const sourceUrl = res.data.source_url ? `\n\nNguồn bài viết: ${res.data.source_url}` : "";
        setFormData((prev) => ({
          ...prev,
          title: res.data.raw_title?.slice(0, 255) || "",
          message: `${sourceText.slice(0, 10000)}${sourceUrl}`,
          scope: "zone",
          selectedId: "",
        }));
      })
      .catch(() => {
        if (active) setSourceError("Không tải được bài nguồn. Hãy mở lại từ AI Tìm tin.");
      })
      .finally(() => {
        if (active) setSourceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  useEffect(() => {
    if (focusAlertId && alertsList.length)
      document.getElementById(`alert-${focusAlertId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusAlertId, alertsList.length]);

  const handleSend = async () => {
    if (submitting || sourceLoading || (articleId && (!sourceArticle || sourceArticle.linked_alert_id))) return;
    if (!formData.title.trim() || !formData.message.trim()) {
      alert("Vui lòng nhập đầy đủ tiêu đề và nội dung!");
      return;
    }
    if (formData.scope === "zone" && !formData.selectedId) {
      alert("Vui lòng chọn khu vực nhận tin!");
      return;
    }

    if (formData.expiresAt && new Date(formData.expiresAt).getTime() <= Date.now()) {
      alert("Thời điểm hết hạn phải ở tương lai.");
      return;
    }
    setSubmitting(true);
    try {
      const isEmergency = formData.msgType === "EMERGENCY";
      const payload = {
        zone: formData.scope === "zone" && formData.selectedId ? formData.selectedId : null,
        title: formData.title.trim(),
        description: formData.message.trim(),
        severity: isEmergency ? "CRITICAL" : "NORMAL",
        message_type: formData.msgType,
        audience: formData.audience,
        expires_at: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        source: "SYSTEM",
        is_active: true,
      };

      const result = articleId
        ? await api.ai.createNewsAlert(articleId, payload)
        : await api.communications.createAlert(payload);
      if (articleId) setSourceArticle((prev: any) => ({ ...prev, linked_alert_id: result.data.id }));
      alert("Đã đăng bản tin. Kết quả gửi push và lượt đọc được cập nhật trong danh sách bên dưới.");
      setFormData((prev) => ({ ...prev, title: "", message: "" }));
      fetchAlerts();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data ? JSON.stringify(err.response.data) : "Gửi thất bại, vui lòng thử lại!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (alertItem: any) => {
    if (busyId) return;
    const nextStatus = !alertItem.is_active;
    const confirmMsg = nextStatus
      ? `Kích hoạt lại cảnh báo "${alertItem.title}"?`
      : `Thu hồi / Tắt cảnh báo "${alertItem.title}"?`;
    if (!window.confirm(confirmMsg)) return;
    setBusyId(alertItem.id);
    try {
      await api.communications.updateAlert(alertItem.id, { is_active: nextStatus });
      fetchAlerts();
    } catch (err: any) {
      alert(err.response?.data ? JSON.stringify(err.response.data) : "Lỗi khi cập nhật trạng thái cảnh báo");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteAlert = async (id: string, title: string) => {
    if (busyId) return;
    if (!window.confirm(`Bạn có chắc muốn XÓA hẳn bản tin "${title}" khỏi hệ thống?`)) return;
    setBusyId(id);
    try {
      await api.communications.deleteAlert(id);
      fetchAlerts();
    } catch (err) {
      alert("Lỗi khi xóa cảnh báo");
    } finally {
      setBusyId(null);
    }
  };

  const displayedAlerts = alertsList.filter((item) => {
    if (alertFilter === "EMERGENCY") return item.message_type === "EMERGENCY";
    if (alertFilter === "BROADCAST") return item.message_type !== "EMERGENCY";
    if (alertFilter === "ACTIVE")
      return item.is_active && (!item.expires_at || new Date(item.expires_at).getTime() > Date.now());
    if (alertFilter === "INACTIVE")
      return !item.is_active || (item.expires_at && new Date(item.expires_at).getTime() <= Date.now());
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">Phát tin cảnh báo & điều phối</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gửi cảnh báo thiên tai khẩn cấp hoặc phát thông báo hướng dẫn cứu trợ đến người dân và lực lượng cứu nạn
          </p>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>}
        {sourceLoading && <p className="text-xs text-slate-500">Đang tải bài nguồn...</p>}
        {sourceError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{sourceError}</div>}
        {sourceArticle && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5 text-blue-900">
            <p className="font-bold text-sm">Tạo cảnh báo từ bài báo: {sourceArticle.raw_title}</p>
            <p>
              Nguồn: {sourceArticle.source_platform} · Địa điểm: {sourceArticle.extracted_location || "Chưa xác định"}
            </p>
            {contentParts(sourceArticle.source_url || "")
              .filter((p) => p.url)
              .map((p) => (
                <a key={p.url} href={p.url!} target="_blank" rel="noopener noreferrer" className="block text-accent underline">
                  Mở bài báo gốc ↗
                </a>
              ))}
          </div>
        )}
        {zoneError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{zoneError}</div>}

        {/* 2 Columns: Form & Mobile Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (8 cols) */}
          <div className="lg:col-span-8 card p-6 space-y-5">
            {/* 1. Message Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                1. Loại thông điệp
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, msgType: "EMERGENCY" })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.msgType === "EMERGENCY"
                      ? "border-red-400 bg-red-50/60 shadow-xs ring-1 ring-red-400"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🚨</span>
                    <p className="text-sm font-bold text-red-700">CẢNH BÁO KHẨN CẤP</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Bão lũ, sạt lở, lệnh sơ tán, nguy hiểm tính mạng. Âm báo ưu tiên cao.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, msgType: "BROADCAST" })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.msgType === "BROADCAST"
                      ? "border-blue-400 bg-blue-50/60 shadow-xs ring-1 ring-blue-400"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🔔</span>
                    <p className="text-sm font-bold text-accent">THÔNG BÁO CHỈ ĐẠO</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Hướng dẫn cứu trợ, phân bổ nhu yếu phẩm, thông tin điều phối chung.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Audience & Scope */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                2. Đối tượng & phạm vi nhận tin
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Đối tượng nhận tin</label>
                  <select
                    className="input-field w-full text-xs"
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value as any })}
                  >
                    <option value="ALL">Tất cả người dân và cứu hộ</option>
                    <option value="CITIZEN">Chỉ người dân</option>
                    <option value="RESCUER">Chỉ lực lượng cứu hộ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phạm vi phát thanh</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scope: "system", selectedId: "" })}
                      className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                        formData.scope === "system"
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Toàn hệ thống
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scope: "zone" })}
                      className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                        formData.scope === "zone"
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Theo khu vực
                    </button>
                  </div>
                </div>
              </div>

              {formData.scope === "zone" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Chọn khu vực mục tiêu</label>
                  <select
                    disabled={loading}
                    className="input-field w-full text-xs"
                    value={formData.selectedId}
                    onChange={(e) => setFormData({ ...formData, selectedId: e.target.value })}
                  >
                    <option value="">-- Chọn khu vực nhận cảnh báo --</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.code || z.id?.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Hạn hiệu lực (Tùy chọn - để trống sẽ có hiệu lực đến khi thu hồi thủ công)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="input-field w-full text-xs"
                />
              </div>
            </div>

            {/* 3. Title & Message */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                3. Tiêu đề & nội dung bản tin
              </label>
              <input
                className="input-field w-full text-sm font-semibold"
                placeholder={
                  formData.msgType === "EMERGENCY"
                    ? "Tiêu đề cảnh báo khẩn cấp..."
                    : "Tiêu đề thông báo chỉ đạo..."
                }
                value={formData.title}
                maxLength={255}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <textarea
                rows={4}
                className="input-field w-full text-sm resize-none"
                placeholder="Nội dung thông điệp, hướng dẫn hành động cụ thể cho người dân hoặc các đội cứu hộ..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>

            {/* Submit */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, title: "", message: "" }))}
                className="btn-secondary text-xs"
              >
                Xóa trắng
              </button>
              <button
                type="button"
                disabled={submitting || sourceLoading || !!sourceError}
                onClick={handleSend}
                className="btn-primary text-xs flex items-center gap-2"
              >
                <Send size={14} />
                <span>
                  {submitting
                    ? "Đang phát tin..."
                    : formData.msgType === "EMERGENCY"
                    ? "Phát cảnh báo khẩn cấp"
                    : "Gửi thông báo chỉ đạo"}
                </span>
              </button>
            </div>
          </div>

          {/* Right Mobile Preview (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="card p-5 space-y-3 bg-slate-900 text-white border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                <Smartphone size={14} />
                <span>Mô phỏng thông báo trên điện thoại</span>
              </div>

              {/* Notification bubble simulation */}
              <div
                className={`p-4 rounded-xl text-xs space-y-2 text-slate-900 ${
                  formData.msgType === "EMERGENCY"
                    ? "bg-red-50 border border-red-200"
                    : "bg-blue-50 border border-blue-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{formData.msgType === "EMERGENCY" ? "🚨" : "🔔"}</span>
                  <span
                    className={`font-bold text-[11px] uppercase ${
                      formData.msgType === "EMERGENCY" ? "text-red-700" : "text-accent"
                    }`}
                  >
                    {formData.msgType === "EMERGENCY" ? "CẢNH BÁO KHẨN CẤP" : "THÔNG BÁO CHỈ ĐẠO"}
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-sm">
                  {formData.title || "Tiêu đề bản tin..."}
                </p>
                <p className="text-slate-600 line-clamp-3 leading-relaxed">
                  {formData.message || "Nội dung chỉ đạo ứng phó thiên tai sẽ hiển thị trên ứng dụng di động..."}
                </p>
                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                  {formData.audience === "ALL" ? "Tất cả" : formData.audience === "CITIZEN" ? "Người dân" : "Cứu hộ"} ·{" "}
                  {formData.scope === "system" ? "Toàn hệ thống" : zones.find((z) => z.id === formData.selectedId)?.name || "Khu vực mục tiêu"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers size={16} />
                <span>Danh sách bản tin đã phát</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Theo dõi lịch sử, số lượt tiếp nhận và thao tác thu hồi</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Lọc cảnh báo"
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value as any)}
                className="input-field text-xs py-1.5"
              >
                <option value="ALL">Tất cả bản tin</option>
                <option value="EMERGENCY">Khẩn cấp</option>
                <option value="BROADCAST">Chỉ đạo</option>
                <option value="ACTIVE">Đang hiệu lực</option>
                <option value="INACTIVE">Đã thu hồi / Hết hạn</option>
              </select>

              <button
                type="button"
                onClick={fetchAlerts}
                disabled={alertsLoading}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={alertsLoading ? "animate-spin" : ""} />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="table-head">
                <tr>
                  <th className="p-3.5 pl-5">Loại</th>
                  <th className="p-3.5">Tiêu đề & Nội dung</th>
                  <th className="p-3.5">Phạm vi</th>
                  <th className="p-3.5">Thời gian</th>
                  <th className="p-3.5 text-center">Trạng thái</th>
                  <th className="p-3.5 pr-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedAlerts.map((item) => {
                  const isCritical = item.message_type === "EMERGENCY";
                  const expired = item.expires_at && new Date(item.expires_at).getTime() <= Date.now();

                  return (
                    <tr
                      id={`alert-${item.id}`}
                      key={item.id}
                      onClick={() => setSelectedAlert(item)}
                      className="table-row cursor-pointer"
                    >
                      <td className="p-3.5 pl-5">
                        <span
                          className={`badge border text-[11px] ${
                            isCritical ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {isCritical ? "🚨 Khẩn cấp" : "🔔 Thông báo"}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-sm">
                        <p className="font-semibold text-slate-900 text-sm truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.description}</p>
                      </td>
                      <td className="p-3.5 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">
                          {item.zone_name || (item.zone ? `Khu vực #${item.zone}` : "Toàn hệ thống")}
                        </p>
                        <p className="text-slate-400">
                          {item.audience === "RESCUER" ? "Cứu hộ" : item.audience === "CITIZEN" ? "Người dân" : "Toàn bộ"}
                        </p>
                      </td>
                      <td className="p-3.5 text-xs text-slate-500">
                        {item.created_at ? new Date(item.created_at).toLocaleString("vi-VN") : "—"}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`badge border text-[11px] ${
                            item.is_active && !expired
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {item.is_active && !expired ? "Đang phát" : expired ? "Hết hạn" : "Đã thu hồi"}
                        </span>
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title={item.is_active ? "Tắt / Thu hồi cảnh báo" : "Bật lại cảnh báo"}
                            disabled={!!busyId}
                            onClick={() => handleToggleStatus(item)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              item.is_active
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            title="Xóa bản tin"
                            disabled={!!busyId}
                            onClick={() => handleDeleteAlert(item.id, item.title)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {displayedAlerts.length === 0 && !alertsLoading && (
              <div className="p-10 text-center text-sm text-slate-400">Chưa có bản tin nào được phát.</div>
            )}
          </div>
        </div>

        {/* Modal: Alert Detail */}
        {selectedAlert && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setSelectedAlert(null)}
          >
            <div
              className="card max-w-xl w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span
                    className={`badge border text-[11px] ${
                      selectedAlert.message_type === "EMERGENCY"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {selectedAlert.message_type === "EMERGENCY" ? "Cảnh báo khẩn cấp" : "Thông báo chỉ đạo"}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{selectedAlert.title}</h3>
                </div>
                <button onClick={() => setSelectedAlert(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p>
                  <strong>Khu vực:</strong> {selectedAlert.zone_name || "Toàn hệ thống"}
                </p>
                <p>
                  <strong>Thời gian:</strong> {new Date(selectedAlert.created_at).toLocaleString("vi-VN")}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedAlert.description}
              </div>

              {selectedAlert.delivery_status && (
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                  Đã đọc: <strong>{selectedAlert.delivery_status.read_count}</strong> lượt · Chờ push:{" "}
                  <strong>{selectedAlert.delivery_status.queued}</strong>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button className="btn-secondary text-xs" onClick={() => setSelectedAlert(null)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
