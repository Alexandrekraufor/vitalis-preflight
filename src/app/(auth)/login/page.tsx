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
    <div className="rounded-2xl border border-border-subtle/50 bg-surface p-8 shadow-premium sm:p-10">
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-ink">Acesse sua conta</h2>
        <p className="mt-2 text-sm text-ink-muted">Insira suas credenciais da clínica para continuar.</p>
      </div>

      <LoginForm next={target} />

      <div className="mt-8 rounded-lg bg-accent-soft p-4 text-center lg:text-left">
        <p className="text-xs leading-relaxed text-accent">
          <strong className="font-semibold">Acesso restrito.</strong> O uso deste sistema é exclusivo para a equipe autorizada. Recebeu um convite? Utilize o link que foi enviado para o seu e-mail.
        </p>
      </div>
    </div>
  );
}
