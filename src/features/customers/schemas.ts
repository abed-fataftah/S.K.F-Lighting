// The dashboard customer actions' input (spec 0019 API surface), parsed on the server.
import { z } from "zod";
import { profileSchema } from "@/features/accounts/schemas";
import { ASSIGNABLE_ROLES } from "./roles";

/** As long as an email may be (spec 0017), so an email search always fits. */
export const CUSTOMER_SEARCH_MAX = 254;

export const customerSearchSchema = z.object({ text: z.string().max(CUSTOMER_SEARCH_MAX) });

export const profileIdSchema = z.object({ profileId: z.guid() });

const assignableRole = z.enum(ASSIGNABLE_ROLES);

export const changeRoleSchema = z
  .object({ profileId: z.guid(), from: assignableRole, to: assignableRole })
  .refine((input) => input.from !== input.to, { path: ["to"], message: "same_role" });

export type ChangeRoleInput = z.output<typeof changeRoleSchema>;

/** The account form's own name and phone rules (spec 0017), plus the account being edited. */
export const customerDetailsSchema = profileSchema.extend({ profileId: z.guid() });

export type CustomerDetailsInput = z.output<typeof customerDetailsSchema>;
