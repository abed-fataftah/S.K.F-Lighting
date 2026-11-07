"use server";

import { revalidatePath } from "next/cache";
import { reportError } from "@/server/monitoring/report";
import { redirect } from "next/navigation";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { deleteAuthUser } from "@/server/auth/supabase-admin";
import { getDb } from "@/server/db";
import type { DetailField } from "../account-rules";
import type { AssignableRole } from "../roles";
import {
  changeRoleSchema,
  customerDetailsSchema,
  customerSearchSchema,
  profileIdSchema,
} from "../schemas";
import { classifyCustomerSearch } from "../search";
import {
  changeCustomerRoleInDb,
  readRemovalState,
  startCustomerRemovalInDb,
  updateCustomerDetailsInDb,
  type AccountWriteError,
  type RemovalStartError,
} from "./account-writes";
import { readCustomerSearch, type AdminCustomerRow } from "./admin-queries";

// The dashboard's customer actions (spec 0019 API surface). Each runs `requireAdmin()` first, which
// checks the session with Supabase Auth, before anything is parsed, read, or written (AC-1). Each
// logs one line with an event name and codes only (AC-15): never a name, phone, email, or the
// search text. A database error returns `failed`; every write is one transaction (AC-16).

type RefusedAction = "search" | "role" | "details" | "remove" | "finish";

const log = (event: string, fields: Readonly<Record<string, unknown>> = {}) =>
  console.info(JSON.stringify({ event, ...fields }));

function refused<E extends string>(action: RefusedAction, error: E): Fail<E> {
  console.warn(JSON.stringify({ event: "admin_customer_refused", action, code: error }));
  return fail(error);
}

const refresh = (profileId: string) => {
  revalidatePath(routes.admin.customers);
  revalidatePath(routes.admin.customer(profileId));
};

/** Runs a database step; an unexpected error is `failed` rather than a 500. */
async function orFailed<T>(run: () => Promise<T>): Promise<T | Fail<"failed">> {
  try {
    return await run();
  } catch (error) {
    await reportError("admin_customer_db_error", error);
    return fail("failed");
  }
}

export type SearchAdminCustomersResult =
  | Ok<{ readonly rows: readonly AdminCustomerRow[]; readonly capped: boolean }>
  | Fail<"forbidden" | "invalid" | "failed">;

/** The customers search (AC-3), by POST so the text stays out of every URL and log. */
export async function searchAdminCustomers(input: unknown): Promise<SearchAdminCustomersResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return refused("search", "forbidden");
  const parsed = customerSearchSchema.safeParse(input);
  if (!parsed.success) return refused("search", "invalid");

  const search = classifyCustomerSearch(parsed.data.text);
  log("admin_customer_search", { kind: search.kind });
  if (search.kind === "invalid") return refused("search", "invalid");
  const result = await orFailed(async () => ok(await readCustomerSearch(await getDb(), search)));
  return result.ok ? result : refused("search", result.error);
}

export type ChangeCustomerRoleResult =
  | Ok<{ readonly role: AssignableRole }>
  | Fail<"forbidden" | "invalid" | AccountWriteError | "stale" | "failed">;

/** Switch an account between customer and electrician (AC-7). */
export async function changeCustomerRole(input: unknown): Promise<ChangeCustomerRoleResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return refused("role", "forbidden");
  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return refused("role", "invalid");

  const result = await orFailed(async () =>
    changeCustomerRoleInDb(await getDb(), admin.data.userId, parsed.data),
  );
  if (!result.ok) return refused("role", result.error);
  refresh(parsed.data.profileId);
  log("admin_customer_role_changed", { to: result.data.role });
  return result;
}

export type UpdateCustomerDetailsResult =
  | Ok<{ readonly changed: readonly DetailField[] }>
  | Fail<"invalid", { readonly fieldErrors: FieldErrors }>
  | Fail<"forbidden" | AccountWriteError | "failed">;

/** Fix a customer's name and phone (AC-10); no change writes and logs nothing new. */
export async function updateCustomerDetails(input: unknown): Promise<UpdateCustomerDetailsResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return refused("details", "forbidden");
  const parsed = customerDetailsSchema.safeParse(input);
  if (!parsed.success) {
    refused("details", "invalid");
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await orFailed(async () =>
    updateCustomerDetailsInDb(await getDb(), admin.data.userId, parsed.data),
  );
  if (!result.ok) return refused("details", result.error);
  if (result.data.changed.length > 0) {
    refresh(parsed.data.profileId);
    log("admin_customer_details_edited", { fields: result.data.changed });
  }
  return result;
}

export type RemoveCustomerResult = Fail<
  "forbidden" | "invalid" | RemovalStartError | "removal_unfinished" | "failed"
>;

/** Step 2 (AC-11): delete the login; on success the list shows the notice. */
async function deleteLogin(profileId: string): Promise<Fail<"removal_unfinished">> {
  const deleted = await deleteAuthUser(profileId);
  refresh(profileId);
  if (!deleted.ok) {
    log("admin_customer_removal_failed", { code: deleted.code });
    return fail("removal_unfinished");
  }
  log("admin_customer_removed");
  redirect(routes.admin.customersWith({ notice: "removed" }));
}

/** Remove an account (AC-11): step 1 in the database, then the login through Supabase Auth. */
export async function removeCustomer(input: unknown): Promise<RemoveCustomerResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return refused("remove", "forbidden");
  const parsed = profileIdSchema.safeParse(input);
  if (!parsed.success) return refused("remove", "invalid");

  const { profileId } = parsed.data;
  const started = await orFailed(async () =>
    startCustomerRemovalInDb(await getDb(), admin.data.userId, profileId),
  );
  if (!started.ok) return refused("remove", started.error);
  return deleteLogin(profileId);
}

export type FinishCustomerRemovalResult = Fail<
  "forbidden" | "invalid" | "not_found" | "removal_unfinished" | "failed"
>;

/** "إكمال الحذف" (AC-12): step 2 again; a profile already gone is a success. */
export async function finishCustomerRemoval(input: unknown): Promise<FinishCustomerRemovalResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return refused("finish", "forbidden");
  const parsed = profileIdSchema.safeParse(input);
  if (!parsed.success) return refused("finish", "invalid");

  const { profileId } = parsed.data;
  const state = await orFailed(async () => ok(await readRemovalState(await getDb(), profileId)));
  if (!state.ok) return refused("finish", state.error);
  if (state.data === "gone") {
    refresh(profileId);
    redirect(routes.admin.customersWith({ notice: "removed" }));
  }
  if (state.data !== "pending") return refused("finish", "not_found");
  return deleteLogin(profileId);
}
