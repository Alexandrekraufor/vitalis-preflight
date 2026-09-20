import type { Validator } from "../rules.types";

import { validateAuthorizationExpiration } from "./authorization-expiration.validator";
import { validateAuthorizationValidityWindow } from "./authorization-validity-window.validator";
import { validateKnownConvention } from "./known-convention.validator";
import { validateProcedureCoverage } from "./procedure-coverage.validator";
import { validateProcedureDescription } from "./procedure-description.validator";
import { validateReferenceValue } from "./reference-value.validator";
import { validateRequiredFields } from "./required-fields.validator";
import { validateSessionLimits } from "./session-limits.validator";
import { validateSubmissionDeadline } from "./submission-deadline.validator";

/**
 * Execution order is presentation order: the findings list reads top-down from
 * "we don't know this convention" to "this cent is off".
 */
export const DETERMINISTIC_VALIDATORS: readonly Validator[] = [
  validateKnownConvention,
  validateRequiredFields,
  validateAuthorizationExpiration,
  validateAuthorizationValidityWindow,
  validateSessionLimits,
  validateProcedureCoverage,
  validateProcedureDescription,
  validateReferenceValue,
  validateSubmissionDeadline,
];
