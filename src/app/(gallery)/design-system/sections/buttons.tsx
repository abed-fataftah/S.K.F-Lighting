import { Menu, ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { GallerySection, Labelled, SampleGroup } from "../gallery-section";

// Hover, pressed, and focus are forced with data-preview so every state shows at once.
const states = ["default", "hover", "pressed", "focus", "disabled"] as const;
type State = (typeof states)[number];

function stateProps(state: State) {
  if (state === "disabled") return { disabled: true };
  if (state === "default") return {};
  return { "data-preview": state };
}

export async function ButtonsSection() {
  const t = await getTranslations("DesignSystem");
  const b = await getTranslations("DesignSystem.buttons");

  const rows = [
    { title: b("primary"), variant: "default", lg: b("continueOrder"), sm: b("addToCart") },
    { title: b("whatsapp"), variant: "whatsapp", lg: b("askWhatsapp"), sm: b("askWhatsapp") },
    { title: b("outline"), variant: "outline", lg: b("showMore"), sm: b("showMore") },
  ] as const;

  return (
    <GallerySection id="buttons" title={b("title")} text={b("text")}>
      {rows.map((row) => (
        <SampleGroup key={row.variant} title={row.title}>
          <div className="flex flex-col gap-4">
            {(["lg", "sm"] as const).map((size) => (
              <div key={size} className="flex flex-col gap-2">
                <p className="type-small text-muted">{size === "lg" ? b("large") : b("small")}</p>
                <div className="flex flex-wrap gap-3 p-1">
                  {states.map((state) => (
                    <Labelled key={state} label={t(`states.${state}`)}>
                      <Button variant={row.variant} size={size} {...stateProps(state)}>
                        {row.variant === "whatsapp" ? <WhatsAppIcon /> : null}
                        {size === "lg" ? row.lg : row.sm}
                      </Button>
                    </Labelled>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SampleGroup>
      ))}

      <SampleGroup title={b("link")}>
        <div className="flex flex-wrap gap-3 p-1">
          {(["default", "focus"] as const).map((state) => (
            <Labelled key={state} label={t(`states.${state}`)}>
              <Button variant="link" {...stateProps(state)}>
                {b("viewAll")}
              </Button>
            </Labelled>
          ))}
        </div>
      </SampleGroup>

      <SampleGroup title={b("icon")}>
        <div className="flex flex-wrap gap-3 p-1">
          <Labelled label={b("whatsapp")}>
            <Button variant="whatsapp" size="icon" aria-label={b("askWhatsapp")}>
              <WhatsAppIcon />
            </Button>
          </Labelled>
          {(["default", "focus"] as const).map((state) => (
            <Labelled key={state} label={t(`states.${state}`)}>
              <Button variant="ghost" size="icon" aria-label={b("cart")} {...stateProps(state)}>
                <ShoppingCart aria-hidden className="size-6.5" />
              </Button>
            </Labelled>
          ))}
        </div>
      </SampleGroup>

      <SampleGroup title={b("iconOnDark")}>
        <div className="on-dark flex flex-wrap gap-3 rounded-btn bg-ink p-2 text-white">
          {(["default", "focus"] as const).map((state) => (
            <figure key={state} className="flex flex-col items-start gap-1.5">
              <Button variant="ghost" size="icon" aria-label={b("menu")} {...stateProps(state)}>
                <Menu aria-hidden className="size-6.5" />
              </Button>
              <figcaption className="type-caption text-on-dark-muted">
                {t(`states.${state}`)}
              </figcaption>
            </figure>
          ))}
        </div>
      </SampleGroup>
    </GallerySection>
  );
}
