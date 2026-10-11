"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import MobileAppShell from "@/components/mobile/mobile-app-shell";
import { useAuth } from "@/lib/auth-context";

export default function StudentAppPage() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login?next=/app-home");
      return;
    }

    if (profile?.role && profile.role !== "student") {
      router.replace("/dashboard");
    }
  }, [user, loading, profile, router]);

  if (loading || !user || (profile?.role && profile.role !== "student")) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading your student account...</p>
      </main>
    );
  }

  return <MobileAppShell />;
}