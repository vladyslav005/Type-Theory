import type {GlobalDecl, Term} from "@/domain/ast";
import type {TexTree} from "@/presentation/tex/texTree.ts";
import {TexMapper} from "@/presentation/tex/TexMapper.ts";

export type SyntaxLanguage = "nbl" | "untyped";

const LANGUAGE_SETS: Record<SyntaxLanguage, string> = {
  nbl: "\\mathit{Term}",
  untyped: "\\Lambda",
};

const LANGUAGE_NAMES: Record<SyntaxLanguage, string> = {
  nbl: "NBL",
  untyped: "untyped lambda calculus",
};

export const SYNTAX_DEF_RULE = "(def)";

export const UNTYPED_SYNTAX_RULES = ["(var)", "(abs)", "(app)"] as const;

const LITERAL_RULES: Record<string, string> = {true: "(true)", false: "(false)", 0: "(0)"};

const NBL_OPERATOR_RULES = {Succ: "(succ)", Pred: "(pred)", IsZero: "(iszero)"} as const;

// A derivation of `t ∈ Term` (`t ∈ Λ` for untyped) from the language's syntax rules — the untyped counterpart of a typing proof.
// A free variable naming a global declaration becomes a collapsible (def) node unfolding into the declaration's derivation.
export function syntaxDerivation(term: Term, language: SyntaxLanguage, globals: GlobalDecl[] = []): TexTree {
  const values = new Map<string, Term>();
  for (const decl of globals) {
    if (decl.kind === "FunDecl" || decl.kind === "VarDecl") values.set(decl.name, decl.value);
  }
  return derive(term, language, values, new Set());
}

function derive(term: Term, language: SyntaxLanguage, globals: ReadonlyMap<string, Term>, bound: ReadonlySet<string>): TexTree {
  const node = (rule: string, children: Term[] = [], scope = bound): TexTree => ({
    judgement: `${TexMapper.termToTex(term)} \\in ${LANGUAGE_SETS[language]}`,
    rule,
    children: children.map((child) => derive(child, language, globals, scope)),
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
    case "Var": {
      const value = bound.has(term.name) ? undefined : globals.get(term.name);
      if (!value) return node("(var)");
      const inner = new Map(globals);
      inner.delete(term.name);
      return {
        ...node("(var)"),
        rule: SYNTAX_DEF_RULE,
        meta: term.name,
        children: [derive(value, language, inner, new Set())],
        collapsedRule: "(var)",
        collapsedChildren: [],
      };
    }
    case "Abs": {
      if (term.paramType) return noRule();
      const param: Term = {kind: "Var", id: `${term.id}-param`, name: term.param};
      return node("(abs)", [param, term.body], new Set([...bound, term.param]));
    }
    case "App":
      return node("(app)", [term.func, term.arg]);
    default:
      return noRule();
  }
}
