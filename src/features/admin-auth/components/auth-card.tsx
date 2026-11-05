import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Logo } from "@/features/shell/components/logo";

// The frame of the two sign in pages: the storefront column (480px) on the page colour, the logo on
// black, then one card with the page heading. No sidebar until the owner is fully signed in.
export function AuthCard({
  title,
  text,
  children,
}: {
  readonly title: string;
  readonly text?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="on-dark flex justify-center bg-ink py-3">
        <Logo place="header" />
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-(--page-max) flex-col gap-3 px-(--page-pad) pt-7 pb-8"
      >
        <h1 className="type-title-l">{title}</h1>
        <Card className="gap-4">
          {text ? <p className="text-muted">{text}</p> : null}
          {children}
        </Card>
      </main>
    </div>
  );
}
