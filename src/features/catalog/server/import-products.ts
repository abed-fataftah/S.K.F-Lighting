import "server-only";
import { asc } from "drizzle-orm";
import type { z } from "zod";
import { colours } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { importProductSchema, normalizeCode, problemOf, type ProblemCode } from "../import-schemas";
import { toEditorData } from "../import-plan";
import { productEditorSchema } from "../schemas";
import { readProductEditor, readProductsByCodes } from "./admin-queries";
import { ensureImportCategories } from "./categories";
import { saveProductInDb } from "./save-product";

// One import product, start to end (spec 0007, `importProducts` steps 1 to 5): checked again, merged
// with the stored product, and saved by the editor's own `saveProductInDb` in its own transaction.
// A refusal is that product's outcome; anything unexpected throws for the action to log.

type Db = Database | Transaction;

export type ImportOutcome =
  | { readonly code: string; readonly outcome: "created" | "updated"; readonly id: string }
  | { readonly code: string; readonly outcome: "skipped"; readonly problem: ProblemCode };

/** The editor schema's first failing field, as the import names it. */
function editorProblem(error: z.ZodError): ProblemCode {
  const field = String(error.issues[0]?.path[0] ?? "");
  switch (field) {
    case "name":
      return "name_invalid";
    case "description":
      return "description_invalid";
    case "colours":
      return "colour_invalid";
    case "specs":
      return "too_many_specs";
    case "categoryId":
    case "subCategoryId":
      return "category_invalid";
    default:
      return "invalid";
  }
}

const codeOf = (input: unknown): string => {
  const code = (input as { code?: unknown } | null)?.code;
  return typeof code === "string" ? normalizeCode(code) : "";
};

export async function importProductInDb(
  db: Db,
  input: unknown,
  newId: () => string = () => crypto.randomUUID(),
): Promise<ImportOutcome> {
  const parsed = importProductSchema.safeParse(input);
  if (!parsed.success) {
    return { code: codeOf(input), outcome: "skipped", problem: problemOf(parsed.error) };
  }
  const sheet = parsed.data;
  const skip = (problem: ProblemCode): ImportOutcome => ({
    code: sheet.code,
    outcome: "skipped",
    problem,
  });

  // A save that finds the product changed since step 2 reads it again once (AC-15).
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const [found] = await readProductsByCodes(db, [sheet.code]);
    if (found?.status === "archived") return skip("archived");
    const stored = found ? await readProductEditor(db, found.id) : null;
    if (!stored && !sheet.name) return skip("name_missing");
    if (!stored && !sheet.mainCategory) return skip("category_missing");

    const category = await ensureImportCategories(
      db,
      { main: sheet.mainCategory, sub: sheet.subCategory },
      stored ? { mainId: stored.mainCategoryId, subId: stored.subCategoryId } : null,
    );
    if (!category) return skip("category_missing");
    const listed = await db
      .select({ id: colours.id, name: colours.name })
      .from(colours)
      .orderBy(asc(colours.sort), asc(colours.name));

    const merged = toEditorData(sheet, stored, { ...category, colours: listed }, newId);
    if (!merged.ok) return skip(merged.problem);
    const data = productEditorSchema.safeParse(merged.data);
    if (!data.success) return skip(editorProblem(data.error));

    const outcome = await saveProductInDb(db, data.data);
    switch (outcome.kind) {
      case "saved":
        return {
          code: sheet.code,
          outcome: data.data.version === null ? "created" : "updated",
          id: outcome.id,
        };
      case "stale":
      case "not_found":
      case "category_required":
        if (attempt === 1) continue;
        return skip("changed_during_import");
      case "code_taken":
        return skip("code_taken");
      case "archived":
        return skip("archived");
      case "colour_invalid":
        return skip("colour_duplicate");
      case "code_changed":
        return skip("invalid");
    }
  }
  return skip("changed_during_import");
}
