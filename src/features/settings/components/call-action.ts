import { fail, type Fail } from "@/lib/result";

/** An action whose request never came back (offline, a dropped connection) counts as `failed`. */
export async function callAction<R>(run: () => Promise<R>): Promise<R | Fail<"failed">> {
  try {
    return await run();
  } catch {
    return fail("failed");
  }
}
