/**
 * Shared email validation utility.
 *
 * Uses a intentionally lenient regex that accepts the vast majority of real
 * addresses while rejecting obvious non-emails (missing @, missing TLD, etc.).
 * Full RFC 5322 validation is deliberately avoided — it rejects common valid
 * addresses and adds complexity without meaningful security benefit.
 *
 * @example
 * isValidEmail('user@example.com') // true
 * isValidEmail('not-an-email')     // false
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns true if `email` passes basic format validation. */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
