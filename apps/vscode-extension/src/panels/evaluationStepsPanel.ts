import * as vscode from "vscode";
import { Evaluator } from "@vladyslav005/tt-core";
import { analysisCache } from "../analysis";
import { describeStep, printTerm } from "../evaluation/format";
import { getEvaluationStrategy, onRelevantConfigChanged } from "../settings";
import { EvalStepsToHostMessage, HostToEvalStepsMessage } from "../webviewProtocol";
import { createTtWebviewPanel } from "./panelBase";

const REFRESH_DEBOUNCE_MS = 300;

export class EvaluationStepsPanel {
	private static current: EvaluationStepsPanel | undefined;

	private readonly panel: vscode.WebviewPanel;
	private document: vscode.TextDocument;
	private changeTimer: ReturnType<typeof setTimeout> | undefined;

	static createOrShow(
		context: vscode.ExtensionContext,
		document: vscode.TextDocument,
		column: vscode.ViewColumn = vscode.ViewColumn.Beside,
		onClosedByUser?: () => void,
	): void {
		if (EvaluationStepsPanel.current) {
			EvaluationStepsPanel.current.document = document;
			EvaluationStepsPanel.current.panel.reveal();
			EvaluationStepsPanel.current.refresh();
			return;
		}
		EvaluationStepsPanel.current = new EvaluationStepsPanel(context, document, column, onClosedByUser);
	}

	private constructor(
		context: vscode.ExtensionContext,
		document: vscode.TextDocument,
		column: vscode.ViewColumn,
		onClosedByUser?: () => void,
	) {
		this.document = document;
		this.panel = createTtWebviewPanel(
			context,
			"ttEvaluationSteps",
			"TT: Evaluation Steps",
			"evaluationSteps.js",
			"evaluationSteps.css",
			column,
		);
		this.panel.onDidDispose(() => {
			EvaluationStepsPanel.current = undefined;
			onClosedByUser?.();
		});
		this.panel.webview.onDidReceiveMessage((msg: EvalStepsToHostMessage) => {
			if (msg.type === "ready") {
				this.refresh();
			}
		});

		context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document.uri.toString() !== this.document.uri.toString()) {
					return;
				}
				clearTimeout(this.changeTimer);
				this.changeTimer = setTimeout(() => this.refresh(), REFRESH_DEBOUNCE_MS);
			}),
			vscode.window.onDidChangeActiveTextEditor((editor) => {
				if (editor && editor.document.languageId === "tt") {
					this.document = editor.document;
					this.refresh();
				}
			}),
		);
		onRelevantConfigChanged(context, () => this.refresh());
	}

	private post(message: HostToEvalStepsMessage): void {
		this.panel.webview.postMessage(message);
	}

	private refresh(): void {
		const analysis = analysisCache.getAnalysis(this.document);
		if (analysis.parseErrors) {
			this.post({ type: "invalid", messages: analysis.parseErrors.map((e) => e.message) });
			return;
		}
		if (!analysis.program) {
			this.post({ type: "clear" });
			return;
		}
		if (!analysis.program.term) {
			this.post({
				type: "invalid",
				messages: ["No expression to evaluate — add a trailing term after your declarations."],
			});
			return;
		}
		const result = new Evaluator().evaluate(analysis.program, getEvaluationStrategy());
		this.post({
			type: "render",
			payload: {
				strategy: result.strategy,
				reachedStepLimit: result.reachedStepLimit,
				errors: result.errors,
				finalResultText: printTerm(result.result),
				steps: result.steps.map((s, i) => describeStep(s, i)),
			},
		});
	}
}

export function registerEvaluationStepsCommand(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand("tt-vscode-extension.showEvaluationSteps", () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor || editor.document.languageId !== "tt") {
				vscode.window.showWarningMessage("Open a .tt file first.");
				return;
			}
			EvaluationStepsPanel.createOrShow(context, editor.document);
		}),
	);
}
