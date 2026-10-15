import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  Tag,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://learnpathshala.com";
const SITE_NAME = "LearnPathshala";

type PageProps = {
  // Next.js 13.5 App Router uses synchronous params.
  params: {
    slug: string;
  };
};

type BlogCategory = {
  id: string;
  name: string;
  slug: string;
};

type BlogTag = {
  id: string;
  name: string;
  slug: string;
};

type BlogAuthor = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  featured_image_alt: string | null;
  published_at: string | null;
  updated_at: string | null;
  reading_time: number | null;
  meta_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  robots_index: boolean | null;
  robots_follow: boolean | null;
  schema_type: string | null;
  category: BlogCategory | BlogCategory[] | null;
  author: BlogAuthor | BlogAuthor[] | null;
  blog_post_tags: Array<{
    tag: BlogTag | BlogTag[] | null;
  }> | null;
};

function absoluteUrl(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;

  try {
    return new URL(value, SITE_URL).toString();
  } catch {
    return undefined;
  }
}

function getCanonical(post: BlogPost): string {
  // Respect an explicitly configured canonical URL; otherwise use this site's route.
  return absoluteUrl(post.canonical_url) ??
    `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`;
}

function getRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function getPlainDescription(post: BlogPost): string {
  const value = post.meta_description || post.excerpt || `Read ${post.title} on ${SITE_NAME}.`;
  return value.replace(/\s+/g, " ").trim().slice(0, 300);
}

/* -------------------------------------------------------------------------- */
/* Fetch a published blog post                                                */
/* -------------------------------------------------------------------------- */

async function getPost(slug: string): Promise<BlogPost | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blog_posts")
    .select(`
      id,
      title,
      slug,
      excerpt,
      content,
      featured_image,
      featured_image_alt,
      published_at,
      updated_at,
      reading_time,
      meta_title,
      meta_description,
      focus_keyword,
      canonical_url,
      og_title,
      og_description,
      og_image,
      twitter_title,
      twitter_description,
      twitter_image,
      robots_index,
      robots_follow,
      schema_type,
      category:blog_categories(
        id,
        name,
        slug
      ),
      author:profiles(
        id,
        full_name,
        avatar_url
      ),
      blog_post_tags(
        tag:blog_tags(
          id,
          name,
          slug
        )
      )
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("Blog detail query failed:", error.message);
    return null;
  }

  return (data as unknown as BlogPost | null) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Dynamic SEO metadata                                                       */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const post = await getPost(params.slug);

  if (!post) {
    return {
      title: `Blog Not Found | ${SITE_NAME}`,
      description: "The requested blog article could not be found.",
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
    };
  }

  const title = post.meta_title?.trim() || `${post.title} | ${SITE_NAME}`;
  const description = getPlainDescription(post);
  const canonical = getCanonical(post);
  const image = absoluteUrl(
    post.og_image || post.twitter_image || post.featured_image,
  );

  return {
    title,
    description,
    ...(post.focus_keyword
      ? { keywords: [post.focus_keyword] }
      : {}),
    alternates: {
      canonical,
    },
    robots: {
      index: post.robots_index ?? true,
      follow: post.robots_follow ?? true,
      googleBot: {
        index: post.robots_index ?? true,
        follow: post.robots_follow ?? true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: post.og_title?.trim() || title,
      description: post.og_description?.trim() || description,
      url: canonical,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "article",
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
      ...(post.updated_at ? { modifiedTime: post.updated_at } : {}),
      ...(image
        ? {
            images: [
              {
                url: image,
                width: 1200,
                height: 630,
                alt: post.featured_image_alt || post.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.twitter_title?.trim() || post.og_title?.trim() || title,
      description:
        post.twitter_description?.trim() ||
        post.og_description?.trim() ||
        description,
      ...(image ? { images: [absoluteUrl(post.twitter_image) || image] } : {}),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Blog detail page                                                           */
/* -------------------------------------------------------------------------- */

export default async function BlogDetailPage({ params }: PageProps) {
  const post = await getPost(params.slug);

  if (!post) {
    notFound();
  }

  const category = getRelation(post.category);
  const author = getRelation(post.author);

  const tags = (post.blog_post_tags ?? [])
    .map((item) => getRelation(item.tag))
    .filter((tag): tag is BlogTag => Boolean(tag));

  const canonical = getCanonical(post);
  const description = getPlainDescription(post);
  const featuredImage = absoluteUrl(post.featured_image);
  const publishedDate = post.published_at
    ? new Date(post.published_at)
    : null;
  const modifiedDate = post.updated_at || post.published_at || null;

  const schemaType = post.schema_type || "Article";
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": schemaType,
    headline: post.title,
    description,
    ...(featuredImage ? { image: [featuredImage] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    ...(modifiedDate ? { dateModified: modifiedDate } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    author: {
      "@type": author?.full_name ? "Person" : "Organization",
      name: author?.full_name || SITE_NAME,
      ...(author?.avatar_url
        ? { image: absoluteUrl(author.avatar_url) }
        : {}),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    ...(category?.name ? { articleSection: category.name } : {}),
    ...(post.focus_keyword ? { keywords: post.focus_keyword } : {}),
  };

  // Escape "<" to prevent a content string from closing the script element.
  const safeArticleSchema = JSON.stringify(articleSchema).replace(/</g, "\\u003c");

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeArticleSchema }}
      />

      <article>
        <header className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
            <Link
              href="/blog"
              className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#063B8F]"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Blog
            </Link>

            {category && (
              <div className="mb-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#063B8F]">
                  <BookOpen size={14} aria-hidden="true" />
                  {category.name}
                </span>
              </div>
            )}

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-600">
                {post.excerpt}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-slate-500">
              {publishedDate && !Number.isNaN(publishedDate.getTime()) && (
                <time
                  className="flex items-center gap-2"
                  dateTime={post.published_at ?? undefined}
                >
                  <CalendarDays size={16} aria-hidden="true" />
                  {publishedDate.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
              )}

              {post.reading_time && post.reading_time > 0 && (
                <span className="flex items-center gap-2">
                  <Clock size={16} aria-hidden="true" />
                  {post.reading_time} min read
                </span>
              )}

              {author?.full_name && (
                <span>
                  By{" "}
                  <strong className="text-slate-700">
                    {author.full_name}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </header>

        {featuredImage && (
          <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
            <div className="relative aspect-[16/8] overflow-hidden rounded-3xl bg-slate-100">
              <Image
                src={featuredImage}
                alt={post.featured_image_alt?.trim() || post.title}
                fill
                priority
                sizes="(max-width: 1200px) 100vw, 1200px"
                className="object-cover"
              />
            </div>
          </div>
        )}

        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-lg leading-8 text-slate-700">
            {post.content.split(/\n+/).map((paragraph, index) => {
              const text = paragraph.trim();
              if (!text) return null;

              return (
                <p key={`${index}-${text.slice(0, 24)}`} className="mb-5">
                  {text}
                </p>
              );
            })}
          </div>

          {tags.length > 0 && (
            <div className="mt-12 border-t border-slate-200 pt-7">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <Tag size={16} aria-hidden="true" />
                Tags
              </div>

              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 rounded-xl bg-[#063B8F] px-5 py-3 text-sm font-bold text-white hover:bg-[#052f70]"
          >
            Explore More Articles
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
