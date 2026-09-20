export type ImportSource = "CSV" | "API" | "SEED";

export interface StartImportInput {
  readonly source: ImportSource;
  readonly fileName: string | null;
  readonly fileHash: string | null;
}

export interface FinishImportInput {
  readonly id: string;
  readonly rowsRead: number;
  readonly rowsImported: number;
  readonly rowsRejected: number;
}

export interface ImportRecord {
  readonly id: string;
  readonly source: ImportSource;
  readonly fileName: string | null;
  readonly rowsRead: number;
  readonly rowsImported: number;
  readonly rowsRejected: number;
  readonly createdAt: Date;
}

export interface ImportRepository {
  start(input: StartImportInput): Promise<string>;
  finish(input: FinishImportInput): Promise<void>;
  listRecent(limit: number): Promise<readonly ImportRecord[]>;
}
