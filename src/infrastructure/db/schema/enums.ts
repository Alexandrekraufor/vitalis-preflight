import { pgEnum } from "drizzle-orm/pg-core";

import {
  INVITATION_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} from "@/domain/access/access.types";
import { AUDIT_ACTIONS } from "@/domain/access/audit";
import { GUIDE_STATUSES } from "@/domain/guides/guide-status";

/**
 * Database enums mirror the domain unions. Keeping them in one file makes the
 * compiler complain here — and only here — when a union gains a member, instead
 * of letting a new value fail at insert time.
 */
export const guideDecisionEnum = pgEnum("guide_decision", GUIDE_STATUSES);

export const findingSeverityEnum = pgEnum("finding_severity", [
  "BLOCKING",
  "REVIEW",
  "INFO",
]);

export const findingSourceEnum = pgEnum("finding_source", [
  "CONVENTION_RULE",
  "REFERENCE_TABLE",
  "RECEPTION_NOTE",
]);

export const importSourceEnum = pgEnum("import_source", ["CSV", "API", "SEED"]);

export const clinicUnitEnum = pgEnum("clinic_unit", ["Centro", "Norte", "Sul"]);

export const userRoleEnum = pgEnum("user_role", USER_ROLES);

export const userStatusEnum = pgEnum("user_status", USER_STATUSES);

export const invitationStatusEnum = pgEnum("invitation_status", INVITATION_STATUSES);

export const auditActionEnum = pgEnum("audit_action", AUDIT_ACTIONS);
