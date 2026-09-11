// Shared between the extension host and webview bundles. No imports from "vscode" or
// "@vladyslav005/tt-core" here — this file is compiled by both tsconfig.json (Node) and
// tsconfig.webview.json (DOM), and the webview bundle never depends on tt-core.

// ===== Evaluation Steps panel =====

export interface EvalStepView {
	index: number;
	beforeText: string;
	afterText: string;
	selectedText?: string;
	resultText?: string;
	bindingText?: string;
}

export interface EvalStepsPayload {
	strategy: string;
	reachedStepLimit: boolean;
	errors?: { message: string }[];
	finalResultText: string;
	steps: EvalStepView[];
}

export type HostToEvalStepsMessage =
	| { type: "render"; payload: EvalStepsPayload }
	| { type: "invalid"; messages: string[] }
	| { type: "clear" };
export type EvalStepsToHostMessage = { type: "ready" };

// ===== Proof Tree panel =====

// Structurally identical to tt-core's SourcePosition — redeclared here since this file
// must have zero imports from "@vladyslav005/tt-core" (compiled into the webview bundle too).
export interface UnicodeSourcePosition {
	line: number;
	column: number;
	length: number;
	endLine?: number;
	endColumn?: number;
}

export type UnicodeTexSegment = { kind: "tex"; value: string } | { kind: "ref"; key: string };

export interface UnicodeTexTree {
	judgement: string;
	judgementSegments?: UnicodeTexSegment[];
	rule: string;
	ruleTooltip?: string;
	id?: string;
	pos?: UnicodeSourcePosition;
	error?: string;
	meta?: string;
	collapsedRule?: string;
	children?: UnicodeTexTree[];
	collapsedChildren?: UnicodeTexTree[];
}

export interface ProofTreePayload {
	mode: "derivation" | "logic";
	logicAvailable: boolean;
	registry: Record<string, { short: string; full: string }>;
	tree: UnicodeTexTree;
}

export type HostToProofTreeMessage =
	| { type: "render"; payload: ProofTreePayload }
	| { type: "invalid"; messages: string[] }
	| { type: "empty"; message: string }
	| { type: "clear" };
export type ProofTreeToHostMessage =
	| { type: "ready" }
	| { type: "setMode"; mode: "derivation" | "logic" }
	| { type: "hoverPos"; pos: UnicodeSourcePosition }
	| { type: "unhoverPos" };

// ===== AST Graph panel =====

export type AstNodeCategory = "program" | "decl" | "term" | "type" | "kind";

export interface AstGraphNode {
	kind: string;
	label: string;
	description: string;
	category: AstNodeCategory;
	pos?: UnicodeSourcePosition;
	children: AstGraphNode[];
}

export interface AstGraphPayload {
	tree: AstGraphNode;
}

export type HostToAstGraphMessage =
	| { type: "render"; payload: AstGraphPayload }
	| { type: "invalid"; messages: string[] }
	| { type: "clear" };
export type AstGraphToHostMessage =
	| { type: "ready" }
	| { type: "hoverPos"; pos: UnicodeSourcePosition }
	| { type: "unhoverPos" };
