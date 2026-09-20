import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/": `${fromRoot("./src")}/`,
      "@tests/": `${fromRoot("./tests")}/`,
      // `server-only` throws outside the React Server condition; under Vitest the
      // guard has nothing to protect, so it resolves to the package's empty module.
      "server-only": fromRoot("./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globals: false,
  },
});
