import {EvaluationStrategy} from "@vladyslav005/tt-core";
import {DEFAULT_STLC_FEATURES, DEFAULT_TYPE_THEORY_CONFIG, isPlainStlc, type StlcFeatureConfig, type TypeTheoryConfig} from "@vladyslav005/tt-core";
import type {TermState} from "@/shared/ui-state/termSlice.ts";

const STORAGE_KEY = "tt.settings.v1";

// Only user-chosen settings persist — derived/transient state (ast, proof,
// evaluation result, error markers, build mode) is recomputed on demand.
export interface PersistedTermState {
  termText: string | undefined;
  enabledTheories: TypeTheoryConfig;
  curryHoward: boolean;
  stlcFeatures: StlcFeatureConfig;
  evaluationStrategy: EvaluationStrategy;
  fontSize: number;
  showMinimap: boolean;
  autoBuild: boolean;
  examplesTopic: string;
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
      stlcFeatures: {...DEFAULT_STLC_FEATURES, ...parsed.stlcFeatures},
      evaluationStrategy,
      fontSize: typeof parsed.fontSize === "number" && Number.isFinite(parsed.fontSize)
        ? parsed.fontSize
        : 14,
      showMinimap: parsed.showMinimap !== false,
      autoBuild: parsed.autoBuild === true,
      examplesTopic: typeof parsed.examplesTopic === "string" ? parsed.examplesTopic : "all",
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
    evaluationStrategy: state.evaluationStrategy,
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
