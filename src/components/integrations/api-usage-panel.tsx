import { Activity, ShieldX, Timer } from "lucide-react";

import type { ApiRequestRecord, ApiUsageSummary } from "@/domain/access/api-usage";
import { requestOutcomeLabel } from "@/domain/access/api-usage";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

interface ApiUsagePanelProps {
  readonly summary: ApiUsageSummary;
  readonly recent: readonly ApiRequestRecord[];
  readonly days: number;
  readonly title: string;
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function formatDay(day: string): string {
  const [, month = "", dayOfMonth = ""] = day.split("-");
  return `${dayOfMonth}/${month}`;
}

function Figure({
  icon,
  label,
  value,
  hint,
  tone = "ink",
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone?: "ink" | "danger";
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
        {icon}
      </span>
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        <p
          className={`numeric mt-0.5 text-xl font-bold tracking-tight ${
            tone === "danger" ? "text-danger" : "text-ink"
          }`}
        >
          {value}
        </p>
        <p className="text-xs text-ink-faint">{hint}</p>
      </div>
    </div>
  );
}

const STATUS_CLASS = (status: number): string => {
  if (status < 300) return "text-ready";
  if (status < 500) return "text-warn";
  return "text-danger";
};

/**
 * Volume, callers and the last requests, for one surface.
 *
 * "Quantas chamadas chegaram e quem fez" is the first question anyone asks
 * about an API in production, and the answer here comes from the request log
 * itself, not from an estimate.
 */
export function ApiUsagePanel({ summary, recent, days, title }: ApiUsagePanelProps) {
  const busiestDay = summary.daily.reduce(
    (highest, day) => Math.max(highest, day.requests),
    0,
  );

  return (
    <>
      <Card>
        <CardHeader
          title={title}
          description={`Requisições registradas nos últimos ${days} dias. Cada linha guarda rota, resultado e quem chamou, nunca o conteúdo.`}
        />

        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Figure
            icon={<Activity aria-hidden className="size-4" />}
            label="Requisições"
            value={String(summary.total)}
            hint={`${summary.authorized} autorizadas`}
          />
          <Figure
            icon={<ShieldX aria-hidden className="size-4" />}
            label="Recusadas"
            value={String(summary.unauthorized + summary.rateLimited)}
            tone={summary.unauthorized + summary.rateLimited > 0 ? "danger" : "ink"}
            hint={`${summary.unauthorized} sem credencial, ${summary.rateLimited} no limite`}
          />
          <Figure
            icon={<Timer aria-hidden className="size-4" />}
            label="Tempo médio"
            value={`${summary.averageMs} ms`}
            hint="do recebimento à resposta"
          />
        </CardBody>

        {summary.daily.length > 0 && (
          <div className="border-t border-border-subtle px-5 py-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
              Por dia
            </p>
            <ul className="mt-3 flex items-end gap-2">
              {summary.daily.map((day) => (
                <li key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="numeric text-xs font-semibold text-ink">{day.requests}</span>
                  <span
                    className="w-full rounded-t bg-brand"
                    style={{
                      height: `${busiestDay === 0 ? 2 : Math.max(2, (day.requests / busiestDay) * 64)}px`,
                    }}
                  />
                  <span className="numeric text-[0.6875rem] text-ink-muted">
                    {formatDay(day.day)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.byRoute.length > 0 && (
          <div className="border-t border-border-subtle">
            <DataTable>
              <TableHead columns={["Rota", "Requisições", "Recusadas", "Média"]} />
              <tbody>
                {summary.byRoute.map((route) => (
                  <TableRow key={`${route.method} ${route.route}`}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      <span className="font-semibold text-ink-muted">{route.method}</span>{" "}
                      {route.route}
                    </TableCell>
                    <TableCell className="numeric">{route.requests}</TableCell>
                    <TableCell className="numeric text-ink-muted">{route.refused}</TableCell>
                    <TableCell className="numeric text-ink-muted">{route.averageMs} ms</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}

        {summary.byCaller.length > 0 && (
          <div className="border-t border-border-subtle">
            <DataTable>
              <TableHead columns={["Quem chamou", "Requisições", "Última chamada"]} />
              <tbody>
                {summary.byCaller.map((caller) => (
                  <TableRow key={`${caller.kind}-${caller.label}`}>
                    <TableCell>
                      {caller.label}
                      <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-[0.6875rem] text-ink-muted">
                        {caller.kind === "OAUTH"
                          ? "autorização"
                          : caller.kind === "API_KEY"
                            ? "chave"
                            : "sem credencial"}
                      </span>
                    </TableCell>
                    <TableCell className="numeric">{caller.requests}</TableCell>
                    <TableCell className="numeric whitespace-nowrap text-ink-muted">
                      {formatTime(caller.lastAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}

        {summary.total === 0 && (
          <EmptyState
            title="Nenhuma chamada registrada"
            description="Assim que um integrador ou um agente chamar, o volume aparece aqui."
          />
        )}
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader
            title="Últimas chamadas"
            description="Ordem de chegada, da mais recente para a mais antiga."
          />
          <DataTable>
            <TableHead
              columns={["Quando", "Rota", "Status", "Resultado", "Quem chamou", "Tempo"]}
            />
            <tbody>
              {recent.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="numeric whitespace-nowrap text-ink-muted">
                    {formatTime(record.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    <span className="font-semibold text-ink-muted">{record.method}</span>{" "}
                    {record.route}
                  </TableCell>
                  <TableCell className={`numeric font-semibold ${STATUS_CLASS(record.status)}`}>
                    {record.status}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-muted">
                    {requestOutcomeLabel(record.outcome)}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {record.caller.label}
                    {record.caller.onBehalfOf !== null && (
                      <span className="block text-xs text-ink-faint">
                        em nome de {record.caller.onBehalfOf}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="numeric whitespace-nowrap text-ink-muted">
                    {record.durationMs} ms
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </DataTable>
        </Card>
      )}
    </>
  );
}
