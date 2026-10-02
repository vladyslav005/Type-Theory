import type {Term} from "@/domain/ast";
import type {TexTree} from "@/presentation/tex/texTree.ts";
import {TexMapper} from "@/presentation/tex/TexMapper.ts";

export type SyntaxLanguage = "nbl" | "untyped";

const LANGUAGE_NAMES: Record<SyntaxLanguage, string> = {
  nbl: "NBL",
  untyped: "untyped lambda calculus",
};

export const UNTYPED_SYNTAX_RULES = ["(var)", "(abs)", "(app)"] as const;

const LITERAL_RULES: Record<string, string> = {true: "(true)", false: "(false)", 0: "(0)"};

const NBL_OPERATOR_RULES = {Succ: "(succ)", Pred: "(pred)", IsZero: "(iszero)"} as const;

// A derivation of `t ∈ Term` from the language's syntax rules — the untyped counterpart of a typing proof.
export function syntaxDerivation(term: Term, language: SyntaxLanguage): TexTree {
  const node = (rule: string, children: Term[] = []): TexTree => ({
    judgement: `${TexMapper.termToTex(term)} \\in \\mathit{Term}`,
    rule,
    children: children.map((child) => syntaxDerivation(child, language)),
    id: term.id,
    pos: term.pos,
  });
  const noRule = (): TexTree => ({
    ...node("?"),
    error: `No ${LANGUAGE_NAMES[language]} syntax rule derives this term, so it is not part of the language`,
  });

  if (language === "nbl") {
    switch (term.kind) {
      case "Lit":
        return LITERAL_RULES[term.value] ? node(LITERAL_RULES[term.value]) : noRule();
      case "Succ":
      case "Pred":
      case "IsZero":
        return node(NBL_OPERATOR_RULES[term.kind], [term.term]);
      case "IfCondition":
        return term.else && !term.elif?.length
          ? node("(if)", [term.condition, term.then, term.else])
          : noRule();
      default:
        return noRule();
    }
  }

  switch (term.kind) {
    case "Var":
      return node("(var)");
    case "Abs":
      return term.paramType ? noRule() : node("(abs)", [term.body]);
    case "App":
      return node("(app)", [term.func, term.arg]);
    default:
      return noRule();
  }
}
