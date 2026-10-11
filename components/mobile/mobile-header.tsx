
"use client";

import Link from "next/link";
import { Bell, GraduationCap } from "lucide-react";

export default function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-100 bg-white/95 px-4 backdrop-blur">
      <Link
        href="/app-home"
        className="flex items-center gap-2.5"
        aria-label="LearnPathshala student home"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
          <GraduationCap size={23} />
        </span>

        <span>
          <span className="block text-base font-bold tracking-tight text-slate-900">
            LearnPathshala
          </span>
          <span className="block text-[11px] text-slate-500">
            Learn. Practice. Achieve.
          </span>
        </span>
      </Link>

      <button
        type="button"
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-700"
      >
        <Bell size={20} />
      </button>
    </header>
  );
}
