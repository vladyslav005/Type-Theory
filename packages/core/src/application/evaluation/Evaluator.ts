import type {
  ASTNode,
  Program,
  Term,
} from "@/domain/ast";

import {
  EvaluationStrategy,
  type EvaluationError,
  type EvaluationLimits,
  type EvaluationResult,
  type ReductionStep,
} from "@/application/evaluation/type.ts";
import {ReductionVisitor} from "@/application/evaluation/ReductionVisitor.ts";
import {isNumericValue} from "@/application/nbl/nblValues.ts";
import {AstPrettyPrinter} from "@/presentation/AstPrettyPrinter.ts";

export class Evaluator {
  private evaluationSteps: ReductionStep[] = [];

  constructor(
    private readonly maximumSteps = 500,
    private readonly limits: EvaluationLimits = {},
  ) {}

  public evaluate(
    ast: Program,
    strategy: EvaluationStrategy,
  ): EvaluationResult {

    const globals = new Map<string, Term>();

    for (const declaration of ast.globals) {
      // A typedef has no runtime value — purely type-level.
      if (declaration.kind === "TypeAliasDecl" || declaration.kind === "TypeConstructorDecl") continue;
      globals.set(declaration.name, declaration.value);
    }

    this.evaluationSteps = [];

    const initialTerm = this.extractTerm(ast);
    const reductionVisitor = new ReductionVisitor(strategy, globals);

    let currentTerm = initialTerm;
    const deadline = this.limits.timeLimitMs === undefined ? Infinity : Date.now() + this.limits.timeLimitMs;

    for (
      let index = 0;
      index < this.maximumSteps;
      index += 1
    ) {
      const step = reductionVisitor.reduce(currentTerm);

      if (!step) {
        const errors = this.collectErrors(currentTerm);
        return {
          result: currentTerm,
          steps: [...this.evaluationSteps],
          reachedStepLimit: false,
          strategy,
          globals: Object.fromEntries(globals),
          ...(errors.length > 0 && { errors }),
        };
      }

      this.evaluationSteps.push(step);
      currentTerm = step.after;

      // A step can double the term (e.g. Y on numerals), exhausting memory long before the step limit.
      if (Date.now() > deadline || this.exceedsSize(currentTerm)) break;
    }

    return {
      result: currentTerm,
      steps: [...this.evaluationSteps],
      reachedStepLimit: true,
      strategy,
      globals: Object.fromEntries(globals),
    };
  }

  private exceedsSize(term: Term): boolean {
    const maximum = this.limits.maximumTermSize;
    if (maximum === undefined) return false;
    let count = 0;
    const pending: unknown[] = [term];
    while (pending.length > 0) {
      const node = pending.pop();
      if (!node || typeof node !== "object") continue;
      if ("kind" in node && ++count > maximum) return true;
      for (const [key, value] of Object.entries(node)) {
        if (key !== "pos" && typeof value === "object") pending.push(value);
      }
    }
    return false;
  }

  private collectErrors(term: Term): EvaluationError[] {
    const stuck = this.findStuckTerm(term);
    if (stuck) {
      return [{message: stuck.message, stuckTermId: stuck.id}];
    }
    return [];
  }

  private findStuckTerm(term: Term): {id: string; message: string} | undefined {
    switch (term.kind) {
      case "Var":
      case "Abs":
      case "Lit":
      case "DummyAbstraction":
        return undefined;

      case "App":
        if (term.func.kind === "Lit") {
          return {id: term.id, message: "Evaluation stuck: a non-function value (literal) was applied as a function"};
        }
        return this.findStuckTerm(term.func) ?? this.findStuckTerm(term.arg);

      case "Inl":
      case "Inr":
      case "Ascribe":
      case "RecordProjection":
      case "Fold":
        return this.findStuckTerm(term.term);

      case "TupleProjection":
        return this.findStuckTerm(term.tuple);

      case "IfCondition": {
        const subterms = [
          term.condition,
          term.then,
          ...(term.elif ?? []).flatMap((b) => [b.condition, b.then]),
          ...(term.else ? [term.else] : []),
        ];
        const found = subterms.reduce<{id: string; message: string} | undefined>((found, t) => found ?? this.findStuckTerm(t), undefined);
        if (found) return found;
        if (isNumericValue(term.condition)) {
          return {id: term.id, message: "Evaluation stuck: \"if\" requires a boolean condition (true/false), but got a number"};
        }
        return undefined;
      }

      case "Case":
        return (
          this.findStuckTerm(term.variable) ??
          this.findStuckTerm(term.inl.term) ??
          this.findStuckTerm(term.inr.term)
        );

      case "VariantCase":
        return term.cases.reduce<{id: string; message: string} | undefined>(
          (found, c) => found ?? this.findStuckTerm(c.body),
          this.findStuckTerm(term.variable),
        );

      case "Variant":
        return term.variants.reduce<{id: string; message: string} | undefined>((found, v) => found ?? this.findStuckTerm(v.term), undefined);

      case "Tuple":
        return term.elements.reduce<{id: string; message: string} | undefined>((found, e) => found ?? this.findStuckTerm(e), undefined);

      case "Record":
        return term.fields.reduce<{id: string; message: string} | undefined>((found, f) => found ?? this.findStuckTerm(f.term), undefined);

      case "Sequencing":
        return this.findStuckTerm(term.first) ?? this.findStuckTerm(term.second);

      case "Let":
        return this.findStuckTerm(term.value) ?? this.findStuckTerm(term.body);

      case "BinOp": {
        const found = this.findStuckTerm(term.left) ?? this.findStuckTerm(term.right);
        if (found) return found;

        const isNatLiteral = (t: Term) => t.kind === "Lit" && /^\d+$/.test(t.value);
        if (!isNatLiteral(term.left) || !isNatLiteral(term.right)) {
          return {id: term.id, message: `Evaluation stuck: operator "${term.operator}" requires both operands to be Nat literals`};
        }
        if (term.operator === "/" && (term.right as Extract<Term, {kind: "Lit"}>).value === "0") {
          return {id: term.id, message: "Evaluation stuck: division by zero"};
        }
        return undefined;
      }

      case "Fix": {
        const found = this.findStuckTerm(term.term);
        if (found) return found;
        if (term.term.kind !== "Abs") {
          return {id: term.id, message: "Evaluation stuck: \"fix\" requires a λ-abstraction to unfold, but got a non-function value"};
        }
        return undefined;
      }

      case "Nil":
        return undefined;

      case "Cons":
        return this.findStuckTerm(term.head) ?? this.findStuckTerm(term.tail);

      case "IsNil":
        return this.findStuckTerm(term.term);

      case "Head":
      case "Tail": {
        const found = this.findStuckTerm(term.term);
        if (found) return found;
        if (term.term.kind !== "Nil" && term.term.kind !== "Cons") {
          return {id: term.id, message: `Evaluation stuck: "${term.kind === "Head" ? "head" : "tail"}" requires a list (nil/cons), but got a non-list value`};
        }
        if (term.term.kind === "Nil") {
          return {id: term.id, message: `Evaluation stuck: "${term.kind === "Head" ? "head" : "tail"}" of an empty list`};
        }
        return undefined;
      }

      case "Unfold": {
        const found = this.findStuckTerm(term.term);
        if (found) return found;
        if (term.term.kind !== "Fold") {
          return {id: term.id, message: "Evaluation stuck: \"unfold\" requires a \"fold\" value, but got a non-fold value"};
        }
        return undefined;
      }

      case "Succ":
      case "Pred":
      case "IsZero": {
        const found = this.findStuckTerm(term.term);
        if (found) return found;
        if (!isNumericValue(term.term)) {
          return {id: term.id, message: `Evaluation stuck: "${term.kind.toLowerCase()}" requires a numeric value (0, succ 0, ...), but got ${new AstPrettyPrinter().printTerm(term.term)}`};
        }
        return undefined;
      }
    }
  }

  private extractTerm(ast: ASTNode): Term {
    switch (ast.kind) {
      case "Var":
      case "Abs":
      case "App":
      case "Lit":
      case "Inl":
      case "Inr":
      case "IfCondition":
      case "Case":
      case "VariantCase":
      case "Variant":
      case "Ascribe":
      case "TupleProjection":
      case "RecordProjection":
      case "Record":
      case "Sequencing":
      case "Tuple":
      case "DummyAbstraction":
      case "Let":
      case "BinOp":
      case "Fix":
      case "TypeAbs":
      case "TypeApp":
      case "Nil":
      case "Cons":
      case "IsNil":
      case "Head":
      case "Tail":
      case "Fold":
      case "Unfold":
      case "Succ":
      case "Pred":
      case "IsZero":
        return ast;

      case "Program": {
        const program = ast as Program;

        if (!program.term) {
          throw new Error(
            "Program does not contain a term to evaluate",
          );
        }

        return program.term;
      }

      case "VarDecl":
      case "FunDecl":
        return ast.value;

      case "TypeAliasDecl":
      case "TypeConstructorDecl":
        throw new Error(
          "Cannot evaluate a typedef — it has no runtime value",
        );

      case "TyIdentifier":
      case "TyArrow":
      case "TupleType":
      case "SumType":
      case "VariantType":
      case "RecordType":
      case "TyMetaVar":
      case "TyForall":
      case "TyConstructorAbs":
      case "TyConstructorApp":
      case "TyPi":
      case "TyIndexApp":
      case "ListType":
      case "RecursiveType":
        throw new Error(
          `Cannot evaluate type node ${ast.kind}`,
        );

      case "StarKind":
      case "KindArrow":
        throw new Error(
          `Cannot evaluate kind node ${ast.kind}`,
        );
    }
  }
}