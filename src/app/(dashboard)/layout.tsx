import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

export const dynamic = "force-dynamic";

/**
 * Shell for every authenticated screen.
 *
 * The guard here keeps an anonymous visitor from seeing the chrome at all —
 * but it is deliberately not the only check. Layouts are not re-run on every
 * navigation, so each page inside repeats `requireUser` for itself, and every
 * action and endpoint authorizes independently of both.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const services = await appServices();
  const user = await requireUser(services.access);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 px-5 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-[76rem] flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
