"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, FileText, KeyRound, Lock, Mail, Package, Plane, Ship } from "lucide-react";
import { DEMO_CREDENTIALS, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui";

const FEATURES = [
  { label: "Air Freight", icon: Plane },
  { label: "Sea Freight", icon: Ship },
  { label: "Quotations", icon: FileText },
  { label: "Bookings", icon: Package },
];

export default function LoginPage() {
  return (
    <div className="light-scope flex min-h-screen bg-white">
      <Hero />
      <main className="relative flex min-w-0 flex-1 flex-col bg-linear-to-br from-slate-50 via-white to-brand-50/60 px-5 py-8 sm:px-10">
        {/* Soft tint behind the form on small screens, where the hero is hidden */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-linear-to-b from-brand-50/70 to-transparent lg:hidden" aria-hidden />
        <div className="relative flex min-w-0 flex-1 items-center justify-center">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="relative mt-8 text-center text-xs text-slate-500">© {new Date().getFullYear()} FreightTask · Every freight task. One platform.</p>
      </main>
    </div>
  );
}

/** Navy welcome panel with a live-shipment preview; hidden below lg, where the form stands alone */
function Hero() {
  return (
    <section className="relative hidden w-[52%] max-w-[54rem] overflow-hidden bg-navy-900 text-white lg:flex lg:flex-col">
      {/* Background: soft brand and gold glows and a dot pattern that fades towards the edges */}
      <div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-brand-600/35 blur-3xl" aria-hidden />
      <div className="absolute -right-32 -bottom-40 size-[28rem] rounded-full bg-brand-400/20 blur-3xl" aria-hidden />
      <div className="absolute right-24 bottom-24 size-48 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />
      <div
        className="absolute inset-0 opacity-[0.18] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
        style={{ backgroundImage: "radial-gradient(rgb(255 255 255 / 0.55) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        aria-hidden
      />

      <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
        <Image src="/brand/logo-light.png" alt="FreightTask" width={1394} height={345} priority className="login-rise h-11 w-auto self-start" />

        <div className="max-w-xl">
          <span className="login-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-100 backdrop-blur [animation-delay:60ms]">
            <span className="size-1.5 rounded-full bg-gold-400 shadow-[0_0_8px_2px_rgb(229_177_74/0.6)]" aria-hidden />
            Air &amp; sea freight forwarding platform
          </span>
          <h1 className="login-rise mt-5 text-4xl leading-[1.1] font-semibold tracking-tight [animation-delay:120ms] xl:text-[3.25rem]">
            Every shipment,
            <br />
            one clear <span className="bg-linear-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">workflow.</span>
          </h1>
          <p className="login-rise mt-4 max-w-md text-base leading-relaxed text-brand-100/90 [animation-delay:180ms]">
            Enquiries, quotations, bookings, airway bills and billing, from the first rate request to the final invoice.
          </p>

          <ShipmentPreview />

          <ul className="login-rise mt-6 flex flex-wrap gap-2 [animation-delay:300ms]">
            {FEATURES.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-brand-50 backdrop-blur">
                <Icon size={14} className="text-gold-300" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="login-rise text-xs font-medium tracking-[0.25em] text-brand-200/80 uppercase [animation-delay:360ms]">Every freight task. One platform.</p>
      </div>
    </section>
  );
}

/** Glass card with a generic sample booking (place A to place B): route line with a plane gliding along it */
function ShipmentPreview() {
  return (
    <div className="login-rise mt-8 max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/20 backdrop-blur-md [animation-delay:240ms]" aria-hidden>
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-brand-100">JOB-0001</span>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 font-medium text-emerald-300">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          In transit
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div>
          <div className="text-xl font-semibold">A</div>
          <div className="text-xs text-brand-200">Origin</div>
        </div>
        <div className="relative h-8 flex-1 [container-type:inline-size]">
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/25" />
          <div className="absolute top-1/2 left-0 h-px w-full origin-left bg-linear-to-r from-brand-400 to-gold-400 [animation:route-fill_3.2s_cubic-bezier(0.65,0,0.35,1)_infinite]" />
          <span className="absolute top-1/2 left-0 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white text-navy-800 shadow-lg [animation:route-fly_3.2s_cubic-bezier(0.65,0,0.35,1)_infinite]">
            <Plane size={14} className="rotate-45" />
          </span>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold">B</div>
          <div className="text-xs text-brand-200">Destination</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-xs">
        {[
          ["Weight", "210 kg"],
          ["Pieces", "12"],
          ["ETA", "2 days"],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-brand-200/80">{k}</div>
            <div className="mt-0.5 font-medium text-white">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  // Bumped on every failed attempt so the error shakes again
  const [errorKey, setErrorKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // Only follow same-site paths from ?next=
  const next = params.get("next");
  const target = next && /^\/(?![/\\])/.test(next) && !next.includes("\\") ? next : "/";

  // Already signed in (or just signed in): go on to the app
  useEffect(() => {
    if (user) router.replace(target);
  }, [user, target, router]);

  const fail = (message: string) => {
    setError(message);
    setErrorKey((k) => k + 1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice("");
    if (!email.trim() || !password) return fail("Enter your email address and password.");
    if (!login(email, password, remember)) return fail("Incorrect email or password. Use the demo account below.");
    // The redirect above takes over; keep the button in its working state until the app opens
    setSigningIn(true);
  };

  const fillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setError("");
  };

  const inputCls = (bad: boolean) =>
    cn(
      "h-11 w-full rounded-xl border bg-white pr-3 pl-10 text-sm text-slate-900 shadow-xs transition-colors outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100",
      bad ? "border-red-300" : "border-slate-300 hover:border-slate-400",
    );

  return (
    <div className="w-full max-w-md min-w-0">
      <Image src="/brand/logo.png" alt="FreightTask" width={1394} height={345} priority className="login-rise mb-8 h-10 w-auto lg:hidden" />
      {/* Card with an animated gradient border (see .gradient-border in globals.css) */}
      <div className="gradient-border login-card rounded-2xl p-6 shadow-xl shadow-navy-900/[0.07] sm:p-8">
        <h2 className="login-rise text-3xl font-semibold tracking-tight text-slate-900 [animation-delay:60ms]">Welcome back</h2>
        <p className="login-rise mt-2 text-sm text-slate-500 [animation-delay:100ms]">Sign in to your FreightTask account to continue.</p>

        <form onSubmit={submit} noValidate className="login-rise mt-8 space-y-4 [animation-delay:140ms]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Email address</span>
            <span className="relative block">
              <Mail size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
                className={inputCls(!!error)}
              />
            </span>
          </label>

          {/* Not a <label> wrapper: it holds buttons, and a label points at the first control inside it */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                onClick={() => setNotice("Password resets aren't available in the demo. Use the demo account below.")}
                className="rounded-sm text-sm font-medium text-brand-600 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Forgot password?
              </button>
            </div>
            <span className="relative block">
              <Lock size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
                className={cn(inputCls(!!error), "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-500"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </div>

          {error && (
            <p key={errorKey} role="alert" className="login-shake flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
              {notice}
            </p>
          )}

          <label className="flex w-fit items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 rounded accent-brand-600" />
            Keep me signed in
          </label>

          <button
            type="submit"
            disabled={signingIn}
            className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-navy-800 to-brand-700 text-sm font-semibold text-white shadow-lg shadow-brand-700/25 transition-all hover:shadow-xl hover:shadow-brand-700/30 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.99] disabled:cursor-wait disabled:brightness-100"
          >
            {signingIn ? (
              <>
                <Spinner size="xs" tone="light" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </>
            )}
          </button>
        </form>

        <div className="login-rise mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 [animation-delay:200ms]">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold-50 text-gold-600 ring-1 ring-gold-200">
            <KeyRound size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-semibold text-slate-800">Demo account</div>
            <div className="truncate font-mono text-slate-500">{DEMO_CREDENTIALS.email}</div>
            <div className="font-mono text-slate-500">{DEMO_CREDENTIALS.password}</div>
          </div>
          <button
            type="button"
            onClick={fillDemo}
            className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-700 shadow-xs ring-1 ring-slate-200 ring-inset hover:bg-brand-50 hover:ring-brand-200 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            Fill in
          </button>
        </div>

        <p className="login-rise mt-8 text-center text-sm text-slate-500 [animation-delay:240ms]">
          Don&apos;t have an account?{" "}
          <a href="mailto:support@freighttask.com" className="rounded-sm font-medium text-brand-600 hover:text-brand-800 hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}
