// The roles the owner can give an account from the dashboard (spec 0019 AC-7). `admin` is never a
// source or a target: making an admin stays a database and runbook step (spec 0001). Pure.

export const ASSIGNABLE_ROLES = ["customer", "electrician"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/** The role the role card offers to switch to. */
export function otherRole(role: AssignableRole): AssignableRole {
  return role === "customer" ? "electrician" : "customer";
}
