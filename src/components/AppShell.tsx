"use client";

import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookUser,
  Building2,
  CalendarRange,
  ChevronDown,
  Coins,
  FilePen,
  FileMinus,
  FileSpreadsheet,
  FileStack,
  FileText,
  Globe2,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  Plane,
  Plus,
  ReceiptText,
  RotateCcw,
  Send,
  Settings,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth, type User } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PageLoader, Spinner } from "./ui";
import { PageTransition } from "./PageTransition";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};
type NavGroup = { title: string; items: NavItem[] };

/**
 * While a clicked menu link's page is opening: a light sweep across the link and, in the sidebar,
 * a small spinner. Absolutely positioned, so the link never changes size. Must sit inside the <Link>.
 */
function LinkPending({ spinner }: { spinner?: boolean }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span className="link-pending pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden />
      {spinner && <Spinner size="xs" tone="light" className="absolute top-1/2 right-2.5 -translate-y-1/2" />}
    </>
  );
}

/** Every page except /login needs a signed-in user; the login page renders without the shell */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (user === null && !isLogin)
      router.replace(
        pathname === "/"
          ? "/login"
          : `/login?next=${encodeURIComponent(pathname)}`,
      );
  }, [user, isLogin, pathname, router]);

  if (isLogin) return children;
  if (!user) {
    return <PageLoader fullScreen label="Checking your sign-in…" />;
  }
  return (
    <Suspense>
      <Shell user={user}>{children}</Shell>
    </Suspense>
  );
}

const NEW_ENQUIRY = "/enquiries/new";

// Header tabs: top-level sections. `match` lists the other paths that belong to a section.
const TABS = [
  { href: "/reservations", label: "Reserved Shipments", match: [] },
  {
    href: "/enquiries",
    label: "Jobs",
    match: ["/quotations", "/shipments", "/rate-requests", "/follow-ups"],
  },
  { href: "/awbs", label: "Airway Bills", match: [] },
  { href: "/documents", label: "Documents", match: [] },
  { href: "/invoices", label: "Customer Invoice", match: [] },
  { href: "/billing", label: "Billing", match: [] },
  { href: "/masters", label: "Masters", match: [] },
  { href: "/reports", label: "Reports", match: [] },
];

const within = (pathname: string, href: string) =>
  href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);

function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, actions } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = state.inbox.filter((m) => !m.read).length;

  // List pages are one level deep (/enquiries, /awbs); forms and detail pages are deeper
  const showFab = pathname.split("/").filter(Boolean).length <= 1;

  // Close the mobile menu after navigating
  useEffect(() => setMenuOpen(false), [pathname]);

  // The left-hand menu, as laid out in the FRD (LHM)
  const groups: NavGroup[] = [
    {
      title: "",
      items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      title: "Mail Box",
      items: [
        {
          href: "/mailbox?folder=Inbox",
          label: "Inbox",
          icon: Inbox,
          badge: unread,
        },
        {
          href: "/mailbox?folder=Drafts",
          label: "Draft",
          icon: FilePen,
          badge: state.drafts.length,
        },
        { href: "/mailbox?folder=Sent", label: "Sent", icon: Send },
      ],
    },
    {
      title: "Transactions",
      items: [
        {
          href: "/reservations",
          label: "Reserved Shipments",
          icon: CalendarRange,
        },
        { href: "/enquiries", label: "Jobs", icon: Package },
        { href: "/awbs", label: "Airway Bills", icon: Plane },
        { href: "/documents", label: "Documents", icon: FileStack },
        { href: "/invoices", label: "Customer Invoice", icon: FileSpreadsheet },
      ],
    },
    {
      title: "Finance / Billing",
      items: [
        { href: "/billing", label: "Debit Note", icon: ReceiptText },
        {
          href: "/billing/credit-notes",
          label: "Credit Note",
          icon: FileMinus,
        },
        {
          href: "/billing/charges",
          label: "Agency Service Charges",
          icon: Coins,
        },
      ],
    },
    {
      title: "Master Data",
      items: [
        {
          href: "/masters/stakeholders",
          label: "Stakeholders",
          icon: BookUser,
        },
        {
          href: "/masters/geography",
          label: "Geographical Data",
          icon: Globe2,
        },
        { href: "/masters/airlines", label: "Airline & Rates", icon: Plane },
      ],
    },
    {
      title: "Settings",
      items: [
        { href: "/settings/company", label: "Company Set up", icon: Building2 },
        { href: "/settings/users", label: "User Management", icon: UsersRound },
        { href: "/settings", label: "Settings", icon: SlidersHorizontal },
      ],
    },
    {
      title: "Logs",
      items: [
        { href: "/notifications", label: "Client Notifications", icon: Bell },
        { href: "/masters/email-logs", label: "Email Logs", icon: Mail },
        { href: "/reports", label: "Reports", icon: FileText },
      ],
    },
  ];

  // Menu links can carry a query (Mail Box folders); the Jobs link also covers its other tabs
  const search = useSearchParams();
  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (query)
      return (
        pathname === path &&
        (search.get("folder") ?? "Inbox") ===
          new URLSearchParams(query).get("folder")
      );
    if (path === "/enquiries")
      return [
        "/enquiries",
        "/quotations",
        "/shipments",
        "/rate-requests",
        "/follow-ups",
      ].some((h) => within(pathname, h));
    // /settings and /billing have their own sub-pages in the menu
    if (path === "/settings" || path === "/billing")
      return (
        pathname === path ||
        (path === "/billing" &&
          /^\/billing\/(?!credit-notes|charges)/.test(pathname))
      );
    return within(pathname, path);
  };
  const isTabActive = (t: (typeof TABS)[number]) =>
    [t.href, ...t.match].some((h) => within(pathname, h));

  const sidebarNav = (
    <>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2.5 py-2.5">
        {groups.map((g, i) => (
          <div
            key={g.title}
            className={cn(i > 0 && "mt-2 border-t border-white/10 pt-2")}
          >
            {g.title && (
              <div className="mb-1 px-2.5 text-[0.75rem] font-semibold tracking-wide text-brand-200 uppercase">
                {g.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon, badge }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[0.875rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white",
                      isActive(href)
                        ? "bg-white/15 font-medium text-white"
                        : "text-brand-100 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon size={16} aria-hidden />
                    <span className="flex-1">{label}</span>
                    {!!badge && (
                      <span
                        className="rounded-full bg-gold-500 px-1.5 text-xs font-semibold text-navy-900"
                        aria-label={`${badge} unread`}
                      >
                        {badge}
                      </span>
                    )}
                    <LinkPending spinner />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <button
        onClick={() =>
          window.confirm(
            "Reset all data back to the demo data? Your changes will be lost.",
          ) && actions.reset()
        }
        className="m-2.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-brand-200 hover:bg-white/10 hover:text-white"
      >
        <RotateCcw size={14} aria-hidden /> Reset demo data
      </button>
    </>
  );

  const iconBtn =
    "relative rounded-md p-2 text-brand-100 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium text-brand-800 shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar: full height, logo on white above the navigation */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-navy-900 xl:flex">
        <Link
          href="/"
          className="flex h-14 shrink-0 items-center border-b border-white/10 px-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
          aria-label="FreightTask home"
        >
          <Image
            src="/brand/logo-light.png"
            alt="FreightTask"
            width={1394}
            height={345}
            priority
            className="h-8 w-auto"
          />
        </Link>
        {sidebarNav}
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-navy-900">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3">
              <Image
                src="/brand/logo-light.png"
                alt="FreightTask"
                width={1394}
                height={345}
                className="h-8 w-auto"
              />
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-md p-1.5 text-brand-100 hover:bg-white/10"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            {/* The header tabs are hidden on small screens, so list the sections here too */}
            <nav
              aria-label="Sections"
              className="border-b border-white/10 px-3 py-3"
            >
              <ul className="grid grid-cols-2 gap-1">
                {TABS.map((t) => (
                  <li key={t.href}>
                    <Link
                      href={t.href}
                      aria-current={isTabActive(t) ? "page" : undefined}
                      className={cn(
                        "relative block rounded-md px-3 py-1.5 text-[0.875rem]",
                        isTabActive(t)
                          ? "bg-white/15 text-white"
                          : "text-brand-100 hover:bg-white/40 hover:text-white",
                      )}
                    >
                      {t.label}
                      <LinkPending />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {sidebarNav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-stretch gap-2 bg-navy-900 pr-2 pl-3 shadow-sm sm:pr-3 xl:pl-0">
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-white xl:hidden"
            aria-label="FreightTask home"
          >
            <Image
              src="/brand/logo-light.png"
              alt="FreightTask"
              width={1394}
              height={345}
              priority
              className="h-8 w-auto"
            />
          </Link>

          <nav aria-label="Sections" className="hidden min-w-0 flex-1 xl:block">
            <ul className="flex h-full items-stretch overflow-x-auto [scrollbar-width:none]">
              {TABS.map((t) => (
                <li key={t.href} className="flex">
                  <Link
                    href={t.href}
                    aria-current={isTabActive(t) ? "page" : undefined}
                    className={cn(
                      "relative flex items-center px-3 text-[0.875rem] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
                      isTabActive(t)
                        ? "bg-white/10 text-white"
                        : "text-brand-100 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {t.label}
                    <LinkPending />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex-1 xl:hidden" />

          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/notifications"
              className={iconBtn}
              aria-label="Client Notifications"
            >
              <Bell size={18} aria-hidden />
            </Link>
            <Link
              href="/mailbox"
              className={cn(iconBtn, "hidden sm:block")}
              aria-label={unread ? `Mail Box, ${unread} unread` : "Mail Box"}
            >
              <Inbox size={18} aria-hidden />
              {!!unread && (
                <span
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-gold-500 ring-2 ring-navy-900"
                  aria-hidden
                />
              )}
            </Link>
            <UserMenu user={user} />
            <button
              onClick={() => setMenuOpen(true)}
              className={cn(iconBtn, "xl:hidden")}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        <main
          id="main"
          className={cn(
            "mx-auto w-full max-w-7xl min-w-0 flex-1 px-3 pt-3 sm:px-4 xl:pb-4 2xl:max-w-[110rem] 2xl:px-6",
            showFab ? "pb-24" : "pb-6",
          )}
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Phone and tablet shortcut to the most common action, on list pages only so it never covers a form */}
      {showFab && (
        <Link
          href={NEW_ENQUIRY}
          aria-label="New Enquiry"
          className="no-print fixed right-5 bottom-5 z-20 grid size-14 place-items-center rounded-full bg-navy-900 text-white shadow-lg ring-4 ring-white hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 xl:hidden"
        >
          <Plus size={24} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function UserMenu({ user }: { user: User }) {
  const { logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemCls =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 text-left hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
      >
        <span
          className="grid size-8 place-items-center rounded-full bg-white text-xs font-semibold text-navy-800"
          aria-hidden
        >
          {user.initials}
        </span>
        <span className="hidden text-sm font-medium whitespace-nowrap text-white xl:block">
          {user.name}
        </span>
        <ChevronDown
          size={14}
          className="hidden text-brand-200 sm:block"
          aria-hidden
        />
        <span className="sr-only">Account menu for {user.name}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-3 py-2 text-xs">
            <div className="font-medium text-slate-900">{user.name}</div>
            <div className="truncate text-slate-500">
              {user.role} · {user.email}
            </div>
          </div>
          <Link href="/settings" role="menuitem" className={itemCls}>
            <Settings size={14} aria-hidden /> Settings
          </Link>
          <button role="menuitem" onClick={logout} className={itemCls}>
            <LogOut size={14} aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
