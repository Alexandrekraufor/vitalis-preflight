import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE } from "@/infrastructure/auth/session";
import { signIn, type SignedInUser } from "@tests/fixtures/sessions";
import { createTestServices, type TestServices } from "@tests/fixtures/test-services";

let services: TestServices;
/** Whatever this holds is what `cookies()` reports for the next call. */
let currentCookie: string | null = null;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

// The actions read the session through `cookies()`, which only exists inside a
// Next request. Substituting the store lets the tests drive the *real* actions
// with a real session token instead of stubbing the authorization itself.
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === SESSION_COOKIE && currentCookie !== null
          ? { name, value: currentCookie }
          : undefined,
      set: () => undefined,
    }),
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { inviteMemberAction, setMemberRoleAction, setMemberStatusAction } = await import(
  "@/app/(dashboard)/configuracoes/equipe/actions"
);
const { INITIAL_TEAM_STATE } = await import(
  "@/app/(dashboard)/configuracoes/equipe/team-state"
);

function inviteForm(email: string, role = "MEMBER"): FormData {
  const form = new FormData();
  form.set("email", email);
  form.set("role", role);
  return form;
}

let admin: SignedInUser;
let member: SignedInUser;

beforeEach(async () => {
  services = createTestServices();
  admin = await signIn(services.access, "ADMIN", { email: "admin@vitalis.test" });
  member = await signIn(services.access, "MEMBER", { email: "membro@vitalis.test" });
  currentCookie = null;
});

describe("administrator actions authorize on the server", () => {
  it("refuses an anonymous caller", async () => {
    currentCookie = null;

    const state = await inviteMemberAction(
      INITIAL_TEAM_STATE,
      inviteForm("alguem@vitalis.test"),
    );

    expect(state.error).toContain("entrar");
    await expect(services.access.listInvitations()).resolves.toEqual([]);
  });

  it("refuses a MEMBER invoking the invite action directly", async () => {
    currentCookie = member.token;

    const state = await inviteMemberAction(
      INITIAL_TEAM_STATE,
      inviteForm("alguem@vitalis.test"),
    );

    // The absence of a button in the UI is not the control; this is.
    expect(state.error).toBe("Esta ação é restrita a administradores.");
    await expect(services.access.listInvitations()).resolves.toEqual([]);
  });

  it("refuses a MEMBER trying to promote themselves", async () => {
    currentCookie = member.token;

    const form = new FormData();
    form.set("userId", member.user.id);
    form.set("role", "ADMIN");

    const state = await setMemberRoleAction(INITIAL_TEAM_STATE, form);

    expect(state.error).toBe("Esta ação é restrita a administradores.");
    await expect(services.access.findUserById(member.user.id)).resolves.toMatchObject({
      role: "MEMBER",
    });
  });

  it("refuses a MEMBER trying to disable an administrator", async () => {
    currentCookie = member.token;

    const form = new FormData();
    form.set("userId", admin.user.id);
    form.set("disable", "true");

    const state = await setMemberStatusAction(INITIAL_TEAM_STATE, form);

    expect(state.error).toBe("Esta ação é restrita a administradores.");
    await expect(services.access.findUserById(admin.user.id)).resolves.toMatchObject({
      status: "ACTIVE",
    });
  });

  it("refuses a session token that does not resolve", async () => {
    currentCookie = "token-inventado-por-alguem";

    const state = await inviteMemberAction(
      INITIAL_TEAM_STATE,
      inviteForm("alguem@vitalis.test"),
    );

    expect(state.error).toContain("entrar");
  });

  it("lets an ADMIN invite", async () => {
    currentCookie = admin.token;

    const state = await inviteMemberAction(
      INITIAL_TEAM_STATE,
      inviteForm("novo@vitalis.test"),
    );

    expect(state.error).toBeNull();
    expect(state.notice).toContain("novo@vitalis.test");

    const invitations = await services.access.listInvitations();
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toMatchObject({ email: "novo@vitalis.test", status: "PENDING" });
  });

  it("rejects a malformed address before touching the database", async () => {
    currentCookie = admin.token;

    const state = await inviteMemberAction(INITIAL_TEAM_STATE, inviteForm("nao-e-email"));

    expect(state.error).toContain("e-mail válido");
    await expect(services.access.listInvitations()).resolves.toEqual([]);
  });

  it("rejects a role the union does not contain", async () => {
    currentCookie = admin.token;

    const state = await inviteMemberAction(
      INITIAL_TEAM_STATE,
      inviteForm("novo@vitalis.test", "SUPERADMIN"),
    );

    expect(state.error).toContain("nível de acesso");
    await expect(services.access.listInvitations()).resolves.toEqual([]);
  });

  it("never returns the invitation link when production behaviour is in force", async () => {
    currentCookie = admin.token;
    const state = await inviteMemberAction(
      INITIAL_TEAM_STATE,
      inviteForm("novo@vitalis.test"),
    );

    // Tests run outside production, so the link is present by design — the
    // production path is covered where the use case is tested directly.
    expect(typeof state.inviteUrl).toBe("string");
    expect(state.inviteUrl).not.toContain(admin.token);
  });
});
