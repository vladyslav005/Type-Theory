import type {Term} from "@/domain/ast";

export enum EvaluationStrategy {
  NORMAL = "NORMAL",
  CALL_BY_VALUE = "CALL_BY_VALUE",
  CALL_BY_NAME = "CALL_BY_NAME",
}

export const EVALUATION_STRATEGY_LABELS: Record<EvaluationStrategy, string> = {
  [EvaluationStrategy.NORMAL]: "Normal Order",
  [EvaluationStrategy.CALL_BY_NAME]: "Call by name",
  [EvaluationStrategy.CALL_BY_VALUE]: "Call by value",
};

export interface ReductionStep {
  before: Term;
  after: Term;
  selectedId: string;
  resultId?: string;
  // Set when this step substitutes a concrete term for a variable (β-reduction,
  // `let`, or a case/variant-case match) — the binding it conceptually adds to Γ.
  binding?: {name: string; value: Term};
}

export interface EvaluationError {
  message: string;
  stuckTermId?: string;
}

// Set when reduction was stopped early because it detected the term will never reach a normal
// form, well before the step limit — either an exact repeat of an earlier step (a certain
// infinite loop, since reduction is deterministic: the same term can only ever lead to the same
// next term) or the term growing past a size cap with no sign of settling (e.g. the raw
// Y-combinator under Call-by-value, which never finishes reducing its own argument).
export interface Divergence {
  kind: "cycle" | "growth";
  atStep: number;
}

export interface EvaluationResult {
  result: Term;
  steps: ReductionStep[];
  reachedStepLimit: boolean;
  strategy: EvaluationStrategy;
  errors?: EvaluationError[];
  divergence?: Divergence;
  // Top-level let/fun declarations available for free-variable lookup during
  // reduction — the global half of a step's Γ (see scopeAt.ts for the local half).
  globals: Record<string, Term>;
}

