// Sends one file to its signed upload URL (spec 0006 AC-8). XHR rather than supabase-js, because
// only XHR reports upload progress. Same request as `uploadToSignedUrl`: a PUT of the raw file with
// its type, `x-upsert: false`, and the public project key. Browser only.

export class UploadError extends Error {}

export function uploadFile(
  signedUrl: string,
  file: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("content-type", contentType);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader("cache-control", "max-age=3600");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) {
      request.setRequestHeader("apikey", anonKey);
      request.setRequestHeader("authorization", `Bearer ${anonKey}`);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new UploadError(`upload refused with ${request.status}`));
    request.onerror = () => reject(new UploadError("upload failed"));
    request.send(file);
  });
}
