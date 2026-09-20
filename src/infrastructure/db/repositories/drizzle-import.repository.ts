import "server-only";

import { desc, eq } from "drizzle-orm";

import type {
  FinishImportInput,
  ImportRecord,
  ImportRepository,
  StartImportInput,
} from "@/application/ports/import-repository.port";

import type { Database } from "../client";
import { sourceImports } from "../schema/guides";

/**
 * Import provenance. A row is opened before the first guide is processed and
 * closed with the totals, so a crash mid-import leaves visible evidence rather
 * than a gap.
 */
export function createDrizzleImportRepository(database: Database): ImportRepository {
  return {
    async start({ source, fileName, fileHash }: StartImportInput): Promise<string> {
      const [row] = await database
        .insert(sourceImports)
        .values({
          source,
          fileName,
          fileHash,
          rowsRead: 0,
          rowsImported: 0,
          rowsRejected: 0,
        })
        .returning({ id: sourceImports.id });

      if (row === undefined) throw new Error("Falha ao registrar a importação.");
      return row.id;
    },

    async finish({ id, ...totals }: FinishImportInput): Promise<void> {
      await database.update(sourceImports).set(totals).where(eq(sourceImports.id, id));
    },

    async listRecent(limit: number): Promise<readonly ImportRecord[]> {
      const rows = await database
        .select()
        .from(sourceImports)
        .orderBy(desc(sourceImports.createdAt))
        .limit(limit);

      return rows.map((row) => ({
        id: row.id,
        source: row.source,
        fileName: row.fileName,
        rowsRead: row.rowsRead,
        rowsImported: row.rowsImported,
        rowsRejected: row.rowsRejected,
        createdAt: row.createdAt,
      }));
    },
  };
}
