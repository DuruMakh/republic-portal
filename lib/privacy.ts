/**
 * Registration privacy consent (spec docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md).
 * Pure constants: no React, no Next. The version literal is duplicated in the
 * register() migration; lib/privacy.test.ts keeps the two equal.
 */
export const PRIVACY_POLICY_VERSION = "2026-10-v1";

export const PRIVACY_POLICY_PATH = "/privacy";

export const PRIVACY_CONSENT_REQUIRED_MESSAGE = "გასაგრძელებლად მონიშნე თანხმობა.";
