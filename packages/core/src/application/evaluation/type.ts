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
  // The rule of the redex that fired: "β", "definition" (a name replaced by its definition), "E-IfTrue", …
  rule?: string;
}

export interface EvaluationError {
  message: string;
  stuckTermId?: string;
}

export interface EvaluationLimits {
  // Stops once the term has more AST nodes than this.
  maximumTermSize?: number;
  timeLimitMs?: number;
}

export interface EvaluationResult {
  result: Term;
  steps: ReductionStep[];
  reachedStepLimit: boolean;
  strategy: EvaluationStrategy;
  errors?: EvaluationError[];
  // Top-level let/fun declarations available for free-variable lookup during
  // reduction — the global half of a step's Γ (see scopeAt.ts for the local half).
  globals: Record<string, Term>;
}

