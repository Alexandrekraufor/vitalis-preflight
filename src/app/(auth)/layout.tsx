import type { ReactNode } from "react";
import { Activity } from "lucide-react";
import Link from "next/link";

/**
 * Shell for the unauthenticated screens. 
 * Redesigned for a premium, high-impact clinical presentation.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      {/* Left panel - Visual/Brand */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-[#061824] via-[#04334f] to-[#01141f] p-12 text-white lg:flex relative overflow-hidden">
        
        {/* Decorative background blur elements */}
        <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-brand opacity-40 blur-[100px]"></div>
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-accent opacity-20 blur-[100px]"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 shadow-premium backdrop-blur-md border border-white/20">
              <Activity className="size-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Vitalis Preflight</span>
          </div>
        </div>
        
        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white mb-6">
            Validação preventiva e inteligente de guias médicas.
          </h1>
          <p className="text-lg text-slate-300">
            Antecipe glosas e garanta a saúde financeira da sua clínica aplicando regras complexas de faturamento em segundos.
          </p>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          © {new Date().getFullYear()} Clínica Vitalis. Todos os direitos reservados.
        </div>
      </div>

      {/* Right panel - Form content */}
      <div className="flex flex-1 flex-col justify-center bg-canvas px-6 py-12 sm:px-12 relative">
        <main className="mx-auto w-full max-w-[380px]">{children}</main>
        <footer className="absolute bottom-6 left-0 right-0 text-center text-xs text-ink-muted">
          <div className="flex justify-center gap-4">
            <Link href="/termos" className="hover:text-ink transition-colors hover:underline">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-ink transition-colors hover:underline">Privacidade</Link>
            <Link href="/lgpd" className="hover:text-ink transition-colors hover:underline">Política LGPD</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
