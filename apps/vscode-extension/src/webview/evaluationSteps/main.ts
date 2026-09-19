import type { EvalStepsPayload, EvalStepsToHostMessage, HostToEvalStepsMessage } from "../../webviewProtocol";

declare function acquireVsCodeApi(): { postMessage(msg: EvalStepsToHostMessage): void };
const vscodeApi = acquireVsCodeApi();

const root = document.getElementById("root")!;

window.addEventListener("message", (event: MessageEvent<HostToEvalStepsMessage>) => {
	const msg = event.data;
	if (msg.type === "render") {
		render(msg.payload);
	} else if (msg.type === "invalid") {
		renderInvalid(msg.messages);
	} else {
		root.replaceChildren();
	}
});

function renderInvalid(messages: string[]): void {
	root.replaceChildren();
	root.appendChild(line("tt-note", "Fix the error below to see evaluation steps:"));
	for (const message of messages) {
		root.appendChild(line("tt-error", message));
	}
}

function span(text: string, className?: string): HTMLElement {
	const el = document.createElement("span");
	el.textContent = text;
	if (className) {
		el.className = className;
	}
	return el;
}

function line(className: string, ...children: (Node | string)[]): HTMLElement {
	const el = document.createElement("div");
	el.className = className;
	for (const child of children) {
		el.append(child);
	}
	return el;
}

function render(payload: EvalStepsPayload): void {
	root.replaceChildren();

	root.appendChild(line("tt-header", `Strategy: ${payload.strategy}`));

	for (const step of payload.steps) {
		const row = document.createElement("div");
		row.className = "tt-step";
		row.appendChild(
			line("tt-step-line", span(step.beforeText), span(" → ", "tt-arrow"), span(step.afterText)),
		);
		if (step.selectedText) {
			const text = step.resultText ? `reducing: ${step.selectedText} → ${step.resultText}` : `reducing: ${step.selectedText}`;
			row.appendChild(line("tt-step-reducing", text));
		}
		if (step.bindingText) {
			row.appendChild(line("tt-step-binding", step.bindingText));
		}
		root.appendChild(row);
	}

	root.appendChild(line("tt-result", `Result: ${payload.finalResultText}`));

	if (payload.reachedStepLimit) {
		root.appendChild(line("tt-note", "Stopped: step limit reached."));
	}
	for (const err of payload.errors ?? []) {
		root.appendChild(line("tt-error", `Evaluation error: ${err.message}`));
	}
}

vscodeApi.postMessage({ type: "ready" });
