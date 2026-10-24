"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useEffect,
  useReducer,
  useRef,
  useTransition,
  type ReactNode,
} from "react";
import { addToCart } from "@/features/cart/server/actions";
import { MIN_QUANTITY } from "@/lib/quantity";
import { routes } from "@/lib/routes";
import {
  chooseColour,
  chooseSize,
  hasOptions,
  reconcileSelection,
  type ProductPageData,
} from "../product-view";

const ADDED_MS = 2000;

export type AddProblem = "cart_full" | "not_sellable" | "failed";

type State = {
  readonly selectedId: string | null;
  readonly quantity: number;
  readonly added: boolean;
  /** The cart link stays once something was added, after the 2 second label has gone. */
  readonly addedOnce: boolean;
  readonly problem: AddProblem | null;
};

type Action =
  | { readonly type: "choose"; readonly id: string | null }
  | { readonly type: "reconcile"; readonly id: string | null }
  | { readonly type: "quantity"; readonly value: number }
  | { readonly type: "adding" }
  | { readonly type: "added" }
  | { readonly type: "addedDone" }
  | { readonly type: "problem"; readonly problem: AddProblem };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "choose":
      // A visitor's choice clears the added state and any problem (AC-8).
      return action.id === state.selectedId
        ? state
        : { ...state, selectedId: action.id, added: false, problem: null };
    case "reconcile":
      // A move after a refresh keeps the problem that caused it; out of stock resets the quantity.
      return {
        ...state,
        selectedId: action.id,
        added: false,
        quantity: action.id === null ? MIN_QUANTITY : state.quantity,
      };
    case "quantity":
      return { ...state, quantity: action.value };
    case "adding":
      return { ...state, problem: null };
    case "added":
      return { ...state, added: true, addedOnce: true };
    case "addedDone":
      return { ...state, added: false };
    case "problem":
      return { ...state, problem: action.problem };
  }
}

type Selection = State & {
  readonly data: ProductPageData;
  readonly pending: boolean;
  readonly chooseSize: (size: string) => void;
  readonly chooseColour: (colourId: string) => void;
  readonly setQuantity: (value: number) => void;
  readonly add: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

export function useProductSelection(): Selection {
  const selection = use(SelectionContext);
  if (!selection) throw new Error("useProductSelection needs a ProductSelectionProvider");
  return selection;
}

// The one client island the product page's choosing parts share (spec 0009, Decision): the
// server's data seeds it, the chip handlers write `?v` into the address, and a refresh after a
// stale add reconciles the choice with the new data.
export function ProductSelectionProvider({
  data,
  children,
}: {
  readonly data: ProductPageData;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    selectedId: data.selectedId,
    quantity: MIN_QUANTITY,
    added: false,
    addedOnce: false,
    problem: null,
  });
  const [pending, startTransition] = useTransition();

  // Only ever called from a handler or after a refresh moved the choice, never on mount (AC-6).
  const writeAddress = (id: string | null) => {
    if (id && hasOptions(data.options)) {
      window.history.replaceState(null, "", routes.product(data.slug, { variant: id }));
    }
  };

  const choose = (id: string | null) => {
    if (id === state.selectedId) return;
    dispatch({ type: "choose", id });
    writeAddress(id);
  };

  // The latest choice, for the reconcile effect below; it runs only when the server data changes.
  const latest = useRef(state.selectedId);
  useEffect(() => {
    latest.current = state.selectedId;
  });
  useEffect(() => {
    const next = reconcileSelection(data.options, latest.current, data.selectedId);
    if (next === latest.current) return;
    dispatch({ type: "reconcile", id: next });
    if (next && hasOptions(data.options)) {
      window.history.replaceState(null, "", routes.product(data.slug, { variant: next }));
    }
  }, [data]);

  useEffect(() => {
    if (!state.added) return;
    const timer = setTimeout(() => dispatch({ type: "addedDone" }), ADDED_MS);
    return () => clearTimeout(timer);
  }, [state.added]);

  const add = () => {
    const variantId = state.selectedId;
    if (!variantId) return;
    startTransition(async () => {
      dispatch({ type: "adding" });
      try {
        const result = await addToCart(variantId, state.quantity);
        if (result.ok) dispatch({ type: "added" });
        else if (result.error === "not_sellable") {
          // The pair sold out after the page loaded: say so, then fetch fresh stock (AC-8).
          dispatch({ type: "problem", problem: "not_sellable" });
          router.refresh();
        } else
          dispatch({
            type: "problem",
            problem: result.error === "invalid" ? "failed" : result.error,
          });
      } catch {
        dispatch({ type: "problem", problem: "failed" });
      }
    });
  };

  const selection: Selection = {
    ...state,
    data,
    pending,
    chooseSize: (size) => choose(chooseSize(data.options, state.selectedId, size)),
    chooseColour: (colourId) => choose(chooseColour(data.options, state.selectedId, colourId)),
    setQuantity: (value) => dispatch({ type: "quantity", value }),
    add,
  };

  return <SelectionContext value={selection}>{children}</SelectionContext>;
}
