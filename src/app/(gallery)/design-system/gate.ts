import "server-only";
import { notFound } from "next/navigation";
import type { ServerEnv } from "@/server/env";

// The gallery holds sample data only; it is a 404 unless DESIGN_SYSTEM_PAGE=1 (spec 0003, AC-19).
export function assertDesignSystemPageOn(env: ServerEnv): void {
  if (!env.designSystemPage) notFound();
}
