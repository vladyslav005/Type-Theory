import * as vscode from "vscode";
import { analysisCache } from "../analysis";
import { computeTexTree } from "../proofTree/computeTexTree";
import { clearHighlight, highlightPosition } from "../editorHighlight";
import { toUnicodeRegistry, toUnicodeTree } from "../proofTree/latexToUnicode";
import { HostToProofTreeMessage, ProofTreePayload, ProofTreeToHostMessage } from "../webviewProtocol";
import { createTtWebviewPanel } from "./panelBase";

export class ProofTreePanel {
	private static current: ProofTreePanel | undefined;

	private readonly panel: vscode.WebviewPanel;
	private document: vscode.TextDocument;
	private mode: "derivation" | "logic" = "derivation";
	private wasVisible = true;

	static createOrShow(
		context: vscode.ExtensionContext,
		document: vscode.TextDocument,
		column: vscode.ViewColumn = vscode.ViewColumn.Beside,
		onClosedByUser?: () => void,
	): void {
		if (ProofTreePanel.current) {
			ProofTreePanel.current.document = document;
			ProofTreePanel.current.panel.reveal();
			ProofTreePanel.current.refresh();
			return;
		}
		ProofTreePanel.current = new ProofTreePanel(context, document, column, onClosedByUser);
	}

	private constructor(
		context: vscode.ExtensionContext,
		document: vscode.TextDocument,
		column: vscode.ViewColumn,
		onClosedByUser?: () => void,
	) {
		this.document = document;
		this.panel = createTtWebviewPanel(context, "ttProofTree", "TT: Proof Tree", "proofTree.js", "proofTree.css", column);
		this.panel.onDidDispose(() => {
			ProofTreePanel.current = undefined;
			onClosedByUser?.();
		});
		// A panel auto-opened as a background tab renders once at zero size; re-sending the
		// render payload the moment it FIRST becomes visible gives the webview's fit-to-view
		// logic another chance to run against real dimensions. Only that hidden->visible edge
		// matters — `visible` also stays true while merely losing/regaining focus (e.g. clicking
		// into the editor), and refreshing on every such no-op wipes the user's pan/zoom state.
		this.panel.onDidChangeViewState((e) => {
			const isVisible = e.webviewPanel.visible;
			if (isVisible && !this.wasVisible) {
				this.refresh();
			}
			this.wasVisible = isVisible;
		});
		this.panel.webview.onDidReceiveMessage((msg: ProofTreeToHostMessage) => {
			if (msg.type === "ready") {
				this.refresh();
			} else if (msg.type === "setMode") {
				this.mode = msg.mode;
				this.refresh();
			} else if (msg.type === "hoverPos") {
				highlightPosition(this.document.uri, msg.pos);
			} else if (msg.type === "unhoverPos") {
				clearHighlight(this.document.uri);
			}
		});

		context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document.uri.toString() === this.document.uri.toString()) {
					this.refresh();
				}
			}),
		);
	}

	private post(message: HostToProofTreeMessage): void {
		this.panel.webview.postMessage(message);
	}

	private refresh(): void {
		const analysis = analysisCache.getAnalysis(this.document);
		if (analysis.parseErrors) {
			this.post({ type: "invalid", messages: analysis.parseErrors.map((e) => e.message) });
			return;
		}
		if (!analysis.proof) {
			this.post({ type: "clear" });
			return;
		}
		if (analysis.theories.untyped) {
			this.post({ type: "empty", message: "Untyped lambda calculus has no type derivation to show." });
			return;
		}

		const { texTree, effectiveMode, logicAvailable } = computeTexTree(
			analysis.proof,
			analysis.theories,
			analysis.typeAliases,
			this.mode,
		);

		const payload: ProofTreePayload = {
			mode: effectiveMode,
			logicAvailable,
			registry: toUnicodeRegistry(texTree.registry ?? {}),
			tree: toUnicodeTree(texTree),
		};
		this.post({ type: "render", payload });
	}
}

export function registerProofTreeCommand(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand("tt-vscode-extension.showProofTree", () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor || editor.document.languageId !== "tt") {
				vscode.window.showWarningMessage("Open a .tt file first.");
				return;
			}
			ProofTreePanel.createOrShow(context, editor.document);
		}),
	);
}
