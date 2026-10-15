
import type { Metadata } from "next";

export const SITE_URL = "https://learnpathshala.com";
export const SITE_NAME = "LearnPathshala";

export function createSEO({
  title,
  description,
  path = "/",
  image,
  noIndex = false,
  keywords = [],
}: {
  title: string;
  description: string;
  path?: string;
  image?: string | null;
  noIndex?: boolean;
  keywords?: string[];
}): Metadata {
  const url = new URL(path, SITE_URL).toString();
  const imageUrl = image
    ? new URL(image, SITE_URL).toString()
    : undefined;

  return {
    title,
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: {
      canonical: url,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-image-preview": "large",
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "website",
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}
