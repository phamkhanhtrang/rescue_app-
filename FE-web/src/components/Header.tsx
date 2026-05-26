import React, { useState } from "react";

export default function Header({ onOpenSidebar }) {
  const [userName, setUserName] = useState(localStorage.getItem("user_username")  );
  const [userRole, setUserRole] = useState(localStorage.getItem("user_role") || "Staff");

  return (
    <div
      className="flex flex-col self-stretch bg-slate-50 pt-3 mb-4 gap-3"
      style={{ boxShadow: "0px 1px 2px #0000000D" }}>
      <div className="flex justify-between items-center self-stretch mx-4 md:mx-6">
        <div className="flex shrink-0 items-center gap-3 md:gap-[31px]">
          {/* Mobile menu button */}
          <button
            className="lg:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 rounded border-0 bg-transparent cursor-pointer"
            onClick={() => onOpenSidebar(true)}
            aria-label="Open sidebar"
          >
            <span className="w-5 h-0.5 bg-slate-700 rounded" />
            <span className="w-5 h-0.5 bg-slate-700 rounded" />
            <span className="w-5 h-0.5 bg-slate-700 rounded" />
          </button>

          <div className="flex flex-col shrink-0 items-start py-1.5">
            <span className="text-slate-900 text-base md:text-xl font-bold">
              {"Sentinel Ethos"}
            </span>
          </div>

<button
              onClick={() => window.location.reload()}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition font-semibold shadow-sm"
            >
              Làm mới
            </button>
        </div>

        <div className="flex shrink-0 items-center gap-3 md:gap-8">
          
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <div className="flex flex-col shrink-0 items-start">
              <div className="flex flex-col items-start py-0.5 px-[1px]">
                <span className="text-slate-900 text-xs font-bold">
                  {userName}
                </span>
              </div>
              <div className="flex flex-col items-start py-[3px]">
                <span className="text-slate-500 text-[10px]">
                  {userRole}
                </span>
              </div>
            </div>
            
          </div>
        </div>
      </div>
      <div className="self-stretch bg-slate-200 h-[1px]"></div>
    </div>
  );
}
