import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { CookieBanner } from "@/components/layout/cookie-banner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Vitalis Preflight",
    template: "%s · Vitalis Preflight",
  },
  description: "Validação preventiva de guias de convênio da Clínica Vitalis.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // `src/proxy.ts` mints one nonce per request and forwards it here, so the
  // theme script can be signed instead of the policy being relaxed.
  const nonce = (await headers()).get("x-nonce");

  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <ThemeProvider {...(nonce === null ? {} : { nonce })}>
          {children}
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
