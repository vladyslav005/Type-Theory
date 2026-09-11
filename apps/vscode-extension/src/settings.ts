import * as vscode from "vscode";
import { EvaluationStrategy, TypeTheoryConfig, TypeTheoryId } from "@vladyslav005/tt-core";

const TYPE_THEORY_SECTION = "tt.typeTheories";
const STRATEGY_KEY = "tt.evaluationStrategy";

const TYPE_THEORY_IDS: TypeTheoryId[] = [
	"untyped",
	"letPolymorphism",
	"typeInference",
	"isoRecursiveTypes",
	"systemF",
	"systemFOmega",
	"systemLambdaP",
];

export function getTypeTheoryConfig(): TypeTheoryConfig {
	const cfg = vscode.workspace.getConfiguration(TYPE_THEORY_SECTION);
	return Object.fromEntries(
		TYPE_THEORY_IDS.map((id) => [id, cfg.get<boolean>(id, false)]),
	) as unknown as TypeTheoryConfig;
}

export function setTypeTheoryEnabled(id: TypeTheoryId, enabled: boolean): Thenable<void> {
	return vscode.workspace
		.getConfiguration(TYPE_THEORY_SECTION)
		.update(id, enabled, vscode.ConfigurationTarget.Global);
}

export function getEvaluationStrategy(): EvaluationStrategy {
	const raw = vscode.workspace.getConfiguration().get<string>(STRATEGY_KEY, EvaluationStrategy.CALL_BY_VALUE);
	const values: string[] = Object.values(EvaluationStrategy);
	return values.includes(raw) ? (raw as EvaluationStrategy) : EvaluationStrategy.CALL_BY_VALUE;
}

export function setEvaluationStrategy(strategy: EvaluationStrategy): Thenable<void> {
	return vscode.workspace.getConfiguration().update(STRATEGY_KEY, strategy, vscode.ConfigurationTarget.Global);
}

// A "Toggle Type Theories" QuickPick accept fires up to 6 sequential config updates;
// debouncing collapses those into a single relint instead of six.
export function onRelevantConfigChanged(context: vscode.ExtensionContext, cb: () => void): void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("tt.typeTheories") || e.affectsConfiguration("tt.evaluationStrategy")) {
				clearTimeout(timer);
				timer = setTimeout(cb, 50);
			}
		}),
	);
}
