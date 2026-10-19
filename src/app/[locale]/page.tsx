import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("Home");

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-(--page-max) flex-1 flex-col items-start justify-center gap-4 px-4 py-12"
    >
      <h1 className="type-title-l">{t("title")}</h1>
      <p>{t("comingSoon")}</p>
    </main>
  );
}
