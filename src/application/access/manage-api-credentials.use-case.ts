import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import {
  credentialHint,
  type ApiCredential,
  type ApiScope,
  type ApiSurface,
} from "@/domain/access/api-credential";
import { err, ok, type Result } from "@/lib/result";

/**
 * Issuing and revoking the credentials that machines authenticate with.
 *
 * Only an administrator may hold this power: a credential is a key to the
 * clinic's data that outlives any session and carries no person's name once it
 * is in a script. Every issue and revoke is audited.
 */
export interface IssueApiCredentialInput {
  readonly name: string;
  readonly surface: ApiSurface;
  readonly scopes: readonly ApiScope[];
}

export interface IssuedApiCredential {
  readonly credential: ApiCredential;
  /**
   * The secret in the clear. It exists in this object and nowhere else: the
   * caller shows it once and the system keeps only the digest.
   */
  readonly token: string;
}

export type ApiCredentialFailure =
  | "FORBIDDEN"
  | "INVALID_NAME"
  | "NO_SCOPE"
  | "NOT_FOUND";

const MAX_NAME_LENGTH = 60;

export interface CredentialTokenFactory {
  readonly generate: () => string;
  readonly hash: (token: string) => string;
}

export function listApiCredentials(
  actor: AuthenticatedUser,
  access: AccessRepository,
): Promise<readonly ApiCredential[]> {
  return actor.role === "ADMIN" ? access.listApiCredentials() : Promise.resolve([]);
}

export async function issueApiCredential(
  input: IssueApiCredentialInput,
  actor: AuthenticatedUser,
  access: AccessRepository,
  tokens: CredentialTokenFactory,
): Promise<Result<IssuedApiCredential, ApiCredentialFailure>> {
  if (actor.role !== "ADMIN") return err("FORBIDDEN");

  const name = input.name.trim();
  if (name === "" || name.length > MAX_NAME_LENGTH) return err("INVALID_NAME");
  if (input.scopes.length === 0) return err("NO_SCOPE");

  const token = tokens.generate();
  const hint = credentialHint(token);

  const id = await access.createApiCredential({
    name,
    surface: input.surface,
    scopes: input.scopes,
    tokenHash: tokens.hash(token),
    hint,
    createdBy: actor.id,
  });

  await access.recordAuditEvent({
    action: "API_CREDENTIAL_ISSUED",
    actorKind: "SESSION",
    actorUserId: actor.id,
    subject: id,
    // The name and surface are identifiers; the secret is never written down.
    metadata: { name, surface: input.surface, scopes: input.scopes.join(" ") },
  });

  return ok({
    token,
    credential: {
      id,
      name,
      surface: input.surface,
      scopes: input.scopes,
      hint,
      createdAt: new Date(),
      createdByName: actor.name,
      lastUsedAt: null,
      revokedAt: null,
    },
  });
}

export async function revokeApiCredential(
  credentialId: string,
  actor: AuthenticatedUser,
  access: AccessRepository,
): Promise<Result<void, ApiCredentialFailure>> {
  if (actor.role !== "ADMIN") return err("FORBIDDEN");

  const revoked = await access.revokeApiCredential(credentialId, new Date());
  if (!revoked) return err("NOT_FOUND");

  await access.recordAuditEvent({
    action: "API_CREDENTIAL_REVOKED",
    actorKind: "SESSION",
    actorUserId: actor.id,
    subject: credentialId,
    metadata: null,
  });

  return ok(undefined);
}
