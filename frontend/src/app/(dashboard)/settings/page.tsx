"use client";
import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  User, SlidersHorizontal, Shield, Info,
  ExternalLink, Check, LogOut, Lock, CreditCard,
  Bell, CheckCircle2, Trash2, AlertTriangle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CONTRACT_TYPE_LABELS } from "@/lib/utils";
import type { ContractType } from "@/lib/types";

const PREF_KEY = "contralyn_prefs";

interface Prefs {
  defaultContractType: ContractType | "none";
  defaultJurisdiction: string;
  emailNotifications: boolean;
}

const DEFAULT_PREFS: Prefs = {
  defaultContractType: "none",
  defaultJurisdiction: "",
  emailNotifications: true,
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

function formatJoinDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const TABS = [
  { id: "profile" as const,     label: "Profile",      icon: User              },
  { id: "preferences" as const, label: "Preferences",  icon: SlidersHorizontal },
  { id: "security" as const,    label: "Security",     icon: Shield            },
  { id: "about" as const,       label: "About",        icon: Info              },
];

type TabId = typeof TABS[number]["id"];

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked ? "bg-primary" : "bg-gray-200",
      )}
    >
      <span className={cn(
        "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
        checked ? "translate-x-5" : "translate-x-0.5",
      )} />
    </button>
  );
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab({
  fullName, email, avatarUrl, initials, user,
  onOpenProfile, onSignOut,
}: {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  initials: string;
  user: ReturnType<typeof useUser>["user"];
  onOpenProfile: () => void;
  onSignOut: () => void;
}) {
  const authMethod = user?.externalAccounts?.length
    ? `Google (${user.externalAccounts[0]?.emailAddress ?? "OAuth"})`
    : "Email / Password";
  const memberSince = user?.createdAt ? formatJoinDate(user.createdAt) : "—";

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      {/* Hero banner */}
      <div className="rounded-2xl overflow-hidden border bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-primary/80 to-primary" />
        <div className="px-8 pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="h-20 w-20 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-primary/10 flex items-center justify-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary uppercase">{initials}</span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onOpenProfile} className="gap-2 mb-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Edit Profile
            </Button>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

      {/* Info grid */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/70">
          <h3 className="text-sm font-semibold text-gray-700">Account Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
          {[
            { label: "Full Name", value: fullName },
            { label: "Email Address", value: email },
            { label: "Auth Method", value: authMethod },
            { label: "Member Since", value: memberSince },
          ].map(({ label, value }) => (
            <div key={label} className="px-6 py-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/70">
          <h3 className="text-sm font-semibold text-gray-700">Account Actions</h3>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Manage Profile</p>
              <p className="text-xs text-gray-400 mt-0.5">Update name, email, password, and connected accounts via Clerk</p>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenProfile} className="shrink-0 gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Button>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Change Password / 2FA</p>
              <p className="text-xs text-gray-400 mt-0.5">Manage security settings and two-factor authentication</p>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenProfile} className="shrink-0 gap-2">
              <Lock className="h-3.5 w-3.5" />
              Manage
            </Button>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-red-600">Sign Out</p>
              <p className="text-xs text-gray-400 mt-0.5">Sign out of Contralyne on this device</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              className="shrink-0 gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Preferences tab ──────────────────────────────────────────────────────────

function PreferencesTab({
  prefs, saved, onUpdatePref, onSave,
}: {
  prefs: Prefs;
  saved: boolean;
  onUpdatePref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  onSave: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Preferences</h2>
        <p className="text-sm text-gray-500 mt-1">Customize your default review settings.</p>
      </div>

      {/* Defaults */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/70">
          <h3 className="text-sm font-semibold text-gray-700">Review Defaults</h3>
          <p className="text-xs text-gray-400 mt-0.5">Pre-filled when you upload a new contract</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="defaultType" className="text-sm font-medium text-gray-700">Default Contract Type</Label>
            <Select
              value={prefs.defaultContractType}
              onValueChange={(v) => onUpdatePref("defaultContractType", v as Prefs["defaultContractType"])}
            >
              <SelectTrigger id="defaultType" className="h-10">
                <SelectValue placeholder="No default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default</SelectItem>
                {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">Pre-selected on the upload screen</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultJurisdiction" className="text-sm font-medium text-gray-700">Default Jurisdiction</Label>
            <Select
              value={prefs.defaultJurisdiction || "none"}
              onValueChange={(v) => onUpdatePref("defaultJurisdiction", v === "none" ? "" : v)}
            >
              <SelectTrigger id="defaultJurisdiction" className="h-10">
                <SelectValue placeholder="No default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default</SelectItem>
                <SelectItem value="England & Wales">England & Wales</SelectItem>
                <SelectItem value="Scotland">Scotland</SelectItem>
                <SelectItem value="United States (Federal)">United States (Federal)</SelectItem>
                <SelectItem value="Delaware">Delaware</SelectItem>
                <SelectItem value="New York">New York</SelectItem>
                <SelectItem value="California">California</SelectItem>
                <SelectItem value="European Union">European Union</SelectItem>
                <SelectItem value="India">India</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">Pre-filled in the legal intake form</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/70">
          <h3 className="text-sm font-semibold text-gray-700">Notifications</h3>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Email Notifications</p>
                <p className="text-xs text-gray-400 mt-0.5">Receive alerts when contract analysis completes</p>
              </div>
            </div>
            <Toggle
              checked={prefs.emailNotifications}
              onChange={(v) => onUpdatePref("emailNotifications", v)}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={onSave} className="gap-2 px-6">
          {saved ? (
            <><CheckCircle2 className="h-4 w-4" />Saved!</>
          ) : (
            <><Check className="h-4 w-4" />Save Preferences</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Security tab ─────────────────────────────────────────────────────────────

function SecurityTab({ onOpenProfile, onDeleteAccount }: { onOpenProfile: () => void; onDeleteAccount: () => void }) {
  const securityItems = [
    { label: "Authentication", detail: "Clerk — SOC2 certified", ok: true },
    { label: "File storage", detail: "AWS S3 — AES-256 encrypted at rest", ok: true },
    { label: "Transport", detail: "TLS 1.3 in transit", ok: true },
    { label: "Database", detail: "Supabase PostgreSQL — row-level security", ok: true },
    { label: "AI provider", detail: "Anthropic — contracts never used for training", ok: true },
  ];

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Security & Privacy</h2>
        <p className="text-sm text-gray-500 mt-1">Your contracts and data are protected at every layer.</p>
      </div>

      {/* Security status */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/70">
          <h3 className="text-sm font-semibold text-gray-700">Security Status</h3>
        </div>
        <div className="divide-y">
          {securityItems.map(({ label, detail, ok }) => (
            <div key={label} className="flex items-center gap-4 px-6 py-4">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                ok ? "bg-emerald-100" : "bg-red-100",
              )}>
                <CheckCircle2 className={cn("h-4 w-4", ok ? "text-emerald-600" : "text-red-500")} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{detail}</p>
              </div>
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
              )}>
                {ok ? "Secure" : "Action needed"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Billing placeholder */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/70">
          <h3 className="text-sm font-semibold text-gray-700">Account Security</h3>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Password & Two-Factor Auth</p>
              <p className="text-xs text-gray-400 mt-0.5">Manage your password and 2FA via Clerk</p>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenProfile} className="shrink-0 gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Manage
            </Button>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Billing & Plan</p>
              <p className="text-xs text-gray-400 mt-0.5">View your subscription and payment details</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-2">
              <CreditCard className="h-3.5 w-3.5" />
              View
            </Button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/60">
          <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Delete Account</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Permanently delete your account and all data — contracts, analyses, and files. This cannot be undone.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeleteAccount}
            className="shrink-0 gap-2 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Account
          </Button>
        </div>
      </div>

      <Separator />

      <p className="text-xs text-gray-400 leading-relaxed">
        AI-generated insights are for informational purposes only and do not constitute legal advice.
        Always consult a qualified lawyer for legal decisions.
      </p>
    </div>
  );
}

// ─── About tab ────────────────────────────────────────────────────────────────

function AboutTab() {
  const stack = [
    { label: "Frontend", value: "Next.js + Tailwind CSS" },
    { label: "Backend", value: "Node.js + Express + TypeScript" },
    { label: "Database", value: "Supabase (PostgreSQL)" },
    { label: "Storage", value: "AWS S3" },
    { label: "Auth", value: "Clerk" },
    { label: "AI", value: "Anthropic Claude" },
    { label: "Hosting", value: "Vercel" },
  ];

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">About Contralyne</h2>
        <p className="text-sm text-gray-500 mt-1">AI-powered contract review and negotiation for legal teams.</p>
      </div>

      {/* App info card */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-6 flex items-center gap-4 border-b">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">Contralyne</p>
            <p className="text-sm text-gray-400">Version 1.0 · Production</p>
          </div>
          <span className="ml-auto text-xs bg-emerald-50 text-emerald-700 font-semibold px-3 py-1 rounded-full border border-emerald-200">
            Live
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tech Stack</p>
            <div className="space-y-2">
              {stack.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Primary Markets</p>
            <div className="space-y-2">
              {["US law firms", "UK law firms", "In-house counsel", "Legal teams", "Solo practitioners"].map(m => (
                <div key={m} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="text-gray-700">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legal disclaimer */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
        <p className="text-sm font-semibold text-amber-800 mb-1">Legal Disclaimer</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          AI-generated insights are for informational purposes only and do not constitute legal advice.
          Always consult a qualified lawyer before making legal decisions. Contralyne is a software tool
          that assists legal professionals — it does not replace professional legal judgment.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const { getToken } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function handleSavePrefs() {
    savePrefs(prefs);
    setSaved(true);
    toast.success("Preferences saved");
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const token = await getToken();
      await deleteAccount(token);
      await signOut({ redirectUrl: "/" });
    } catch {
      toast.error("Failed to delete account — please try again");
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  const fullName  = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";
  const email     = user?.primaryEmailAddress?.emailAddress ?? "—";
  const avatarUrl = user?.imageUrl;
  const initials  = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") || "U";

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">

      {/* ── Left sidebar nav ─────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r bg-white flex flex-col">
        <div className="px-5 py-5 border-b">
          <h1 className="text-base font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400 mt-0.5">Account & preferences</p>
        </div>

        <nav className="flex-1 p-2 pt-3 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors",
                activeTab === id
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Current user chip at bottom */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3 min-w-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={fullName} className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary uppercase">{initials}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{fullName}</p>
              <p className="text-[11px] text-gray-400 truncate">{email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "profile" && (
          <ProfileTab
            user={user}
            fullName={fullName}
            email={email}
            avatarUrl={avatarUrl}
            initials={initials}
            onOpenProfile={() => openUserProfile()}
            onSignOut={() => signOut({ redirectUrl: "/" })}
          />
        )}
        {activeTab === "preferences" && (
          <PreferencesTab
            prefs={prefs}
            saved={saved}
            onUpdatePref={updatePref}
            onSave={handleSavePrefs}
          />
        )}
        {activeTab === "security" && (
          <SecurityTab
            onOpenProfile={() => openUserProfile()}
            onDeleteAccount={() => setDeleteConfirm(true)}
          />
        )}
        {activeTab === "about" && <AboutTab />}
      </div>

      {/* ── Delete account confirmation dialog ───────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-red-100 bg-red-50">
              <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-700">Delete Account</p>
                <p className="text-xs text-red-500">This action is permanent and cannot be undone</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-700">
                All of your data will be permanently deleted, including:
              </p>
              <ul className="text-xs text-gray-500 space-y-1 pl-4 list-disc">
                <li>All uploaded contracts and their analyses</li>
                <li>All files stored in S3</li>
                <li>Clause library and review rules</li>
                <li>Chat history and activity logs</li>
              </ul>
              <p className="text-xs font-semibold text-red-600 mt-2">
                Are you absolutely sure you want to delete your account?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                {deleting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Deleting…</>
                  : <><Trash2 className="h-3.5 w-3.5" />Yes, delete everything</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
