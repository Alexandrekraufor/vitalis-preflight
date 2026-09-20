import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import { normalizeEmail } from "@/domain/access/access.types";
import { err, ok, type Result } from "@/lib/result";

export interface PasswordHasher {
  verify(digest: string, password: string): Promise<boolean>;
  /** Burns comparable time when there is no user to verify against. */
  simulateVerification(): Promise<void>;
}

export interface SessionTokenFactory {
  create(): string;
  hash(token: string): string;
}

export interface AuthenticateDependencies {
  readonly access: AccessRepository;
  readonly hasher: PasswordHasher;
  readonly tokens: SessionTokenFactory;
  readonly sessionLifetimeMs: number;
}

export interface AuthenticateInput {
  readonly email: string;
  readonly password: string;
}

export interface EstablishedSession {
  readonly token: string;
  readonly expiresAt: Date;
  readonly user: AuthenticatedUser;
}

/**
 * Every way authentication can fail collapses into this one value.
 *
 * The caller is expected to show the same message for all of them: telling a
 * visitor that an address exists but the password is wrong, or that an account
 * is disabled, hands an attacker a working list of employees.
 */
export type AuthenticationFailure = "INVALID_CREDENTIALS";

/**
 * Verifies credentials and opens a session.
 *
 * The failure path deliberately does the same amount of work as the success
 * path, including hashing, so response time does not reveal whether an address
 * is registered.
 */
export async function authenticate(
  input: AuthenticateInput,
  { access, hasher, tokens, sessionLifetimeMs }: AuthenticateDependencies,
): Promise<Result<EstablishedSession, AuthenticationFailure>> {
  const email = normalizeEmail(input.email);
  const credentials = await access.findUserByEmail(email);

  if (credentials === null) {
    await hasher.simulateVerification();
    await recordFailure(access, email);
    return err("INVALID_CREDENTIALS");
  }

  const passwordMatches = await hasher.verify(credentials.passwordHash, input.password);

  if (!passwordMatches || credentials.status !== "ACTIVE") {
    await recordFailure(access, email);
    return err("INVALID_CREDENTIALS");
  }

  const token = tokens.create();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs);

  await access.createSession(credentials.id, tokens.hash(token), expiresAt);
  await access.recordLogin(credentials.id, now);
  await access.recordAuditEvent({
    action: "USER_LOGIN_SUCCEEDED",
    actorKind: "SESSION",
    actorUserId: credentials.id,
    subject: email,
    metadata: null,
  });

  return ok({
    token,
    expiresAt,
    user: {
      id: credentials.id,
      email: credentials.email,
      name: credentials.name,
      role: credentials.role,
      status: credentials.status,
    },
  });
}

/** The attempted address is recorded; the submitted password never is. */
function recordFailure(access: AccessRepository, email: string): Promise<void> {
  return access.recordAuditEvent({
    action: "USER_LOGIN_FAILED",
    actorKind: "SESSION",
    actorUserId: null,
    subject: email,
    metadata: null,
  });
}
