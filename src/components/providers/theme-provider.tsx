"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
  readonly children: ReactNode;
  /**
   * Nonce for the inline script next-themes injects to apply the stored theme
   * before first paint. The Content Security Policy allows no unsigned inline
   * script, so without it the script is blocked and the page flashes the
   * wrong theme.
   */
  readonly nonce?: string;
}

export function ThemeProvider({ children, nonce }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...(nonce === undefined ? {} : { nonce })}
    >
      {children}
    </NextThemesProvider>
  );
}
