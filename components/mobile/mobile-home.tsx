"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Target,
  Trophy,
} from "lucide-react";

const quickLinks = [
  {
    title: "Mock Tests",
    description: "Practice for exams",
    href: "/app-home/tests",
    icon: ClipboardCheck,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "My Courses",
    description: "Continue learning",
    href: "/app-home/courses",
    icon: BookOpen,
    color: "bg-cyan-50 text-cyan-700",
  },
  {
    title: "My Results",
    description: "Track your performance",
    href: "/app-home/results",
    icon: Trophy,
    color: "bg-amber-50 text-amber-600",
  },
  {
    title: "Study Material",
    description: "Revise and learn",
    href: "/app-home/courses",
    icon: FileText,
    color: "bg-violet-50 text-violet-600",
  },
];

export default function MobileHome() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-blue-500 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-100">
          <Target size={16} />
          YOUR LEARNING JOURNEY
        </div>

        <h1 className="mt-3 text-2xl font-bold">
          Ready to achieve your goal?
        </h1>

        <p className="mt-2 max-w-xs text-sm leading-6 text-blue-50">
          Practice daily, build confidence, and prepare for your next exam.
        </p>

        <Link
          href="/app-home/tests"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700"
        >
          Explore mock tests <ChevronRight size={17} />
        </Link>

        <GraduationCap
          size={85}
          className="absolute bottom-4 right-3 text-blue-200/30"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Quick access</h2>

        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map(({ title, description, href, icon: Icon, color }) => (
            <Link
              key={title}
              href={href}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition active:scale-[0.98]"
            >
              <span
                className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${color}`}
              >
                <Icon size={23} />
              </span>

              <span className="block text-sm font-bold text-slate-900">
                {title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {description}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-white p-2 text-blue-600">
            <Trophy size={21} />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">
              Small steps, big results
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Build a regular study habit and review your performance after
              every practice test.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}