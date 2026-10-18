import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("Home");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p>{t("comingSoon")}</p>
    </main>
  );
}
