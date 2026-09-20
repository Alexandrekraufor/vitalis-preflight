import type { IsoDate } from "@/lib/dates";
import type { Money } from "@/lib/money";

export const CLINIC_UNITS = ["Centro", "Norte", "Sul"] as const;

export type ClinicUnit = (typeof CLINIC_UNITS)[number];

/**
 * A guide after syntactic normalization and structural parsing, before any
 * business rule has run.
 *
 * Fields the clinic's own export can legitimately leave empty are nullable
 * here: whether an empty CID is a problem depends on the convention, and that
 * is a rule-engine decision, not a parsing one. Only what is meaningless when
 * absent — the identifier, the unit, the appointment date, the convention and
 * the procedure code — is required.
 */
export interface NormalizedGuide {
  readonly idGuia: string;
  readonly unit: ClinicUnit;
  readonly appointmentDate: IsoDate;
  readonly patient: string;
  readonly conventionName: string;
  readonly membershipNumber: string | null;
  readonly cid: string | null;
  readonly procedureCode: string;
  readonly procedureDescription: string | null;
  readonly authorizationNumber: string | null;
  /** Last day the authorization covers. Inclusive. */
  readonly authorizationValidThrough: IsoDate | null;
  readonly authorizationSessionLimit: number | null;
  readonly sessionNumber: number | null;
  readonly professional: string | null;
  readonly professionalRegistration: string | null;
  readonly amount: Money | null;
  readonly receptionNote: string | null;
  /** Day the reception keyed the guide into the clinic's system. */
  readonly enteredAt: IsoDate | null;
}
