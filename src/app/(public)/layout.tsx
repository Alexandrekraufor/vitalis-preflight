import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function PublicDocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas transition-colors relative z-0 overflow-hidden">
      {/* Nebula subtle background lights for public pages */}
      <div className="pointer-events-none fixed top-0 left-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/5 dark:bg-brand/10 blur-[100px] -z-10" />
      
      <header className="sticky top-0 z-10 border-b border-border-subtle bg-surface/80 backdrop-blur-md transition-colors">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
              <Activity className="size-5" />
            </div>
            <span className="font-bold tracking-tight text-ink">Vitalis</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">{children}</main>
      <footer className="border-t border-border-subtle bg-surface py-12">
        <div className="mx-auto max-w-4xl px-6 text-center text-sm text-ink-muted">
          © {new Date().getFullYear()} Clínica Vitalis. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
