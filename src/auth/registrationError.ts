type RegistrationMessages = {
  registrationEmailInUse: string;
  registrationInvalidEmail: string;
  registrationNetworkError: string;
  registrationTooManyRequests: string;
  registerValidation: string;
  registerFailedFallback: string;
};

// Only display approved copy; provider messages may contain internal details.
export function registrationErrorMessage(error: unknown, t: RegistrationMessages, consentRequired: string): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  switch (code) {
    case "auth/email-already-in-use": return t.registrationEmailInUse;
    case "auth/invalid-email": return t.registrationInvalidEmail;
    case "auth/network-request-failed": return t.registrationNetworkError;
    case "auth/too-many-requests": return t.registrationTooManyRequests;
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements": return t.registerValidation;
    case "privacy/consent-required": return consentRequired;
    default: return t.registerFailedFallback;
  }
}
