import {PRELUDE_CODE} from "@/features/editor/components/InsertPreludeButton.tsx";

const DEFINITION = /^\s*([A-Za-z_]\w*)\s*=/;

// What the Prelude button should prepend: the whole prelude, only the definitions the editor still lacks,
// or null when they are all there — a second click would otherwise declare every combinator twice.
export function preludeToInsert(current: string): string | null {
  const defined = new Set(current.split("\n").map((line) => DEFINITION.exec(line)?.[1]).filter(Boolean));
  const definitions = PRELUDE_CODE.split("\n").filter((line) => DEFINITION.test(line));
  const missing = definitions.filter((line) => !defined.has(DEFINITION.exec(line)![1]));
  if (missing.length === 0) return null;
  if (missing.length === definitions.length) return PRELUDE_CODE;
  return `// Prelude — the definitions that were missing\n${missing.join("\n")}\n`;
}
