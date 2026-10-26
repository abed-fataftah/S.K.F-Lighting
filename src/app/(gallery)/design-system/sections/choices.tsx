import { getTranslations } from "next-intl/server";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckRow } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GallerySection, SampleGroup } from "../gallery-section";

// Checkbox, switch, radio, toggle group, and tabs (AC-7). Each is live: try it with the keyboard.
export async function ChoicesSection() {
  const c = await getTranslations("DesignSystem.choices");

  return (
    <GallerySection id="choices" title={c("title")} text={c("text")}>
      <SampleGroup title={c("checkboxGroup")}>
        <div className="flex flex-col">
          <CheckRow>
            <Checkbox />
            {c("remember")}
          </CheckRow>
          <CheckRow>
            <Checkbox defaultChecked />
            {c("terms")}
          </CheckRow>
          <CheckRow className="cursor-not-allowed text-muted">
            <Checkbox disabled />
            {c("unavailable")}
          </CheckRow>
        </div>
      </SampleGroup>

      <SampleGroup title={c("switchGroup")}>
        <div className="flex min-h-11 max-w-(--page-max) items-center justify-between gap-3">
          <span id="gallery-switch-label">{c("switchLabel")}</span>
          <Switch defaultChecked aria-labelledby="gallery-switch-label" />
        </div>
      </SampleGroup>

      <SampleGroup title={c("radioGroup")}>
        <RadioGroup aria-label={c("deliveryMethod")} defaultValue="pickup">
          <CheckRow>
            <RadioGroupItem value="pickup" />
            {c("pickup")}
          </CheckRow>
          <CheckRow>
            <RadioGroupItem value="delivery" />
            {c("delivery")}
          </CheckRow>
        </RadioGroup>
      </SampleGroup>

      <SampleGroup title={c("chipsGroup")}>
        <ToggleGroup aria-label={c("statusFilter")} defaultValue={["all"]} className="p-1">
          <ToggleGroupItem value="all">{c("all")}</ToggleGroupItem>
          <ToggleGroupItem value="new">{c("new")}</ToggleGroupItem>
          <ToggleGroupItem value="processing">{c("processing")}</ToggleGroupItem>
          <ToggleGroupItem value="ready" disabled>
            {c("ready")}
          </ToggleGroupItem>
        </ToggleGroup>
      </SampleGroup>

      <SampleGroup title={c("tabsGroup")}>
        <Tabs defaultValue="sign-in" className="max-w-(--page-max)">
          <TabsList>
            <TabsTrigger value="sign-in">{c("signIn")}</TabsTrigger>
            <TabsTrigger value="register">{c("register")}</TabsTrigger>
          </TabsList>
          <TabsContent value="sign-in" className="text-muted">
            {c("signInPanel")}
          </TabsContent>
          <TabsContent value="register" className="text-muted">
            {c("registerPanel")}
          </TabsContent>
        </Tabs>
      </SampleGroup>
    </GallerySection>
  );
}
