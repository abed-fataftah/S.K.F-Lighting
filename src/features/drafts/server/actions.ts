"use server";

import { redirect } from "next/navigation";
import { reportError } from "@/server/monitoring/report";
import type { z } from "zod";
import { getAccountProfile } from "@/features/accounts/server/profile";
import { rememberPlacedOrder } from "@/features/checkout/server/placed";
import { orderRateCheck } from "@/features/checkout/server/rate-limit";
import type { FieldErrors } from "@/lib/form-errors";
import { fail, ok, type Fail, type Result } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getVerifiedUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { canUseDrafts } from "../access";
import type { DraftLineView, LineProblem } from "../draft-view";
import {
  addToDraftNameProblem,
  addToDraftSchema,
  createDraftSchema,
  draftCustomerSchema,
  draftIdSchema,
  draftNameProblem,
  draftPickerSchema,
  lineIdSchema,
  renameDraftSchema,
  restoreDraftLineSchema,
  sendDraftSchema,
  updateDraftLineSchema,
  type DraftNameProblem,
} from "../schemas";
import { addToDraftInDb, readDraftPickerData, type DraftPickerData } from "./add-from-catalog";
import {
  createDraftInDb,
  deleteDraftInDb,
  renameDraftInDb,
  saveDraftCustomerInDb,
} from "./drafts-db";
import {
  addDraftLineInDb,
  removeDraftLineInDb,
  restoreDraftLineInDb,
  updateDraftLineInDb,
  type LineOutcome,
} from "./lines-db";
import { sendDraftInDb } from "./send";

// The draft Server Actions (spec 0020 API surface). Each checks the electrician role itself first
// (AC-1), parses its input with the shared schema, and returns a typed result; a database failure
// is `save_failed`, so the page can show it and offer a retry. Logs carry event and error names
// only, never a draft name, a customer field, or a person's id (AC-19).

/** The signed in electrician's id, or null: signed out, no profile, another role, or removal pending. */
async function electricianId(): Promise<string | null> {
  const account = await getAccountProfile();
  return account && canUseDrafts(account.profile) ? account.userId : null;
}

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.info(JSON.stringify({ event, ...data }));

function refused<E extends string>(error: E, fields?: readonly string[]): Fail<E> {
  console.warn(JSON.stringify({ event: "draft_refused", error, ...(fields ? { fields } : {}) }));
  return fail(error);
}

async function saveFailed(action: string, error: unknown): Promise<Fail<"save_failed">> {
  await reportError("draft_save_failed", error, { action });
  return fail("save_failed");
}

type NameError = "forbidden" | "invalid" | "name_taken" | "too_many_drafts" | "save_failed";
type NameResult<T> = Result<T, NameError, { readonly problem?: DraftNameProblem }>;

function invalidName(error: z.ZodError): Fail<"invalid", { readonly problem: DraftNameProblem }> {
  return { ...refused("invalid", ["name"]), problem: draftNameProblem(error) };
}

/** AC-4: a named draft with one empty line. */
export async function createDraft(input: {
  name: string;
}): Promise<NameResult<{ draftId: string }>> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) return invalidName(parsed.error);
  try {
    const outcome = await createDraftInDb(await getDb(), userId, parsed.data.name);
    if (outcome.kind !== "created") return refused(outcome.kind);
    log("draft_created");
    return ok({ draftId: outcome.draftId });
  } catch (error) {
    return saveFailed("createDraft", error);
  }
}

/** AC-5: the same rules as a new name. */
export async function renameDraft(input: {
  draftId: string;
  name: string;
}): Promise<NameResult<{ name: string }> | Fail<"not_found">> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = renameDraftSchema.safeParse(input);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "draftId")) return fail("not_found");
    return invalidName(parsed.error);
  }
  try {
    const outcome = await renameDraftInDb(
      await getDb(),
      userId,
      parsed.data.draftId,
      parsed.data.name,
    );
    if (outcome.kind !== "renamed") return refused(outcome.kind);
    return ok({ name: outcome.name });
  } catch (error) {
    return saveFailed("renameDraft", error);
  }
}

/** AC-15: gone already counts as done. */
export async function deleteDraft(input: {
  draftId: string;
}): Promise<Result<Record<string, never>, "forbidden" | "save_failed">> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = draftIdSchema.safeParse(input);
  if (!parsed.success) return ok({});
  try {
    if (await deleteDraftInDb(await getDb(), userId, parsed.data.draftId)) log("draft_deleted");
    return ok({});
  } catch (error) {
    return saveFailed("deleteDraft", error);
  }
}

export type LineError =
  "forbidden" | "invalid" | "not_found" | "too_many_lines" | "duplicate" | "save_failed";
export type LineResult = Result<{ line: DraftLineView }, LineError, { readonly position?: number }>;

function lineResult(outcome: LineOutcome): LineResult {
  switch (outcome.kind) {
    case "ok":
      return ok({ line: outcome.line });
    case "duplicate":
      return { ...refused("duplicate"), position: outcome.position };
    default:
      return refused(outcome.kind);
  }
}

/** AC-9: an empty line at the end. */
export async function addDraftLine(input: { draftId: string }): Promise<LineResult> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = draftIdSchema.safeParse(input);
  if (!parsed.success) return fail("not_found");
  try {
    return lineResult(await addDraftLineInDb(await getDb(), userId, parsed.data.draftId));
  } catch (error) {
    return saveFailed("addDraftLine", error);
  }
}

/** AC-8: the product with its option, the option alone, or the quantity. */
export async function updateDraftLine(
  input: z.input<typeof updateDraftLineSchema>,
): Promise<LineResult> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = updateDraftLineSchema.safeParse(input);
  if (!parsed.success) return refused("invalid");
  try {
    return lineResult(await updateDraftLineInDb(await getDb(), userId, parsed.data));
  } catch (error) {
    return saveFailed("updateDraftLine", error);
  }
}

/** AC-9: the line goes; undo restores it. */
export async function removeDraftLine(input: {
  lineId: string;
}): Promise<Result<Record<string, never>, "forbidden" | "not_found" | "save_failed">> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = lineIdSchema.safeParse(input);
  if (!parsed.success) return fail("not_found");
  try {
    const removed = await removeDraftLineInDb(await getDb(), userId, parsed.data.lineId);
    return removed ? ok({}) : fail("not_found");
  } catch (error) {
    return saveFailed("removeDraftLine", error);
  }
}

/** AC-9 undo. */
export async function restoreDraftLine(
  input: z.input<typeof restoreDraftLineSchema>,
): Promise<LineResult> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = restoreDraftLineSchema.safeParse(input);
  if (!parsed.success) return refused("invalid");
  try {
    return lineResult(await restoreDraftLineInDb(await getDb(), userId, parsed.data));
  } catch (error) {
    return saveFailed("restoreDraftLine", error);
  }
}

/** AC-10: any of the customer fields, as typed. */
export async function saveDraftCustomer(
  input: z.input<typeof draftCustomerSchema>,
): Promise<Result<Record<string, never>, "forbidden" | "invalid" | "not_found" | "save_failed">> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = draftCustomerSchema.safeParse(input);
  if (!parsed.success) return refused("invalid");
  try {
    const outcome = await saveDraftCustomerInDb(await getDb(), userId, parsed.data);
    return outcome === "saved" ? ok({}) : refused(outcome);
  } catch (error) {
    return saveFailed("saveDraftCustomer", error);
  }
}

/** Spec 0021 AC-4: the user's drafts and the product, when the sheet opens. */
export async function readDraftPicker(input: {
  productId: string;
}): Promise<Result<DraftPickerData, "forbidden" | "invalid" | "save_failed">> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = draftPickerSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(JSON.stringify({ event: "draft_picker_failed", error: "invalid" }));
    return fail("invalid");
  }
  try {
    return ok(await readDraftPickerData(await getDb(), userId, parsed.data.productId));
  } catch (error) {
    await reportError("draft_picker_failed", error);
    return fail("save_failed");
  }
}

export type AddToDraftError =
  | "forbidden"
  | "invalid"
  | "not_sellable"
  | "not_found"
  | "too_many_lines"
  | "quantity_over"
  | "name_taken"
  | "too_many_drafts"
  | "save_failed";

export type AddToDraftAdded = {
  readonly draftId: string;
  readonly draftName: string;
  readonly position: number;
  readonly quantity: number;
  readonly merged: boolean;
};

export type AddToDraftResult = Result<
  AddToDraftAdded,
  AddToDraftError,
  {
    readonly problem?: DraftNameProblem;
    readonly position?: number;
    readonly current?: number;
  }
>;

/** Spec 0021 AC-8, AC-9: merge into the option's line, append a line, or start a named draft. */
export async function addToDraft(
  input: z.input<typeof addToDraftSchema>,
): Promise<AddToDraftResult> {
  const userId = await electricianId();
  if (!userId) return fail("forbidden");
  const parsed = addToDraftSchema.safeParse(input);
  if (!parsed.success) {
    const problem = addToDraftNameProblem(input);
    return problem ? { ...refused("invalid", ["name"]), problem } : refused("invalid");
  }
  try {
    const outcome = await addToDraftInDb(await getDb(), userId, parsed.data);
    switch (outcome.kind) {
      case "added": {
        const { draftId, draftName, position, quantity, merged, newDraft } = outcome;
        log("draft_item_added", { merged, newDraft });
        return ok({ draftId, draftName, position, quantity, merged });
      }
      case "quantity_over":
        return {
          ...refused("quantity_over"),
          position: outcome.position,
          current: outcome.current,
        };
      case "name_taken":
      case "too_many_drafts":
        return refused(outcome.kind, ["name"]);
      default:
        return refused(outcome.kind);
    }
  } catch (error) {
    return saveFailed("addToDraft", error);
  }
}

export type SendError =
  | "forbidden"
  | "rate_limited"
  | "not_found"
  | "empty"
  | "incomplete"
  | "invalid"
  | "not_sellable"
  | "zone_invalid"
  | "price_changed"
  | "save_failed";

export type SendState = Fail<
  SendError,
  { readonly problems?: readonly LineProblem[]; readonly fieldErrors?: FieldErrors }
>;

/** AC-13: check everything, write the order, delete the draft, and open W5. Success redirects. */
export async function sendDraft(input: {
  draftId: string;
  expectedTotal: number;
}): Promise<SendState> {
  // An order is a money change: the user as Supabase sees it now (AGENTS.md, Auth).
  const user = await getVerifiedUser();
  const userId = await electricianId();
  if (!user || !userId || user.id !== userId) return fail("forbidden");
  const parsed = sendDraftSchema.safeParse(input);
  if (!parsed.success) return refused("not_found");
  if ((await orderRateCheck()) === "limited") return refused("rate_limited");

  let outcome: Awaited<ReturnType<typeof sendDraftInDb>>;
  try {
    outcome = await sendDraftInDb(await getDb(), {
      userId,
      draftId: parsed.data.draftId,
      expectedTotal: parsed.data.expectedTotal,
      placedAt: new Date(),
    });
  } catch (error) {
    return saveFailed("sendDraft", error);
  }

  switch (outcome.kind) {
    case "placed":
      log("draft_sent", {
        orderNumber: outcome.orderNumber,
        lineCount: outcome.lineCount,
        total: outcome.total,
      });
      break;
    case "replayed":
      break;
    case "incomplete":
      return { ...refused("incomplete"), problems: outcome.problems };
    case "invalid":
      return {
        ...refused("invalid", Object.keys(outcome.fieldErrors)),
        fieldErrors: outcome.fieldErrors,
      };
    default:
      return refused(outcome.kind);
  }

  // The electrician's own storefront cart stays as it is; redirect stays outside any try.
  await rememberPlacedOrder(outcome.orderId, { clearCart: false });
  redirect(`${routes.checkoutDone(outcome.orderNumber)}?wa=1`);
}
