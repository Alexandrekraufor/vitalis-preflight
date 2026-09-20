import { describe, expect, it } from "vitest";

import { withoutBlankValues } from "@/lib/environment-values";

describe("withoutBlankValues", () => {
  it("drops a variable that was left empty in the deployment stack", () => {
    const result = withoutBlankValues({ VITALIS_API_KEY: "", APP_URL: "https://exemplo.com.br" });

    expect("VITALIS_API_KEY" in result).toBe(false);
    expect(result["APP_URL"]).toBe("https://exemplo.com.br");
  });

  it("drops a variable holding only whitespace", () => {
    expect("EVALUATOR_EMAIL" in withoutBlankValues({ EVALUATOR_EMAIL: "   " })).toBe(false);
  });

  it("drops an undefined variable without turning it into a string", () => {
    expect("ANTHROPIC_API_KEY" in withoutBlankValues({ ANTHROPIC_API_KEY: undefined })).toBe(false);
  });

  it("keeps a real value untouched, spaces and all", () => {
    const result = withoutBlankValues({ OWNER_NAME: " Ana Prado " });

    expect(result["OWNER_NAME"]).toBe(" Ana Prado ");
  });

  it("keeps a value that is falsy but meaningful", () => {
    const result = withoutBlankValues({ VITALIS_API_DEMO_MODE: "false" });

    expect(result["VITALIS_API_DEMO_MODE"]).toBe("false");
  });
});
