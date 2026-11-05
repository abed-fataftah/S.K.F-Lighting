import "server-only";
import { storedObjectFits } from "@/features/catalog/media-rules";
import { findStoredObject } from "@/server/storage/admin";

// The save time check for a new home picture (spec 0011 AC-13), shared by the banner and category
// actions: the key has the server made shape and Storage holds a file whose type and size fit.
// A failed Storage call counts as not fitting, so nothing is written on an unproven key.
export async function storedImageFits(key: string): Promise<boolean> {
  try {
    return storedObjectFits(key, await findStoredObject(key));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "home_media_check_failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return false;
  }
}
