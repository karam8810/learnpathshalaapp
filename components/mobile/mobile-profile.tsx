"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  UserRound,
  BookOpen,
  Trophy,
  LogOut,
  ChevronRight,
} from "lucide-react";

export default function MobileProfile() {
  const { user, profile, signOut } = useAuth();

  const displayName =
    (profile as { full_name?: string; name?: string } | null)?.full_name ||
    (profile as { name?: string } | null)?.name ||
    user?.email?.split("@")[0] ||
    "Student";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your student account.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <UserRound size={37} />
        </span>

        <h2 className="mt-3 font-bold text-slate-900">{displayName}</h2>
        <p className="mt-1 break-all text-sm text-slate-500">
          {user?.email}
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <Link
          href="/app-home/courses"
          className="flex items-center gap-3 border-b border-slate-100 px-4 py-4"
        >
          <BookOpen size={20} className="text-blue-600" />
          <span className="flex-1 text-sm font-medium text-slate-700">
            My Courses
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>

        <Link
          href="/app-home/results"
          className="flex items-center gap-3 px-4 py-4"
        >
          <Trophy size={20} className="text-blue-600" />
          <span className="flex-1 text-sm font-medium text-slate-700">
            My Results
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>
      </section>

      <button
        type="button"
        onClick={() => void signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-semibold text-red-600"
      >
        <LogOut size={18} />
        Sign out
      </button>
    </div>
  );
}