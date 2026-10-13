import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const filePath = params.path.join("/");

    if (
      !filePath ||
      filePath.includes("..") ||
      filePath.includes("\\") ||
      !filePath.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Invalid PDF path" },
        { status: 400 }
      );
    }

    // Allow only published papers.
    const { data: paper, error: paperError } =
      await supabaseAdmin
        .from("previous_year_papers")
        .select("file_name, file_path")
        .eq("file_path", filePath)
        .eq("is_published", true)
        .maybeSingle();

    if (paperError) {
      console.error(paperError);

      return NextResponse.json(
        { error: "Unable to verify paper" },
        { status: 500 }
      );
    }

    if (!paper) {
      return NextResponse.json(
        { error: "Published paper not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin.storage
      .from("previous-year-papers")
      .download(paper.file_path);

    if (error || !data) {
      return NextResponse.json(
        { error: "Unable to load PDF" },
        { status: 404 }
      );
    }

    const download =
      request.nextUrl.searchParams.get("download") === "1";

    const fileName = (
      paper.file_name || "question-paper.pdf"
    )
      .replace(/[\r\n"\\/]/g, "_")
      .trim();

    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${
          download ? "attachment" : "inline"
        }; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PDF delivery error:", error);

    return NextResponse.json(
      { error: "Unable to load PDF" },
      { status: 500 }
    );
  }
}