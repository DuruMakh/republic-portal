import type { PhoneVerificationFailureCode } from "./contracts";

/** A provider failure already mapped to the code the user sees; carries no number or code. */
export class PhoneVerificationProviderError extends Error {
  constructor(readonly code: PhoneVerificationFailureCode) {
    super(code);
    this.name = "PhoneVerificationProviderError";
  }
}
