import { pgEnum } from "drizzle-orm/pg-core";

import {
  INVITATION_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} from "@/domain/access/access.types";
import { API_SURFACES } from "@/domain/access/api-credential";
import { TOKEN_KINDS } from "@/domain/access/oauth";
import { REQUEST_OUTCOMES } from "@/domain/access/api-usage";
import { RULE_SET_STATUSES } from "@/domain/conventions/rule-set-status";
import { AUDIT_ACTIONS } from "@/domain/access/audit";
import { IMPORT_SOURCES } from "@/application/ports/import-repository.port";
import { GUIDE_STATUSES } from "@/domain/guides/guide-status";

/**
 * Database enums mirror the domain unions. Keeping them in one file makes the
 * compiler complain here - and only here - when a union gains a member, instead
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

export const importSourceEnum = pgEnum("import_source", IMPORT_SOURCES);

export const clinicUnitEnum = pgEnum("clinic_unit", ["Centro", "Norte", "Sul"]);

export const userRoleEnum = pgEnum("user_role", USER_ROLES);

export const userStatusEnum = pgEnum("user_status", USER_STATUSES);

export const invitationStatusEnum = pgEnum("invitation_status", INVITATION_STATUSES);

export const auditActionEnum = pgEnum("audit_action", AUDIT_ACTIONS);

export const apiSurfaceEnum = pgEnum("api_surface", API_SURFACES);

export const tokenKindEnum = pgEnum("oauth_token_kind", TOKEN_KINDS);

export const requestOutcomeEnum = pgEnum("request_outcome", REQUEST_OUTCOMES);

export const ruleSetStatusEnum = pgEnum("rule_set_status", RULE_SET_STATUSES);
