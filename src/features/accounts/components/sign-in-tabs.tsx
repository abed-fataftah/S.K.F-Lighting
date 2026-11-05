"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { routes } from "@/lib/routes";
import { RegisterForm } from "./register-form";
import { ResetRequestForm } from "./reset-request-form";
import { SignInForm } from "./sign-in-form";

export type SignInTab = "login" | "register" | "reset";
export type SwitchTab = (tab: SignInTab) => void;

const TAB_BUTTONS = [
  ["login", "tabLogin"],
  ["register", "tabRegister"],
] as const;

const TITLES = {
  login: "loginTitle",
  register: "registerTitle",
  reset: "resetTitle",
} as const;

// The three forms of /account/sign-in (spec 0017 AC-1; docs/design/pages/sign-in.md). The page
// picks the first form from `?tab`; after that the form is client state: switching keeps the typed
// email and `next`, and rewrites `?tab` in place with no navigation and no server round trip.
export function SignInTabs({
  initialTab,
  next,
  linkExpired,
}: {
  readonly initialTab: SignInTab;
  readonly next?: string;
  readonly linkExpired: boolean;
}) {
  const t = useTranslations("Account");
  const [tab, setTab] = useState(initialTab);
  const [email, setEmail] = useState("");
  const [expired, setExpired] = useState(linkExpired);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const writeAddress = (target: SignInTab, showExpired: boolean) => {
    const error = target === "reset" && showExpired ? "link_expired" : undefined;
    window.history.replaceState(null, "", routes.signInWith({ tab: target, next, error }));
  };

  // A tab button keeps focus; a link inside a form that disappears moves it to the new heading.
  const switchTo = (target: SignInTab, focusHeading: boolean) => {
    if (target === tab) return;
    moved.current = focusHeading;
    setTab(target);
    writeAddress(target, expired);
  };

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    headingRef.current?.focus();
  }, [tab]);

  const onSent = useCallback(() => {
    if (!expired) return;
    setExpired(false);
    window.history.replaceState(null, "", routes.signInWith({ tab: "reset", next }));
  }, [expired, next]);

  const fromForm: SwitchTab = (target) => switchTo(target, true);
  const shared = { email, onEmailChange: setEmail, onSwitch: fromForm };

  return (
    <div className="flex flex-col gap-3">
      <h1 ref={headingRef} tabIndex={-1} className="type-title-l" data-testid="sign-in-heading">
        {t(TITLES[tab])}
      </h1>
      {tab === "reset" ? null : (
        <div role="group" aria-label={t("tabsLabel")} className="flex gap-2">
          {TAB_BUTTONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => switchTo(id, false)}
              className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center rounded-btn border border-control-border bg-white px-3 type-control text-ink aria-pressed:border-ink aria-pressed:bg-yellow aria-pressed:font-extrabold"
              data-testid={`tab-${id}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
      )}
      <Card>
        {tab === "login" ? <SignInForm key="login" next={next} {...shared} /> : null}
        {tab === "register" ? <RegisterForm key="register" next={next} {...shared} /> : null}
        {tab === "reset" ? (
          <ResetRequestForm key="reset" linkExpired={expired} onSent={onSent} {...shared} />
        ) : null}
      </Card>
    </div>
  );
}
