"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * Copies a snippet the page already shows. The text is passed in as a prop,
 * so nothing is read back out of the DOM and no secret can be smuggled here:
 * whatever is copied is what the reader can already see.
 */
export function CopyToClipboard({ text, label }: { readonly text: string; readonly label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded border border-white/15 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-white/30 hover:text-white"
    >
      {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
