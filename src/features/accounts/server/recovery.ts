import "server-only";
import { cookies } from "next/headers";
import { shopCookieOptions } from "@/features/cart/server/cookies";
import {
  isFreshRecovery,
  RECOVERY_COOKIE,
  RECOVERY_WINDOW_SECONDS,
  recoveryCookieValue,
} from "../recovery-cookie";

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Server Actions only: after a good reset token, for 10 minutes. */
export async function rememberRecovery(userId: string): Promise<void> {
  (await cookies()).set(
    RECOVERY_COOKIE,
    recoveryCookieValue(userId, nowSeconds()),
    shopCookieOptions(RECOVERY_WINDOW_SECONDS),
  );
}

export async function hasFreshRecovery(userId: string): Promise<boolean> {
  return isFreshRecovery((await cookies()).get(RECOVERY_COOKIE)?.value, userId, nowSeconds());
}

/** Server Actions only: one reset link sets one password. */
export async function forgetRecovery(): Promise<void> {
  (await cookies()).delete(RECOVERY_COOKIE);
}
