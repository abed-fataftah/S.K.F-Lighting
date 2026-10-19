import { CircleAlert } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

// Forms (design.md section 7): label above, 4px gap, control, then help or error below.
// The control carries aria-invalid and aria-describedby={<FieldError id>} when in error.

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex w-full flex-col gap-3", className)}
      {...props}
    />
  );
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset data-slot="field-set" className={cn("flex flex-col gap-1", className)} {...props} />
  );
}

function FieldLegend({ className, ...props }: React.ComponentProps<"legend">) {
  return (
    <legend
      data-slot="field-legend"
      className={cn("mb-1 type-small text-muted", className)}
      {...props}
    />
  );
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="field"
      className={cn("flex w-full flex-col gap-1", className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" className={className} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("type-small text-muted", className)}
      {...props}
    />
  );
}

// 13/700 danger with an error icon, announced as an alert.
function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn("flex items-start gap-1.5 type-small font-bold text-danger", className)}
      {...props}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export { CheckRow } from "@/components/ui/check-row";
export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet };
