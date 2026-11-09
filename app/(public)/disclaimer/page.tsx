
import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  BookOpen,
  GraduationCap,
  FileText,
  ExternalLink,
  Info,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Mail,
  Scale,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Disclaimer | LearnPathshala",
  description:
    "Read the LearnPathshala Disclaimer covering educational content, mock tests, courses, current affairs, previous year papers, third-party links and user responsibilities.",
  alternates: {
    canonical: "https://learnpathshala.com/disclaimer",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const sections = [
  { id: "educational-purpose", title: "Educational Purpose" },
  { id: "exam-results", title: "No Guarantee of Exam Results" },
  { id: "accuracy", title: "Accuracy of Information" },
  { id: "current-affairs", title: "Current Affairs & News" },
  { id: "previous-papers", title: "Previous Year Papers" },
  { id: "mock-tests", title: "Mock Tests & Practice Questions" },
  { id: "courses", title: "Courses & Teachers" },
  { id: "external-links", title: "External Links" },
  { id: "government-affiliation", title: "Government Affiliation" },
  { id: "intellectual-property", title: "Intellectual Property" },
  { id: "user-responsibility", title: "User Responsibility" },
  { id: "payments", title: "Payments & Digital Products" },
  { id: "availability", title: "Technical Availability" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "changes", title: "Changes to This Disclaimer" },
  { id: "contact", title: "Contact Us" },
];

function PolicySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 border-b border-slate-100 py-8 last:border-0"
    >
      <h2 className="mb-4 text-xl font-bold tracking-tight text-[#103575] sm:text-2xl">
        {title}
      </h2>
      <div className="space-y-4 text-[15px] leading-8 text-slate-600">
        {children}
      </div>
    </section>
  );
}

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-[#f8faff]">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-br from-[#eef5ff] via-white to-[#fffaf0]">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#1255b5]">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <ChevronRight size={15} />
            <span className="text-slate-500">Disclaimer</span>
          </div>

          <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d47a1] text-white shadow-lg shadow-blue-900/20">
              <ShieldCheck size={29} />
            </div>

            <div>
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1255b5]">
                <Scale size={14} />
                Transparency & Trust
              </span>

              <h1 className="text-4xl font-extrabold tracking-tight text-[#103575] sm:text-5xl lg:text-6xl">
                Disclaimer
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Important information about our educational content,
                courses, mock tests and services. Please read this
                disclaimer carefully before using LearnPathshala.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <Clock size={16} className="text-[#1255b5]" />
                Last Updated: November 9, 2026
              </span>
              <span className="hidden h-4 w-px bg-slate-300 sm:block" />
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                Official LearnPathshala Policy
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">

          {/* Table of Contents */}
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-5 flex items-center gap-2 font-bold text-[#103575]">
                <FileText size={19} />
                On This Page
              </h3>

              <nav aria-label="Disclaimer sections">
                <ul className="space-y-1.5">
                  {sections.map((section, index) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="group flex items-start gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-blue-50 hover:text-[#1255b5]"
                      >
                        <span className="text-xs font-bold text-slate-300 group-hover:text-[#1255b5]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{section.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mt-6 rounded-xl bg-[#eff5ff] p-4">
                <div className="mb-2 flex items-center gap-2 text-[#1255b5]">
                  <Info size={18} />
                  <span className="text-sm font-bold">
                    Need Help?
                  </span>
                </div>
                <p className="mb-3 text-xs leading-6 text-slate-600">
                  Have questions about our policies? Our team is here
                  to help.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#1255b5] hover:underline"
                >
                  Contact Us <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          </aside>

          {/* Disclaimer Content */}
          <article className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-9 sm:py-10">

            {/* Introduction */}
            <div className="mb-8 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 font-bold text-[#103575]">
                <AlertCircle size={20} className="text-[#1255b5]" />
                Important Notice
              </div>
              <p className="text-sm leading-7 text-slate-600">
                Welcome to LearnPathshala. All information and
                educational resources available through our website
                and mobile application are provided for educational
                and informational purposes only.
              </p>
            </div>

            <p className="mb-4 text-[15px] leading-8 text-slate-600">
              By accessing or using LearnPathshala, you acknowledge
              that you have read and understood this Disclaimer.
              Please review the following terms carefully.
            </p>

            <PolicySection id="educational-purpose" title="1. Educational Purpose">
              <p>
                LearnPathshala is an educational platform designed to
                help students, learners and competitive-examination
                aspirants prepare for examinations and improve their
                knowledge and skills.
              </p>
              <p>Our platform may provide:</p>
              <ul className="list-inside list-disc space-y-2 pl-2">
                <li>Online courses and educational lessons.</li>
                <li>Mock tests and online test series.</li>
                <li>Practice questions and quizzes.</li>
                <li>Previous-year question papers.</li>
                <li>Current affairs and general knowledge.</li>
                <li>Educational articles and blogs.</li>
                <li>Study materials and learning resources.</li>
                <li>Live classes and recorded lectures.</li>
                <li>Examination preparation guidance and tips.</li>
              </ul>
              <p>
                All these resources are intended to support your
                preparation and should not be considered a guarantee
                of examination success.
              </p>
            </PolicySection>

            <PolicySection id="exam-results" title="2. No Guarantee of Exam Results">
              <p>
                LearnPathshala does not guarantee that any student
                will pass or qualify for a particular examination,
                achieve a specific score or rank, obtain a government
                job, or secure any particular employment opportunity.
              </p>
              <p>
                Individual results depend on various factors,
                including preparation, personal effort, examination
                difficulty, competition, eligibility and actual
                examination performance.
              </p>
            </PolicySection>

            <PolicySection id="accuracy" title="3. Accuracy of Information">
              <p>
                We make reasonable efforts to provide accurate,
                relevant and useful educational information.
                However, we do not guarantee that all information
                available on our platform will always be complete,
                accurate, current or error-free.
              </p>
              <p>
                Examination rules, eligibility criteria, dates,
                vacancies, syllabi, fees, government notifications
                and other official information may change.
              </p>
              <p>
                Users are strongly advised to verify important
                information through the official website or
                notification issued by the relevant examination
                authority before making decisions or submitting
                applications.
              </p>
            </PolicySection>

            <PolicySection id="current-affairs" title="4. Current Affairs & News">
              <p>
                LearnPathshala may publish current affairs,
                news-related educational content and information
                collected from publicly available sources.
              </p>
              <p>
                Such content is provided for educational and
                examination-preparation purposes. We cannot guarantee
                that every news item or current-affairs update will
                remain accurate or relevant after publication.
              </p>
              <p>
                Users should verify important information through
                the original or official source.
              </p>
            </PolicySection>

            <PolicySection id="previous-papers" title="5. Previous Year Papers">
              <p>
                LearnPathshala may provide previous-year question
                papers and related educational resources for practice
                and examination preparation.
              </p>
              <p>
                The availability of such materials does not imply
                affiliation, endorsement, sponsorship or partnership
                with any examination authority unless explicitly
                stated.
              </p>
              <p>
                These materials are intended to help students
                understand examination patterns, question types
                and difficulty levels.
              </p>
            </PolicySection>

            <PolicySection id="mock-tests" title="6. Mock Tests & Practice Questions">
              <p>
                Mock tests, quizzes, practice questions, explanations,
                answers and solutions available on LearnPathshala
                are provided for educational and practice purposes.
              </p>
              <p>
                Mock-test scores should not be considered an official
                representation of a student's expected score in an
                actual examination.
              </p>
              <p>Actual examinations may differ in:</p>
              <ul className="list-inside list-disc space-y-2 pl-2">
                <li>Difficulty level and question pattern.</li>
                <li>Number of questions and time duration.</li>
                <li>Marking scheme and syllabus.</li>
                <li>Question distribution and examination format.</li>
              </ul>
            </PolicySection>

            <PolicySection id="courses" title="7. Courses & Teachers">
              <p>
                LearnPathshala may provide educational courses,
                live classes and recorded lessons created or delivered
                by teachers and educators.
              </p>
              <p>
                Views, explanations, examples, opinions and teaching
                methods expressed by individual instructors belong
                to their respective instructors and do not necessarily
                represent the official views of LearnPathshala.
              </p>
              <p>
                Completing any particular course does not guarantee
                selection, qualification, employment or any specific
                academic outcome.
              </p>
            </PolicySection>

            <PolicySection id="external-links" title="8. External Links">
              <p>
                Our website or application may contain links to
                third-party websites, platforms, resources or services.
                These links may be provided for convenience or
                additional information.
              </p>
              <p>
                LearnPathshala does not control and is not responsible
                for the content, privacy practices, availability,
                accuracy, security or policies of third-party websites.
              </p>
              <p>
                Users should review the terms and privacy policies
                of external websites before using them.
              </p>
            </PolicySection>

            <PolicySection id="government-affiliation" title="9. No Official Government Affiliation">
              <p>
                Unless specifically stated, LearnPathshala is not
                a government website and is not affiliated with,
                sponsored by, endorsed by or officially associated
                with any government department, examination
                authority, university, board, recruitment agency
                or other official organization.
              </p>
              <p>
                References to examinations, recruitment notifications,
                government jobs, universities, boards and other
                organizations are provided for educational and
                informational purposes.
              </p>
              <p>
                Always refer to the relevant official authority
                for official notifications and decisions.
              </p>
            </PolicySection>

            <PolicySection id="intellectual-property" title="10. Intellectual Property">
              <p>
                Content published on LearnPathshala, including
                original text, graphics, logos, course materials,
                website design, videos, questions and explanations,
                may be protected by applicable intellectual-property
                laws.
              </p>
              <p>
                Users may not reproduce, copy, distribute, modify,
                sell, republish or commercially exploit LearnPathshala's
                original content without prior written permission,
                except where permitted by applicable law.
              </p>
              <p>
                Where third-party materials are used, reasonable
                efforts may be made to identify or attribute the
                respective source or owner where appropriate.
              </p>
            </PolicySection>

            <PolicySection id="user-responsibility" title="11. User Responsibility">
              <p>
                Users are responsible for independently verifying
                information before relying on it, particularly
                information relating to:
              </p>
              <ul className="list-inside list-disc space-y-2 pl-2">
                <li>Examination dates and application deadlines.</li>
                <li>Eligibility requirements and age limits.</li>
                <li>Vacancies, syllabus and examination patterns.</li>
                <li>Fees, admit cards and examination results.</li>
                <li>Government notifications and recruitment rules.</li>
              </ul>
              <p>
                LearnPathshala shall not be responsible for decisions
                made solely on the basis of information available
                on the platform, to the extent permitted by applicable
                law.
              </p>
            </PolicySection>

            <PolicySection id="payments" title="12. Payments & Digital Products">
              <p>
                LearnPathshala may offer paid courses, mock-test
                series, educational services and other digital
                products.
              </p>
              <p>
                Information regarding prices, validity, access,
                refunds, cancellations and payment terms is governed
                by the applicable terms and policies displayed
                on the platform.
              </p>
              <p>
                Users should carefully review the relevant product
                details and applicable policies before completing
                a purchase.
              </p>
              <p>
                Please also read our{" "}
                <Link
                  href="/refund-cancellation"
                  className="font-semibold text-[#1255b5] hover:underline"
                >
                  Refund & Cancellation Policy
                </Link>
                .
              </p>
            </PolicySection>

            <PolicySection id="availability" title="13. Technical Availability">
              <p>
                We make reasonable efforts to keep LearnPathshala
                available and functioning properly. However, we
                do not guarantee uninterrupted or error-free access.
              </p>
              <p>The website or application may occasionally become unavailable due to:</p>
              <ul className="list-inside list-disc space-y-2 pl-2">
                <li>Scheduled maintenance or technical problems.</li>
                <li>Server or internet connectivity issues.</li>
                <li>Security incidents.</li>
                <li>Third-party service interruptions.</li>
                <li>Updates, upgrades or circumstances beyond our reasonable control.</li>
              </ul>
            </PolicySection>

            <PolicySection id="liability" title="14. Limitation of Liability">
              <p>
                To the maximum extent permitted by applicable law,
                LearnPathshala and its owners, team members,
                instructors, contributors and service providers
                shall not be liable for any direct, indirect,
                incidental or consequential losses arising from
                reliance on information, educational content,
                courses, mock tests or other resources available
                through the platform.
              </p>
              <p>
                Nothing in this Disclaimer excludes or limits
                liability where such exclusion or limitation
                is prohibited by applicable law.
              </p>
            </PolicySection>

            <PolicySection id="changes" title="15. Changes to This Disclaimer">
              <p>
                LearnPathshala reserves the right to update,
                modify or change this Disclaimer from time to
                time.
              </p>
              <p>
                Any changes will become effective when the
                updated Disclaimer is published on this page.
                We encourage users to review this page periodically.
              </p>
            </PolicySection>

            <PolicySection id="contact" title="16. Contact Us">
              <p>
                If you have questions, concerns or requests
                regarding this Disclaimer, please contact our
                team through the contact page.
              </p>

              <div className="mt-5 rounded-xl border border-blue-100 bg-[#f2f7ff] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0d47a1] text-white">
                    <Mail size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#103575]">
                      LearnPathshala Support
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      We are here to help with your questions
                      and concerns.
                    </p>
                    <Link
                      href="/contact"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1255b5] hover:underline"
                    >
                      Contact Our Team
                      <ExternalLink size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            </PolicySection>

            {/* Bottom Notice */}
            <div className="mt-8 rounded-xl border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <GraduationCap
                  size={23}
                  className="mt-1 shrink-0 text-amber-600"
                />
                <div>
                  <h3 className="font-bold text-[#103575]">
                    Learn • Practice • Succeed
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    By using LearnPathshala, you acknowledge
                    that you have read and understood this
                    Disclaimer. We encourage every learner
                    to use our educational resources responsibly
                    and verify official information before
                    making important decisions.
                  </p>
                </div>
              </div>
            </div>

          </article>
        </div>
      </section>
    </main>
  );
}
