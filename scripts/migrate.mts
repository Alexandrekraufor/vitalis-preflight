import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies the generated SQL migrations. Kept out of the app's database client
 * on purpose: migrating opens its own single connection and closes it, so it
 * can run in CI without touching the pooled runtime client.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];

  if (databaseUrl === undefined) {
    throw new Error("DATABASE_URL não definida. Copie .env.example para .env.");
  }

  const client = postgres(databaseUrl, { max: 1 });

  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    process.stdout.write("Migrations aplicadas.\n");
  } finally {
    await client.end();
  }
}

await main();
