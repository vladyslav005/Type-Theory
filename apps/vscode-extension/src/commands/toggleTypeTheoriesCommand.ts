import * as vscode from "vscode";
import { TYPE_THEORIES, TypeTheoryId } from "@vladyslav005/tt-core";
import { getTypeTheoryConfig, setTypeTheoryEnabled } from "../settings";

const EXCLUSIVE_IDS: TypeTheoryId[] = ["untyped", "nbl", "typedNbl"];

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
			// separate "confirm" step for a multi-select picker. Untyped lambda calculus and
			// NBL replace STLC rather than compose with it: enabling one clears every other
			// theory (re-syncing the picker's checkboxes), and enabling anything else clears them.
			quickPick.onDidChangeSelection((selection) => {
				let pickedIds = new Set(selection.map((item) => item.id));
				const exclusiveJustEnabled = EXCLUSIVE_IDS.find((id) => pickedIds.has(id) && !previousIds.has(id));
				const otherJustEnabled = [...pickedIds].some((id) => !EXCLUSIVE_IDS.includes(id) && !previousIds.has(id));

				if (exclusiveJustEnabled) {
					pickedIds = new Set([exclusiveJustEnabled]);
				} else if (otherJustEnabled) {
					EXCLUSIVE_IDS.forEach((id) => pickedIds.delete(id));
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
