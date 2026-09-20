import { createInterface } from "node:readline/promises";

import { checkPassword, passwordRejectionMessage } from "@/domain/access/password-policy";
import { normalizeEmail } from "@/domain/access/access.types";
import { hashPassword } from "@/infrastructure/auth/password-hasher";
import { appServices } from "@/infrastructure/composition-root";

/**
 * Creates the first administrator.
 *
 * There is no public registration and no seeded default account, so the very
 * first identity has to come from somebody with shell access to the deployment.
 * From then on every account is created by accepting an invitation.
 *
 * The password is read from `BOOTSTRAP_ADMIN_PASSWORD` when set (for scripted
 * provisioning) and otherwise prompted for, so it does not have to sit in shell
 * history. It is never echoed and never logged.
 */
async function main(): Promise<void> {
  const services = await appServices();

  const email = normalizeEmail(
    process.env["BOOTSTRAP_ADMIN_EMAIL"] ?? (await ask("E-mail do administrador: ")),
  );
  const name = process.env["BOOTSTRAP_ADMIN_NAME"] ?? (await ask("Nome: "));
  const password =
    process.env["BOOTSTRAP_ADMIN_PASSWORD"] ?? (await ask("Senha: ", { silent: true }));

  if (await services.access.findUserByEmail(email)) {
    throw new Error(`Já existe uma conta para ${email}.`);
  }

  const rejection = checkPassword(password);
  if (rejection !== null) throw new Error(passwordRejectionMessage(rejection));

  const user = await services.access.createUser({
    email,
    name: name.trim(),
    passwordHash: await hashPassword(password),
    role: "ADMIN",
  });

  process.stdout.write(
    `\nAdministrador criado: ${user.name} <${user.email}>\nEntre em /login e convide o restante da equipe em /configuracoes/equipe.\n`,
  );
}

async function ask(prompt: string, options: { silent?: boolean } = {}): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (options.silent !== true) return (await rl.question(prompt)).trim();

    // Suppress echo so the password does not end up on screen or in a
    // screen-sharing recording.
    const output = process.stdout as NodeJS.WriteStream & { muted?: boolean };
    const originalWrite = output.write.bind(output);
    process.stdout.write(prompt);
    output.write = ((chunk: string | Uint8Array, ...rest: unknown[]) =>
      typeof chunk === "string" && chunk.includes("\n")
        ? originalWrite(chunk, ...(rest as []))
        : true) as typeof output.write;

    const answer = await rl.question("");
    output.write = originalWrite;
    process.stdout.write("\n");
    return answer.trim();
  } finally {
    rl.close();
  }
}

await main();
process.exit(0);
