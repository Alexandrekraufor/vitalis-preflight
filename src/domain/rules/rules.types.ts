import type { Convention, Procedure, RuleSet } from "@/domain/conventions/convention.types";
import type { NormalizedGuide } from "@/domain/guides/guide.types";
import type { IsoDate } from "@/lib/dates";

import type { Finding } from "./finding";

/**
 * Facts the clinic's export does not carry today, but that two convention rules
 * need (see `docs/assumptions.md`). Validators that depend on them stay silent
 * while the value is `null`, so enabling those rules later is a wiring change,
 * not a rewrite.
 */
export interface SupplementaryGuideData {
  /** Day the convention issued the authorization. */
  readonly authorizationIssuedAt: IsoDate | null;
  /** Day the guide actually reached the convention. */
  readonly submittedToConventionAt: IsoDate | null;
}

export const NO_SUPPLEMENTARY_DATA: SupplementaryGuideData = {
  authorizationIssuedAt: null,
  submittedToConventionAt: null,
};

export interface RuleContext {
  readonly guide: NormalizedGuide;
  readonly ruleSet: RuleSet;
  /** `null` when the convention on the guide is not in the rule set. */
  readonly convention: Convention | null;
  /** `null` when the procedure code is not in the reference table. */
  readonly procedure: Procedure | null;
  readonly supplementary: SupplementaryGuideData;
}

export type Validator = (context: RuleContext) => readonly Finding[];

/**
 * A rule that is modelled but cannot run yet, surfaced to the UI and to the
 * docs so its absence is explicit rather than forgotten.
 */
export interface DeferredRule {
  readonly id: string;
  readonly title: string;
  readonly missingData: string;
  readonly consequence: string;
}

export const DEFERRED_RULES: readonly DeferredRule[] = [
  {
    id: "authorization-validity-window",
    title: "Validade máxima da autorização (validade_maxima_autorizacao_dias)",
    missingData: "Data de emissão da autorização.",
    consequence:
      "A janela máxima de validade não é verificada; só o vencimento em si é checado.",
  },
  {
    id: "submission-deadline",
    title: "Prazo de envio ao convênio (prazo_envio_dias)",
    missingData: "Data de envio da guia ao convênio.",
    consequence:
      "data_lancamento é o lançamento no sistema da clínica e não é tratado como envio.",
  },
];
