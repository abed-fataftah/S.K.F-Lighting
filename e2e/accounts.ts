import { expect, type Page } from "@playwright/test";
import type postgres from "postgres";
import { serviceClient } from "./admin-auth";

// Helpers for the customer account flows (spec 0017 AC-18): unique accounts made through the
// Supabase admin API when a flow is not about registering, the reset email from the local mail
// catcher (Mailpit, port 54324), and a sellable product for a real checkout.

const MAILPIT = "http://127.0.0.1:54324";

export const ACCOUNT_EMAIL_PREFIX = "e2e-acc-";

// Every email this worker handed out, so it removes its own accounts and no other worker's.
const issued: string[] = [];

/** An email no other run or worker uses. */
export function uniqueEmail(label: string): string {
  const stamp = `${Date.now().toString(36)}${process.pid.toString(36)}${issued.length}`;
  const email = `${ACCOUNT_EMAIL_PREFIX}${label}-${stamp}@skf.test`;
  issued.push(email);
  return email;
}

/** A confirmed customer account, as if registered, with its profile phone set. */
export async function createCustomer(
  sql: postgres.Sql,
  opts: { email: string; password: string; name: string; phone?: string },
): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: { full_name: opts.name },
  });
  if (error) throw error;
  if (opts.phone) {
    const national = opts.phone.replace(/^0/, "");
    await sql`update profiles set phone = ${opts.phone}, phone_e164 = ${`+970${national}`}
      where id = ${data.user.id}`;
  }
  return data.user.id;
}

/** Removes the accounts this worker's flows made; their orders keep a null owner. */
export async function removeTestAccounts(sql: postgres.Sql) {
  if (issued.length) await sql`delete from auth.users where email in ${sql(issued)}`;
}

type MailpitList = { messages: { ID: string; To: { Address: string }[] }[] };

/** The reset link in the newest email to `email`, waiting for it to arrive. */
export async function resetLinkFor(email: string): Promise<string> {
  let link: string | null = null;
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${email}"`);
        const list = (await (
          await fetch(`${MAILPIT}/api/v1/search?query=${query}`)
        ).json()) as MailpitList;
        // The search matches word pieces too, so another worker's reset email can come first.
        const newest = list.messages.find((message) =>
          message.To.some((to) => to.Address.toLowerCase() === email),
        );
        if (!newest) return null;
        const message = (await (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)).json()) as {
          HTML: string;
        };
        link =
          /href="([^"]*token_hash=[^"]*)"/.exec(message.HTML)?.[1]?.replaceAll("&amp;", "&") ??
          null;
        return link;
      },
      { timeout: 20_000 },
    )
    .not.toBeNull();
  return link!;
}

/** A variant the shop sells right now, for a checkout through the real form. */
export async function sellableVariant(sql: postgres.Sql): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    select v.id from product_variants v
    join products p on p.id = v.product_id
    join categories c on c.id = p.category_id
    left join categories m on m.id = c.parent_id
    where p.status = 'active' and p.is_available and v.is_available and v.archived_at is null
      and c.is_visible and coalesce(m.is_visible, true)
      -- The dev seed's only: other specs delete their own products when they end, which an order
      -- line pointing at one would block.
      and p.code like 'DEMO-%'
    order by p.code limit 1`;
  if (!row) throw new Error("No sellable product: run pnpm db:seed first");
  return row.id;
}

/** One line in this browser's cart, as the product page leaves it. */
export async function fillCart(page: Page, baseURL: string, variantId: string) {
  await page.context().addCookies([
    {
      name: "skf_cart",
      value: encodeURIComponent(JSON.stringify([{ v: variantId, q: 1 }])),
      url: baseURL,
    },
  ]);
}

/** Email and password on the sign in tab of /account/sign-in. */
export async function signInCustomer(page: Page, email: string, password: string) {
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await page.getByTestId("login-submit").click();
}
