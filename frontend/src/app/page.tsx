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
  ChevronRight,
  Check,
  Menu,
  X,
  ArrowRight,
  Lock,
  Upload,
  ScanSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

// ─── Navbar ──────────────────────────────────────────────────────────────────

function LandingNav() {
  const { isSignedIn, isLoaded } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <ContralyneLogoMark className="h-7 w-7" />
            <span className="text-lg font-bold tracking-tight text-gray-900">Contralyne</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
            <a href="#security" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Security</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {isLoaded && isSignedIn ? (
              <Button asChild>
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Get Started Free</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-900"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t py-4 space-y-2">
            <a href="#features" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm text-gray-700 rounded hover:bg-gray-50">Features</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm text-gray-700 rounded hover:bg-gray-50">How It Works</a>
            <a href="#security" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm text-gray-700 rounded hover:bg-gray-50">Security</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm text-gray-700 rounded hover:bg-gray-50">Pricing</a>
            <div className="pt-2 border-t space-y-2">
              {isLoaded && isSignedIn ? (
                <Button asChild className="w-full">
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/sign-in">Sign In</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/sign-up">Get Started Free</Link>
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
    <section className="relative overflow-hidden bg-white pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-white to-violet-50/40 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-8">
          <Zap className="h-3.5 w-3.5" />
          AI-native contract review — jurisdiction-aware
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 max-w-4xl mx-auto leading-[1.1]">
          Review contracts faster.{" "}
          <span className="text-primary">Negotiate smarter.</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Upload any PDF or DOCX contract, add your deal context — jurisdiction, counterparty, deal value — and get clause-by-clause risk analysis with negotiation-ready suggestions in minutes.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {isLoaded && isSignedIn ? (
            <Button size="lg" asChild className="text-base px-8 h-12">
              <Link href="/dashboard">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild className="text-base px-8 h-12">
                <Link href="/sign-up">
                  Start Reviewing Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-base px-8 h-12">
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </>
          )}
        </div>

        {/* Trust note */}
        <p className="mt-6 text-xs text-gray-400">
          No credit card required · Works with PDF &amp; DOCX · Built on AWS, Clerk, Supabase, and Vercel
        </p>

        {/* Mock UI preview */}
        <div className="mt-16 relative">
          <div className="max-w-4xl mx-auto rounded-xl border border-gray-200 shadow-2xl shadow-gray-200/60 overflow-hidden bg-white">
            {/* Mock header bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-gray-400 font-mono">contralyne.com/contracts/msa-acme-corp</span>
            </div>
            {/* Mock content */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">
              {/* Clause list */}
              <div className="p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Clause Analysis</p>
                {mockClauses.map((c, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${c.color}`} />
                    <div>
                      <p className="text-xs font-medium text-gray-800">{c.clause}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{c.note}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Risk summary */}
              <div className="p-5 col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Risk Summary</p>
                <div className="space-y-3">
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-red-600 uppercase">Critical</span>
                    </div>
                    <p className="text-xs text-gray-700">Limitation of liability is one-sided — capped only for Vendor. Client exposure is unlimited. Under Delaware law, this clause is likely enforceable as-is.</p>
                    <p className="text-[11px] text-primary font-medium mt-2 cursor-pointer hover:underline">View negotiation suggestion →</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-orange-600 uppercase">High</span>
                    </div>
                    <p className="text-xs text-gray-700">Auto-renewal clause has a 90-day notice window with no carve-out for termination for convenience. Consider requesting a mutual 30-day notice period.</p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-yellow-600 uppercase">Medium</span>
                    </div>
                    <p className="text-xs text-gray-700">Ambiguous language: &quot;reasonable efforts&quot; in Clause 4.2 is undefined. Recommend replacing with &quot;commercially reasonable efforts&quot; with an objective standard.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Subtle fade at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
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
  { clause: "Confidentiality", note: "Mutual, 3-year term", color: "bg-green-500" },
  { clause: "Payment Terms", note: "Net-30, standard", color: "bg-green-500" },
  { clause: "Force Majeure", note: "Broad, favours vendor", color: "bg-yellow-500" },
];

// ─── Trust strip ──────────────────────────────────────────────────────────────

function TrustStrip() {
  const stats = [
    { value: "75–85%", label: "of material risks caught" },
    { value: "US · UK · EU · IN", label: "jurisdiction-aware" },
    { value: "PDF & DOCX", label: "incl. scanned PDFs (OCR)" },
    { value: "SOC2", label: "certified infrastructure" },
  ];

  return (
    <section className="bg-gray-50 border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
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
      color: "text-orange-500",
      bg: "bg-orange-50",
      title: "Clause-Level Risk Flags",
      description: "Every clause scored critical, high, medium, or low with plain-English explanations. Know exactly which provisions need attention before the negotiation call.",
    },
    {
      icon: Globe,
      color: "text-blue-500",
      bg: "bg-blue-50",
      title: "Jurisdiction Intelligence",
      description: "Deep context for US (UCC, Delaware corporate law), UK (English contract law, Companies Act 2006), EU (GDPR), and India (Indian Contract Act). Not generic AI output.",
    },
    {
      icon: Handshake,
      color: "text-violet-500",
      bg: "bg-violet-50",
      title: "Negotiation Suggestions",
      description: "Specific redline language you can use directly. Not just \"this is risky\" — Claude drafts alternative clauses tailored to your jurisdiction and deal context.",
    },
    {
      icon: Zap,
      color: "text-primary",
      bg: "bg-primary/10",
      title: "Per-Contract AI Chat",
      description: "Ask follow-up questions in plain English. The AI remembers the full contract text, the analysis, and your entire conversation — no context lost between sessions.",
    },
    {
      icon: Gavel,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      title: "Review Rules & Playbook",
      description: "Define your firm's standards once — \"limitation of liability must be mutual\", \"arbitration required\". Every contract is reviewed against them automatically.",
    },
    {
      icon: Download,
      color: "text-pink-500",
      bg: "bg-pink-50",
      title: "Export with Redlines",
      description: "Download DOCX with Word tracked changes and inline comments, or PDF with a two-column redlines layout. Ready to send to the other side.",
    },
  ];

  return (
    <section id="features" className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything your legal team needs</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Built for corporate lawyers, in-house counsel, and legal teams who review contracts daily.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-gray-100 p-6 hover:border-primary/30 hover:shadow-sm transition-all">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${f.bg} mb-4`}>
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
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
      title: "Upload your contract",
      description: "Drop in a PDF or DOCX — up to 10MB. Text is extracted instantly. Scanned PDFs are processed via AWS Textract OCR, so even image-based documents work.",
    },
    {
      number: "02",
      icon: ScanSearch,
      title: "Set your deal context",
      description: "Add jurisdiction, counterparty name, deal value, and urgency. Your active review rules are applied automatically. The AI reviews against your actual deal, not a generic template.",
    },
    {
      number: "03",
      icon: FileText,
      title: "Review, chat, and export",
      description: "Get instant clause-by-clause analysis with risk flags and negotiation suggestions. Ask follow-up questions via chat. Export to Word with tracked changes or PDF with redlines.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">How It Works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">From upload to negotiation in minutes</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            No complex setup. No Word add-in to install. Works in any browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+2.5rem)] right-0 h-px bg-gray-200" />
              )}
              <div className="text-center md:text-left">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-5">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex items-baseline gap-3 mb-3 justify-center md:justify-start">
                  <span className="text-3xl font-black text-gray-100">{step.number}</span>
                  <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
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
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Review Rules</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
              Review every contract against your firm&apos;s standards
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Define your playbook once — clause requirements, fallback positions, mandatory language. Every contract you analyze is automatically reviewed against these rules. Deviations are flagged as specific risks, not generic warnings.
            </p>
            <ul className="space-y-2.5">
              {["Create rules with clause-level requirements and severity levels", "Active rules are injected into every AI analysis automatically", "Deviations from your standards flagged as specific risks with redline suggestions"].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Your Active Review Rules</p>
            <div className="space-y-2.5">
              {rules.map((rule) => (
                <div key={rule} className="flex items-center gap-3 rounded-lg bg-white border border-gray-100 px-3 py-2.5 text-sm text-gray-700 shadow-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {rule}
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-gray-400 text-center">6 active rules · applied to every analysis</div>
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
      us: "Starting at $49/user/month — no enterprise contract required",
    },
  ];

  return (
    <section className="py-20 sm:py-24 bg-gradient-to-br from-primary/5 to-violet-50/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Why Contralyne</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Built for the way lawyers actually work</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Not a Word add-in. Not an enterprise CLM. A focused, fast, AI-native contract review tool.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {comparisons.map((c, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/70 border border-red-100 px-4 py-3 flex items-start gap-2.5">
                <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-600">{c.them}</p>
              </div>
              <div className="rounded-lg bg-white border border-emerald-100 px-4 py-3 flex items-start gap-2.5 shadow-sm">
                <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-800 font-medium">{c.us}</p>
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
    { icon: Lock, title: "Encrypted at rest and in transit", desc: "All contract files stored on AWS S3 with AES-256 encryption. TLS 1.3 in transit." },
    { icon: Shield, title: "Pre-signed URLs — no public buckets", desc: "Files are never publicly accessible. Every download is a time-limited, user-specific URL." },
    { icon: Shield, title: "SOC2-certified stack", desc: "AWS, Clerk, Supabase, and Vercel are independently SOC2 certified. Your data is on infrastructure your security team trusts." },
    { icon: Globe, title: "Your contracts never train AI", desc: "Anthropic's API is used with commercial terms that prohibit training on your data. Your contracts stay yours." },
  ];

  return (
    <section id="security" className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Security</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Enterprise-grade security, without the enterprise contract</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Built on the same infrastructure used by thousands of security-conscious SaaS companies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.title} className="rounded-xl bg-gray-50 border border-gray-100 p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 mb-4">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs text-gray-400 max-w-2xl mx-auto">
            AI-generated insights are for informational purposes only and do not constitute legal advice. Professional liability for any legal advice remains with the practitioner.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing({ isSignedIn }: { isSignedIn: boolean }) {
  const plans = [
    {
      name: "Starter",
      price: "$49",
      per: "per user / month",
      description: "For solo practitioners and small firms getting started with AI contract review.",
      features: [
        "Unlimited contract uploads",
        "Clause-level risk analysis",
        "Negotiation suggestions",
        "Per-contract AI chat",
        "PDF & DOCX export with redlines",
        "US, UK, EU, India jurisdiction support",
        "Email support",
      ],
      cta: isSignedIn ? "Go to Dashboard" : "Get Started Free",
      href: isSignedIn ? "/dashboard" : "/sign-up",
      highlighted: false,
    },
    {
      name: "Professional",
      price: "$99",
      per: "per user / month",
      description: "For legal teams that need custom playbooks and deeper analysis.",
      features: [
        "Everything in Starter",
        "Review Rules & Playbook",
        "Clause Library",
        "Analytics dashboard",
        "Activity audit log",
        "Scanned PDF OCR",
        "Priority support",
      ],
      cta: isSignedIn ? "Go to Dashboard" : "Start Free Trial",
      href: isSignedIn ? "/dashboard" : "/sign-up",
      highlighted: true,
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Transparent pricing. No surprises.</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            A fraction of Ironclad and Kira. Simpler than ContractKen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-8 ${plan.highlighted
                ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                : "border-gray-200 bg-white"
              }`}
            >
              <div className="mb-6">
                <p className={`text-sm font-semibold uppercase tracking-wider mb-1 ${plan.highlighted ? "text-primary-foreground/70" : "text-gray-500"}`}>{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className={`text-sm ${plan.highlighted ? "text-primary-foreground/70" : "text-gray-500"}`}>{plan.per}</span>
                </div>
                <p className={`mt-3 text-sm ${plan.highlighted ? "text-primary-foreground/80" : "text-gray-500"}`}>{plan.description}</p>
              </div>

              <ul className="space-y-2.5 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className={`h-4 w-4 shrink-0 ${plan.highlighted ? "text-primary-foreground/80" : "text-emerald-500"}`} />
                    <span className={plan.highlighted ? "text-primary-foreground/90" : "text-gray-700"}>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={plan.highlighted ? "secondary" : "default"}
                className="w-full"
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          Need more users or custom requirements?{" "}
          <a href="mailto:rajasaipranv0@gmail.com" className="text-primary hover:underline font-medium">Contact us</a>
        </p>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CtaBanner({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="py-20 sm:py-24 bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-5">
          Start reviewing contracts smarter today
        </h2>
        <p className="text-lg text-primary-foreground/80 mb-10 max-w-xl mx-auto">
          Join legal teams using Contralyne to catch risks faster, negotiate better positions, and close deals with confidence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isSignedIn ? (
            <Button size="lg" variant="secondary" asChild className="text-base px-8 h-12">
              <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          ) : (
            <>
              <Button size="lg" variant="secondary" asChild className="text-base px-8 h-12">
                <Link href="/sign-up">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="ghost" asChild className="text-base px-8 h-12 text-white hover:bg-white/10">
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
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <ContralyneLogoMark className="h-6 w-6" />
              <span className="text-base font-bold text-white">Contralyne</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              AI-powered contract review and negotiation for corporate lawyers and legal teams.
            </p>
            <p className="text-xs mt-4 text-gray-500">
              AI-generated insights are for informational purposes only and do not constitute legal advice.
            </p>
          </div>

          {/* Product links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Product</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Security</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>

          {/* Account links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Account</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/sign-up" className="hover:text-white transition-colors">Get Started</Link></li>
              <li><a href="mailto:rajasaipranv0@gmail.com" className="hover:text-white transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 Contralyne. All rights reserved.</p>
          <p className="text-xs text-gray-600">Built for US · UK · EU · India legal teams</p>
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
    <div className="min-h-screen bg-white font-sans">
      <LandingNav />
      <main>
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <Playbook />
        <WhyContralyne />
        <Security />
        <Pricing isSignedIn={signedIn} />
        <CtaBanner isSignedIn={signedIn} />
      </main>
      <Footer />
    </div>
  );
}
