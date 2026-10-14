import type {Program} from "@vladyslav005/tt-core";
import type {ProofTree} from "@vladyslav005/tt-core";
import {useDependencies} from "@/app/providers/di/DependencyProvider.tsx";
import {useAppDispatch, useAppSelector, useAppStore} from "@/shared/hooks/reduxHooks.ts";
import {clean, clearEvaluationErrors, EvaluationInfo, EvaluationRunError, EvaluationWarning, isError, OutputNote, pushProcessingError, setAst, setErrorMarkers, setBuilding, setBuiltText, setEvaluating, setEvaluation, setInferenceProofSnapshots, setInferenceSteps, setProof, setTypeAliases} from "@/shared/ui-state/termSlice.ts";
import type {EvaluationResult} from "@vladyslav005/tt-core";
import {elaborateNbl, EvaluationStrategy, Evaluator, helperCandidates, noMainExpressionMessage, ParseSyntaxError, typeToString} from "@vladyslav005/tt-core";
import {TypeCheckError} from "@vladyslav005/tt-core";
import {findNodePosition} from "@/shared/lib/errorPosition.ts";
import {afterPaint} from "@/shared/lib/afterPaint.ts";
import {toast} from "sonner";
import {useTranslation} from "react-i18next";

let latestEvaluation = 0;
// Steps (not counting name→definition lookups) past which a run suggests Shortcuts — once per session.
const LONG_EVALUATION = 100;
let shortcutsTipShown = false;

export function useTermHooks() {
  const {
    parser,
    typeCheckerSLTC,
  } = useDependencies();

  const dispatch = useAppDispatch()
  const {t} = useTranslation();
  const termText = useAppSelector((state) => state.term.termText);
  const builtText = useAppSelector((state) => state.term.builtText);
  const autoBuild = useAppSelector((state) => state.term.autoBuild);
  const evaluationLimits = useAppSelector((state) => state.term.evaluationLimits);
  const store = useAppStore();
  const ast = useAppSelector((state) => state.term.ast);
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const stlcFeatures = useAppSelector((state) => state.term.stlcFeatures);
  const requireTermType = useAppSelector((state) => state.term.requireTermType);

  function parseTerm(term: string): Program {
    const program = parser.parseExpression(term, {keywordsAsIdentifiers: enabledTheories.untyped});
    return enabledTheories.nbl || enabledTheories.typedNbl ? elaborateNbl(program) : program;
  }

  function typecheckTerm(ast: Program): ProofTree {
    typeCheckerSLTC.setTheories(enabledTheories);
    typeCheckerSLTC.setStlcFeatures(stlcFeatures);
    return typeCheckerSLTC.check(ast, {requireTermType});
  }

  // Returns the parsed Program on success (a term to evaluate exists, whether or not it
  // type-checked cleanly) so a caller can chain straight into evaluateTerm without waiting for
  // the next render — dispatch updates the store immediately, but this hook's own `ast`/`proof`
  // closures only refresh once React re-renders, which is too late for a same-tick chain.
  function parseAndTypeCheck(termOverride?: string): Program | undefined {
    const term = termOverride ?? termText;
    if (!term) return undefined;

    let ast: Program | undefined = undefined
    let proof: ProofTree | undefined = undefined

    dispatch(clean())
    dispatch(setBuiltText(term))

    try {
      ast = parseTerm(term);

      dispatch(setAst(ast))

    } catch (error) {
      console.error("Error parsing term:", error);
      dispatch(pushProcessingError(error instanceof ParseSyntaxError ? error : new Error(`${(error as Error).message}`)))
      if (error instanceof ParseSyntaxError) {
        dispatch(setErrorMarkers(error.errors));
      }
      dispatch(setAst(undefined))
      dispatch(setProof({proof: undefined}))
      return undefined;
    }

    try {
      if (!ast) return undefined;

      if (!ast.term) {
        dispatch(pushProcessingError(new Error(noMainExpressionMessage(ast))));
        return undefined;
      }

      typeCheckerSLTC.setTheories(enabledTheories);
      typeCheckerSLTC.setStlcFeatures(stlcFeatures);
      proof = typeCheckerSLTC.check(ast, {requireTermType});

      const typeErrors = typeCheckerSLTC.getErrors();
      typeErrors.forEach(e => dispatch(pushProcessingError(e)));

      const typeMarkers = typeErrors
        .filter((e): e is TypeCheckError => e instanceof TypeCheckError && e.pos !== undefined)
        .map((e) => ({...e.pos!, message: e.message}));

      if (typeMarkers.length > 0) {
        dispatch(setErrorMarkers(typeMarkers));
      }

      dispatch(setProof({proof}));
      dispatch(setTypeAliases(typeCheckerSLTC.getTypeAliases()));
      dispatch(setInferenceSteps(typeCheckerSLTC.getInferenceSteps()));
      dispatch(setInferenceProofSnapshots(typeCheckerSLTC.getInferenceProofSnapshots()));
      reportBuild(proof, typeErrors.length === 0);

      return ast;
    } catch (error) {
      console.error("Error typechecking term:", error);
      dispatch(pushProcessingError(new Error(`${(error as Error).message}`)));
      dispatch(setProof({proof: undefined}));
      return undefined;
    }
  }


  // `astOverride` lets a caller that just ran parseAndTypeCheck synchronously (in the same tick)
  // pass its result straight through, instead of reading this hook's own (not-yet-updated) `ast`.
  function evaluateTerm(strategy: EvaluationStrategy, astOverride?: Program) {
    const targetAst = astOverride ?? ast;
    if (!targetAst) return;
    if (!astOverride && !autoBuild && builtText !== undefined && termText !== builtText) {
      toast.warning(t("toasts.staleBuild", {action: t("actions.typeCheck")}));
      return;
    }

    const run = ++latestEvaluation;
    dispatch(setEvaluating(true));
    afterPaint(() => {
      if (run === latestEvaluation) runEvaluation(targetAst, strategy, store.getState().term.blackBoxes);
    });
  }

  function runEvaluation(targetAst: Program, strategy: EvaluationStrategy, boxes: string[]) {
    // Only the previous run's messages — type-check errors from the same build must survive.
    dispatch(clearEvaluationErrors());

    try {
      const evaluationResult = newEvaluator().evaluate(targetAst, strategy, {blackBoxes: boxes});
      dispatch(setEvaluation(evaluationResult));
      suggestShortcuts(targetAst, evaluationResult.steps.filter((step) => step.rule !== "definition").length, boxes);

      evaluationResult.errors?.forEach((e) =>
        dispatch(pushProcessingError(new EvaluationRunError(
          e.message,
          e.stuckTermId ? findNodePosition(evaluationResult.result, e.stuckTermId) : undefined,
        ))),
      );

      reportEvaluation(targetAst, evaluationResult, strategy);

      if (evaluationResult.reachedStepLimit) {
        dispatch(
          pushProcessingError(
            new EvaluationWarning(evaluationResult.limit === "size"
              ? "Evaluation stopped: the term grew too large — it likely does not terminate under this strategy"
              : evaluationResult.limit === "time"
                ? "Evaluation stopped: it took too long — expression may not be fully reduced"
                : "Evaluation reached the step limit — expression may not be fully reduced"),
          ),
        );
      }
    } catch (error) {
      console.error("Error evaluating term:", error);
      dispatch(pushProcessingError(new EvaluationRunError(`${(error as Error).message}`)));
    } finally {
      dispatch(setEvaluating(false));
    }
  }

  // Pushed after setProof: the activity tracker reads the output at that moment to count failures.
  function reportBuild(proof: ProofTree, ok: boolean) {
    if (!ok) return;
    dispatch(pushProcessingError(new OutputNote(enabledTheories.untyped || enabledTheories.nbl
      ? t("output.parsed")
      : t("output.typeChecked", {type: typeToString(proof.type)}), "info")));
  }

  function reportEvaluation(program: Program, result: EvaluationResult, strategy: EvaluationStrategy) {
    const info = (message: string) => dispatch(pushProcessingError(new EvaluationInfo(message)));
    const strategyLabel = t(`evalStrategy.${strategy}.label`);
    const checkFailed = store.getState().term.processingErrors?.some((e) => isError(e) && !(e instanceof EvaluationRunError));
    if (checkFailed) dispatch(pushProcessingError(new EvaluationWarning(t("output.evaluatedDespiteErrors"))));
    if (result.reachedStepLimit) {
      if (strategy === EvaluationStrategy.CALL_BY_VALUE) info(t("output.tryNormalOrder"));
      return;
    }
    if (result.errors?.length) return;
    const reductions = result.steps.filter((step) => step.rule !== "definition").length;
    info(reductions === 0
      ? t("output.alreadyNormal")
      : t("output.evaluated", {count: reductions, strategy: strategyLabel}));
    if (strategy !== EvaluationStrategy.NORMAL && reducibleUnderNormalOrder(program, result.result)) {
      info(t(strategy === EvaluationStrategy.CALL_BY_VALUE ? "output.weakByValue" : "output.weakByName"));
    }
  }

  function reducibleUnderNormalOrder(program: Program, term: Program["term"]): boolean {
    try {
      const probe = new Evaluator(20).evaluate({...program, term}, EvaluationStrategy.NORMAL);
      return probe.steps.some((step) => step.rule !== "definition");
    } catch {
      return false;
    }
  }

  // In the error output on every long run; as a toast only once per session.
  function suggestShortcuts(program: Program, steps: number, boxes: string[]) {
    if (boxes.length > 0 || steps <= LONG_EVALUATION) return;
    if (!helperCandidates(program).some((candidate) => !candidate.recursive)) return;
    const tip = t("toasts.longEvaluation", {count: steps});
    dispatch(pushProcessingError(new EvaluationWarning(tip)));
    if (shortcutsTipShown) return;
    shortcutsTipShown = true;
    toast.info(tip);
  }

  function newEvaluator() {
    return new Evaluator(evaluationLimits.maxSteps, {maximumTermSize: evaluationLimits.maxTermSize});
  }

  // The run without black boxes, for practice mode — computed only when asked for.
  function fullEvaluation(of: EvaluationResult): EvaluationResult | undefined {
    if (!of.blackBoxes?.length) return of;
    return ast ? newEvaluator().evaluate(ast, of.strategy) : undefined;
  }

  // Same as parseAndTypeCheck, but lets the building indicator paint first; `then` gets the result.
  function parseAndTypeCheckDeferred(then?: (ast: Program | undefined) => void) {
    dispatch(setBuilding(true));
    afterPaint(() => {
      try {
        const ast = parseAndTypeCheck();
        then?.(ast);
      } finally {
        dispatch(setBuilding(false));
      }
    });
  }

  return {
    parseTerm,
    typecheckTerm,
    evaluateTerm,
    fullEvaluation,
    parseAndTypeCheck,
    parseAndTypeCheckDeferred,
  }
}