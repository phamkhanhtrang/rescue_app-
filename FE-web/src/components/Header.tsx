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

          {/* <div className="hidden sm:flex shrink-0 items-center bg-slate-200 py-[7px] px-3.5 gap-[15px] rounded">
            <img
              src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/a22b0998-b5ff-48aa-be37-b378f672ab86"
              className="w-2.5 h-2.5 object-fill"
              alt="search"
            />
            <div className="flex flex-col shrink-0 items-start pb-[1px]">
              <span className="text-gray-500 text-sm">{"Tìm kiếm..."}</span>
            </div>
          </div> */}
        </div>

        <div className="flex shrink-0 items-center gap-3 md:gap-8">
          {/* <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/609c9e4e-c0c0-45b8-aa59-b9bab93992f9"
            className="hidden md:block w-[108px] h-9 object-fill"
            alt="logo"
          /> */}
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
            {/* <img
              src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/c827b9a9-d27c-48a0-8301-ba6f7b6d0802"
              className="w-8 h-9 md:w-[39px] md:h-10 object-fill"
              alt="avatar"
            /> */}
          </div>
        </div>
      </div>
      <div className="self-stretch bg-slate-200 h-[1px]"></div>
    </div>
  );
}
