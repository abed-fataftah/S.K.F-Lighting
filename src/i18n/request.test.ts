import { describe, expect, it, vi } from "vitest";

// getRequestConfig only registers the callback; unwrap it so the callback can be called directly.
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));

const { default: requestConfig } = (await import("./request")) as unknown as {
  default: (args: { requestLocale: Promise<string | undefined> }) => Promise<{
    locale: string;
    messages: { Home: { title: string } };
    timeZone: string;
  }>;
};

describe("i18n request config", () => {
  it("loads Arabic messages for an Arabic request", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("ar") });

    expect(config.locale).toBe("ar");
    expect(config.messages.Home.title).toBe("S.K.F للإنارة");
  });

  it("falls back to Arabic when no locale was requested", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config.locale).toBe("ar");
  });

  it.each(["en", "fr"])(
    "serves Arabic for a %s request instead of loading a missing catalog",
    async (requested) => {
      const config = await requestConfig({ requestLocale: Promise.resolve(requested) });

      expect(config.locale).toBe("ar");
      expect(config.messages.Home.title).toBe("S.K.F للإنارة");
    },
  );

  it("formats dates in the shop's time zone", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("ar") });

    expect(config.timeZone).toBe("Asia/Jerusalem");
  });
});
