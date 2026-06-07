import { ApiError } from "./api";
import type { ViewKey } from "./App";

// Shared error handler for metered AI calls: a 402 (out of credits) nudges the
// user to the pricing page; everything else is a plain toast.
export function makeAiErrorHandler(
  toast: (msg: string, err?: boolean) => void,
  goto?: (v: ViewKey) => void
) {
  return (e: unknown) => {
    if (e instanceof ApiError && e.status === 402) {
      toast(e.message, true);
      goto?.("pricing");
    } else {
      toast((e as Error).message, true);
    }
  };
}
