// The order limit (spec 0004 AC-10) and the lookup limit (spec 0015 AC-6) count per IP, and every
// local request shares one. A flow that places orders or looks them up sends its own
// `cf-connecting-ip`, so flows running side by side never spend each other's allowance. Only
// `rate-limit.spec.ts` keeps the shared local IP, which it spends on purpose.

const octet = () => 1 + Math.floor(Math.random() * 250);

/** A random address in 198.18.0.0/15, the range set aside for testing. */
export const ownIp = () => `198.18.${octet()}.${octet()}`;

/** Headers for a new browser context of its own. */
export const ownIpHeaders = () => ({ "cf-connecting-ip": ownIp() });
