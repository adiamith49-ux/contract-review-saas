"use client";
import { useState, useEffect, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  User, SlidersHorizontal, Shield, Info,
  Check, LogOut, Lock, Camera,
  Bell, CheckCircle2, Trash2, AlertTriangle, Loader2, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CONTRACT_TYPE_LABELS } from "@/lib/utils";
import type { ContractType } from "@/lib/types";

function errorMessage(err: unknown): string {
  if (isClerkAPIResponseError(err)) {
    return err.errors[0]?.longMessage ?? err.errors[0]?.message ?? "Something went wrong. Please try again.";
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

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

// ─── Edit profile modal (name + avatar — no Clerk-hosted UI) ──────────────────

function EditProfileModal({
  open, onOpenChange, user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: ReturnType<typeof useUser>["user"];
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setAvatarPreview(user?.imageUrl ?? null);
    setAvatarFile(null);
  }, [open, user]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await user.update({ firstName: firstName.trim(), lastName: lastName.trim() });
      if (avatarFile) await user.setProfileImage({ file: avatarFile });
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-16 w-16 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center shrink-0 group"
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-primary" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-primary hover:underline">
                Change photo
              </button>
              <p className="text-xs text-gray-400 mt-0.5">JPG or PNG</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first-name" className="text-sm font-medium text-gray-700">First name</Label>
              <Input id="first-name" value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1.5" autoFocus />
            </div>
            <div>
              <Label htmlFor="last-name" className="text-sm font-medium text-gray-700">Last name</Label>
              <Input id="last-name" value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change password modal (no Clerk-hosted UI) ───────────────────────────────

function ChangePasswordModal({
  open, onOpenChange, user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: ReturnType<typeof useUser>["user"];
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasPassword = user?.passwordEnabled ?? false;

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [open]);

  async function handleSave() {
    if (!user) return;
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setSaving(true);
    try {
      await user.updatePassword({
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
        signOutOfOtherSessions: true,
      });
      toast.success("Password updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const canSave = newPassword.length >= 8 && confirmPassword.length > 0 && (!hasPassword || currentPassword.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{hasPassword ? "Change password" : "Set a password"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {hasPassword && (
            <div>
              <Label htmlFor="current-password" className="text-sm font-medium text-gray-700">Current password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  autoFocus
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">New password</Label>
            <div className="relative mt-1.5">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">Confirm new password</Label>
            <Input
              id="confirm-password"
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1.5"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? "Updating…" : hasPassword ? "Update password" : "Set password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  onEditProfile, onSignOut,
}: {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  initials: string;
  user: ReturnType<typeof useUser>["user"];
  onEditProfile: () => void;
  onSignOut: () => void;
}) {
  const authMethod = (() => {
    const providers = Array.from(
      new Set((user?.externalAccounts ?? []).map((account) => account.provider))
    );

    if (providers.length === 0) {
      return "Email / Password";
    }

    const providerLabelMap: Record<string, string> = {
      google: "Google",
      facebook: "Facebook",
      oauth_google: "Google",
      oauth_facebook: "Facebook",
    };

    const providerLabels = providers.map((provider) => providerLabelMap[provider] ?? provider);
    return `Social Login (${providerLabels.join(", ")})`;
  })();
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
            <Button variant="outline" size="sm" onClick={onEditProfile} className="gap-2 mb-1">
              <User className="h-3.5 w-3.5" />
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

function SecurityTab({ onChangePassword, onDeleteAccount }: { onChangePassword: () => void; onDeleteAccount: () => void }) {
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

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/70">
          <h3 className="text-sm font-semibold text-gray-700">Account Security</h3>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Password</p>
              <p className="text-xs text-gray-400 mt-0.5">Change your account password</p>
            </div>
            <Button variant="outline" size="sm" onClick={onChangePassword} className="shrink-0 gap-2">
              <Lock className="h-3.5 w-3.5" />
              Manage
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
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

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
            onEditProfile={() => setEditProfileOpen(true)}
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
            onChangePassword={() => setChangePasswordOpen(true)}
            onDeleteAccount={() => setDeleteConfirm(true)}
          />
        )}
        {activeTab === "about" && <AboutTab />}
      </div>

      <EditProfileModal open={editProfileOpen} onOpenChange={setEditProfileOpen} user={user} />
      <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} user={user} />

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
