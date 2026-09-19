# tt for VS Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/vladyslav005.tt-vscode-extension)](https://marketplace.visualstudio.com/items?itemName=vladyslav005.tt-vscode-extension)
[![License: MIT](https://img.shields.io/github/license/vladyslav005/Type-Theory)](LICENSE)

**[Install from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=vladyslav005.tt-vscode-extension)**

Language support for **tt**, a typed lambda calculus playground language, directly in the editor —
syntax highlighting, live diagnostics, completions, and the same AST / typing-derivation / evaluation
views as the web playground ([type-theory.dev](https://type-theory.dev) /
[tt-woad.vercel.app](https://tt-woad.vercel.app/)), rendered as native VS Code panels.

> tt is also available as a web app at **[type-theory.dev](https://type-theory.dev)** (mirrored at
> **[tt-woad.vercel.app](https://tt-woad.vercel.app/)**). This extension is for working with `.tt`
> files locally in your editor instead.

## Features

### Editing

- **Syntax highlighting** for `.tt` files, plus two bundled color themes (TT Light / TT Dark) tuned for it.
- **Live diagnostics** — parse and type errors underlined as you type, respecting whichever type-theory
  extensions you have enabled (see below).
- **Completions** — keywords, in-scope variable names, and backslash-triggered shortcuts for special
  syntax (`\to` → `->`, `\lambda` → `λ`, the full Greek alphabet, `\forall`, `\Pi`, ...).
- A small **λ badge** on `.tt` files in the Explorer, layered on top of whatever file-icon theme
  you already use — it doesn't replace or require switching your icon theme.

### Type theory & evaluation

tt supports six optional extensions on top of plain simply-typed lambda calculus: let-polymorphism,
type inference, iso-recursive types, System F, System Fω, and System λP (dependent types). And three
evaluation strategies: normal order, call-by-value, call-by-name.

- **`TT: Toggle Type Theories`** — multi-select picker to enable/disable extensions.
- **`TT: Choose Evaluation Strategy`** — pick the reduction strategy used everywhere below.
- Both are also one click away from the **status bar** whenever a `.tt` file is active.
- **`TT: Evaluate Current File`** — runs evaluation and prints the strategy, each reduction step, and
  the result to the **"TT" Output Channel**.

### Visual panels

Three panels mirror the web app's visualizations, built to open together automatically the first time
you open a `.tt` file (and stay closed if you close one — they won't nag you back open):

- **Evaluation Steps** (`TT: Show Evaluation Steps`) — the reduction trace, step by step.
- **Proof Tree** (`TT: Show Proof Tree`) — the typing derivation, with a toggle for the Curry–Howard
  (propositional logic) view when the term uses no type-theory extension. Pan by dragging, zoom with
  the wheel/pinch; hover a judgement to highlight its source span in the editor (never steals focus or
  moves your cursor).
- **AST Diagram** (`TT: Show AST Diagram`) — the parsed syntax tree as a node-link graph, colored by
  node category (declarations / terms / types / kinds), same pan/zoom/hover-highlight interaction.

There's also a plain **"TT AST"** tree view in the Explorer sidebar for quick text-based browsing —
click a node to jump straight to it in the source.

**`TT: Export Proof Tree as LaTeX`** writes the current derivation (or its Curry–Howard reading, if
applicable) to a standalone `ebproof`/`amsmath` `.tex` file, ready to compile or drop into a paper.

## Requirements

None beyond VS Code itself — no external tooling or language server to install.

## Extension Settings

- `tt.typeTheories.letPolymorphism`, `tt.typeTheories.typeInference`, `tt.typeTheories.isoRecursiveTypes`,
  `tt.typeTheories.systemF`, `tt.typeTheories.systemFOmega`, `tt.typeTheories.systemLambdaP` — booleans,
  default `false`. Same as the `TT: Toggle Type Theories` picker, editable directly in `settings.json`.
- `tt.evaluationStrategy` — `"NORMAL" | "CALL_BY_VALUE" | "CALL_BY_NAME"`, default `"CALL_BY_VALUE"`.

## Commands

| Command | Description |
| --- | --- |
| `TT: Parse Current File` | Quick parse check with a pass/fail notification. |
| `TT: Evaluate Current File` | Evaluate and print the trace to the Output Channel. |
| `TT: Toggle Type Theories` | Multi-select which extensions are enabled. |
| `TT: Choose Evaluation Strategy` | Pick normal order / call-by-value / call-by-name. |
| `TT: Show Evaluation Steps` | Open the evaluation trace panel. |
| `TT: Show Proof Tree` | Open the typing derivation panel. |
| `TT: Show AST Diagram` | Open the AST graph panel. |
| `TT: Export Proof Tree as LaTeX` | Save the current derivation as a standalone `.tex` file. |

## Known limitations

- The AST sidebar tree doesn't preserve which nodes were expanded across an edit (VS Code recreates
  tree items on refresh) — a cosmetic rough edge, not a data issue.
- Proof tree judgements are rendered as plain unicode text (Γ, ⊢, λ, →, ...) in the panel itself, not
  full LaTeX typesetting — there's no MathJax dependency here by design, to keep the extension
  lightweight. Use `TT: Export Proof Tree as LaTeX` for a properly typeset version.

## Related

- **Source**: [github.com/vladyslav005/Type-Theory/tree/main/apps/vscode-extension](https://github.com/vladyslav005/Type-Theory/tree/main/apps/vscode-extension)
- Web playground: **[type-theory.dev](https://type-theory.dev)** /
  **[tt-woad.vercel.app](https://tt-woad.vercel.app/)**
- [`@vladyslav005/tt-core`](https://www.npmjs.com/package/@vladyslav005/tt-core) — the language engine
  this extension and the web app both build on, published independently on npm.

**Enjoy!**
