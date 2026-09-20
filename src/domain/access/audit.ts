/**
 * Actions worth keeping a record of. The list is closed so that adding an
 * auditable action is a deliberate decision, visible in a diff.
 */
export const AUDIT_ACTIONS = [
  "USER_LOGIN_SUCCEEDED",
  "USER_LOGIN_FAILED",
  "USER_LOGGED_OUT",
  "USER_DISABLED",
  "USER_REACTIVATED",
  "USER_ROLE_CHANGED",
  "INVITATION_CREATED",
  "INVITATION_REVOKED",
  "INVITATION_ACCEPTED",
  "GUIDES_IMPORTED",
  "GUIDE_VALIDATION_REQUESTED",
  "API_CREDENTIAL_ISSUED",
  "API_CREDENTIAL_REVOKED",
  "MCP_ACCESS_GRANTED",
  "MCP_ACCESS_REVOKED",
  "RULE_DRAFT_SAVED",
  "RULE_SET_PUBLISHED",
  "GUIDES_REVALIDATED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** How the actor reached the system. */
export const ACTOR_KINDS = ["SESSION", "API_KEY", "MCP", "SYSTEM"] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];

export interface AuditEntry {
  readonly action: AuditAction;
  readonly actorKind: ActorKind;
  readonly actorUserId: string | null;
  readonly subject: string | null;
  /**
   * Identifiers and outcomes only. Never a token, a password, a session value
   * or an authorization header - see `docs/security.md`.
   */
  readonly metadata: Record<string, string | number | boolean> | null;
}

export interface AuditRecord extends AuditEntry {
  readonly id: string;
  readonly actorName: string | null;
  readonly createdAt: Date;
}

const LABELS: Readonly<Record<AuditAction, string>> = {
  USER_LOGIN_SUCCEEDED: "Login realizado",
  USER_LOGIN_FAILED: "Tentativa de login falhou",
  USER_LOGGED_OUT: "Logout",
  USER_DISABLED: "Membro desativado",
  USER_REACTIVATED: "Membro reativado",
  USER_ROLE_CHANGED: "Permissão alterada",
  INVITATION_CREATED: "Convite enviado",
  INVITATION_REVOKED: "Convite revogado",
  INVITATION_ACCEPTED: "Convite aceito",
  GUIDES_IMPORTED: "Importação executada",
  GUIDE_VALIDATION_REQUESTED: "Validação solicitada",
  API_CREDENTIAL_ISSUED: "Chave de API criada",
  API_CREDENTIAL_REVOKED: "Chave de API revogada",
  MCP_ACCESS_GRANTED: "Acesso MCP autorizado",
  MCP_ACCESS_REVOKED: "Acesso MCP revogado",
  RULE_DRAFT_SAVED: "Rascunho de regras salvo",
  RULE_SET_PUBLISHED: "Regras publicadas",
  GUIDES_REVALIDATED: "Guias reavaliadas",
};

export function auditActionLabel(action: AuditAction): string {
  return LABELS[action];
}
