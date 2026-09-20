import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

export const dynamic = "force-dynamic";

/**
 * Shell for every authenticated screen.
 *
 * The guard here keeps an anonymous visitor from seeing the chrome at all -
 * but it is deliberately not the only check. Layouts are not re-run on every
 * navigation, so each page inside repeats `requireUser` for itself, and every
 * action and endpoint authorizes independently of both.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const services = await appServices();
  const user = await requireUser(services.access);

  return (
    <div className="relative z-0 flex h-dvh w-full flex-col overflow-hidden bg-canvas md:flex-row">
      {/* Ambient lights, kept faint so they never compete with the data. */}
      <div className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-brand/5 blur-[100px] -z-10 dark:bg-brand/10" />
      <div className="pointer-events-none fixed -bottom-28 -right-28 h-96 w-96 rounded-full bg-accent/5 blur-[100px] -z-10 dark:bg-accent/10" />

      <Sidebar user={user} />

      {/* The scroll container: the header inside it pins to this box, not the
          viewport, so it stays put beside a sidebar that never scrolls. */}
      <main className="z-10 min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
