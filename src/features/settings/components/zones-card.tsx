"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useRef, useState, useTransition, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { toShekelsInput } from "@/lib/money";
import { addZoneSchema, saveZoneSchema, ZONE_LIMIT, ZONE_NAME, ZONE_SHORT_NAME } from "../schemas";
import { addZone, saveZone, setZoneActive, type ZoneResult } from "../server/actions";
import type { SettingsZone } from "../server/settings-db";
import { focusFirstError, SettingsField } from "./settings-field";

// "رسوم التوصيل" (spec 0025 AC-5, AC-6): every zone, active and paused, each saving on its own.
// The switch saves straight away and flips back if the save fails. Zones are never deleted.

const FIELDS = ["name", "shortName", "feeShekels"] as const;
type Values = Record<(typeof FIELDS)[number], string>;
type Notice = "saved" | "failed" | "not_found" | "zone_limit" | null;

const valuesOf = (zone: SettingsZone): Values => ({
  name: zone.name,
  shortName: zone.shortName,
  feeShekels: toShekelsInput(zone.fee),
});

const EMPTY: Values = { name: "", shortName: "", feeShekels: "" };

const issuesOf = (result: ReturnType<typeof addZoneSchema.safeParse>): FieldErrors | null =>
  result.success ? null : fieldErrorsOf(result.error);

export function ZonesCard({ zones: initial }: { readonly zones: readonly SettingsZone[] }) {
  const t = useTranslations("AdminSettings");
  const [zones, setZones] = useState(initial);
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const atLimit = zones.length >= ZONE_LIMIT;
  const replace = (zone: SettingsZone) =>
    setZones((list) => list.map((row) => (row.id === zone.id ? zone : row)));
  const closeNew = () => {
    setAdding(false);
    addButton.current?.focus();
  };

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="type-title-s">{t("zonesTitle")}</h2>
        <p className="text-muted">{t("zonesText")}</p>
      </div>
      {zones.every((zone) => !zone.isActive) ? (
        <Alert data-testid="zones-all-paused">
          <AlertDescription>{t("allPaused")}</AlertDescription>
        </Alert>
      ) : null}
      <ul aria-label={t("zonesTitle")} className="flex flex-col border-t border-border">
        {zones.map((zone) => (
          <li key={zone.id} className="border-b border-border py-3" data-testid="zone-row">
            <ZoneRow zone={zone} onSaved={replace} />
          </li>
        ))}
      </ul>
      {adding ? (
        <NewZoneForm
          onAdded={(zone) => {
            setZones((list) => [...list, zone]);
            closeNew();
          }}
          onCancel={closeNew}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          ref={addButton}
          variant="outline"
          disabled={atLimit || adding}
          focusableWhenDisabled
          aria-describedby={atLimit ? "zone-limit" : undefined}
          onClick={() => setAdding(true)}
          data-testid="zone-add"
        >
          {t("addZone")}
        </Button>
        {atLimit ? (
          <p id="zone-limit" className="type-small text-muted">
            {t("zoneLimit")}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** One zone form: the shared schema checks first, then the action, then its result. */
function useZoneForm(options: {
  readonly initial: Values;
  readonly idOf: (field: string) => string;
  readonly validate: (values: Values) => FieldErrors | null;
  readonly send: (values: Values) => Promise<ZoneResult>;
  readonly onSaved: (zone: SettingsZone) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(options.initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();

  const showErrors = (found: FieldErrors) => {
    setErrors(found);
    focusFirstError(formRef.current, FIELDS, found, options.idOf);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setNotice(null);
    const found = options.validate(values);
    if (found) return showErrors(found);
    setErrors({});
    startTransition(async () => {
      const result = await options.send(values);
      if (result.ok) {
        setValues(valuesOf(result.data));
        setNotice("saved");
        options.onSaved(result.data);
      } else if (result.error === "invalid") showErrors(result.fieldErrors);
      else if (result.error === "name_taken") showErrors({ name: { code: "zone_name_taken" } });
      else if (result.error === "forbidden") router.refresh();
      else if (result.error === "not_found" || result.error === "zone_limit")
        setNotice(result.error);
      else setNotice("failed");
    });
  };

  const field = (name: keyof Values) => ({
    id: options.idOf(name),
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: { currentTarget: HTMLInputElement }) => {
      const { value } = event.currentTarget;
      setValues((current) => ({ ...current, [name]: value }));
      setNotice(null);
    },
  });

  return { formRef, field, notice, pending, submit };
}

function ZoneFields({ field }: { readonly field: ReturnType<typeof useZoneForm>["field"] }) {
  const t = useTranslations("AdminSettings");
  return (
    <div className="flex flex-wrap gap-3">
      <SettingsField
        {...field("name")}
        label={t("zoneName")}
        maxLength={ZONE_NAME.max * 2}
        autoComplete="off"
        className="grow basis-52"
      />
      <SettingsField
        {...field("shortName")}
        label={t("zoneShortName")}
        hint={t("zoneShortNameHelp")}
        maxLength={ZONE_SHORT_NAME.max * 2}
        autoComplete="off"
        className="grow basis-40"
      />
      <SettingsField
        {...field("feeShekels")}
        label={t("zoneFee")}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        className="basis-28"
      />
    </div>
  );
}

function NoticeLine({ notice }: { readonly notice: Notice }) {
  const t = useTranslations("AdminSettings");
  const alerts = { failed: t("failed"), not_found: t("notFound"), zone_limit: t("zoneLimit") };
  return (
    <>
      <p role="status" className="flex items-center gap-1.5 font-bold">
        {notice === "saved" ? (
          <>
            <CircleCheck aria-hidden className="size-5 text-whatsapp" />
            {t("zoneSaved")}
          </>
        ) : null}
      </p>
      {notice && notice !== "saved" ? (
        <p role="alert" className="font-bold text-danger">
          {alerts[notice]}
        </p>
      ) : null}
    </>
  );
}

function ZoneRow({
  zone,
  onSaved,
}: {
  readonly zone: SettingsZone;
  readonly onSaved: (zone: SettingsZone) => void;
}) {
  const t = useTranslations("AdminSettings");
  const { formRef, field, notice, pending, submit } = useZoneForm({
    initial: valuesOf(zone),
    idOf: (name) => `zone-${zone.id}-${name}`,
    validate: (values) => issuesOf(saveZoneSchema.safeParse({ id: zone.id, ...values })),
    send: (values) => saveZone({ id: zone.id, ...values }),
    onSaved,
  });

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      aria-label={t("zoneRowLabel", { name: zone.name })}
      className="flex flex-col gap-3"
    >
      <ZoneFields field={field} />
      <div className="flex flex-wrap items-center gap-3">
        <ActiveSwitch zone={zone} onSaved={onSaved} />
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          focusableWhenDisabled
          aria-busy={pending || undefined}
          aria-label={pending ? undefined : t("zoneSaveLabel", { name: zone.name })}
          data-testid="zone-save"
        >
          {pending ? t("saving") : t("zoneSave")}
        </Button>
        <NoticeLine notice={notice} />
      </div>
    </form>
  );
}

/** Saves on change (AC-6): shows the new state while it saves, and flips back if the save fails. */
function ActiveSwitch({
  zone,
  onSaved,
}: {
  readonly zone: SettingsZone;
  readonly onSaved: (zone: SettingsZone) => void;
}) {
  const t = useTranslations("AdminSettings");
  const router = useRouter();
  const [active, setOptimistic] = useOptimistic(zone.isActive);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const change = (next: boolean) => {
    setFailed(false);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setZoneActive({ id: zone.id, isActive: next });
      if (result.ok) onSaved(result.data);
      else if (result.error === "forbidden") router.refresh();
      else setFailed(true);
    });
  };

  return (
    <div className="me-auto flex flex-wrap items-center gap-1">
      <Switch
        checked={active}
        onCheckedChange={change}
        disabled={pending}
        aria-label={t("zoneActiveLabel", { name: zone.name })}
        aria-busy={pending || undefined}
        data-testid="zone-active"
      />
      <span aria-hidden className="font-bold">
        {pending ? t("saving") : active ? t("zoneActive") : t("zonePaused")}
      </span>
      {failed ? (
        <p role="alert" className="basis-full font-bold text-danger">
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}

function NewZoneForm({
  onAdded,
  onCancel,
}: {
  readonly onAdded: (zone: SettingsZone) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations("AdminSettings");
  const { formRef, field, notice, pending, submit } = useZoneForm({
    initial: EMPTY,
    idOf: (name) => `zone-new-${name}`,
    validate: (values) => issuesOf(addZoneSchema.safeParse(values)),
    send: addZone,
    onSaved: onAdded,
  });

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      aria-labelledby="zone-new-title"
      className="flex flex-col gap-3 rounded-card border border-border p-3.5"
      data-testid="zone-new"
    >
      <h3 id="zone-new-title" className="type-lead">
        {t("newZoneTitle")}
      </h3>
      <ZoneFields field={field} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          focusableWhenDisabled
          aria-busy={pending || undefined}
          data-testid="zone-new-save"
        >
          {pending ? t("saving") : t("addZone")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <NoticeLine notice={notice} />
      </div>
    </form>
  );
}
