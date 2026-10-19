import { getTranslations } from "next-intl/server";
import { AdminSide } from "@/features/shell/components/admin-side";
import { BottomBar } from "@/features/shell/components/bottom-bar";
import { InfoStrip } from "@/features/shell/components/info-strip";
import { SiteFooter } from "@/features/shell/components/site-footer";
import { SiteHeader } from "@/features/shell/components/site-header";
import { WhatsAppFab } from "@/features/shell/components/whatsapp-fab";
import { GallerySection, SampleGroup } from "../gallery-section";

// Board sample (gallery only): a phone number is not a word, so it stays here.
const samplePhone = "0599 123 456";

// Every shared part in its static display mode (AC-11 to AC-18).
export async function ShellSection({ whatsappNumber }: { readonly whatsappNumber: string }) {
  const s = await getTranslations("DesignSystem.shell");

  return (
    <GallerySection id="shell" title={s("title")} text={s("text")}>
      <SampleGroup title={s("headerGroup")}>
        <div className="max-w-(--page-max)">
          <InfoStrip show />
          <SiteHeader whatsappNumber={whatsappNumber} />
        </div>
      </SampleGroup>

      <SampleGroup title={s("headerCountGroup")}>
        <div className="max-w-(--page-max)" data-testid="header-with-count">
          <SiteHeader whatsappNumber={whatsappNumber} cartCount={3} />
        </div>
      </SampleGroup>

      <SampleGroup title={s("footerGroup")}>
        <div className="max-w-(--page-max)">
          <SiteFooter contact={{ phone: samplePhone, address: s("sampleAddress") }} />
        </div>
      </SampleGroup>

      <SampleGroup title={s("footerEmptyGroup")}>
        <div className="max-w-(--page-max)" data-testid="footer-no-contact">
          <SiteFooter contact={{ phone: null, address: null }} />
        </div>
      </SampleGroup>

      <SampleGroup title={s("bottomBarGroup")}>
        <div className="max-w-(--page-max)">
          <BottomBar static pathname="/" />
        </div>
      </SampleGroup>

      <SampleGroup title={s("fabGroup")}>
        <WhatsAppFab whatsappNumber={whatsappNumber} static />
      </SampleGroup>

      <SampleGroup title={s("adminGroup")}>
        {/* The dashboard frame from design.md section 4: no media query, the row wraps. */}
        <div className="flex flex-wrap bg-page" data-testid="dashboard-frame">
          <AdminSide pathname="/admin/orders" />
          <div className="min-w-0 flex-[999_1_var(--admin-content-basis)] p-(--admin-pad)">
            <p className="type-display-s">{s("adminTitle")}</p>
            <p className="mt-2 text-muted">{s("adminText")}</p>
          </div>
        </div>
      </SampleGroup>
    </GallerySection>
  );
}
