// src/store/counterSlice.ts
import {createSlice} from "@reduxjs/toolkit";
import type {Program, SourcePosition, Type} from "@vladyslav005/tt-core";
import type {InferenceStep, ProofTree, Rule} from "@vladyslav005/tt-core";
import {EvaluationStrategy, type EvaluationResult} from "@vladyslav005/tt-core";
import {DEFAULT_TYPE_THEORY_CONFIG, type TypeTheoryConfig, type TypeTheoryId} from "@vladyslav005/tt-core";
import {
  buildStudentNode,
  type ConstraintPair,
  type ContextBinding,
  diffAgainstAnswer,
  findStudentNode,
  type StudentProofNode,
} from "@/shared/ui-state/studentProof.ts";
import {
  createManualNode,
  findManualNode,
  type ManualField,
  type ManualNode,
  type ManualNodeResult,
  removeManualNode,
} from "@/shared/ui-state/manualProof.ts";
import {termKey} from "@/shared/lib/manualParse.ts";

export type BuildModeKind = "semi" | "manual";

interface BuildModeState {
  active: boolean;
  mode?: BuildModeKind;
  // Fully manual mode: the tree the student grows themselves, and the verdicts of the last check.
  manualTree?: ManualNode;
  manualResults?: Record<string, ManualNodeResult>;
  // One "Γ_n = …" / "C_n = …" definition per line.
  manualDefinitions?: string;
  // Frozen snapshot of `proof` so the answer can't drift mid-exercise.
  answerKey?: ProofTree;
  studentTree?: StudentProofNode;
}

export interface ErrorMarker extends SourcePosition {
  message: string;
}

export interface TermState {
  termText: string | undefined;
  processingErrors?: Error[];
  errorMarkers: ErrorMarker[];
  ast: Program | undefined;
  proof: ProofTree | undefined;
  typeAliases: Record<string, Type>;
  inferenceSteps: InferenceStep[];
  // Index-aligned with inferenceSteps — the whole-program proof tree as it looked once that
  // step's substitution was applied, so the tree view can show metavariables resolving live.
  inferenceProofSnapshots: ProofTree[];
  evaluation: EvaluationResult | undefined;
  enabledTheories: TypeTheoryConfig;
  evaluationStrategy: EvaluationStrategy;
  buildMode: BuildModeState;
  // When on, editor changes auto-trigger parse/type-check/evaluate — see TextEditor's
  // "Auto-build" switch, which also disables the manual Parse & Evaluate buttons.
  autoBuild: boolean;
  // Monaco editor font size in px — see TextEditor's font size selector.
  fontSize: number;
  // Last topic chip picked in the Examples dropdown ("all" = browse every group) — persisted
  // so e.g. picking "Untyped Lambda Calculus" once keeps it one click away next time.
  examplesTopic: string;
}

export const initialTermState: TermState = {
  termText: undefined,
  processingErrors: undefined,
  errorMarkers: [],
  ast: undefined,
  proof: undefined,
  typeAliases: {},
  inferenceSteps: [],
  inferenceProofSnapshots: [],
  evaluation: undefined,
  enabledTheories: DEFAULT_TYPE_THEORY_CONFIG,
  evaluationStrategy: EvaluationStrategy.CALL_BY_VALUE,
  buildMode: {active: false},
  autoBuild: false,
  fontSize: 14,
  examplesTopic: "all",
};

const counterSlice = createSlice({
  name: "counter",
  initialState: initialTermState,
  reducers: {
    setTermText: (state, action: { payload: string | undefined }) => {
      state.termText = action.payload;
    },

    setEvaluationStrategy: (state, action: { payload: EvaluationStrategy }) => {
      state.evaluationStrategy = action.payload;
    },

    setAutoBuild: (state, action: { payload: boolean }) => {
      state.autoBuild = action.payload;
    },

    setFontSize: (state, action: { payload: number }) => {
      state.fontSize = action.payload;
    },

    setProof: (state, action: { payload: { proof: ProofTree | undefined } }) => {
      state.proof = action.payload.proof;
    },

    setTypeAliases: (state, action: { payload: Record<string, Type> }) => {
      state.typeAliases = action.payload;
    },

    setInferenceSteps: (state, action: { payload: InferenceStep[] }) => {
      state.inferenceSteps = action.payload;
    },

    setInferenceProofSnapshots: (state, action: { payload: ProofTree[] }) => {
      state.inferenceProofSnapshots = action.payload;
    },

    setAst: (state, action: { payload: Program | undefined }) => {
      state.ast = action.payload;
    },

    setEvaluation: (state, action: { payload: EvaluationResult | undefined }) => {
      state.evaluation = action.payload;
    },

    // "Untyped lambda calculus" is XOR'd with every other theory — it needs to genuinely
    // bypass STLC's type-checking rather than compose with it, so enabling it clears the
    // other 6, and enabling any of the other 6 clears it.
    setTheoryEnabled: (state, action: { payload: { id: TypeTheoryId; enabled: boolean } }) => {
      const {id, enabled} = action.payload;
      if (!enabled) {
        state.enabledTheories[id] = false;
        return;
      }
      if (id === "untyped") {
        (Object.keys(state.enabledTheories) as TypeTheoryId[]).forEach((key) => {
          state.enabledTheories[key] = false;
        });
      } else {
        state.enabledTheories.untyped = false;
      }
      state.enabledTheories[id] = true;
    },

    enterBuildMode: (state, action: { payload: BuildModeKind | undefined }) => {
      if (!state.proof) return;
      const mode: BuildModeKind = action.payload ?? "semi";
      // With inference on, students derive first and solve afterwards — the key is the tree before
      // its constraints were solved, like the automatic tree's default view.
      const usesInference = state.enabledTheories.letPolymorphism || state.enabledTheories.typeInference;
      const unresolved = usesInference && state.inferenceSteps.length > 0
        ? state.inferenceProofSnapshots[0]
        : undefined;
      const answerKey = unresolved ?? state.proof;
      if (mode === "manual") {
        state.buildMode = {
          active: true,
          mode,
          answerKey,
          manualTree: createManualNode("judgement", termKey(answerKey.term)),
          manualResults: {},
        };
        return;
      }
      state.buildMode = {
        active: true,
        mode,
        answerKey,
        studentTree: buildStudentNode(answerKey, true),
      };
    },

    exitBuildMode: (state) => {
      state.buildMode = {active: false};
    },

    // Correctness only surfaces later via Check Proof.
    chooseRule: (state, action: { payload: { nodeId: string; rule: Rule } }) => {
      const node = state.buildMode.studentTree && findStudentNode(state.buildMode.studentTree, action.payload.nodeId);
      if (!node) return;

      node.chosenRule = action.payload.rule;
      node.ruleCheck = undefined;
      node.typeCheck = undefined;
      node.constraintCheck = undefined;
    },

    revealPremise: (state, action: { payload: { premiseId: string } }) => {
      const node = state.buildMode.studentTree && findStudentNode(state.buildMode.studentTree, action.payload.premiseId);
      if (!node) return;

      node.revealed = true;
    },

    setNodeType: (state, action: { payload: { nodeId: string; type: Type } }) => {
      const node = state.buildMode.studentTree && findStudentNode(state.buildMode.studentTree, action.payload.nodeId);
      if (!node) return;

      node.writtenType = action.payload.type;
      node.typeCheck = undefined;
    },

    setNodeContext: (state, action: { payload: { nodeId: string; bindings: ContextBinding[] } }) => {
      const node = state.buildMode.studentTree && findStudentNode(state.buildMode.studentTree, action.payload.nodeId);
      if (!node) return;

      node.writtenBindings = action.payload.bindings;
      node.contextCheck = undefined;
    },

    setNodeConstraints: (state, action: { payload: { nodeId: string; constraints: ConstraintPair[] } }) => {
      const node = state.buildMode.studentTree && findStudentNode(state.buildMode.studentTree, action.payload.nodeId);
      if (!node) return;

      node.writtenConstraints = action.payload.constraints;
      node.constraintCheck = undefined;
    },

    setNodeScheme: (state, action: { payload: { nodeId: string; scheme: Type } }) => {
      const node = state.buildMode.studentTree && findStudentNode(state.buildMode.studentTree, action.payload.nodeId);
      if (!node) return;

      node.writtenScheme = action.payload.scheme;
      node.generalizeCheck = undefined;
    },

    setManualField: (state, action: { payload: { nodeId: string; field: ManualField; value: string } }) => {
      const node = state.buildMode.manualTree && findManualNode(state.buildMode.manualTree, action.payload.nodeId);
      if (!node) return;

      node[action.payload.field] = action.payload.value;
      if (state.buildMode.manualResults) delete state.buildMode.manualResults[node.id];
    },

    setManualConstraintsShown: (state, action: { payload: { nodeId: string; shown: boolean } }) => {
      const node = state.buildMode.manualTree && findManualNode(state.buildMode.manualTree, action.payload.nodeId);
      if (!node) return;

      node.constraintsShown = action.payload.shown;
      if (!action.payload.shown) node.constraints = "";
      if (state.buildMode.manualResults) delete state.buildMode.manualResults[node.id];
    },

    addManualPremise: (state, action: { payload: { parentId: string; kind: ManualNode["kind"] } }) => {
      const parent = state.buildMode.manualTree && findManualNode(state.buildMode.manualTree, action.payload.parentId);
      if (!parent) return;

      parent.premises.push(createManualNode(action.payload.kind));
      if (state.buildMode.manualResults) delete state.buildMode.manualResults[parent.id];
    },

    removeManualPremise: (state, action: { payload: { nodeId: string } }) => {
      if (!state.buildMode.manualTree) return;

      removeManualNode(state.buildMode.manualTree, action.payload.nodeId);
      state.buildMode.manualResults = {};
    },

    setManualDefinitions: (state, action: { payload: string }) => {
      state.buildMode.manualDefinitions = action.payload;
    },

    setManualResults: (state, action: { payload: Record<string, ManualNodeResult> }) => {
      state.buildMode.manualResults = action.payload;
    },

    // Clears this node's own progress and re-hides its direct premises.
    resetNode: (state, action: { payload: { nodeId: string } }) => {
      const node = state.buildMode.studentTree && findStudentNode(state.buildMode.studentTree, action.payload.nodeId);
      if (!node) return;

      node.chosenRule = undefined;
      node.ruleCheck = undefined;
      node.writtenType = undefined;
      node.typeCheck = undefined;
      node.writtenBindings = undefined;
      node.contextCheck = undefined;
      node.writtenConstraints = undefined;
      node.constraintCheck = undefined;
      node.writtenScheme = undefined;
      node.generalizeCheck = undefined;
      node.premises.forEach((premise) => { premise.revealed = false; });
    },

    checkProof: (state) => {
      if (!state.buildMode.studentTree || !state.buildMode.answerKey) return;
      diffAgainstAnswer(state.buildMode.studentTree, state.buildMode.answerKey);
    },

    pushProcessingError: (state, action: { payload: Error }) => {
      if (!state.processingErrors) {
        state.processingErrors = [];
      }

      state.processingErrors?.push(action.payload);
    },

    setErrorMarkers: (state, action: { payload: ErrorMarker[] }) => {
      state.errorMarkers = action.payload;
    },

    clearProcessingErrors: (state) => {
      state.processingErrors = [];
    },

    setExamplesTopic: (state, action: { payload: string }) => {
      state.examplesTopic = action.payload;
    },

    clean: (state) => {
      state.processingErrors = [];
      state.errorMarkers = [];
      state.ast = undefined;
      state.proof = undefined;
      state.typeAliases = {};
      state.inferenceSteps = [];
      state.inferenceProofSnapshots = [];
      state.evaluation = undefined;
      state.buildMode = {active: false};
    }
  },
});

export const {
  setEvaluation,
  setTermText,
  setEvaluationStrategy,
  setAutoBuild,
  setFontSize,
  setProof,
  setTypeAliases,
  setInferenceSteps,
  setInferenceProofSnapshots,
  setAst,
  setTheoryEnabled,
  enterBuildMode,
  exitBuildMode,
  chooseRule,
  revealPremise,
  setNodeType,
  setNodeContext,
  setNodeConstraints,
  setNodeScheme,
  setManualField,
  setManualConstraintsShown,
  addManualPremise,
  removeManualPremise,
  setManualResults,
  setManualDefinitions,
  resetNode,
  checkProof,
  pushProcessingError,
  setErrorMarkers,
  clearProcessingErrors,
  setExamplesTopic,
  clean
} = counterSlice.actions;
export default counterSlice.reducer;