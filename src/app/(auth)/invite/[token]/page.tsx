import Link from "next/link";

import { previewInvitation } from "@/application/access/accept-invitation.use-case";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { invitationRejectionMessage } from "@/domain/access/invitation";
import { MIN_PASSWORD_LENGTH } from "@/domain/access/password-policy";
import { sessionTokens } from "@/infrastructure/auth/session";
import { appServices } from "@/infrastructure/composition-root";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Convite",
  // An invitation URL is a single-use credential; it must never be indexed.
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const services = await appServices();
  const preview = await previewInvitation(token, services.access, sessionTokens);

  if (!preview.ok) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-7 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Convite indisponível</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {invitationRejectionMessage(preview.error)}
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-10 items-center rounded-md border border-border-subtle px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-7 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <h1 className="text-lg font-semibold tracking-tight text-ink">
        Você foi convidado para a equipe Vitalis
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Crie seu acesso para <strong className="font-medium text-ink">{preview.value.email}</strong>.
        Este endereço já está definido pelo convite e não pode ser alterado aqui.
      </p>

      <div className="mt-6">
        <AcceptInviteForm token={token} minPasswordLength={MIN_PASSWORD_LENGTH} />
      </div>
    </div>
  );
}
