import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/sonner';
import { createSEO, SITE_URL, SITE_NAME } from "@/lib/seo";
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  ...createSEO({
    title: "LearnPathshala - Learn. Practice. Succeed.",
    description:
      "LearnPathshala is a modern learning platform for competitive exams, courses, mock tests, quizzes, and interactive learning.",
    path: "/",
    keywords: [
      "LearnPathshala",
      "online learning",
      "competitive exams",
      "mock tests",
      "online courses",
      "quizzes",
      "SSC",
      "government exams",
      "exam preparation",
    ],
  }),

  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  category: "education",
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,

  openGraph: {
    ...createSEO({
      title: "LearnPathshala - Learn. Practice. Succeed.",
      description:
        "Prepare for competitive exams with courses, mock tests, quizzes, and structured learning on LearnPathshala.",
      path: "/",
    }).openGraph,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}