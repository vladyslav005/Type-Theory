export * from "@/domain/ast";
export * from "@/domain/typeTheory";

export type {Parser} from "@/application/Parser";

export {AntlrParserAdapter} from "@/adapter/AntlrParserAdapter";
export {ParseSyntaxError} from "@/adapter/SyntaxErrorListener";

export {Evaluator} from "@/application/evaluation/Evaluator";
export * from "@/application/evaluation/type";
export {
  accumulateBindings,
  type BoundEntry,
} from "@/application/evaluation/accumulatedBindings";

export {AstVisitor} from "@/application/AstVisitor";
export {ProofTreeVisitor} from "@/application/ProofTreeVisitor";

export {SLTLCTypeChecker} from "@/application/typecheck/STLCTypeChecker";
export * from "@/application/typecheck/ProofTree";
export {TypeCheckError} from "@/application/typecheck/TypeCheckError";
export {
  termIndexEquals,
  typeToString,
  kindToString,
  termIndexToString,
  expandTypeAliases,
  normalizeType,
  typeEquals,
} from "@/application/typecheck/utils";

export {
  AstPrettyPrinter,
  astToText,
} from "@/presentation/AstPrettyPrinter";

export * from "@/presentation/tex/TexMapper";
export * from "@/presentation/tex/texTree";

export {
  LogicMapper,
  NonStlcProofError,
  isPlainStlcProof,
} from "@/presentation/tex/LogicMapper";

export {GammaRegistry} from "@/presentation/tex/GammaRegistry";

export {
  texTreeToEbproofDocument,
  type ExportTree,
} from "@/presentation/tex/ebproofExport";