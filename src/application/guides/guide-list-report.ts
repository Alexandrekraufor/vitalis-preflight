import { z } from "zod";

import { GUIDE_STATUSES } from "@/domain/guides/guide-status";
import { CLINIC_UNITS } from "@/domain/guides/guide.types";
import { toDecimalString } from "@/lib/money";

import type { GuideListItem } from "../ports/guide-repository.port";

/**
 * Public shape of a guide in a list. Shared by `GET /api/v1/guides` and the MCP
 * summary tool so both speak the same language about the same row.
 */
export const guideListEntrySchema = z.object({
  idGuia: z.string(),
  unit: z.enum(CLINIC_UNITS),
  convention: z.string(),
  patient: z.string(),
  procedureCode: z.string(),
  procedureDescription: z.string().nullable(),
  appointmentDate: z.string(),
  amount: z.number().nullable(),
  status: z.enum(GUIDE_STATUSES),
  amountAtRisk: z.number(),
  primaryFindingCode: z.string().nullable(),
  primaryFinding: z.string().nullable(),
  validatedAt: z.string(),
});

export type GuideListEntry = z.infer<typeof guideListEntrySchema>;

export function toGuideListEntry(item: GuideListItem): GuideListEntry {
  return {
    idGuia: item.idGuia,
    unit: item.unit,
    convention: item.conventionName,
    patient: item.patient,
    procedureCode: item.procedureCode,
    procedureDescription: item.procedureDescription,
    appointmentDate: item.appointmentDate,
    amount: item.amount === null ? null : Number(toDecimalString(item.amount)),
    status: item.status,
    amountAtRisk: Number(toDecimalString(item.amountAtRisk)),
    primaryFindingCode: item.primaryFindingCode,
    primaryFinding: item.primaryFindingMessage,
    validatedAt: item.validatedAt.toISOString(),
  };
}
