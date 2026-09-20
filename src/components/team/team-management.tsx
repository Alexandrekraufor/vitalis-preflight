"use client";

import { useActionState } from "react";

import {
  inviteMemberAction,
  revokeInvitationAction,
  setMemberRoleAction,
  setMemberStatusAction,
} from "@/app/(dashboard)/configuracoes/equipe/actions";
import {
  INITIAL_TEAM_STATE,
  type TeamActionState,
} from "@/app/(dashboard)/configuracoes/equipe/team-state";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  invitationStatusLabel,
  userRoleLabel,
  userStatusLabel,
  USER_ROLES,
  type Invitation,
  type TeamMember,
} from "@/domain/access/access.types";

const INPUT_CLASS =
  "h-10 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent";

function formatDate(value: Date | null): string {
  return value === null
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        value,
      );
}

interface TeamManagementProps {
  readonly members: readonly TeamMember[];
  readonly invitations: readonly Invitation[];
  readonly currentUserId: string;
}

/**
 * The team screen.
 *
 * Everything here is a form posting to a Server Action, and every one of those
 * actions re-checks the administrator role on the server. Hiding a button is a
 * courtesy to the person using the app, never the control: a member who forges
 * the same request is refused by the action, not by the absence of a button.
 */
export function TeamManagement({
  members,
  invitations,
  currentUserId,
}: TeamManagementProps) {
  const [inviteState, invite] = useActionState(inviteMemberAction, INITIAL_TEAM_STATE);
  const pending = invitations.filter((invitation) => invitation.status === "PENDING");

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Convidar membro"
          description="O acesso é sempre por convite. Não existe cadastro aberto."
        />
        <CardBody>
          <form action={invite} className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <Field label="E-mail" htmlFor="invite-email">
                <input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                  placeholder="pessoa@clinicavitalis.com.br"
                  className={INPUT_CLASS}
                />
              </Field>
            </div>

            <div className="w-48">
              <Field label="Nível de acesso" htmlFor="invite-role">
                <select id="invite-role" name="role" defaultValue="MEMBER" className={INPUT_CLASS}>
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {userRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <SubmitButton pendingLabel="Enviando…">Enviar convite</SubmitButton>
          </form>

          <ActionFeedback state={inviteState} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`Membros (${members.length})`}
          description="Quem tem acesso ao Vitalis Preflight hoje."
        />
        <DataTable>
          <TableHead
            columns={["Nome", "E-mail", "Nível", "Situação", "Último acesso", "Ações"]}
          />
          <tbody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.name}
                  {member.id === currentUserId && (
                    <span className="ml-2 text-xs text-ink-muted">(você)</span>
                  )}
                </TableCell>
                <TableCell className="text-ink-muted">{member.email}</TableCell>
                <TableCell>{userRoleLabel(member.role)}</TableCell>
                <TableCell>
                  <span
                    className={
                      member.status === "ACTIVE"
                        ? "inline-flex items-center rounded-full border border-ready/20 bg-ready-soft px-2 py-0.5 text-xs font-medium text-ready"
                        : "inline-flex items-center rounded-full border border-border-subtle bg-canvas px-2 py-0.5 text-xs font-medium text-ink-muted"
                    }
                  >
                    {userStatusLabel(member.status)}
                  </span>
                </TableCell>
                <TableCell className="numeric text-ink-muted">
                  {formatDate(member.lastLoginAt)}
                </TableCell>
                <TableCell>
                  {member.id === currentUserId ? (
                    <span className="text-xs text-ink-muted">—</span>
                  ) : (
                    <MemberActions member={member} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title={`Convites pendentes (${pending.length})`}
          description="Cada convite vale uma única vez e expira automaticamente."
        />
        {pending.length === 0 ? (
          <EmptyState
            title="Nenhum convite pendente"
            description="Convites aceitos, revogados ou expirados saem desta lista."
          />
        ) : (
          <DataTable>
            <TableHead columns={["E-mail", "Nível", "Enviado em", "Expira em", "Situação", ""]} />
            <tbody>
              {pending.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>{userRoleLabel(invitation.role)}</TableCell>
                  <TableCell className="numeric text-ink-muted">
                    {formatDate(invitation.createdAt)}
                  </TableCell>
                  <TableCell className="numeric text-ink-muted">
                    {formatDate(invitation.expiresAt)}
                  </TableCell>
                  <TableCell>{invitationStatusLabel(invitation.status)}</TableCell>
                  <TableCell>
                    <RevokeInvitation invitationId={invitation.id} email={invitation.email} />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}

function ActionFeedback({ state }: { readonly state: TeamActionState }) {
  if (state.error === null && state.notice === null) return null;

  return (
    <div className="mt-4" aria-live="polite">
      {state.error !== null && (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      {state.notice !== null && (
        <p className="rounded-md border border-ready/20 bg-ready-soft px-3 py-2 text-sm text-ready">
          {state.notice}
        </p>
      )}

      {state.inviteUrl !== null && (
        <div className="mt-2 rounded-md border border-border-subtle bg-canvas px-3 py-2">
          <p className="text-xs text-ink-muted">
            Nenhum provedor de e-mail configurado neste ambiente. Copie o link e entregue à
            pessoa convidada:
          </p>
          <code className="mt-1 block break-all font-mono text-xs text-ink">
            {state.inviteUrl}
          </code>
        </div>
      )}
    </div>
  );
}

function MemberActions({ member }: { readonly member: TeamMember }) {
  const [, changeRole] = useActionState(setMemberRoleAction, INITIAL_TEAM_STATE);
  const [, changeStatus] = useActionState(setMemberStatusAction, INITIAL_TEAM_STATE);

  const nextRole = member.role === "ADMIN" ? "MEMBER" : "ADMIN";
  const disabling = member.status === "ACTIVE";

  return (
    <div className="flex flex-wrap gap-2">
      <form action={changeRole}>
        <input type="hidden" name="userId" value={member.id} />
        <input type="hidden" name="role" value={nextRole} />
        <SubmitButton
          variant="secondary"
          pendingLabel="Alterando…"
          className="h-8 px-2.5 text-xs"
        >
          Tornar {userRoleLabel(nextRole).toLowerCase()}
        </SubmitButton>
      </form>

      <form
        action={changeStatus}
        onSubmit={(event) => {
          if (
            disabling &&
            !window.confirm(
              `Desativar ${member.name}? A pessoa perde o acesso imediatamente, em todos os dispositivos.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="userId" value={member.id} />
        <input type="hidden" name="disable" value={String(disabling)} />
        <SubmitButton
          variant={disabling ? "danger" : "secondary"}
          pendingLabel="Aplicando…"
          className="h-8 px-2.5 text-xs"
        >
          {disabling ? "Desativar" : "Reativar"}
        </SubmitButton>
      </form>
    </div>
  );
}

function RevokeInvitation({
  invitationId,
  email,
}: {
  readonly invitationId: string;
  readonly email: string;
}) {
  const [, revoke] = useActionState(revokeInvitationAction, INITIAL_TEAM_STATE);

  return (
    <form
      action={revoke}
      onSubmit={(event) => {
        if (!window.confirm(`Revogar o convite de ${email}? O link deixa de funcionar.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="invitationId" value={invitationId} />
      <SubmitButton variant="danger" pendingLabel="Revogando…" className="h-8 px-2.5 text-xs">
        Revogar
      </SubmitButton>
    </form>
  );
}
