import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

function createDatabase() {
  const client = postgres(env().DATABASE_URL, { max: 10 });
  return drizzle(client, { schema });
}

/**
 * One pool per process. Next.js reloads modules in development, so the instance
 * is parked on `globalThis` to avoid leaking a pool on every hot reload.
 */
const globalForDatabase = globalThis as typeof globalThis & {
  vitalisDatabase?: Database;
};

export function db(): Database {
  globalForDatabase.vitalisDatabase ??= createDatabase();
  return globalForDatabase.vitalisDatabase;
}
