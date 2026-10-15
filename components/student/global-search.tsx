
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  X,
  BookOpen,
  ClipboardCheck,
  Layers,
  FileText,
  Newspaper,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type SearchResult = {
  id: string;
  title: string;
  description: string;
  category: string;
  href: string;
  icon: "course" | "test" | "series" | "paper" | "article";
  meta?: string;
};

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 5;

function cleanText(value: string | null | undefined, max = 150) {
  const text = (value ?? "").trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function matchesQuery(query: string, ...values: (string | null | undefined)[]) {
  const normalized = query.toLowerCase().trim();
  return values.some((value) =>
    (value ?? "").toLowerCase().includes(normalized)
  );
}

function ResultIcon({ type }: { type: SearchResult["icon"] }) {
  const className = "h-5 w-5";

  switch (type) {
    case "course":
      return <BookOpen className={className} />;
    case "test":
      return <ClipboardCheck className={className} />;
    case "series":
      return <Layers className={className} />;
    case "paper":
      return <FileText className={className} />;
    case "article":
      return <Newspaper className={className} />;
  }
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const searchDatabase = useCallback(async (rawQuery: string) => {
    const term = rawQuery.trim();
    const currentRequest = ++requestId.current;

    if (term.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Search each table independently so one result type does not
      // prevent another type from appearing.
      const [
        coursesResponse,
        testsResponse,
        seriesResponse,
        papersResponse,
        blogsResponse,
        affairsResponse,
      ] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, description, category, slug")
          .eq("status", "active")
          .eq("admin_status", "published")
          .ilike("title", `%${term}%`)
          .limit(RESULT_LIMIT),

        supabase
          .from("mock_tests")
          .select("id, title, description, exam_name, category, slug")
          .eq("status", "published")
          .or(
            `title.ilike.%${term}%,exam_name.ilike.%${term}%,category.ilike.%${term}%`
          )
          .limit(RESULT_LIMIT),

        supabase
          .from("mock_test_series")
          .select(
            "id, title, description, exam_name, category, slug, price, is_free"
          )
          .eq("status", "published")
          .or(
            `title.ilike.%${term}%,exam_name.ilike.%${term}%,category.ilike.%${term}%`
          )
          .limit(RESULT_LIMIT),

        supabase
          .from("previous_year_papers")
          .select("id, title, exam_name, year, subject, description")
          .eq("is_published", true)
          .or(
            `title.ilike.%${term}%,exam_name.ilike.%${term}%,subject.ilike.%${term}%`
          )
          .limit(RESULT_LIMIT),

        supabase
          .from("blog_posts")
          .select("id, title, slug, excerpt, status")
          .eq("status", "published")
          .ilike("title", `%${term}%`)
          .limit(RESULT_LIMIT),

        supabase
          .from("current_affairs")
          .select("id, title, slug, short_description, status")
          .eq("status", "published")
          .ilike("title", `%${term}%`)
          .limit(RESULT_LIMIT),
      ]);

      if (currentRequest !== requestId.current) return;

      const responses = [
        coursesResponse,
        testsResponse,
        seriesResponse,
        papersResponse,
        blogsResponse,
        affairsResponse,
      ];

      // Log individual table errors to make RLS/schema issues visible.
      responses.forEach((response, index) => {
        if (response.error) {
          console.error(`Global search table ${index + 1}:`, response.error);
        }
      });

      const nextResults: SearchResult[] = [];

      for (const item of coursesResponse.data ?? []) {
        nextResults.push({
          id: `course-${item.id}`,
          title: item.title,
          description: cleanText(item.description || item.category),
          category: "Course",
          href: item.slug
            ? `/courses/${item.slug}`
            : "/dashboard/student/courses",
          icon: "course",
        });
      }

      for (const item of seriesResponse.data ?? []) {
        nextResults.push({
          id: `series-${item.id}`,
          title: item.title,
          description: cleanText(item.description),
          category: "Mock Test Series",
          href: item.slug
            ? `/mock-test-series/${item.slug}`
            : "/dashboard/student/mock-tests",
          icon: "series",
          meta: item.is_free ? "Free" : `₹${Number(item.price || 0)}`,
        });
      }

      for (const item of testsResponse.data ?? []) {
        nextResults.push({
          id: `test-${item.id}`,
          title: item.title,
          description: cleanText(item.description || item.category),
          category: "Individual Mock Test",
          href: item.slug
            ? `/mock-tests/${item.slug}`
            : "/dashboard/student/mock-tests",
          icon: "test",
          meta: item.exam_name,
        });
      }

      for (const item of papersResponse.data ?? []) {
        nextResults.push({
          id: `paper-${item.id}`,
          title: item.title,
          description: cleanText(
            [item.exam_name, item.year, item.subject, item.description]
              .filter(Boolean)
              .join(" · ")
          ),
          category: "Previous Year Paper",
          href: "/previous-year-papers",
          icon: "paper",
        });
      }

      for (const item of blogsResponse.data ?? []) {
        nextResults.push({
          id: `blog-${item.id}`,
          title: item.title,
          description: cleanText(item.excerpt),
          category: "Blog",
          href: `/blog/${item.slug}`,
          icon: "article",
        });
      }

      for (const item of affairsResponse.data ?? []) {
        nextResults.push({
          id: `affair-${item.id}`,
          title: item.title,
          description: cleanText(item.short_description),
          category: "Current Affairs",
          href: `/current-affairs/${item.slug}`,
          icon: "article",
        });
      }

      // If a short phrase appears inside a description rather than the
      // title, prioritize title matches but still include useful results.
      nextResults.sort((a, b) => {
        const aExact = a.title.toLowerCase().includes(term.toLowerCase());
        const bExact = b.title.toLowerCase().includes(term.toLowerCase());
        return Number(bExact) - Number(aExact);
      });

      setResults(nextResults.slice(0, 12));

      const hasError = responses.some((response) => response.error);
      if (hasError && nextResults.length === 0) {
        setError("Search could not load results. Check the browser console and Supabase permissions.");
      }
    } catch (err) {
      if (currentRequest !== requestId.current) return;

      console.error("Global search failed:", err);
      setError("Unable to search right now. Please try again.");
      setResults([]);
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (term.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void searchDatabase(term);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query, searchDatabase]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setError("");
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative z-50 w-full min-w-0">
      <div
        className={[
          "flex w-full items-center gap-3 rounded-2xl border bg-white px-4",
          "transition focus-within:border-blue-500 focus-within:ring-2",
          "focus-within:ring-blue-100",
          open ? "border-blue-400 shadow-md" : "border-slate-200 shadow-sm",
        ].join(" ")}
      >
        <Search className="h-5 w-5 shrink-0 text-slate-500" />

        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search courses, mock test series, papers..."
          aria-label="Search courses, mock tests, test series and papers"
          aria-expanded={open}
          aria-autocomplete="list"
          className="h-11 w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />

        {loading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
        )}

        {query && !loading && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.trim().length >= MIN_QUERY_LENGTH && (
        <div className="absolute left-0 right-0 top-full mt-2 max-h-[min(70vh,480px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching LearnPathshala...
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-red-600">{error}</p>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              No matching courses, mock tests, series or papers found.
              <p className="mt-1 text-xs">
                Try a shorter search, such as “CHSL”, “SSC” or “Maths”.
              </p>
            </div>
          ) : (
            <div className="py-2">
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search results ({results.length})
              </p>

              {results.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <ResultIcon type={item.icon} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </span>

                      {item.meta && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {item.meta}
                        </span>
                      )}
                    </span>

                    <span className="mt-1 block text-xs font-medium text-blue-700">
                      {item.category}
                    </span>

                    {item.description && (
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {item.description}
                      </span>
                    )}
                  </span>

                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
