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

			let previousIds = new Set(TYPE_THEORIES.filter((t) => current[t.id]).map((t) => t.id));
			quickPick.selectedItems = items.filter((item) => previousIds.has(item.id));

			// Applied on every checkbox toggle, not just on accept, so there's no
			// separate "confirm" step for a multi-select picker. "Untyped lambda calculus"
			// is XOR'd with every other theory — it needs to genuinely bypass STLC's
			// type-checking rather than compose with it, so enabling it clears the other 6
			// (and re-syncs the picker's own checkboxes to match), and enabling any of the
			// other 6 clears it.
			quickPick.onDidChangeSelection((selection) => {
				let pickedIds = new Set(selection.map((item) => item.id));
				const untypedJustEnabled = pickedIds.has("untyped") && !previousIds.has("untyped");
				const otherJustEnabled = [...pickedIds].some((id) => id !== "untyped" && !previousIds.has(id));

				if (untypedJustEnabled) {
					pickedIds = new Set(["untyped"]);
				} else if (pickedIds.has("untyped") && otherJustEnabled) {
					pickedIds.delete("untyped");
				}

				previousIds = pickedIds;
				quickPick.selectedItems = items.filter((item) => pickedIds.has(item.id));
				void Promise.all(TYPE_THEORIES.map((t) => setTypeTheoryEnabled(t.id, pickedIds.has(t.id))));
			});
			quickPick.onDidHide(() => quickPick.dispose());
			quickPick.show();
		}),
	);
}
