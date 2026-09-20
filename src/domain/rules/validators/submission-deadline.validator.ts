import { daysBetween, formatBrazilianDate } from "@/lib/dates";

import type { Finding } from "../finding";
import type { Validator } from "../rules.types";

/**
 * `prazo_envio_dias` counts from the appointment to the day the guide reaches
 * the convention. `data_lancamento` records the entry in the clinic's own
 * system, which is not the same event, so this rule only runs when a real
 * submission date is supplied (see `docs/assumptions.md`).
 */
export const validateSubmissionDeadline: Validator = ({
  guide,
  convention,
  supplementary,
}) => {
  const submittedAt = supplementary.submittedToConventionAt;
  if (convention === null || submittedAt === null) return [];

  const elapsedDays = daysBetween(guide.appointmentDate, submittedAt);
  if (elapsedDays <= convention.submissionDeadlineDays) return [];

  const finding: Finding = {
    code: "SUBMISSION_DEADLINE_EXCEEDED",
    severity: "BLOCKING",
    field: "data_lancamento",
    message: `A guia foi enviada em ${formatBrazilianDate(submittedAt)}, ${elapsedDays} dias após o atendimento; ${convention.name} aceita até ${convention.submissionDeadlineDays} dias.`,
    expected: `Envio em até ${convention.submissionDeadlineDays} dias`,
    actual: `${elapsedDays} dias`,
    source: "CONVENTION_RULE",
    evidence: null,
    recommendedAction: "Tratar como envio fora do prazo junto ao convênio.",
  };

  return [finding];
};
