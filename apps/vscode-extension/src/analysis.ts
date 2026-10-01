import * as vscode from "vscode";
import {
	AntlrParserAdapter,
	elaborateNbl,
	InferProofTree,
	ParseSyntaxError,
	Program,
	SLTLCTypeChecker,
	Type,
	TypeTheoryConfig,
} from "@vladyslav005/tt-core";
import { CorePosition } from "./positions";
import { getTypeTheoryConfig } from "./settings";

export interface DocumentAnalysis {
	version: number;
	theories: TypeTheoryConfig;
	program?: Program;
	parseErrors?: (CorePosition & { message: string })[];
	proof?: InferProofTree;
	typeErrors?: Error[];
	typeAliases?: { [name: string]: Type };
}

function theoriesEqual(a: TypeTheoryConfig, b: TypeTheoryConfig): boolean {
	return (Object.keys(a) as (keyof TypeTheoryConfig)[]).every((k) => a[k] === b[k]);
}

class AnalysisCache {
	private byUri = new Map<string, DocumentAnalysis>();

	getAnalysis(document: vscode.TextDocument): DocumentAnalysis {
		const key = document.uri.toString();
		const theories = getTypeTheoryConfig();
		const cached = this.byUri.get(key);
		if (cached && cached.version === document.version && theoriesEqual(cached.theories, theories)) {
			return cached;
		}
		const analysis = this.compute(document, theories);
		this.byUri.set(key, analysis);
		return analysis;
	}

	invalidate(uri: vscode.Uri): void {
		this.byUri.delete(uri.toString());
	}

	private compute(document: vscode.TextDocument, theories: TypeTheoryConfig): DocumentAnalysis {
		const parser = new AntlrParserAdapter();
		try {
			const parsed = parser.parseExpression(document.getText());
			const program = theories.nbl ? elaborateNbl(parsed) : parsed;
			const checker = new SLTLCTypeChecker();
			checker.setTheories(theories);
			const proof = checker.check(program);
			return {
				version: document.version,
				theories,
				program,
				proof,
				typeErrors: checker.getErrors(),
				typeAliases: checker.getTypeAliases(),
			};
		} catch (error) {
			if (error instanceof ParseSyntaxError) {
				return { version: document.version, theories, parseErrors: error.errors };
			}
			throw error;
		}
	}
}

export const analysisCache = new AnalysisCache();
