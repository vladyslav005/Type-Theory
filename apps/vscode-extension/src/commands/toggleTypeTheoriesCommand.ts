import * as vscode from "vscode";
import { TYPE_THEORIES, TypeTheoryId } from "@vladyslav005/tt-core";
import { getTypeTheoryConfig, setTypeTheoryEnabled } from "../settings";

interface TheoryPickItem extends vscode.QuickPickItem {
	id: TypeTheoryId;
}

export function registerToggleTypeTheoriesCommand(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand("tt-vscode-extension.toggleTypeTheories", () => {
			const current = getTypeTheoryConfig();
			const items: TheoryPickItem[] = TYPE_THEORIES.map((t) => ({
				label: t.label,
				description: t.shortLabel,
				detail: t.description,
				id: t.id,
			}));

			const quickPick = vscode.window.createQuickPick<TheoryPickItem>();
			quickPick.items = items;
			quickPick.canSelectMany = true;
			quickPick.placeholder = "Select type theory extensions to enable";
			quickPick.selectedItems = items.filter((item) => current[item.id]);

			// Applied on every checkbox toggle, not just on accept, so there's no
			// separate "confirm" step for a multi-select picker.
			quickPick.onDidChangeSelection((selection) => {
				const pickedIds = new Set(selection.map((item) => item.id));
				void Promise.all(TYPE_THEORIES.map((t) => setTypeTheoryEnabled(t.id, pickedIds.has(t.id))));
			});
			quickPick.onDidHide(() => quickPick.dispose());
			quickPick.show();
		}),
	);
}
