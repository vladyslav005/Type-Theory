import type {TexTree} from "@/presentation/tex/texTree.ts";
import {SYNTAX_DEF_RULE} from "@/presentation/tex/syntaxDerivation.ts";

// A TexTree plus one export-only concern: Build & Check's correctness
// highlighting (green/red), which has no equivalent in the automatic/logic
// trees. Every plain TexTree already satisfies this shape (highlight absent).
export type ExportTree = TexTree & {highlight?: "valid" | "invalid"};

export interface ExportOptions {
  // Keys currently expanded in the browser: `${nodeId}:${segmentIndex}` for a
  // Γ/alias ref (matches JudgementSegments' instanceKey), `def:${nodeId}` for
  // an expanded T-Def/CT-Def/Lemma node, `${nodeId}:gamma` for a Build &
  // Check node's Γ toggle (matches ConclusionBuilder's gammaKey). One flat
  // set because all three key shapes are mutually exclusive by construction.
  expandedKeys: ReadonlySet<string>;
}

const DEF_RULES = new Set(["T-Def", "CT-Def", "Lemma", SYNTAX_DEF_RULE]);

const RULE_SYMBOL_MAP: Record<string, string> = {
  "⇒": "\\Rightarrow ",
  "∧": "\\land ",
  "∨": "\\lor ",
  "⊤": "\\top ",
  "₁": "_1",
  "₂": "_2",
};

function sanitizeComment(s: string): string {
  return s.replace(/[\r\n]+/g, " ");
}

// Mirrors ProofTreeTex.tsx's `.replaceAll('-', ' – ')` display transform.
// Rule strings are either plain ASCII ("T-Abs", "Conv") or, for the Curry–
// Howard logic tree, raw Unicode math symbols ("⇒I", "∨I₁", ...) — pdflatex
// chokes on those in text mode, so they go through a math-mode translation
// instead; ebproof's default label style is already italic, matching the
// browser's italic rule-name style either way.
function ruleLabelLatex(rule: string): string | null {
  if (!rule) return null;

  const hasMathSymbol = /[⇒∧∨⊤₁₂]/.test(rule);
  if (hasMathSymbol) {
    let body = rule;
    for (const [symbol, tex] of Object.entries(RULE_SYMBOL_MAP)) {
      body = body.replaceAll(symbol, tex);
    }
    return `$${body}$`;
  }

  return `\\textit{${rule.replaceAll("-", "\\,\\textendash\\,")}}`;
}

// A Γ/alias `ref` segment resolves to its short or full form depending on
// whether this exact occurrence (nodeId + segment index) is expanded —
// exactly mirroring JudgementSegments.tsx's instanceKey, so the export is a
// snapshot of precisely what's on screen.
function resolveJudgement(node: TexTree, opts: ExportOptions): string {
  if (!node.judgementSegments) return node.judgement;

  return node.judgementSegments
    .map((segment, index) => {
      if (segment.kind === "tex") return segment.value;
      const entry = node.registry?.[segment.key];
      if (!entry) return "";
      const key = `${node.id ?? ""}:${index}`;
      return opts.expandedKeys.has(key) ? entry.fullTex : entry.shortTex;
    })
    .join("");
}

// Mirrors ProofTreeTex.tsx's showCollapsedAsVar logic: a T-Def/CT-Def/Lemma
// node not currently expanded (per `def:${nodeId}`) renders its collapsed
// (variable-lookup-looking) form instead of the full derivation.
function effectiveNode(node: ExportTree, opts: ExportOptions): {rule: string; children?: TexTree[]} {
  const isDef = DEF_RULES.has(node.rule);
  const expanded = isDef && node.id !== undefined && opts.expandedKeys.has(`def:${node.id}`);
  const showCollapsed = isDef && !expanded && node.collapsedChildren !== undefined;

  return showCollapsed
    ? {rule: node.collapsedRule ?? node.rule, children: node.collapsedChildren}
    : {rule: node.rule, children: node.children};
}

function highlightColor(node: ExportTree): "red" | "green" | null {
  if (node.error !== undefined) return "red";
  if (node.highlight === "invalid") return "red";
  if (node.highlight === "valid") return "green";
  return null;
}

// \hypo/\infer conclusions are already typeset in math mode by ebproof
// itself, so wrapping them in $...$ here would toggle OUT of math mode
// (ebproof docs: "the text ... is typeset in math mode by default").
function mathBlock(judgement: string, color: "red" | "green" | null): string {
  return color ? `\\textcolor{${color}}{${judgement}}` : judgement;
}

// ebproof is a postfix stack machine: \hypo pushes a childless leaf, \infer{n}
// pops the last n pushed items and replaces them with one new conclusion —
// so every node with children MUST go through \infer (even with a blank
// label) to correctly pop what its own children just pushed. Unlike
// bussproofs, arity has no fixed cap, so no >5-premise chunking workaround
// is needed; arity 0 with a label still draws a labeled line above the leaf
// (e.g. T-Nat), matching the browser exactly.
function renderNode(node: ExportTree, opts: ExportOptions): string[] {
  const {rule, children} = effectiveNode(node, opts);
  const judgement = resolveJudgement(node, opts);
  const label = ruleLabelLatex(rule);
  const color = highlightColor(node);
  const conclusion = mathBlock(judgement, color);
  const premiseCount = children?.length ?? 0;

  const lines: string[] = [];
  if (node.error) lines.push(`% ${sanitizeComment(node.error)}`);
  for (const child of children ?? []) {
    lines.push(...renderNode(child as ExportTree, opts));
  }

  if (premiseCount === 0 && label === null) {
    lines.push(`\\hypo{${conclusion}}`);
  } else {
    const labelArg = label ? `[${label}]` : "";
    lines.push(`\\infer${premiseCount}${labelArg}{${conclusion}}`);
  }
  return lines;
}

// A full, self-contained document — compiles as-is (e.g. in Overleaf) with
// no additional setup, matching exactly what's expanded/collapsed on screen
// right now via `opts.expandedKeys`.
export function texTreeToEbproofDocument(tree: TexTree, opts: ExportOptions): string {
  const body = renderNode(tree as ExportTree, opts).join("\n");

  return [
    "\\documentclass[preview,border=8pt]{standalone}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage{ebproof}",
    "\\usepackage{xcolor}",
    "\\begin{document}",
    "\\begin{prooftree}",
    body,
    "\\end{prooftree}",
    "\\end{document}",
    "",
  ].join("\n");
}
