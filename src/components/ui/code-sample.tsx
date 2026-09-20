import { CopyToClipboard } from "./copy-to-clipboard";

interface CodeSampleProps {
  readonly caption?: string;
  readonly language?: string;
  readonly code: string;
}

/** A read-only snippet with a copy affordance. No highlighting, no execution. */
export function CodeSample({ caption, language = "bash", code }: CodeSampleProps) {
  return (
    <figure className="overflow-hidden rounded-md border border-[#132a38] bg-[#0B1F2A]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-slate-400">
          {caption ?? language}
        </span>
        <CopyToClipboard text={code} label={`Copiar ${caption ?? language}`} />
      </figcaption>
      <pre className="overflow-x-auto px-3 py-3 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
