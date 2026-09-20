import type { ReactNode } from "react";

/**
 * Shell for the unauthenticated screens. No navigation, nothing to explore —
 * a visitor who is not signed in has exactly one thing to do here.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-12">
      <main className="w-full max-w-sm">{children}</main>
      <footer className="mt-8 text-xs text-ink-muted">
        Clínica Vitalis · Validação preventiva de guias
      </footer>
    </div>
  );
}
