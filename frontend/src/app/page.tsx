"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  Globe,
  Handshake,
  Download,
  Gavel,
  Zap,
  Shield,
  FileText,
  Check,
  Menu,
  X,
  ArrowRight,
  Lock,
  Upload,
  ScanSearch,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Brand palette ─────────────────────────────────────────────────────────────
// Teal Wave #00BFA6 · Aqua Silk #D9FAF4 · Deep Lagoon #0F2A2A (+ logo red accent)
const btnPrimary =
  "rounded-full bg-[#0F2A2A] text-white hover:bg-[#163a3a] shadow-none";
// Nav link: black text + red underline that grows outward from the center on
// hover and shrinks back to the center on leave.
const navLink =
  "relative text-sm font-semibold text-black transition-colors " +
  "after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:h-[2px] after:bg-red-600 " +
  "after:origin-center after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100";
const btnOutline =
  "rounded-full border border-[#0F2A2A]/25 bg-transparent text-[#0F2A2A] hover:bg-[#0F2A2A]/5 hover:text-[#0F2A2A] shadow-none";

// ─── Navbar ──────────────────────────────────────────────────────────────────

function LandingNav() {
  const { isSignedIn, isLoaded } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[#0F2A2A]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <ContralyneLogoMark className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-black">Contralyne</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            <a href="#features" className={navLink}>Features</a>
            <a href="#how-it-works" className={navLink}>How It Works</a>
            <a href="#security" className={navLink}>Security</a>
            <a href="#contact" className={navLink}>Contact</a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {isLoaded && isSignedIn ? (
              <Button asChild className={btnPrimary}>
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="rounded-full text-[#0F2A2A] hover:bg-[#0F2A2A]/5 hover:text-[#0F2A2A]">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild className={btnPrimary}>
                  <a href="#contact">Request a Demo</a>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-md text-[#0F2A2A]/60 hover:text-[#0F2A2A]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#0F2A2A]/10 py-4 space-y-2">
            <a href="#features" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm font-semibold text-black rounded hover:bg-[#0F2A2A]/5">Features</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm font-semibold text-black rounded hover:bg-[#0F2A2A]/5">How It Works</a>
            <a href="#security" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm font-semibold text-black rounded hover:bg-[#0F2A2A]/5">Security</a>
            <a href="#contact" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm font-semibold text-black rounded hover:bg-[#0F2A2A]/5">Contact</a>
            <div className="pt-2 border-t border-[#0F2A2A]/10 space-y-2">
              {isLoaded && isSignedIn ? (
                <Button asChild className={`w-full ${btnPrimary}`}>
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild className={`w-full ${btnOutline}`}>
                    <Link href="/sign-in">Sign In</Link>
                  </Button>
                  <Button asChild className={`w-full ${btnPrimary}`}>
                    <a href="#contact" onClick={() => setMobileOpen(false)}>Request a Demo</a>
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

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <section className="relative overflow-hidden bg-[#D9FAF4] pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#00BFA6]/10 text-[#00BFA6] rounded-full px-4 py-1.5 text-sm font-semibold mb-8">
          Review , Negotiate ,{" "}
          <span className="text-red-600">Red Line</span>
          {" "}, Close.
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#0F2A2A] max-w-4xl mx-auto leading-[1.05]">
          Review contracts faster.{" "}
          <span className="font-serif italic text-[#00BFA6]">Negotiate smarter.</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-lg sm:text-xl text-[#0F2A2A]/70 max-w-2xl mx-auto leading-relaxed">
          Upload any PDF or DOCX contract, add your deal context — jurisdiction, counterparty, deal value — and get clause-by-clause risk analysis with negotiation-ready suggestions in minutes.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {isLoaded && isSignedIn ? (
            <Button size="lg" asChild className={`text-base px-8 h-12 ${btnPrimary}`}>
              <Link href="/dashboard">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild className={`text-base px-8 h-12 ${btnPrimary}`}>
                <a href="#contact">
                  Request a Demo <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild className={`text-base px-8 h-12 ${btnOutline}`}>
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </>
          )}
        </div>

        {/* Trust note */}
        <p className="mt-6 text-xs text-[#0F2A2A]/45">
          Works with PDF &amp; DOCX · Built on AWS, Clerk, Supabase, and Vercel — SOC2-certified infrastructure
        </p>

        {/* Mock UI preview */}
        <div className="mt-16 relative">
          <div className="max-w-4xl mx-auto rounded-xl border border-[#0F2A2A]/10 shadow-2xl shadow-[#0F2A2A]/10 overflow-hidden bg-white">
            {/* Mock header bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#D9FAF4] border-b border-[#0F2A2A]/10">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-[#00BFA6]" />
              <span className="ml-3 text-xs text-[#0F2A2A]/40 font-mono">contralyne.com/contracts/msa-acme-corp</span>
            </div>
            {/* Mock content */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#0F2A2A]/10">
              {/* Clause list */}
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
              {/* Risk summary */}
              <div className="p-5 col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0F2A2A]/40 mb-4">Risk Summary</p>
                <div className="space-y-3">
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-red-600 uppercase">Critical</span>
                    </div>
                    <p className="text-xs text-[#0F2A2A]/80">Limitation of liability is one-sided — capped only for Vendor. Client exposure is unlimited. Under Delaware law, this clause is likely enforceable as-is.</p>
                    <p className="text-[11px] text-[#00BFA6] font-medium mt-2 cursor-pointer hover:underline">View negotiation suggestion →</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-orange-600 uppercase">High</span>
                    </div>
                    <p className="text-xs text-[#0F2A2A]/80">Auto-renewal clause has a 90-day notice window with no carve-out for termination for convenience. Consider requesting a mutual 30-day notice period.</p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-yellow-600 uppercase">Medium</span>
                    </div>
                    <p className="text-xs text-[#0F2A2A]/80">Ambiguous language: &quot;reasonable efforts&quot; in Clause 4.2 is undefined. Recommend replacing with &quot;commercially reasonable efforts&quot; with an objective standard.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Subtle fade at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#D9FAF4] to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  );
}

const mockClauses = [
  { clause: "Limitation of Liability", note: "One-sided cap", color: "bg-red-500" },
  { clause: "Auto-Renewal", note: "90-day notice window", color: "bg-orange-500" },
  { clause: "Dispute Resolution", note: "Arbitration required", color: "bg-yellow-500" },
  { clause: "IP Ownership", note: "Work-for-hire unclear", color: "bg-orange-400" },
  { clause: "Confidentiality", note: "Mutual, 3-year term", color: "bg-[#00BFA6]" },
  { clause: "Payment Terms", note: "Net-30, standard", color: "bg-[#00BFA6]" },
  { clause: "Force Majeure", note: "Broad, favours vendor", color: "bg-yellow-500" },
];

// ─── Stat cards (Ironclad-style bold colour blocks) ──────────────────────────

function StatCards() {
  const stats = [
    {
      tag: "Accuracy",
      value: "75–85%",
      label: "of material risks caught before signature",
      bg: "bg-[#0F2A2A]",
    },
    {
      tag: "Coverage",
      value: "4",
      label: "jurisdictions covered — US, UK, EU & India",
      bg: "bg-[#00BFA6]",
    },
    {
      tag: "Speed",
      value: "5 min",
      label: "from upload to clause-by-clause analysis",
      bg: "bg-red-600",
    },
    {
      tag: "Simplicity",
      value: "0",
      label: "add-ins to install — works in any browser",
      bg: "bg-[#0a5f54]",
    },
  ];

  return (
    <section className="bg-[#D9FAF4] py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] mb-14 leading-tight">
          Faster reviews, fewer surprises, and{" "}
          <span className="font-serif italic font-medium">measurable value</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((s) => (
            <div
              key={s.tag}
              className={`${s.bg} rounded-3xl p-7 flex flex-col min-h-[320px] text-white transition-transform duration-200 hover:-translate-y-1`}
            >
              <span className="self-start rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                {s.tag}
              </span>
              <p className="mt-auto text-5xl lg:text-6xl font-extrabold tracking-tight">{s.value}</p>
              <p className="mt-3 text-base leading-snug text-white/90">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  const features = [
    {
      icon: AlertTriangle,
      tile: "bg-red-600/10 text-red-600",
      title: "Clause-Level Risk Flags",
      description: "Every clause scored critical, high, medium, or low with plain-English explanations. Know exactly which provisions need attention before the negotiation call.",
    },
    {
      icon: Globe,
      tile: "bg-[#0F2A2A]/10 text-[#0F2A2A]",
      title: "Jurisdiction Intelligence",
      description: "Deep context for US (UCC, Delaware corporate law), UK (English contract law, Companies Act 2006), EU (GDPR), and India (Indian Contract Act). Not generic AI output.",
    },
    {
      icon: Handshake,
      tile: "bg-[#00BFA6]/10 text-[#00BFA6]",
      title: "Negotiation Suggestions",
      description: "Specific redline language you can use directly. Not just \"this is risky\" — Claude drafts alternative clauses tailored to your jurisdiction and deal context.",
    },
    {
      icon: Zap,
      tile: "bg-[#00BFA6]/10 text-[#00BFA6]",
      title: "Per-Contract AI Chat",
      description: "Ask follow-up questions in plain English. The AI remembers the full contract text, the analysis, and your entire conversation — no context lost between sessions.",
    },
    {
      icon: Gavel,
      tile: "bg-[#0F2A2A]/10 text-[#0F2A2A]",
      title: "Review Rules & Playbook",
      description: "Define your firm's standards once — \"limitation of liability must be mutual\", \"arbitration required\". Every contract is reviewed against them automatically.",
    },
    {
      icon: Download,
      tile: "bg-red-600/10 text-red-600",
      title: "Export with Redlines",
      description: "Download DOCX with Word tracked changes and inline comments, or PDF with a two-column redlines layout. Ready to send to the other side.",
    },
  ];

  return (
    <section id="features" className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">Features</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Everything your legal team <span className="font-serif italic font-medium">needs</span>
          </h2>
          <p className="mt-5 text-lg sm:text-xl text-[#0F2A2A]/60 max-w-2xl mx-auto">
            Built for corporate lawyers, in-house counsel, and legal teams who review contracts daily.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${f.tile} mb-4`}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#0F2A2A] mb-2">{f.title}</h3>
              <p className="text-[15px] text-[#0F2A2A]/60 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: Upload,
      tile: "bg-[#00BFA6]",
      title: "Upload your contract",
      description: "Drop in a PDF or DOCX — up to 10MB. Text is extracted instantly. Scanned PDFs are processed via AWS Textract OCR, so even image-based documents work.",
    },
    {
      number: "02",
      icon: ScanSearch,
      tile: "bg-[#0F2A2A]",
      title: "Set your deal context",
      description: "Add jurisdiction, counterparty name, deal value, and urgency. Your active review rules are applied automatically. The AI reviews against your actual deal, not a generic template.",
    },
    {
      number: "03",
      icon: FileText,
      tile: "bg-[#0a5f54]",
      title: "Review, chat, and export",
      description: "Get instant clause-by-clause analysis with risk flags and negotiation suggestions. Ask follow-up questions via chat. Export to Word with tracked changes or PDF with redlines.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">How It Works</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            From upload to negotiation <span className="font-serif italic font-medium">in minutes</span>
          </h2>
          <p className="mt-5 text-lg sm:text-xl text-[#0F2A2A]/60 max-w-xl mx-auto">
            No complex setup. No Word add-in to install. Works in any browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="rounded-2xl bg-white p-7 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="text-center md:text-left">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${step.tile} mb-5`}>
                  <step.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex items-baseline gap-3 mb-3 justify-center md:justify-start">
                  <span className="text-3xl font-black text-[#0F2A2A]/15">{step.number}</span>
                  <h3 className="text-xl font-bold text-[#0F2A2A]">{step.title}</h3>
                </div>
                <p className="text-[15px] text-[#0F2A2A]/60 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Playbook ─────────────────────────────────────────────────────────────────

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
            <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">Review Rules</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight mb-5">
              Review every contract against your firm&apos;s{" "}
              <span className="font-serif italic font-medium">standards</span>
            </h2>
            <p className="text-lg text-[#0F2A2A]/60 leading-relaxed mb-6">
              Define your playbook once — clause requirements, fallback positions, mandatory language. Every contract you analyze is automatically reviewed against these rules. Deviations are flagged as specific risks, not generic warnings.
            </p>
            <ul className="space-y-2.5">
              {["Create rules with clause-level requirements and severity levels", "Active rules are injected into every AI analysis automatically", "Deviations from your standards flagged as specific risks with redline suggestions"].map((item) => (
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

// ─── Why Contralyne ───────────────────────────────────────────────────────────

function WhyContralyne() {
  const comparisons = [
    {
      them: "ContractKen requires Microsoft Word — useless without it",
      us: "Works in any browser — no Word, no add-in to install",
    },
    {
      them: "ContractKen reviews contracts with no deal context",
      us: "Jurisdiction, counterparty, deal value feed every analysis",
    },
    {
      them: "ContractKen has no per-contract conversational AI",
      us: "Full AI chat per contract with persistent context memory",
    },
    {
      them: "Ironclad & Kira start at $50,000–$200,000/year",
      us: "Straightforward per-seat licensing at a fraction of the cost",
    },
  ];

  return (
    <section className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">Why Contralyne</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Built for the way lawyers <span className="font-serif italic font-medium">actually work</span>
          </h2>
          <p className="mt-5 text-lg sm:text-xl text-[#0F2A2A]/60 max-w-xl mx-auto">
            Not a Word add-in. Not an enterprise CLM. A focused, fast, AI-native contract review tool.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {comparisons.map((c, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-white px-4 py-3 flex items-start gap-2.5 shadow-sm">
                <X className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-[#0F2A2A]/60">{c.them}</p>
              </div>
              <div className="rounded-xl bg-white border-l-4 border-[#00BFA6] px-4 py-3 flex items-start gap-2.5 shadow-sm">
                <Check className="h-4 w-4 text-[#00BFA6] mt-0.5 shrink-0" />
                <p className="text-sm text-[#0F2A2A] font-medium">{c.us}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Security ─────────────────────────────────────────────────────────────────

function Security() {
  const items = [
    { icon: Lock, tile: "bg-[#00BFA6]/10 text-[#00BFA6]", title: "Encrypted at rest and in transit", desc: "All contract files stored on AWS S3 with AES-256 encryption. TLS 1.3 in transit." },
    { icon: Shield, tile: "bg-[#0F2A2A]/10 text-[#0F2A2A]", title: "Pre-signed URLs — no public buckets", desc: "Files are never publicly accessible. Every download is a time-limited, user-specific URL." },
    { icon: Shield, tile: "bg-[#0a5f54]/10 text-[#0a5f54]", title: "SOC2-certified stack", desc: "AWS, Clerk, Supabase, and Vercel are independently SOC2 certified. Your data is on infrastructure your security team trusts." },
    { icon: Globe, tile: "bg-[#00BFA6]/10 text-[#00BFA6]", title: "Your contracts never train AI", desc: "Anthropic's API is used with commercial terms that prohibit training on your data. Your contracts stay yours." },
  ];

  return (
    <section id="security" className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">Security</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight">
            Enterprise-grade security, <span className="font-serif italic font-medium">end to end</span>
          </h2>
          <p className="mt-5 text-lg sm:text-xl text-[#0F2A2A]/60 max-w-2xl mx-auto">
            Built on the same infrastructure used by thousands of security-conscious SaaS companies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${item.tile} mb-4`}>
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F2A2A] mb-2">{item.title}</h3>
              <p className="text-sm text-[#0F2A2A]/60 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs text-[#0F2A2A]/45 max-w-2xl mx-auto">
            AI-generated insights are for informational purposes only and do not constitute legal advice. Professional liability for any legal advice remains with the practitioner.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", firm: "", team_size: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
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
          team_size: form.team_size || undefined,
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
    <section id="contact" className="py-20 sm:py-24 bg-[#D9FAF4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Pitch */}
          <div>
            <span className="inline-block rounded-full bg-[#0F2A2A] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white mb-5">Contact Sales</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F2A2A] leading-tight mb-5">
              Bring Contralyne <span className="font-serif italic font-medium">to your firm</span>
            </h2>
            <p className="text-lg text-[#0F2A2A]/60 leading-relaxed mb-8">
              Contralyne is licensed to law firms and in-house legal teams. Tell us about your team and the contracts you review, and we&apos;ll get back to you with a tailored walkthrough and pricing.
            </p>
            <ul className="space-y-3.5">
              {[
                "A personalised demo on your own contract types",
                "Pricing tailored to your team size and volume",
                "Dedicated onboarding — accounts set up for your whole team",
                "Answers on security, data handling, and jurisdiction coverage",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#0F2A2A]/80">
                  <Check className="h-4 w-4 text-[#00BFA6] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-[#0F2A2A]/60">
              Prefer email? Write to{" "}
              <a href="mailto:contact@contralyne.com" className="text-[#00BFA6] hover:underline font-medium">contact@contralyne.com</a>
            </p>
          </div>

          {/* Form */}
          <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-firm" className="text-xs font-medium text-[#0F2A2A]/70 mb-1.5 block">Firm / Company *</label>
                    <Input id="contact-firm" value={form.firm} onChange={set("firm")} placeholder="Smith & Partners LLP" required maxLength={200} />
                  </div>
                  <div>
                    <label htmlFor="contact-team" className="text-xs font-medium text-[#0F2A2A]/70 mb-1.5 block">Team size</label>
                    <select
                      id="contact-team"
                      value={form.team_size}
                      onChange={set("team_size")}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-[#0F2A2A]"
                    >
                      <option value="">Select…</option>
                      <option value="1-5">1–5 people</option>
                      <option value="6-20">6–20 people</option>
                      <option value="21-100">21–100 people</option>
                      <option value="100+">100+ people</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-message" className="text-xs font-medium text-[#0F2A2A]/70 mb-1.5 block">How can we help? *</label>
                  <Textarea
                    id="contact-message"
                    value={form.message}
                    onChange={set("message")}
                    placeholder="Tell us about the contracts your team reviews, your jurisdictions, and what you'd like to see in a demo."
                    required
                    maxLength={5000}
                    rows={4}
                  />
                </div>
                <Button type="submit" className={`w-full h-11 text-base ${btnPrimary}`} disabled={sending}>
                  {sending ? "Sending…" : "Request a Demo"}
                </Button>
                <p className="text-[11px] text-[#0F2A2A]/45 text-center">
                  We only use your details to respond to this enquiry.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CtaBanner({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="py-20 sm:py-24 bg-[#0F2A2A]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-5">
          See Contralyne on <span className="font-serif italic font-medium">your own contracts</span>
        </h2>
        <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
          Legal teams use Contralyne to catch risks faster, negotiate better positions, and close deals with confidence. Request a demo and see it on your documents.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isSignedIn ? (
            <Button size="lg" asChild className="text-base px-8 h-12 rounded-full bg-[#D9FAF4] text-[#0F2A2A] hover:bg-white shadow-none">
              <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild className="text-base px-8 h-12 rounded-full bg-[#D9FAF4] text-[#0F2A2A] hover:bg-white shadow-none">
                <a href="#contact">Request a Demo <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
              <Button size="lg" variant="ghost" asChild className="text-base px-8 h-12 rounded-full text-white hover:bg-white/10 hover:text-white">
                <Link href="/sign-in">Sign In</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#0F2A2A] text-[#D9FAF4]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <ContralyneLogoMark className="h-7 w-7" onDark />
              <span className="text-base font-bold text-[#D9FAF4]">Contralyne</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              AI-powered contract review and negotiation for corporate lawyers and legal teams.
            </p>
            <p className="text-xs mt-4 text-[#D9FAF4]/40">
              AI-generated insights are for informational purposes only and do not constitute legal advice.
            </p>
          </div>

          {/* Product links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D9FAF4]/40 mb-4">Product</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-[#D9FAF4] transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-[#D9FAF4] transition-colors">How It Works</a></li>
              <li><a href="#security" className="hover:text-[#D9FAF4] transition-colors">Security</a></li>
              <li><a href="#contact" className="hover:text-[#D9FAF4] transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Account links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D9FAF4]/40 mb-4">Account</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/sign-in" className="hover:text-[#D9FAF4] transition-colors">Sign In</Link></li>
              <li><a href="#contact" className="hover:text-[#D9FAF4] transition-colors">Request a Demo</a></li>
              <li><a href="mailto:contact@contralyne.com" className="hover:text-[#D9FAF4] transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#D9FAF4]/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#D9FAF4]/40">© 2026 Contralyne. All rights reserved.</p>
          <p className="text-xs text-[#D9FAF4]/40">Built for US · UK · EU · India legal teams</p>
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
    <div className="min-h-screen bg-[#D9FAF4] font-sans text-[#0F2A2A]">
      <LandingNav />
      <main>
        <Hero />
        <StatCards />
        <Features />
        <HowItWorks />
        <Playbook />
        <WhyContralyne />
        <Security />
        <ContactSection />
        <CtaBanner isSignedIn={signedIn} />
      </main>
      <Footer />
    </div>
  );
}
