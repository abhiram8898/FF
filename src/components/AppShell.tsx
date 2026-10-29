"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
  Coins,
  FileSpreadsheet,
  FileStack,
  FileText,
  Inbox,
  List,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Package,
  Plane,
  Plus,
  RotateCcw,
  Scale,
  Send,
  Settings,
  SquarePlus,
  Users,
  X,
} from "lucide-react";
import { useAuth, type User } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };
type NavGroup = { title: string; items: NavItem[] };

/** Every page except /login needs a signed-in user; the login page renders without the shell */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (user === null && !isLogin) router.replace(pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`);
  }, [user, isLogin, pathname, router]);

  if (isLogin) return children;
  if (!user) {
    return (
      <div className="grid h-screen place-items-center" role="status">
        <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-label="Loading" />
      </div>
    );
  }
  return <Shell user={user}>{children}</Shell>;
}

const NEW_ENQUIRY = "/enquiries/new";

// Header tabs: top-level sections. `match` lists the other paths that belong to a section.
const TABS = [
  { href: "/", label: "Dashboard", match: [] },
  { href: "/enquiries", label: "Enquiries", match: ["/rate-requests", "/follow-ups"] },
  { href: "/quotations", label: "Quotations", match: [] },
  { href: "/shipments", label: "Booking/Job", match: [] },
  { href: "/invoices", label: "Invoices", match: [] },
  { href: "/documents", label: "Documentation", match: [] },
  { href: "/masters", label: "Masters", match: [] },
  { href: "/reports", label: "Reports", match: [] },
];

const within = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, actions } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = state.inbox.filter((m) => !m.read).length;

  // Close the mobile menu after navigating
  useEffect(() => setMenuOpen(false), [pathname]);

  const groups: NavGroup[] = [
    {
      title: "Transactions",
      items: [
        { href: NEW_ENQUIRY, label: "New Enquiry", icon: SquarePlus },
        { href: "/enquiries", label: "Enquiry List", icon: List },
        { href: "/rate-requests", label: "Rate Requests", icon: Send },
        { href: "/masters/rates", label: "Rate Management", icon: Scale },
        { href: "/quotations", label: "Quotations", icon: FileText },
        { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
        { href: "/shipments", label: "Booking/Job", icon: Package },
        { href: "/invoices", label: "Customer Invoices", icon: FileSpreadsheet },
        { href: "/documents", label: "AWB / Documents", icon: FileStack },
      ],
    },
    {
      title: "Master Data",
      items: [
        { href: "/masters/customers", label: "Customers", icon: Building2 },
        { href: "/masters/airlines", label: "Carriers", icon: Plane },
        { href: "/masters/agents", label: "Agents", icon: Users },
        { href: "/masters/locations", label: "Locations", icon: MapPin },
        { href: "/masters/charges", label: "Charges", icon: Coins },
      ],
    },
    {
      title: "Communication",
      items: [
        { href: "/mailbox", label: "Mail Box", icon: Inbox, badge: unread },
        { href: "/notifications", label: "Client Notifications", icon: Bell },
        { href: "/masters/email-logs", label: "Email Logs", icon: Mail },
      ],
    },
  ];

  // New Enquiry sits under /enquiries, so Enquiry List must not light up with it
  const isActive = (href: string) => (pathname === NEW_ENQUIRY ? href === NEW_ENQUIRY : within(pathname, href));
  const isTabActive = (t: (typeof TABS)[number]) => [t.href, ...t.match].some((h) => within(pathname, h));

  const sidebarNav = (
    <>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3">
        {groups.map((g, i) => (
          <div key={g.title} className={cn(i > 0 && "mt-3 border-t border-white/10 pt-3")}>
            <div className="mb-2 px-3 text-xs font-semibold text-brand-200">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon, badge }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white",
                      isActive(href) ? "bg-white/15 font-medium text-white" : "text-brand-100 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon size={16} aria-hidden />
                    <span className="flex-1">{label}</span>
                    {!!badge && (
                      <span className="rounded-full bg-gold-500 px-1.5 text-[11px] font-semibold text-navy-900" aria-label={`${badge} unread`}>
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <button
        onClick={() => window.confirm("Reset all data back to the demo data? Your changes will be lost.") && actions.reset()}
        className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-brand-200 hover:bg-white/10 hover:text-white"
      >
        <RotateCcw size={14} aria-hidden /> Reset demo data
      </button>
    </>
  );

  const iconBtn = "relative rounded-md p-2 text-brand-100 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a href="#main" className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium text-brand-800 shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>

      {/* Desktop sidebar: full height, logo on white above the navigation */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-navy-900 xl:flex">
        <Link href="/" className="flex h-16 shrink-0 items-center border-b border-white/10 px-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white" aria-label="FreightTask home">
          <Image src="/brand/logo-light.png" alt="FreightTask" width={1394} height={345} priority className="h-9 w-auto" />
        </Link>
        {sidebarNav}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-navy-900">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-3">
              <Image src="/brand/logo-light.png" alt="FreightTask" width={1394} height={345} className="h-8 w-auto" />
              <button onClick={() => setMenuOpen(false)} className="rounded-md p-1.5 text-brand-100 hover:bg-white/10" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            {/* The header tabs are hidden on small screens, so list the sections here too */}
            <nav aria-label="Sections" className="border-b border-white/10 px-3 py-3">
              <ul className="grid grid-cols-2 gap-1">
                {TABS.map((t) => (
                  <li key={t.href}>
                    <Link
                      href={t.href}
                      aria-current={isTabActive(t) ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-[13px]",
                        isTabActive(t) ? "bg-white/15 font-medium text-white" : "text-brand-100 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {t.label}
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
        <header className="no-print sticky top-0 z-30 flex h-16 items-stretch gap-2 bg-navy-900 shadow-sm ">
          <Link href="/" className="flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-white xl:hidden" aria-label="FreightTask home">
            <Image src="/brand/logo-light.png" alt="FreightTask" width={1394} height={345} priority className="h-8 w-auto" />
          </Link>

          <nav aria-label="Sections" className="hidden min-w-0 flex-1 xl:block">
            <ul className="flex h-full items-stretch overflow-x-auto [scrollbar-width:none]">
              {TABS.map((t) => (
                <li key={t.href} className="flex">
                  <Link
                    href={t.href}
                    aria-current={isTabActive(t) ? "page" : undefined}
                    className={cn(
                      "flex items-center border-b-2 px-3 pt-0.5 text-[13px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white 2xl:px-3",
                      isTabActive(t) ? "border-white bg-white/10 font-medium text-white" : "border-transparent text-brand-100 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex-1 xl:hidden" />

          <div className="flex shrink-0 items-center gap-1">
            <Link href="/notifications" className={iconBtn} aria-label="Client Notifications">
              <Bell size={18} aria-hidden />
            </Link>
            <Link href="/mailbox" className={cn(iconBtn, "hidden sm:block")} aria-label={unread ? `Mail Box, ${unread} unread` : "Mail Box"}>
              <Inbox size={18} aria-hidden />
              {!!unread && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-gold-500 ring-2 ring-navy-900" aria-hidden />}
            </Link>
            <UserMenu user={user} />
            <button onClick={() => setMenuOpen(true)} className={cn(iconBtn, "-mr-1 xl:hidden")} aria-label="Open menu">
              <Menu size={20} />
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-3 pt-3 pb-24 sm:px-3 xl:pb-3">
          {children}
        </main>
      </div>

      {/* Phone shortcut to the most common action */}
      {pathname !== NEW_ENQUIRY && (
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
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemCls = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 text-left hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
      >
        <span className="grid size-8 place-items-center rounded-full bg-white text-xs font-semibold text-navy-800" aria-hidden>
          {user.initials}
        </span>
        <span className="hidden text-[13px] font-medium whitespace-nowrap text-white xl:block">{user.name}</span>
        <ChevronDown size={14} className="hidden text-brand-200 sm:block" aria-hidden />
        <span className="sr-only">Account menu for {user.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
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
