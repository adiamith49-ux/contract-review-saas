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
            <a href="#contact" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Contact</a>
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
                  <a href="#contact">Request a Demo</a>
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
            <a href="#contact" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm text-gray-700 rounded hover:bg-gray-50">Contact</a>
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
                <a href="#contact">
                  Request a Demo <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-base px-8 h-12">
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </>
          )}
        </div>

        {/* Trust note */}
        <p className="mt-6 text-xs text-gray-400">
          Works with PDF &amp; DOCX · Built on AWS, Clerk, Supabase, and Vercel — SOC2-certified infrastructure
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
      us: "Straightforward per-seat licensing at a fraction of the cost",
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
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Enterprise-grade security, end to end</h2>
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
    <section id="contact" className="py-20 sm:py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Pitch */}
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Contact Sales</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
              Bring Contralyne to your firm
            </h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              Contralyne is licensed to law firms and in-house legal teams. Tell us about your team and the contracts you review, and we&apos;ll get back to you with a tailored walkthrough and pricing.
            </p>
            <ul className="space-y-3.5">
              {[
                "A personalised demo on your own contract types",
                "Pricing tailored to your team size and volume",
                "Dedicated onboarding — accounts set up for your whole team",
                "Answers on security, data handling, and jurisdiction coverage",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-gray-500">
              Prefer email? Write to{" "}
              <a href="mailto:contact@contralyne.com" className="text-primary hover:underline font-medium">contact@contralyne.com</a>
            </p>
          </div>

          {/* Form */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            {sent ? (
              <div className="text-center py-14">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-5">
                  <Mail className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Message sent</h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  Thanks for reaching out — we&apos;ll get back to you at <span className="font-medium text-gray-700">{form.email}</span> within one business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="text-xs font-medium text-gray-600 mb-1.5 block">Full name *</label>
                    <Input id="contact-name" value={form.name} onChange={set("name")} placeholder="Jane Smith" required maxLength={200} />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="text-xs font-medium text-gray-600 mb-1.5 block">Work email *</label>
                    <Input id="contact-email" type="email" value={form.email} onChange={set("email")} placeholder="jane@yourfirm.com" required maxLength={320} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-firm" className="text-xs font-medium text-gray-600 mb-1.5 block">Firm / Company *</label>
                    <Input id="contact-firm" value={form.firm} onChange={set("firm")} placeholder="Smith & Partners LLP" required maxLength={200} />
                  </div>
                  <div>
                    <label htmlFor="contact-team" className="text-xs font-medium text-gray-600 mb-1.5 block">Team size</label>
                    <select
                      id="contact-team"
                      value={form.team_size}
                      onChange={set("team_size")}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-gray-900"
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
                  <label htmlFor="contact-message" className="text-xs font-medium text-gray-600 mb-1.5 block">How can we help? *</label>
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
                <Button type="submit" className="w-full h-11 text-base" disabled={sending}>
                  {sending ? "Sending…" : "Request a Demo"}
                </Button>
                <p className="text-[11px] text-gray-400 text-center">
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
    <section className="py-20 sm:py-24 bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-5">
          See Contralyne on your own contracts
        </h2>
        <p className="text-lg text-primary-foreground/80 mb-10 max-w-xl mx-auto">
          Legal teams use Contralyne to catch risks faster, negotiate better positions, and close deals with confidence. Request a demo and see it on your documents.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isSignedIn ? (
            <Button size="lg" variant="secondary" asChild className="text-base px-8 h-12">
              <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          ) : (
            <>
              <Button size="lg" variant="secondary" asChild className="text-base px-8 h-12">
                <a href="#contact">Request a Demo <ArrowRight className="ml-2 h-4 w-4" /></a>
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
              <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Account links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Account</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Request a Demo</a></li>
              <li><a href="mailto:contact@contralyne.com" className="hover:text-white transition-colors">Contact Support</a></li>
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
        <ContactSection />
        <CtaBanner isSignedIn={signedIn} />
      </main>
      <Footer />
    </div>
  );
}
