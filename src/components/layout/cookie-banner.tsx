"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { X, Cookie } from "lucide-react";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Basic check if already accepted
    const consented = localStorage.getItem("lgpd_consent");
    if (!consented) {
      // small delay for dramatic effect
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem("lgpd_consent", "true");
    setIsVisible(false);
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-4 left-4 z-50 max-w-sm rounded-xl border border-border-subtle bg-surface p-5 shadow-float sm:bottom-6 sm:left-6"
        >
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Cookie className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ink">Privacidade e Cookies</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                Utilizamos cookies para melhorar sua experiência, oferecer segurança e analisar o tráfego da clínica. Ao prosseguir, você concorda com nossos{" "}
                <Link href="/termos" className="font-medium text-accent hover:underline">
                  Termos
                </Link>{" "}
                e{" "}
                <Link href="/privacidade" className="font-medium text-accent hover:underline">
                  Privacidade
                </Link>.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleAccept}
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
                >
                  Aceitar todos
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="rounded-lg border border-border-subtle px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-slate-50"
                >
                  Recusar
                </button>
              </div>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
