import { ASSETS_URL } from "@/assets";
import Image from "next/image";
import Link from "next/link";

const SECTORS = [
  "Building Construction", "Automobile", "Hospitality & Tourism", "Engineering", "Creative Media", "Fashion & Apparel", "ICT", "Education & Social Care", "Agriculture", "Welding & Fabrication",
  
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Register",
    body: "Trainees, instructors, training providers, technical colleges, and industry partners register under their applicable sector and trade.",
  },
  {
    step: "02",
    title: "Assess",
    body: "A panel of 3 assessors scores each trade entry against criteria defined for that sector. Every score and comment is recorded for full transparency.",
  },
  {
    step: "03",
    title: "Compete",
    body: "State-level sector results are compared within each zone. Top performers advance from State → Zonal → National stage.",
  },
  {
    step: "04",
    title: "Recognise",
    body: "National finalists are ranked publicly. Award categories are assigned and winners are celebrated at the recognition ceremony.",
  },
];

const STATS = [
  { value: "6", label: "Geopolitical zones" },
  { value: "37", label: "States + FCT" },
  { value: "10+", label: "Skill sectors" },
  { value: "19", label: "Award categories" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-grey/60 bg-white/90 px-6 py-4 backdrop-blur sm:px-10">
        <Link href="/" className="flex items-center gap-0 cursor-pointer">
          <Image src="/logo.png" alt="e-limi logo" width={20} height={40} className="h-10 w-auto!" priority />
          <span className="font-display text-lg font-bold text-primary tracking-tight -translate-x-1.5">| Expo</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/results" className="hidden sm:block text-ink/70 hover:text-ink transition-colors cursor-pointer">
            Public Results
          </Link>
          {/* <Link
            href="/register/applicant"
            className="hidden sm:inline-flex rounded-full bg-primary-accent px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          >
            Register
          </Link> */}
          <Link
            href="/login"
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-ink px-6 py-20 sm:py-28 sm:px-10">
        <Image src={ASSETS_URL['constructor_discussion']} alt="constructor_discussion" className="object-cover opacity-15" fill priority/>
        {/* Decorative rings */}
        <div className="pointer-events-none absolute z-10 -top-40 -right-40 h-125 w-125 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute z-10 -bottom-32 -left-32 h-100 w-100 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute z-10 top-1/2 right-1/4 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl z-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/70 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
            National Skills Excellence Awards
          </div>

          <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            Recognising excellence<br />
            <span className="text-secondary">across every trade.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base text-white/60 leading-relaxed sm:text-lg">
            Nigeria Skills Expo is Nigeria's national skills competition platform which brings together trainees, training providers, technical colleges, instructors,
            and industry partners from all 6 geopolitical zones for conducting a transparent, sector-by-sector assessment to determine the top performers in all the categories.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/register/applicant"
              className="cursor-pointer rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 transition-colors"
            >
              Register to participate
            </Link>
            <Link
              href="/results"
              className="cursor-pointer rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              View public results
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="font-display text-3xl font-bold text-secondary">{s.value}</div>
                <div className="mt-1 text-xs text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold text-ink">How Nigeria Skills Expo works</h2>
            <p className="mt-3 text-ink/60">From registration to the national stage in four steps.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="rounded-2xl border border-grey p-6">
                <div className="mb-4 font-display text-4xl font-bold text-primary/20">{step.step}</div>
                <h3 className="font-display text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm text-ink/60 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sectors ── */}
      <section className="relative bg-primary px-6 py-20 sm:px-10">
        <div className="absolute h-full w-full top-0 left-0 bg-ink/30" />
        <Image src={ASSETS_URL['male_engineers']} alt="male_engineers" className="object-cover opacity-20" fill priority/>
        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-bold text-white/95">Competing skill sectors</h2>
            <p className="mt-3 text-white/80">
              Ten sectors. Each represented by exactly three trades per state. The highest-scoring sectors
              advance from state, through each zone, to the national finals.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap justify-center gap-3">
            {SECTORS.map((sector) => (
              <span
                key={sector}
                className="rounded-full border border-secondary/20 bg-slate-50/10 backdrop-blur-lg px-4 py-2 text-sm font-medium text-slate-50"
              >
                {sector}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Transparency CTA ── */}
      <section className="px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-slate-100 px-8 py-12 sm:px-12 text-center relative overflow-hidden">
            {/* <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" /> */}
            <div className="relative">
              <h2 className="font-display text-3xl font-bold text-ink">
                Full results, publicly visible.
              </h2>
              <p className="mt-4 text-slate-600 max-w-xl mx-auto leading-relaxed">
                Every sector's full ranked list — not just the top three — is published at state, zonal, and national
                level. You can see every score, every trade, every comment. No closed doors.
              </p>
              <Link
                href="/results"
                className="cursor-pointer mt-8 inline-flex rounded-full bg-secondary px-8 py-3 text-sm font-semibold text-ink hover:bg-secondary/90 transition-colors"
              >
                Browse public results
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who can participate ── */}
      <section className="bg-grey/30 px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-bold text-ink">Who can participate?</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Beneficiaries / Trainees", body: "Individual learners assessed in a trade under a registered sector." },
              { title: "Training Service Providers", body: "Registered organisations delivering skills training programmes." },
              { title: "Technical Colleges", body: "Accredited technical and vocational education institutions." },
              { title: "Instructors", body: "Individual trainers and educators in a registered trade area." },
              { title: "Industry Partners", body: "Businesses and organisations supporting skills development." },
            ].map((cat) => (
              <div key={cat.title} className="rounded-2xl border border-grey bg-white p-5">
                <div className="mb-1 font-display text-base font-semibold text-ink">{cat.title}</div>
                <p className="text-sm text-ink/60 leading-relaxed">{cat.body}</p>
              </div>
            ))}
            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary-accent p-5 flex flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-primary mb-3">Ready to register?</p>
              <Link
                href="/register/applicant"
                className="cursor-pointer rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                Register now →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-grey px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-4xl flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <Image src="/logo.png" alt="e-limi logo" width={28} height={28} className="h-7 w-auto" />
            <span className="font-display text-sm font-bold text-primary">| Expo</span>
          </Link>
          <nav className="flex flex-wrap justify-center gap-4 text-sm text-ink/50">
            <Link href="/results" className="hover:text-ink transition-colors cursor-pointer">Public Results</Link>
            <Link href="/register/applicant" className="hover:text-ink transition-colors cursor-pointer">Register</Link>
            <Link href="/login" className="hover:text-ink transition-colors cursor-pointer">Sign in</Link>
          </nav>
          <p className="text-xs text-ink/40">© {new Date().getFullYear()} Nigeria Skills Expo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
