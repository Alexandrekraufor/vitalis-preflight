import { Card, CardBody, CardHeader } from "@/components/ui/card";

/**
 * The narrative explanation. Every sentence here is a stored finding message -
 * nothing is generated at render time, so what the screen says is exactly what
 * the engine decided, even months later.
 */
export function WhyItFell({ reasons }: { readonly reasons: readonly string[] }) {
  if (reasons.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Por que essa guia caiu?"
        description="Explicação montada a partir dos problemas registrados na validação."
      />
      <CardBody>
        <ul className="flex flex-col gap-2.5">
          {reasons.map((reason) => (
            <li key={reason} className="flex gap-2.5 text-sm leading-relaxed text-ink">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
              {reason}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
