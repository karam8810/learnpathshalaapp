"use client";

import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";

export default function MobileCourses() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Courses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Continue your learning journey.
        </p>
      </div>

      <section className="rounded-2xl bg-blue-600 p-5 text-white">
        <BookOpen size={28} />
        <h2 className="mt-3 text-lg font-bold">Keep learning</h2>
        <p className="mt-1 text-sm leading-6 text-blue-100">
          Discover courses and access the courses available to your account.
        </p>

        <Link
          href="/courses"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700"
        >
          Browse courses <ChevronRight size={17} />
        </Link>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
        <BookOpen size={30} className="mx-auto text-blue-600" />
        <h2 className="mt-3 font-semibold text-slate-900">
          Your enrolled courses
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your purchased and enrolled courses will appear here once this screen
          is connected to your enrollment records.
        </p>
      </section>
    </div>
  );
}