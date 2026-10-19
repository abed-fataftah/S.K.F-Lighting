import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { SkipLink } from "@/components/skip-link";
import { serverEnv } from "@/server/env";
import { assertDesignSystemPageOn } from "./gate";
import { ButtonsSection } from "./sections/buttons";
import { ColoursSection } from "./sections/colours";
import { TypeSection } from "./sections/type";

// Every token, type role, component, and shell part in each state, in Arabic
// (spec 0003, AC-19). Playwright runs axe, the 44px check, and the focus check here.
export default async function DesignSystemPage() {
  await connection();
  assertDesignSystemPageOn(serverEnv());
  const t = await getTranslations("DesignSystem");
  const shop = await getTranslations("Metadata");

  const sections = [
    { id: "colours", title: t("colours.title") },
    { id: "type", title: t("type.title") },
    { id: "buttons", title: t("buttons.title") },
  ];

  return (
    <>
      <SkipLink />
      <header className="on-dark bg-ink text-white">
        <div className="mx-auto flex max-w-(--admin-form-max) flex-col gap-2 px-4 pt-6 pb-5">
          <p className="type-caption font-extrabold text-yellow">{shop("title")}</p>
          <h1 className="type-title-l">{t("title")}</h1>
          <p className="max-w-(--page-max) text-on-dark-muted">{t("intro")}</p>
          <nav aria-label={t("toc")} className="mt-2">
            <ul className="flex flex-wrap gap-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="inline-flex h-11 items-center rounded-btn border border-on-dark-muted px-4 type-body font-bold text-white"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex max-w-(--admin-form-max) flex-col gap-12 px-4 pt-8 pb-12"
      >
        <ColoursSection />
        <TypeSection />
        <ButtonsSection />
      </main>
    </>
  );
}
