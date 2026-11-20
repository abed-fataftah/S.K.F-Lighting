// Where the proxy rewrites an address with a broken `%` (src/proxy.ts). A static route on purpose:
// Next decodes a catch all's params from the original address and fails, so `[...rest]` cannot
// take it. Same designed 404 as any unknown address (spec 0013 AC-2, spec 0029 AC-17).
export { default, generateMetadata } from "../[...rest]/page";
