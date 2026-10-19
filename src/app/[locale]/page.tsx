import { useTranslations } from "next-intl";

// A placeholder until the home page feature: the shell around it is real.
export default function HomePage() {
  const t = useTranslations("Home");

  return (
    <section className="flex flex-col items-start gap-4 px-4 py-12">
      <h1 className="type-title-l">{t("title")}</h1>
      <p>{t("comingSoon")}</p>
    </section>
  );
}
