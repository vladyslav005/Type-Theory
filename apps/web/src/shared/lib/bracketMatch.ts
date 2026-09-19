const OPENERS: Record<string, string> = {"(": ")", "[": "]", "{": "}"};
const CLOSERS: Record<string, string> = {")": "(", "]": "[", "}": "{"};

export interface BracketAnalysis {
  unmatched: Set<number>;
  cursor?: {at: number; partner: number; opening: boolean};
}

export function analyzeBrackets(text: string, caret: number | null): BracketAnalysis {
  const partners = new Map<number, number>();
  const unmatched = new Set<number>();
  const stack: {char: string; index: number}[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch in OPENERS) {
      stack.push({char: ch, index: i});
    } else if (ch in CLOSERS) {
      const top = stack[stack.length - 1];
      if (top && top.char === CLOSERS[ch]) {
        stack.pop();
        partners.set(top.index, i);
        partners.set(i, top.index);
      } else {
        unmatched.add(i);
      }
    }
  }
  stack.forEach((s) => unmatched.add(s.index));

  let cursor: BracketAnalysis["cursor"];
  if (caret !== null) {
    for (const at of [caret - 1, caret]) {
      const partner = partners.get(at);
      if (at >= 0 && at < text.length && partner !== undefined) {
        cursor = {at, partner, opening: text[at] in OPENERS};
        break;
      }
    }
  }
  return {unmatched, cursor};
}
