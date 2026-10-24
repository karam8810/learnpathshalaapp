
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  BookOpen,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5) scale(1 0.85)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.65 5.94c4.47-4.13 7.12-10.2 7.12-17.59Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" transform="translate(1 0)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.65-5.94c-2.13 1.43-4.86 2.27-8.25 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.2C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -1)" />
    </svg>
  );
}

function BrandFeature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#FFB52E] ring-1 ring-white/10">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-white">{title}</h3>
        <p className="mt-0.5 text-sm text-blue-100">{description}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isStudentApp = searchParams.get("app") === "student";
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Only accept internal paths to prevent open redirects.
  const getSafeRedirect = () => {
    if (
      !redirectParam ||
      !redirectParam.startsWith("/") ||
      redirectParam.startsWith("//") ||
      redirectParam.includes("\\")
    ) {
      return null;
    }

    return redirectParam;
  };

  const claimReferral = async (accessToken: string) => {
    try {
      const response = await fetch("/api/referrals/claim", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        console.info("Referral claim:", result.message);
      } else {
        // No referral cookie is normal for most students.
        console.info("Referral not claimed:", result.error);
      }
    } catch (error) {
      // Referral failures must not block login.
      console.error("Referral claim failed:", error);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (!data.user || !data.session) {
        toast.error("Unable to sign in. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
      }

      // Preserve existing website behavior.
      const role = profile?.role || "student";

      if (isStudentApp) {
        if (profileError || !profile || profile.role !== "student") {
          await supabase.auth.signOut();
          toast.error(
            "Only student accounts can access the LearnPathshala app."
          );
          return;
        }

        await claimReferral(data.session.access_token);
        toast.success("Welcome back!");
        router.replace("/dashboard/student");
        return;
      }

      if (role === "student") {
        await claimReferral(data.session.access_token);
      }

      toast.success("Welcome back!");

      const safeRedirect = getSafeRedirect();

      router.replace(safeRedirect || `/dashboard/${role}`);
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Something went wrong while signing in.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      const callbackUrl = new URL(
        "/auth/callback",
        window.location.origin
      );

      if (isStudentApp) {
        callbackUrl.searchParams.set("app", "student");
      }

      const safeRedirect = getSafeRedirect();

      if (safeRedirect) {
        callbackUrl.searchParams.set("redirect", safeRedirect);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
      }
      // On success, the browser redirects to Google.
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast.error("Unable to start Google sign-in.");
      setLoading(false);
    }
  };

  const registerHref = isStudentApp
    ? "/register?app=student"
    : redirectParam
      ? `/register?redirect=${encodeURIComponent(redirectParam)}`
      : "/register";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Left branding panel */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#063B8F] p-12 lg:flex">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-[#0B63CE]/40 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-[#F5A623]/20 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
          </div>

          <Link
            href="/"
            className="relative z-10 inline-flex w-fit items-center gap-3"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg">
              <img
                src="/learnpathshalalogo.png"
                alt="LearnPathshala"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-white">
                LearnPathshala
              </div>
              <div className="text-xs font-medium text-blue-100">
                Learn. Practice. Succeed.
              </div>
            </div>
          </Link>

          <div className="relative z-10 max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
              Your learning journey starts here
            </div>

            <h1 className="text-4xl font-extrabold leading-tight text-white xl:text-5xl">
              Welcome back to your
              <span className="block text-[#FFB52E]">
                learning journey.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">
              Sign in to access your courses, mock tests, dashboard and
              continue your preparation with LearnPathshala.
            </p>

            <div className="mt-10 space-y-4">
              <BrandFeature
                icon={<BookOpen className="h-5 w-5" />}
                title="Learn at your pace"
                description="Access your courses and learning resources."
              />
              <BrandFeature
                icon={<Trophy className="h-5 w-5" />}
                title="Practice with mock tests"
                description="Improve your speed and exam preparation."
              />
              <BrandFeature
                icon={<Users className="h-5 w-5" />}
                title="Built for learners"
                description="A focused platform for competitive exam preparation."
              />
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6">
            <p className="text-sm text-blue-100">
              © {new Date().getFullYear()} LearnPathshala
            </p>
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
              Learn. Practice. Succeed.
            </div>
          </div>
        </section>

        {/* Login panel */}
        <section className="flex w-full items-center justify-center px-4 py-10 sm:px-6 lg:w-1/2 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <Link
                href="/"
                className="mb-5 inline-flex items-center gap-3 lg:hidden"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-slate-200">
                  <img
                    src="/learnpathshalalogo.png"
                    alt="LearnPathshala"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="text-left">
                  <div className="text-xl font-extrabold text-[#063B8F]">
                    LearnPathshala
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    Learn. Practice. Succeed.
                  </div>
                </div>
              </Link>

              <div className="mb-6 hidden justify-center lg:flex">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-slate-200">
                  <img
                    src="/learnpathshalalogo.png"
                    alt="LearnPathshala"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to your LearnPathshala account to continue learning.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
              {/* Google login */}
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="h-12 w-full rounded-xl border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </Button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase text-slate-400">
                  Or continue with email
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-semibold text-slate-700"
                  >
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      disabled={loading}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 focus:border-[#0B63CE] focus:bg-white focus:ring-[#0B63CE]/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="font-semibold text-slate-700"
                    >
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-[#0B63CE] transition hover:text-[#063B8F]"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      disabled={loading}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 focus:border-[#0B63CE] focus:bg-white focus:ring-[#0B63CE]/20"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-[#063B8F] font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-[#0B63CE]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">
                  Don&apos;t have an account?{" "}
                  <Link
                    href={registerHref}
                    className="font-bold text-[#0B63CE] transition hover:text-[#063B8F]"
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Secure login powered by LearnPathshala
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
