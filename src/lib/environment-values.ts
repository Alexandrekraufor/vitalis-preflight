/**
 * A variable that is present but empty means the same as one that is absent.
 *
 * The deployment stack lists every optional variable so whoever is deploying
 * can see what exists and paste a value in front of the `=`. Leaving one blank
 * has to read as "not configured", otherwise a stack that is merely incomplete
 * refuses to boot over an empty string that nobody typed on purpose.
 *
 * Kept apart from `env.ts` because that module imports `server-only`: this is
 * plain data handling, and it is worth testing directly.
 */
export function withoutBlankValues(
  source: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const entries: [string, string][] = [];

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (value.trim() === "") continue;
    entries.push([key, value]);
  }

  return Object.fromEntries(entries);
}
