import type {RootState} from "@/app/providers/store.ts";
import {isError} from "@/shared/ui-state/termSlice.ts";
import {hasChecks, summarizeStudentTree} from "@/shared/ui-state/studentProof.ts";
import type {WorkspacePanelId} from "@/shared/ui-state/outputPanel.ts";
import {STUDY_MODE} from "@/shared/activity/studyConfig.ts";
import {EvaluationStrategy} from "@vladyslav005/tt-core";
import type {TourSignal} from "@/features/tour/tourSignals.ts";

export interface TaskContext {
  state: RootState;
  // The state when the step opened, so "pressed Run" means a new result rather than an old one.
  initial: RootState;
  signals: TourSignal[];
}

export interface TourStep {
  id: string;
  // A `data-tour` token; without one the step is a centered card.
  target?: string;
  panel?: WorkspacePanelId;
  // Pulses a control the step asks the user to use.
  pointAt?: string;
  // Other areas the step talks about, kept visible next to the target.
  alsoShow?: string[];
  skipIfMissing?: boolean;
  // Interactive step: Next unlocks once this holds.
  task?: (ctx: TaskContext) => boolean;
  // "Do it for me" puts this into the editor: replacing everything, or appended when `append`.
  code?: string;
  append?: boolean;
  // Marked in the editor when the step opens, so the code the step talks about is easy to find.
  highlight?: string;
  // Shared text under `tour.shared` instead of the tour's own step text.
  shared?: string;
  learn?: LearnLink[];
}

// Pages on Learn with the theory behind a tutorial; unpublished lectures/labs are left out until they open.
export type LearnLink = {lecture: string} | {lab: string} | {page: "rules" | "grammar"};

export type TourId =
  | "overview" | "firstProgram" | "proofPractice" | "proofViews" | "evalPractice"
  | "evalStrategies" | "astEditor" | "untyped" | "typeInference";

export interface Tour {
  id: TourId;
  steps: TourStep[];
  // Loaded into the editor (STLC) while the tour runs; the user's own code and settings come back afterwards.
  code?: string;
  strategy?: EvaluationStrategy;
  next?: TourId;
  learn?: LearnLink[];
}

const EXCLUSIVE_BASES = ["untyped", "nbl", "typedNbl"] as const;
const squash = (text: string | undefined) => (text ?? "").replace(/\\/g, "λ").replace(/->/g, "→").replace(/\s+/g, "");
const contains = (state: RootState, code: string) => squash(state.term.termText).includes(squash(code));
const hasErrors = (state: RootState) => (state.term.processingErrors ?? []).some(isError);
const builtSinceStart = ({state, initial}: TaskContext) =>
  !state.term.building
  && state.term.builtText === state.term.termText
  && (state.term.proof !== initial.term.proof || state.term.processingErrors !== initial.term.processingErrors);
const builtOk = (ctx: TaskContext) => builtSinceStart(ctx) && !hasErrors(ctx.state);
const evaluatedSinceStart = ({state, initial}: TaskContext) =>
  !state.term.evaluating && !!state.term.evaluation && state.term.evaluation !== initial.term.evaluation;
const isOn = (token: string, state = "active") => !!document.querySelector(`[data-tour~="${token}"][data-state="${state}"]`);
const tabOpen = (token: string) => () => isOn(token);
const switchOn = (token: string) => () => isOn(token, "checked");
const signalled = (signal: TourSignal) => ({signals}: TaskContext) => signals.includes(signal);
const proofSummary = (state: RootState) => {
  const tree = state.term.buildMode.studentTree;
  return tree ? summarizeStudentTree(tree) : undefined;
};

const GOOD = "(λ x : Bool . x) true;";
const BAD = "(λ x : Nat . x) true;";
const STRATEGY_PROGRAM = `double = λ n : Nat . n + n : Nat → Nat;
zero = λ x : Nat . 0 : Nat → Nat;
zero (double 5);`;

const intro = (highlight?: string): TourStep => ({id: "intro", target: "panel-editor", panel: "editor", highlight});
const isStlc = (state: RootState) => !EXCLUSIVE_BASES.some((id) => state.term.enabledTheories[id]);
// The user picks the language themselves, with the theory behind it one click away.
const chooseStlc: TourStep = {
  id: "language",
  shared: "languageStlc",
  target: "theories",
  task: ({state}) => isStlc(state),
  learn: [{lecture: "stlc-basics"}, {page: "grammar"}],
};
const finish: TourStep = {id: "finish"};

export const TOURS: Record<TourId, Tour> = {
  overview: {
    id: "overview",
    learn: [{lecture: "lambda-intro"}, {lecture: "stlc-basics"}, {page: "rules"}, {page: "grammar"}],
    next: "firstProgram",
    steps: [
      {id: "welcome"},
      {id: "editor", target: "panel-editor", panel: "editor"},
      {id: "run", target: "run", panel: "editor"},
      {id: "examples", target: "examples"},
      {id: "theories", target: "theories"},
      {id: "output", target: "panel-errorOutput", panel: "errorOutput"},
      {id: "proofTree", target: "panel-proofTree", panel: "proofTree"},
      {id: "evaluation", target: "panel-evaluation", panel: "evaluation"},
      {id: "ast", target: "panel-ast", panel: "ast"},
      {id: "layout", target: "layout", skipIfMissing: true},
      {id: "docs", target: "nav-docs"},
      ...(STUDY_MODE ? [{id: "activity", target: "activity"}] : []),
      {id: "preferences", target: "preferences"},
      {id: "finish", target: "tour"},
    ],
  },
  firstProgram: {
    id: "firstProgram",
    learn: [{lecture: "stlc-basics"}, {page: "grammar"}],
    next: "proofPractice",
    code: "// Your first program\n",
    steps: [
      intro(),
      chooseStlc,
      {id: "write", target: "panel-editor", panel: "editor", code: `// Your first program\n${GOOD}`, task: ({state}) => contains(state, GOOD)},
      {id: "typeCheck", target: "run", panel: "editor", alsoShow: ["panel-editor"], task: builtOk},
      {id: "proofTree", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-tab-automatic", task: tabOpen("proof-tab-automatic")},
      {
        id: "mistake",
        target: "panel-editor",
        panel: "editor",
        alsoShow: ["run"],
        highlight: "Bool",
        code: `// Your first program\n${BAD}`,
        task: (ctx) => contains(ctx.state, BAD) && builtSinceStart(ctx) && hasErrors(ctx.state),
      },
      {id: "output", target: "panel-errorOutput", panel: "errorOutput", alsoShow: ["panel-editor"]},
      {
        id: "fix",
        target: "panel-editor",
        panel: "editor",
        alsoShow: ["run"],
        highlight: "Nat",
        code: `// Your first program\n${GOOD}`,
        task: (ctx) => contains(ctx.state, GOOD) && evaluatedSinceStart(ctx) && !hasErrors(ctx.state),
      },
      {id: "evaluation", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-tab-automatic", task: tabOpen("eval-tab-automatic")},
      finish,
    ],
  },
  proofPractice: {
    id: "proofPractice",
    learn: [{lecture: "stlc-basics"}, {page: "rules"}, {lab: "typed-nbl-stlc"}],
    next: "proofViews",
    code: GOOD,
    steps: [
      intro(GOOD),
      chooseStlc,
      {id: "typeCheck", target: "run", panel: "editor", alsoShow: ["panel-editor"], task: builtOk},
      {id: "openPractice", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-tab-practice", task: tabOpen("proof-tab-practice")},
      {id: "start", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-mode-semi", task: ({state}) => state.term.buildMode.active && state.term.buildMode.mode === "semi"},
      {id: "fill", target: "panel-proofTree", panel: "proofTree", task: ({state}) => {
        const summary = proofSummary(state);
        return !!summary && summary.filled === summary.total;
      }},
      {id: "check", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-check", task: ({state}) => {
        const tree = state.term.buildMode.studentTree;
        return !!tree && hasChecks(tree);
      }},
      {id: "result", target: "panel-proofTree", panel: "proofTree", task: ({state}) => {
        const summary = proofSummary(state);
        return !!summary && summary.valid === summary.total;
      }},
      {id: "exit", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-exit", task: ({state}) => !state.term.buildMode.active},
      finish,
    ],
  },
  proofViews: {
    id: "proofViews",
    learn: [{lecture: "stlc-basics"}, {lecture: "curry-howard"}, {page: "rules"}],
    next: "evalPractice",
    code: GOOD,
    steps: [
      intro(GOOD),
      chooseStlc,
      {id: "typeCheck", target: "run", panel: "editor", alsoShow: ["panel-editor"], task: builtOk},
      {id: "automatic", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-tab-automatic", task: tabOpen("proof-tab-automatic")},
      {id: "hover", target: "panel-proofTree", panel: "proofTree", alsoShow: ["panel-editor"]},
      {id: "panZoom", target: "panel-proofTree", panel: "proofTree"},
      {id: "stepByStep", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-step-by-step", task: switchOn("proof-step-by-step")},
      {id: "stepThrough", target: "panel-proofTree", panel: "proofTree"},
      {id: "latex", target: "panel-proofTree", panel: "proofTree", pointAt: "latex-export", task: signalled("latexExport")},
      {id: "openPractice", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-tab-practice", task: tabOpen("proof-tab-practice")},
      {id: "manual", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-mode-manual", task: ({state}) => state.term.buildMode.active && state.term.buildMode.mode === "manual"},
      {id: "manualHow", target: "panel-proofTree", panel: "proofTree"},
      {id: "exitManual", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-exit", task: ({state}) => !state.term.buildMode.active},
      {id: "curryHoward", target: "theories", task: ({state}) => state.term.curryHoward},
      {id: "logic", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-tab-logic", task: tabOpen("proof-tab-logic")},
      finish,
    ],
  },
  evalPractice: {
    id: "evalPractice",
    learn: [{lecture: "lambda-intro"}, {page: "rules"}, {lab: "lambda-church"}],
    next: "evalStrategies",
    code: "(λ f : Bool → Bool . f true) (λ y : Bool . y);",
    steps: [
      intro("(λ f : Bool → Bool . f true) (λ y : Bool . y);"),
      chooseStlc,
      {id: "run", target: "run", panel: "editor", alsoShow: ["panel-editor"], task: evaluatedSinceStart},
      {id: "openPractice", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-tab-practice", task: tabOpen("eval-tab-practice")},
      {id: "insert", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-input", task: signalled("evalInsert")},
      {id: "check", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-check", task: signalled("evalCheck")},
      {id: "add", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-input", task: signalled("evalStep")},
      {id: "stepBack", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-step-back"},
      {id: "secondStep", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-input", task: signalled("evalStep")},
      {id: "skipping", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-skipping"},
      {id: "finishEval", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-finish", task: signalled("evalFinished")},
      {id: "result", target: "panel-evaluation", panel: "evaluation"},
      finish,
    ],
  },
  evalStrategies: {
    id: "evalStrategies",
    learn: [{lecture: "lambda-intro"}, {lecture: "church-encodings"}, {page: "rules"}],
    next: "astEditor",
    code: STRATEGY_PROGRAM,
    strategy: EvaluationStrategy.CALL_BY_VALUE,
    steps: [
      intro("zero (double 5);"),
      chooseStlc,
      {id: "run", target: "run", panel: "editor", alsoShow: ["panel-editor"], task: evaluatedSinceStart},
      {id: "automatic", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-tab-automatic", task: tabOpen("eval-tab-automatic")},
      {id: "stepThrough", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-stepper", task: signalled("evalViewerStep")},
      {id: "unfold", target: "panel-evaluation", panel: "evaluation", task: signalled("evalUnfold")},
      {id: "gamma", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-gamma", task: switchOn("eval-gamma")},
      {id: "strategy", target: "run", panel: "editor", alsoShow: ["panel-evaluation"], task: ({state}) => state.term.evaluationStrategy === EvaluationStrategy.NORMAL},
      {
        id: "rerun",
        target: "run",
        panel: "editor",
        alsoShow: ["panel-evaluation"],
        task: (ctx) => evaluatedSinceStart(ctx) && ctx.state.term.evaluation?.strategy === EvaluationStrategy.NORMAL,
      },
      {id: "compare", target: "panel-evaluation", panel: "evaluation"},
      {id: "settings", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-shortcuts", alsoShow: ["eval-limits"]},
      finish,
    ],
  },
  astEditor: {
    id: "astEditor",
    learn: [{page: "grammar"}, {lecture: "lambda-intro"}],
    next: "untyped",
    code: GOOD,
    steps: [
      intro(GOOD),
      chooseStlc,
      {id: "typeCheck", target: "run", panel: "editor", alsoShow: ["panel-editor"], task: builtOk},
      {id: "viewer", target: "panel-ast", panel: "ast", alsoShow: ["panel-editor"], pointAt: "ast-tab-viewer"},
      {id: "openEditor", target: "panel-ast", panel: "ast", pointAt: "ast-tab-editor", task: tabOpen("ast-tab-editor")},
      {id: "fromViewer", target: "panel-ast", panel: "ast", pointAt: "ast-from-viewer", task: signalled("astFromViewer")},
      {
        id: "edit",
        target: "panel-ast",
        panel: "ast",
        task: () => [...document.querySelectorAll<HTMLInputElement>('[data-tour~="panel-ast"] input')].some((input) => input.value.trim() === "false"),
      },
      {
        id: "paste",
        target: "panel-ast",
        panel: "ast",
        pointAt: "ast-paste",
        alsoShow: ["panel-editor"],
        task: (ctx) => signalled("astPasted")(ctx) && contains(ctx.state, "(λ x : Bool . x) false;"),
      },
      {id: "build", target: "panel-ast", panel: "ast", pointAt: "ast-palette"},
      finish,
    ],
  },
  untyped: {
    id: "untyped",
    learn: [{lecture: "lambda-intro"}, {lecture: "church-encodings"}, {lab: "lambda-church"}, {lab: "recursion-untyped"}],
    next: "typeInference",
    code: "// Untyped λ-calculus\n",
    strategy: EvaluationStrategy.NORMAL,
    steps: [
      intro(),
      {id: "switch", target: "theories", task: ({state}) => state.term.enabledTheories.untyped, learn: [{lecture: "lambda-intro"}, {page: "grammar"}]},
      {id: "prelude", target: "prelude", alsoShow: ["panel-editor"], task: ({state}) => contains(state, "fix =")},
      {id: "write", target: "panel-editor", panel: "editor", code: "plus one two;", append: true, task: ({state}) => contains(state, "plus one two;")},
      {id: "run", target: "run", panel: "editor", alsoShow: ["panel-editor"], task: evaluatedSinceStart},
      {id: "result", target: "panel-evaluation", panel: "evaluation", pointAt: "eval-tab-automatic", task: tabOpen("eval-tab-automatic")},
      {id: "syntax", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-tab-automatic", task: tabOpen("proof-tab-automatic")},
      {id: "syntaxPractice", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-tab-practice"},
      finish,
    ],
  },
  typeInference: {
    id: "typeInference",
    learn: [{lecture: "type-inference"}, {lab: "type-inference"}, {page: "rules"}],
    code: "(λ f . f 5) (λ x : Nat . x + 1);",
    steps: [
      intro("λ f ."),
      chooseStlc,
      {id: "enable", target: "theories", task: ({state}) => state.term.enabledTheories.typeInference},
      {id: "typeCheck", target: "run", panel: "editor", alsoShow: ["panel-editor"], task: builtOk},
      {id: "automatic", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-tab-automatic", task: tabOpen("proof-tab-automatic")},
      {id: "inferenceSteps", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-inference-steps", task: switchOn("proof-inference-steps")},
      {id: "stepping", target: "panel-proofTree", panel: "proofTree"},
      {id: "constraints", target: "panel-proofTree", panel: "proofTree", pointAt: "proof-constraint-list", task: switchOn("proof-constraint-list")},
      finish,
    ],
  },
};

export const TOUR_GROUPS: {key: string; tours: TourId[]}[] = [
  {key: "start", tours: ["overview", "firstProgram"]},
  {key: "proofs", tours: ["proofPractice", "proofViews", "typeInference"]},
  {key: "evaluation", tours: ["evalPractice", "evalStrategies"]},
  {key: "more", tours: ["astEditor", "untyped"]},
];
