import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// A genuinely-diverging term (e.g. the raw Y-combinator under Call-by-value) can produce an
// evaluation trace whose JSON representation is too large for JSON.stringify itself to build
// (RangeError: Invalid string length) — used by the "View Raw ... Data (DEBUG)" panels, which
// must never crash the page just because the user is inspecting an intentionally huge result.
export function safeJsonStringify(value: unknown, space?: string | number): string {
  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `<data too large to display: ${reason}>`;
  }
}

