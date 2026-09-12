// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
	AntlrParserAdapter,
} from "@vladyslav005/tt-core";
import {registerDiagnostics} from "./diagnostics";
import {registerCompletions} from "./completions";
import {registerEvaluateCurrentFileCommand} from "./commands/evaluateCurrentFileCommand";
import {registerEvaluationStrategyCommand} from "./commands/evaluationStrategyCommand";
import {registerToggleTypeTheoriesCommand} from "./commands/toggleTypeTheoriesCommand";
import {registerExportProofTreeLatexCommand} from "./commands/exportProofTreeLatexCommand";
import {registerInsertExampleCommand} from "./commands/insertExampleCommand";
import {ttOutputChannel} from "./outputChannel";
import {registerEvaluationStepsCommand} from "./panels/evaluationStepsPanel";
import {registerProofTreeCommand} from "./panels/proofTreePanel";
import {registerAstGraphCommand} from "./panels/astGraphPanel";
import {AstTreeProvider} from "./astView/astTreeProvider";
import {revealPosition} from "./editorReveal";
import {registerStatusBar} from "./statusBar";
import {registerAutoShowPanels} from "./autoShowPanels";
import {registerFileDecoration} from "./fileDecoration";

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(ttOutputChannel);
	// Pre-selects "TT" in the Output panel's channel dropdown from the start, so it's already
	// there whenever the user opens Output — not just after running a command that writes to it.
	// preserveFocus keeps this from stealing focus away from the editor on activation.
	ttOutputChannel.show(true);

	registerDiagnostics(context);
	registerCompletions(context);
	registerFileDecoration(context);
	registerToggleTypeTheoriesCommand(context);
	registerInsertExampleCommand(context);
	registerEvaluationStrategyCommand(context);
	registerEvaluateCurrentFileCommand(context);
	registerStatusBar(context);
	registerEvaluationStepsCommand(context);
	registerProofTreeCommand(context);
	registerExportProofTreeLatexCommand(context);
	registerAstGraphCommand(context);
	registerAutoShowPanels(context);

	const astProvider = new AstTreeProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider("ttAstView", astProvider));
	context.subscriptions.push(
		vscode.commands.registerCommand("tt-vscode-extension.astView.reveal", async (pos) => {
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor) {
				await revealPosition(activeEditor.document.uri, pos);
			}
		}),
	);

	// No active text editor doesn't mean "switched away from a .tt file" — it also fires when
	// focus moves to a webview panel, the Output panel, etc. Only flip the context key when we
	// can see the user is actually on a different kind of file; otherwise leave it as-is so the
	// "TT AST" view doesn't disappear just because a panel was clicked.
	function updateTtActiveFileContext(): void {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return;
		}
		void vscode.commands.executeCommand("setContext", "tt.activeFileIsTt", activeEditor.document.languageId === "tt");
	}
	updateTtActiveFileContext();

	let astRefreshTimer: ReturnType<typeof setTimeout> | undefined;
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			updateTtActiveFileContext();
			astProvider.refresh();
		}),
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.languageId !== "tt") {
				return;
			}
			clearTimeout(astRefreshTimer);
			astRefreshTimer = setTimeout(() => astProvider.refresh(), 300);
		}),
	);

	const disposable = vscode.commands.registerCommand(
		"tt-vscode-extension.parseCurrentFile",
		() => {
			const editor = vscode.window.activeTextEditor;

			if (!editor) {
				vscode.window.showWarningMessage("No active editor.");
				return;
			}

			const source = editor.document.getText();

			try {
				const parser = new AntlrParserAdapter();

				parser.parseExpression(source);

				vscode.window.showInformationMessage(
					"TT: parsing successful",
				);
			} catch (error) {
				vscode.window.showErrorMessage(
					`TT: parsing failed: ${String(error)}`,
				);
			}
		},
	);

	context.subscriptions.push(disposable);
}

export function deactivate() {}
