// The public Storage address of a product media object (spec 0009): the video's source and the
// JSON-LD images. Photos on screen go through `src/image-loader.ts` instead, which resizes them.
export function mediaObjectUrl(base: string, key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/product-media/${path}`;
}
