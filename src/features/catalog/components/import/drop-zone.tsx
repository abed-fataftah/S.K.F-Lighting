"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filesFromDrop } from "./drop-files";

// A drop zone (docs/design/pages/admin-import.md): drop files or a folder on it, or use its
// button, which opens the file picker. The button is the keyboard and screen reader way in; a
// click anywhere else on the zone opens the same picker for a mouse.
export function DropZone({
  title,
  help,
  buttonLabel,
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  inputTestId,
  children,
}: {
  readonly title: string;
  readonly help: string;
  readonly buttonLabel: string;
  readonly accept: string;
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  readonly onFiles: (files: readonly File[]) => void;
  readonly inputTestId: string;
  readonly children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const helpId = useId();
  const open = () => {
    if (!disabled) input.current?.click();
  };

  return (
    <div
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) void filesFromDrop(event.dataTransfer).then(onFiles);
      }}
      onClick={open}
      data-over={over || undefined}
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-control-border bg-white px-4 py-6 text-center",
        disabled ? "cursor-not-allowed bg-page" : "cursor-pointer hover:bg-yellow-tint",
        over && "border-ink bg-yellow-tint",
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-yellow text-ink">
        <Upload aria-hidden className="size-6" />
      </span>
      <p className="type-lead">{title}</p>
      <p id={helpId} className="max-w-prose type-small text-muted">
        {help}
      </p>
      <Button
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
        disabled={disabled}
        focusableWhenDisabled
        aria-describedby={helpId}
      >
        {buttonLabel}
      </Button>
      {children}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          const picked = [...(event.target.files ?? [])];
          event.target.value = "";
          if (picked.length) onFiles(picked);
        }}
        data-testid={inputTestId}
      />
    </div>
  );
}
