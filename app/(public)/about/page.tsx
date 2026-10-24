import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Award, BookOpen, Brain, CheckCircle2, ClipboardCheck,
  GraduationCap, Heart, Sparkles, Target, Trophy, Users, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About LearnPathshala | Online Learning & Exam Preparation",
  description:
    "Meet Shantanu Bhora, BCA graduate and founder of LearnPathshala, an online learning platform for courses, mock tests, quizzes and competitive exam preparation.",
  keywords: [
    "LearnPathshala", "About LearnPathshala", "Shantanu Bhora",
    "LearnPathshala founder", "BCA graduate", "competitive exam preparation",
    "online courses", "mock tests", "live classes", "online quizzes",
  ],
  openGraph: {
    title: "About LearnPathshala | Learn. Practice. Succeed.",
    description:
      "Discover LearnPathshala's mission to make structured learning and exam preparation more accessible.",
    type: "website",
    siteName: "LearnPathshala",
    url: "https://learnpathshala.com/about",
  },
  twitter: {
    card: "summary_large_image",
    title: "About LearnPathshala | Online Learning Platform",
    description:
      "Learn about LearnPathshala, its mission and founder Shantanu Bhora.",
  },
  alternates: { canonical: "/about" },
  robots: { index: true, follow: true },
};

const features = [
  { icon: BookOpen, title: "Structured Courses", text: "Build your knowledge through organized, step-by-step learning." },
  { icon: ClipboardCheck, title: "Mock Tests", text: "Practise exam-style questions and review your performance." },
  { icon: Brain, title: "Interactive Practice", text: "Strengthen concepts with quizzes and regular practice." },
  { icon: Video, title: "Live Learning", text: "Learn and interact through classes and educator-led sessions." },
];

const values = [
  { icon: Target, title: "Quality Learning", text: "Useful learning resources designed around student needs." },
  { icon: Heart, title: "Student First", text: "A simple, accessible experience that supports consistent progress." },
  { icon: Users, title: "Empowering Educators", text: "Tools for educators to share knowledge with learners." },
  { icon: Award, title: "Continuous Improvement", text: "Improving our platform and learning tools as needs evolve." },
];

const buttonClass = "h-12 rounded-xl bg-gradient-to-r from-[#063B8F] to-[#0B63CE] px-6 font-bold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:from-[#052f73] hover:to-[#084fa8]";
const outlineClass = "h-12 rounded-xl border-2 border-[#063B8F]/25 bg-white px-6 font-bold text-[#063B8F] transition hover:border-[#F5A623] hover:bg-amber-50";

export default function AboutPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-amber-50 px-4 py-20 sm:px-6 lg:py-24">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-[#063B8F] shadow-sm">
            <Sparkles className="h-4 w-4 text-[#F5A623]" /> Learn • Practice • Succeed
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#063B8F] sm:text-5xl lg:text-6xl">About LearnPathshala</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
            LearnPathshala is an online learning platform built to make education, practice and competitive exam preparation more structured, accessible and engaging.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className={buttonClass}><Link href="/courses">Explore Courses <ArrowRight className="ml-2 h-5 w-5" /></Link></Button>
            <Button asChild size="lg" variant="outline" className={outlineClass}><Link href="/mock-tests"><ClipboardCheck className="mr-2 h-5 w-5" />Explore Mock Tests</Link></Button>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-[#F5A623]">Our Story</p>
            <h2 className="text-3xl font-extrabold text-[#063B8F] sm:text-4xl">Building a better way to learn</h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              LearnPathshala was created with a simple idea: learning should be accessible, structured and focused on real student needs.
            </p>
            <p className="mt-4 leading-8 text-slate-600">
              By bringing courses, mock tests, quizzes and learning resources together, we aim to help students organize their preparation, strengthen concepts and practise consistently.
            </p>
          </div>
          <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-7 shadow-lg sm:p-9">
            <div className="flex justify-center">
              <Image src="/learnpathshalalogo.png" alt="LearnPathshala logo" width={360} height={180} priority className="h-auto max-h-44 w-auto object-contain" />
            </div>
            <div className="mt-7 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm"><BookOpen className="h-7 w-7 text-[#063B8F]" /><p className="mt-3 font-bold text-[#063B8F]">Learn</p><p className="mt-1 text-sm text-slate-500">Structured courses</p></div>
              <div className="rounded-2xl bg-white p-5 shadow-sm"><Trophy className="h-7 w-7 text-[#F5A623]" /><p className="mt-3 font-bold text-[#063B8F]">Practise</p><p className="mt-1 text-sm text-slate-500">Tests and quizzes</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-[#063B8F] to-[#0B63CE] py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-full max-w-[340px] overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl sm:max-w-[380px]">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/shantanubhoraimg.jpg"
                  alt="Shantanu Bhora, BCA graduate and founder of LearnPathshala"
                  fill
                  priority
                  sizes="(max-width: 640px) 340px, 380px"
                  className="object-cover object-[center_18%]"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent px-5 pb-5 pt-16">
                <p className="text-lg font-bold text-white">Shantanu Bhora</p>
                <p className="mt-1 text-sm font-medium text-blue-100">BCA Graduate · Founder</p>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-amber-300"><Sparkles className="h-4 w-4" /> Founder & Vision</div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Meet the Founder</h2>
            <h3 className="mt-3 text-3xl font-extrabold text-amber-300">Shantanu Bhora</h3>
            <p className="mt-2 font-semibold text-white">Bachelor of Computer Applications (BCA) Graduate</p>
            <p className="mt-5 text-lg leading-8 text-blue-100">
              Shantanu Bhora is a BCA graduate and the founder of LearnPathshala. With a background in computer applications and an interest in technology-driven education, he is building a platform that brings exam practice and online learning together.
            </p>
            <p className="mt-4 leading-8 text-blue-100">
              His vision is to help students access structured courses, mock tests, quizzes and learning resources in one place, so they can practise consistently and prepare with greater confidence.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {["Student First", "Technology-led Learning", "Accessible Education"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-medium"><CheckCircle2 className="h-5 w-5 shrink-0 text-amber-300" />{item}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-white to-blue-50 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50"><Target className="h-7 w-7 text-[#063B8F]" /></div>
          <p className="mt-5 text-sm font-bold uppercase tracking-wider text-[#F5A623]">Our Mission</p>
          <h2 className="mt-2 text-3xl font-extrabold text-[#063B8F] sm:text-4xl">Making learning more accessible and effective</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Our mission is to give students access to useful educational content, structured courses and practice tools that support consistent learning and confident exam preparation.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-wider text-[#F5A623]">Learning Experience</p><h2 className="mt-2 text-3xl font-extrabold text-[#063B8F] sm:text-4xl">Tools to keep you moving forward</h2><p className="mt-4 text-lg text-slate-600">Explore learning and practice resources in one place.</p></div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-100 hover:shadow-lg"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50"><Icon className="h-6 w-6 text-[#063B8F]" /></div><h3 className="mt-5 font-bold text-[#063B8F]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-wider text-[#F5A623]">Our Values</p><h2 className="mt-2 text-3xl font-extrabold text-[#063B8F] sm:text-4xl">What we stand for</h2><p className="mt-4 text-slate-600">The principles that guide how we build LearnPathshala.</p></div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#063B8F] to-[#0B63CE]"><Icon className="h-6 w-6 text-white" /></div><h3 className="mt-5 font-bold text-[#063B8F]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-blue-50 via-white to-amber-50 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow"><GraduationCap className="h-7 w-7 text-[#063B8F]" /></div>
          <h2 className="mt-5 text-3xl font-extrabold text-[#063B8F] sm:text-4xl">Ready to start your learning journey?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">Explore courses, practise with mock tests and take the next step toward your learning goals.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg" className={buttonClass}><Link href="/register">Get Started <ArrowRight className="ml-2 h-5 w-5" /></Link></Button><Button asChild size="lg" variant="outline" className={outlineClass}><Link href="/courses">Browse Courses</Link></Button></div>
        </div>
      </section>
    </main>
  );
}
