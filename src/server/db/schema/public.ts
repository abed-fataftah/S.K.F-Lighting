// The tables Drizzle migrates (public schema, spec 0002). drizzle.config.ts reads this barrel,
// not index.ts: `drizzle-kit generate` ignores schemaFilter and would create the auth stub.
// Later features add drafts, payments, loyalty, returns, and content tables here.
export * from "./enums";
export * from "./profiles";
export * from "./catalog";
export * from "./settings";
export * from "./orders";
export * from "./content";
