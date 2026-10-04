import { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import SliderBar from "../../components/SliderBar";
import Header from "../../components/Header";
import SOSModelPlayground from "../../components/SOSModelPlayground";
import SOSArticleReview, { reviewDefaults } from "../../components/SOSArticleReview";
import { api } from "../../services/api";
import DataNotice from "../../components/DataNotice";
import { apiErrorMessage } from "../../utils/apiError";
import {
  Bot,
  RefreshCw,
  CheckCircle,
  XCircle,
  Search,
  AlertTriangle,
  ExternalLink,
  Eye,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Users,
  Newspaper,
  X,
  Trash2,
} from "lucide-react";
import { FaFacebook, FaFlask } from "react-icons/fa";

export default function AICrawler() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Phân tách 2 luồng riêng biệt: Báo chí ('NEWS') hoặc Facebook SOS ('FACEBOOK')
  const [sourceTab, setSourceTab] = useState<'NEWS' | 'FACEBOOK'>('NEWS');

  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const articleRequest = useRef(0);
  const [isCrawling, setIsCrawling] = useState(false);
  const [isFbCrawling, setIsFbCrawling] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoCrawlInterval, setAutoCrawlInterval] = useState<number>(0);
  const [fbLookbackHours, setFbLookbackHours] = useState<number>(6);

  // Thống kê tổng hợp KPI theo từng luồng
  const [summary, setSummary] = useState<{
    total: number;
    pending: number;
    approved: number;
    created: number;
    rejected: number;
  }>({
    total: 0,
    pending: 0,
    approved: 0,
    created: 0,
    rejected: 0,
  });

  // PhoBERT Test Panel (Collapsible - màu sắc tối giản)
  const [showPhoBertTest, setShowPhoBertTest] = useState(false);
  const [reviewForm, setReviewForm] = useState<any>(reviewDefaults({}));
  const [analyzingArticle, setAnalyzingArticle] = useState(false);

  // Modal xem chi tiết bài viết
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchArticles = async () => {
    const request = ++articleRequest.current;
    setLoading(true);
    try {
      const res = await api.ai.getCrawledArticles({
        status: filterStatus || undefined,
        platform: sourceTab, // 'NEWS' hoặc 'FACEBOOK'
        q: searchQuery.trim() || undefined,
      });
      if (request !== articleRequest.current) return;
      setArticles(res.data.results || []);
      setLoadError('');
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Lỗi lấy dữ liệu bài viết:", err);
      if (request === articleRequest.current) setLoadError(apiErrorMessage(err));
    } finally {
      if (request === articleRequest.current) setLoading(false);
    }
  };

  // Debounced fetch khi thay đổi luồng nguồn, bộ lọc trạng thái hoặc từ khóa tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchArticles();
    }, 250);
    return () => { clearTimeout(timer); ++articleRequest.current; };
  }, [sourceTab, filterStatus, searchQuery]);

  // Hook xử lý Tự động Quét Báo chí (Auto Crawl)
  useEffect(() => {
    if (autoCrawlInterval === 0 || sourceTab !== 'NEWS') return;

    const backgroundCrawl = async () => {
      try {
        await api.ai.runCrawl();
        fetchArticles();
      } catch (err) {
        console.error("Lỗi khi tự động quét báo chí", err);
      }
    };

    const intervalId = setInterval(backgroundCrawl, autoCrawlInterval * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [autoCrawlInterval, sourceTab]);

  const handleRunCrawler = async () => {
    setIsCrawling(true);
    try {
      const res = await api.ai.runCrawl();
      alert(`Đã quét xong báo chí!\n${res.data.message || 'Thành công'}`);
      fetchArticles();
    } catch (err) {
      alert("Lỗi khi quét báo chí");
      console.error(err);
    } finally {
      setIsCrawling(false);
    }
  };

  const handleFbCrawl = async () => {
    setIsFbCrawling(true);
    try {
      const res = await api.ai.runFacebookCrawl({ lookback_hours: fbLookbackHours });
      const s = res.data.stats;
      alert(`Đã quét xong Facebook SOS (${fbLookbackHours} giờ qua)!\n- Thu thập: ${s.crawled} bài\n- Lưu mới: ${s.saved}\n- Trùng lặp: ${s.duplicates}`);
      fetchArticles();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Lỗi khi quét Facebook";
      alert(msg);
    } finally {
      setIsFbCrawling(false);
    }
  };

  const handleDeleteArticle = async (id: string, title?: string) => {
    const confirmText = title
      ? `Bạn có chắc chắn muốn xóa bài viết:\n"${title}"?`
      : "Bạn có chắc chắn muốn xóa bài viết này không?";
    
    if (!window.confirm(confirmText)) return;

    setDeletingId(id);
    try {
      await api.ai.deleteCrawledArticle(id);
      if (selectedArticle && selectedArticle.id === id) {
        setSelectedArticle(null);
      }
      setArticles((prev) => prev.filter((item) => item.id !== id));
      fetchArticles();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Lỗi khi xóa bài viết");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => { if (selectedArticle) setReviewForm(reviewDefaults(selectedArticle)); }, [selectedArticle]);

  const handleAnalyzeArticle = async () => {
    if (!selectedArticle || analyzingArticle) return;
    const id = selectedArticle.id;
    setAnalyzingArticle(true);
    try {
      await api.ai.analyzeCrawledArticle(id);
      const res = await api.ai.getCrawledArticle(id);
      setSelectedArticle((current: any) => current?.id === id ? res.data : current);
      fetchArticles();
    } catch (err: any) { alert(err.response?.data?.error || 'Không thể phân tích lại bài viết.'); }
    finally { setAnalyzingArticle(false); }
  };

  const handleOpenDetail = async (item: any) => {
    setSelectedArticle(item);
    setDetailLoading(true);
    try {
      const res = await api.ai.getCrawledArticle(item.id);
      setSelectedArticle((current: any) => current?.id === item.id ? res.data : current);
    } catch (err) {
      console.error("Lỗi lấy chi tiết bài viết:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    if (reviewingId || analyzingArticle || detailLoading) return;
    const isFacebook = selectedArticle?.id === id && selectedArticle.source_platform === 'FACEBOOK';
    if (action === 'approve' && isFacebook && !reviewForm.is_request) {
      alert('Hãy xác nhận đây là yêu cầu đang cần hỗ trợ trong hồ sơ duyệt.'); return;
    }
    const reason = action === 'reject' ? window.prompt('Lý do từ chối bài viết:')?.trim() : undefined;
    if (action === 'reject' && !reason) return;
    setReviewingId(id);
    try {
      const corrections = isFacebook && action === 'approve' ? {
        ...reviewForm,
        resources: reviewForm.resources.split(';').map((s: string) => s.trim()).filter(Boolean),
        vulnerable_groups: reviewForm.vulnerable_groups.split(';').map((s: string) => s.trim()).filter(Boolean),
      } : undefined;
      const res = await api.ai.reviewCrawledArticle(id, { action, reason, corrections });
      setSelectedArticle((current: any) => current?.id === id ? null : current);
      fetchArticles();
      if (res.data.sos_id) alert(res.data.message);
    } catch (err: any) { alert(err.response?.data?.error || 'Không duyệt được bài viết.'); }
    finally { setReviewingId(null); }
  };

  const handlePublication = async (item: any) => {
    if (reviewingId) return;
    if (item.is_published && !window.confirm('Gỡ bài khỏi mục Tin tức trên app? Cảnh báo liên quan vẫn giữ hiệu lực và được quản lý riêng tại Phát tin.')) return;
    setReviewingId(item.id);
    try {
      await api.ai.setNewsPublication(item.id, item.is_published ? 'unpublish' : 'publish');
      if (selectedArticle?.id === item.id) {
        const detail = await api.ai.getCrawledArticle(item.id);
        setSelectedArticle(detail.data);
      }
      fetchArticles();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Không cập nhật được trạng thái xuất bản.');
    } finally { setReviewingId(null); }
  };

  const newsActions = (item: any) => item.source_platform !== 'FACEBOOK' && ['APPROVED', 'ALERT_CREATED'].includes(item.status) ? (
    <div className="flex flex-wrap gap-2 justify-end">
      <button type="button" disabled={!!reviewingId} onClick={() => handlePublication(item)} className="px-2 py-1 border rounded-lg text-xs text-blue-700">
        {item.is_published ? 'Gỡ xuất bản' : 'Xuất bản lại'}
      </button>
      {item.linked_alert_id ? <button type="button" className="px-2 py-1 border rounded-lg text-xs text-red-700"
        onClick={() => navigate(`/notification-broadcast?alert=${item.linked_alert_id}`)}>Quản lý cảnh báo</button>
        : item.is_published && <button type="button" className="px-2 py-1 border rounded-lg text-xs text-red-700"
          onClick={() => navigate(`/notification-broadcast?article=${item.id}`)}>Tạo cảnh báo từ bài này</button>}
    </div>
  ) : null;

  const SEVERITY_CONFIG: Record<string, { label: string; badge: string }> = {
    CRITICAL: { label: "Cực kỳ nguy hiểm", badge: "bg-red-50 text-red-700 border-red-200" },
    HIGH:     { label: "Mức độ cao",       badge: "bg-orange-50 text-orange-700 border-orange-200" },
    MEDIUM:   { label: "Trung bình",       badge: "bg-amber-50 text-amber-700 border-amber-200" },
    LOW:      { label: "Thấp / Theo dõi",  badge: "bg-slate-100 text-slate-700 border-slate-200" },
  };

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden text-slate-800">
      {/* Sidebar Navigation */}
      <div className={`fixed lg:relative z-30 lg:z-auto h-full overflow-y-auto shrink-0 border-r border-slate-200 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <SliderBar />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="px-6 pt-4"><DataNotice loading={loading} error={loadError} onRetry={fetchArticles} hasData={articles.length > 0} /></div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Page Title & PhoBERT Test Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                <Bot className="text-slate-700 w-7 h-7" />
                Kiểm duyệt & Thu thập Tin tức Thiên tai
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Tự động thu thập thông tin từ báo chí và các nhóm Facebook SOS hỗ trợ kiểm duyệt nhanh.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPhoBertTest(!showPhoBertTest)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showPhoBertTest
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <FaFlask size={12} />
                <span>Thử nghiệm PhoBERT</span>
                {showPhoBertTest ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>

          {showPhoBertTest && <SOSModelPlayground />}

          {/* 2 TAB TÁCH BIỆT: BÁO CHÍ THIÊN TAI vs FACEBOOK SOS (Bỏ hẳn "Tất cả") */}
          <div className="border-b border-slate-200">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setSourceTab('NEWS');
                  setFilterStatus('');
                }}
                className={`flex items-center gap-2 pb-3 px-1 border-b-2 font-semibold text-sm transition-all ${
                  sourceTab === 'NEWS'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <Newspaper size={16} />
                <span>Báo chí Thiên tai</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceTab('FACEBOOK');
                  setFilterStatus('');
                }}
                className={`flex items-center gap-2 pb-3 px-1 border-b-2 font-semibold text-sm transition-all ${
                  sourceTab === 'FACEBOOK'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <FaFacebook size={16} className={sourceTab === 'FACEBOOK' ? 'text-[#1877F2]' : 'text-slate-400'} />
                <span>Facebook SOS Khẩn cấp</span>
              </button>
            </div>
          </div>

          {/* Thanh công cụ hành động riêng biệt theo Tab đang chọn */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {sourceTab === 'NEWS' ? (
              /* Bộ điều khiển quét Báo chí */
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Tự động quét định kỳ:</span>
                <select
                  value={autoCrawlInterval}
                  onChange={(e) => setAutoCrawlInterval(Number(e.target.value))}
                  className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none"
                >
                  <option value={0}>Tắt tự động</option>
                  <option value={1}>1 phút / lần</option>
                  <option value={5}>5 phút / lần</option>
                  <option value={15}>15 phút / lần</option>
                  <option value={30}>30 phút / lần</option>
                </select>
                {autoCrawlInterval > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Đang kích hoạt
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleRunCrawler}
                  disabled={isCrawling}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isCrawling
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <RefreshCw size={12} className={isCrawling ? "animate-spin" : ""} />
                  {isCrawling ? "Đang quét báo chí..." : "Quét Báo chí ngay"}
                </button>
              </div>
            ) : (
              /* Bộ điều khiển quét Facebook SOS */
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Phạm vi quét bài:</span>
                <select
                  value={fbLookbackHours}
                  onChange={(e) => setFbLookbackHours(Number(e.target.value))}
                  disabled={isFbCrawling}
                  className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none"
                >
                  <option value={1}>1 giờ qua</option>
                  <option value={6}>6 giờ qua</option>
                  <option value={12}>12 giờ qua</option>
                  <option value={24}>24 giờ qua</option>
                  <option value={48}>48 giờ qua</option>
                </select>
                <button
                  type="button"
                  onClick={handleFbCrawl}
                  disabled={isFbCrawling}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isFbCrawling
                      ? 'bg-blue-100 text-blue-400 border border-blue-200 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <FaFacebook size={12} className={isFbCrawling ? "animate-spin" : ""} />
                  {isFbCrawling ? "Đang quét Facebook..." : "Quét Facebook SOS"}
                </button>
              </div>
            )}

            {/* Ô tìm kiếm từ khóa */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={sourceTab === 'NEWS' ? "Tìm bài báo, địa phương, sự cố..." : "Tìm nội dung SOS, địa chỉ, SĐT..."}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-slate-400 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* 4 Thẻ KPI Tối giản (Click để lọc nhanh trạng thái) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Thẻ 1: Tổng số */}
            <button
              type="button"
              onClick={() => setFilterStatus("")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                filterStatus === ""
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-60">
                {sourceTab === 'NEWS' ? "Tổng bài báo" : "Tổng bài SOS"}
              </div>
              <div className="text-xl font-bold mt-1">{summary.total || 0}</div>
              <div className="text-[11px] opacity-60 mt-0.5">Tất cả dữ liệu thu thập</div>
            </button>

            {/* Thẻ 2: Chờ duyệt */}
            <button
              type="button"
              onClick={() => setFilterStatus("ANALYZED")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                filterStatus === "ANALYZED"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-slate-800 border-slate-200 hover:border-amber-300"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                Chờ kiểm duyệt
              </div>
              <div className="text-xl font-bold mt-1 text-amber-700">{summary.pending || 0}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Cần thao tác phê duyệt</div>
            </button>

            {/* Thẻ 3: Đã lên Bản tin / Đã tạo SOS */}
            <button
              type="button"
              onClick={() => setFilterStatus(sourceTab === 'NEWS' ? "APPROVED" : "ALERT_CREATED")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                (filterStatus === "PUBLISHED" || (sourceTab === 'FACEBOOK' && filterStatus === "ALERT_CREATED"))
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-800 border-slate-200 hover:border-blue-300"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                {sourceTab === 'NEWS' ? "Đã lên Bản tin" : "Đã tạo SOS Cứu hộ"}
              </div>
              <div className="text-xl font-bold mt-1 text-blue-700">
                {sourceTab === 'NEWS' ? (summary.approved || 0) : (summary.created || 0)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {sourceTab === 'NEWS' ? "Hiển thị cho dân đọc" : "Chuyển cứu hộ xử lý"}
              </div>
            </button>

            {/* Thẻ 4: Đã từ chối */}
            <button
              type="button"
              onClick={() => setFilterStatus("REJECTED")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                filterStatus === "REJECTED"
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Đã từ chối
              </div>
              <div className="text-xl font-bold mt-1 text-slate-700">{summary.rejected || 0}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Tin không phù hợp / Bỏ qua</div>
            </button>
          </div>

          {sourceTab === 'NEWS' && <button type="button" onClick={() => setFilterStatus('UNPUBLISHED')}
            className="px-3 py-1 rounded-lg border text-sm">Bài đã gỡ xuất bản</button>}
          {/* Bộ lọc trạng thái (Pills nhỏ gọn) */}
          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            <span className="font-semibold text-slate-400 shrink-0">Lọc theo:</span>
            <button
              type="button"
              onClick={() => setFilterStatus("")}
              className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                filterStatus === "" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Tất cả ({summary.total || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("ANALYZED")}
              className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                filterStatus === "ANALYZED" ? "bg-amber-600 text-white" : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
              }`}
            >
              Chờ duyệt ({summary.pending || 0})
            </button>
            {sourceTab === 'NEWS' && (
              <button
                type="button"
                onClick={() => setFilterStatus("PUBLISHED")}
                className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  filterStatus === "PUBLISHED" ? "bg-blue-600 text-white" : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                }`}
              >
                Đã lên Bản tin ({summary.approved || 0})
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterStatus(sourceTab === 'NEWS' ? "LINKED" : "ALERT_CREATED")}
              className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                (filterStatus === "ALERT_CREATED" || filterStatus === "LINKED") ? "bg-red-600 text-white" : "bg-white text-red-700 border border-red-200 hover:bg-red-50"
              }`}
            >
              {sourceTab === 'NEWS' ? 'Đã phát Cảnh báo' : 'Đã tạo SOS'} ({summary.created || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("REJECTED")}
              className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                filterStatus === "REJECTED" ? "bg-slate-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Đã từ chối ({summary.rejected || 0})
            </button>
          </div>

          {/* Bảng Dữ liệu Bài viết */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading && articles.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-medium">Đang tải dữ liệu...</p>
              </div>
            ) : articles.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">Không có bài viết nào phù hợp</p>
                <p className="text-xs text-slate-400">
                  {sourceTab === 'NEWS'
                    ? "Bấm 'Quét Báo chí ngay' để cập nhật tin tức mới nhất từ các trang báo."
                    : "Bấm 'Quét Facebook SOS' để thu thập các tin cứu hộ mới nhất từ mạng xã hội."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4 w-40">Nguồn & Thời gian</th>
                      <th className="py-3 px-4">Nội dung / Tiêu đề</th>
                      <th className="py-3 px-4 w-52">Trích xuất AI</th>
                      <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                      <th className="py-3 px-4 w-44 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {articles.map((item: any) => {
                      const sev = SEVERITY_CONFIG[item.extracted_severity] || SEVERITY_CONFIG.LOW;
                      const confidence = Math.round(parseFloat(item.confidence_score || '0') * 100);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Nguồn & Thời gian */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="space-y-1">
                              {sourceTab === 'FACEBOOK' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  <FaFacebook size={11} className="text-[#1877F2]" /> Facebook SOS
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  {item.source_platform}
                                </span>
                              )}
                              <p className="text-[11px] text-slate-400">
                                {item.crawled_at ? new Date(item.crawled_at).toLocaleString('vi-VN', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                }) : '---'}
                              </p>
                              {item.source_url && (
                                <a
                                  href={item.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-slate-500 hover:text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  Nguồn gốc <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Nội dung / Tiêu đề */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(item)}
                                className="text-left font-semibold text-slate-900 hover:text-blue-600 text-xs line-clamp-2 transition-colors cursor-pointer"
                                title="Bấm để xem chi tiết toàn văn"
                              >
                                {item.raw_title}
                              </button>

                              {/* Thông tin phụ trợ (Người đăng, SĐT, số người) */}
                              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                                {item.facebook_author && (
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                    Người đăng: {item.facebook_author}
                                  </span>
                                )}
                                {item.extracted_phone && (
                                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                                    <Phone size={10} /> {item.extracted_phone}
                                  </span>
                                )}
                                {item.extracted_people_count > 0 && (
                                  <span className="flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-medium">
                                    <Users size={10} /> {item.extracted_people_count} người
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Trích xuất AI */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-800">
                                  {item.extracted_incident_type || 'Thiên tai'}
                                </span>
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-medium border ${sev.badge}`}>
                                  {item.extracted_severity || 'LOW'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-slate-500 text-[11px] line-clamp-1">
                                <MapPin size={11} className="text-slate-400 shrink-0" />
                                <span>{item.extracted_location || item.extracted_address || 'Chưa rõ địa điểm'}</span>
                              </div>

                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span>Độ tin cậy: {confidence}%</span>
                              </div>
                            </div>
                          </td>

                          {/* Trạng thái */}
                          <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                            {item.source_platform !== 'FACEBOOK' && ['APPROVED', 'ALERT_CREATED'].includes(item.status) && (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-medium border border-blue-200">
                                <CheckCircle size={12} /> {item.is_published ? 'Đang xuất bản' : 'Đã gỡ xuất bản'}
                              </span>
                            )}
                            {(item.linked_alert_id || (item.source_platform === 'FACEBOOK' && item.status === 'ALERT_CREATED')) && (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                                <CheckCircle size={12} /> {sourceTab === 'FACEBOOK' ? 'Đã tạo SOS' : !item.linked_alert__is_active ? 'Cảnh báo đã thu hồi' : item.linked_alert__expires_at && new Date(item.linked_alert__expires_at).getTime() <= Date.now() ? 'Cảnh báo hết hạn' : 'Cảnh báo đang hiệu lực'}
                              </span>
                            )}
                            {item.status === 'ANALYZED' && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                                <AlertTriangle size={12} /> Chờ duyệt
                              </span>
                            )}
                            {item.status === 'REJECTED' && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                                <XCircle size={12} /> Đã từ chối
                              </span>
                            )}
                          </td>

                          {/* Thao tác (Xem, Duyệt, Từ chối, XÓA) */}
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Xem chi tiết */}
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(item)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                                title="Xem chi tiết toàn văn"
                              >
                                <Eye size={14} />
                              </button>

                              {/* Thao tác duyệt bài */}
                              {item.status === 'ANALYZED' && (
                                <>
                                  {sourceTab === 'FACEBOOK' ? (
                                    <button
                                      type="button"
                                      disabled={reviewingId === item.id}
                                      onClick={() => handleOpenDetail(item)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                                      title="Duyệt bài đăng Facebook và tạo yêu cầu cứu hộ SOS"
                                    >
                                      {reviewingId === item.id ? '...' : 'Duyệt SOS'}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        disabled={reviewingId === item.id}
                                        onClick={() => handleReview(item.id, 'approve')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg text-xs font-medium transition-colors"
                                        title="Duyệt đưa vào Bản tin Thiên tai"
                                      >
                                        {reviewingId === item.id ? '...' : 'Lên Bản tin'}
                                      </button>
                                      
                                    </>
                                  )}

                                  {/* Nút Từ chối */}
                                  <button
                                    type="button"
                                    disabled={reviewingId === item.id}
                                    onClick={() => handleReview(item.id, 'reject')}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors"
                                    title="Từ chối bài viết này"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </>
                              )}

                              {newsActions(item)}
                              {/* Nút XÓA BÀI VIẾT (Trash2) */}
                              <button
                                type="button"
                                disabled={deletingId === item.id || (item.source_platform !== 'FACEBOOK' && ['APPROVED', 'ALERT_CREATED'].includes(item.status))}
                                onClick={() => handleDeleteArticle(item.id, item.raw_title)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                title="Xóa vĩnh viễn bài viết này"
                              >
                                <Trash2 size={14} className={deletingId === item.id ? "animate-spin" : ""} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Xem Toàn Văn Chi Tiết Bài Viết (Thiết kế tối giản) */}
      {selectedArticle && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                {selectedArticle.source_platform === 'FACEBOOK' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <FaFacebook size={12} className="text-[#1877F2]" /> Facebook SOS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-700">
                    {selectedArticle.source_platform}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {selectedArticle.crawled_at ? new Date(selectedArticle.crawled_at).toLocaleString('vi-VN') : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">
                  {selectedArticle.raw_title}
                </h2>
                {selectedArticle.source_url && (
                  <a
                    href={selectedArticle.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    Xem link gốc bài viết <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {/* Grid 2 cột thông tin */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Thông tin trích xuất AI */}
                <div className="md:col-span-1 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Thông tin trích xuất</p>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Sự cố:</span>
                    <span className="font-semibold text-slate-800">{selectedArticle.extracted_incident_type || 'Thiên tai'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Mức độ:</span>
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 mt-0.5">
                      {selectedArticle.extracted_severity || 'LOW'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Độ tin cậy AI:</span>
                    <span className="font-semibold text-slate-800">
                      {Math.round(parseFloat(selectedArticle.confidence_score || '0') * 100)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Địa điểm:</span>
                    <span className="font-medium text-slate-700 flex items-start gap-1 mt-0.5">
                      <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                      {selectedArticle.extracted_location || selectedArticle.extracted_address || 'Chưa xác định'}
                    </span>
                  </div>

                  {selectedArticle.facebook_author && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">Người đăng:</span>
                      <span className="font-semibold text-blue-700">{selectedArticle.facebook_author}</span>
                    </div>
                  )}

                  {selectedArticle.extracted_phone && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                      <span className="font-semibold text-emerald-700">{selectedArticle.extracted_phone}</span>
                    </div>
                  )}

                  {selectedArticle.extracted_people_count > 0 && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">Số người gặp nạn:</span>
                      <span className="font-semibold text-rose-700">{selectedArticle.extracted_people_count} người</span>
                    </div>
                  )}
                </div>

                {/* Toàn văn nội dung */}
                <div className="md:col-span-2 flex flex-col space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Toàn văn nội dung</p>
                  <div className="flex-1 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto font-normal">
                    {detailLoading ? (
                      <div className="py-8 text-center text-slate-400">Đang tải toàn văn bài viết...</div>
                    ) : (
                      selectedArticle.raw_content || selectedArticle.raw_title || "Không có nội dung văn bản mở rộng."
                    )}
                  </div>
                  {selectedArticle.reject_reason && (
                    <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 text-[11px] text-red-600">
                      Lý do từ chối: {selectedArticle.reject_reason}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedArticle.source_platform !== 'FACEBOOK' && <div className="px-5 pb-4 text-xs text-slate-600 space-y-2">
              <p>Thu thập: {new Date(selectedArticle.crawled_at).toLocaleString('vi-VN')}</p>
              <p>Xuất bản: {selectedArticle.published_at ? new Date(selectedArticle.published_at).toLocaleString('vi-VN') : 'Chưa có thời điểm ghi nhận'}</p>
              <p>{selectedArticle.is_published ? 'Bài đang có trên app' : 'Bài không hiển thị trên app'} · Gỡ bài không thu hồi cảnh báo liên quan.</p>
              {newsActions(selectedArticle)}
              <p className="font-bold">Lịch sử xuất bản</p>
              {(selectedArticle.publication_events || []).map((event: any, i: number) => <p key={i}>
                {new Date(event.created_at).toLocaleString('vi-VN')} · {event.actor__full_name || 'Quản trị viên'} ·
                {event.action === 'PUBLISHED' ? ' Xuất bản' : event.action === 'UNPUBLISHED' ? ' Gỡ xuất bản' : ' Tạo cảnh báo'}
              </p>)}
            </div>}
            {selectedArticle.source_platform === 'FACEBOOK' && !detailLoading && <SOSArticleReview
              article={selectedArticle} value={reviewForm} onChange={setReviewForm}
              busy={analyzingArticle || !!reviewingId} onAnalyze={handleAnalyzeArticle} />}
            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              {/* Nút Xóa bài viết */}
              <button
                type="button"
                disabled={deletingId === selectedArticle.id || (selectedArticle.source_platform !== 'FACEBOOK' && ['APPROVED', 'ALERT_CREATED'].includes(selectedArticle.status))}
                onClick={() => handleDeleteArticle(selectedArticle.id, selectedArticle.raw_title)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs font-medium"
              >
                <Trash2 size={13} />
                <span>{deletingId === selectedArticle.id ? 'Đang xóa...' : 'Xóa bài viết'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors text-xs font-medium"
                >
                  Đóng
                </button>

                {selectedArticle.status === 'ANALYZED' ? (
                  <>
                    <button
                      type="button"
                      disabled={reviewingId === selectedArticle.id || analyzingArticle || detailLoading}
                      onClick={() => handleReview(selectedArticle.id, 'reject')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-medium"
                    >
                      Từ chối
                    </button>

                    {selectedArticle.source_platform === 'FACEBOOK' ? (
                      <button
                        type="button"
                        disabled={reviewingId === selectedArticle.id || analyzingArticle || detailLoading}
                        onClick={() => handleReview(selectedArticle.id, 'approve')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-medium"
                      >
                        Tạo tín hiệu SOS
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={reviewingId === selectedArticle.id || analyzingArticle || detailLoading}
                          onClick={() => handleReview(selectedArticle.id, 'approve')}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-xs font-medium"
                        >
                          Duyệt lên Bản tin
                        </button>
                        
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">
                    {selectedArticle.status === 'APPROVED' ? 'Đã duyệt lên Bản tin' : selectedArticle.status === 'ALERT_CREATED' ? 'Đã tạo Cảnh báo/SOS' : 'Đã từ chối'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
