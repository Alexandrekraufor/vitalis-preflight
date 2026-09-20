"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { AuthenticatedUser } from "@/domain/access/access.types";

import {
  DashboardAnimatedIcon,
  GenericAnimatedIcon,
  PlugAnimatedIcon,
  UsersAnimatedIcon,
} from "../ui/animated-icons";
import { AccountMenu } from "./account-menu";

type NavIcon =
  | "rules"
  | "dashboard"
  | "guides"
  | "import"
  | "report"
  | "integrations"
  | "account"
  | "team"
  | "keys";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly iconType: NavIcon;
  readonly adminOnly?: true;
}

const OPERATION: readonly NavItem[] = [
  { href: "/", label: "Visão geral", iconType: "dashboard" },
  { href: "/guias", label: "Guias", iconType: "guides" },
  { href: "/importar", label: "Importar", iconType: "import" },
  { href: "/relatorio/terca", label: "Relatório executivo", iconType: "report" },
];

const SETTINGS: readonly NavItem[] = [
  { href: "/configuracoes/conta", label: "Minha conta", iconType: "account" },
  { href: "/configuracoes/equipe", label: "Equipe", iconType: "team", adminOnly: true },
  { href: "/configuracoes/regras", label: "Regras dos convênios", iconType: "rules", adminOnly: true },
  { href: "/integracoes", label: "Integrações", iconType: "integrations" },
  { href: "/configuracoes/chaves", label: "Chaves de API", iconType: "keys", adminOnly: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavIconFor({ type, active }: { readonly type: NavIcon; readonly active: boolean }) {
  switch (type) {
    case "dashboard":
      return <DashboardAnimatedIcon active={active} />;
    case "integrations":
      return <PlugAnimatedIcon active={active} />;
    case "team":
      return <UsersAnimatedIcon active={active} />;
    case "guides":
      return (
        <GenericAnimatedIcon active={active}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="m9 15 2 2 4-4" />
        </GenericAnimatedIcon>
      );
    case "import":
      return (
        <GenericAnimatedIcon active={active}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </GenericAnimatedIcon>
      );
    case "report":
      return (
        <GenericAnimatedIcon active={active}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </GenericAnimatedIcon>
      );
    case "rules":
      return (
        <GenericAnimatedIcon active={active}>
          <path d="M12 3 4 7v6c0 4.4 3.4 7.6 8 8 4.6-.4 8-3.6 8-8V7l-8-4z" />
          <path d="m9 12 2 2 4-4" />
        </GenericAnimatedIcon>
      );
    case "keys":
      return (
        <GenericAnimatedIcon active={active}>
          <path d="m15.5 7.5 3 3L22 7l-3-3" />
          <path d="m21 2-9.6 9.6" />
          <circle cx="7.5" cy="15.5" r="5.5" />
        </GenericAnimatedIcon>
      );
    case "account":
      return (
        <GenericAnimatedIcon active={active}>
          <circle cx="12" cy="8" r="5" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </GenericAnimatedIcon>
      );
  }
}

/**
 * One navigation row.
 *
 * Both themes describe the same three states through sidebar tokens, so the
 * active item reads as selected whether the panel is white or near-black -
 * never white text on a white background.
 */
function NavLink({ item, pathname }: { readonly item: NavItem; readonly pathname: string }) {
  const active = isActive(pathname, item.href);
  const [hovered, setHovered] = useState(false);

  return (
    <li onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-sidebar-active font-semibold text-brand"
            : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink"
        }`}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
          />
        )}
        <NavIconFor type={item.iconType} active={active || hovered} />
        {item.label}
      </Link>
    </li>
  );
}

export function Sidebar({ user }: { readonly user: AuthenticatedUser }) {
  const pathname = usePathname();
  const settings = SETTINGS.filter(
    (item) => item.adminOnly !== true || user.role === "ADMIN",
  );

  return (
    <nav
      aria-label="Navegação principal"
      className="flex shrink-0 flex-col gap-1 border-b border-border-subtle bg-sidebar px-3 py-4 transition-colors md:sticky md:top-0 md:h-dvh md:w-64 md:border-b-0 md:border-r"
    >
      <div className="flex items-center gap-2.5 px-2 pb-6 pt-1">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
          <ShieldCheck aria-hidden className="size-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold tracking-tight text-sidebar-ink">
            Vitalis Preflight
          </span>
          <span className="block truncate text-[0.6875rem] font-medium uppercase tracking-wider text-sidebar-muted">
            Validação preventiva
          </span>
        </span>
      </div>

      <ul className="flex flex-wrap gap-1 md:flex-col">
        {OPERATION.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>

      {settings.length > 0 && (
        <>
          <p className="mt-6 px-3 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-faint">
            Configurações
          </p>
          <ul className="flex flex-wrap gap-1 md:flex-col">
            {settings.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto border-t border-border-subtle pt-3">
        <AccountMenu user={user} />
      </div>
    </nav>
  );
}
