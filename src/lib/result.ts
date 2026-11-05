// The shape every Server Action returns for an expected outcome (AGENTS.md, Errors): bugs throw.
export type Ok<T> = { readonly ok: true; readonly data: T };
export type Fail<E extends string, X = unknown> = { readonly ok: false; readonly error: E } & X;
export type Result<T, E extends string, X = unknown> = Ok<T> | Fail<E, X>;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
export const fail = <E extends string>(error: E): Fail<E> => ({ ok: false, error });
