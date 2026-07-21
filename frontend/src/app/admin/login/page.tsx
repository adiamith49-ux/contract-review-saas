"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin, adminForgotPassword, adminResetPassword, setAdminToken } from "@/lib/admin-api";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

type View = "signin" | "forgot" | "reset";

export default function AdminLoginPage() {
  const router = useRouter();
  const [view, setView]         = useState<View>("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [remember, setRemember] = useState(true);
  const [code, setCode]         = useState("");
  const [newPw, setNewPw]       = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [loading, setLoading]   = useState(false);

  const inputCls = "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-primary";
  const labelCls = "text-xs font-medium text-slate-400 mb-1.5 block";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await adminLogin(email, password);
      setAdminToken(token, remember);
      router.push("/admin/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await adminForgotPassword(email);
      toast.success("If an admin account exists for this email, a reset code has been sent.");
      setView("reset");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send reset code");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await adminResetPassword(email, code.trim(), newPw);
      setAdminToken(token, remember);
      toast.success("Password updated");
      router.push("/admin/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#081a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-white p-1.5 flex items-center justify-center mb-4 shadow-xl">
            <ContralyneLogoMark className="h-full w-full" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Contralyne</h1>
          <p className="text-sm text-slate-400 mt-0.5">Admin Panel</p>
        </div>

        <div className="bg-[#0F2A2A] rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
          {view === "signin" && (
            <>
              <h2 className="text-base font-semibold text-white mb-5">Sign in to admin</h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="admin-email" className={labelCls}>Email address</label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@contralyne.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                    autoFocus
                    className={inputCls}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="admin-password" className="text-xs font-medium text-slate-400">Password</label>
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-400 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-emerald-600"
                  />
                  Keep me signed in on this device
                </label>

                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </>
          )}

          {view === "forgot" && (
            <>
              <h2 className="text-base font-semibold text-white mb-1">Reset password</h2>
              <p className="text-xs text-slate-400 mb-5">
                Enter your admin email and we&apos;ll send you a 6-digit reset code.
              </p>

              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className={labelCls}>Email address</label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="admin@contralyne.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    autoFocus
                    className={inputCls}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset code"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setView("signin")}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            </>
          )}

          {view === "reset" && (
            <>
              <h2 className="text-base font-semibold text-white mb-1">Enter reset code</h2>
              <p className="text-xs text-slate-400 mb-5">
                We sent a code to <span className="text-slate-200">{email}</span>. It expires in 15 minutes.
              </p>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label htmlFor="reset-code" className={labelCls}>Reset code</label>
                  <Input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    className={`${inputCls} tracking-widest`}
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className={labelCls}>New password</label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPw ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(v => !v)}
                      aria-label={showNewPw ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Resetting…" : "Reset password & sign in"}
                </Button>
              </form>

              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setCode(""); setView("forgot"); }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={loading}
                  className="font-medium text-primary hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
