import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorState, PageErrorState } from "./error-state";

// The router is the boundary: retry on a server page asks it to render the page again.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// covers: AC-15 (spec 0003: a page whose read failed offers retry and WhatsApp)
describe("PageErrorState", () => {
  afterEach(() => {
    refresh.mockReset();
  });

  it("renders the error card with the props it was given", () => {
    const card = PageErrorState({ whatsappNumber: "970500000000", title: "تعذر التحميل" });

    expect(card.type).toBe(ErrorState);
    expect(card.props).toMatchObject({ whatsappNumber: "970500000000", title: "تعذر التحميل" });
  });

  it("refreshes the page when the shopper presses retry", () => {
    const card = PageErrorState({ whatsappNumber: "970500000000" });

    card.props.onRetry();

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not refresh until retry is pressed", () => {
    PageErrorState({ whatsappNumber: "970500000000" });

    expect(refresh).not.toHaveBeenCalled();
  });
});
