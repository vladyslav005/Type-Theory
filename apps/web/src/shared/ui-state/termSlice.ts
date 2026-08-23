// src/store/counterSlice.ts
import {createSlice} from "@reduxjs/toolkit";
import type {Program, SourcePosition, Type} from "@vladyslav005/tt-core";
import type {ProofTree, Rule} from "@vladyslav005/tt-core";
import {EvaluationStrategy, type EvaluationResult} from "@vladyslav005/tt-core";
import {DEFAULT_TYPE_THEORY_CONFIG, type TypeTheoryConfig, type TypeTheoryId} from "@vladyslav005/tt-core";
import {
  buildStudentNode,
  type ContextBinding,
  diffAgainstAnswer,
  findStudentNode,
  type StudentProofNode,
} from "@/shared/ui-state/studentProof.ts";

interface BuildModeState {
  active: boolean;
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
  // Theory config the current `proof` was actually derived under — lets consumers (e.g. the
  // Curry-Howard view) tell a stale proof apart from the live `enabledTheories` toggle state.
  proofTheories: TypeTheoryConfig | undefined;
  typeAliases: Record<string, Type>;
  evaluation: EvaluationResult | undefined;
  enabledTheories: TypeTheoryConfig;
  evaluationStrategy: EvaluationStrategy;
  buildMode: BuildModeState;
  // When on, editor changes auto-trigger parse/type-check/evaluate — see TextEditor's
  // "Auto-build" switch, which also disables the manual Parse & Evaluate buttons.
  autoBuild: boolean;
  // Monaco editor font size in px — see TextEditor's font size selector.
  fontSize: number;
}

export const initialTermState: TermState = {
  termText: undefined,
  processingErrors: undefined,
  errorMarkers: [],
  ast: undefined,
  proof: undefined,
  proofTheories: undefined,
  typeAliases: {},
  evaluation: undefined,
  enabledTheories: DEFAULT_TYPE_THEORY_CONFIG,
  evaluationStrategy: EvaluationStrategy.CALL_BY_VALUE,
  buildMode: {active: false},
  autoBuild: false,
  fontSize: 14,
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

    setProof: (state, action: { payload: { proof: ProofTree | undefined; theories?: TypeTheoryConfig } }) => {
      state.proof = action.payload.proof;
      state.proofTheories = action.payload.proof ? action.payload.theories : undefined;
    },

    setTypeAliases: (state, action: { payload: Record<string, Type> }) => {
      state.typeAliases = action.payload;
    },

    setAst: (state, action: { payload: Program | undefined }) => {
      state.ast = action.payload;
    },

    setEvaluation: (state, action: { payload: EvaluationResult | undefined }) => {
      state.evaluation = action.payload;
    },

    setTheoryEnabled: (state, action: { payload: { id: TypeTheoryId; enabled: boolean } }) => {
      state.enabledTheories[action.payload.id] = action.payload.enabled;
    },

    enterBuildMode: (state) => {
      if (!state.proof) return;
      state.buildMode = {
        active: true,
        answerKey: state.proof,
        studentTree: buildStudentNode(state.proof, true),
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

    clean: (state) => {
      state.processingErrors = [];
      state.errorMarkers = [];
      state.ast = undefined;
      state.proof = undefined;
      state.proofTheories = undefined;
      state.typeAliases = {};
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
  setAst,
  setTheoryEnabled,
  enterBuildMode,
  exitBuildMode,
  chooseRule,
  revealPremise,
  setNodeType,
  setNodeContext,
  resetNode,
  checkProof,
  pushProcessingError,
  setErrorMarkers,
  clean
} = counterSlice.actions;
export default counterSlice.reducer;