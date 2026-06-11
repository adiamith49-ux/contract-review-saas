"use client";
import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  User,
  Bell,
  Shield,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

export default function SettingsPage() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

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

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";
  const email = user?.primaryEmailAddress?.emailAddress ?? "—";
  const avatarUrl = user?.imageUrl;

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-gray-700">Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-14 w-14 rounded-full object-cover border"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border">
                <User className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{fullName}</p>
              <p className="text-sm text-gray-500">{email}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Name" value={fullName} />
            <InfoRow label="Email" value={email} />
            <InfoRow
              label="Auth method"
              value={
                user?.externalAccounts?.length
                  ? `Google (${user.externalAccounts[0]?.emailAddress ?? "OAuth"})`
                  : "Email / Password"
              }
            />
            <InfoRow label="Member since" value={user?.createdAt ? formatJoinDate(user.createdAt) : "—"} />
          </div>

          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openUserProfile()}
              className="gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Manage Profile in Clerk
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              Update your name, email, password, or connected accounts via Clerk.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-gray-700">Preferences</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="defaultType">Default Contract Type</Label>
              <Select
                value={prefs.defaultContractType}
                onValueChange={(v) => updatePref("defaultContractType", v as Prefs["defaultContractType"])}
              >
                <SelectTrigger id="defaultType">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Pre-selected on the upload screen.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="defaultJurisdiction">Default Jurisdiction</Label>
              <Select
                value={prefs.defaultJurisdiction || "none"}
                onValueChange={(v) => updatePref("defaultJurisdiction", v === "none" ? "" : v)}
              >
                <SelectTrigger id="defaultJurisdiction">
                  <SelectValue placeholder="None" />
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
              <p className="text-xs text-gray-400">Pre-filled in the legal intake form.</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Email Notifications</p>
              <p className="text-xs text-gray-400">Receive analysis completion alerts by email.</p>
            </div>
            <button
              type="button"
              onClick={() => updatePref("emailNotifications", !prefs.emailNotifications)}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
              style={{ backgroundColor: prefs.emailNotifications ? "hsl(243 75% 59%)" : "#d1d5db" }}
              aria-checked={prefs.emailNotifications}
              role="switch"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  prefs.emailNotifications ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePrefs} size="sm" className="gap-2">
              {saved && <Check className="h-3.5 w-3.5" />}
              {saved ? "Saved" : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-gray-700">Security & Privacy</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-700 space-y-1">
              <p className="font-medium">Your data is secure</p>
              <p className="text-xs leading-relaxed">
                Contracts are stored encrypted in AWS S3. Authentication is handled by Clerk (SOC2 certified).
                Your contract text is never used to train AI models.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <SecurityRow label="Authentication" value="Clerk — SOC2 certified" />
            <SecurityRow label="File storage" value="AWS S3 — encrypted at rest & in transit" />
            <SecurityRow label="Database" value="Supabase (PostgreSQL) — row-level security" />
            <SecurityRow label="AI provider" value="Anthropic — contracts never used for training" />
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Change Password / 2FA</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openUserProfile()}
              className="gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Manage Security in Clerk
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Contralyne</p>
              <p className="text-xs text-gray-400 mt-0.5">AI-powered contract review and negotiation</p>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">v1.0</span>
          </div>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            AI-generated insights are for informational purposes only and do not constitute legal advice.
            Always consult a qualified lawyer for legal decisions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-xs text-gray-500 text-right max-w-[55%]">{value}</span>
    </div>
  );
}

function formatJoinDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
