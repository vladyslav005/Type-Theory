import * as vscode from "vscode";
import { EXAMPLE_GROUPS } from "@vladyslav005/tt-core";

interface ExamplePickItem extends vscode.QuickPickItem {
	code?: string;
}

export function registerInsertExampleCommand(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand("tt-vscode-extension.insertExample", async () => {
			// One flat list with a separator per group — lets VS Code's own fuzzy filter search
			// across every example's label/group/description at once, same as the web app's
			// search box, while the separators keep it visually structured by topic.
			const items: ExamplePickItem[] = EXAMPLE_GROUPS.flatMap((group) => [
				{ label: group.title, kind: vscode.QuickPickItemKind.Separator } as ExamplePickItem,
				...group.items.map((item) => ({
					label: item.label,
					description: group.title,
					detail: item.description,
					code: item.code,
				})),
			]);

			const picked = await vscode.window.showQuickPick(items, {
				placeHolder: "Insert an example (type to search by name, topic, or description)",
				matchOnDescription: true,
				matchOnDetail: true,
			});
			if (!picked?.code) {
				return;
			}

			await insertExampleCode(picked.code);
		}),
	);
}

// Replaces the whole file, matching the web app's "picking an example replaces the editor" —
// unless there's no .tt file open to replace, in which case it opens a fresh one instead of
// blocking, since browsing examples shouldn't require already having a file ready.
async function insertExampleCode(code: string): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (editor && editor.document.languageId === "tt") {
		const fullRange = new vscode.Range(
			editor.document.positionAt(0),
			editor.document.positionAt(editor.document.getText().length),
		);
		await editor.edit((editBuilder) => editBuilder.replace(fullRange, code));
		return;
	}

	const doc = await vscode.workspace.openTextDocument({ language: "tt", content: code });
	await vscode.window.showTextDocument(doc);
}
