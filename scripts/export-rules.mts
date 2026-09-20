import { writeFile } from "node:fs/promises";

import { ruleDocumentSchema, serializeDocument } from "@/domain/conventions/rule-document";
import { DEFAULT_RULE_FILE } from "@/infrastructure/rules/file-rule-set.repository";
import { appServices } from "@/infrastructure/composition-root";

/**
 * Writes the published rule set back into the repository's seed file.
 *
 * The running system reads its rules from the published version in the
 * database; the file is the seed a fresh deployment starts from, and the
 * fixture the tests run against. This script is the bridge: after a rule is
 * changed on screen, one command brings the repository back in step, so the
 * answer to "where do I change a rule" stays a single one.
 */
async function main(): Promise<void> {
  const services = await appServices();
  const published = await services.rules.findPublished();

  if (published === null) {
    throw new Error("Não há versão de regras publicada para exportar.");
  }

  const document = ruleDocumentSchema.parse(published.document);
  await writeFile(DEFAULT_RULE_FILE, `${serializeDocument(document)}\n`, "utf8");

  process.stdout.write(
    `Versão ${published.version} (${published.hash.slice(0, 12)}…) exportada para ${DEFAULT_RULE_FILE}.\n` +
      "Rode `pnpm test` em seguida: os testes usam este arquivo como fixture.\n",
  );
}

await main();
process.exit(0);
