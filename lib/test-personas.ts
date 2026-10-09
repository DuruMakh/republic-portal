/** Preview test sign-in personas (spec 2026-10-08 simpler dev structure 4.3). Pure data. */
export const TEST_PERSONA_IDS = ["admin", "delegate", "member", "visitor"] as const;
export type TestPersona = (typeof TEST_PERSONA_IDS)[number];

export const TEST_PERSONAS: readonly { id: TestPersona; label: string; landing: string }[] = [
  { id: "admin", label: "ადმინი", landing: "/admin" },
  { id: "delegate", label: "დელეგატი", landing: "/me" },
  { id: "member", label: "წევრი", landing: "/me" },
  { id: "visitor", label: "ახალი მომხმარებელი", landing: "/join" },
];
