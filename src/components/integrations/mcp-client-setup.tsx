"use client";

import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CodeSample } from "@/components/ui/code-sample";

interface McpClientSetupProps {
  /** Absolute URL of the MCP endpoint, as a client must receive it. */
  readonly endpoint: string;
  readonly reachablePublicly: boolean;
}

interface ClientRecipe {
  readonly key: string;
  readonly name: string;
  readonly note: string;
  readonly caption: string;
  readonly language: string;
  readonly snippet: (endpoint: string) => string;
}

/**
 * The same URL, spelled the way each tool expects it.
 *
 * Nothing here is specific to one vendor: this is one standard MCP endpoint
 * over Streamable HTTP with OAuth. The list exists because people look for
 * their own tool's name before they trust that a generic instruction applies
 * to them - and it shows one recipe at a time, because six stacked code blocks
 * are five blocks of noise for any given reader.
 */
const RECIPES: readonly ClientRecipe[] = [
  {
    key: "claude-code",
    name: "Claude Code",
    note: "Um comando no terminal. A autorização abre no navegador na primeira chamada.",
    caption: "terminal",
    language: "bash",
    snippet: (endpoint) => `claude mcp add --transport http vitalis ${endpoint}`,
  },
  {
    key: "claude",
    name: "Claude",
    note: "No aplicativo ou na web: Configurações, Conectores, adicionar conector personalizado, e colar a URL.",
    caption: "url",
    language: "bash",
    snippet: (endpoint) => endpoint,
  },
  {
    key: "chatgpt",
    name: "ChatGPT",
    note: "Configurações, Conectores, adicionar um servidor MCP remoto. Exige URL pública em https.",
    caption: "url",
    language: "bash",
    snippet: (endpoint) => endpoint,
  },
  {
    key: "cursor",
    name: "Cursor",
    note: "Arquivo ~/.cursor/mcp.json, ou o mcp.json do projeto.",
    caption: "mcp.json",
    language: "json",
    snippet: (endpoint) => JSON.stringify({ mcpServers: { vitalis: { url: endpoint } } }, null, 2),
  },
  {
    key: "windsurf",
    name: "Windsurf",
    note: "Arquivo ~/.codeium/windsurf/mcp_config.json.",
    caption: "mcp_config.json",
    language: "json",
    snippet: (endpoint) =>
      JSON.stringify({ mcpServers: { vitalis: { serverUrl: endpoint } } }, null, 2),
  },
  {
    key: "outros",
    name: "Antigravity, Grok e outros",
    note: "Qualquer cliente que fale MCP remoto aceita a mesma declaração de servidor HTTP.",
    caption: "configuração genérica",
    language: "json",
    snippet: (endpoint) =>
      JSON.stringify({ mcpServers: { vitalis: { type: "http", url: endpoint } } }, null, 2),
  },
];

const FIRST_RECIPE = RECIPES[0] as ClientRecipe;

export function McpClientSetup({ endpoint, reachablePublicly }: McpClientSetupProps) {
  const [selectedKey, setSelectedKey] = useState(FIRST_RECIPE.key);
  const recipe = RECIPES.find((candidate) => candidate.key === selectedKey) ?? FIRST_RECIPE;

  return (
    <Card>
      <CardHeader
        title="Configuração por cliente"
        description="A mesma URL em todos. Nenhum deles precisa de chave: a autorização é pelo fluxo OAuth."
      />

      {!reachablePublicly && (
        <CardBody className="border-b border-border-subtle">
          <p className="rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm leading-relaxed text-ink">
            Esta instância responde em <code className="font-mono text-xs">{endpoint}</code>, que
            só existe nesta máquina. Clientes locais como Claude Code, Cursor e Windsurf conectam
            normalmente; clientes que rodam na nuvem, como o ChatGPT, precisam de uma URL pública.
          </p>
        </CardBody>
      )}

      <CardBody className="flex flex-col gap-4">
        <div role="tablist" aria-label="Cliente de IA" className="flex flex-wrap gap-1.5">
          {RECIPES.map((candidate) => {
            const selected = candidate.key === recipe.key;

            return (
              <button
                key={candidate.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedKey(candidate.key)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  selected
                    ? "bg-brand font-semibold text-white"
                    : "border border-border-subtle text-ink-muted hover:border-border-strong hover:text-ink"
                }`}
              >
                {candidate.name}
              </button>
            );
          })}
        </div>

        <p className="text-sm leading-relaxed text-ink-muted">{recipe.note}</p>

        <CodeSample
          caption={recipe.caption}
          language={recipe.language}
          code={recipe.snippet(endpoint)}
        />
      </CardBody>
    </Card>
  );
}
