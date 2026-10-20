"use client";

import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Ltr } from "@/components/ltr";
import { RadioCard } from "@/components/radio-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { checkoutTotal, type CartView } from "@/features/cart/cart-view";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import {
  ADDRESS_LIMITS,
  CITY_LIMITS,
  checkoutFieldOrder,
  NAME_LIMITS,
  NOTES_MAX,
} from "../schemas";
import type { DeliveryZoneOption } from "../server/checkout-options";
import { placeOrder, type CheckoutState } from "../server/actions";

type Fulfilment = "pickup" | "delivery";

const fieldId = (field: string) => `checkout-${field}`;
const errorId = (field: string) => `checkout-${field}-error`;

// The checkout form (spec 0004 AC-6, AC-8, AC-9; docs/design/pages/checkout.md). The summary
// totals come from server values; the total it shows is sent as `expectedTotal`, and one
// idempotency key holds for every retry of this checkout.
export function CheckoutForm({
  cart: initialCart,
  zones: initialZones,
  pickupAddress,
  idempotencyKey,
}: {
  readonly cart: CartView;
  readonly zones: readonly DeliveryZoneOption[];
  readonly pickupAddress: string | null;
  readonly idempotencyKey: string;
}) {
  const t = useTranslations("Checkout");
  const errorText = useFieldErrorText();
  const [state, dispatch, pending] = useActionState(placeOrder, null as CheckoutState);

  // The key is fixed for this render of /checkout (AC-9), even if the page renders again.
  const [key] = useState(idempotencyKey);

  // The fresh cart and zones a refused submit sends back replace the ones the page rendered.
  const [fresh, setFresh] = useState({ cart: initialCart, zones: initialZones });
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.cart && state.zones) setFresh({ cart: state.cart, zones: state.zones });
  }
  const { cart, zones } = fresh;

  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [zoneId, setZoneId] = useState(initialZones[0]?.id ?? "");
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const delivery = fulfilment === "delivery" && zones.length > 0;
  const fee = delivery && zone ? zone.fee : 0;
  const total = checkoutTotal(cart, fee);

  const fieldErrors = state?.error === "invalid" ? (state.fieldErrors ?? {}) : {};
  const formRef = useRef<HTMLFormElement>(null);

  // Focus the first invalid field, in page order, after a refused submit.
  useEffect(() => {
    if (state?.error !== "invalid" || !state.fieldErrors) return;
    const first = checkoutFieldOrder.find((field) => state.fieldErrors?.[field]);
    if (first) formRef.current?.querySelector<HTMLElement>(`#${fieldId(first)}`)?.focus();
  }, [state]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  };

  const invalid = (field: string) =>
    fieldErrors[field] ? { "aria-invalid": true as const, "aria-describedby": errorId(field) } : {};
  const errorFor = (field: string) => (
    <FieldError id={errorId(field)}>{errorText(fieldErrors[field])}</FieldError>
  );

  const banner = state && state.error !== "invalid" ? t(`errors.${state.error}`) : null;
  const blocked = cart.hasUnsellable;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="expectedTotal" value={total} />
      <input type="hidden" name="fulfilment" value={delivery ? "delivery" : "pickup"} />
      {delivery && zone ? <input type="hidden" name="zoneId" value={zone.id} /> : null}

      <Card>
        <h2 className="type-lead">{t("contact")}</h2>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={fieldId("name")}>{t("name")}</FieldLabel>
            <Input
              id={fieldId("name")}
              name="name"
              autoComplete="name"
              maxLength={NAME_LIMITS.max * 2}
              required
              {...invalid("name")}
            />
            {errorFor("name")}
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("phone")}>{t("phone")}</FieldLabel>
            <Input
              id={fieldId("phone")}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              aria-describedby={fieldErrors.phone ? errorId("phone") : "checkout-phone-help"}
              aria-invalid={fieldErrors.phone ? true : undefined}
            />
            <FieldDescription id="checkout-phone-help">{t("phoneHelp")}</FieldDescription>
            {errorFor("phone")}
          </Field>
        </FieldGroup>
      </Card>

      <Card>
        <h2 id="checkout-method" className="type-lead">
          {t("method")}
        </h2>
        <RadioGroup
          id={fieldId("fulfilment")}
          aria-labelledby="checkout-method"
          value={delivery ? "delivery" : "pickup"}
          onValueChange={(value) => setFulfilment(value as Fulfilment)}
          className="gap-2"
        >
          <RadioCard
            value="pickup"
            title={t("pickup")}
            description={pickupAddress ? `${pickupAddress} · ${t("free")}` : t("free")}
          />
          <RadioCard
            value="delivery"
            title={t("delivery")}
            description={zones.length > 0 ? t("deliveryText") : t("deliveryOff")}
            disabled={zones.length === 0}
          />
        </RadioGroup>

        {delivery ? (
          <FieldGroup>
            <div className="flex flex-col gap-2">
              <h3 id="checkout-zone" className="font-bold">
                {t("zone")}
              </h3>
              <RadioGroup
                id={fieldId("zoneId")}
                aria-labelledby="checkout-zone"
                value={zone?.id}
                onValueChange={(value) => setZoneId(String(value))}
                className="gap-2"
                {...invalid("zoneId")}
              >
                {zones.map((option) => (
                  <RadioCard
                    key={option.id}
                    value={option.id}
                    title={option.name}
                    description={<Ltr>{formatPrice(option.fee)}</Ltr>}
                  />
                ))}
              </RadioGroup>
              {errorFor("zoneId")}
            </div>
            <Field>
              <FieldLabel htmlFor={fieldId("city")}>{t("city")}</FieldLabel>
              <Input
                id={fieldId("city")}
                name="city"
                autoComplete="address-level2"
                maxLength={CITY_LIMITS.max * 2}
                required
                {...invalid("city")}
              />
              {errorFor("city")}
            </Field>
            <Field>
              <FieldLabel htmlFor={fieldId("address")}>{t("address")}</FieldLabel>
              <Textarea
                id={fieldId("address")}
                name="address"
                autoComplete="street-address"
                maxLength={ADDRESS_LIMITS.max * 2}
                required
                className="min-h-22"
                aria-invalid={fieldErrors.address ? true : undefined}
                aria-describedby={
                  fieldErrors.address ? errorId("address") : "checkout-address-help"
                }
              />
              <FieldDescription id="checkout-address-help">{t("addressHelp")}</FieldDescription>
              {errorFor("address")}
            </Field>
          </FieldGroup>
        ) : null}

        <Field>
          <FieldLabel htmlFor={fieldId("notes")}>{t("notes")}</FieldLabel>
          <Textarea
            id={fieldId("notes")}
            name="notes"
            maxLength={NOTES_MAX * 2}
            {...invalid("notes")}
          />
          {errorFor("notes")}
        </Field>
      </Card>

      <Card className="flex-row items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-yellow text-ink">
          <Banknote aria-hidden className="size-5.5" />
        </span>
        <div className="flex flex-col">
          <h2 className="type-lead">{t("payOnDelivery")}</h2>
          <p className="type-small text-muted">{t("payText")}</p>
        </div>
      </Card>

      <Card>
        <h2 className="type-lead">{t("summary")}</h2>
        <ul className="flex flex-col gap-2" data-testid="checkout-lines">
          {cart.lines.map((line) => (
            <li key={line.variantId} className="flex items-start justify-between gap-3">
              <span className="flex flex-col">
                <span className={line.sellable ? "font-bold" : "font-bold text-muted"}>
                  {line.productName ?? t("unavailable")}
                </span>
                <span className="type-small text-muted">
                  {line.sellable
                    ? t("lineQuantity", { shown: formatNumber(line.quantity) })
                    : t("unavailable")}
                </span>
              </span>
              {line.sellable ? <Ltr>{formatPrice(line.lineTotal)}</Ltr> : null}
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex justify-between gap-3">
            <dt>{t("subtotal")}</dt>
            <dd>
              <Ltr>{formatPrice(cart.subtotal)}</Ltr>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("deliveryFee")}</dt>
            <dd>{delivery ? <Ltr>{formatPrice(fee)}</Ltr> : t("free")}</dd>
          </div>
          <div className="flex justify-between gap-3 type-title-s">
            <dt>{t("total")}</dt>
            <dd data-testid="checkout-total">
              <Ltr>{formatPrice(total)}</Ltr>
            </dd>
          </div>
        </dl>

        {banner ? (
          <Alert id="checkout-banner">
            <AlertDescription>{banner}</AlertDescription>
          </Alert>
        ) : null}
        {blocked ? (
          <Link
            href={routes.cart}
            className="inline-flex min-h-11 items-center self-start rounded-btn font-bold underline"
          >
            {t("editCart")}
          </Link>
        ) : null}

        <Button
          type="submit"
          variant="whatsapp"
          size="lg"
          disabled={pending || blocked}
          focusableWhenDisabled
          aria-busy={pending || undefined}
          aria-describedby={banner ? "checkout-banner" : undefined}
          data-testid="place-order"
        >
          <WhatsAppIcon />
          {pending ? t("submitting") : t("submit")}
        </Button>
        <p className="type-small text-muted">{t("note")}</p>
      </Card>
    </form>
  );
}
