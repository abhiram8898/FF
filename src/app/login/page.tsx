"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Eye, EyeOff, FileText, Lock, Mail, Package, Plane, Ship } from "lucide-react";
import { DEMO_CREDENTIALS, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const FEATURES = [
  { label: "Air Freight", icon: Plane },
  { label: "Sea Freight", icon: Ship },
  { label: "Quotations", icon: FileText },
  { label: "Bookings", icon: Package },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Hero />
      <div className="flex flex-1 flex-col items-center justify-center px-3 py-3 sm:px-3">
        <Suspense>
          <LoginCard />
        </Suspense>
        <p className="mt-3 text-center text-xs text-slate-400">© {new Date().getFullYear()} FreightTask · Every freight task. One platform.</p>
      </div>
    </div>
  );
}

/** Navy welcome panel; hidden on small screens where the card stands alone */
function Hero() {
  return (
    <section className="relative hidden w-[55%] max-w-4xl overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-white lg:flex lg:flex-col">
      {/* Decorative layers: grid, gold diagonals and a large faded mark */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      <div className="absolute -right-24 -bottom-24 h-[140%] w-40 rotate-[28deg] bg-gradient-to-b from-gold-500/0 via-gold-500/30 to-gold-500/0" aria-hidden />
      <div className="absolute right-20 -bottom-24 h-[140%] w-10 rotate-[28deg] bg-gradient-to-b from-white/0 via-white/10 to-white/0" aria-hidden />
      <Image src="/brand/mark-light.png" alt="" width={530} height={345} className="absolute -right-16 bottom-10 w-[420px] opacity-[0.06]" aria-hidden />

      <div className="relative flex flex-1 flex-col justify-between p-3 xl:p-3">
        <Image src="/brand/logo-light.png" alt="FreightTask" width={1394} height={345} priority className="h-12 w-auto self-start" />

        <div className="max-w-lg">
          <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-brand-100 uppercase">
            <span className="h-0.5 w-8 bg-gold-500" aria-hidden />
            Welcome to FreightTask
          </div>
          <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            Air &amp; Sea Freight
            <br />
            Forwarding <span className="text-gold-400">Simplified.</span>
          </h1>
          <p className="mt-3 text-base text-brand-100">Manage enquiries, quotations, bookings and documentation, all in one platform.</p>

          <ul className="mt-3 grid max-w-md grid-cols-4 divide-x divide-white/15">
            {FEATURES.map(({ label, icon: Icon }) => (
              <li key={label} className="flex flex-col items-center gap-2 px-2 text-center text-xs font-medium text-brand-50">
                <Icon size={26} strokeWidth={1.6} className="text-white" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs font-semibold tracking-[0.3em] text-brand-200 uppercase">Every freight task. One platform.</p>
      </div>
    </section>
  );
}

function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Only follow same-site paths from ?next=
  const next = params.get("next");
  const target = next && /^\/(?![/\\])/.test(next) && !next.includes("\\") ? next : "/";

  // Already signed in: skip the form
  useEffect(() => {
    if (user) router.replace(target);
  }, [user, target, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice("");
    if (!email.trim() || !password) return setError("Enter your email address and password.");
    if (!login(email, password, remember)) setError("Incorrect email or password. Use the demo account below.");
  };

  const fillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setError("");
  };

  const inputCls =
    "h-11 w-full rounded-lg border bg-white pr-3 pl-10 text-sm text-slate-900 shadow-xs outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div className="w-full max-w-md">
      {/* Logo above the card on small screens, where the hero panel is hidden */}
      <Image src="/brand/logo.png" alt="FreightTask" width={1394} height={345} priority className="mx-auto mb-3 h-12 w-auto lg:hidden" />

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-navy-900/5 sm:p-3">
        <Image src="/brand/logo.png" alt="" width={1394} height={345} className="mx-auto hidden h-10 w-auto lg:block" aria-hidden />
        <p className="mt-1.5 hidden text-center text-[10px] font-semibold tracking-[0.25em] text-navy-700 uppercase lg:block">Every freight task. One platform.</p>

        <h2 className="mt-0 text-2xl font-semibold tracking-tight text-slate-900 lg:mt-3">Login</h2>
        <p className="mt-1 text-sm text-slate-500">Enter your credentials to access your account</p>

        <form onSubmit={submit} noValidate className="mt-3 space-y-3">
          <label className="block">
            <span className="sr-only">Email address</span>
            <span className="relative block">
              <Mail size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="email"
                autoComplete="username"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
                className={cn(inputCls, error ? "border-red-300" : "border-slate-300")}
              />
            </span>
          </label>

          <label className="block">
            <span className="sr-only">Password</span>
            <span className="relative block">
              <Lock size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
                className={cn(inputCls, "pr-11", error ? "border-red-300" : "border-slate-300")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-500"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 rounded accent-brand-600" />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setNotice("Password resets aren't available in the demo. Use the demo account below.")}
              className="rounded-sm font-medium text-brand-500 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Forgot Password?
            </button>
          </div>

          {notice && (
            <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
              {notice}
            </p>
          )}

          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-navy-700 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Login
          </button>
        </form>

        <div className="mt-3 rounded-lg border border-dashed border-gold-300 bg-gold-50 p-3 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gold-700">Demo account</span>
            <button
              type="button"
              onClick={fillDemo}
              className="rounded-md bg-white px-2 py-1 font-medium text-brand-700 ring-1 ring-gold-300 ring-inset hover:bg-gold-100 focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Fill in
            </button>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-mono break-all">{DEMO_CREDENTIALS.email}</dd>
            <dt className="text-slate-500">Password</dt>
            <dd className="font-mono">{DEMO_CREDENTIALS.password}</dd>
          </dl>
        </div>

        <p className="mt-3 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <a href="mailto:support@freighttask.com" className="rounded-sm font-medium text-brand-500 hover:text-brand-700 hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}
