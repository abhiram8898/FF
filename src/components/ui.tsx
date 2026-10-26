"use client";

import Link from "next/link";
import { ArrowLeft, Inbox, MoreVertical, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EnquiryStatus, QuotationStatus } from "@/lib/types";
import { STATUS_TONE, cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export const buttonCls = (variant: Variant, size: Size, className?: string) =>
  cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm",
    variant === "primary" && "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
    variant === "secondary" && "bg-white text-slate-700 shadow-xs ring-1 ring-slate-300 ring-inset hover:bg-slate-50",
    variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    variant === "danger" && "bg-white text-red-600 ring-1 ring-red-200 ring-inset hover:bg-red-50",
    className,
  );

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonCls(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonCls(variant, size, className)} {...props} />;
}

/** Text-style link used for row actions and inline navigation */
export const linkCls = "font-medium text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 rounded-sm";

export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-slate-200 bg-white shadow-xs", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName ?? "p-4"}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft size={13} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputCls, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, "h-auto py-2", className)} {...props} />;
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        className ?? "bg-slate-100 text-slate-700 ring-slate-200",
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: EnquiryStatus | QuotationStatus }) {
  return <Badge className={STATUS_TONE[status]}>{status}</Badge>;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    // Focus the first field in the body, falling back to the dialog itself
    (dialog?.querySelector<HTMLElement>(`.modal-body :is(${FOCUSABLE})`) ?? dialog)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab" || !dialog) return;
      // Keep Tab focus inside the dialog
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-8" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn("my-auto w-full rounded-xl bg-white shadow-2xl outline-none", wide ? "max-w-4xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="no-print flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="modal-body p-5">{children}</div>
        {footer && <footer className="no-print flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Empty({ children, action, icon: Icon = Inbox }: { children: React.ReactNode; action?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
      <Icon size={22} className="text-slate-400" aria-hidden />
      <div>{children}</div>
      {action}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    // `relative` keeps absolutely positioned children (e.g. sr-only labels) inside the scroll area
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-slate-100 [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-slate-500 [&_thead]:bg-slate-50">
        {children}
      </table>
    </div>
  );
}

/** Label / value grid used for read-only details */
export function KeyValue({ items, cols = 3, compact }: { items: [string, React.ReactNode][]; cols?: 2 | 3 | 4; compact?: boolean }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2",
        cols >= 3 && "sm:grid-cols-3",
        cols === 4 && "xl:grid-cols-4",
        compact ? "gap-x-4 gap-y-2 text-xs" : "gap-x-4 gap-y-3 text-sm",
      )}
    >
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className={cn("mt-0.5 font-medium break-words text-slate-900", compact && "font-semibold")}>{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 md:flex-wrap md:overflow-visible">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-500",
            value === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 truncate text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/** Amber "fog" message used for soft warnings that keep the user on the screen */
export function Fog({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="rounded p-0.5 text-amber-700 hover:text-amber-900" aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

type MenuItem = { label: string; href?: string; onSelect?: () => void };

/**
 * Row "⋮" menu for tables. Positioned with `fixed` so it isn't clipped by the
 * table's horizontal scroll container.
 */
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) return close();
    const r = buttonRef.current!.getBoundingClientRect();
    const height = items.length * 36 + 8;
    const top = r.bottom + height + 8 > window.innerHeight ? r.top - height - 4 : r.bottom + 4;
    setPos({ top, left: Math.max(8, r.right - 176) });
  };
  const itemCls = "block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none";

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        aria-label={label}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <MoreVertical size={16} aria-hidden />
      </button>
      {pos && (
        <div ref={menuRef} role="menu" style={pos} className="fixed z-40 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((it) =>
            it.href ? (
              <Link key={it.label} href={it.href} role="menuitem" className={itemCls} onClick={close}>
                {it.label}
              </Link>
            ) : (
              <button
                key={it.label}
                role="menuitem"
                className={itemCls}
                onClick={() => {
                  close();
                  it.onSelect?.();
                }}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </>
  );
}
