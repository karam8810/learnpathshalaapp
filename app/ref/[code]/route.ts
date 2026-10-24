
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "lp_referral_code";
const COOKIE_DAYS = 30;

export async function GET(
  request: NextRequest,
  context: { params: { code: string } }
) {
  try {
    const code = decodeURIComponent(context.params.code || "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9]{3,16}$/.test(code)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Referral tracking must be enabled.
    const { data: settings, error: settingsError } =
      await supabaseAdmin
        .from("teacher_referral_settings")
        .select("enabled, attribution_days")
        .eq("id", 1)
        .maybeSingle();

    if (settingsError || !settings?.enabled) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Find an active referral code.
    const { data: referral, error: referralError } =
      await supabaseAdmin
        .from("teacher_referral_codes")
        .select("teacher_id, code, is_active")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();

    if (referralError || !referral) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // A teacher cannot refer themselves.
    // The visitor will still be redirected, but no click is recorded
    // if their authenticated account is the referring teacher.
    const bearer = request.headers.get("authorization");
    let authenticatedUserId: string | null = null;

    if (bearer?.startsWith("Bearer ")) {
      const token = bearer.slice(7);

      const { data } = await supabaseAdmin.auth.getUser(token);
      authenticatedUserId = data.user?.id ?? null;
    }

    const response = NextResponse.redirect(new URL("/", request.url));

    if (authenticatedUserId === referral.teacher_id) {
      response.cookies.delete(COOKIE_NAME);
      return response;
    }

    // Hash IP + user agent; do not store raw IP addresses.
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const visitorHash = createHash("sha256")
      .update(`${ip}|${userAgent}`)
      .digest("hex");

    const landingPath = "/";
    const { error: clickError } = await supabaseAdmin
      .from("teacher_referral_clicks")
      .insert({
        teacher_id: referral.teacher_id,
        referral_code: referral.code,
        visitor_hash: visitorHash,
        landing_path: landingPath,
      });

    if (clickError) {
      console.error("Referral click insert failed:", clickError.message);
      // Do not block a valid referral because analytics failed.
    }

    const configuredDays = Number(settings.attribution_days);
    const days =
      Number.isFinite(configuredDays) && configuredDays > 0
        ? Math.min(Math.floor(configuredDays), 90)
        : COOKIE_DAYS;

    response.cookies.set(COOKIE_NAME, referral.code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: days * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Referral route failed:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
