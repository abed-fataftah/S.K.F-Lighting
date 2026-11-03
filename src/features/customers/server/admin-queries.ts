import "server-only";
import { and, desc, eq, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";
import { readMyOrders } from "@/features/orders/server/my-orders";
import { ARABIC_MARKS_SOURCE } from "@/lib/arabic";
import { pageWindow, splitPage } from "@/lib/paging";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { accountEvents, authUsers, orders, profiles } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { isUuid } from "@/lib/uuid";
import type { CustomerTotals, DetailField } from "../account-rules";
import { ASSIGNABLE_ROLES, type AssignableRole } from "../roles";
import type { CustomerSearch } from "../search";

// The dashboard's customer reads (spec 0019 API surface). Each public query runs
// `requireAdminPage()` itself, so a page that forgets the layout guard still shows nothing to
// anyone else. Admin profiles are filtered out of every read (AC-1).

type Db = Database | Transaction;

export const ADMIN_CUSTOMERS_PAGE_SIZE = 50;
/** Search shows at most this many rows (AC-3); one more is read to know there are others. */
export const CUSTOMER_SEARCH_LIMIT = 50;

export type AdminCustomerRow = {
  readonly id: string;
  readonly fullName: string | null;
  /** As typed, the way the account page shows it. */
  readonly phone: string | null;
  readonly role: AssignableRole;
  /** Orders that are not cancelled. */
  readonly orderCount: number;
  /** Has a `removed` event: step 1 of a removal ran, step 2 did not (AC-12). */
  readonly removalPending: boolean;
};

// Always table qualified: a select over one table renders its columns bare, and a bare `id`
// inside a subquery would name the subquery's own table.
const profileId = sql`${sql.identifier("profiles")}.${sql.identifier("id")}`;

const orderCount = sql<number>`(select count(*) from ${orders} o where o.placed_by_user_id = ${profileId} and o.status <> 'cancelled')::int`;

const removalPending = sql<boolean>`exists (select 1 from ${accountEvents} e where e.profile_id = ${profileId} and e.type = 'removed')`;

const assignable = inArray(profiles.role, [...ASSIGNABLE_ROLES]);

const rowColumns = {
  id: profiles.id,
  fullName: profiles.fullName,
  phone: profiles.phone,
  role: sql<AssignableRole>`${profiles.role}`,
  orderCount,
  removalPending,
};

const newestFirst = [desc(profiles.createdAt), desc(profiles.id)] as const;

export async function readAdminCustomers(
  db: Db,
  page: number,
): Promise<{ readonly rows: readonly AdminCustomerRow[]; readonly hasNext: boolean }> {
  const { limit, offset } = pageWindow(page, ADMIN_CUSTOMERS_PAGE_SIZE);
  const rows = await db
    .select(rowColumns)
    .from(profiles)
    .where(assignable)
    .orderBy(...newestFirst)
    .limit(limit)
    .offset(offset);
  return splitPage(rows, ADMIN_CUSTOMERS_PAGE_SIZE);
}

export async function listAdminCustomers(page: number) {
  await requireAdminPage(routes.admin.customersPage(page));
  return readAdminCustomers(await getDb(), page);
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * A name folded the way `normalizeForSearch` folds it (AC-3): marks and tatweel dropped, lower
 * case, the hamza and alef forms, alef maqsura, ta marbuta, and the Persian letters mapped. It skips
 * NFKC and the presentation forms; names typed through the shop's forms are tidied already.
 */
export function searchNameSql(column: SQL | typeof profiles.fullName): SQL<string> {
  return sql<string>`translate(lower(regexp_replace(coalesce(${column}, ''), ${`[${ARABIC_MARKS_SOURCE}\\u0640]`}, '', 'g')), 'أإآٱىةؤئیک', 'اااايهوييك')`;
}

function searchCondition(search: Exclude<CustomerSearch, { kind: "invalid" }>): SQL {
  switch (search.kind) {
    case "email":
      return ilike(authUsers.email, `%${escapeLike(search.text)}%`);
    case "phone":
      return eq(profiles.phoneE164, search.e164);
    case "name":
      return sql`${searchNameSql(profiles.fullName)} like ${`%${escapeLike(search.folded)}%`}`;
  }
}

/** Up to 50 matching accounts, newest first, and whether more matched (AC-3). */
export async function readCustomerSearch(
  db: Db,
  search: Exclude<CustomerSearch, { kind: "invalid" }>,
): Promise<{ readonly rows: readonly AdminCustomerRow[]; readonly capped: boolean }> {
  const rows = await db
    .select(rowColumns)
    .from(profiles)
    .leftJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(and(assignable, searchCondition(search)))
    .orderBy(...newestFirst)
    .limit(CUSTOMER_SEARCH_LIMIT + 1);
  const { rows: shown, hasNext } = splitPage(rows, CUSTOMER_SEARCH_LIMIT);
  return { rows: shown, capped: hasNext };
}

/** The totals strip (AC-5), summed in SQL; `customerTotals` pins the same rules in tests. */
export async function readCustomerTotals(db: Db, id: string): Promise<CustomerTotals> {
  const [row] = await db
    .select({
      orderCount: sql<number>`(count(*) filter (where ${orders.status} <> 'cancelled'))::int`,
      spent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'delivered'), 0)::int`,
      owed: sql<number>`coalesce(sum(${orders.total} - ${orders.amountPaid}) filter (where ${orders.status} = 'delivered' and ${orders.amountPaid} < ${orders.total}), 0)::int`,
    })
    .from(orders)
    .where(eq(orders.placedByUserId, id));
  return row ?? { orderCount: 0, spent: 0, owed: 0 };
}

export type AdminCustomer = {
  readonly id: string;
  readonly fullName: string | null;
  readonly phone: string | null;
  readonly phoneE164: string | null;
  readonly email: string | null;
  readonly role: AssignableRole;
  readonly createdAt: Date;
  readonly removalPending: boolean;
  readonly totals: CustomerTotals;
};

/** One account for its page, or null for a bad id, a missing profile, or an admin (AC-4). */
export async function readAdminCustomer(db: Db, id: string): Promise<AdminCustomer | null> {
  if (!isUuid(id)) return null;
  const [profile] = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      phone: profiles.phone,
      phoneE164: profiles.phoneE164,
      email: authUsers.email,
      role: sql<AssignableRole>`${profiles.role}`,
      createdAt: profiles.createdAt,
      removalPending,
    })
    .from(profiles)
    .leftJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(and(eq(profiles.id, id), ne(profiles.role, "admin")))
    .limit(1);
  if (!profile) return null;
  return { ...profile, totals: await readCustomerTotals(db, id) };
}

export async function getAdminCustomer(id: string): Promise<AdminCustomer | null> {
  await requireAdminPage(routes.admin.customer(id));
  return readAdminCustomer(await getDb(), id);
}

/** The account's orders, every status, windowed exactly like My Orders (AC-6, spec 0018). */
export async function readCustomerOrders(id: string, page: number) {
  await requireAdminPage(routes.admin.customer(id));
  return readMyOrders(await getDb(), id, page);
}

export type AccountEventRow =
  | {
      readonly id: string;
      readonly type: "role_changed";
      readonly fromRole: AssignableRole;
      readonly toRole: AssignableRole;
      readonly createdAt: Date;
    }
  | {
      readonly id: string;
      readonly type: "details_edited";
      readonly fields: readonly DetailField[];
      readonly createdAt: Date;
    }
  | { readonly id: string; readonly type: "removed"; readonly createdAt: Date };

/** "سجل الحساب" (AC-13), newest first. Only this feature writes the rows, never with `admin`. */
export async function readAccountEventRows(db: Db, id: string): Promise<AccountEventRow[]> {
  const rows = await db
    .select({
      id: accountEvents.id,
      type: accountEvents.type,
      fromRole: accountEvents.fromRole,
      toRole: accountEvents.toRole,
      fields: accountEvents.fields,
      createdAt: accountEvents.createdAt,
    })
    .from(accountEvents)
    .where(eq(accountEvents.profileId, id))
    .orderBy(desc(accountEvents.createdAt), desc(accountEvents.id));
  return rows.map((row): AccountEventRow => {
    switch (row.type) {
      case "role_changed":
        return {
          id: row.id,
          type: row.type,
          fromRole: row.fromRole as AssignableRole,
          toRole: row.toRole as AssignableRole,
          createdAt: row.createdAt,
        };
      case "details_edited":
        return {
          id: row.id,
          type: row.type,
          fields: (row.fields ?? []) as DetailField[],
          createdAt: row.createdAt,
        };
      case "removed":
        return { id: row.id, type: row.type, createdAt: row.createdAt };
    }
  });
}

export async function readAccountEvents(id: string) {
  await requireAdminPage(routes.admin.customer(id));
  return readAccountEventRows(await getDb(), id);
}
