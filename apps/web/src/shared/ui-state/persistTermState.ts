import {EvaluationStrategy} from "@vladyslav005/tt-core";
import {DEFAULT_TYPE_THEORY_CONFIG, isPlainStlc, type StlcFeatureConfig, type TypeTheoryConfig} from "@vladyslav005/tt-core";
import {APP_DEFAULT_STLC_FEATURES, DEFAULT_EVALUATION_LIMITS, DEFAULT_PROOF_TREE_RENDER_LIMIT, EVALUATION_LIMIT_BOUNDS, PROOF_TREE_RENDER_LIMIT_BOUNDS, type EvaluationLimitsSetting, type TermState} from "@/shared/ui-state/termSlice.ts";

const STORAGE_KEY = "tt.settings.v1";

// Only user-chosen settings persist — derived/transient state (ast, proof,
// evaluation result, error markers, build mode) is recomputed on demand.
export interface PersistedTermState {
  termText: string | undefined;
  enabledTheories: TypeTheoryConfig;
  curryHoward: boolean;
  stlcFeatures: StlcFeatureConfig;
  requireTermType: boolean;
  evaluationStrategy: EvaluationStrategy;
  evaluationLimits: EvaluationLimitsSetting;
  proofTreeRenderLimit: number;
  fontSize: number;
  showMinimap: boolean;
  autoBuild: boolean;
  examplesTopic: string;
}

function readLimits(value: unknown): EvaluationLimitsSetting {
  const stored = (typeof value === "object" && value !== null ? value : {}) as Partial<EvaluationLimitsSetting>;
  const pick = (key: keyof EvaluationLimitsSetting) => {
    const n = stored[key];
    const [min, max] = EVALUATION_LIMIT_BOUNDS[key];
    return typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : DEFAULT_EVALUATION_LIMITS[key];
  };
  return {maxSteps: pick("maxSteps"), maxTermSize: pick("maxTermSize")};
}

export function loadPersistedTermState(): PersistedTermState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as Partial<PersistedTermState>;

    const evaluationStrategy = Object.values(EvaluationStrategy).includes(
      parsed.evaluationStrategy as EvaluationStrategy,
    )
      ? (parsed.evaluationStrategy as EvaluationStrategy)
      : EvaluationStrategy.CALL_BY_VALUE;

    const enabledTheories = {...DEFAULT_TYPE_THEORY_CONFIG, ...parsed.enabledTheories};

    return {
      termText: typeof parsed.termText === "string" ? parsed.termText : undefined,
      // Merged over the defaults so a theory added in a later release still
      // shows up even for a browser with an older persisted blob.
      enabledTheories,
      curryHoward: parsed.curryHoward === true && isPlainStlc(enabledTheories),
      stlcFeatures: {...APP_DEFAULT_STLC_FEATURES, ...parsed.stlcFeatures},
      requireTermType: parsed.requireTermType === true,
      evaluationStrategy,
      evaluationLimits: readLimits(parsed.evaluationLimits),
      proofTreeRenderLimit: typeof parsed.proofTreeRenderLimit === "number" && Number.isFinite(parsed.proofTreeRenderLimit)
        ? Math.min(PROOF_TREE_RENDER_LIMIT_BOUNDS[1], Math.max(PROOF_TREE_RENDER_LIMIT_BOUNDS[0], Math.round(parsed.proofTreeRenderLimit)))
        : DEFAULT_PROOF_TREE_RENDER_LIMIT,
      fontSize: typeof parsed.fontSize === "number" && Number.isFinite(parsed.fontSize)
        ? parsed.fontSize
        : 14,
      showMinimap: parsed.showMinimap !== false,
      autoBuild: parsed.autoBuild === true,
      // "Basics" was renamed to "STLC".
      examplesTopic: parsed.examplesTopic === "Basics" ? "STLC" : typeof parsed.examplesTopic === "string" ? parsed.examplesTopic : "all",
    };
  } catch {
    return undefined;
  }
}

export function persistTermState(state: TermState): void {
  const toStore: PersistedTermState = {
    termText: state.termText,
    enabledTheories: state.enabledTheories,
    curryHoward: state.curryHoward,
    stlcFeatures: state.stlcFeatures,
    requireTermType: state.requireTermType,
    evaluationStrategy: state.evaluationStrategy,
    evaluationLimits: state.evaluationLimits,
    proofTreeRenderLimit: state.proofTreeRenderLimit,
    fontSize: state.fontSize,
    showMinimap: state.showMinimap,
    autoBuild: state.autoBuild,
    examplesTopic: state.examplesTopic,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — settings just won't persist.
  }
}
