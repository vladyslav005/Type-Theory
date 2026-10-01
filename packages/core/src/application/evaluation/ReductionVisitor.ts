import {AstVisitor} from "@/application/AstVisitor.ts";

import type {
  Abs,
  App,
  Ascribe,
  BinOp,
  Case,
  Cons,
  DummyAbstraction,
  Fix,
  Fold,
  GlobalDecl,
  Head,
  IfCondition,
  Inl,
  Inr,
  IsNil,
  IsZero,
  Pred,
  Succ,
  Kind,
  Let,
  Lit,
  Nil,
  Program,
  Record,
  RecordProjection,
  Sequencing,
  Tail,
  Term,
  Tuple,
  TupleProjection,
  TyConstructorAbs,
  TyConstructorApp,
  Type,
  TypeAbs,
  TypeApp,
  Unfold,
  Var,
  Variant,
  VariantCase,
} from "@/domain/ast";

import {EvaluationStrategy, type ReductionStep,} from "@/application/evaluation/type.ts";
import {substituteTypeVariable} from "@/application/typecheck/utils.ts";
import {isNumericValue} from "@/application/nbl/nblValues.ts";

const isUnitLiteral = (term: Term): boolean =>
  term.kind === "Lit" && (term.value === "unit" || term.value === "Unit");

const isTrueLiteral = (term: Term): boolean =>
  term.kind === "Lit" && (term.value === "true" || term.value === "True");

const isFalseLiteral = (term: Term): boolean =>
  term.kind === "Lit" && (term.value === "false" || term.value === "False");

const isNatLiteral = (term: Term): term is Lit =>
  term.kind === "Lit" && /^\d+$/.test(term.value);

// Nat subtraction is monus (truncated at zero) — there's no negative Nat.
// Division by zero returns null so the caller can leave the term stuck
// rather than producing a bogus result.
function evalBinOp(operator: BinOp["operator"], left: number, right: number): string | null {
  switch (operator) {
    case "+": return String(left + right);
    case "-": return String(Math.max(0, left - right));
    case "*": return String(left * right);
    case "/": return right === 0 ? null : String(Math.floor(left / right));
    case "<": return String(left < right);
    case ">": return String(left > right);
    case "<=": return String(left <= right);
    case ">=": return String(left >= right);
    case "==": return String(left === right);
    case "!=": return String(left !== right);
  }
}

export class ReductionVisitor extends AstVisitor<ReductionStep | null> {

  private boundVariables = new Map<string, number>();

  constructor(
    private readonly strategy: EvaluationStrategy,
    private readonly globals: ReadonlyMap<string, Term>,
  ) {
    super();
  }

  public reduce(term: Term): ReductionStep | null {
    return this.visit(term);
  }

  protected override visitVar(
    node: Var,
  ): ReductionStep | null {
    if (this.isBound(node.name)) {
      return null;
    }

    const definition = this.globals.get(node.name);

    if (!definition || !definition.id) {
      return null;
    }

    const after = this.cloneTermWithFreshIds(definition);
    return {
      before: node,
      after,
      selectedId: node.id,
      resultId: after.id,
    };
  }

  protected override visitLit(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: Lit,
  ): ReductionStep | null {
    return null;
  }

  protected override visitAbs(
    node: Abs,
  ): ReductionStep | null {
    // Only normal-order reduction continues under abstractions.
    if (this.strategy !== EvaluationStrategy.NORMAL) {
      return null;
    }

    this.addBound(node.param);

    try {
      const bodyStep = this.visit(node.body);

      if (!bodyStep) {
        return null;
      }

      return {
        before: node,
        after: {
          ...node,
          body: bodyStep.after,
        },
        selectedId: bodyStep.selectedId,
        resultId: bodyStep.resultId,
        binding: bodyStep.binding,
      };
    } finally {
      this.removeBound(node.param);
    }
  }

  protected override visitApp(
    node: App,
  ): ReductionStep | null {
    const isBetaRedex = node.func.kind === "Abs" || node.func.kind === "DummyAbstraction";

    // Normal order and call-by-name reduce an outer beta-redex immediately.
    if (
      isBetaRedex &&
      this.strategy !== EvaluationStrategy.CALL_BY_VALUE
    ) {
      return this.betaReduce(node);
    }

    const functionStep = this.visit(node.func);

    if (functionStep) {
      return {
        before: node,
        after: {
          ...node,
          func: functionStep.after,
        },
        selectedId: functionStep.selectedId,
        resultId: functionStep.resultId,
        binding: functionStep.binding,
      };
    }

    // Call-by-name never independently evaluates the argument.
    if (this.strategy === EvaluationStrategy.CALL_BY_NAME) {
      return null;
    }

    if (this.strategy === EvaluationStrategy.NORMAL) {
      const argumentStep = this.visit(node.arg);

      if (!argumentStep) {
        return null;
      }

      return {
        before: node,
        after: {
          ...node,
          arg: argumentStep.after,
        },
        selectedId: argumentStep.selectedId,
        resultId: argumentStep.resultId,
        binding: argumentStep.binding,
      };
    }

    // Call-by-value requires the function to be a value before evaluating the argument.
    if (!this.isValue(node.func)) {
      return null;
    }

    if (!this.isValue(node.arg)) {
      const argumentStep = this.visit(node.arg);

      if (!argumentStep) {
        return null;
      }

      return {
        before: node,
        after: {
          ...node,
          arg: argumentStep.after,
        },
        selectedId: argumentStep.selectedId,
        resultId: argumentStep.resultId,
        binding: argumentStep.binding,
      };
    }

    if (isBetaRedex) {
      return this.betaReduce(node);
    }

    // e.g. applying a literal as a function is stuck.
    return null;
  }

  private betaReduce(node: App): ReductionStep {
    if (node.func.kind === "DummyAbstraction") {
      // Anonymous parameter, never referenced — argument is discarded.
      const after = this.cloneTermWithFreshIds(node.func.body);
      return {
        before: node,
        after,
        selectedId: node.id,
        resultId: after.id,
      };
    }

    if (node.func.kind !== "Abs") {
      throw new Error(
        `Node ${node.id} is not a beta-redex`,
      );
    }

    const after = this.substitute(
      node.func.body,
      node.func.param,
      node.arg,
    );

    return {
      before: node,
      after,
      selectedId: node.id,
      resultId: after.id,
      binding: {name: node.func.param, value: node.arg},
    };
  }

  protected override visitInl(node: Inl): ReductionStep | null {
    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitInr(node: Inr): ReductionStep | null {
    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitIfCondition(node: IfCondition): ReductionStep | null {
    if (isTrueLiteral(node.condition)) {
      const after = this.cloneTermWithFreshIds(node.then);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    if (isFalseLiteral(node.condition)) {
      const [nextElif, ...restElif] = node.elif ?? [];

      if (nextElif) {
        const after: IfCondition = {
          ...node,
          id: crypto.randomUUID(),
          condition: nextElif.condition,
          then: nextElif.then,
          elif: restElif.length > 0 ? restElif : undefined,
        };
        return {before: node, after, selectedId: node.id, resultId: after.id};
      }

      const after = node.else
        ? this.cloneTermWithFreshIds(node.else)
        : ({kind: "Lit", id: crypto.randomUUID(), value: "unit"} as Lit);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    const step = this.visit(node.condition);
    if (!step) return null;
    return {
      before: node,
      after: {...node, condition: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitCase(node: Case): ReductionStep | null {
    if (node.variable.kind === "Inl" && this.isValue(node.variable)) {
      const after = this.substitute(node.inl.term, node.inl.variable, node.variable.term);
      return {
        before: node,
        after,
        selectedId: node.id,
        resultId: after.id,
        binding: {name: node.inl.variable, value: node.variable.term},
      };
    }

    if (node.variable.kind === "Inr" && this.isValue(node.variable)) {
      const after = this.substitute(node.inr.term, node.inr.variable, node.variable.term);
      return {
        before: node,
        after,
        selectedId: node.id,
        resultId: after.id,
        binding: {name: node.inr.variable, value: node.variable.term},
      };
    }

    const step = this.visit(node.variable);
    if (!step) return null;
    return {
      before: node,
      after: {...node, variable: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitVariantCase(node: VariantCase): ReductionStep | null {
    if (node.variable.kind === "Variant" && this.isValue(node.variable)) {
      const variantValue = node.variable;

      for (const c of node.cases) {
        const field = variantValue.variants.find((v) => v.label === c.label);
        if (field) {
          const after = this.substitute(c.body, c.variable, field.term);
          return {
            before: node,
            after,
            selectedId: node.id,
            resultId: after.id,
            binding: {name: c.variable, value: field.term},
          };
        }
      }

      // No matching case label — stuck.
      return null;
    }

    const step = this.visit(node.variable);
    if (!step) return null;
    return {
      before: node,
      after: {...node, variable: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitVariant(node: Variant): ReductionStep | null {
    for (let i = 0; i < node.variants.length; i++) {
      const entry = node.variants[i];
      const {step, stuck} = this.stepOperand(entry.term);
      if (stuck) return null;
      if (!step) continue;

      const variants = [...node.variants];
      variants[i] = {...entry, term: step.after};
      return {
        before: node,
        after: {...node, variants},
        selectedId: step.selectedId,
        resultId: step.resultId,
        binding: step.binding,
      };
    }

    return null;
  }

  protected override visitAscribe(node: Ascribe): ReductionStep | null {
    if (this.isValue(node.term)) {
      const after = this.cloneTermWithFreshIds(node.term);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitTuple(node: Tuple): ReductionStep | null {
    for (let i = 0; i < node.elements.length; i++) {
      const element = node.elements[i];
      const {step, stuck} = this.stepOperand(element);
      if (stuck) return null;
      if (!step) continue;

      const elements = [...node.elements];
      elements[i] = step.after;
      return {
        before: node,
        after: {...node, elements},
        selectedId: step.selectedId,
        resultId: step.resultId,
        binding: step.binding,
      };
    }

    return null;
  }

  protected override visitTupleProjection(node: TupleProjection): ReductionStep | null {
    if (node.tuple.kind === "Tuple" && this.isValue(node.tuple)) {
      const element = node.tuple.elements[node.index - 1];
      if (!element) return null;

      const after = this.cloneTermWithFreshIds(element);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    const step = this.visit(node.tuple);
    if (!step) return null;
    return {
      before: node,
      after: {...node, tuple: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitRecord(node: Record): ReductionStep | null {
    for (let i = 0; i < node.fields.length; i++) {
      const field = node.fields[i];
      const {step, stuck} = this.stepOperand(field.term);
      if (stuck) return null;
      if (!step) continue;

      const fields = [...node.fields];
      fields[i] = {...field, term: step.after};
      return {
        before: node,
        after: {...node, fields},
        selectedId: step.selectedId,
        resultId: step.resultId,
        binding: step.binding,
      };
    }

    return null;
  }

  protected override visitRecordProjection(node: RecordProjection): ReductionStep | null {
    if (node.term.kind === "Record" && this.isValue(node.term)) {
      const field = node.term.fields.find((f) => f.label === node.label);
      if (!field) return null;

      const after = this.cloneTermWithFreshIds(field.term);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitSequencing(node: Sequencing): ReductionStep | null {
    if (isUnitLiteral(node.first)) {
      const after = this.cloneTermWithFreshIds(node.second);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    const step = this.visit(node.first);
    if (!step) return null;
    return {
      before: node,
      after: {...node, first: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitDummyAbstraction(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: DummyAbstraction,
  ): ReductionStep | null {
    // A dummy abstraction is a function value; only application reduces it.
    return null;
  }

  protected override visitBinOp(node: BinOp): ReductionStep | null {
    const left = this.stepOperand(node.left);
    if (left.step) {
      return {
        before: node,
        after: {...node, left: left.step.after},
        selectedId: left.step.selectedId,
        resultId: left.step.resultId,
        binding: left.step.binding,
      };
    }
    if (left.stuck) return null;

    const right = this.stepOperand(node.right);
    if (right.step) {
      return {
        before: node,
        after: {...node, right: right.step.after},
        selectedId: right.step.selectedId,
        resultId: right.step.resultId,
        binding: right.step.binding,
      };
    }
    if (right.stuck) return null;

    if (!isNatLiteral(node.left) || !isNatLiteral(node.right)) {
      // Stuck: both sides are values, but at least one isn't a Nat literal.
      return null;
    }

    const result = evalBinOp(node.operator, Number(node.left.value), Number(node.right.value));
    if (result === null) {
      // Stuck: e.g. division by zero.
      return null;
    }

    const after: Lit = {kind: "Lit", id: crypto.randomUUID(), value: result};
    return {before: node, after, selectedId: node.id, resultId: after.id};
  }

  protected override visitFix(node: Fix): ReductionStep | null {
    if (node.term.kind === "Abs") {
      // E-fixBeta: fix (λx:T.t) -> [x ↦ fix (λx:T.t)] t — strategy-independent.
      const after = this.substitute(node.term.body, node.term.param, node);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    // E-fix: reduce the wrapped term.
    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  // nil[T] is already a value — nothing to reduce.
  protected override visitNil(_node: Nil): ReductionStep | null {
    return null;
  }

  // E-cons1 / E-cons2: reduce head first, then tail once head is a value.
  protected override visitCons(node: Cons): ReductionStep | null {
    const head = this.stepOperand(node.head);
    if (head.step) {
      return {
        before: node,
        after: {...node, head: head.step.after},
        selectedId: head.step.selectedId,
        resultId: head.step.resultId,
        binding: head.step.binding,
      };
    }
    if (head.stuck) return null;

    const tail = this.stepOperand(node.tail);
    if (tail.step) {
      return {
        before: node,
        after: {...node, tail: tail.step.after},
        selectedId: tail.step.selectedId,
        resultId: tail.step.resultId,
        binding: tail.step.binding,
      };
    }
    if (tail.stuck) return null;

    return null;
  }

  protected override visitIsNil(node: IsNil): ReductionStep | null {
    if (node.term.kind === "Nil") {
      // E-isnilnil
      const after: Lit = {kind: "Lit", id: crypto.randomUUID(), value: "true"};
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    if (node.term.kind === "Cons" && this.isValue(node.term)) {
      // E-isnilcons
      const after: Lit = {kind: "Lit", id: crypto.randomUUID(), value: "false"};
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    // E-isnil: reduce the scrutinee.
    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitSucc(node: Succ): ReductionStep | null {
    // E-Succ
    return this.reduceNblOperand(node);
  }

  protected override visitPred(node: Pred): ReductionStep | null {
    if (node.term.kind === "Lit" && node.term.value === "0") {
      // E-PredZero
      const after: Lit = {kind: "Lit", id: crypto.randomUUID(), value: "0"};
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    if (node.term.kind === "Succ" && isNumericValue(node.term.term)) {
      // E-PredSucc
      const after = this.cloneTermWithFreshIds(node.term.term);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    // E-Pred
    return this.reduceNblOperand(node);
  }

  protected override visitIsZero(node: IsZero): ReductionStep | null {
    if (isNumericValue(node.term)) {
      // E-IszeroZero / E-IszeroSucc
      const after: Lit = {kind: "Lit", id: crypto.randomUUID(), value: node.term.kind === "Lit" ? "true" : "false"};
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    // E-Iszero
    return this.reduceNblOperand(node);
  }

  private reduceNblOperand<T extends Succ | Pred | IsZero>(node: T): ReductionStep | null {
    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitHead(node: Head): ReductionStep | null {
    if (node.term.kind === "Cons" && this.isValue(node.term)) {
      // E-headcons
      const after = this.cloneTermWithFreshIds(node.term.head);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    // E-head: reduce the scrutinee.
    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitTail(node: Tail): ReductionStep | null {
    if (node.term.kind === "Cons" && this.isValue(node.term)) {
      // E-tailcons
      const after = this.cloneTermWithFreshIds(node.term.tail);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    // E-tail: reduce the scrutinee.
    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  // E-fold: reduce the wrapped term; fold_{μX.T} v is itself already a value.
  protected override visitFold(node: Fold): ReductionStep | null {
    const {step, stuck} = this.stepOperand(node.term);
    if (stuck || !step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitUnfold(node: Unfold): ReductionStep | null {
    if (node.term.kind === "Fold" && this.isValue(node.term)) {
      // E-unfoldfold: unfold_{μX.T} (fold_{μX.T} v) → v
      const after = this.cloneTermWithFreshIds(node.term.term);
      return {before: node, after, selectedId: node.id, resultId: after.id};
    }

    // E-unfold: reduce the wrapped term.
    const step = this.visit(node.term);
    if (!step) return null;
    return {
      before: node,
      after: {...node, term: step.after},
      selectedId: step.selectedId,
      resultId: step.resultId,
      binding: step.binding,
    };
  }

  protected override visitTypeAbstraction(node: TypeAbs): ReductionStep | null {
    // A value, like Abs — normal order continues under the binder, the
    // other two strategies stop.
    if (this.strategy !== EvaluationStrategy.NORMAL) {
      return null;
    }

    const bodyStep = this.visit(node.body);

    if (!bodyStep) {
      return null;
    }

    return {
      before: node,
      after: {...node, body: bodyStep.after},
      selectedId: bodyStep.selectedId,
      resultId: bodyStep.resultId,
      binding: bodyStep.binding,
    };
  }

  // Unlike App, type application has one fixed rule regardless of evaluation strategy.
  protected override visitTypeApplication(node: TypeApp): ReductionStep | null {
    // E-TappTabs: term is already a value (a TypeAbs), instantiate.
    if (node.term.kind === "TypeAbs") {
      return this.typeBetaReduce(node);
    }

    // E-Tapp: reduce the term to a value first.
    const termStep = this.visit(node.term);

    if (!termStep) {
      return null;
    }

    return {
      before: node,
      after: {
        ...node,
        term: termStep.after,
      },
      selectedId: termStep.selectedId,
      resultId: termStep.resultId,
      binding: termStep.binding,
    };
  }

  private typeBetaReduce(node: TypeApp): ReductionStep {
    if (node.term.kind !== "TypeAbs") {
      throw new Error(
        `Node ${node.id} is not a type-application redex`,
      );
    }

    const after = this.substituteTypeInTerm(node.term.body, node.term.typeParam, node.typeArg);

    return {
      before: node,
      after,
      selectedId: node.id,
      resultId: after.id,
    };
  }

  // Capture-avoiding substitution of a type variable into every embedded Type annotation in a term.
  private substituteTypeInTerm(term: Term, typeVar: string, replacement: Type): Term {
    switch (term.kind) {
      case "Var":
      case "Lit":
        return term;

      case "App":
        return {
          ...term,
          func: this.substituteTypeInTerm(term.func, typeVar, replacement),
          arg: this.substituteTypeInTerm(term.arg, typeVar, replacement),
        };

      case "Abs":
        return {
          ...term,
          paramType: term.paramType ? substituteTypeVariable(term.paramType, typeVar, replacement) : undefined,
          type: term.type ? substituteTypeVariable(term.type, typeVar, replacement) : undefined,
          body: this.substituteTypeInTerm(term.body, typeVar, replacement),
        };

      case "Inl":
        return {
          ...term,
          term: this.substituteTypeInTerm(term.term, typeVar, replacement),
          type: substituteTypeVariable(term.type, typeVar, replacement),
        };

      case "Inr":
        return {
          ...term,
          term: this.substituteTypeInTerm(term.term, typeVar, replacement),
          type: substituteTypeVariable(term.type, typeVar, replacement),
        };

      case "IfCondition": {
        const next: IfCondition = {
          ...term,
          condition: this.substituteTypeInTerm(term.condition, typeVar, replacement),
          then: this.substituteTypeInTerm(term.then, typeVar, replacement),
        };
        if (term.elif) {
          next.elif = term.elif.map((b) => ({
            condition: this.substituteTypeInTerm(b.condition, typeVar, replacement),
            then: this.substituteTypeInTerm(b.then, typeVar, replacement),
          }));
        }
        if (term.else) {
          next.else = this.substituteTypeInTerm(term.else, typeVar, replacement);
        }
        return next;
      }

      case "Case":
        return {
          ...term,
          variable: this.substituteTypeInTerm(term.variable, typeVar, replacement),
          inl: {variable: term.inl.variable, term: this.substituteTypeInTerm(term.inl.term, typeVar, replacement)},
          inr: {variable: term.inr.variable, term: this.substituteTypeInTerm(term.inr.term, typeVar, replacement)},
        };

      case "VariantCase":
        return {
          ...term,
          variable: this.substituteTypeInTerm(term.variable, typeVar, replacement),
          cases: term.cases.map((c) => ({...c, body: this.substituteTypeInTerm(c.body, typeVar, replacement)})),
        };

      case "Variant":
        return {
          ...term,
          type: substituteTypeVariable(term.type, typeVar, replacement),
          variants: term.variants.map((v) => ({...v, term: this.substituteTypeInTerm(v.term, typeVar, replacement)})),
        };

      case "Ascribe":
        return {
          ...term,
          term: this.substituteTypeInTerm(term.term, typeVar, replacement),
          type: substituteTypeVariable(term.type, typeVar, replacement),
        };

      case "TupleProjection":
        return {...term, tuple: this.substituteTypeInTerm(term.tuple, typeVar, replacement)};

      case "RecordProjection":
        return {...term, term: this.substituteTypeInTerm(term.term, typeVar, replacement)};

      case "Record":
        return {
          ...term,
          fields: term.fields.map((f) => ({...f, term: this.substituteTypeInTerm(f.term, typeVar, replacement)})),
        };

      case "Sequencing":
        return {
          ...term,
          first: this.substituteTypeInTerm(term.first, typeVar, replacement),
          second: this.substituteTypeInTerm(term.second, typeVar, replacement),
        };

      case "Tuple":
        return {...term, elements: term.elements.map((e) => this.substituteTypeInTerm(e, typeVar, replacement))};

      case "DummyAbstraction":
        return {
          ...term,
          paramType: substituteTypeVariable(term.paramType, typeVar, replacement),
          type: term.type ? substituteTypeVariable(term.type, typeVar, replacement) : undefined,
          body: this.substituteTypeInTerm(term.body, typeVar, replacement),
        };

      case "Let":
        return {
          ...term,
          value: this.substituteTypeInTerm(term.value, typeVar, replacement),
          body: this.substituteTypeInTerm(term.body, typeVar, replacement),
        };

      case "BinOp":
        return {
          ...term,
          left: this.substituteTypeInTerm(term.left, typeVar, replacement),
          right: this.substituteTypeInTerm(term.right, typeVar, replacement),
        };

      case "Fix":
        return {...term, term: this.substituteTypeInTerm(term.term, typeVar, replacement)};

      case "TypeAbs":
        // A nested ΛX. ... shadows an outer substitution of the same variable.
        if (term.typeParam === typeVar) {
          return term;
        }
        return {...term, body: this.substituteTypeInTerm(term.body, typeVar, replacement)};

      case "TypeApp":
        return {
          ...term,
          term: this.substituteTypeInTerm(term.term, typeVar, replacement),
          typeArg: substituteTypeVariable(term.typeArg, typeVar, replacement),
        };

      case "Nil":
        return {...term, type: substituteTypeVariable(term.type, typeVar, replacement)};

      case "Cons":
        return {
          ...term,
          type: substituteTypeVariable(term.type, typeVar, replacement),
          head: this.substituteTypeInTerm(term.head, typeVar, replacement),
          tail: this.substituteTypeInTerm(term.tail, typeVar, replacement),
        };

      case "Succ":
      case "Pred":
      case "IsZero":
        return {...term, term: this.substituteTypeInTerm(term.term, typeVar, replacement)};

      case "IsNil":
      case "Head":
      case "Tail":
      case "Fold":
      case "Unfold":
        return {
          ...term,
          type: substituteTypeVariable(term.type, typeVar, replacement),
          term: this.substituteTypeInTerm(term.term, typeVar, replacement),
        };
    }
  }

  protected override visitLet(node: Let): ReductionStep | null {
    // `let` is a redex the moment it's formed; normal order and call-by-name substitute immediately.
    if (this.strategy !== EvaluationStrategy.CALL_BY_VALUE) {
      return this.letReduce(node);
    }

    // Call-by-value requires the bound value to be a value before substituting it into the body.
    if (!this.isValue(node.value)) {
      const valueStep = this.visit(node.value);

      if (!valueStep) {
        return null;
      }

      return {
        before: node,
        after: {
          ...node,
          value: valueStep.after,
        },
        selectedId: valueStep.selectedId,
        resultId: valueStep.resultId,
        binding: valueStep.binding,
      };
    }

    return this.letReduce(node);
  }

  private letReduce(node: Let): ReductionStep {
    const after = this.substitute(node.body, node.name, node.value);

    return {
      before: node,
      after,
      selectedId: node.id,
      resultId: after.id,
      binding: {name: node.name, value: node.value},
    };
  }

  // Capture-avoiding substitution: term[variable := replacement].
  private substitute(
    term: Term,
    variable: string,
    replacement: Term,
  ): Term {
    switch (term.kind) {
      case "Var":
        if (term.name !== variable) {
          return term;
        }

        // Fresh copy per occurrence, or duplicated substitutions would share node IDs.
        return this.cloneTermWithFreshIds(replacement);

      case "Lit":
        return term;

      case "App":
        return {
          ...term,
          func: this.substitute(
            term.func,
            variable,
            replacement,
          ),
          arg: this.substitute(
            term.arg,
            variable,
            replacement,
          ),
        };

      case "Abs": {
        // Inner abstraction shadows the variable: (λx. M)[x := N] = λx. M
        if (term.param === variable) {
          return term;
        }

        const replacementFreeVariables =
          this.getFreeVariables(replacement);

        // Alpha-conversion needed if the binder would capture a free variable from replacement.
        if (replacementFreeVariables.has(term.param)) {
          const unavailableNames = new Set([
            ...this.getAllNames(term.body),
            ...this.getAllNames(replacement),
            variable,
          ]);

          const freshParameter = this.createFreshName(
            term.param,
            unavailableNames,
          );

          const renamedBody = this.renameBoundVariable(
            term.body,
            term.param,
            freshParameter,
          );

          return {
            ...term,
            param: freshParameter,
            body: this.substitute(
              renamedBody,
              variable,
              replacement,
            ),
          };
        }

        return {
          ...term,
          body: this.substitute(
            term.body,
            variable,
            replacement,
          ),
        };
      }

      case "Inl":
      case "Inr":
        return {...term, term: this.substitute(term.term, variable, replacement)};

      case "IfCondition": {
        const next: IfCondition = {
          ...term,
          condition: this.substitute(term.condition, variable, replacement),
          then: this.substitute(term.then, variable, replacement),
        };
        if (term.elif) {
          next.elif = term.elif.map((b) => ({
            condition: this.substitute(b.condition, variable, replacement),
            then: this.substitute(b.then, variable, replacement),
          }));
        }
        if (term.else) {
          next.else = this.substitute(term.else, variable, replacement);
        }
        return next;
      }

      case "Case": {
        const scrutinee = this.substitute(term.variable, variable, replacement);
        const inl = this.substituteUnderBinder(term.inl.variable, term.inl.term, variable, replacement);
        const inr = this.substituteUnderBinder(term.inr.variable, term.inr.term, variable, replacement);
        return {
          ...term,
          variable: scrutinee,
          inl: {variable: inl.name, term: inl.body},
          inr: {variable: inr.name, term: inr.body},
        };
      }

      case "VariantCase": {
        const scrutinee = this.substitute(term.variable, variable, replacement);
        const cases = term.cases.map((c) => {
          const bound = this.substituteUnderBinder(c.variable, c.body, variable, replacement);
          return {label: c.label, variable: bound.name, body: bound.body};
        });
        return {...term, variable: scrutinee, cases};
      }

      case "Variant":
        return {
          ...term,
          variants: term.variants.map((v) => ({
            label: v.label,
            term: this.substitute(v.term, variable, replacement),
          })),
        };

      case "Ascribe":
        return {...term, term: this.substitute(term.term, variable, replacement)};

      case "TupleProjection":
        return {...term, tuple: this.substitute(term.tuple, variable, replacement)};

      case "RecordProjection":
        return {...term, term: this.substitute(term.term, variable, replacement)};

      case "Record":
        return {
          ...term,
          fields: term.fields.map((f) => ({
            label: f.label,
            term: this.substitute(f.term, variable, replacement),
          })),
        };

      case "Sequencing":
        return {
          ...term,
          first: this.substitute(term.first, variable, replacement),
          second: this.substitute(term.second, variable, replacement),
        };

      case "Tuple":
        return {...term, elements: term.elements.map((e) => this.substitute(e, variable, replacement))};

      case "DummyAbstraction":
        // The bound name is anonymous and never occurs free in the body.
        return {...term, body: this.substitute(term.body, variable, replacement)};

      case "Let": {
        // `let` only binds its own name within `body` — `value` is evaluated
        // in the outer scope, so it's substituted unconditionally.
        const value = this.substitute(term.value, variable, replacement);
        const bound = this.substituteUnderBinder(term.name, term.body, variable, replacement);
        return {...term, value, name: bound.name, body: bound.body};
      }

      case "BinOp":
        return {
          ...term,
          left: this.substitute(term.left, variable, replacement),
          right: this.substitute(term.right, variable, replacement),
        };

      case "Fix":
        return {...term, term: this.substitute(term.term, variable, replacement)};

      case "TypeAbs":
        // typeParam is a type-level name — a different namespace from term
        // variables, so it never shadows `variable`.
        return {...term, body: this.substitute(term.body, variable, replacement)};

      case "TypeApp":
        // typeArg is a Type, not touched by term-variable substitution.
        return {...term, term: this.substitute(term.term, variable, replacement)};

      case "Nil":
        return term;

      case "Cons":
        return {
          ...term,
          head: this.substitute(term.head, variable, replacement),
          tail: this.substitute(term.tail, variable, replacement),
        };

      case "Succ":
      case "Pred":
      case "IsZero":
        return {...term, term: this.substitute(term.term, variable, replacement)};

      case "IsNil":
      case "Head":
      case "Tail":
      case "Fold":
      case "Unfold":
        return {...term, term: this.substitute(term.term, variable, replacement)};
    }
  }

  // Substitutes under a named binder (Case/VariantCase branches); alpha-converts like the Abs case above.
  private substituteUnderBinder(
    boundName: string,
    body: Term,
    variable: string,
    replacement: Term,
  ): {name: string; body: Term} {
    if (boundName === variable) {
      return {name: boundName, body};
    }

    const replacementFreeVariables = this.getFreeVariables(replacement);

    if (replacementFreeVariables.has(boundName)) {
      const unavailableNames = new Set([
        ...this.getAllNames(body),
        ...this.getAllNames(replacement),
        variable,
      ]);

      const freshName = this.createFreshName(boundName, unavailableNames);
      const renamedBody = this.renameBoundVariable(body, boundName, freshName);

      return {name: freshName, body: this.substitute(renamedBody, variable, replacement)};
    }

    return {name: boundName, body: this.substitute(body, variable, replacement)};
  }

  // isValue() calls a bare Var a value (a bound/free variable can't reduce
  // further), but a Var can also name a global that still needs dereferencing
  // via visitVar. This tries that dereference first; `stuck` is only true for
  // a genuinely non-value term that failed to produce a step.
  private stepOperand(term: Term): {step: ReductionStep | null; stuck: boolean} {
    if (term.kind !== "Var" && this.isValue(term)) {
      return {step: null, stuck: false};
    }
    const step = this.visit(term);
    return step ? {step, stuck: false} : {step: null, stuck: !this.isValue(term)};
  }

  private isValue(term: Term): boolean {
    switch (term.kind) {
      case "Abs":
      case "Lit":
      case "Var":
      case "DummyAbstraction":
      case "TypeAbs":
        return true;

      case "App":
      case "IfCondition":
      case "Case":
      case "VariantCase":
      case "Ascribe":
      case "TupleProjection":
      case "RecordProjection":
      case "Sequencing":
      case "Let":
      case "TypeApp":
        return false;

      case "Inl":
      case "Inr":
        return this.isValue(term.term);

      case "Tuple":
        return term.elements.every((e) => this.isValue(e));

      case "Record":
        return term.fields.every((f) => this.isValue(f.term));

      case "Variant":
        return term.variants.every((v) => this.isValue(v.term));

      case "BinOp":
        return false;

      case "Fix":
        // "fix v nie je hodnota" — fix is never a value, even when its
        // argument already is (only application of the unfolded result is).
        return false;

      case "Nil":
        return true;

      case "Cons":
        return this.isValue(term.head) && this.isValue(term.tail);

      case "IsNil":
      case "Head":
      case "Tail":
        return false;

      case "Fold":
        return this.isValue(term.term);

      case "Succ":
        return isNumericValue(term);

      case "Pred":
      case "IsZero":
        return false;

      case "Unfold":
        return false;
    }
  }

  private getFreeVariables(
    term: Term,
    bound: ReadonlySet<string> = new Set(),
  ): Set<string> {
    switch (term.kind) {
      case "Var":
        return bound.has(term.name)
          ? new Set()
          : new Set([term.name]);

      case "Lit":
        return new Set();

      case "App":
        return new Set([
          ...this.getFreeVariables(term.func, bound),
          ...this.getFreeVariables(term.arg, bound),
        ]);

      case "Abs": {
        const nextBound = new Set(bound);
        nextBound.add(term.param);

        return this.getFreeVariables(
          term.body,
          nextBound,
        );
      }

      case "Inl":
      case "Inr":
        return this.getFreeVariables(term.term, bound);

      case "IfCondition": {
        const sets = [
          this.getFreeVariables(term.condition, bound),
          this.getFreeVariables(term.then, bound),
        ];
        for (const b of term.elif ?? []) {
          sets.push(this.getFreeVariables(b.condition, bound), this.getFreeVariables(b.then, bound));
        }
        if (term.else) sets.push(this.getFreeVariables(term.else, bound));
        return new Set(sets.flatMap((s) => [...s]));
      }

      case "Case": {
        const inlBound = new Set(bound);
        inlBound.add(term.inl.variable);
        const inrBound = new Set(bound);
        inrBound.add(term.inr.variable);
        return new Set([
          ...this.getFreeVariables(term.variable, bound),
          ...this.getFreeVariables(term.inl.term, inlBound),
          ...this.getFreeVariables(term.inr.term, inrBound),
        ]);
      }

      case "VariantCase": {
        const branchSets = term.cases.map((c) => {
          const caseBound = new Set(bound);
          caseBound.add(c.variable);
          return this.getFreeVariables(c.body, caseBound);
        });
        return new Set([
          ...this.getFreeVariables(term.variable, bound),
          ...branchSets.flatMap((s) => [...s]),
        ]);
      }

      case "Variant":
        return new Set(term.variants.flatMap((v) => [...this.getFreeVariables(v.term, bound)]));

      case "Ascribe":
        return this.getFreeVariables(term.term, bound);

      case "TupleProjection":
        return this.getFreeVariables(term.tuple, bound);

      case "RecordProjection":
        return this.getFreeVariables(term.term, bound);

      case "Record":
        return new Set(term.fields.flatMap((f) => [...this.getFreeVariables(f.term, bound)]));

      case "Sequencing":
        return new Set([
          ...this.getFreeVariables(term.first, bound),
          ...this.getFreeVariables(term.second, bound),
        ]);

      case "Tuple":
        return new Set(term.elements.flatMap((e) => [...this.getFreeVariables(e, bound)]));

      case "DummyAbstraction":
        return this.getFreeVariables(term.body, bound);

      case "Let": {
        const nextBound = new Set(bound);
        nextBound.add(term.name);
        return new Set([
          ...this.getFreeVariables(term.value, bound),
          ...this.getFreeVariables(term.body, nextBound),
        ]);
      }

      case "BinOp":
        return new Set([
          ...this.getFreeVariables(term.left, bound),
          ...this.getFreeVariables(term.right, bound),
        ]);

      case "Fix":
        return this.getFreeVariables(term.term, bound);

      case "TypeAbs":
        return this.getFreeVariables(term.body, bound);

      case "TypeApp":
        return this.getFreeVariables(term.term, bound);

      case "Nil":
        return new Set();

      case "Cons":
        return new Set([
          ...this.getFreeVariables(term.head, bound),
          ...this.getFreeVariables(term.tail, bound),
        ]);

      case "Succ":
      case "Pred":
      case "IsZero":
        return this.getFreeVariables(term.term, bound);

      case "IsNil":
      case "Head":
      case "Tail":
      case "Fold":
      case "Unfold":
        return this.getFreeVariables(term.term, bound);
    }
  }

  // Renames occurrences bound by an outer abstraction; stops at a nested one with the same param.
  private renameBoundVariable(
    term: Term,
    oldName: string,
    newName: string,
  ): Term {
    switch (term.kind) {
      case "Var":
        return term.name === oldName
          ? {
            ...term,
            name: newName,
          }
          : term;

      case "Lit":
        return term;

      case "App":
        return {
          ...term,
          func: this.renameBoundVariable(
            term.func,
            oldName,
            newName,
          ),
          arg: this.renameBoundVariable(
            term.arg,
            oldName,
            newName,
          ),
        };

      case "Abs":
        // A nested abstraction with the same name shadows the outer one.
        if (term.param === oldName) {
          return term;
        }

        return {
          ...term,
          body: this.renameBoundVariable(
            term.body,
            oldName,
            newName,
          ),
        };

      case "Inl":
      case "Inr":
        return {...term, term: this.renameBoundVariable(term.term, oldName, newName)};

      case "IfCondition": {
        const next: IfCondition = {
          ...term,
          condition: this.renameBoundVariable(term.condition, oldName, newName),
          then: this.renameBoundVariable(term.then, oldName, newName),
        };
        if (term.elif) {
          next.elif = term.elif.map((b) => ({
            condition: this.renameBoundVariable(b.condition, oldName, newName),
            then: this.renameBoundVariable(b.then, oldName, newName),
          }));
        }
        if (term.else) next.else = this.renameBoundVariable(term.else, oldName, newName);
        return next;
      }

      case "Case": {
        const inl = term.inl.variable === oldName
          ? term.inl
          : {variable: term.inl.variable, term: this.renameBoundVariable(term.inl.term, oldName, newName)};
        const inr = term.inr.variable === oldName
          ? term.inr
          : {variable: term.inr.variable, term: this.renameBoundVariable(term.inr.term, oldName, newName)};
        return {
          ...term,
          variable: this.renameBoundVariable(term.variable, oldName, newName),
          inl,
          inr,
        };
      }

      case "VariantCase":
        return {
          ...term,
          variable: this.renameBoundVariable(term.variable, oldName, newName),
          cases: term.cases.map((c) =>
            c.variable === oldName ? c : {...c, body: this.renameBoundVariable(c.body, oldName, newName)},
          ),
        };

      case "Variant":
        return {
          ...term,
          variants: term.variants.map((v) => ({...v, term: this.renameBoundVariable(v.term, oldName, newName)})),
        };

      case "Ascribe":
        return {...term, term: this.renameBoundVariable(term.term, oldName, newName)};

      case "TupleProjection":
        return {...term, tuple: this.renameBoundVariable(term.tuple, oldName, newName)};

      case "RecordProjection":
        return {...term, term: this.renameBoundVariable(term.term, oldName, newName)};

      case "Record":
        return {
          ...term,
          fields: term.fields.map((f) => ({...f, term: this.renameBoundVariable(f.term, oldName, newName)})),
        };

      case "Sequencing":
        return {
          ...term,
          first: this.renameBoundVariable(term.first, oldName, newName),
          second: this.renameBoundVariable(term.second, oldName, newName),
        };

      case "Tuple":
        return {...term, elements: term.elements.map((e) => this.renameBoundVariable(e, oldName, newName))};

      case "DummyAbstraction":
        return {...term, body: this.renameBoundVariable(term.body, oldName, newName)};

      case "Let":
        if (term.name === oldName) {
          // The let shadows the outer binder within its own body; the
          // bound value is still evaluated in the outer scope though.
          return {...term, value: this.renameBoundVariable(term.value, oldName, newName)};
        }
        return {
          ...term,
          value: this.renameBoundVariable(term.value, oldName, newName),
          body: this.renameBoundVariable(term.body, oldName, newName),
        };

      case "BinOp":
        return {
          ...term,
          left: this.renameBoundVariable(term.left, oldName, newName),
          right: this.renameBoundVariable(term.right, oldName, newName),
        };

      case "Fix":
        return {...term, term: this.renameBoundVariable(term.term, oldName, newName)};

      case "TypeAbs":
        return {...term, body: this.renameBoundVariable(term.body, oldName, newName)};

      case "TypeApp":
        return {...term, term: this.renameBoundVariable(term.term, oldName, newName)};

      case "Nil":
        return term;

      case "Cons":
        return {
          ...term,
          head: this.renameBoundVariable(term.head, oldName, newName),
          tail: this.renameBoundVariable(term.tail, oldName, newName),
        };

      case "Succ":
      case "Pred":
      case "IsZero":
        return {...term, term: this.renameBoundVariable(term.term, oldName, newName)};

      case "IsNil":
      case "Head":
      case "Tail":
      case "Fold":
      case "Unfold":
        return {...term, term: this.renameBoundVariable(term.term, oldName, newName)};
    }
  }

  private getAllNames(term: Term): Set<string> {
    switch (term.kind) {
      case "Var":
        return new Set([term.name]);

      case "Lit":
        return new Set();

      case "App":
        return new Set([
          ...this.getAllNames(term.func),
          ...this.getAllNames(term.arg),
        ]);

      case "Abs":
        return new Set([
          term.param,
          ...this.getAllNames(term.body),
        ]);

      case "Inl":
      case "Inr":
        return this.getAllNames(term.term);

      case "IfCondition": {
        const sets = [this.getAllNames(term.condition), this.getAllNames(term.then)];
        for (const b of term.elif ?? []) sets.push(this.getAllNames(b.condition), this.getAllNames(b.then));
        if (term.else) sets.push(this.getAllNames(term.else));
        return new Set(sets.flatMap((s) => [...s]));
      }

      case "Case":
        return new Set([
          ...this.getAllNames(term.variable),
          term.inl.variable,
          ...this.getAllNames(term.inl.term),
          term.inr.variable,
          ...this.getAllNames(term.inr.term),
        ]);

      case "VariantCase":
        return new Set([
          ...this.getAllNames(term.variable),
          ...term.cases.flatMap((c) => [c.variable, ...this.getAllNames(c.body)]),
        ]);

      case "Variant":
        return new Set(term.variants.flatMap((v) => [...this.getAllNames(v.term)]));

      case "Ascribe":
        return this.getAllNames(term.term);

      case "TupleProjection":
        return this.getAllNames(term.tuple);

      case "RecordProjection":
        return this.getAllNames(term.term);

      case "Record":
        return new Set(term.fields.flatMap((f) => [...this.getAllNames(f.term)]));

      case "Sequencing":
        return new Set([...this.getAllNames(term.first), ...this.getAllNames(term.second)]);

      case "Tuple":
        return new Set(term.elements.flatMap((e) => [...this.getAllNames(e)]));

      case "DummyAbstraction":
        return this.getAllNames(term.body);

      case "Let":
        return new Set([
          term.name,
          ...this.getAllNames(term.value),
          ...this.getAllNames(term.body),
        ]);

      case "BinOp":
        return new Set([
          ...this.getAllNames(term.left),
          ...this.getAllNames(term.right),
        ]);

      case "Fix":
        return this.getAllNames(term.term);

      case "TypeAbs":
        return this.getAllNames(term.body);

      case "TypeApp":
        return this.getAllNames(term.term);

      case "Nil":
        return new Set();

      case "Cons":
        return new Set([...this.getAllNames(term.head), ...this.getAllNames(term.tail)]);

      case "Succ":
      case "Pred":
      case "IsZero":
        return this.getAllNames(term.term);

      case "IsNil":
      case "Head":
      case "Tail":
      case "Fold":
      case "Unfold":
        return this.getAllNames(term.term);
    }
  }

  private createFreshName(
    originalName: string,
    unavailableNames: ReadonlySet<string>,
  ): string {
    let index = 1;
    let candidate = `${originalName}_${index}`;

    while (unavailableNames.has(candidate)) {
      index += 1;
      candidate = `${originalName}_${index}`;
    }

    return candidate;
  }

  private cloneTermWithFreshIds(term: Term): Term {
    switch (term.kind) {
      case "Var":
        return {
          ...term,
          id: crypto.randomUUID(),
        };

      case "Lit":
        return {
          ...term,
          id: crypto.randomUUID(),
        };

      case "App":
        return {
          ...term,
          id: crypto.randomUUID(),
          func: this.cloneTermWithFreshIds(term.func),
          arg: this.cloneTermWithFreshIds(term.arg),
        };

      case "Abs":
        return {
          ...term,
          id: crypto.randomUUID(),
          body: this.cloneTermWithFreshIds(term.body),
          paramType: term.paramType
            ? this.cloneTypeWithFreshIds(term.paramType)
            : undefined,
          type: term.type
            ? this.cloneTypeWithFreshIds(term.type)
            : undefined,
        };

      case "Inl":
        return {
          ...term,
          id: crypto.randomUUID(),
          term: this.cloneTermWithFreshIds(term.term),
          type: this.cloneTypeWithFreshIds(term.type),
        };

      case "Inr":
        return {
          ...term,
          id: crypto.randomUUID(),
          term: this.cloneTermWithFreshIds(term.term),
          type: this.cloneTypeWithFreshIds(term.type),
        };

      case "IfCondition": {
        const next: IfCondition = {
          ...term,
          id: crypto.randomUUID(),
          condition: this.cloneTermWithFreshIds(term.condition),
          then: this.cloneTermWithFreshIds(term.then),
        };
        if (term.elif) {
          next.elif = term.elif.map((b) => ({
            condition: this.cloneTermWithFreshIds(b.condition),
            then: this.cloneTermWithFreshIds(b.then),
          }));
        }
        if (term.else) next.else = this.cloneTermWithFreshIds(term.else);
        return next;
      }

      case "Case":
        return {
          ...term,
          id: crypto.randomUUID(),
          variable: this.cloneTermWithFreshIds(term.variable),
          inl: {variable: term.inl.variable, term: this.cloneTermWithFreshIds(term.inl.term)},
          inr: {variable: term.inr.variable, term: this.cloneTermWithFreshIds(term.inr.term)},
        };

      case "VariantCase":
        return {
          ...term,
          id: crypto.randomUUID(),
          variable: this.cloneTermWithFreshIds(term.variable),
          cases: term.cases.map((c) => ({
            label: c.label,
            variable: c.variable,
            body: this.cloneTermWithFreshIds(c.body),
          })),
        };

      case "Variant":
        return {
          ...term,
          id: crypto.randomUUID(),
          type: this.cloneTypeWithFreshIds(term.type),
          variants: term.variants.map((v) => ({label: v.label, term: this.cloneTermWithFreshIds(v.term)})),
        };

      case "Ascribe":
        return {
          ...term,
          id: crypto.randomUUID(),
          term: this.cloneTermWithFreshIds(term.term),
          type: this.cloneTypeWithFreshIds(term.type),
        };

      case "TupleProjection":
        return {...term, id: crypto.randomUUID(), tuple: this.cloneTermWithFreshIds(term.tuple)};

      case "RecordProjection":
        return {...term, id: crypto.randomUUID(), term: this.cloneTermWithFreshIds(term.term)};

      case "Record":
        return {
          ...term,
          id: crypto.randomUUID(),
          fields: term.fields.map((f) => ({label: f.label, term: this.cloneTermWithFreshIds(f.term)})),
        };

      case "Sequencing":
        return {
          ...term,
          id: crypto.randomUUID(),
          first: this.cloneTermWithFreshIds(term.first),
          second: this.cloneTermWithFreshIds(term.second),
        };

      case "Tuple":
        return {
          ...term,
          id: crypto.randomUUID(),
          elements: term.elements.map((e) => this.cloneTermWithFreshIds(e)),
        };

      case "DummyAbstraction":
        return {
          ...term,
          id: crypto.randomUUID(),
          body: this.cloneTermWithFreshIds(term.body),
          paramType: this.cloneTypeWithFreshIds(term.paramType),
          type: term.type ? this.cloneTypeWithFreshIds(term.type) : undefined,
        };

      case "Let":
        return {
          ...term,
          id: crypto.randomUUID(),
          value: this.cloneTermWithFreshIds(term.value),
          body: this.cloneTermWithFreshIds(term.body),
        };

      case "BinOp":
        return {
          ...term,
          id: crypto.randomUUID(),
          left: this.cloneTermWithFreshIds(term.left),
          right: this.cloneTermWithFreshIds(term.right),
        };

      case "Fix":
        return {...term, id: crypto.randomUUID(), term: this.cloneTermWithFreshIds(term.term)};

      case "TypeAbs":
        return {...term, id: crypto.randomUUID(), body: this.cloneTermWithFreshIds(term.body)};

      case "TypeApp":
        return {
          ...term,
          id: crypto.randomUUID(),
          term: this.cloneTermWithFreshIds(term.term),
          typeArg: this.cloneTypeWithFreshIds(term.typeArg),
        };

      case "Nil":
        return {...term, id: crypto.randomUUID(), type: this.cloneTypeWithFreshIds(term.type)};

      case "Cons":
        return {
          ...term,
          id: crypto.randomUUID(),
          type: this.cloneTypeWithFreshIds(term.type),
          head: this.cloneTermWithFreshIds(term.head),
          tail: this.cloneTermWithFreshIds(term.tail),
        };

      case "Succ":
      case "Pred":
      case "IsZero":
        return {...term, id: crypto.randomUUID(), term: this.cloneTermWithFreshIds(term.term)};

      case "IsNil":
      case "Head":
      case "Tail":
      case "Fold":
      case "Unfold":
        return {
          ...term,
          id: crypto.randomUUID(),
          type: this.cloneTypeWithFreshIds(term.type),
          term: this.cloneTermWithFreshIds(term.term),
        };
    }
  }

  private cloneTypeWithFreshIds(type: Type): Type {
    switch (type.kind) {
      case "TyIdentifier":
      case "TyMetaVar":
        return {
          ...type,
          id: crypto.randomUUID(),
        };

      case "TyArrow":
        return {
          ...type,
          id: crypto.randomUUID(),
          from: this.cloneTypeWithFreshIds(type.from),
          to: this.cloneTypeWithFreshIds(type.to),
        };

      case "TupleType":
        return {
          ...type,
          id: crypto.randomUUID(),
          elements: type.elements.map((e) => this.cloneTypeWithFreshIds(e)),
        };

      case "SumType":
        return {
          ...type,
          id: crypto.randomUUID(),
          left: this.cloneTypeWithFreshIds(type.left),
          right: this.cloneTypeWithFreshIds(type.right),
        };

      case "VariantType":
        return {
          ...type,
          id: crypto.randomUUID(),
          variants: type.variants.map((v) => ({label: v.label, type: this.cloneTypeWithFreshIds(v.type)})),
        };

      case "RecordType":
        return {
          ...type,
          id: crypto.randomUUID(),
          fields: type.fields.map((f) => ({label: f.label, type: this.cloneTypeWithFreshIds(f.type)})),
        };

      case "TyForall":
        return {
          ...type,
          id: crypto.randomUUID(),
          type: this.cloneTypeWithFreshIds(type.type),
        };

      case "TyConstructorAbs":
        return {
          ...type,
          id: crypto.randomUUID(),
          body: this.cloneTypeWithFreshIds(type.body),
        };

      case "TyConstructorApp":
        return {
          ...type,
          id: crypto.randomUUID(),
          func: this.cloneTypeWithFreshIds(type.func),
          arg: this.cloneTypeWithFreshIds(type.arg),
        };

      case "TyPi":
        return {
          ...type,
          id: crypto.randomUUID(),
          paramType: this.cloneTypeWithFreshIds(type.paramType),
          body: this.cloneTypeWithFreshIds(type.body),
        };

      case "TyIndexApp":
        return {
          ...type,
          id: crypto.randomUUID(),
          func: this.cloneTypeWithFreshIds(type.func),
          arg: this.cloneTermWithFreshIds(type.arg),
        };

      case "ListType":
        return {
          ...type,
          id: crypto.randomUUID(),
          elementType: this.cloneTypeWithFreshIds(type.elementType),
        };

      case "RecursiveType":
        return {
          ...type,
          id: crypto.randomUUID(),
          type: this.cloneTypeWithFreshIds(type.type),
        };
    }
  }

  protected override visitProgram(
    node: Program,
  ): ReductionStep | null {
    return node.term
      ? this.visit(node.term)
      : null;
  }

  protected override visitTermDecl(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: GlobalDecl,
  ): ReductionStep | null {
    return null;
  }

  protected override visitTypeDecl(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: GlobalDecl,
  ): ReductionStep | null {
    return null;
  }

  protected override visitTypeAliasDecl(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: GlobalDecl,
  ): ReductionStep | null {
    return null;
  }

  protected override visitTypeConstructorDecl(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: GlobalDecl,
  ): ReductionStep | null {
    return null;
  }

  protected override visitType(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: Type,
  ): ReductionStep | null {
    return null;
  }

  // System λω̲ — grammar/AST wiring only so far, no reduction semantics yet.
  protected override visitTypeConstructorAbstraction(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: TyConstructorAbs,
  ): ReductionStep | null {
    return null;
  }

  protected override visitTypeConstructorApplication(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: TyConstructorApp,
  ): ReductionStep | null {
    return null;
  }

  protected override visitKind(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _node: Kind,
  ): ReductionStep | null {
    return null;
  }

  private addBound(name: string): void {
    const count = this.boundVariables.get(name) ?? 0;
    this.boundVariables.set(name, count + 1);
  }

  private removeBound(name: string): void {
    const count = this.boundVariables.get(name) ?? 0;

    if (count <= 1) {
      this.boundVariables.delete(name);
    } else {
      this.boundVariables.set(name, count - 1);
    }
  }

  private isBound(name: string): boolean {
    return (this.boundVariables.get(name) ?? 0) > 0;
  }
}
