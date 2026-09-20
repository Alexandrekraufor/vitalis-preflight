"use client";

import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/actions/session";
import { userRoleLabel, type AuthenticatedUser } from "@/domain/access/access.types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Identity and sign-out at the foot of the navigation.
 *
 * Sign-out is a form posting to a Server Action, not a link: it changes state,
 * and Next's Server Actions carry the origin check that makes a cross-site
 * POST to it fail.
 */
export function AccountMenu({ user }: { readonly user: AuthenticatedUser }) {
  return (
    <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2.5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white"
        >
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-xs text-ink-muted">{user.email}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="rounded border border-border-subtle px-1.5 py-0.5 text-[0.6875rem] font-medium text-ink-muted">
          {userRoleLabel(user.role)}
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-ink-muted transition-colors hover:bg-black/10 dark:hover:bg-white/10 hover:text-ink"
          >
            <LogOut aria-hidden className="size-3.5" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
