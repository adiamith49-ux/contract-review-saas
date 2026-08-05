"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Globe, Shield, Lock, Check, X, Menu, ArrowRight, Mail,
  Upload, FileText, MessageSquare, Scale, Target, ShieldCheck,
  ChevronDown, Quote, Building2, Users, UserCheck, BookOpen, Eye,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// This page is served on the landing host (contralyne.com), where /sign-in
// and /dashboard don't exist — middleware.ts 308-redirects those paths to
// app.contralyne.com at the server/edge level. next/link's client-side router
// treats a relative href as same-origin, so it doesn't reliably follow a
// redirect to a DIFFERENT origin (works when typed directly as a full URL,
// silently fails as a Link — this is why "Sign In"/"Go to Dashboard" didn't
// work from here). Build the absolute app-host URL ourselves and use a plain
// <a> (real navigation) for these; stays relative in dev/previews where the
// current host isn't actually a landing host.
function appUrl(path: string): string {
  if (typeof window !== "undefined") {
    const landingHosts = (process.env.NEXT_PUBLIC_LANDING_HOSTS ?? "contralyne.com,www.contralyne.com")
      .split(",").map(h => h.trim()).filter(Boolean);
    if (landingHosts.includes(window.location.hostname)) {
      const appHost = process.env.NEXT_PUBLIC_APP_HOST ?? "app.contralyne.com";
      return `https://${appHost}${path}`;
    }
  }
  return path;
}

// ─── Brand palette ─────────────────────────────────────────────────────────────
// Teal Wave #00BFA6 (main) · Aqua Silk #D9FAF4 (bg) · Deep Lagoon #0F2A2A (dark surfaces)
const btnPrimary = "rounded-full bg-[#00BFA6] text-white hover:bg-[#019485] shadow-none";
const btnOutline = "rounded-full border border-[#0F2A2A]/25 bg-transparent text-[#0F2A2A] hover:bg-[#0F2A2A]/5 hover:text-[#0F2A2A] shadow-none";
const navLink =
  "relative text-sm font-semibold text-black transition-colors " +
  "after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:h-[2px] after:bg-[#8B0000] " +
  "after:origin-center after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100";

// Small badge used to flag draft content that genuinely needs real data
// (verified stats, real quotes, counsel-reviewed language) before it ships.
// Kept deliberately visible in dev/staging — strip once each item is confirmed.
function ConfirmBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
      {children}
    </span>
  );
}

// ─── Shared visual: clause analysis mockup ────────────────────────────────────
// The strongest visual asset on the site (per the content plan) — reused in
// the hero and again in "How It Works" step 03, exactly as instructed.

const mockClauses = [
  { clause: "Limitation of Liability", note: "One-sided cap", color: "bg-red-500" },
  { clause: "Auto-Renewal", note: "90-day notice window", color: "bg-orange-500" },
  { clause: "Dispute Resolution", note: "Arbitration required", color: "bg-yellow-500" },
  { clause: "IP Ownership", note: "Work-for-hire unclear", color: "bg-orange-400" },
  { clause: "Confidentiality", note: "Mutual, 3-year term", color: "bg-[#00BFA6]" },
  { clause: "Payment Terms", note: "Net-30, standard", color: "bg-[#00BFA6]" },
];

function ClauseAnalysisMockup() {
  return (
    <div className="rounded-xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#D9FAF4] border-b border-[#0F2A2A]/10">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-[#00BFA6]" />
        <span className="ml-3 text-xs text-[#0F2A2A]/40 font-mono truncate">contralyne.com/contracts/msa-acme-corp</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#0F2A2A]/10">
        <div className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0F2A2A]/40 mb-4">Clause Analysis</p>
          {mockClauses.map((c, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${c.color}`} />
              <div>
                <p className="text-xs font-medium text-[#0F2A2A]">{c.clause}</p>
                <p className="text-[11px] text-[#0F2A2A]/55 mt-0.5">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0F2A2A]/40 mb-4">Risk Summary</p>
          <div className="space-y-3">
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <span className="text-xs font-semibold text-red-600 uppercase">Critical</span>
              <p className="text-xs text-[#0F2A2A]/80 mt-1">Limitation of liability is one-sided — capped only for Vendor. Client exposure is unlimited. Under Delaware law, this clause is likely enforceable as-is.</p>
              <p className="text-[11px] text-[#00BFA6] font-medium mt-2">View negotiation suggestion →</p>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
              <span className="text-xs font-semibold text-orange-600 uppercase">High</span>
              <p className="text-xs text-[#0F2A2A]/80 mt-1">Auto-renewal clause has a 90-day notice window with no carve-out for termination for convenience. Consider requesting a mutual 30-day notice period.</p>
            </div>
            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3">
              <span className="text-xs font-semibold text-yellow-600 uppercase">Medium</span>
              <p className="text-xs text-[#0F2A2A]/80 mt-1">Ambiguous language: &quot;reasonable efforts&quot; in Clause 4.2 is undefined. Recommend replacing with &quot;commercially reasonable efforts&quot; with an objective standard.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section 1: Navigation ─────────────────────────────────────────────────────
// A buyer's menu, not a brochure menu — Jurisdictions elevated to top level
// since it's the differentiator; two audience entries; Pricing present so its
// absence doesn't read as "expensive." Most of these are same-page anchors —
// dedicated sub-pages (per-jurisdiction, per-audience) are future work.

const NAV_LINKS = [
  { label: "Product", href: "#context-engine" },
  { label: "Jurisdictions", href: "#jurisdictions" },
  { label: "For Law Firms", href: "#segments" },
  { label: "For In-House", href: "#segments" },
  { label: "Security", href: "#security" },
  { label: "Resources", href: "#faq" },
  { label: "Pricing", href: "#contact" },
];

function LandingNav() {
  const { isSignedIn, isLoaded } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[#0F2A2A]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/name-logo.png" alt="Contralyne" className="h-8 w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className={navLink}>{l.label}</a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            {isLoaded && isSignedIn ? (
              <Button asChild className={btnPrimary}>
                <a href={appUrl("/dashboard")}>Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" /></a>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="rounded-full text-[#0F2A2A] hover:bg-[#0F2A2A]/5 hover:text-[#0F2A2A]">
                  <a href={appUrl("/sign-in")}>Sign In</a>
                </Button>
                <Button asChild className={btnPrimary}>
                  <a href="#contact">Book a Demo</a>
                </Button>
              </>
            )}
          </div>

          <button
            className="lg:hidden p-2 rounded-md text-[#0F2A2A]/60 hover:text-[#0F2A2A]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-[#0F2A2A]/10 py-4 space-y-1">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm font-semibold text-black rounded hover:bg-[#0F2A2A]/5">{l.label}</a>
            ))}
            <div className="pt-2 border-t border-[#0F2A2A]/10 space-y-2">
              {isLoaded && isSignedIn ? (
                <Button asChild className={`w-full ${btnPrimary}`}>
                  <a href={appUrl("/dashboard")}>Go to Dashboard</a>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild className={`w-full ${btnOutline}`}>
                    <a href={appUrl("/sign-in")}>Sign In</a>
                  </Button>
                  <Button asChild className={`w-full ${btnPrimary}`}>
                    <a href="#contact" onClick={() => setMobileOpen(false)}>Book a Demo</a>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Section 2: Hero ────────────────────────────────────────────────────────────

function Hero() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <section className="relative overflow-hidden bg-[#081a1a] py-16 sm:py-20 lg:min-h-[92vh] lg:flex lg:items-center">
      <div className="absolute -top-40 right-0 h-[32rem] w-[32rem] rounded-full bg-[#00BFA6]/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -left-24 h-80 w-80 rounded-full bg-[#00BFA6]/10 blur-[100px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-10 items-center w-full">
        {/* Left: copy */}
        <div className="text-center lg:text-left">
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-[#00BFA6] mb-5">
            AI Contract Review, Built On Jurisdiction
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
            Contract review that knows which law applies
          </h1>

          <p className="mt-6 text-lg text-white/70 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Upload a contract, set the jurisdiction, counterparty, and deal value, and get clause-by-clause
            risk analysis with redline-ready language in under five minutes. Grounded in US, UK, EU, and
            Indian law. Reviewed against your own playbook, not a generic template.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
            {isLoaded && isSignedIn ? (
              <Button size="lg" asChild className={`text-base px-8 h-12 ${btnPrimary}`}>
                <a href={appUrl("/dashboard")}>Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
            ) : (
              <>
                <Button size="lg" asChild className={`text-base px-8 h-12 ${btnPrimary}`}>
                  <a href="#contact">Book a Demo <ArrowRight className="ml-2 h-4 w-4" /></a>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-base px-8 h-12 rounded-full border border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white shadow-none">
                  <a href="#how-it-works">See a Sample Analysis</a>
                </Button>
              </>
            )}
          </div>

          <p className="mt-6 text-xs text-white/45">
            Works with PDF and DOCX. SOC 2 certified infrastructure. Your contracts are never used to train AI.
          </p>
        </div>

        {/* Right: live product screenshot */}
        <div className="relative">
          <ClauseAnalysisMockup />
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: Proof bar ───────────────────────────────────────────────────────
// NOTE: the stats and testimonials below are placeholder/illustrative, not
// verified figures or real customer quotes — Kartik explicitly asked for the
// ConfirmBadge flags to be removed on 2026-08-05 after being told this means
// they'll render as genuine on the live site. Swap in real data before this
// is treated as accurate marketing copy.

const PROOF_QUOTES = [
  { quote: "The jurisdiction context is the difference. Generic tools give me American answers to Indian contract questions.", name: "Ananya Rao", role: "Corporate partner, mid-size firm, Bengaluru" },
  { quote: "It caught a one-sided liability cap I had read past twice. That alone paid for the month.", name: "James Whitfield", role: "In-house counsel, SaaS company, London" },
  { quote: "The playbook rules mean my juniors review to my standard, not their own.", name: "Arjun Mehta", role: "Managing partner, boutique commercial firm, Delhi NCR" },
];

function ProofBar() {
  return (
    <section className="bg-white py-14 border-b border-[#0F2A2A]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#0F2A2A]/45 mb-8">
          Built with practising lawyers across four jurisdictions
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12 text-center">
          <div>
            <p className="text-2xl font-extrabold text-[#0F2A2A]">1,200+</p>
            <p className="text-xs text-[#0F2A2A]/50 mt-1">contracts analysed</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#0F2A2A]">8</p>
            <p className="text-xs text-[#0F2A2A]/50 mt-1">design partner firms</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#0F2A2A]">4</p>
            <p className="text-xs text-[#0F2A2A]/50 mt-1">jurisdictions, live</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#0F2A2A]">&lt;5 min</p>
            <p className="text-xs text-[#0F2A2A]/50 mt-1">average analysis time</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PROOF_QUOTES.map((q, i) => (
            <div key={i} className="rounded-xl border border-[#0F2A2A]/10 bg-[#D9FAF4]/30 p-5 relative">
              <Quote className="h-4 w-4 text-[#0F2A2A]/25 mb-2" />
              <p className="text-sm text-[#0F2A2A]/80 italic leading-relaxed">&ldquo;{q.quote}&rdquo;</p>
              <p className="text-xs font-semibold text-[#0F2A2A]/80 mt-3">{q.name}</p>
              <p className="text-xs text-[#0F2A2A]/50">{q.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 4: The problem ─────────────────────────────────────────────────────

function TheProblem() {
  return (
    <section className="py-16 sm:py-20 bg-[#D9FAF4]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
          Generic AI does not know where your contract lives
        </h2>
        <p className="mt-6 text-base sm:text-lg text-[#0F2A2A]/65 leading-relaxed">
          Ask a general-purpose AI to review a services agreement and it will give you a competent answer
          to the wrong question. It does not know your governing law. It does not know your counterparty&apos;s
          leverage. It does not know that your firm never accepts a unilateral liability cap. So you get a
          summary, and then you do the review anyway.
        </p>
        <p className="mt-4 text-base sm:text-lg font-semibold text-[#0F2A2A]">
          Contralyne starts from the three things that actually determine risk: the jurisdiction, the deal, and your standards.
        </p>
      </div>
    </section>
  );
}

// ─── Section 5: The Contralyne Context Engine ───────────────────────────────────

function ContextEngine() {
  const columns = [
    {
      icon: Scale,
      title: "Jurisdiction",
      body: "Every analysis is grounded in the law that governs the contract. US contracts are read against the UCC and Delaware corporate law. UK contracts against English contract law and the Companies Act 2006. EU contracts against GDPR obligations. Indian contracts against the Indian Contract Act. Not a translated American answer.",
    },
    {
      icon: Target,
      title: "Deal context",
      body: "Counterparty, deal value, urgency, and your position in the negotiation. A liability cap that is standard in a fifty lakh vendor agreement is unacceptable in a five crore master services agreement, and the analysis reflects that.",
    },
    {
      icon: ShieldCheck,
      title: "Your playbook",
      body: "Your firm's non-negotiables, fallback positions, and mandatory language, defined once. Every contract is measured against your standards. Deviations come back as specific flagged risks with proposed redlines, not as generic warnings.",
    },
  ];

  return (
    <section id="context-engine" className="relative overflow-hidden py-20 sm:py-24 bg-white">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-[36rem] rounded-full bg-[#00BFA6]/[0.06] blur-[100px] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">
            The Contralyne Context Engine
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Three inputs your AI has <span className="font-serif italic font-medium">never had</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {columns.map(c => (
            <div key={c.title} className="rounded-2xl bg-[#D9FAF4] p-7">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#00BFA6]/15 text-[#00BFA6] mb-5">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#0F2A2A] mb-2.5">{c.title}</h3>
              <p className="text-[15px] text-[#0F2A2A]/65 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 6: How it works — four numbered steps ──────────────────────────────
// Replaces both the old Features grid and the old How It Works section.

function UploadVisual() {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-8 flex flex-col items-center justify-center min-h-[220px]">
      <div className="h-16 w-16 rounded-2xl bg-[#00BFA6]/10 flex items-center justify-center mb-4">
        <Upload className="h-7 w-7 text-[#00BFA6]" />
      </div>
      <div className="w-full max-w-xs rounded-lg border-2 border-dashed border-[#0F2A2A]/15 py-6 text-center">
        <p className="text-xs text-[#0F2A2A]/45">msa-acme-corp.pdf</p>
        <p className="text-[11px] text-[#00BFA6] font-medium mt-1">Uploaded — extracting text…</p>
      </div>
    </div>
  );
}

function DealContextVisual() {
  const fields = [
    { label: "Jurisdiction", value: "United States — Delaware" },
    { label: "Counterparty", value: "Acme Corp" },
    { label: "Deal value", value: "$450,000" },
    { label: "Urgency", value: "Standard" },
  ];
  return (
    <div className="rounded-2xl bg-white shadow-sm p-6 min-h-[220px]">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#0F2A2A]/40 mb-4">Deal Context</p>
      <div className="space-y-2.5">
        {fields.map(f => (
          <div key={f.label} className="flex items-center justify-between rounded-lg bg-[#D9FAF4] px-3 py-2.5 text-sm">
            <span className="text-[#0F2A2A]/50 text-xs">{f.label}</span>
            <span className="text-[#0F2A2A] font-medium">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RedlineExportVisual() {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-6 min-h-[220px]">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#0F2A2A]/40 mb-4">Exported — Tracked Changes</p>
      <div className="space-y-2 text-xs leading-relaxed font-mono">
        <p className="text-[#0F2A2A]/60">Vendor&apos;s aggregate liability shall be <span className="line-through text-red-500">limited to fees paid</span> <span className="text-[#00BFA6]">mutually limited to fees paid by either party</span> in the preceding 12 months.</p>
        <p className="text-[#0F2A2A]/60 mt-3">Either party may terminate upon <span className="line-through text-red-500">90</span> <span className="text-[#00BFA6]">30</span> days&apos; written notice.</p>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-[#0F2A2A]/40">
        <FileText className="h-3.5 w-3.5" /> contralyne-redline-msa-acme-corp.docx
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Upload",
      body: "Drop in a PDF or DOCX up to 10MB. Text is extracted instantly. Scanned and image-based PDFs are processed through OCR, so a signed hard copy works the same as a native file.",
      Visual: UploadVisual,
    },
    {
      number: "02",
      title: "Set the deal",
      body: "Choose the governing jurisdiction, name the counterparty, enter deal value and urgency, and select which side you are on. Your active playbook rules are applied automatically.",
      Visual: DealContextVisual,
    },
    {
      number: "03",
      title: "Read the risk",
      body: "Every clause is scored critical, high, medium, or low, with a plain-English explanation of why. The reasoning cites the governing law, not general principle. Favourable terms are flagged too, so you know what you have won as well as what you have lost.",
      Visual: ClauseAnalysisMockup,
    },
    {
      number: "04",
      title: "Redline and send",
      body: "Specific replacement language for every flagged clause, drafted for your jurisdiction and your deal. Export to DOCX with Word tracked changes and inline comments, or to PDF with a two-column redline layout. Ready for the other side.",
      Visual: RedlineExportVisual,
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            From upload to redline, <span className="font-serif italic font-medium">in four steps</span>
          </h2>
        </div>

        <div className="space-y-16">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}
            >
              <div>
                <span className="text-4xl font-black text-[#0F2A2A]/15">{step.number}</span>
                <h3 className="text-2xl font-bold text-[#0F2A2A] mt-1 mb-3">{step.title}</h3>
                <p className="text-[15px] text-[#0F2A2A]/65 leading-relaxed">{step.body}</p>
              </div>
              <div><step.Visual /></div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button size="lg" asChild className={`text-base px-8 h-12 ${btnPrimary}`}>
            <a href="#contact">Book a demo on your own contract types <ArrowRight className="ml-2 h-4 w-4" /></a>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 7: Ask anything ─────────────────────────────────────────────────────

function AskAnything() {
  const messages = [
    { from: "user", text: "Why was the liability clause flagged critical?" },
    { from: "ai", text: "Under Delaware law, a one-sided liability cap favouring only the Vendor is enforceable as drafted. Your playbook requires mutual caps — this deviates from that standard." },
    { from: "user", text: "What if governing law moves to England?" },
    { from: "ai", text: "Under UCTA, an exclusion this broad would need a reasonableness test. I'd flag it as high risk rather than critical, and suggest narrower carve-outs." },
  ];

  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">
            <MessageSquare className="h-3.5 w-3.5" /> Per-Contract Chat
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F2A2A] leading-tight mb-5">
            Ask the contract a <span className="font-serif italic font-medium">question</span>
          </h2>
          <p className="text-[15px] text-[#0F2A2A]/65 leading-relaxed">
            Every contract gets its own conversation. Ask why a clause was flagged, what the fallback
            position should be, how the indemnity interacts with the liability cap, or what changes if
            the governing law moves from England to Delaware. Contralyne holds the full contract text,
            the analysis, and your entire conversation history, so you never re-explain the deal.
          </p>
        </div>

        <div className="rounded-2xl bg-[#D9FAF4] p-5">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.from === "user" ? "bg-[#00BFA6] text-white rounded-br-sm" : "bg-white text-[#0F2A2A]/80 rounded-bl-sm shadow-sm"}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 8: Jurisdictions ────────────────────────────────────────────────────

const JURISDICTIONS = [
  {
    code: "US", flag: "🇺🇸", name: "United States",
    body: "Uniform Commercial Code, Delaware corporate law, state-level enforceability of liability caps and non-competes, and typical US market positions on indemnity and limitation.",
    tags: ["Uniform Commercial Code", "Delaware corporate law", "Liability cap enforceability", "Non-compete enforceability"],
  },
  {
    code: "UK", flag: "🇬🇧", name: "United Kingdom",
    body: "English contract law, the Companies Act 2006, UCTA reasonableness on exclusion clauses, and English drafting convention for boilerplate.",
    tags: ["English contract law", "Companies Act 2006", "UCTA reasonableness", "Drafting convention"],
  },
  {
    code: "EU", flag: "🇪🇺", name: "European Union",
    body: "GDPR data processing obligations, mandatory DPA terms, cross-border transfer mechanisms, and EU consumer and commercial protections.",
    tags: ["GDPR", "Mandatory DPA terms", "Cross-border transfer", "Consumer & commercial protections"],
  },
  {
    code: "IN", flag: "🇮🇳", name: "India",
    body: "The Indian Contract Act 1872, enforceability of liquidated damages under Section 74, stamp duty and arbitration considerations, and Indian commercial drafting practice.",
    tags: ["Indian Contract Act 1872", "Section 74 — liquidated damages", "Stamp duty", "Arbitration"],
  },
];

function Jurisdictions() {
  const [open, setOpen] = useState<string | null>("US");

  return (
    <section id="jurisdictions" className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-4">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Four jurisdictions, <span className="font-serif italic font-medium">in depth</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#0F2A2A]/60 max-w-2xl mx-auto">
            Not a language setting. Each jurisdiction has its own statutory grounding, its own
            enforceability logic, and its own drafting conventions.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {JURISDICTIONS.map(j => {
            const isOpen = open === j.code;
            return (
              <div key={j.code} className="rounded-xl bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : j.code)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#00BFA6]/10 text-base shrink-0" aria-hidden>{j.flag}</span>
                  <span className="text-base font-bold text-[#0F2A2A] flex-1">{j.name}</span>
                  <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider text-[#0F2A2A]/30">{j.code}</span>
                  <ChevronDown className={`h-4 w-4 text-[#0F2A2A]/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pl-[4.25rem]">
                    <p className="text-sm text-[#0F2A2A]/65 leading-relaxed">{j.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {j.tags.map(tag => (
                        <span key={tag} className="inline-block rounded-full bg-[#D9FAF4] px-3 py-1 text-xs font-medium text-[#0F2A2A]/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Section 9: Built for two kinds of legal team ────────────────────────────────

function Segments() {
  const cards = [
    {
      icon: Building2,
      title: "For law firms",
      body: "You review contracts your client will be judged on, and every hour you spend on first-pass review is an hour of partner time spent below your rate. Contralyne handles the first pass against your playbook, so associates deliver at partner standard and partners spend their time on the judgment calls that clients actually pay for.",
      points: ["Playbook enforcement across the whole team", "Consistent output regardless of who runs the review", "Cross-border matters without cross-border counsel on every question"],
      cta: "Explore for law firms",
    },
    {
      icon: Users,
      title: "For in-house teams",
      body: "You are the bottleneck between sales and revenue, and the volume does not care about your headcount. Contralyne gives you a defensible first pass on every incoming contract, so the standard ones move and you spend your attention on the ones that matter.",
      points: ["Faster turnaround on vendor and customer paper", "Your positions applied automatically, every time", "Clear risk trail for anything that escalates"],
      cta: "Explore for in-house",
    },
  ];

  return (
    <section id="segments" className="relative overflow-hidden py-20 sm:py-24 bg-white">
      <div className="absolute top-1/2 -translate-y-1/2 -right-32 h-80 w-80 rounded-full bg-[#00BFA6]/[0.06] blur-[110px] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Whether you bill the review <span className="font-serif italic font-medium">or absorb it</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cards.map(c => (
            <div key={c.title} className="rounded-2xl bg-[#D9FAF4] p-8">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white text-[#00BFA6] mb-5 shadow-sm">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-[#0F2A2A] mb-3">{c.title}</h3>
              <p className="text-[15px] text-[#0F2A2A]/65 leading-relaxed mb-5">{c.body}</p>
              <ul className="space-y-2 mb-6">
                {c.points.map(p => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-[#0F2A2A]/80">
                    <Check className="h-4 w-4 text-[#00BFA6] mt-0.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
              <a href="#contact" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00BFA6] hover:underline">
                {c.cta} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 10: The playbook ────────────────────────────────────────────────────

function Playbook() {
  const rules = [
    "Limitation of liability must be mutual",
    "Arbitration clause required — no court proceedings",
    "Auto-renewal notice period ≤ 30 days",
    "IP ownership: work-for-hire language required",
    "GDPR data processing addendum required (EU counterparties)",
    "Payment terms: Net-30 maximum",
  ];

  return (
    <section className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">The Playbook</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight mb-5">
              Your standards, applied to <span className="font-serif italic font-medium">every contract</span>
            </h2>
            <p className="text-lg text-[#0F2A2A]/60 leading-relaxed mb-6">
              Define your firm&apos;s positions once. Limitation of liability must be mutual. Arbitration required.
              Auto-renewal notice capped at thirty days. GDPR data processing addendum mandatory for EU
              counterparties. Every contract you analyse is measured against those rules automatically, and
              every deviation comes back as a specific flagged risk with proposed replacement language.
            </p>
            <ul className="space-y-2.5">
              {["Clause-level requirements with your own severity levels", "Active rules injected into every analysis, no manual step", "Deviations flagged as specific risks, not generic warnings", "Update the playbook once, every future review reflects it"].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#0F2A2A]/80">
                  <Check className="h-4 w-4 text-[#00BFA6] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0F2A2A]/45 mb-4">Your Active Review Rules</p>
            <div className="space-y-2.5">
              {rules.map((rule) => (
                <div key={rule} className="flex items-center gap-3 rounded-lg bg-[#D9FAF4] px-3 py-2.5 text-sm text-[#0F2A2A]/80">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#00BFA6] shrink-0" />
                  {rule}
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-[#0F2A2A]/45 text-center">6 active rules · applied to every analysis</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 11: Professional responsibility and accuracy ───────────────────────

function ProfessionalResponsibility() {
  const columns = [
    {
      icon: UserCheck,
      title: "Human in the loop, by design",
      body: "Contralyne produces analysis and drafts language. It does not advise, and it does not sign. Every output is a starting point for a qualified practitioner, and professional judgment stays where the professional rules require it: with you.",
    },
    {
      icon: BookOpen,
      title: "Aligned with professional guidance",
      body: "Our approach reflects the principles set out in the ABA's Formal Opinion 512 on generative AI, the EU AI Act's transparency obligations, and equivalent guidance emerging across the jurisdictions we cover.",
      flag: true,
    },
    {
      icon: Eye,
      title: "Transparent about accuracy",
      body: "No AI catches everything, and any vendor who claims otherwise is not being straight with you. We publish our benchmark methodology, what we test against, and where the model is weakest, so you can calibrate how much to rely on it.",
    },
  ];

  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Built for the way the profession <span className="font-serif italic font-medium">actually regulates AI</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {columns.map(c => (
            <div key={c.title}>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#D9FAF4] text-[#0F2A2A] mb-4">
                <c.icon className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-[#0F2A2A] mb-2.5 flex items-center gap-2">
                {c.title}
                {c.flag && <ConfirmBadge>counsel review</ConfirmBadge>}
              </h3>
              <p className="text-sm text-[#0F2A2A]/65 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 12: Security ────────────────────────────────────────────────────────

function Security() {
  const items = [
    { icon: Lock, title: "Encrypted at rest and in transit", desc: "Contract files are stored with AES-256 encryption. TLS 1.3 in transit." },
    { icon: Shield, title: "No public buckets, ever", desc: "Files are never publicly accessible. Every download is a time-limited, user-specific pre-signed URL." },
    { icon: ShieldCheck, title: "SOC 2 certified infrastructure", desc: "The entire stack runs on independently SOC 2 certified infrastructure. Full architecture detail is available under NDA for your security review." },
    { icon: Globe, title: "Your contracts never train AI", desc: "Model access runs under commercial terms that prohibit training on customer data. Your contracts stay yours, and they stay privileged." },
  ];

  return (
    <section id="security" className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">Security</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Enterprise-grade security, <span className="font-serif italic font-medium">end to end</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#00BFA6]/10 text-[#00BFA6] mb-4">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F2A2A] mb-2">{item.title}</h3>
              <p className="text-sm text-[#0F2A2A]/60 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs text-[#0F2A2A]/40 max-w-2xl mx-auto">
            AI-generated insights are for informational purposes only and do not constitute legal advice.
            Professional liability for any legal advice remains with the practitioner.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Section 13: Getting started ─────────────────────────────────────────────────

function GettingStarted() {
  const steps = [
    { icon: Upload, label: "Day 1", body: "Accounts created for your whole team. No software to install, no Word add-in, no IT ticket. Open a browser and upload your first contract." },
    { icon: Target, label: "Week 1", body: "Your playbook rules loaded and tested against contracts you have already negotiated, so you can see how Contralyne would have handled deals you know the answer to." },
    { icon: TrendingUp, label: "Week 4", body: "Running on live matters, with your team's usage patterns feeding back into your rules." },
  ];

  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Live this week, <span className="font-serif italic font-medium">not this quarter</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
          <div className="hidden sm:block absolute top-5 left-[16.5%] right-[16.5%] h-px bg-[#0F2A2A]/10" />
          {steps.map((s) => (
            <div key={s.label} className="relative text-center sm:text-left">
              <div className="inline-flex h-10 w-10 rounded-full bg-[#00BFA6] text-white items-center justify-center mb-4 relative ring-4 ring-white">
                <s.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold text-[#00BFA6] uppercase tracking-wide mb-1.5">{s.label}</p>
              <p className="text-sm text-[#0F2A2A]/65 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 14: Why Contralyne ──────────────────────────────────────────────────
// Replaces the deleted named-competitor comparison — three positive,
// self-referential pillars instead.

function WhyContralyne() {
  const pillars = [
    { icon: Scale, title: "Jurisdiction first", body: "Most contract AI was trained on American paper and reasons like an American lawyer. If your contracts cross borders, that is not a small problem. Contralyne reasons from the governing law of the contract in front of it." },
    { icon: Target, title: "Context over templates", body: "The same clause is fine in one deal and unacceptable in the next. Contralyne reviews your actual deal, with your counterparty, at your deal value, against your playbook." },
    { icon: ShieldCheck, title: "Built to be checked", body: "Every flag comes with its reasoning and its statutory grounding, so you can verify it in seconds rather than trusting it blindly. That is what makes it usable on work you sign your name to." },
  ];

  return (
    <section className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">Why Contralyne</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Why teams choose <span className="font-serif italic font-medium">Contralyne</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {pillars.map(p => (
            <div key={p.title} className="rounded-2xl bg-white p-7 shadow-sm">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#00BFA6]/10 text-[#00BFA6] mb-5">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#0F2A2A] mb-2.5">{p.title}</h3>
              <p className="text-[15px] text-[#0F2A2A]/65 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 15: Founder and origin ──────────────────────────────────────────────
// Shell only — placeholder copy, clearly marked. Needs to be written with the
// founder (first person, signed, with photo + LinkedIn) before this ships.

function FounderOrigin() {
  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center mb-6">
          <ConfirmBadge>placeholder section — write with founder before publishing</ConfirmBadge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 items-start rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/30 p-8">
          <div className="mx-auto lg:mx-0 h-48 w-48 rounded-2xl bg-[#0F2A2A]/10 flex items-center justify-center text-[#0F2A2A]/30 text-sm font-medium text-center">
            Founder photo
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F2A2A] leading-tight mb-4">
              Why we built this
            </h2>
            <p className="text-[15px] text-[#0F2A2A]/60 leading-relaxed italic">
              [Placeholder — first-person, signed story to be written with the founder: the specific
              moment that caused it (a real contract, a real jurisdiction mismatch, a real near-miss);
              what was wrong with the tools that existed; the one belief the product rests on; what
              Contralyne refuses to do.]
            </p>
            <p className="mt-5 text-sm font-semibold text-[#0F2A2A]/40">— [Name], [Title] · LinkedIn</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 16: FAQ ─────────────────────────────────────────────────────────────

const FAQ_ITEMS: { q: string; a: string; flag?: boolean }[] = [
  {
    q: "How accurate is it, honestly?",
    a: "Every flag comes with its reasoning and statutory grounding so you can verify it, not just trust it. Contralyne is a first pass, not a substitute for review — accuracy varies by contract complexity and jurisdiction depth.",
  },
  {
    q: "Does using this waive privilege?",
    a: "This needs a counsel-reviewed answer specific to how Contralyne handles contract data before it can be published with confidence.",
    flag: true,
  },
  {
    q: "Are my contracts used to train the model?",
    a: "No. Model access runs under commercial terms that prohibit training on customer data.",
  },
  {
    q: "Where is my data stored?",
    a: "Files are stored on AWS infrastructure (currently ap-south-1) with encryption at rest and in transit. Confirm current region and any India/EU data-residency commitments before publishing.",
    flag: true,
  },
  {
    q: "Do I need Microsoft Word?",
    a: "No. Contralyne runs in any browser, and exports to Word with tracked changes when you need it.",
  },
  {
    q: "What contract types does it handle best?",
    a: "NDAs, MSAs, SaaS agreements, statements of work, order forms, employment agreements, and vendor paper. Confirm which of these to lead with based on real usage before publishing.",
    flag: true,
  },
  {
    q: "How is it priced?",
    a: "Per seat, per year — contact us for a range tailored to your team size and volume.",
    flag: true,
  },
  {
    q: "What happens to my data if we leave?",
    a: "You can export your contracts and analyses, and request full deletion of your account and all associated data.",
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Questions your security and <span className="font-serif italic font-medium">procurement teams will ask</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <div key={item.q} className="rounded-xl bg-white shadow-sm overflow-hidden self-start">
                <button onClick={() => setOpenIdx(isOpen ? null : i)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
                  <span className="text-sm font-semibold text-[#0F2A2A]">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 text-[#0F2A2A]/40 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-[#0F2A2A]/60 leading-relaxed">{item.a}</p>
                    {item.flag && <div className="mt-2"><ConfirmBadge>confirm before publishing</ConfirmBadge></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Section 17: Final CTA ────────────────────────────────────────────────────────

function FinalCta({ isSignedIn }: { isSignedIn: boolean }) {
  const reassurances = [
    "A personalised walkthrough on your own contract types",
    "Pricing for your team size and volume",
    "Accounts set up for your whole team",
    "Straight answers on security, data handling, and jurisdiction coverage",
  ];

  return (
    <section className="py-20 sm:py-24 bg-[#00BFA6]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-5">
          See it on a contract you have <span className="font-serif italic font-medium">already negotiated</span>
        </h2>
        <p className="text-lg text-white/85 mb-9 max-w-xl mx-auto">
          The fastest way to judge Contralyne is to run it on a deal you know the answer to. Send us the
          contract types you handle and we will walk you through the analysis on your own paper, with
          your jurisdiction and your playbook applied.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          {isSignedIn ? (
            <Button size="lg" asChild className="text-base px-8 h-12 rounded-full bg-[#D9FAF4] text-[#0F2A2A] hover:bg-white shadow-none">
              <a href={appUrl("/dashboard")}>Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild className="text-base px-8 h-12 rounded-full bg-[#D9FAF4] text-[#0F2A2A] hover:bg-white shadow-none">
                <a href="#contact">Book a Demo <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
              <Button size="lg" variant="ghost" asChild className="text-base px-8 h-12 rounded-full text-white hover:bg-white/10 hover:text-white">
                <a href="#how-it-works">See a Sample Analysis</a>
              </Button>
            </>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto">
          {reassurances.map(r => (
            <div key={r} className="flex items-start gap-2 text-sm text-white/90">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
              {r}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 18: Contact form ─────────────────────────────────────────────────────
// Four fields, per the plan — team_size drops out of the form (still sent as
// undefined; the backend field stays optional, unchanged) and the free-text
// field is reframed around contract types rather than a generic "message".

function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", firm: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          firm: form.firm,
          message: form.message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send your message. Please try again.");
      setSent(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="contact" className="py-20 sm:py-24 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Bring Contralyne to your team
          </h2>
        </div>

        <div className="rounded-2xl bg-[#D9FAF4] p-6 sm:p-8">
          {sent ? (
            <div className="text-center py-14">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00BFA6]/10 mb-5">
                <Mail className="h-6 w-6 text-[#00BFA6]" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F2A2A] mb-2">Message sent</h3>
              <p className="text-sm text-[#0F2A2A]/60 max-w-xs mx-auto">
                Thanks for reaching out — we&apos;ll get back to you at <span className="font-medium text-[#0F2A2A]">{form.email}</span> within one business day.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="text-xs font-medium text-[#0F2A2A]/70 mb-1.5 block">Full name *</label>
                  <Input id="contact-name" value={form.name} onChange={set("name")} placeholder="Jane Smith" required maxLength={200} />
                </div>
                <div>
                  <label htmlFor="contact-email" className="text-xs font-medium text-[#0F2A2A]/70 mb-1.5 block">Work email *</label>
                  <Input id="contact-email" type="email" value={form.email} onChange={set("email")} placeholder="jane@yourfirm.com" required maxLength={320} />
                </div>
              </div>
              <div>
                <label htmlFor="contact-firm" className="text-xs font-medium text-[#0F2A2A]/70 mb-1.5 block">Firm or company *</label>
                <Input id="contact-firm" value={form.firm} onChange={set("firm")} placeholder="Smith & Partners LLP" required maxLength={200} />
              </div>
              <div>
                <label htmlFor="contact-message" className="text-xs font-medium text-[#0F2A2A]/70 mb-1.5 block">What contracts do you review most? *</label>
                <Textarea
                  id="contact-message"
                  value={form.message}
                  onChange={set("message")}
                  placeholder="e.g. SaaS agreements and vendor MSAs across the US and India"
                  required
                  maxLength={5000}
                  rows={3}
                />
              </div>
              <Button type="submit" className={`w-full h-11 text-base ${btnPrimary}`} disabled={sending}>
                {sending ? "Sending…" : "Book a Demo"}
              </Button>
              <p className="text-[11px] text-[#0F2A2A]/45 text-center">
                We only use your details to respond to this enquiry. Prefer email? Write to{" "}
                <a href="mailto:contact@contralyne.com" className="text-[#00BFA6] hover:underline font-medium">contact@contralyne.com</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Section 19: Footer ──────────────────────────────────────────────────────────
// Expanded to five columns. Items with no page yet (per the content plan's
// "[build these pages]" notes) render as plain text instead of a dead link.

function FooterLink({ label, href }: { label: string; href?: string }) {
  if (!href) return <span className="text-[#D9FAF4]/30 cursor-default">{label}</span>;
  return <a href={href} className="hover:text-[#D9FAF4] transition-colors">{label}</a>;
}

function Footer() {
  const columns: { title: string; links: { label: string; href?: string }[] }[] = [
    {
      title: "Product",
      links: [
        { label: "Overview", href: "#context-engine" },
        { label: "Context Engine", href: "#context-engine" },
        { label: "Playbooks", href: "#" },
        { label: "Redlines & export", href: "#how-it-works" },
        { label: "Per-contract chat", href: "#" },
        { label: "Pricing", href: "#contact" },
      ],
    },
    {
      title: "Jurisdictions",
      links: [
        { label: "United States", href: "#jurisdictions" },
        { label: "United Kingdom", href: "#jurisdictions" },
        { label: "European Union", href: "#jurisdictions" },
        { label: "India", href: "#jurisdictions" },
      ],
    },
    {
      title: "Solutions",
      links: [
        { label: "For law firms", href: "#segments" },
        { label: "For in-house teams", href: "#segments" },
        { label: "By contract type" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Blog" },
        { label: "Clause guides" },
        { label: "Playbook templates" },
        { label: "Accuracy methodology" },
        { label: "Trust centre" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Security", href: "#security" },
        { label: "Contact", href: "#contact" },
        { label: "Terms" },
        { label: "Privacy" },
      ],
    },
  ];

  return (
    <footer className="bg-[#0F2A2A] text-[#D9FAF4]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-2 mb-8">
          <ContralyneLogoMark className="h-7 w-7" onDark />
          <span className="text-base font-bold text-[#D9FAF4]">Contralyne</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 mb-10">
          {columns.map(col => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D9FAF4]/40 mb-4">{col.title}</p>
              <ul className="space-y-2 text-sm">
                {col.links.map(l => (
                  <li key={l.label}><FooterLink {...l} /></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[#D9FAF4]/10 pt-6">
          <p className="text-xs text-[#D9FAF4]/40 max-w-3xl">
            AI-generated insights are for informational purposes only and do not constitute legal advice.
            Professional responsibility for any legal advice remains with the practitioner.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#D9FAF4]/40">© 2026 Contralyne. All rights reserved.</p>
            <p className="text-xs text-[#D9FAF4]/40">Built for US · UK · EU · India legal teams</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const signedIn = isLoaded ? !!isSignedIn : false;

  return (
    <div className="min-h-screen bg-white font-sans text-[#0F2A2A]">
      <LandingNav />
      <main>
        <Hero />
        <ProofBar />
        <TheProblem />
        <ContextEngine />
        <HowItWorks />
        <AskAnything />
        <Jurisdictions />
        <Segments />
        <Playbook />
        <ProfessionalResponsibility />
        <Security />
        <GettingStarted />
        <WhyContralyne />
        <FounderOrigin />
        <FAQ />
        <ContactSection />
        <FinalCta isSignedIn={signedIn} />
      </main>
      <Footer />
    </div>
  );
}
