import { useState } from "react";
import SliderBar from "./SliderBar";
import Header from "./Header";

interface AdminLayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export default function AdminLayout({ children, fullWidth = false }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-page overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:relative z-40 lg:z-auto h-full overflow-y-auto shrink-0 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <SliderBar />
      </div>

      {/* Main container */}
      <div className="flex-1 bg-page flex flex-col h-full overflow-y-auto min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {fullWidth ? (
          <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
            {children}
          </main>
        ) : (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
            {children}
          </main>
        )}
      </div>
    </div>
  );
}
