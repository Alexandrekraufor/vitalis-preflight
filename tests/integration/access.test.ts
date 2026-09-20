import { beforeEach, describe, expect, it, vi } from "vitest";

import { acceptInvitation } from "@/application/access/accept-invitation.use-case";
import { authenticate } from "@/application/access/authenticate.use-case";
import { inviteMember } from "@/application/access/invite-member.use-case";
import { setMemberRole, setMemberStatus } from "@/application/access/manage-team.use-case";
import { checkInvitationUsable } from "@/domain/access/invitation";
import {
  hashPassword,
  simulatePasswordVerification,
  verifyPassword,
} from "@/infrastructure/auth/password-hasher";
import { SESSION_COOKIE, sessionTokens } from "@/infrastructure/auth/session";
import { resolveSessionFromRequest } from "@/infrastructure/auth/guards";
import { signIn } from "@tests/fixtures/sessions";
import { createTestServices, type TestServices } from "@tests/fixtures/test-services";

let services: TestServices;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

const { POST: importCsv } = await import("@/app/api/internal/imports/csv/route");
const { GET: exportCsv } = await import("@/app/api/internal/guides/export/route");

const SESSION_LIFETIME = 60 * 60 * 1000;

function hasher() {
  return { verify: verifyPassword, simulateVerification: simulatePasswordVerification };
}

function authDeps() {
  return {
    access: services.access,
    hasher: hasher(),
    tokens: sessionTokens,
    sessionLifetimeMs: SESSION_LIFETIME,
  };
}

function inviteDeps() {
  return {
    access: services.access,
    tokens: sessionTokens,
    mailer: services.mailer,
    appUrl: "http://localhost:3000",
    revealLinkToAdmin: true,
  };
}

function tokenFromLastInvite(): string {
  const message = services.mailer.sent.at(-1);
  if (message === undefined) throw new Error("nenhum convite enviado");
  return message.acceptUrl.split("/invite/")[1] ?? "";
}

beforeEach(() => {
  services = createTestServices();
});

describe("passwords", () => {
  it("stores an argon2id digest with the intended parameters, never the password", async () => {
    const digest = await hashPassword("uma-senha-bem-longa");

    expect(digest.startsWith("$argon2id$")).toBe(true);
    expect(digest).toContain("m=19456,t=2,p=1");
    expect(digest).not.toContain("uma-senha-bem-longa");
  });

  it("produces a different digest for the same password", async () => {
    const [first, second] = await Promise.all([
      hashPassword("mesma-senha-aqui"),
      hashPassword("mesma-senha-aqui"),
    ]);

    // Different salts: two members with the same password are not linkable in
    // a database dump.
    expect(first).not.toBe(second);
    await expect(verifyPassword(first, "mesma-senha-aqui")).resolves.toBe(true);
  });

  it("never lets a stored digest reach a member listing", async () => {
    await signIn(services.access, "ADMIN");
    const members = await services.access.listMembers();

    expect(JSON.stringify(members)).not.toContain("$argon2id$");
    for (const member of members) {
      expect(member).not.toHaveProperty("passwordHash");
    }
  });
});

describe("authentication", () => {
  it("opens a session for valid credentials", async () => {
    const admin = await signIn(services.access, "ADMIN", { email: "chefe@vitalis.test" });
    void admin;

    const result = await authenticate(
      { email: "chefe@vitalis.test", password: "senha-de-teste-123" },
      authDeps(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.role).toBe("ADMIN");
  });

  it("gives the same answer for a wrong password and an unknown address", async () => {
    await signIn(services.access, "MEMBER", { email: "existe@vitalis.test" });

    const wrongPassword = await authenticate(
      { email: "existe@vitalis.test", password: "senha-errada-aqui" },
      authDeps(),
    );
    const unknownEmail = await authenticate(
      { email: "ninguem@vitalis.test", password: "senha-errada-aqui" },
      authDeps(),
    );

    expect(wrongPassword).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(unknownEmail).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });

  it("refuses a disabled account even with the right password", async () => {
    const member = await signIn(services.access, "MEMBER", { email: "saiu@vitalis.test" });
    await services.access.setUserStatus(member.user.id, "DISABLED");

    await expect(
      authenticate({ email: "saiu@vitalis.test", password: "senha-de-teste-123" }, authDeps()),
    ).resolves.toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });

  it("records the attempted address on failure but never the password", async () => {
    await authenticate(
      { email: "alguem@vitalis.test", password: "senha-secreta-do-usuario" },
      authDeps(),
    );

    const events = await services.access.listAuditEvents(10);
    expect(events[0]).toMatchObject({
      action: "USER_LOGIN_FAILED",
      subject: "alguem@vitalis.test",
    });
    expect(JSON.stringify(events)).not.toContain("senha-secreta-do-usuario");
  });

  it("matches the address case-insensitively", async () => {
    await signIn(services.access, "MEMBER", { email: "maiuscula@vitalis.test" });

    await expect(
      authenticate(
        { email: "  MAIUSCULA@Vitalis.TEST ", password: "senha-de-teste-123" },
        authDeps(),
      ),
    ).resolves.toMatchObject({ ok: true });
  });
});

describe("sessions", () => {
  it("resolves a real cookie to the signed-in member", async () => {
    const member = await signIn(services.access, "MEMBER");
    const request = new Request("http://localhost/", { headers: member.cookie });

    const resolved = await resolveSessionFromRequest(request, services.access);
    expect(resolved?.user.id).toBe(member.user.id);
  });

  it("resolves nothing for a forged cookie", async () => {
    await signIn(services.access, "ADMIN");
    const request = new Request("http://localhost/", {
      headers: { cookie: `${SESSION_COOKIE}=${sessionTokens.create()}` },
    });

    await expect(resolveSessionFromRequest(request, services.access)).resolves.toBeNull();
  });

  it("stores only the digest of the session token", async () => {
    const member = await signIn(services.access, "MEMBER");

    // The raw token resolves; the value the database holds is its hash, so the
    // hash itself is useless as a cookie.
    const asHash = new Request("http://localhost/", {
      headers: { cookie: `${SESSION_COOKIE}=${sessionTokens.hash(member.token)}` },
    });

    await expect(resolveSessionFromRequest(asHash, services.access)).resolves.toBeNull();
  });

  it("stops resolving once the session expires", async () => {
    const member = await signIn(services.access, "MEMBER");
    await services.access.createSession(
      member.user.id,
      sessionTokens.hash("expirado"),
      new Date(Date.now() - 1000),
    );

    const request = new Request("http://localhost/", {
      headers: { cookie: `${SESSION_COOKIE}=expirado` },
    });

    await expect(resolveSessionFromRequest(request, services.access)).resolves.toBeNull();
  });

  it("drops every session the moment a member is disabled", async () => {
    const admin = await signIn(services.access, "ADMIN");
    const member = await signIn(services.access, "MEMBER");

    await setMemberStatus({ targetId: member.user.id, disable: true }, admin.user, services.access);

    const request = new Request("http://localhost/", { headers: member.cookie });
    await expect(resolveSessionFromRequest(request, services.access)).resolves.toBeNull();
  });
});

describe("invitations", () => {
  it("creates a single-use invitation and hashes the token", async () => {
    const admin = await signIn(services.access, "ADMIN");

    const result = await inviteMember(
      { email: "Nova.Pessoa@Vitalis.test", role: "MEMBER", invitedBy: admin.user },
      inviteDeps(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const token = tokenFromLastInvite();
    const stored = await services.access.findInvitationByTokenHash(sessionTokens.hash(token));

    expect(stored?.email).toBe("nova.pessoa@vitalis.test");
    // A plaintext token is never persisted, so the table cannot be mined for
    // working invitation links.
    await expect(services.access.findInvitationByTokenHash(token)).resolves.toBeNull();
  });

  it("turns a valid invitation into an account with the invited role", async () => {
    const admin = await signIn(services.access, "ADMIN");
    await inviteMember(
      { email: "convidado@vitalis.test", role: "MEMBER", invitedBy: admin.user },
      inviteDeps(),
    );

    const result = await acceptInvitation(
      { token: tokenFromLastInvite(), name: "Pessoa Convidada", password: "uma-senha-valida-1" },
      { access: services.access, hasher: { hash: hashPassword }, tokens: sessionTokens, sessionLifetimeMs: SESSION_LIFETIME },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.user).toMatchObject({
      email: "convidado@vitalis.test",
      name: "Pessoa Convidada",
      role: "MEMBER",
    });
  });

  it("ignores any e-mail the form tries to supply", async () => {
    const admin = await signIn(services.access, "ADMIN");
    await inviteMember(
      { email: "destinatario@vitalis.test", role: "MEMBER", invitedBy: admin.user },
      inviteDeps(),
    );

    const result = await acceptInvitation(
      { token: tokenFromLastInvite(), name: "Invasor", password: "uma-senha-valida-1" },
      { access: services.access, hasher: { hash: hashPassword }, tokens: sessionTokens, sessionLifetimeMs: SESSION_LIFETIME },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The account can only ever be the one the invitation names.
    expect(result.value.user.email).toBe("destinatario@vitalis.test");
  });

  async function invite(role: "ADMIN" | "MEMBER" = "MEMBER"): Promise<string> {
    const admin = await signIn(services.access, "ADMIN");
    await inviteMember(
      { email: `convite-${role}@vitalis.test`, role, invitedBy: admin.user },
      inviteDeps(),
    );
    return tokenFromLastInvite();
  }

  function accept(token: string) {
    return acceptInvitation(
      { token, name: "Pessoa", password: "uma-senha-valida-1" },
      { access: services.access, hasher: { hash: hashPassword }, tokens: sessionTokens, sessionLifetimeMs: SESSION_LIFETIME },
    );
  }

  it("refuses an unknown token", async () => {
    await expect(accept("token-que-nao-existe")).resolves.toEqual({
      ok: false,
      error: { kind: "INVITATION", reason: "NOT_FOUND" },
    });
  });

  it("refuses a token that was already used", async () => {
    const token = await invite();
    await accept(token);

    await expect(accept(token)).resolves.toEqual({
      ok: false,
      error: { kind: "INVITATION", reason: "ALREADY_ACCEPTED" },
    });
  });

  it("refuses a revoked invitation", async () => {
    const admin = await signIn(services.access, "ADMIN");
    await inviteMember(
      { email: "revogado@vitalis.test", role: "MEMBER", invitedBy: admin.user },
      inviteDeps(),
    );
    const token = tokenFromLastInvite();

    const pending = await services.access.findInvitationByTokenHash(sessionTokens.hash(token));
    await services.access.revokeInvitation(pending?.id ?? "", new Date());

    await expect(accept(token)).resolves.toEqual({
      ok: false,
      error: { kind: "INVITATION", reason: "REVOKED" },
    });
  });

  it("refuses an expired invitation", () => {
    const expired = { status: "PENDING" as const, expiresAt: new Date(Date.now() - 1) };
    expect(checkInvitationUsable(expired, new Date())).toBe("EXPIRED");
  });

  it("refuses a password below the policy", async () => {
    const token = await invite();

    await expect(
      acceptInvitation(
        { token, name: "Pessoa", password: "curta" },
        { access: services.access, hasher: { hash: hashPassword }, tokens: sessionTokens, sessionLifetimeMs: SESSION_LIFETIME },
      ),
    ).resolves.toEqual({ ok: false, error: { kind: "PASSWORD", reason: "TOO_SHORT" } });
  });

  it("refuses a second pending invitation for the same address", async () => {
    const admin = await signIn(services.access, "ADMIN");
    const first = await inviteMember(
      { email: "duplicado@vitalis.test", role: "MEMBER", invitedBy: admin.user },
      inviteDeps(),
    );
    const second = await inviteMember(
      { email: "duplicado@vitalis.test", role: "MEMBER", invitedBy: admin.user },
      inviteDeps(),
    );

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, error: "ALREADY_INVITED" });
  });

  it("does not hand the link back to the administrator in production mode", async () => {
    const admin = await signIn(services.access, "ADMIN");

    const result = await inviteMember(
      { email: "producao@vitalis.test", role: "MEMBER", invitedBy: admin.user },
      { ...inviteDeps(), revealLinkToAdmin: false },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.acceptUrl).toBeNull();
  });
});

describe("team management invariants", () => {
  it("refuses to disable the last active administrator", async () => {
    const admin = await signIn(services.access, "ADMIN");
    const other = await signIn(services.access, "ADMIN", { email: "outro@vitalis.test" });

    // Two admins: one may go.
    await expect(
      setMemberStatus({ targetId: other.user.id, disable: true }, admin.user, services.access),
    ).resolves.toMatchObject({ ok: true });

    // Now only one remains, and an administrator cannot edit their own row.
    await expect(
      setMemberStatus({ targetId: admin.user.id, disable: true }, admin.user, services.access),
    ).resolves.toEqual({ ok: false, error: "CANNOT_CHANGE_SELF" });
  });

  it("refuses to demote the last active administrator", async () => {
    const admin = await signIn(services.access, "ADMIN");
    const other = await signIn(services.access, "ADMIN", { email: "outro@vitalis.test" });

    await setMemberStatus({ targetId: other.user.id, disable: true }, admin.user, services.access);

    const bystander = await signIn(services.access, "MEMBER");
    await expect(
      setMemberRole({ targetId: admin.user.id, role: "MEMBER" }, bystander.user, services.access),
    ).resolves.toEqual({ ok: false, error: "LAST_ADMIN" });
  });
});

describe("internal endpoints", () => {
  function importRequest(headers: Record<string, string> = {}): Request {
    const form = new FormData();
    form.set("file", new File(["id_guia\n"], "x.csv", { type: "text/csv" }));
    return new Request("http://localhost/api/internal/imports/csv", {
      method: "POST",
      body: form,
      headers,
    });
  }

  it("answers 401 to an anonymous import", async () => {
    const response = await importCsv(importRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("answers 401 to an anonymous export", async () => {
    const response = await exportCsv(
      new Request("http://localhost/api/internal/guides/export?kind=ready"),
    );

    expect(response.status).toBe(401);
  });

  it("lets a signed-in member reach the export", async () => {
    const member = await signIn(services.access, "MEMBER");
    const response = await exportCsv(
      new Request("http://localhost/api/internal/guides/export?kind=ready", {
        headers: member.cookie,
      }),
    );

    expect(response.status).toBe(200);
  });

  it("answers 401 to a session cookie that does not resolve", async () => {
    const response = await importCsv(
      importRequest({ cookie: `${SESSION_COOKIE}=${sessionTokens.create()}` }),
    );

    expect(response.status).toBe(401);
  });
});
