
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function MobileStudentPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function checkStudentSession() {
      try {
        // 1. Check whether a user is logged in
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError || !session) {
          router.replace(
            "/login?app=student&redirect=%2Fdashboard%2Fstudent"
          );
          return;
        }

        // 2. Verify the user's role from the profiles table
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!active) return;

        if (
          profileError ||
          !profile ||
          profile.role !== "student"
        ) {
          await supabase.auth.signOut();

          if (active) {
            router.replace("/login?app=student");
          }

          return;
        }

        // 3. Open the existing student dashboard
        router.replace("/dashboard/student");
      } catch (error) {
        console.error("Mobile app session check failed:", error);

        if (active) {
          router.replace("/login?app=student");
        }
      }
    }

    void checkStudentSession();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

        <h1 className="text-xl font-bold text-slate-900">
          LearnPathshala
        </h1>

        <p className="text-sm text-slate-600">
          Preparing your student dashboard...
        </p>
      </div>
    </main>
  );
}
