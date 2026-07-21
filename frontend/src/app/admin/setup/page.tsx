"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAdminToken } from "@/lib/admin-api";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminSetupPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ email: "", name: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/create-first-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, name: form.name, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Setup failed");
      setAdminToken(data.token);
      toast.success("Admin account created");
      router.push("/admin/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#081a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-white p-1.5 flex items-center justify-center mb-4 shadow-xl">
            <ContralyneLogoMark className="h-full w-full" />
          </div>
          <h1 className="text-xl font-bold text-white">Create Admin Account</h1>
          <p className="text-sm text-slate-400 mt-0.5">One-time setup — only if no admin exists</p>
        </div>

        <div className="bg-[#0F2A2A] rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
          <form onSubmit={handleSetup} className="space-y-4">
            {[
              { label: "Full name",   key: "name",     type: "text",     placeholder: "Amith" },
              { label: "Email",       key: "email",    type: "email",    placeholder: "admin@contralyne.com" },
              { label: "Password",    key: "password", type: "password", placeholder: "Min 8 characters" },
              { label: "Confirm",     key: "confirm",  type: "password", placeholder: "Repeat password" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">{label}</label>
                <Input
                  type={type}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required
                  minLength={key === "password" || key === "confirm" ? 8 : undefined}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                />
              </div>
            ))}
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Creating…" : "Create admin account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
