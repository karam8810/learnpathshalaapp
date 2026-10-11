"use client";

import Link from "next/link";
import { ClipboardCheck, ChevronRight, Search } from "lucide-react";

export default function MobileMockTests() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mock Tests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Find tests and prepare at your own pace.
        </p>
      </div>

      <label className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4">
        <Search size={19} className="text-slate-400" />
        <input
          type="search"
          placeholder="Search mock tests"
          aria-label="Search mock tests"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <ClipboardCheck size={25} />
        </span>

        <h2 className="mt-3 font-bold text-slate-900">
          Explore test series
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Browse available test series, check their details, and access tests
          available to your account.
        </p>

        <Link
          href="/mock-tests"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Browse mock tests <ChevronRight size={17} />
        </Link>
      </div>

      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
        Test series and purchase status will be connected to your existing
        Supabase data in the next step.
      </p>
    </div>
  );
}