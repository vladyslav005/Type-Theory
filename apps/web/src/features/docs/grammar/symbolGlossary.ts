export interface SymbolEntry {
  symbol: string;
  name: string;
  meaning: string;
  howToType?: string; // present only for symbols that appear in actual source code
}

// Typed via \-triggered Monaco completion — see src/features/editor/hooks/setUpEditor.ts.
export const TYPED_SYMBOLS: SymbolEntry[] = [
  {symbol: "λ", name: "Lambda", meaning: "Term abstraction binder — λx:T. t", howToType: "\\ or \\lambda"},
  {symbol: "Λ", name: "Capital Lambda", meaning: "Type abstraction binder (System F) — ΛX. t", howToType: "\\Lambda"},
  {symbol: "→", name: "Arrow", meaning: "Function type / kind arrow — T1 → T2", howToType: "\\to  (or plain ->)"},
  {symbol: "⇒", name: "Double arrow", meaning: "Case/variant-case branch arrow — inl x => t", howToType: "plain =>"},
  {symbol: "∀", name: "Forall", meaning: "Universal type quantifier (System F) — ∀X. T", howToType: "\\forall"},
  {symbol: "Π", name: "Pi", meaning: "Dependent function type binder (System λP) — Πx:A. B", howToType: "\\Pi"},
  {symbol: "μ", name: "Mu", meaning: "Recursive type binder — μX. T", howToType: "\\mu"},
  {symbol: "@", name: "Kind star", meaning: "∗ (\"star\"), the kind of ordinary types — the rules write ∗, but the concrete syntax spells it @ because * is already the tuple/product type separator ⟨A * B⟩", howToType: "plain @"},
  {symbol: "×", name: "Times", meaning: "Alternative multiplication symbol, same as *", howToType: "\\times  (or plain *)"},
  {symbol: "α β γ ...", name: "Greek letters", meaning: "Conventional names for type variables", howToType: "\\alpha, \\beta, \\gamma, ..."},
];

// Rendered by the app (proof trees, rules); never typed, not part of the grammar.
export const NOTATION_SYMBOLS: SymbolEntry[] = [
  {
    symbol: "Γ",
    name: "Gamma",
    meaning: "The context — term-variable : type bindings, and (for kinding judgements) type-variable : kind bindings too. The app uses one combined Γ at every level rather than a separate Δ for kinds.",
  },
  {symbol: "⊢", name: "Turnstile", meaning: "\"Proves\" / \"derives\" — Γ ⊢ t : T reads \"under Γ, t has type T\" (and Γ ⊢ T : K reads the same way for kinding)"},
  {symbol: "∈", name: "Element of", meaning: "Set membership — x : T ∈ Γ reads \"x : T is a binding in Γ\""},
  {symbol: "[X ↦ S]T", name: "Substitution", meaning: "T with every free occurrence of X replaced by S"},
  {symbol: "≡", name: "Type equivalence", meaning: "Two types that reduce to the same normal form — used by the Conv rule"},
];
