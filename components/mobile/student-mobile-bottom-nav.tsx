
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  ClipboardCheck,
  BookOpen,
  Award,
  UserRound,
} from 'lucide-react';

const items = [
  { label: 'Home', href: '/dashboard/student', icon: House },
  {
    label: 'Tests',
    href: '/dashboard/student/mock-tests',
    icon: ClipboardCheck,
  },
  {
    label: 'Courses',
    href: '/dashboard/student/courses',
    icon: BookOpen,
  },
  {
    label: 'Results',
    href: '/dashboard/student/quizzes',
    icon: Award,
  },
  {
    label: 'Profile',
    href: '/dashboard/student/profile',
    icon: UserRound,
  },
];

export function StudentMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Student navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map(({ label, href, icon: Icon }) => {
          const active =
            href === '/dashboard/student'
              ? pathname === href
              : pathname === href ||
                pathname.startsWith(`${href}/`);

          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 ${
                active ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.4 : 1.8}
              />
              <span className="text-[10px] font-medium">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
