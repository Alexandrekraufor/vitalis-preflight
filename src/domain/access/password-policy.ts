/**
 * Minimum password requirements, enforced on the server whenever a password is
 * set. Length does most of the work; composition rules mostly push people to
 * predictable substitutions, so the floor is high and the rules are few.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

export type PasswordRejection = "TOO_SHORT" | "TOO_LONG" | "TOO_COMMON";

/** A short deny-list of passwords that clear the length floor but are guessed first. */
const OBVIOUS_PASSWORDS: ReadonlySet<string> = new Set([
  "senha123456",
  "123456789012",
  "vitalispreflight",
  "administrador",
  "clinicavitalis",
  "password1234",
  "qwertyuiop12",
]);

export function checkPassword(password: string): PasswordRejection | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "TOO_SHORT";
  if (password.length > MAX_PASSWORD_LENGTH) return "TOO_LONG";

  const comparable = password.trim().toLowerCase().replace(/\s+/g, "");
  if (OBVIOUS_PASSWORDS.has(comparable)) return "TOO_COMMON";

  return null;
}

const MESSAGES: Readonly<Record<PasswordRejection, string>> = {
  TOO_SHORT: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  TOO_LONG: `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`,
  TOO_COMMON: "Escolha uma senha menos previsível.",
};

export function passwordRejectionMessage(rejection: PasswordRejection): string {
  return MESSAGES[rejection];
}
