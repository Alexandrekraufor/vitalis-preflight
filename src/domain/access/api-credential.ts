/**
 * Credentials that let a machine talk to this deployment.
 *
 * A credential is never stored: only its digest is, exactly like a session or
 * an invitation token. The clinic sees the secret once, at the moment it is
 * issued, and after that the system can verify it but not reproduce it.
 */
export const API_SURFACES = ["REST", "MCP"] as const;

export type ApiSurface = (typeof API_SURFACES)[number];

const SURFACE_LABELS: Readonly<Record<ApiSurface, string>> = {
  REST: "API REST",
  MCP: "Servidor MCP",
};

export function apiSurfaceLabel(surface: ApiSurface): string {
  return SURFACE_LABELS[surface];
}

/**
 * What a credential is allowed to do.
 *
 * Reading and writing are different powers: a system that only pulls reports
 * should not be able to inject guides, and a key that ingests does not need to
 * be able to read the whole portfolio back.
 */
export const API_SCOPES = ["READ", "WRITE"] as const;

export type ApiScope = (typeof API_SCOPES)[number];

const SCOPE_LABELS: Readonly<Record<ApiScope, string>> = {
  READ: "Leitura",
  WRITE: "Escrita",
};

export function apiScopeLabel(scope: ApiScope): string {
  return SCOPE_LABELS[scope];
}

export function allowsScope(scopes: readonly ApiScope[], required: ApiScope): boolean {
  return scopes.includes(required);
}

export interface ApiCredential {
  readonly id: string;
  /** What this key is for, written by whoever issued it. */
  readonly name: string;
  readonly surface: ApiSurface;
  readonly scopes: readonly ApiScope[];
  /**
   * The first characters of the secret, kept in the clear so a reader can tell
   * two keys apart without the key itself.
   */
  readonly hint: string;
  readonly createdAt: Date;
  readonly createdByName: string | null;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

export function isRevoked(credential: ApiCredential): boolean {
  return credential.revokedAt !== null;
}

/** How much of a freshly generated secret is safe to keep for display. */
export const CREDENTIAL_HINT_LENGTH = 6;

export function credentialHint(token: string): string {
  return token.slice(0, CREDENTIAL_HINT_LENGTH);
}
