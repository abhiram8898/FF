"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  BellRing,
  CalendarPlus,
  CalendarRange,
  ClipboardList,
  Combine,
  Copy,
  ExternalLink,
  Eye,
  FileStack,
  FileText,
  Inbox,
  Mail,
  MailOpen,
  MoreHorizontal,
  Package,
  PackagePlus,
  Pencil,
  Power,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
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
    size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm sm:h-8",
    variant === "primary" && "bg-navy-900 text-white shadow-sm hover:bg-navy-700 dark:bg-brand-500 dark:hover:bg-brand-400",
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
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName ?? "p-3"}>{children}</div>
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
    <div className="mb-3">
      {back && (
        <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft size={13} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg leading-7 font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm leading-5 text-slate-500">{subtitle}</p>}
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
  "h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 text-sm sm:h-8 text-slate-900 shadow-xs outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputCls, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, "h-auto py-2", className)} {...props} />;
}

const SPINNER_SIZES = { xs: "size-3.5 border-2", sm: "size-4 border-2", md: "size-6 border-2", lg: "size-9 border-[3px]" };
const SPINNER_TONES = { brand: "border-slate-200 border-t-brand-600", light: "border-white/25 border-t-white" };

/** Spinning ring for anything that is loading or working; `light` for dark backgrounds */
export function Spinner({ size = "md", tone = "brand", className }: { size?: keyof typeof SPINNER_SIZES; tone?: keyof typeof SPINNER_TONES; className?: string }) {
  return <span className={cn("inline-block shrink-0 animate-spin rounded-full", SPINNER_SIZES[size], SPINNER_TONES[tone], className)} aria-hidden />;
}

/** Centred spinner with a message; `fullScreen` for app start-up, otherwise it fills the page area */
export function PageLoader({ label = "Loading…", fullScreen }: { label?: string; fullScreen?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={cn("grid place-items-center", fullScreen ? "h-screen bg-slate-50" : "min-h-[50vh]")}>
      <div className="loader-in flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <span className="text-sm text-slate-500">{label}</span>
      </div>
    </div>
  );
}

/** Full-page message for "not found" and error screens: icon, code, title, explanation and buttons */
export function StatusPage({
  icon: Icon,
  tone = "brand",
  code,
  title,
  children,
  actions,
  className,
}: {
  icon: LucideIcon;
  tone?: "brand" | "red";
  className?: string;
  code?: string;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className={cn("grid min-h-[60vh] place-items-center px-3 py-10", className)}>
      <div className="status-in flex max-w-md flex-col items-center text-center">
        <span className={cn("grid size-14 place-items-center rounded-full ring-8", tone === "red" ? "bg-red-50 text-red-600 ring-red-50/50" : "bg-brand-50 text-brand-600 ring-brand-50/50")}>
          <Icon size={26} aria-hidden />
        </span>
        {code && <p className="mt-4 text-xs font-semibold tracking-widest text-slate-400 uppercase">{code}</p>}
        <h1 className={cn("text-xl font-semibold text-slate-900", code ? "mt-1" : "mt-4")}>{title}</h1>
        <div className="mt-2 text-sm text-slate-500">{children}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
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
  confirmClose,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** When set (e.g. the form has unsaved changes), closing by overlay click, Escape or × asks this question first */
  confirmClose?: string | false;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestClose = () => {
    if (!confirmClose || window.confirm(confirmClose)) onClose();
  };
  const onCloseRef = useRef(requestClose);
  useEffect(() => {
    onCloseRef.current = requestClose;
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
    <div className="modal-overlay fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-navy-900/55 p-3 sm:p-3" onMouseDown={requestClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn("modal-panel my-auto w-full rounded-xl bg-white shadow-2xl outline-none", wide ? "max-w-4xl 2xl:max-w-5xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="no-print flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={requestClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="modal-body p-3">{children}</div>
        {footer && <footer className="no-print flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">{footer}</footer>}
      </div>
    </div>
  );
}

/** Warns before the tab is closed or reloaded while a form has unsaved changes */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

/** Question asked before throwing away unsaved changes */
export const DISCARD_CHANGES = "Discard your unsaved changes?";

export function Empty({ children, action, icon: Icon = Inbox }: { children: React.ReactNode; action?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">
      <Icon size={20} className="text-slate-400" aria-hidden />
      <div>{children}</div>
      {action}
    </div>
  );
}

/**
 * Copies each column heading into its cells' data-label, so phones can show the table as labelled cards.
 * Labels come from the last header row; body rowSpan isn't followed, so stack={false} for such tables.
 */
function labelCells(table: HTMLTableElement) {
  const headRows = table.tHead?.rows;
  const heads: string[] = [];
  for (const th of headRows?.[headRows.length - 1]?.cells ?? []) for (let i = 0; i < th.colSpan; i++) heads.push(th.textContent?.trim() ?? "");
  for (const body of table.tBodies)
    for (const tr of body.rows) {
      let col = 0;
      for (const cell of tr.cells) {
        // A cell spanning the whole row (empty state, notes) gets no label
        const label = cell.colSpan >= heads.length && heads.length > 1 ? "" : (heads[col] ?? "");
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        col += cell.colSpan;
      }
    }
}

/**
 * Data table. Scrolls sideways when it doesn't fit; on phones each row becomes a labelled card
 * (see .table-stack in globals.css). Pass stack={false} to keep the scrolling table on phones.
 */
export function Table({ children, stack = true }: { children: React.ReactNode; stack?: boolean }) {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const table = ref.current;
    if (!table || !stack) return;
    labelCells(table);
    // Rows come and go with filters and sorting; label new cells as they appear
    const observer = new MutationObserver(() => labelCells(table));
    observer.observe(table, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [stack]);
  return (
    // `relative` keeps absolutely positioned children (e.g. sr-only labels) inside the scroll area
    <div className="relative overflow-x-auto">
      <table ref={ref} className={cn(stack && "table-stack", "w-full text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-slate-100 [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-slate-500 [&_thead]:bg-slate-50")}>
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
        compact ? "gap-x-3 gap-y-1.5 text-xs" : "gap-x-4 gap-y-2.5 text-sm",
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
    <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto border-b border-slate-200 md:flex-wrap md:overflow-visible">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "-mb-px border-b-2 px-3 py-1.5 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-500",
            value === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/** Tabs that are separate routes, e.g. Jobs → Enquiries | Quotations | Job/Booking */
export function LinkTabs({ tabs, label }: { tabs: { href: string; label: string; count?: number }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-3 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-500",
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Coloured status pill for any status list that has a tone map */
export function ToneBadge({ status, tones }: { status: string; tones: Record<string, string> }) {
  return <Badge className={tones[status]}>{status}</Badge>;
}

/** Yes / No switch */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50",
        checked ? "bg-brand-600" : "bg-slate-300",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-[#fff] shadow transition-transform", checked ? "translate-x-4.5" : "translate-x-0.5")} />
    </button>
  );
}

/** Section heading inside a form card */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{children}</h3>;
}

const KPI_TONES = {
  blue: "bg-brand-50 text-brand-600",
  indigo: "bg-indigo-50 text-indigo-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
};

/**
 * Stat card: tinted icon, figure and label. With `href` the whole card links through;
 * with `onClick` it is a toggle button (`active` marks the selected card).
 */
export function Kpi({
  icon: Icon,
  tone = "blue",
  value,
  label,
  hint,
  href,
  onClick,
  active,
}: {
  icon: LucideIcon;
  tone?: keyof typeof KPI_TONES;
  value: React.ReactNode;
  label: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", KPI_TONES[tone])}>
        <Icon size={17} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg leading-6 font-semibold text-slate-900 tabular-nums">{value}</span>
        <span className="block text-xs leading-snug text-slate-500">{label}</span>
        {hint && <span className="block text-xs leading-snug text-slate-400">{hint}</span>}
      </span>
    </>
  );
  const cls = "flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs";
  const interactive = "transition-colors hover:border-brand-200 hover:bg-brand-50/40 focus-visible:outline-2 focus-visible:outline-brand-500";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={!!active} className={cn(cls, interactive, "text-left", active && "border-brand-500 bg-brand-50 ring-1 ring-brand-500 hover:border-brand-500")}>
        {body}
      </button>
    );
  }
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-brand-200 hover:bg-brand-50/40 focus-visible:outline-2 focus-visible:outline-brand-500")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const KPI_COLS = {
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
};

export function KpiGrid({ cols = 3, children }: { cols?: keyof typeof KPI_COLS; children: React.ReactNode }) {
  return <div className={cn("stagger-in mb-3 grid gap-3", KPI_COLS[cols])}>{children}</div>;
}

/** A KPI card that filters the page's list. Without `test` the card means "everything" and clears the filter. */
export type KpiDef<T> = Omit<React.ComponentProps<typeof Kpi>, "href" | "onClick" | "active" | "value"> & {
  id: string;
  test?: (row: T) => boolean;
  /** Shown instead of the row count, e.g. a total value */
  value?: React.ReactNode;
};

/** KPI cards that filter the list on the same page instead of linking elsewhere */
export function KpiFilters<T>({
  rows,
  kpis,
  active,
  onChange,
  cols,
}: {
  rows: T[];
  kpis: KpiDef<T>[];
  active: string | null;
  onChange: (id: string | null) => void;
  cols?: keyof typeof KPI_COLS;
}) {
  return (
    <KpiGrid cols={cols}>
      {kpis.map(({ id, test, value, ...card }) => (
        <Kpi
          key={id}
          {...card}
          value={value ?? (test ? rows.filter(test).length : rows.length)}
          active={!!test && active === id}
          onClick={() => onChange(!test || active === id ? null : id)}
        />
      ))}
    </KpiGrid>
  );
}

/** The selected KPI card's test (everything passes when none is selected) */
export const kpiTest = <T,>(kpis: KpiDef<T>[], active: string | null): ((row: T) => boolean) => kpis.find((k) => k.id === active)?.test ?? (() => true);

/** Row of list filters: a search box, dropdowns and a reset button */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div role="search" className="mb-3 flex flex-wrap gap-2">
      {children}
    </div>
  );
}

export function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-56 flex-[2_1_16rem]">
      <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input placeholder={placeholder ?? `${label}…`} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="pl-8" />
    </div>
  );
}

export function FilterSelect({ label, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <Select aria-label={label} className={cn("flex-[1_1_9rem]", className)} {...props} />;
}

export function ResetFilters({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button variant="secondary" onClick={onClick} aria-label="Reset filters" title="Reset filters" className="w-9 px-0 sm:w-8" disabled={disabled}>
      <RefreshCw size={16} aria-hidden />
    </Button>
  );
}

/** Empty state for a filtered list, with a way back to everything */
export function NoResults({ filtered, onClear, children }: { filtered: boolean; onClear: () => void; children: React.ReactNode }) {
  return (
    <div className="p-3">
      <Empty
        action={
          filtered && (
            <button className={cn(linkCls, "text-sm")} onClick={onClear}>
              Clear filters
            </button>
          )
        }
      >
        {filtered ? "Nothing matches these filters." : children}
      </Empty>
    </div>
  );
}

/** Amber "fog" message used for soft warnings that keep the user on the screen */
export function Fog({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="rounded p-0.5 text-amber-700 hover:text-amber-900" aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export type RowAction = {
  label: string;
  href?: string;
  onSelect?: () => void;
  /** Defaults from the label (see ACTION_STYLES) */
  icon?: LucideIcon;
  /** Defaults from the label; delete / cancel are red */
  tone?: ActionTone;
};

/** One colour per kind of action, so the same action looks the same in every table */
const ACTION_TONES = {
  view: "bg-sky-50 text-sky-600 ring-sky-200 hover:bg-sky-100 hover:text-sky-700",
  edit: "bg-amber-50 text-amber-600 ring-amber-200 hover:bg-amber-100 hover:text-amber-700",
  copy: "bg-violet-50 text-violet-600 ring-violet-200 hover:bg-violet-100 hover:text-violet-700",
  convert: "bg-emerald-50 text-emerald-600 ring-emerald-200 hover:bg-emerald-100 hover:text-emerald-700",
  link: "bg-indigo-50 text-indigo-600 ring-indigo-200 hover:bg-indigo-100 hover:text-indigo-700",
  status: "bg-teal-50 text-teal-600 ring-teal-200 hover:bg-teal-100 hover:text-teal-700",
  act: "bg-orange-50 text-orange-600 ring-orange-200 hover:bg-orange-100 hover:text-orange-700",
  docs: "bg-cyan-50 text-cyan-600 ring-cyan-200 hover:bg-cyan-100 hover:text-cyan-700",
  neutral: "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100 hover:text-slate-800",
  danger: "bg-red-50 text-red-600 ring-red-200 hover:bg-red-100 hover:text-red-700",
};
type ActionTone = keyof typeof ACTION_TONES;

/** Icon and colour for each row action, matched on the label (first match wins, so specific labels come first) */
const ACTION_STYLES: [RegExp, LucideIcon, ActionTone][] = [
  [/^edit/i, Pencil, "edit"],
  [/convert to reservation/i, CalendarPlus, "convert"],
  [/convert to job/i, PackagePlus, "convert"],
  [/enquiry/i, ClipboardList, "link"],
  [/quotation/i, FileText, "link"],
  [/reservation/i, CalendarRange, "link"],
  [/\b(job|booking)\b(?! portal)/i, Package, "link"],
  [/manage documents/i, FileStack, "docs"],
  [/upload/i, Upload, "docs"],
  [/merge/i, Combine, "docs"],
  [/dispatch/i, Send, "docs"],
  [/booking portal/i, ExternalLink, "neutral"],
  [/^email|mail desk/i, Mail, "neutral"],
  [/read email/i, MailOpen, "view"],
  [/status/i, ArrowRightLeft, "status"],
  [/reminder/i, BellRing, "status"],
  [/make (in)?active/i, Power, "neutral"],
  [/take action/i, Zap, "act"],
  [/duplicate/i, Copy, "copy"],
  [/delete/i, Trash2, "danger"],
  [/cancel/i, Ban, "danger"],
  [/edit/i, Pencil, "edit"],
  [/view|open|read/i, Eye, "view"],
];

const actionStyle = (label: string) => ACTION_STYLES.find(([re]) => re.test(label)) ?? [/./, MoreHorizontal, "neutral" as ActionTone];

/**
 * Row actions for tables, shown as coloured icon buttons (first column). Hovering or focusing
 * an icon shows its name in a label above it; the label is `fixed` so the table's scroll area
 * doesn't clip it.
 */
export function RowActions({ label, items }: { label: string; items: RowAction[] }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [tip]);
  const show = (text: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Under the icon when there's no room above (top of the screen)
    const below = r.top < 40;
    setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below });
  };
  const hide = () => setTip(null);

  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {items.map((it) => {
        const [, defaultIcon, defaultTone] = actionStyle(it.label);
        const Icon = it.icon ?? defaultIcon;
        const cls = cn(
          "grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
          ACTION_TONES[it.tone ?? defaultTone],
        );
        const props = { "aria-label": it.label, className: cls, onMouseEnter: show(it.label), onMouseLeave: hide, onFocus: show(it.label), onBlur: hide };
        const icon = <Icon size={16} aria-hidden />;
        if (it.href && /^(mailto:|https?:)/.test(it.href)) {
          return (
            <a key={it.label} href={it.href} {...props}>
              {icon}
            </a>
          );
        }
        return it.href ? (
          <Link key={it.label} href={it.href} {...props}>
            {icon}
          </Link>
        ) : (
          <button
            key={it.label}
            type="button"
            {...props}
            onClick={() => {
              hide();
              it.onSelect?.();
            }}
          >
            {icon}
          </button>
        );
      })}
      {tip && (
        <span
          role="tooltip"
          style={{ left: tip.x, top: tip.y }}
          className={cn(
            "tooltip-in pointer-events-none fixed z-50 -translate-x-1/2 rounded-md bg-navy-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg",
            !tip.below && "-translate-y-full",
          )}
        >
          {tip.text}
          <span className={cn("absolute left-1/2 size-2 -translate-x-1/2 rotate-45 bg-navy-900", tip.below ? "-top-1" : "-bottom-1")} aria-hidden />
        </span>
      )}
    </div>
  );
}
