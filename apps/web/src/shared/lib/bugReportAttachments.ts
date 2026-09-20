import {AntlrParserAdapter, Evaluator, SLTLCTypeChecker, type Program, type ProofTree} from "@vladyslav005/tt-core";
import {strToU8, zipSync} from "fflate";
import type {TermState} from "@/shared/ui-state/termSlice.ts";
import {getEvaluationPracticeSnapshot} from "@/shared/lib/studentWorkSnapshot.ts";

export interface BugReportFile {
  name: string;
  type: string;
  base64: string;
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const stringify = (value: unknown) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Error) return {name: v.name, message: v.message};
    if (v && typeof v === "object") {
      if (seen.has(v)) return "[circular]";
      seen.add(v);
    }
    return v;
  }, 2);
};

// Fresh engine instances so filling in a missing tree/evaluation can't disturb the live UI's checker state.
function computeMissing(term: TermState) {
  let ast: Program | undefined = term.ast;
  let proof: ProofTree | undefined = term.proof;
  let evaluation = term.evaluation;
  let inferenceSteps: unknown = term.inferenceSteps;
  let typeAliases: unknown = term.typeAliases;
  const errors: string[] = [];

  try {
    if (!ast && term.termText) ast = new AntlrParserAdapter().parseExpression(term.termText);
    if (ast?.term && !proof) {
      const checker = new SLTLCTypeChecker();
      checker.setTheories(term.enabledTheories);
      proof = checker.check(ast);
      inferenceSteps = checker.getInferenceSteps();
      typeAliases = checker.getTypeAliases();
    }
    if (ast?.term && !evaluation) evaluation = new Evaluator().evaluate(ast, term.evaluationStrategy);
  } catch (e) {
    errors.push((e as Error).message);
  }
  return {ast, proof, evaluation, inferenceSteps, typeAliases, errors};
}

export function buildBugReportAttachments(term: TermState, context: unknown, includeState: boolean): BugReportFile[] {
  const {ast, proof, evaluation, inferenceSteps, typeAliases, errors} = includeState
    ? computeMissing(term)
    : {ast: undefined, proof: undefined, evaluation: undefined, inferenceSteps: undefined, typeAliases: undefined, errors: []};
  const practice = includeState ? getEvaluationPracticeSnapshot() : undefined;
  const proofBuild = includeState && term.buildMode.active ? {...term.buildMode, answerKey: undefined} : undefined;

  const entries: [string, string | undefined][] = [
    ["context.json", stringify(context)],
    ["program.tt", includeState ? term.termText : undefined],
    ["ast.json", ast && stringify(ast)],
    ["proof-tree.json", proof && stringify({proof, typeAliases, inferenceSteps})],
    ["evaluation.json", evaluation && stringify(evaluation)],
    ["student-work.json", (proofBuild || practice) ? stringify({proofBuild, evaluationPractice: practice}) : undefined],
    ["attach-errors.txt", errors.length ? errors.join("\n") : undefined],
  ];

  const files = Object.fromEntries(entries.flatMap(([name, content]) => (content ? [[name, strToU8(content)]] : [])));
  return [{name: "bug-report.zip", type: "application/zip", base64: toBase64(zipSync(files, {level: 9}))}];
}
