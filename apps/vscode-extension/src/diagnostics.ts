import * as vscode from "vscode";
import { TypeCheckError } from "@vladyslav005/tt-core";
import { analysisCache } from "./analysis";
import { toRange } from "./positions";
import { onRelevantConfigChanged } from "./settings";

const LANGUAGE_ID = "tt";
const LINT_DEBOUNCE_MS = 300;

export function lintDocument(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	if (document.languageId !== LANGUAGE_ID) {
		return;
	}

	const diagnostics: vscode.Diagnostic[] = [];
	const analysis = analysisCache.getAnalysis(document);

	if (analysis.parseErrors) {
		for (const e of analysis.parseErrors) {
			diagnostics.push(new vscode.Diagnostic(toRange(e), e.message, vscode.DiagnosticSeverity.Error));
		}
		collection.set(document.uri, diagnostics);
		return;
	}

	for (const err of analysis.typeErrors ?? []) {
		const pos = err instanceof TypeCheckError ? err.pos : undefined;
		const range = pos ? toRange(pos) : new vscode.Range(0, 0, 0, 1);
		const hint = err instanceof TypeCheckError && err.hint ? `\nHint: ${err.hint}` : "";
		diagnostics.push(new vscode.Diagnostic(range, err.message + hint, vscode.DiagnosticSeverity.Error));
	}

	collection.set(document.uri, diagnostics);
}

export function registerDiagnostics(context: vscode.ExtensionContext): vscode.DiagnosticCollection {
	const collection = vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
	context.subscriptions.push(collection);

	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	const scheduleLint = (document: vscode.TextDocument) => {
		if (document.languageId !== LANGUAGE_ID) {
			return;
		}
		const key = document.uri.toString();
		clearTimeout(timers.get(key));
		timers.set(key, setTimeout(() => lintDocument(document, collection), LINT_DEBOUNCE_MS));
	};

	vscode.workspace.textDocuments.forEach((doc) => lintDocument(doc, collection));

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((doc) => lintDocument(doc, collection)),
		vscode.workspace.onDidChangeTextDocument((e) => scheduleLint(e.document)),
		vscode.workspace.onDidCloseTextDocument((doc) => {
			collection.delete(doc.uri);
			analysisCache.invalidate(doc.uri);
			const key = doc.uri.toString();
			clearTimeout(timers.get(key));
			timers.delete(key);
		}),
	);

	onRelevantConfigChanged(context, () => {
		vscode.workspace.textDocuments.forEach((doc) => lintDocument(doc, collection));
	});

	return collection;
}
