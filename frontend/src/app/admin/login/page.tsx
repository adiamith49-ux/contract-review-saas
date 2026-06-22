"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin, setAdminToken } from "@/lib/admin-api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await adminLogin(email, password);
      setAdminToken(token);
      router.push("/admin/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/90 flex items-center justify-center mb-4 shadow-xl">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Contralyne</h1>
          <p className="text-sm text-slate-400 mt-0.5">Admin Panel</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
          <h2 className="text-base font-semibold text-white mb-5">Sign in to admin</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Email address</label>
              <Input
                type="email"
                placeholder="admin@contralyne.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Password</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          First time?{" "}
          <a href="/admin/setup" className="text-slate-400 hover:text-slate-200 underline">
            Set up admin account
          </a>
        </p>
      </div>
    </div>
  );
}
