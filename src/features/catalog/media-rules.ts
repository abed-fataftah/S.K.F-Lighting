// Product photo and video rules (spec 0006 AC-8, AC-15, AC-16). Pure: the browser, the upload
// action, the save, and the weekly sweep all read the same limits and key shapes from here.

export const MEDIA_LIMITS = {
  maxImages: 8,
  maxVideos: 1,
  /** Photos are resized in the browser first, so this is the most a resized photo may weigh. */
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  /** The longest edge of a resized photo, in pixels; photos are never enlarged. */
  maxEdge: 2000,
} as const;

export const MEDIA_BUCKET = "product-media";

/** Saved keys younger than this are kept by the after save cleanup: an upload may still be on its way. */
export const CLEANUP_MIN_AGE_MS = 60 * 60 * 1000;
/** The weekly sweep leaves a folder alone while anything in it is newer than this. */
export const SWEEP_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type MediaKind = "image" | "video";
export type MediaExt = "webp" | "jpg" | "mp4";

export const MEDIA_TYPES = {
  "image/webp": { kind: "image", ext: "webp" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "video/mp4": { kind: "video", ext: "mp4" },
} as const satisfies Record<string, { kind: MediaKind; ext: MediaExt }>;

export type MediaContentType = keyof typeof MEDIA_TYPES;

const MIME_OF_EXT: Readonly<Record<MediaExt, MediaContentType>> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  mp4: "video/mp4",
};

export const isMediaContentType = (type: string): type is MediaContentType => type in MEDIA_TYPES;

export const maxBytesFor = (kind: MediaKind): number =>
  kind === "image" ? MEDIA_LIMITS.imageMaxBytes : MEDIA_LIMITS.videoMaxBytes;

/** `products/<productId>/<uuid>.<ext>`: the only key shape Storage ever gets (spec 0001). */
export function mediaKey(productId: string, uuid: string, ext: MediaExt): string {
  return `${productFolder(productId)}${uuid.toLowerCase()}.${ext}`;
}

/** `products/<productId>/`, the folder that holds one product's files. */
export function productFolder(productId: string): string {
  return `products/${productId.toLowerCase()}/`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY = new RegExp(`^products/(${UUID})/(${UUID})\\.(webp|jpg|mp4)$`);

/** The parts of a well formed key, or null. */
export function parseMediaKey(
  key: string,
): { readonly productId: string; readonly ext: MediaExt; readonly kind: MediaKind } | null {
  const match = KEY.exec(key);
  if (!match) return null;
  const ext = match[3] as MediaExt;
  return { productId: match[1], ext, kind: MEDIA_TYPES[MIME_OF_EXT[ext]].kind };
}

/** True only for a key under this product's own folder, in the exact shape the server makes. */
export function isKeyForProduct(key: string, productId: string): boolean {
  return parseMediaKey(key)?.productId === productId.toLowerCase();
}

export type StoredObject = {
  readonly name: string;
  readonly createdAt: Date | null;
  readonly mimetype: string | null;
  readonly size: number | null;
};

// The homepage's pictures (spec 0011 AC-13): a banner, or a main category's circle photo, each in
// its own flat folder of the same bucket. Photos only, cropped and resized in the browser first.
export type HomeImageTarget = "banner" | "category";
export type HomeImageExt = "webp" | "jpg";

export const HOME_IMAGE_FOLDERS = {
  banner: "banners",
  category: "categories",
} as const satisfies Record<HomeImageTarget, string>;

/** The centred area each home picture is cropped to, its largest size, and the narrowest source kept. */
export const HOME_CROPS = {
  banner: { aspectWidth: 16, aspectHeight: 9, maxWidth: 1600, minWidth: 800 },
  category: { aspectWidth: 1, aspectHeight: 1, maxWidth: 800, minWidth: 400 },
} as const satisfies Record<HomeImageTarget, CropRule>;

export type CropRule = {
  readonly aspectWidth: number;
  readonly aspectHeight: number;
  /** The widest result, in pixels; a picture is never enlarged. */
  readonly maxWidth: number;
  /** A crop narrower than this is refused as too small. */
  readonly minWidth: number;
};

/** `banners/<uuid>.<ext>` or `categories/<uuid>.<ext>`: the only home key shapes Storage gets. */
export function homeImageKey(target: HomeImageTarget, uuid: string, ext: HomeImageExt): string {
  return `${HOME_IMAGE_FOLDERS[target]}/${uuid.toLowerCase()}.${ext}`;
}

const HOME_KEY = new RegExp(`^(banners|categories)/${UUID}\\.(webp|jpg)$`);

/** The parts of a well formed home key, or null. */
export function parseHomeImageKey(
  key: string,
): { readonly target: HomeImageTarget; readonly ext: HomeImageExt } | null {
  const match = HOME_KEY.exec(key);
  if (!match) return null;
  return { target: match[1] === "banners" ? "banner" : "category", ext: match[2] as HomeImageExt };
}

/** True only for a key in the exact shape the server makes for this target. */
export function isHomeImageKey(key: string, target: HomeImageTarget): boolean {
  return parseHomeImageKey(key)?.target === target;
}

/** The real file in Storage fits its key: the type matches the extension and the size its limit. */
export function storedObjectFits(key: string, object: StoredObject | undefined): boolean {
  const parsed = parseMediaKey(key) ?? parseHomeImageKey(key);
  if (!parsed || !object) return false;
  const kind: MediaKind = "kind" in parsed ? parsed.kind : "image";
  return (
    object.mimetype === MIME_OF_EXT[parsed.ext] &&
    object.size !== null &&
    object.size > 0 &&
    object.size <= maxBytesFor(kind)
  );
}

export type MediaItem = {
  readonly storageKey: string;
  readonly kind: MediaKind;
  readonly width: number | null;
  readonly height: number | null;
};

/** Photos in the order given, then the video: the `sort` each saved row gets (0 is the main photo). */
export function orderMedia<M extends { readonly kind: MediaKind }>(
  media: readonly M[],
): readonly (M & { readonly sort: number })[] {
  return [
    ...media.filter((item) => item.kind === "image"),
    ...media.filter((item) => item.kind === "video"),
  ].map((item, sort) => ({ ...item, sort }));
}

/** Files in a product's folder that no saved row points at and that are old enough to be leftovers. */
export function leftoverKeys(
  folder: readonly StoredObject[],
  keptKeys: ReadonlySet<string>,
  productId: string,
  now: Date,
): readonly string[] {
  return folder
    .map((object) => ({ object, key: `${productFolder(productId)}${object.name}` }))
    .filter(
      ({ object, key }) =>
        !keptKeys.has(key) &&
        object.createdAt !== null &&
        now.getTime() - object.createdAt.getTime() > CLEANUP_MIN_AGE_MS,
    )
    .map(({ key }) => key);
}

export type FolderAge = {
  /** The `<id>` part of `products/<id>/`. */
  readonly productId: string;
  /** The newest file in the folder, or null when it is empty. */
  readonly newest: Date | null;
};

/** Folders whose product no longer exists and that have been quiet for a day (the weekly sweep). */
export function orphanFolders(
  folders: readonly FolderAge[],
  productIds: ReadonlySet<string>,
  now: Date,
): readonly string[] {
  return folders
    .filter(
      ({ productId, newest }) =>
        !productIds.has(productId.toLowerCase()) &&
        (newest === null || now.getTime() - newest.getTime() > SWEEP_MIN_AGE_MS),
    )
    .map(({ productId }) => productId);
}

/**
 * Home pictures (`banners/` or `categories/` files, by full key) that no row points at and that are
 * more than a day old: closed dialogs and failed after commit removals (the weekly sweep, AC-13).
 */
export function homeImageLeftovers(
  files: readonly (StoredObject & { readonly key: string })[],
  keptKeys: ReadonlySet<string>,
  now: Date,
): readonly string[] {
  return files
    .filter(
      (file) =>
        !keptKeys.has(file.key) &&
        file.createdAt !== null &&
        now.getTime() - file.createdAt.getTime() > SWEEP_MIN_AGE_MS,
    )
    .map((file) => file.key);
}
