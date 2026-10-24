
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "lp_referral_code";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    // Authenticate the student using their Supabase access token.
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Please log in before claiming a referral." },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice(7);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid. Please log in again." },
        { status: 401 }
      );
    }

    // Only student accounts can claim a referral.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "student") {
      return NextResponse.json(
        { error: "Only student accounts can claim referrals." },
        { status: 403 }
      );
    }

    // Read the HTTP-only cookie set by /ref/[code].
    const cookieStore = cookies();
    const code = cookieStore.get(COOKIE_NAME)?.value?.toUpperCase();

    if (!code || !/^[A-Z0-9]{3,16}$/.test(code)) {
      return NextResponse.json(
        { error: "No valid referral was found." },
        { status: 400 }
      );
    }

    const { data: settings, error: settingsError } =
      await supabaseAdmin
        .from("teacher_referral_settings")
        .select("enabled, attribution_days")
        .eq("id", 1)
        .maybeSingle();

    if (settingsError || !settings?.enabled) {
      return NextResponse.json(
        { error: "Referral tracking is currently disabled." },
        { status: 403 }
      );
    }

    const { data: referral, error: referralError } =
      await supabaseAdmin
        .from("teacher_referral_codes")
        .select("teacher_id, code, is_active")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();

    if (referralError || !referral) {
      return NextResponse.json(
        { error: "This referral link is invalid or inactive." },
        { status: 400 }
      );
    }

    if (referral.teacher_id === user.id) {
      return NextResponse.json(
        { error: "You cannot use your own referral link." },
        { status: 400 }
      );
    }

    // Do not overwrite a student's existing attribution.
    const { data: existing, error: existingError } =
      await supabaseAdmin
        .from("teacher_referral_attributions")
        .select("id, teacher_id, referral_code, expires_at")
        .eq("student_id", user.id)
        .maybeSingle();

    if (existingError) {
      console.error("Referral lookup failed:", existingError.message);
      return NextResponse.json(
        { error: "Unable to check your existing referral." },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyAttributed: true,
        message: "Your existing referral attribution was preserved.",
      });
    }

    const configuredDays = Number(settings.attribution_days);
    const days =
      Number.isFinite(configuredDays) && configuredDays > 0
        ? Math.min(Math.floor(configuredDays), 90)
        : 30;

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + days * 24 * 60 * 60 * 1000
    );

    const { error: insertError } = await supabaseAdmin
      .from("teacher_referral_attributions")
      .insert({
        student_id: user.id,
        teacher_id: referral.teacher_id,
        referral_code: referral.code,
        attributed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        source: "ref_link",
      });

    if (insertError) {
      // A database uniqueness constraint may reject a concurrent claim.
      // Do not overwrite or reassign the student's referral.
      console.error("Referral attribution insert failed:", insertError.message);

      const { data: winner } = await supabaseAdmin
        .from("teacher_referral_attributions")
        .select("id")
        .eq("student_id", user.id)
        .maybeSingle();

      if (winner) {
        return NextResponse.json({
          success: true,
          alreadyAttributed: true,
          message: "Your existing referral attribution was preserved.",
        });
      }

      return NextResponse.json(
        { error: "Unable to save referral attribution." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Referral saved successfully.",
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Referral claim failed:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while claiming the referral." },
      { status: 500 }
    );
  }
}
