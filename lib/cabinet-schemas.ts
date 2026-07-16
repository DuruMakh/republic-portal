import { z } from "zod";
import {
  cityIdSchema,
  delegateIdSchema,
  employmentSchema,
  nameSchema,
  regionIdSchema,
} from "./funnel-schemas";

/**
 * Cabinet profile edit (spec §3.3): exactly the five re-granted columns.
 * Region+city are always submitted together — the composite FK enforces the
 * pairing in-DB whenever both are set (ADR-009 note).
 */
export const profileUpdateSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  regionId: regionIdSchema,
  cityId: cityIdSchema,
  employment: employmentSchema,
});

/** Change delegate (spec §4.2): null = ცენტრალური მოძრაობა. */
export const changeDelegateSchema = z.object({
  delegateId: delegateIdSchema,
});
