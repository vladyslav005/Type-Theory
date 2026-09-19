import { AstPrettyPrinter, EvaluationResult, ReductionStep, Term } from "@vladyslav005/tt-core";

const printer = new AstPrettyPrinter();

function findTermById(term: Term, id: string): Term | undefined {
	if (term.id === id) {
		return term;
	}
	for (const value of Object.values(term)) {
		if (!value || typeof value !== "object") {
			continue;
		}
		if ("kind" in value) {
			const found = findTermById(value as Term, id);
			if (found) {
				return found;
			}
		} else if (Array.isArray(value)) {
			for (const item of value) {
				if (item && typeof item === "object") {
					if ("kind" in item) {
						const found = findTermById(item as Term, id);
						if (found) {
							return found;
						}
					} else {
						for (const nested of Object.values(item)) {
							if (nested && typeof nested === "object" && "kind" in (nested as object)) {
								const found = findTermById(nested as Term, id);
								if (found) {
									return found;
								}
							}
						}
					}
				}
			}
		}
	}
	return undefined;
}

export interface EvalStepView {
	index: number;
	beforeText: string;
	afterText: string;
	selectedText?: string;
	resultText?: string;
	bindingText?: string;
}

export function printTerm(term: Term): string {
	return printer.printTerm(term);
}

export function describeStep(step: ReductionStep, index: number): EvalStepView {
	const selected = findTermById(step.before, step.selectedId);
	const result = step.resultId ? findTermById(step.after, step.resultId) : undefined;
	return {
		index,
		beforeText: printTerm(step.before),
		afterText: printTerm(step.after),
		selectedText: selected ? printTerm(selected) : undefined,
		resultText: result ? printTerm(result) : undefined,
		bindingText: step.binding ? `${step.binding.name} ↦ ${printTerm(step.binding.value)}` : undefined,
	};
}

export function formatEvaluationResultText(result: EvaluationResult): string {
	const lines: string[] = [];
	lines.push(`Strategy: ${result.strategy}`);
	result.steps.forEach((step, i) => {
		const v = describeStep(step, i);
		lines.push(`  [${i}] ${v.beforeText}  -->  ${v.afterText}`);
		if (v.selectedText) {
			lines.push(`        reducing: ${v.selectedText}${v.resultText ? ` → ${v.resultText}` : ""}`);
		}
		if (v.bindingText) {
			lines.push(`        binding: ${v.bindingText}`);
		}
	});
	lines.push(`Result: ${printTerm(result.result)}`);
	if (result.reachedStepLimit) {
		lines.push("(stopped: step limit reached)");
	}
	for (const e of result.errors ?? []) {
		lines.push(`Evaluation error: ${e.message}`);
	}
	return lines.join("\n");
}
