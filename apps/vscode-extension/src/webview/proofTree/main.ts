import { select } from "d3-selection";
import { zoom, ZoomTransform } from "d3-zoom";
import type {
	HostToProofTreeMessage,
	ProofTreePayload,
	ProofTreeToHostMessage,
	UnicodeTexTree,
} from "../../webviewProtocol";

declare function acquireVsCodeApi(): { postMessage(msg: ProofTreeToHostMessage): void };
const vscodeApi = acquireVsCodeApi();

const MIN_FIT_SCALE = 0.6;

const root = document.getElementById("root")!;
let currentRegistry: Record<string, { short: string; full: string }> = {};
let fitObserver: ResizeObserver | undefined;

window.addEventListener("message", (event: MessageEvent<HostToProofTreeMessage>) => {
	const msg = event.data;
	if (msg.type === "render") {
		render(msg.payload);
	} else if (msg.type === "invalid") {
		renderInvalid(msg.messages);
	} else if (msg.type === "empty") {
		renderEmpty(msg.message);
	} else {
		fitObserver?.disconnect();
		root.replaceChildren();
	}
});

function renderInvalid(messages: string[]): void {
	fitObserver?.disconnect();
	root.replaceChildren();
	const container = document.createElement("div");
	container.className = "tt-fallback";
	const note = document.createElement("div");
	note.className = "tt-note";
	note.textContent = "Fix the error below to see the proof tree:";
	container.appendChild(note);
	for (const message of messages) {
		const error = document.createElement("div");
		error.className = "tt-node-error-text";
		error.textContent = message;
		container.appendChild(error);
	}
	root.appendChild(container);
}

function renderEmpty(message: string): void {
	fitObserver?.disconnect();
	root.replaceChildren();
	const container = document.createElement("div");
	container.className = "tt-fallback";
	const note = document.createElement("div");
	note.className = "tt-note";
	note.textContent = message;
	container.appendChild(note);
	root.appendChild(container);
}

function render(payload: ProofTreePayload): void {
	currentRegistry = payload.registry;
	root.replaceChildren();
	fitObserver?.disconnect();

	const toolbar = document.createElement("div");
	toolbar.className = "tt-toolbar";
	const toggle = document.createElement("button");
	toggle.textContent = "Curry-Howard view";
	toggle.className = "tt-toggle" + (payload.mode === "logic" ? " tt-toggle-active" : "");
	toggle.disabled = !payload.logicAvailable;
	toggle.title = payload.logicAvailable
		? "Switch between the automatic derivation and the Curry-Howard (propositional logic) view"
		: "Only available for a proof that doesn't use any type theory extension";
	toggle.addEventListener("click", () => {
		const nextMode = payload.mode === "logic" ? "derivation" : "logic";
		vscodeApi.postMessage({ type: "setMode", mode: nextMode });
	});
	toolbar.appendChild(toggle);
	root.appendChild(toolbar);

	const stage = document.createElement("div");
	stage.className = "tt-stage";
	const viewport = document.createElement("div");
	viewport.className = "tt-viewport";
	viewport.appendChild(renderNode(payload.tree));
	stage.appendChild(viewport);
	root.appendChild(stage);

	const zoomBehavior = zoom<HTMLDivElement, unknown>()
		.scaleExtent([0.2, 3])
		.on("zoom", (event) => {
			// ZoomTransform.toString() emits unitless "translate(x,y) scale(k)" — valid for an
			// SVG transform *attribute*, but invalid CSS (translate() needs length units), so
			// assigning it directly to .style.transform is silently dropped by the browser.
			const t = event.transform;
			viewport.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
		});
	select(stage).call(zoomBehavior);

	// If this panel is a background tab when first rendered (e.g. one of several panels
	// auto-opened together), `stage`'s size is 0 here and stays 0 until the tab is actually
	// shown — fitting immediately would compute a bogus transform that's never corrected. A
	// ResizeObserver catches the moment the stage gets a real size (becoming visible, or the
	// window/panel being resized) and fits exactly once, the first time that happens.
	let fitted = false;
	const attemptFit = () => {
		if (fitted || stage.clientWidth === 0 || stage.clientHeight === 0) {
			return;
		}
		fitToView(stage, viewport, zoomBehavior);
		fitted = true;
		fitObserver?.disconnect();
	};
	fitObserver = new ResizeObserver(attemptFit);
	fitObserver.observe(stage);
	attemptFit();
}

function fitToView(
	stage: HTMLDivElement,
	viewport: HTMLDivElement,
	zoomBehavior: ReturnType<typeof zoom<HTMLDivElement, unknown>>,
): void {
	const naturalWidth = viewport.scrollWidth;
	const naturalHeight = viewport.scrollHeight;
	if (naturalWidth === 0 || naturalHeight === 0) {
		return;
	}
	const stageWidth = stage.clientWidth;
	const stageHeight = stage.clientHeight;

	// Never auto-shrink below this, even if the whole tree doesn't fit — below it, individual
	// space characters become sub-pixel and words visually run together (e.g. "compose identity"
	// reads as "composeidentity"). A tree too big to fit at this scale just extends beyond the
	// viewport; that's what panning is for, not further shrinking into illegibility.
	const scale = Math.max(Math.min(stageWidth / naturalWidth, stageHeight / naturalHeight, 1), MIN_FIT_SCALE);
	const tx = (stageWidth - naturalWidth * scale) / 2;
	const ty = (stageHeight - naturalHeight * scale) / 2;

	const transform = new ZoomTransform(scale, tx, ty);
	select(stage).call(zoomBehavior.transform, transform);
}

function renderNode(node: UnicodeTexTree): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.className = "tt-node" + (node.error ? " tt-node-error" : "");

	if (node.children?.length) {
		const premises = document.createElement("div");
		premises.className = "tt-premises";
		for (const child of node.children) {
			premises.appendChild(renderNode(child));
		}
		wrapper.appendChild(premises);
		const bar = document.createElement("hr");
		bar.className = "tt-bar";
		wrapper.appendChild(bar);
	}

	const conclusion = document.createElement("div");
	conclusion.className = "tt-conclusion";

	const judgement = document.createElement("span");
	judgement.className = "tt-judgement";
	if (node.judgementSegments?.length) {
		for (const seg of node.judgementSegments) {
			if (seg.kind === "tex") {
				judgement.appendChild(document.createTextNode(seg.value));
			} else {
				judgement.appendChild(renderRef(seg.key));
			}
		}
	} else {
		judgement.textContent = node.judgement;
	}
	if (node.pos) {
		judgement.classList.add("tt-hoverable");
		judgement.title = "Hover to highlight in the editor";
		const pos = node.pos;
		judgement.addEventListener("mouseenter", () => vscodeApi.postMessage({ type: "hoverPos", pos }));
		judgement.addEventListener("mouseleave", () => vscodeApi.postMessage({ type: "unhoverPos" }));
	}
	conclusion.appendChild(judgement);

	const rule = document.createElement("span");
	rule.className = "tt-rule";
	rule.textContent = node.rule;
	if (node.ruleTooltip) {
		rule.title = node.ruleTooltip;
	}
	conclusion.appendChild(rule);

	wrapper.appendChild(conclusion);

	if (node.error) {
		const error = document.createElement("div");
		error.className = "tt-node-error-text";
		error.textContent = node.error;
		wrapper.appendChild(error);
	}

	return wrapper;
}

function renderRef(key: string): HTMLElement {
	const entry = currentRegistry[key];
	const span = document.createElement("span");
	span.className = "tt-ref";
	span.textContent = entry?.short ?? key;
	let expanded = false;
	span.addEventListener("click", (event) => {
		event.stopPropagation();
		if (!entry) {
			return;
		}
		expanded = !expanded;
		span.textContent = expanded ? entry.full : entry.short;
	});
	return span;
}

vscodeApi.postMessage({ type: "ready" });
