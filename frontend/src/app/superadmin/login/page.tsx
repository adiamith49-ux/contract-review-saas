"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestSuperAdminOtp, verifySuperAdminOtp, setSuperAdminToken } from "@/lib/superadmin-api";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

type View = "email" | "code";

// Passwordless by design — a super admin signs in with a one-time code
// emailed to their address, not a password. See admin.ts's /auth/request-otp
// and /auth/verify-otp.
export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("email");
  const [email, setEmail]   = useState("");
  const [code, setCode]     = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const inputCls = "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-primary";
  const labelCls = "text-xs font-medium text-slate-400 mb-1.5 block";

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestSuperAdminOtp(email.trim());
      toast.success("If that email has super admin access, a sign-in code is on its way.");
      setCode("");
      setView("code");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send sign-in code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await verifySuperAdminOtp(email.trim(), code.trim());
      setSuperAdminToken(token, remember);
      router.push("/superadmin/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Could not verify that code");
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
          <h1 className="text-xl font-bold text-white tracking-tight">Contralyne</h1>
          <p className="text-sm text-slate-400 mt-0.5">Super Admin</p>
        </div>

        <div className="bg-[#0F2A2A] rounded-2xl border border-slate-700/60 p-6 shadow-2xl">
          {view === "email" && (
            <>
              <h2 className="text-base font-semibold text-white mb-1">Sign in</h2>
              <p className="text-xs text-slate-400 mb-5">
                Enter your email and we&apos;ll send you a one-time sign-in code — no password needed.
              </p>

              <form onSubmit={handleRequestCode} className="space-y-4">
                <div>
                  <label htmlFor="sa-email" className={labelCls}>Email address</label>
                  <Input
                    id="sa-email"
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
                  {loading ? "Sending…" : "Send sign-in code"}
                </Button>
              </form>
            </>
          )}

          {view === "code" && (
            <>
              <h2 className="text-base font-semibold text-white mb-1">Enter your code</h2>
              <p className="text-xs text-slate-400 mb-5">
                We sent a code to <span className="text-slate-200">{email}</span>. It expires in 15 minutes.
              </p>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label htmlFor="sa-code" className={labelCls}>Sign-in code</label>
                  <Input
                    id="sa-code"
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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Verifying…" : "Sign in"}
                </Button>
              </form>

              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setCode(""); setView("email"); }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestCode({ preventDefault: () => {} } as React.FormEvent)}
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
