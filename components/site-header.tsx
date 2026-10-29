
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

const navigation = [
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Courses', href: '/courses' },
  { label: 'Mock Tests', href: '/mock-tests' },
  { label: 'Blog', href: '/blog' },
  { label: 'Previous Year Papers', href: '/previous-year-papers' },
  { label: 'Current Affairs', href: '/current-affairs' },
];

const primaryButton =
  'bg-gradient-to-r from-[#063B8F] to-[#0B63CE] font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:from-[#052f73] hover:to-[#084fa8]';

const navLink =
  'rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-[#063B8F] md:rounded-none md:px-0 md:py-0 md:text-slate-600 md:hover:bg-transparent';

export function SiteHeader() {
  const { user, profile, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardLink = profile
    ? `/dashboard/${profile.role}`
    : '/login';

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-blue-100/70 bg-white/95 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          onClick={closeMobileMenu}
          className="flex shrink-0 items-center"
        >
          <Image
            src="/learnpathshalalogo.png"
            alt="LearnPathshala"
            width={230}
            height={90}
            priority
            className="h-14 w-auto object-contain"
          />
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-6 lg:flex xl:gap-8">
          {navigation.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#063B8F]"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          {loading ? (
            <div className="h-10 w-28 animate-pulse rounded-xl bg-blue-100" />
          ) : user && profile ? (
            <Link href={dashboardLink}>
              <Button className={primaryButton}>
                Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="font-semibold text-[#063B8F] hover:bg-blue-50 hover:text-[#063B8F]"
                >
                  Sign In
                </Button>
              </Link>

              <Link href="/register">
                <Button className={primaryButton}>
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-site-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="rounded-xl p-2 text-[#063B8F] transition hover:bg-blue-50 md:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <div
          id="mobile-site-navigation"
          className="border-t border-blue-100 bg-white md:hidden"
        >
          <div className="mx-auto max-h-[calc(100dvh-5rem)] max-w-7xl overflow-y-auto px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-1">
              {navigation.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobileMenu}
                  className={navLink}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Mobile actions */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              {loading ? (
                <div className="h-12 w-full animate-pulse rounded-xl bg-blue-100" />
              ) : user && profile ? (
                <Link
                  href={dashboardLink}
                  onClick={closeMobileMenu}
                  className="block"
                >
                  <Button className={`w-full ${primaryButton}`}>
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <div className="flex gap-3">
                  <Link
                    href="/login"
                    onClick={closeMobileMenu}
                    className="flex-1"
                  >
                    <Button
                      variant="outline"
                      className="w-full border-[#063B8F]/20 text-[#063B8F]"
                    >
                      Sign In
                    </Button>
                  </Link>

                  <Link
                    href="/register"
                    onClick={closeMobileMenu}
                    className="flex-1"
                  >
                    <Button className={`w-full ${primaryButton}`}>
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
