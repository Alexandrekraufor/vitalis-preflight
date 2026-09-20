import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { importGuides } from "@/application/imports/import-guides.use-case";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";
import { appServices } from "@/infrastructure/composition-root";

const CSV_PATH = path.join(process.cwd(), "data", "source", "guias.csv");

/**
 * Loads the shipped dataset through the exact same use case the upload screen
 * uses, so a seeded database is indistinguishable from an imported one.
 */
async function main(): Promise<void> {
  const contents = await readFile(CSV_PATH, "utf8");
  const parsed = parseGuideCsv(contents);

  if (!parsed.ok) {
    throw new Error(`CSV inválido: ${parsed.error.message}`);
  }

  const services = await appServices();
  const outcome = await importGuides(
    {
      records: parsed.value,
      source: "SEED",
      fileName: path.basename(CSV_PATH),
      fileHash: createHash("sha256").update(contents, "utf8").digest("hex"),
    },
    services,
  );

  const byStatus = outcome.imported.reduce<Record<string, number>>((counts, item) => {
    const status = item.validated.result.decision.status;
    return { ...counts, [status]: (counts[status] ?? 0) + 1 };
  }, {});

  process.stdout.write(
    [
      `${outcome.imported.length} guias importadas`,
      `${byStatus["READY_TO_SUBMIT"] ?? 0} prontas para envio`,
      `${byStatus["NEEDS_CORRECTION"] ?? 0} precisam correção`,
      `${byStatus["REVIEW_REQUIRED"] ?? 0} precisam revisão`,
      `${outcome.automaticNormalizations} normalizações automáticas`,
      `${outcome.rejected.length} linhas rejeitadas`,
    ].join("\n") + "\n",
  );
}

await main();
process.exit(0);
