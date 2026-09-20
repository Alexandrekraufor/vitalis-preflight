import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env", quiet: true });

const databaseUrl = process.env["DATABASE_URL"];

if (databaseUrl === undefined) {
  throw new Error("DATABASE_URL não definida. Copie .env.example para .env.");
}

export default defineConfig({
  schema: "./src/infrastructure/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
