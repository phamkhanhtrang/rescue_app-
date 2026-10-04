import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { failed: boolean };

export default class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin page failed to render:', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert" className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Không thể hiển thị trang này</h1>
        <p className="mt-3 text-sm text-slate-600">Dữ liệu của bạn vẫn được giữ trên máy chủ. Hãy tải lại trang để tiếp tục.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-red-700 px-5 py-2 text-sm font-semibold text-white">Tải lại trang</button>
      </div>
    </main>;
  }
}
