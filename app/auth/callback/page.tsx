
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

const REQUEST_TIMEOUT_MS = 10000;

function withTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out. Please try again.`)),
      timeoutMs
    );

    Promise.resolve(promise).then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function getSafeRedirect(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.startsWith("/auth/callback")
  ) {
    return null;
  }

  return value;
}

export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState("Completing Google sign-in...");

  useEffect(() => {
    // React Strict Mode can run effects twice in development.
    // Do not cancel the first valid attempt during its simulated cleanup.
    if (started.current) return;
    started.current = true;

    async function completeGoogleLogin() {
      try {
        const { data, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          "Session verification"
        );

        if (sessionError) throw sessionError;

        const session = data.session;
        const user = session?.user;

        if (!session || !user) {
          throw new Error(
            "Google sign-in could not be verified. Please return to login and try again."
          );
        }

        const params = new URLSearchParams(window.location.search);
        const isStudentApp = params.get("app") === "student";
        const safeRedirect = getSafeRedirect(params.get("redirect"));

        setMessage("Verifying your account...");

        const { data: existingProfile, error: profileError } =
          await withTimeout(
            supabase
              .from("profiles")
              .select("id, role")
              .eq("id", user.id)
              .maybeSingle(),
            "Profile lookup"
          );

        if (profileError) {
          console.error("[AUTH CALLBACK] Profile lookup failed:", profileError);
          throw new Error("Unable to verify your profile. Please try again.");
        }

        let profile = existingProfile;

        if (!profile) {
          const metadata = user.user_metadata ?? {};
          const fullName =
            metadata.full_name ||
            metadata.name ||
            user.email?.split("@")[0] ||
            "Student";

          // New Google accounts receive the least-privileged role.
          // Existing profiles and their roles are never overwritten.
          const { error: insertError } = await withTimeout(
            supabase.from("profiles").upsert(
              {
                id: user.id,
                full_name: String(fullName),
                email: user.email ?? "",
                avatar_url: metadata.avatar_url || metadata.picture || null,
                role: "student",
              },
              {
                onConflict: "id",
                ignoreDuplicates: true,
              }
            ),
            "Profile creation"
          );

          if (insertError) {
            console.error(
              "[AUTH CALLBACK] Profile creation failed:",
              insertError
            );
            throw new Error(
              "Your Google account is signed in, but its profile could not be created. Check your profile table permissions or database trigger."
            );
          }

          const { data: reloadedProfile, error: reloadError } =
            await withTimeout(
              supabase
                .from("profiles")
                .select("id, role")
                .eq("id", user.id)
                .maybeSingle(),
              "Profile verification"
            );

          if (reloadError || !reloadedProfile) {
            throw new Error(
              "Your profile could not be loaded. Please try again."
            );
          }

          profile = reloadedProfile;
        }

        if (!profile || !["student", "teacher", "admin"].includes(profile.role)) {
          throw new Error("Your account has an invalid or missing role.");
        }

        if (isStudentApp && profile.role !== "student") {
          await supabase.auth.signOut();
          throw new Error(
            "Only student accounts can access the LearnPathshala student app."
          );
        }

        // Do not let a referral API delay the login redirect.
        if (profile.role === "student") {
          void fetch("/api/referrals/claim", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            signal: AbortSignal.timeout(3000),
          }).catch((error) => {
            console.warn("[AUTH CALLBACK] Referral claim skipped:", error);
          });
        }

        toast.success("Google sign-in successful!");

        const destination = isStudentApp
          ? "/dashboard/student"
          : safeRedirect ?? `/dashboard/${profile.role}`;

        // Replace callback history so Back does not reopen the callback.
        window.location.replace(destination);
      } catch (error) {
        console.error("[AUTH CALLBACK] Sign-in failed:", error);

        const errorMessage =
          error instanceof Error
            ? error.message
            : "Google sign-in failed. Please try again.";

        setMessage(errorMessage);
        toast.error(errorMessage);

        window.setTimeout(() => {
          router.replace("/login");
        }, 2500);
      }
    }

    void completeGoogleLogin();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
          <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
        </div>

        <h1 className="text-xl font-bold text-slate-900">LearnPathshala</h1>
        <p className="mt-2 text-sm text-slate-600" role="status">
          {message}
        </p>
      </div>
    </main>
  );
}
