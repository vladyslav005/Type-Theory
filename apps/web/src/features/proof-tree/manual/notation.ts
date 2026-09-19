// Lets students type the notation without hunting for symbols: \forall, ->, \Gamma, ...
const SHORTCUTS: [RegExp, string][] = [
  [/\\forall\s?/g, "∀"],
  [/\\Gamma\s?/g, "Γ"],
  [/\\emptyset\s?/g, "∅"],
  [/\\in\b\s?/g, "∈"],
  [/\\lambda\s?/g, "λ"],
  [/\\cup\b\s?/g, "∪"],
  [/->/g, "→"],
  [/⟨/g, "<"],
  [/⟩/g, ">"],
];

export function applyShortcuts(text: string): string {
  return SHORTCUTS.reduce((acc, [pattern, symbol]) => acc.replace(pattern, symbol), text);
}

