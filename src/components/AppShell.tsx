"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  FileText,
  Inbox,
  LayoutDashboard,
  Mail,
  Menu,
  Plane,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Settings,
  Ship,
  Users,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LinkButton } from "./ui";

type NavGroup = { title?: string; items: { href: string; label: string; icon: LucideIcon; badge?: number }[] };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, actions } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = state.inbox.filter((m) => !m.read).length;

  // Close the mobile menu after navigating
  useEffect(() => setMenuOpen(false), [pathname]);

  // Menu structure follows the FRD: Dashboard, Mail Box, Jobs, Masters, Settings
  const groups: NavGroup[] = [
    {
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/mailbox", label: "Mail Box", icon: Inbox, badge: unread },
        { href: "/notifications", label: "Client Notifications", icon: Bell },
      ],
    },
    {
      title: "Jobs",
      items: [
        { href: "/enquiries", label: "Enquiries", icon: Search },
        { href: "/quotations", label: "Quotations", icon: FileText },
        { href: "/shipments", label: "Shipments", icon: Ship },
      ],
    },
    {
      title: "Masters",
      items: [
        { href: "/masters/customers", label: "Customers", icon: Building2 },
        { href: "/masters/agents", label: "Agents", icon: Users },
        { href: "/masters/airlines", label: "Airlines", icon: Plane },
        { href: "/masters/rates", label: "Airline Rates", icon: Scale },
        { href: "/masters/email-logs", label: "Email Logs", icon: Mail },
      ],
    },
    { title: "Settings", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid size-8 place-items-center rounded-lg bg-white/10">
          <Plane size={17} className="text-white" aria-hidden />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Airsteam FF</div>
          <div className="text-[11px] text-brand-300">Freight Forwarding</div>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 pb-3">
        {groups.map((g, i) => (
          <div key={i}>
            {g.title && <div className="mb-1 px-3 text-[10px] font-semibold tracking-wider text-brand-300 uppercase">{g.title}</div>}
            <ul className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon, badge }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-white",
                      isActive(href) ? "bg-white/15 font-medium text-white" : "text-brand-100 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon size={16} aria-hidden />
                    <span className="flex-1">{label}</span>
                    {!!badge && (
                      <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-brand-900" aria-label={`${badge} unread`}>
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
        className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-brand-300 hover:bg-white/5 hover:text-white"
      >
        <RotateCcw size={14} aria-hidden /> Reset demo data
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a href="#main" className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium text-brand-800 shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>

      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-brand-900 md:flex">{sidebar}</aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-brand-900">
            <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-3 rounded-md p-1.5 text-brand-100 hover:bg-white/10" aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setMenuOpen(true)} className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-slate-900 md:hidden">Airsteam FF</span>
          <div className="flex-1" />
          <div className="hidden items-center gap-2 sm:flex">
            <div className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800" aria-hidden>
              AD
            </div>
            <div className="text-xs leading-tight">
              <div className="font-medium text-slate-900">Admin User</div>
              <div className="text-slate-500">Operations</div>
            </div>
          </div>
          <LinkButton href="/enquiries/new" size="sm">
            <Plus size={14} aria-hidden /> Add Enquiry
          </LinkButton>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
