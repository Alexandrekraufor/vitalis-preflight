import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

export const dynamic = "force-dynamic";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const services = await appServices();

  if ((await getCurrentUser(services.access)) !== null) redirect("/");

  const next = (await searchParams)["next"];
  const target = typeof next === "string" && next.startsWith("/") ? next : "/";

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-7 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Vitalis Preflight</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Validação preventiva de guias</p>
      </div>

      <LoginForm next={target} />

      <p className="mt-6 border-t border-border-subtle pt-4 text-xs leading-relaxed text-ink-muted">
        O acesso é restrito à equipe da clínica. Recebeu um convite? Use o link que foi
        enviado para o seu e-mail.
      </p>
    </div>
  );
}
