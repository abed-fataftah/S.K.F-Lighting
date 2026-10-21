import "server-only";
import { createClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, productFolder, type StoredObject } from "@/features/catalog/media-rules";
import { storageEnv } from "./env";

// Storage admin calls with the service role key (spec 0006, Security model). The client is made per
// call: Workers cannot share I/O across requests. Only the server chooses keys; see media-rules.ts.

const PAGE = 100;

function bucket() {
  const { url, serviceRoleKey } = storageEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(MEDIA_BUCKET);
}

/** A one time upload for one server chosen key; `upsert: false`, so a key is never overwritten. */
export async function createSignedUpload(key: string) {
  const { data, error } = await bucket().createSignedUploadUrl(key, { upsert: false });
  if (error) throw error;
  return { signedUrl: data.signedUrl, token: data.token };
}

type Entry = {
  readonly name: string;
  readonly id: string | null;
  readonly created_at?: string | null;
  readonly metadata?: Record<string, unknown> | null;
};

/** Every entry under `prefix`, a page of 100 at a time. Folders come back with a null `id`. */
async function listAll(prefix: string): Promise<readonly Entry[]> {
  const storage = bucket();
  const entries: Entry[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    entries.push(...(data as Entry[]));
    if (data.length < PAGE) return entries;
  }
}

const toStored = (entry: Entry): StoredObject => ({
  name: entry.name,
  createdAt: entry.created_at ? new Date(entry.created_at) : null,
  mimetype: typeof entry.metadata?.mimetype === "string" ? entry.metadata.mimetype : null,
  size: typeof entry.metadata?.size === "number" ? entry.metadata.size : null,
});

/** The files in `products/<productId>/`, with the type and size Storage itself recorded. */
export async function listProductFolder(productId: string): Promise<readonly StoredObject[]> {
  const entries = await listAll(productFolder(productId).slice(0, -1));
  return entries.filter((entry) => entry.id !== null).map(toStored);
}

/** The `<id>` of every `products/<id>/` folder. */
export async function listProductFolderIds(): Promise<readonly string[]> {
  const entries = await listAll("products");
  return entries.filter((entry) => entry.id === null).map((entry) => entry.name);
}

export async function removeKeys(keys: readonly string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += PAGE) {
    const { error } = await bucket().remove(keys.slice(i, i + PAGE));
    if (error) throw error;
  }
}

/** Removes everything in `products/<productId>/`. */
export async function removeProductFolder(productId: string): Promise<void> {
  const files = await listProductFolder(productId);
  await removeKeys(files.map((file) => `${productFolder(productId)}${file.name}`));
}
