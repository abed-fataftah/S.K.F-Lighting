// Where the proxy rewrites an address with a broken `%` (src/proxy.ts). A static route on purpose:
// Next decodes a catch all's params from the original address and fails, so `[...rest]` cannot
// take it. Same designed 404 as any unknown address (spec 0013 AC-2, spec 0029 AC-17). Opening
// `/broken-address` directly also gives that 404, so the word is reserved (`routes.brokenAddress`).
export { default, generateMetadata } from "../[...rest]/page";
