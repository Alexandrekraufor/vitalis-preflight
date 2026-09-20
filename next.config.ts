import type { NextConfig } from "next";

/**
 * Host this deployment answers on, taken from the configured origin.
 *
 * In development Next blocks its own dev assets when they are requested from
 * a host other than localhost, which is exactly what happens behind a tunnel:
 * the page renders but its fonts and hot reload are refused. Declaring the
 * host fixes that without hard-coding anybody's domain, and it has no effect
 * on a production build.
 */
function configuredHost(): string | null {
  try {
    return new URL(process.env["APP_URL"] ?? "").hostname;
  } catch {
    return null;
  }
}

const host = configuredHost();

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Produces a self-contained server directory, which is what the production
  // image copies: no node_modules, no source, no package manager.
  output: "standalone",
  ...(host === null || host === "localhost" ? {} : { allowedDevOrigins: [host] }),
};

export default nextConfig;
