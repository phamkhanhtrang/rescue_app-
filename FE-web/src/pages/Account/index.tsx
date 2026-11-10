import React, { useEffect, useRef, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { apiClient } from "../../services/api";
import { Search, RefreshCw, X, UserCheck, Shield, ChevronLeft, ChevronRight } from "lucide-react";

const states: Record<string, { label: string; badge: string }> = {
  PENDING: { label: "Chờ duyệt", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  ACTIVE: { label: "Đang hoạt động", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Bị từ chối", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  BANNED: { label: "Bị khóa", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

const roles: Record<string, { label: string; badge: string }> = {
  CITIZEN: { label: "Người dân", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  RESCUER: { label: "Cứu hộ", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  ADMIN: { label: "Quản trị viên", badge: "bg-slate-800 text-white border-slate-800" },
};

const errorText = (e: any) =>
  e?.response?.data?.error || e?.response?.data?.detail || "Không tải được dữ liệu. Vui lòng thử lại.";

export default function Account() {
  const [users, setUsers] = useState<any[]>([]);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [contact, setContact] = useState({ full_name: "", phone: "", email: "", address: "" });
  const detailGeneration = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPage(1);
    const timer = setTimeout(() => {
      apiClient
        .get("/accounts/profiles/", { params: { role, status, search }, signal: controller.signal })
        .then(({ data }) => {
          if (!controller.signal.aborted) setUsers(data.results || []);
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setUsers([]);
            setError(errorText(e));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [role, status, search, reload]);

  useEffect(() => () => {
    detailGeneration.current += 1;
  }, []);

  const openDetail = async (id: string) => {
    const generation = ++detailGeneration.current;
    setDetailLoading(true);
    setSelected(null);
    setError("");
    setAction("");
    setReason("");
    try {
      const { data } = await apiClient.get("/accounts/profiles/" + id + "/");
      if (generation === detailGeneration.current) {
        setSelected(data);
        setContact({
          full_name: data.full_name || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
        });
      }
    } catch (e) {
      if (generation === detailGeneration.current) setError(errorText(e));
    } finally {
      if (generation === detailGeneration.current) setDetailLoading(false);
    }
  };

  const close = () => {
    if (busy) return;
    detailGeneration.current++;
    setSelected(null);
    setDetailLoading(false);
    setAction("");
  };

  const submit = async () => {
    if (!selected || busy || !action) return;
    if (["ban", "reject"].includes(action) && !reason.trim()) {
      setError("Vui lòng nhập lý do.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await apiClient.post("/accounts/profiles/" + selected.id + "/" + action + "/", {
        reason: reason.trim(),
      });
      setNotice(data.message);
      setReload((v) => v + 1);
      await openDetail(selected.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const pages = Math.max(1, Math.ceil(users.length / 10));

  const saveContact = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiClient.put("/accounts/profiles/" + selected.id + "/", contact);
      setNotice("Đã cập nhật thông tin liên hệ.");
      setReload((v) => v + 1);
      await openDetail(selected.id);
    } catch (e: any) {
      const data = e?.response?.data;
      const first = data && Object.values(data)[0];
      setError(data?.error || (Array.isArray(first) ? first.join(" ") : errorText(e)));
    } finally {
      setBusy(false);
    }
  };

  const visible = users.slice((page - 1) * 10, page * 10);
  const child = selected?.rescuer_profile || selected?.citizen_profile || {};
  const detailFields: [string, any][] = selected
    ? [
        ["Họ tên", selected.full_name],
        ["Vai trò", roles[selected.role]?.label || selected.role],
        ["Trạng thái", states[selected.account_status]?.label || selected.account_status],
        ["Số điện thoại", selected.phone],
        ["Email", selected.email],
        ["Địa chỉ", selected.address],
        ["CCCD", child.id_number],
        ["Đơn vị", child.unit_name],
        ["Số hiệu đội (tự khai)", child.team_code],
        ["Cấp bậc", child.rank],
        ["Chuyên môn", child.specialty_display],
        ["Bệnh nền / dị ứng", child.medical_notes],
        ["Liên hệ khẩn cấp", child.emergency_contact_name],
        ["SĐT khẩn cấp", child.emergency_contact_phone],
        ["Lý do xử lý gần nhất", selected.account_reason],
      ]
    : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý tài khoản</h1>
          <p className="text-sm text-slate-500 mt-1">
            Xác minh danh tính người dân và duyệt hồ sơ lực lượng cứu hộ trên hệ thống
          </p>
        </div>

        {/* Filter bar */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                aria-label="Tìm tài khoản"
                className="input-field w-full pl-10"
                placeholder="Tìm theo họ tên, số điện thoại, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              aria-label="Vai trò"
              className="input-field md:w-44"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Tất cả vai trò</option>
              {Object.entries(roles).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Trạng thái"
              className="input-field md:w-44"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(states).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>

            <button
              className="btn-secondary flex items-center gap-1.5"
              onClick={() => setReload((v) => v + 1)}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Tải lại</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Tìm thấy <strong className="text-slate-900">{users.length}</strong> tài khoản
            </span>
            {Object.entries(states).map(([k, v]) => (
              <span key={k}>
                {v.label}: <strong>{users.filter((u) => u.account_status === k).length}</strong>
              </span>
            ))}
          </div>
        </div>

        {notice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
            {notice}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Data Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="table-head">
                <tr>
                  <th className="p-3.5 pl-5">Họ và tên</th>
                  <th className="p-3.5">Vai trò</th>
                  <th className="p-3.5">Thông tin liên hệ</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5 pr-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((u) => {
                  const rConfig = roles[u.role] || { label: u.role, badge: "bg-slate-100 text-slate-600 border-slate-200" };
                  const sConfig = states[u.account_status] || {
                    label: u.account_status,
                    badge: "bg-slate-100 text-slate-600 border-slate-200",
                  };

                  return (
                    <tr key={u.id} className="table-row">
                      <td className="p-3.5 pl-5">
                        <button
                          className="font-semibold text-slate-900 hover:text-accent transition-colors text-left"
                          onClick={() => openDetail(u.id)}
                        >
                          {u.full_name || "Chưa có tên"}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <span className={`badge border text-[11px] ${rConfig.badge}`}>
                          {rConfig.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">{u.phone || "—"}</span>
                        {u.email && <span className="block text-slate-400">{u.email}</span>}
                      </td>
                      <td className="p-3.5">
                        <span className={`badge border text-[11px] ${sConfig.badge}`}>
                          {sConfig.label}
                        </span>
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <button
                          className="btn-secondary text-xs py-1.5 px-3"
                          onClick={() => openDetail(u.id)}
                        >
                          Chi tiết hồ sơ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!users.length && !loading && (
              <div className="p-10 text-center text-sm text-slate-400">
                Không tìm thấy tài khoản phù hợp với điều kiện lọc.
              </div>
            )}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between p-3.5 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Trang <strong>{page}</strong> / {pages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Account Details */}
        {(selected || detailLoading) && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={close}
          >
            <section
              role="dialog"
              aria-modal="true"
              className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-accent" />
                  <h2 className="text-lg font-bold text-slate-900">Chi tiết tài khoản</h2>
                </div>
                <button
                  disabled={busy}
                  onClick={close}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {detailLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">Đang tải hồ sơ...</div>
              ) : (
                <>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    {detailFields
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                          <dt className="text-slate-400 font-medium mb-0.5">{k}</dt>
                          <dd className="font-semibold text-slate-800 whitespace-pre-wrap break-words">{String(v)}</dd>
                        </div>
                      ))}
                  </dl>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                      {error}
                    </div>
                  )}

                  {/* Edit Contact Information */}
                  {selected?.role !== "ADMIN" && (
                    <details className="border-t border-slate-100 pt-3">
                      <summary className="cursor-pointer font-semibold text-sm text-slate-800 hover:text-accent">
                        Sửa thông tin liên hệ
                      </summary>
                      <p className="text-xs text-slate-500 my-2">
                        Khi hỗ trợ khôi phục, cần xác minh đúng chủ tài khoản trước khi thay đổi email hoặc SĐT.
                      </p>
                      <div className="space-y-2.5 mt-3">
                        {[
                          ["full_name", "Họ và tên"],
                          ["phone", "Số điện thoại"],
                          ["email", "Email"],
                          ["address", "Địa chỉ"],
                        ].map(([key, label]) => (
                          <div key={key}>
                            <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
                            <input
                              className="input-field w-full text-xs"
                              value={contact[key as keyof typeof contact]}
                              disabled={busy}
                              onChange={(e) => setContact((v) => ({ ...v, [key]: e.target.value }))}
                            />
                          </div>
                        ))}
                        <button
                          disabled={busy}
                          className="btn-primary text-xs mt-2"
                          onClick={saveContact}
                        >
                          Lưu thông tin liên hệ
                        </button>
                      </div>
                    </details>
                  )}

                  {/* Actions: Approve / Reject / Ban */}
                  {selected?.role !== "ADMIN" && (
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Phê duyệt & Quản trị tài khoản
                      </p>
                      <div className="flex flex-wrap gap-2.5">
                        {selected.account_status !== "ACTIVE" && (
                          <button
                            disabled={busy}
                            className="btn-primary text-xs"
                            onClick={() => {
                              setAction("activate");
                              setReason("");
                            }}
                          >
                            {selected.account_status === "BANNED" ? "Mở khóa tài khoản" : "Duyệt hồ sơ"}
                          </button>
                        )}
                        {selected.account_status === "PENDING" && (
                          <button
                            disabled={busy}
                            className="btn-secondary text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={() => {
                              setAction("reject");
                              setReason("");
                            }}
                          >
                            Từ chối hồ sơ
                          </button>
                        )}
                        {selected.account_status === "ACTIVE" && (
                          <button
                            disabled={busy}
                            className="btn-secondary text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={() => {
                              setAction("ban");
                              setReason("");
                            }}
                          >
                            Khóa tài khoản
                          </button>
                        )}
                      </div>

                      {action && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                          <p className="text-xs font-semibold text-slate-800">
                            {action === "activate"
                              ? "Xác nhận cho phép tài khoản hoạt động và đăng nhập?"
                              : action === "ban"
                              ? "Khóa tài khoản sẽ lập tức kết thúc các phiên đăng nhập hiện tại."
                              : "Xác nhận từ chối hồ sơ đăng ký tài khoản?"}
                          </p>
                          <textarea
                            aria-label="Lý do xử lý"
                            maxLength={2000}
                            className="input-field w-full text-xs h-20"
                            placeholder={
                              action === "activate"
                                ? "Ghi chú nội bộ (không bắt buộc)"
                                : "Nhập lý do bắt buộc để thông báo cho người dùng..."
                            }
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setAction("")}
                              className="btn-ghost text-xs"
                            >
                              Hủy bỏ
                            </button>
                            <button
                              disabled={busy}
                              className="btn-primary text-xs"
                              onClick={submit}
                            >
                              {busy ? "Đang xử lý..." : "Xác nhận xử lý"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* History */}
                  <div className="border-t border-slate-100 pt-3">
                    <h3 className="text-xs font-bold text-slate-700 mb-2">Lịch sử xử lý tài khoản</h3>
                    {selected.history?.length ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto divide-y divide-slate-50 text-xs">
                        {selected.history.map((h: any, i: number) => (
                          <div key={i} className="pt-1.5 first:pt-0">
                            <span className="text-slate-400">
                              {new Date(h.created_at).toLocaleString("vi-VN")}
                            </span>{" "}
                            · <strong className="text-slate-700">{h.actor__full_name || "Admin"}</strong>:{" "}
                            <span className="font-medium text-slate-800">
                              {
                                ({
                                  activate: "Duyệt / mở khóa",
                                  ban: "Khóa tài khoản",
                                  reject: "Từ chối",
                                  normalize_profile: "Chuẩn hóa hồ sơ",
                                } as Record<string, string>)[h.action]
                              }
                            </span>
                            {h.reason && <p className="text-slate-500 italic mt-0.5">{h.reason}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Chưa có lịch sử xử lý được ghi nhận.</p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
