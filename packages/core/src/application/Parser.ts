import type {Program} from "@/domain/ast";
import type {ParseOptions} from "@/adapter/AntlrParserAdapter";

export interface Parser {
  parseExpression(input: string, options?: ParseOptions): Program
}