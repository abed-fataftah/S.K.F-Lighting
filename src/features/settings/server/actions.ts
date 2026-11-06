"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import {
  addZoneSchema,
  savePolicySchema,
  saveZoneSchema,
  setZoneActiveSchema,
  shopContactSchema,
} from "../schemas";
import {
  addZoneInDb,
  saveShopContactInDb,
  savePolicyInDb,
  saveZoneInDb,
  setZoneActiveInDb,
  type SettingsContact,
  type SettingsZone,
  type ZoneOutcome,
} from "./settings-db";

// The settings hub's actions (spec 0025, API surface). Each runs `requireAdmin()` first, which
// checks the session with Supabase Auth (`getVerifiedUser()`), before anything is read or written.
// The storefront renders per request, so only the dashboard pages are refreshed. Logs carry ids
// and outcomes, never typed values.

const log = (event: string, fields: Readonly<Record<string, unknown>> = {}) =>
  console.info(JSON.stringify({ event, ...fields }));

const logError = (event: string, error: unknown, fields: Readonly<Record<string, unknown>> = {}) =>
  console.error(
    JSON.stringify({ event, error: error instanceof Error ? error.name : "unknown", ...fields }),
  );

type Invalid = Fail<"invalid", { readonly fieldErrors: FieldErrors }>;

const invalid = (fieldErrors: FieldErrors): Invalid => ({
  ok: false,
  error: "invalid",
  fieldErrors,
});

export type SaveShopContactResult = Ok<SettingsContact> | Invalid | Fail<"forbidden" | "failed">;

/** WhatsApp number, phone, and address (AC-2); the next storefront load uses them (AC-3). */
export async function saveShopContact(input: unknown): Promise<SaveShopContactResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = shopContactSchema.safeParse(input);
  if (!parsed.success) return invalid(fieldErrorsOf(parsed.error));

  try {
    const contact = await saveShopContactInDb(await getDb(), parsed.data);
    log("shop_contact_saved");
    revalidatePath(routes.admin.settings);
    return ok(contact);
  } catch (error) {
    logError("shop_contact_save_failed", error);
    return fail("failed");
  }
}

export type ZoneResult =
  | Ok<SettingsZone>
  | Invalid
  | Fail<"forbidden" | "not_found" | "name_taken" | "zone_limit" | "failed">;

async function runZoneWrite(
  event: string,
  zoneId: string | null,
  write: () => Promise<ZoneOutcome>,
): Promise<ZoneResult> {
  let outcome: ZoneOutcome;
  try {
    outcome = await write();
  } catch (error) {
    logError(`${event}_failed`, error, { zoneId });
    return fail("failed");
  }
  if (outcome.kind !== "saved") {
    log(`${event}_refused`, { zoneId, reason: outcome.kind });
    return fail(outcome.kind);
  }
  log(event, { zoneId: outcome.zone.id });
  revalidatePath(routes.admin.settings);
  return ok(outcome.zone);
}

/** One zone's name, short name, and fee (AC-5); checkout and Home follow on their next load (AC-7). */
export async function saveZone(input: unknown): Promise<ZoneResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = saveZoneSchema.safeParse(input);
  if (!parsed.success) return invalid(fieldErrorsOf(parsed.error));
  const db = await getDb();
  return runZoneWrite("zone_saved", parsed.data.id, () => saveZoneInDb(db, parsed.data));
}

/** A new active zone at the end of the list, refused at 10 zones (AC-6). */
export async function addZone(input: unknown): Promise<ZoneResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = addZoneSchema.safeParse(input);
  if (!parsed.success) return invalid(fieldErrorsOf(parsed.error));
  const db = await getDb();
  return runZoneWrite("zone_added", null, () => addZoneInDb(db, parsed.data));
}

/** Pause or resume a zone straight away; zones are never deleted (AC-6). */
export async function setZoneActive(input: unknown): Promise<ZoneResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = setZoneActiveSchema.safeParse(input);
  if (!parsed.success) return invalid(fieldErrorsOf(parsed.error));
  const { id, isActive } = parsed.data;
  const db = await getDb();
  return runZoneWrite(isActive ? "zone_resumed" : "zone_paused", id, () =>
    setZoneActiveInDb(db, id, isActive),
  );
}

export type SavePolicyResult =
  | Ok<{ readonly version: number; readonly updatedAt: Date }>
  | Invalid
  | Fail<"forbidden" | "not_found" | "stale" | "failed">;

/** One policy page, only over the version the editor loaded (AC-10, AC-11). */
export async function savePolicyPage(input: unknown): Promise<SavePolicyResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = savePolicySchema.safeParse(input);
  if (!parsed.success) return invalid(fieldErrorsOf(parsed.error));
  const { slug } = parsed.data;

  let outcome: Awaited<ReturnType<typeof savePolicyInDb>>;
  try {
    outcome = await savePolicyInDb(await getDb(), parsed.data);
  } catch (error) {
    logError("policy_save_failed", error, { slug });
    return fail("failed");
  }
  if (outcome.kind !== "saved") {
    log("policy_save_refused", { slug, reason: outcome.kind });
    return fail(outcome.kind);
  }
  log("policy_saved", { slug, version: outcome.version });
  revalidatePath(routes.admin.settings);
  revalidatePath(routes.admin.policy(slug));
  return ok({ version: outcome.version, updatedAt: outcome.updatedAt });
}
