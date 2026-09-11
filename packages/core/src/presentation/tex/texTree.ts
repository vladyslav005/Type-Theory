import type {SourcePosition} from "@/domain/ast";

// A piece of a judgement rendered as an inline MathJax span ("tex") or as a clickable,
// expandable reference to a numbered Γ/C set ("ref") — see TexRegistryEntry.
export type TexSegment =
  | { kind: "tex"; value: string }
  | { kind: "ref"; key: string }

// A numbered Γ_n/C_n label plus the "recipe" explaining how it was built (e.g. Γ_2 = Γ_1 ∪ {id : T}).
export interface TexRegistryEntry {
  shortTex: string
  fullTex: string
}

export interface TexTree {
  judgement: string
  judgementFull?: string
  // When present, the UI renders this instead of `judgement` — each "ref" segment is clickable
  // to toggle between shortTex and fullTex. Only produced for CT-* judgements (let-polymorphism).
  judgementSegments?: TexSegment[]
  // Shared across every node of one derivation so any node can resolve any "ref" segment's key.
  registry?: Record<string, TexRegistryEntry>
  rule: string
  // Hover text for the rule-name label — currently only set on a Conv node.
  ruleTooltip?: string
  // Hover text explaining that this node's Γ shadows a name from its parent's Γ.
  contextTooltip?: string
  children?: TexTree[]
  id?: string
  // The source span of the original term this node was derived from, for hover-to-highlight in the text editor.
  pos?: SourcePosition
  error?: string
  meta?: string
  // How this node renders while collapsed (only used by T-Def). Ignored unless expanded.
  collapsedRule?: string
  collapsedChildren?: TexTree[]
}