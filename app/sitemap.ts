
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

type SitemapEntry = {
  slug: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const staticPages = [
  "",
  "/about",
  "/contact",
  "/blogs",
  "/courses",
  "/mock-tests",
  "/current-affairs",
  "/previous-year-papers",
  "/privacy-policy",
  "/terms-and-conditions",
  "/refund-cancellation",
];

async function getPublishedUrls(
  table: string,
  route: string,
): Promise<MetadataRoute.Sitemap> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from(table)
      .select("slug, updated_at, published_at, created_at")
      .eq("status", "published")
      .not("slug", "is", null);

    if (error) {
      console.error(`Sitemap query failed for ${table}:`, error.message);
      return [];
    }

    return ((data ?? []) as SitemapEntry[])
      .filter((item) => Boolean(item.slug))
      .map((item) => ({
        url: `${SITE_URL}${route}/${item.slug}`,
        lastModified:
          item.updated_at ??
          item.published_at ??
          item.created_at ??
          new Date().toISOString(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch (error) {
    console.error(`Sitemap error for ${table}:`, error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  const [blogs, papers, mockTests, courses, currentAffairs] =
    await Promise.all([
      getPublishedUrls("blog_posts", "/blog"),
      getPublishedUrls("previous_year_papers", "/previous-year-papers"),
      getPublishedUrls("mock_test_series", "/mock-tests"),
      getPublishedUrls("courses", "/courses"),

      // Replace with your real current-affairs table name.
      getPublishedUrls("current_affairs", "/current-affairs"),
    ]);

  return [
    ...pages,
    ...blogs,
    ...papers,
    ...mockTests,
    ...courses,
    ...currentAffairs,
  ];
}
