"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ltr } from "@/components/ltr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { enrollTotp, type EnrollError, type Enrollment } from "../server/actions";
import { TotpForm } from "./totp-form";

// Authenticator setup (spec 0004 AC-1): the owner presses start, scans the QR code (or types the
// key) on two devices, then confirms with one code. Setup starts on a press, not on load, so a
// reload never makes a factor; starting again replaces the unverified one.
export function TotpEnroll({ next }: { readonly next?: string }) {
  const t = useTranslations("AdminAuth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<EnrollError | null>(null);

  const start = () =>
    startTransition(async () => {
      const result = await enrollTotp();
      if (result.ok) {
        setError(null);
        setEnrollment(result.data);
        return;
      }
      setError(result.error);
      // Set up meanwhile (another tab): the page shows the code form instead.
      if (result.error === "already_enrolled") router.refresh();
    });

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        {error ? (
          <Alert>
            <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          size="lg"
          onClick={start}
          disabled={pending}
          focusableWhenDisabled
          aria-busy={pending || undefined}
          data-testid="admin-enroll-start"
        >
          {pending ? t("enrollStarting") : t("enrollStart")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The QR code is SVG from Supabase, so a plain <img> shows it; next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={enrollment.qrSrc}
        alt={t("qrAlt")}
        width={200}
        height={200}
        className="size-50 self-center rounded-tile border border-border bg-white"
      />
      <div className="flex flex-col gap-1">
        <p className="type-small text-muted">{t("secretLabel")}</p>
        <p
          className="rounded-tile border border-dashed border-ink px-3 py-2 font-bold break-all select-all"
          data-testid="totp-secret"
        >
          <Ltr>{enrollment.secret}</Ltr>
        </p>
      </div>
      <p>{t("enrollCode")}</p>
      <TotpForm factorId={enrollment.factorId} next={next} />
    </div>
  );
}
