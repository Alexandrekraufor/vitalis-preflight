import { checkPassword, passwordRejectionMessage } from "@/domain/access/password-policy";
import { normalizeEmail } from "@/domain/access/access.types";
import { credentialHint } from "@/domain/access/api-credential";
import { hashPassword } from "@/infrastructure/auth/password-hasher";
import { generateToken, hashToken } from "@/infrastructure/auth/tokens";
import { appServices } from "@/infrastructure/composition-root";
import { env } from "@/lib/env";

/**
 * Provisions the account an external reviewer uses to assess this system.
 *
 * It exists because there is no public sign-up: every other account is born
 * from an invitation, and an assessment cannot depend on somebody being
 * available to send one. The credentials come from the environment, never from
 * this file, and the password goes through the same argon2id hashing as any
 * other account.
 *
 * Running it twice is safe: the account is updated in place and the evaluation
 * keys are rotated, not duplicated.
 */
async function main(): Promise<void> {
  const configuration = env();
  const email = configuration.EVALUATOR_EMAIL;
  const password = configuration.EVALUATOR_PASSWORD;

  if (email === undefined || password === undefined) {
    throw new Error(
      "Defina EVALUATOR_EMAIL e EVALUATOR_PASSWORD no .env antes de provisionar o avaliador.",
    );
  }

  const rejection = checkPassword(password);
  if (rejection !== null) throw new Error(passwordRejectionMessage(rejection));

  const services = await appServices();
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);

  const existing = await services.access.findUserByEmail(normalized);

  if (existing === null) {
    await services.access.createUser({
      email: normalized,
      name: "Avaliação Expert Integrado",
      passwordHash,
      role: "EVALUATOR",
    });
    process.stdout.write(`Conta de avaliação criada: ${normalized}\n`);
  } else {
    await services.access.setUserPassword(existing.id, passwordHash);
    if (existing.role !== "EVALUATOR") {
      await services.access.setUserRole(existing.id, "EVALUATOR");
    }
    if (existing.status !== "ACTIVE") {
      await services.access.setUserStatus(existing.id, "ACTIVE");
    }
    process.stdout.write(`Conta de avaliação atualizada: ${normalized}\n`);
  }

  // Two surfaces, two credentials: an MCP key is not a REST key, and the
  // panel shows each one where it is used.
  for (const surface of ["REST", "MCP"] as const) {
    const secret = generateToken();

    await services.access.upsertEvaluationCredential({
      name: surface === "REST" ? "Avaliação - API REST" : "Avaliação - MCP",
      surface,
      scopes: ["READ"],
      tokenHash: hashToken(secret),
      hint: credentialHint(secret),
      secret,
    });

    process.stdout.write(`Credencial de avaliação (${surface}) gerada.\n`);
  }

  await services.access.recordAuditEvent({
    action: "API_CREDENTIAL_ISSUED",
    actorKind: "SYSTEM",
    actorUserId: null,
    subject: normalized,
    metadata: { name: "Avaliação", surface: "REST MCP", scopes: "READ" },
  });

  process.stdout.write(
    "\nO avaliador entra em /login com essas credenciais e lê as chaves em Integrações.\n" +
      "O valor das chaves não é impresso aqui de propósito: ele aparece apenas na tela, para quem está autenticado.\n",
  );
}

await main();
process.exit(0);
