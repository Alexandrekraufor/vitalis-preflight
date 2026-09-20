"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

/**
 * Switches between the light and dark themes.
 *
 * The stored preference only exists in the browser, so the button cannot know
 * its own state on the server: it renders a placeholder of the same size until
 * hydration, which keeps the header from shifting.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) return <div className="size-9" aria-hidden />;

  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
      title={dark ? "Modo claro" : "Modo escuro"}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border-subtle bg-surface text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
    >
      {dark ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
    </button>
  );
}
