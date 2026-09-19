import type {ExportTree} from "@vladyslav005/tt-core";
import {TexMapper} from "@vladyslav005/tt-core";
import type {ManualNode, ManualNodeResult} from "@/shared/ui-state/manualProof.ts";
import {
  CONSTRAINT_REF,
  EMPTY_SET,
  GAMMA_REF,
  parseFactText,
  parseTermProgram,
  parseTypeText,
  refIndex,
  splitDefinition,
  splitEquation,
  splitTopLevel,
  splitUnion,
  stripBraces,
} from "@/shared/lib/manualParse.ts";

const escapeText = (raw: string) => `\\text{${raw.replace(/[\\{}_%&#$^~]/g, (c) => (c === "\\" ? "\\textbackslash{}" : `\\${c}`))}}`;

// A field that can't be read is exported as typed instead of being dropped.
function orRaw(raw: string, convert: () => string): string {
  if (!raw.trim()) return "?";
  try {
    return convert();
  } catch {
    return escapeText(raw.trim());
  }
}

const typeTex = (text: string) => TexMapper.typeToTex(parseTypeText(text));

function indexed(symbol: string, match: RegExpExecArray): string {
  const index = refIndex(match);
  return index === undefined ? symbol : `${symbol}_{${index}}`;
}

function contextOperandTex(operand: string): string {
  const body = stripBraces(operand);
  if (EMPTY_SET.has(body.trim())) return "\\emptyset";
  const items = splitTopLevel(body, ",");
  const rendered = items.map((item) => {
    const ref = GAMMA_REF.exec(item);
    if (ref) return {tex: indexed("\\Gamma", ref), isRef: true};
    const colon = item.indexOf(":");
    if (colon < 0) throw new Error("not a binding");
    return {tex: `${item.slice(0, colon).trim()} : ${typeTex(item.slice(colon + 1))}`, isRef: false};
  });
  const joined = rendered.map((r) => r.tex).join(", ");
  return rendered.some((r) => r.isRef) ? joined : `\\{ ${joined} \\}`;
}

function constraintOperandTex(operand: string): string {
  const ref = CONSTRAINT_REF.exec(operand);
  if (ref) return indexed("C", ref);
  const body = stripBraces(operand);
  if (EMPTY_SET.has(body.trim())) return "\\emptyset";
  const equations = splitTopLevel(body, ",").map((item) => {
    const sides = splitEquation(item);
    if (!sides) throw new Error("not an equation");
    return `${typeTex(sides[0])} = ${typeTex(sides[1])}`;
  });
  return `\\{ ${equations.join(", ")} \\}`;
}

function factTex(text: string): string {
  const fact = parseFactText(text);
  if (fact.form === "membership") return `${fact.name} : ${TexMapper.typeToTex(fact.type)} \\in \\Gamma`;
  if (fact.form === "instantiate") return `\\mathit{instantiate}(${fact.name} : ${TexMapper.typeToTex(fact.scheme)} \\in \\Gamma)`;
  return `\\mathit{generalize}(${TexMapper.typeToTex(fact.type)}, \\Gamma) = ${TexMapper.typeToTex(fact.scheme)}`;
}

function highlightOf(result: ManualNodeResult | undefined): ExportTree["highlight"] {
  if (!result) return undefined;
  const verdicts = [result.rule, result.gamma, result.term, result.type, result.constraints, result.premises, result.fact];
  if (verdicts.includes("invalid")) return "invalid";
  return verdicts.includes("valid") ? "valid" : undefined;
}

export function manualNodeToExportTree(
  node: ManualNode,
  results: Record<string, ManualNodeResult>,
  usesConstraints: boolean,
): ExportTree {
  const highlight = highlightOf(results[node.id]);

  if (node.kind === "fact") {
    return {judgement: orRaw(node.fact, () => factTex(node.fact)), rule: "", id: node.id, highlight};
  }

  const contextTex = (text: string) => splitUnion(text).map(contextOperandTex).join(" \\cup ") || "\\emptyset";
  const constraintSetTex = (text: string) => splitUnion(text).map(constraintOperandTex).join(" \\cup ") || "\\emptyset";
  const gammaDefinition = splitDefinition(node.gamma);
  const gamma = orRaw(node.gamma, () => (gammaDefinition?.kind === "Γ"
    ? `\\Gamma_{${gammaDefinition.index}} = ${contextTex(gammaDefinition.rhs)}`
    : contextTex(node.gamma)));
  const term = orRaw(node.term, () => TexMapper.termToTex(parseTermProgram(node.term).term!));
  const type = orRaw(node.type, () => typeTex(node.type));
  const constraintsShown = node.constraintsShown ?? usesConstraints;
  const constraintDefinition = splitDefinition(node.constraints);
  const constraints = constraintsShown
    ? ` \\mid ${orRaw(node.constraints, () => (constraintDefinition?.kind === "C"
      ? `C_{${constraintDefinition.index}} = ${constraintSetTex(constraintDefinition.rhs)}`
      : constraintSetTex(node.constraints)))}`
    : "";

  return {
    judgement: `${gamma} \\vdash ${term} : ${type}${constraints}`,
    rule: node.rule.trim() || "?",
    id: node.id,
    highlight,
    children: node.premises.map((premise) => manualNodeToExportTree(premise, results, usesConstraints)),
  };
}
