import type {Parser} from "@/application/Parser.ts";
import type {Program, Term, Type} from "@/domain/ast";
import {CharStreams, CommonTokenStream} from "antlr4";
import LambdaLexer from "@/antlr/LambdaLexer.ts";
import LambdaParser from "@/antlr/LambdaParser.ts";
import {ProgramBuilderVisitor} from "@/adapter/ProgramBuilderVisitor.ts";
import {TypeBuilderVisitor} from "@/adapter/TypeBuilderVisitor.ts";
import {CollectingErrorListener, ParseSyntaxError} from "@/adapter/SyntaxErrorListener.ts";

export class AntlrParserAdapter implements Parser {

  parseExpression(input: string): Program {
    const chars = CharStreams.fromString(input)
    const lexer = new LambdaLexer(chars)
    const tokens = new CommonTokenStream(lexer)
    const parser = new LambdaParser(tokens)

    const errorListener = new CollectingErrorListener();
    lexer.removeErrorListeners();
    lexer.addErrorListener(errorListener);
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    const tree = parser.expression()
    if (errorListener.errors.length > 0) {
      throw new ParseSyntaxError(errorListener.errors);
    }
    return unswallowTrailingTerm(new ProgramBuilderVisitor().visit(tree))
  }
}

// An UntypedGlobalFunctionDeclaration (`name = term;`, no `: type` anchor) has nothing to stop
// its value from extending across its own closing `;` via Sequencing (`term SEMI term`), the same
// way a lambda body (and every other "prefix" construct's body — if/let/case/fix/...) always
// extends maximally to the right. A typed declaration never has this problem because its
// mandatory `: type` can't itself continue a term, so it always stops the value there — this new
// alternative has no such anchor, so ANTLR resolves the ambiguity by always extending: `f = t;\nf x;`
// parses as ONE declaration whose value is `Sequencing(t, App(f, x))` (or, if `t` ends in a
// body-extending construct, the Sequencing ends up nested inside that construct's own body/branch),
// with no trailing program term at all — not the two statements that were written.
//
// Un-swallow it by walking down whichever single sub-term position is "the part that extends
// maximally to the right" for each such construct, until a Sequencing is found, then splitting
// there. Only ever needed for an untyped (no declared type) declaration, since a typed one's
// `: type` always blocks the swallow, so this can never misfire on an intentional Sequencing value
// there. A genuinely-intended untyped Sequencing value with nothing following it in the whole
// program is the one case this can't distinguish from the swallow — accepted, narrow edge.
function unswallowTrailingTerm(program: Program): Program {
  if (program.term) return program;
  const globals = program.globals;
  const last = globals[globals.length - 1];
  if (!last || last.kind !== "FunDecl" || last.type !== undefined) return program;

  const {term, trailing} = unswallowFromRightmostBody(last.value);
  if (!trailing) return program;

  return {
    ...program,
    globals: [...globals.slice(0, -1), {...last, value: term}],
    term: trailing,
  };
}

function unswallowFromRightmostBody(term: Term): { term: Term; trailing?: Term } {
  switch (term.kind) {
    case "Sequencing":
      return {term: term.first, trailing: term.second};

    case "Abs":
    case "DummyAbstraction":
    case "TypeAbs":
    case "Let": {
      const inner = unswallowFromRightmostBody(term.body);
      return inner.trailing ? {term: {...term, body: inner.term}, trailing: inner.trailing} : {term};
    }

    case "Fix":
    case "Inl":
    case "Inr":
    case "IsNil":
    case "Head":
    case "Tail":
    case "Fold":
    case "Unfold": {
      const inner = unswallowFromRightmostBody(term.term);
      return inner.trailing ? {term: {...term, term: inner.term}, trailing: inner.trailing} : {term};
    }

    case "Cons": {
      const inner = unswallowFromRightmostBody(term.tail);
      return inner.trailing ? {term: {...term, tail: inner.term}, trailing: inner.trailing} : {term};
    }

    case "IfCondition": {
      if (term.else) {
        const inner = unswallowFromRightmostBody(term.else);
        return inner.trailing ? {term: {...term, else: inner.term}, trailing: inner.trailing} : {term};
      }
      if (term.elif && term.elif.length > 0) {
        const lastIndex = term.elif.length - 1;
        const inner = unswallowFromRightmostBody(term.elif[lastIndex].then);
        if (!inner.trailing) return {term};
        const elif = [...term.elif];
        elif[lastIndex] = {...elif[lastIndex], then: inner.term};
        return {term: {...term, elif}, trailing: inner.trailing};
      }
      const inner = unswallowFromRightmostBody(term.then);
      return inner.trailing ? {term: {...term, then: inner.term}, trailing: inner.trailing} : {term};
    }

    case "Case": {
      const inner = unswallowFromRightmostBody(term.inr.term);
      return inner.trailing ? {term: {...term, inr: {...term.inr, term: inner.term}}, trailing: inner.trailing} : {term};
    }

    case "VariantCase": {
      if (term.cases.length === 0) return {term};
      const lastIndex = term.cases.length - 1;
      const inner = unswallowFromRightmostBody(term.cases[lastIndex].body);
      if (!inner.trailing) return {term};
      const cases = [...term.cases];
      cases[lastIndex] = {...cases[lastIndex], body: inner.term};
      return {term: {...term, cases}, trailing: inner.trailing};
    }

    case "Variant": {
      if (term.variants.length === 0) return {term};
      const lastIndex = term.variants.length - 1;
      const inner = unswallowFromRightmostBody(term.variants[lastIndex].term);
      if (!inner.trailing) return {term};
      const variants = [...term.variants];
      variants[lastIndex] = {...variants[lastIndex], term: inner.term};
      return {term: {...term, variants}, trailing: inner.trailing};
    }

    default:
      return {term};
  }
}

// Parses a standalone `type` expression, e.g. for the Proof Tree Builder's type-fill-in popover.
export function parseTypeExpression(input: string): Type {
  const chars = CharStreams.fromString(input)
  const lexer = new LambdaLexer(chars)
  const tokens = new CommonTokenStream(lexer)
  const parser = new LambdaParser(tokens)

  const tree = parser.type_()
  return new TypeBuilderVisitor().visit(tree)
}
