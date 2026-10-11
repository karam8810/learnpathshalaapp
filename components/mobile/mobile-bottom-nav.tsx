
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  ClipboardCheck,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  UserRound,
} from "lucide-react";

const navigation = [
  { label: "Home", href: "/app-home", icon: House },
  { label: "Tests", href: "/app-home/tests", icon: ClipboardCheck },
  { label: "Courses", href: "/app-home/courses", icon: BookOpen },
  {
    label: "Results",
    href: "/app-home/results",
    icon: ChartNoAxesColumnIncreasing,
  },
  { label: "Profile", href: "/app-home/profile", icon: UserRound },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Student navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid h-[66px] max-w-lg grid-cols-5">
        {navigation.map(({ label, href, icon: Icon }) => {
          const active =
            href === "/app-home"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${
                active ? "text-blue-600" : "text-slate-500"
              }`}
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.5 : 1.8}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
