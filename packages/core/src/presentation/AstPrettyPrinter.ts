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
  FunDecl,
  GlobalDecl,
  Head,
  IfCondition,
  Inl,
  Inr,
  IsNil,
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
  Type,
  TypeAbs,
  TypeAliasDecl,
  TypeApp,
  TypeConstructorDecl,
  Unfold,
  Var,
  VarDecl,
  Variant,
  VariantCase,
} from "@/domain/ast";
import { kindToString, typeToString } from "@/application/typecheck/utils.ts";

// Converts an AST back into surface syntax parseable by the existing parser, with minimal parens.
export class AstPrettyPrinter {
  printProgram(program: Program): string {
    const parts: string[] = [];

    for (const g of program.globals) {
      parts.push(this.printGlobalDecl(g) + ";");
    }

    if (program.term) {
      parts.push(this.printTerm(program.term) + ";");
    }

    return parts.join("\n");
  }

  printGlobalDecl(decl: GlobalDecl): string {
    switch (decl.kind) {
      case "VarDecl":
        return this.printVarDecl(decl);
      case "FunDecl":
        return this.printFunDecl(decl);
      case "TypeAliasDecl":
        return this.printTypeAliasDecl(decl);
      case "TypeConstructorDecl":
        return this.printTypeConstructorDecl(decl);
    }
  }

  private printVarDecl(decl: VarDecl): string {
    if (decl.value.id)
      return `${decl.name} = ${this.printTerm(decl.value)} : ${this.printType(decl.type)}`;
    else
      return `${decl.name} : ${this.printType(decl.type)}`;

  }

  private printFunDecl(decl: FunDecl): string {
    // Grammar's GlobalFunctionDeclaration is `ID EQ term COLON type SEMI`; the
    // UntypedGlobalFunctionDeclaration alternative (`ID EQ term SEMI`) omits the type.
    return decl.type
      ? `${decl.name} = ${this.printTerm(decl.value)} : ${this.printType(decl.type)}`
      : `${decl.name} = ${this.printTerm(decl.value)}`;
  }

  private printTypeAliasDecl(decl: TypeAliasDecl): string {
    return `typedef ${decl.name} = ${this.printType(decl.type)}`;
  }

  private printTypeConstructorDecl(decl: TypeConstructorDecl): string {
    return `typedef ${decl.name} : ${kindToString(decl.paramKind)}`;
  }

  printTerm(term: Term): string {
    switch (term.kind) {
      case "Var":
        return this.printVar(term);
      case "Abs":
        return this.printAbs(term);
      case "App":
        return this.printApp(term);
      case "Lit":
        return this.printLit(term);
      case "Inl":
        return this.printInl(term);
      case "Inr":
        return this.printInr(term);
      case "IfCondition":
        return this.printIfCondition(term);
      case "Case":
        return this.printCase(term);
      case "VariantCase":
        return this.printVariantCase(term);
      case "Variant":
        return this.printVariant(term);
      case "Ascribe":
        return this.printAscribe(term);
      case "TupleProjection":
        return this.printTupleProjection(term);
      case "RecordProjection":
        return this.printRecordProjection(term);
      case "Record":
        return this.printRecord(term);
      case "Sequencing":
        return this.printSequencing(term);
      case "Tuple":
        return this.printTuple(term);
      case "DummyAbstraction":
        return this.printDummyAbstraction(term);
      case "Let":
        return this.printLet(term);
      case "BinOp":
        return this.printBinOp(term);
      case "Fix":
        return this.printFix(term);
      case "TypeAbs":
        return this.printTypeAbs(term);
      case "TypeApp":
        return this.printTypeApp(term);
      case "Nil":
        return this.printNil(term);
      case "Cons":
        return this.printCons(term);
      case "IsNil":
        return this.printIsNil(term);
      case "Head":
        return this.printHead(term);
      case "Tail":
        return this.printTail(term);
      case "Fold":
        return this.printFold(term);
      case "Unfold":
        return this.printUnfold(term);
    }
  }

  private printInl(t: Inl): string {
    return `(inl ${this.printTerm(t.term)} as ${this.printType(t.type)})`;
  }

  private printInr(t: Inr): string {
    return `(inr ${this.printTerm(t.term)} as ${this.printType(t.type)})`;
  }

  private printIfCondition(t: IfCondition): string {
    let s = `if ${this.printTerm(t.condition)} then ${this.printTerm(t.then)}`;
    for (const branch of t.elif ?? []) {
      s += ` elseif ${this.printTerm(branch.condition)} then ${this.printTerm(branch.then)}`;
    }
    if (t.else) {
      s += ` else ${this.printTerm(t.else)}`;
    }
    return `(${s})`;
  }

  private printCase(t: Case): string {
    return `(case ${this.printTerm(t.variable)} || inl ${t.inl.variable} => ${this.printTerm(t.inl.term)} || inr ${t.inr.variable} => ${this.printTerm(t.inr.term)})`;
  }

  private printVariantCase(t: VariantCase): string {
    const cases = t.cases.map((c) => `[${c.label}=${c.variable}] => ${this.printTerm(c.body)}`).join(" || ");
    return `(case ${this.printTerm(t.variable)} of ${cases})`;
  }

  private printVariant(t: Variant): string {
    const fields = t.variants.map((v) => `${v.label}=${this.printTerm(v.term)}`).join(", ");
    return `[${fields}] as ${this.printType(t.type)}`;
  }

  private printAscribe(t: Ascribe): string {
    return `(${this.printTerm(t.term)} as ${this.printType(t.type)})`;
  }

  private printTupleProjection(t: TupleProjection): string {
    return `${this.printTerm(t.tuple)}.${t.index}`;
  }

  private printRecordProjection(t: RecordProjection): string {
    return `${this.printTerm(t.term)}.${t.label}`;
  }

  private printRecord(t: Record): string {
    const fields = t.fields.map((f) => `${f.label}=${this.printTerm(f.term)}`).join(", ");
    return `<${fields}>`;
  }

  private printSequencing(t: Sequencing): string {
    return `(${this.printTerm(t.first)}; ${this.printTerm(t.second)})`;
  }

  private printTuple(t: Tuple): string {
    const elements = t.elements.map((e) => this.printTerm(e)).join(", ");
    return `<${elements}>`;
  }

  private printDummyAbstraction(t: DummyAbstraction): string {
    return `(λ _ : ${this.printType(t.paramType)} . ${this.printTerm(t.body)})`;
  }

  private printLet(t: Let): string {
    return `(let ${t.name} = ${this.printTerm(t.value)} in ${this.printTerm(t.body)})`;
  }

  private printBinOp(t: BinOp): string {
    return `(${this.printTerm(t.left)} ${t.operator} ${this.printTerm(t.right)})`;
  }

  private printFix(t: Fix): string {
    return `(fix ${this.printTerm(t.term)})`;
  }

  private printTypeAbs(t: TypeAbs): string {
    return `(Λ ${t.typeParam} . ${this.printTerm(t.body)})`;
  }

  private printTypeApp(t: TypeApp): string {
    return `${this.printTerm(t.term)} [${this.printType(t.typeArg)}]`;
  }

  private printNil(t: Nil): string {
    return `nil[${this.printType(t.type)}]`;
  }

  private printCons(t: Cons): string {
    return `(cons[${this.printType(t.type)}] ${this.printTerm(t.head)} ${this.printTerm(t.tail)})`;
  }

  private printIsNil(t: IsNil): string {
    return `(isnil[${this.printType(t.type)}] ${this.printTerm(t.term)})`;
  }

  private printHead(t: Head): string {
    return `(head[${this.printType(t.type)}] ${this.printTerm(t.term)})`;
  }

  private printTail(t: Tail): string {
    return `(tail[${this.printType(t.type)}] ${this.printTerm(t.term)})`;
  }

  private printFold(t: Fold): string {
    return `(fold[${this.printType(t.type)}] ${this.printTerm(t.term)})`;
  }

  private printUnfold(t: Unfold): string {
    return `(unfold[${this.printType(t.type)}] ${this.printTerm(t.term)})`;
  }

  private printVar(v: Var): string {
    return v.name;
  }

  private printLit(lit: Lit): string {
    return String(lit.value);
  }

  private printAbs(abs: Abs): string {
    // The grammar's LambdaAbstraction is `LAMBDA ID COLON type DOT term` — there is no
    // trailing result-type annotation, so `abs.type` has no surface syntax and is dropped
    // (a declared result type is carried by the enclosing global decl's `: type` instead).
    const body = this.printTerm(abs.body);
    const param = abs.paramType ? `${abs.param} : ${this.printType(abs.paramType)}` : abs.param;
    return `(λ ${param} . ${body})`;
  }

  private printApp(app: App): string {
    // Always parenthesize app to match typical parser expectations.
    return `(${this.printTerm(app.func)} ${this.printTerm(app.arg)})`;
  }

  printType(type: Type): string {
    // Reuse existing typeToString implementation (TyIdentifier/TyArrow)
    return typeToString(type);
  }
}

export function astToText(program: Program): string {
  return new AstPrettyPrinter().printProgram(program);
}
