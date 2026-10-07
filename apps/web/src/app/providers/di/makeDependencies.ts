import {AntlrParserAdapter} from "@vladyslav005/tt-core";
import {SLTLCTypeChecker} from "@vladyslav005/tt-core";
import {TexMapper} from "@vladyslav005/tt-core";
import {LogicMapper} from "@vladyslav005/tt-core";
import {AstFlowMapper} from "@/shared/presentation/flow/FlowMapper.ts";
import {Evaluator} from "@vladyslav005/tt-core";


export function makeDependencies() {
  return {
    parser: new AntlrParserAdapter(),
    typeCheckerSLTC: new SLTLCTypeChecker(),
    evaluator: new Evaluator(3000, {maximumTermSize: 1000}),
    texMapper: new TexMapper(),
    logicMapper: new LogicMapper(),
    flowMapper: new AstFlowMapper()
  } as const;
}

export type Dependencies = ReturnType<typeof makeDependencies>;