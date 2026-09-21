/** Registration only. Never apply new requirements to existing-account login. */
export function isValidRegistrationPassword(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[0-9]/.test(password);
}
