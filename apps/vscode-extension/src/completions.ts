import * as vscode from "vscode";

const LANGUAGE_ID = "tt";

interface StaticItem {
	label: string;
	insertText: string;
	detail: string;
	snippet?: boolean;
}

// Mirrors setUpEditor.ts's first registerCompletionItemProvider call: keyword/value
// snippets plus the handful of `\`-prefixed shortcuts that ride along on whatever
// opened the suggest widget (usually the Greek-letter provider below).
const KEYWORD_ITEMS: StaticItem[] = [
	{ label: "typedef", insertText: "typedef ", detail: "typedef" },
	{ label: "true", insertText: "true", detail: "true" },
	{ label: "false", insertText: "false", detail: "false" },
	{ label: "unit", insertText: "unit", detail: "unit" },
	{ label: "Unit", insertText: "Unit", detail: "Unit type" },
	{ label: "String", insertText: "String", detail: "String type" },
	{ label: "nil", insertText: "nil[$1]", detail: "nil", snippet: true },
	{ label: "head", insertText: "head[$1]", detail: "head", snippet: true },
	{ label: "cons", insertText: "cons[$1]", detail: "cons", snippet: true },
	{ label: "tail", insertText: "tail[$1]", detail: "tail", snippet: true },
	{ label: "isnil", insertText: "isnil[$1]", detail: "isnil", snippet: true },
];

const SLASH_ITEMS: StaticItem[] = [
	{ label: "\\abstraction", insertText: "λ x : T . (x) : T -> T", detail: "Abstraction" },
	{ label: "\\tyconstructor", insertText: "λ X : @ . X", detail: "Type constructor abstraction (kind @) — System λω̲" },
	{ label: "\\to", insertText: "->", detail: "Arrow" },
	{ label: "\\Rightarrow", insertText: "=>", detail: "DoubleArrow" },
];

// Mirrors the second provider (triggerCharacters: ['\\']) — the full Greek alphabet
// plus \forall, in the same order as setUpEditor.ts.
const GREEK_ITEMS: StaticItem[] = [
	{ label: "\\forall", insertText: "∀", detail: "Forall" },
	{ label: "\\alpha", insertText: "α", detail: "Alpha" },
	{ label: "\\beta", insertText: "β", detail: "Beta" },
	{ label: "\\gamma", insertText: "γ", detail: "Gamma" },
	{ label: "\\delta", insertText: "δ", detail: "Delta" },
	{ label: "\\epsilon", insertText: "ε", detail: "Epsilon" },
	{ label: "\\zeta", insertText: "ζ", detail: "Zeta" },
	{ label: "\\eta", insertText: "η", detail: "Eta" },
	{ label: "\\theta", insertText: "θ", detail: "Theta" },
	{ label: "\\iota", insertText: "ι", detail: "Iota" },
	{ label: "\\kappa", insertText: "κ", detail: "Kappa" },
	{ label: "\\lambda", insertText: "λ", detail: "Lambda" },
	{ label: "\\mu", insertText: "μ", detail: "Mu" },
	{ label: "\\nu", insertText: "ν", detail: "Nu" },
	{ label: "\\xi", insertText: "ξ", detail: "Xi" },
	{ label: "\\omicron", insertText: "ο", detail: "Omicron" },
	{ label: "\\pi", insertText: "π", detail: "Pi" },
	{ label: "\\rho", insertText: "ρ", detail: "Rho" },
	{ label: "\\sigma", insertText: "σ", detail: "Sigma" },
	{ label: "\\tau", insertText: "τ", detail: "Tau" },
	{ label: "\\upsilon", insertText: "υ", detail: "Upsilon" },
	{ label: "\\phi", insertText: "φ", detail: "Phi" },
	{ label: "\\chi", insertText: "χ", detail: "Chi" },
	{ label: "\\psi", insertText: "ψ", detail: "Psi" },
	{ label: "\\omega", insertText: "ω", detail: "Omega" },
	{ label: "\\Alpha", insertText: "Α", detail: "Capital Alpha" },
	{ label: "\\Beta", insertText: "Β", detail: "Capital Beta" },
	{ label: "\\Gamma", insertText: "Γ", detail: "Capital Gamma" },
	{ label: "\\Delta", insertText: "Δ", detail: "Capital Delta" },
	{ label: "\\Epsilon", insertText: "Ε", detail: "Capital Epsilon" },
	{ label: "\\Zeta", insertText: "Ζ", detail: "Capital Zeta" },
	{ label: "\\Eta", insertText: "Η", detail: "Capital Eta" },
	{ label: "\\Theta", insertText: "Θ", detail: "Capital Theta" },
	{ label: "\\Iota", insertText: "Ι", detail: "Capital Iota" },
	{ label: "\\Kappa", insertText: "Κ", detail: "Capital Kappa" },
	{ label: "\\Lambda", insertText: "Λ", detail: "Capital Lambda" },
	{ label: "\\Mu", insertText: "Μ", detail: "Capital Mu" },
	{ label: "\\Nu", insertText: "Ν", detail: "Capital Nu" },
	{ label: "\\Xi", insertText: "Ξ", detail: "Capital Xi" },
	{ label: "\\Omicron", insertText: "Ο", detail: "Capital Omicron" },
	{ label: "\\Pi", insertText: "Π", detail: "Pi (dependent function type binder) — System λP" },
	{ label: "\\Rho", insertText: "Ρ", detail: "Capital Rho" },
	{ label: "\\Sigma", insertText: "Σ", detail: "Capital Sigma" },
	{ label: "\\Tau", insertText: "Τ", detail: "Capital Tau" },
	{ label: "\\Upsilon", insertText: "Υ", detail: "Capital Upsilon" },
	{ label: "\\Phi", insertText: "Φ", detail: "Capital Phi" },
	{ label: "\\Chi", insertText: "Χ", detail: "Capital Chi" },
	{ label: "\\Psi", insertText: "Ψ", detail: "Capital Psi" },
	{ label: "\\Omega", insertText: "Ω", detail: "Capital Omega" },
];

// Range of the word ending at `position` (Monaco's getWordUntilPosition equivalent —
// only what's already typed, not any word characters after the cursor).
function wordUntilPosition(document: vscode.TextDocument, position: vscode.Position): vscode.Range {
	const wordRange = document.getWordRangeAtPosition(position);
	if (!wordRange) {
		return new vscode.Range(position, position);
	}
	return new vscode.Range(wordRange.start, position);
}

// Same, extended one character left to also consume the `\` that triggered the suggestion.
function slashRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range {
	const word = wordUntilPosition(document, position);
	const start = word.start.character > 0
		? word.start.translate(0, -1)
		: word.start;
	return new vscode.Range(start, position);
}

function toCompletionItem(item: StaticItem, range: vscode.Range, kind: vscode.CompletionItemKind): vscode.CompletionItem {
	const completion = new vscode.CompletionItem(item.label, kind);
	completion.insertText = item.snippet ? new vscode.SnippetString(item.insertText) : item.insertText;
	completion.detail = item.detail;
	completion.range = range;
	return completion;
}

export function registerCompletions(context: vscode.ExtensionContext): void {
	// Keyword/value snippets, live-buffer variable names, and the plain-text `\`
	// shortcuts — merged into one provider, same as setUpEditor.ts.
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(LANGUAGE_ID, {
			provideCompletionItems(document, position) {
				const word = wordUntilPosition(document, position);
				if (document.getText(word).length === 0) {
					return { items: [] };
				}

				const textUntilPosition = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
				const currentWord = document.getText(word);
				const variables = new Set<string>();
				for (const match of textUntilPosition.matchAll(/\b([a-zA-Z_]\w*)\b/g)) {
					if (match[1] !== currentWord) {
						variables.add(match[1]);
					}
				}

				const variableItems = Array.from(variables).map((name) => {
					const completion = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
					completion.insertText = name;
					completion.detail = "Variable auto-completion";
					completion.range = word;
					return completion;
				});

				const keywordItems = KEYWORD_ITEMS.map((item) => toCompletionItem(item, word, vscode.CompletionItemKind.Text));
				const slashItems = SLASH_ITEMS.map((item) => toCompletionItem(item, slashRange(document, position), vscode.CompletionItemKind.Text));

				return { items: [...keywordItems, ...slashItems, ...variableItems] };
			},
		}),
	);

	// Greek-letter palette, opened by typing `\`.
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			LANGUAGE_ID,
			{
				provideCompletionItems(document, position) {
					const range = slashRange(document, position);
					return { items: GREEK_ITEMS.map((item) => toCompletionItem(item, range, vscode.CompletionItemKind.Text)) };
				},
			},
			"\\",
		),
	);
}
