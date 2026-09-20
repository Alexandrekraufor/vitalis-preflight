import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { AuthenticatedUser, UserRole } from "@/domain/access/access.types";
import { hashPassword } from "@/infrastructure/auth/password-hasher";
import { SESSION_COOKIE, sessionTokens } from "@/infrastructure/auth/session";

export interface SignedInUser {
  readonly user: AuthenticatedUser;
  readonly token: string;
  /** Ready to spread into `Request` headers. */
  readonly cookie: Record<string, string>;
}

const TEST_PASSWORD = "senha-de-teste-123";

/**
 * Creates an active member and opens a real session for them.
 *
 * The cookie handed back is the genuine article - the same opaque token the
 * login action would set - so authorization tests exercise the real lookup
 * path rather than a stubbed user.
 */
export async function signIn(
  access: AccessRepository,
  role: UserRole,
  overrides: { readonly email?: string; readonly name?: string } = {},
): Promise<SignedInUser> {
  const user = await access.createUser({
    email: overrides.email ?? `${role.toLowerCase()}@vitalis.test`,
    name: overrides.name ?? (role === "ADMIN" ? "Admin de Teste" : "Membro de Teste"),
    passwordHash: await hashPassword(TEST_PASSWORD),
    role,
  });

  const token = sessionTokens.create();
  await access.createSession(
    user.id,
    sessionTokens.hash(token),
    new Date(Date.now() + 60 * 60 * 1000),
  );

  return { user, token, cookie: { cookie: `${SESSION_COOKIE}=${token}` } };
}

export { TEST_PASSWORD };
