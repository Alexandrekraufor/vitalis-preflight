import "server-only";

import { z } from "zod";

import { withoutBlankValues } from "./environment-values";

/**
 * Environment contract. Parsed once, eagerly, so a misconfigured deployment
 * fails at boot instead of halfway through a validation run.
 *
 * Everything here is server-only by construction: this module imports
 * `server-only`, and no variable is prefixed `NEXT_PUBLIC_`, so none of these
 * values can be reached from a Client Component or end up in the browser
 * bundle. See `docs/security.md`.
 */
const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    /** Absolute origin of this deployment. Used to build invitation links. */
    APP_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),

    /**
     * Bearer credential for the external integration API (`/api/v1/*`).
     * Absent means the external API is closed entirely.
     */
    VITALIS_API_KEY: z.string().min(32).optional(),

    /** Bearer credential for the remote MCP endpoint (`/mcp`). */
    VITALIS_MCP_API_KEY: z.string().min(32).optional(),

    /**
     * Opens `POST /api/v1/guides/validate` - and nothing else - without a
     * credential, so a reviewer can exercise the validator from a form. It is
     * a stateless computation over data the caller already has: it reads no
     * stored guide and writes none.
     */
    VITALIS_API_DEMO_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),

    /**
     * Account handed to an external reviewer. Only `scripts/provision-evaluator`
     * reads these; the application itself never looks them up.
     */
    EVALUATOR_EMAIL: z.email().optional(),
    EVALUATOR_PASSWORD: z.string().min(12).optional(),

    OBSERVATION_INTERPRETER: z.enum(["heuristic", "llm"]).default("heuristic"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    OBSERVATION_LLM_MODEL: z.string().min(1).default("claude-sonnet-5"),
  })
  .superRefine((value, ctx) => {
    if (value.OBSERVATION_INTERPRETER === "llm" && value.ANTHROPIC_API_KEY === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message: 'obrigatório quando OBSERVATION_INTERPRETER="llm"',
      });
    }

    if (value.NODE_ENV === "production") {
      if (value.APP_URL.startsWith("http://")) {
        ctx.addIssue({
          code: "custom",
          path: ["APP_URL"],
          message: "precisa usar https em produção (o cookie de sessão depende disso)",
        });
      }

      if (value.VITALIS_API_DEMO_MODE) {
        ctx.addIssue({
          code: "custom",
          path: ["VITALIS_API_DEMO_MODE"],
          message: "não pode ficar ligado em produção",
        });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

function readEnvironment(): Environment {
  const parsed = environmentSchema.safeParse(withoutBlankValues(process.env));

  if (!parsed.success) {
    // Only the variable names and the reasons are printed - never a value, so a
    // misconfiguration cannot spill a credential into a log or a crash report.
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

let cached: Environment | undefined;

export function env(): Environment {
  cached ??= readEnvironment();
  return cached;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}
