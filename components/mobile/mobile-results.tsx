"use client";

import Link from "next/link";
import {
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  Trophy,
} from "lucide-react";

export default function MobileResults() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Results</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review your test attempts and progress.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <ClipboardCheck size={24} className="text-blue-600" />
          <p className="mt-3 text-xs text-slate-500">Tests attempted</p>
          <p className="mt-1 text-xl font-bold text-slate-900">—</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <Trophy size={24} className="text-emerald-600" />
          <p className="mt-3 text-xs text-slate-500">Average score</p>
          <p className="mt-1 text-xl font-bold text-slate-900">—</p>
        </div>
      </div>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
        <ChartNoAxesColumnIncreasing
          size={32}
          className="mx-auto text-blue-600"
        />
        <h2 className="mt-3 font-semibold text-slate-900">
          Your performance report
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your real scores, accuracy, and previous attempts will be displayed
          here after connecting your test history.
        </p>
      </section>

      <Link
        href="/app-home/tests"
        className="block rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white"
      >
        Practice a mock test
      </Link>
    </div>
  );
}