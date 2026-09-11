import type {Program} from "@vladyslav005/tt-core";
import type {ProofTree} from "@vladyslav005/tt-core";
import {useDependencies} from "@/app/providers/di/DependencyProvider.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {clean, clearProcessingErrors, pushProcessingError, setAst, setErrorMarkers, setEvaluation, setProof, setTypeAliases} from "@/shared/ui-state/termSlice.ts";
import type {EvaluationStrategy} from "@vladyslav005/tt-core";
import {ParseSyntaxError} from "@vladyslav005/tt-core";
import {TypeCheckError} from "@vladyslav005/tt-core";

export function useTermHooks() {
  const {
    parser,
    typeCheckerSLTC,
    evaluator,
  } = useDependencies();

  const dispatch = useAppDispatch()
  const termText = useAppSelector((state) => state.term.termText);
  const ast = useAppSelector((state) => state.term.ast);
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);

  function parseTerm(term: string): Program {
    return parser.parseExpression(term)
  }

  function typecheckTerm(ast: Program): ProofTree {
    typeCheckerSLTC.setTheories(enabledTheories);
    return typeCheckerSLTC.check(ast);
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

    try {
      ast = parser.parseExpression(term);

      dispatch(setAst(ast))

    } catch (error) {
      console.error("Error parsing term:", error);
      dispatch(pushProcessingError(new Error(`${(error as Error).message}`)))
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
        dispatch(pushProcessingError(new Error("No main expression — write a term after the declarations")));
        return undefined;
      }

      typeCheckerSLTC.setTheories(enabledTheories);
      proof = typeCheckerSLTC.check(ast);

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

    // Otherwise a stale message from a previous run (a different strategy, a since-fixed
    // divergence, ...) sticks around forever, piling up alongside whatever this run produces.
    dispatch(clearProcessingErrors());

    try {
      const evaluationResult = evaluator.evaluate(targetAst, strategy);
      dispatch(setEvaluation(evaluationResult));

      evaluationResult.errors?.forEach((e) =>
        dispatch(pushProcessingError(new Error(e.message))),
      );

      if (evaluationResult.reachedStepLimit) {
        dispatch(
          pushProcessingError(
            new Error("Evaluation reached the step limit — expression may not be fully reduced"),
          ),
        );
      }

      if (evaluationResult.divergence) {
        const {kind, atStep} = evaluationResult.divergence;
        const reason = kind === "cycle"
          ? "it started repeating the exact same term forever"
          : "the term kept growing without ever settling down";
        dispatch(
          pushProcessingError(
            new Error(`Evaluation stopped early after ${atStep} step${atStep === 1 ? "" : "s"} — ${reason}, so it will never reach a value`),
          ),
        );
      }
    } catch (error) {
      console.error("Error evaluating term:", error);
      dispatch(pushProcessingError(new Error(`${(error as Error).message}`)));
    }
  }

  return {
    parseTerm,
    typecheckTerm,
    evaluateTerm,
    parseAndTypeCheck
  }
}