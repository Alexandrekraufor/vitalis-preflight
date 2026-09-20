"use client";

import {
  FileCheck2,
  LayoutDashboard,
  Plug,
  TrendingUp,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AuthenticatedUser } from "@/domain/access/access.types";

import { AccountMenu } from "./account-menu";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly adminOnly?: true;
}

const OPERATION: readonly NavItem[] = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/guias", label: "Guias", icon: FileCheck2 },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/relatorio/terca", label: "Relatório executivo", icon: TrendingUp },
  { href: "/integracoes", label: "Integrações", icon: Plug },
];

const SETTINGS: readonly NavItem[] = [
  { href: "/configuracoes/equipe", label: "Equipe", icon: Users, adminOnly: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({ item, pathname }: { readonly item: NavItem; readonly pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
          active
            ? "bg-white/10 font-medium text-white"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        {item.label}
      </Link>
    </li>
  );
}

/**
 * The application shell's navigation.
 *
 * A Client Component only because it needs the current path to mark the active
 * item. `adminOnly` decides what is *shown*; the screens and actions behind
 * these links each enforce their own permission on the server.
 */
export function Sidebar({ user }: { readonly user: AuthenticatedUser }) {
  const pathname = usePathname();
  const settings = SETTINGS.filter(
    (item) => item.adminOnly !== true || user.role === "ADMIN",
  );

  return (
    <nav
      aria-label="Navegação principal"
      className="flex shrink-0 flex-col gap-1 bg-[#0B1F2A] px-3 py-4 md:h-dvh md:w-60 md:sticky md:top-0"
    >
      <div className="px-2.5 pb-5">
        <p className="text-sm font-semibold tracking-tight text-white">Vitalis Preflight</p>
        <p className="mt-0.5 text-xs text-slate-400">Validação preventiva de guias</p>
      </div>

      <ul className="flex flex-wrap gap-1 md:flex-col">
        {OPERATION.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>

      {settings.length > 0 && (
        <>
          <p className="mt-5 px-2.5 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
            Configurações
          </p>
          <ul className="flex flex-wrap gap-1 md:flex-col">
            {settings.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto pt-5">
        <AccountMenu user={user} />
      </div>
    </nav>
  );
}
