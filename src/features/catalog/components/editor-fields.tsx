"use client";

import type { Dispatch, SetStateAction } from "react";
import { FieldError } from "@/components/ui/field";
import type { FieldErrors } from "@/lib/form-errors";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import type { EditorState } from "../editor-state";

// Shared wiring for the editor's fields: a field's error path (`sizes.1.label`) gives its DOM id,
// its error id, and the aria attributes that tie them together (design.md section 7).

export type SectionProps = {
  readonly state: EditorState;
  readonly setState: Dispatch<SetStateAction<EditorState>>;
  readonly errors: FieldErrors;
  /** The archived view: every field and tile is read only. */
  readonly disabled: boolean;
};

export const fieldDomId = (path: string) => `product-${path.replaceAll(".", "-")}`;
export const errorDomId = (path: string) => `${fieldDomId(path)}-error`;
const helpDomId = (path: string) => `${fieldDomId(path)}-help`;

export function useEditorField(errors: FieldErrors) {
  const errorText = useFieldErrorText();
  return {
    /** id, aria-invalid, and aria-describedby for the control at `path`. */
    control: (path: string, { help = false }: { help?: boolean } = {}) => ({
      id: fieldDomId(path),
      "aria-invalid": errors[path] ? (true as const) : undefined,
      "aria-describedby": errors[path] ? errorDomId(path) : help ? helpDomId(path) : undefined,
    }),
    helpId: helpDomId,
    errorFor: (path: string) => (
      <FieldError id={errorDomId(path)}>{errorText(errors[path])}</FieldError>
    ),
    hasError: (path: string) => !!errors[path],
  };
}
