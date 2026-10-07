import type {Program} from "@vladyslav005/tt-core";
import type {ProofTree} from "@vladyslav005/tt-core";
import {useDependencies} from "@/app/providers/di/DependencyProvider.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {clean, clearEvaluationErrors, EvaluationRunError, EvaluationWarning, pushProcessingError, setAst, setErrorMarkers, setBuiltText, setEvaluating, setEvaluation, setInferenceProofSnapshots, setInferenceSteps, setProof, setTypeAliases} from "@/shared/ui-state/termSlice.ts";
import type {EvaluationStrategy} from "@vladyslav005/tt-core";
import {elaborateNbl, noMainExpressionMessage, ParseSyntaxError} from "@vladyslav005/tt-core";
import {TypeCheckError} from "@vladyslav005/tt-core";
import {findNodePosition} from "@/shared/lib/errorPosition.ts";

let latestEvaluation = 0;

export function useTermHooks() {
  const {
    parser,
    typeCheckerSLTC,
    evaluator,
  } = useDependencies();

  const dispatch = useAppDispatch()
  const termText = useAppSelector((state) => state.term.termText);
  const builtText = useAppSelector((state) => state.term.builtText);
  const autoBuild = useAppSelector((state) => state.term.autoBuild);
  const ast = useAppSelector((state) => state.term.ast);
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const stlcFeatures = useAppSelector((state) => state.term.stlcFeatures);
  const requireTermType = useAppSelector((state) => state.term.requireTermType);

  function parseTerm(term: string): Program {
    const program = parser.parseExpression(term);
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
      dispatch(clearEvaluationErrors());
      dispatch(pushProcessingError(new EvaluationWarning(
        "The text editor content has changed since the last Parse & Type Check — evaluating now would use the previous version. Run Parse & Type Check first.",
      )));
      return;
    }

    const run = ++latestEvaluation;
    dispatch(setEvaluating(true));
    // Lets the loading indicator paint before the synchronous evaluation blocks the thread.
    requestAnimationFrame(() => setTimeout(() => {
      if (run === latestEvaluation) runEvaluation(targetAst, strategy);
    }, 0));
  }

  function runEvaluation(targetAst: Program, strategy: EvaluationStrategy) {
    // Only the previous run's messages — type-check errors from the same build must survive.
    dispatch(clearEvaluationErrors());

    try {
      const evaluationResult = evaluator.evaluate(targetAst, strategy);
      dispatch(setEvaluation(evaluationResult));

      evaluationResult.errors?.forEach((e) =>
        dispatch(pushProcessingError(new EvaluationRunError(
          e.message,
          e.stuckTermId ? findNodePosition(evaluationResult.result, e.stuckTermId) : undefined,
        ))),
      );

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

  return {
    parseTerm,
    typecheckTerm,
    evaluateTerm,
    parseAndTypeCheck
  }
}