import {Fragment, memo} from "react";
import {useTranslation} from "react-i18next";
import {MathJax} from "better-react-mathjax";
import {RotateCcw} from "lucide-react";
import type {ProofTree, TypeScheme} from "@vladyslav005/tt-core";
import {Rule} from "@vladyslav005/tt-core";
import type {Type} from "@vladyslav005/tt-core";
import type {StudentProofNode} from "@/shared/ui-state/studentProof.ts";
import {ConclusionBuilder, gammaRefTex} from "@/features/proof-tree/components/proof-tree-builder/ConclusionBuilder.tsx";
import {RulePickerPopover} from "@/features/proof-tree/components/proof-tree-builder/RulePickerPopover.tsx";
import {RULE_LABELS} from "@/features/proof-tree/components/proof-tree-builder/ruleLabels.ts";
import {TexMapper} from "@vladyslav005/tt-core";
import {useAppDispatch} from "@/shared/hooks/reduxHooks.ts";
import {resetNode} from "@/shared/ui-state/termSlice.ts";
import {cn} from "@/shared/lib/utils.ts";
import type {GammaRegistry} from "@vladyslav005/tt-core";
import "@/features/proof-tree/components/proof-tree-using-css/ProofTree.css";

interface ProofTreeBuilderNodeProps {
  studentNode: StudentProofNode;
  answerNode: ProofTree;
  // The context this node's own Γ was built on top of.
  parentGamma: Record<string, Type | TypeScheme>;
  // Numbers every distinct Γ once as Γ_1, Γ_2, ... (see ProofTreeBuilder.tsx).
  registry: GammaRegistry;
  highlightMistakes: boolean;
  root?: boolean;
}

// A local variable's Γ membership is a given fact, shown as a static leaf.
// A global reference has a real "jump to definition" premise instead (see
// isLocalVar below).
function VariableMembershipLeaf({answerNode, registry}: { answerNode: ProofTree; registry: GammaRegistry }) {
  const name = (answerNode.term as {name?: string}).name ?? "?";
  const judgement = `${name} : ${TexMapper.typeToTex(answerNode.type)} \\in ${gammaRefTex(answerNode.gamma, registry, false)}`;
  return (
    <div className="proof-node">
      <div className="conclusion not-root leaf-node">
        <div className="conclusion-left"/>
        <div className="conclusion-center leaf-node not-root rounded-md my-1.5 px-2 flex items-center gap-2 text-muted-foreground">
          <MathJax key={judgement}>{`\\[ ${judgement} \\]`}</MathJax>
        </div>
        <div className="conclusion-right"/>
      </div>
    </div>
  );
}

// Mirrors ProofTreeComponentUsingCss's DOM shape so a hand-built tree looks
// like the automatic one, but recurses over (student, answer) in lockstep
// and only shows revealed premises. Memoized since Immer gives every
// ancestor of an edited node a new reference — this keeps untouched sibling
// subtrees from re-rendering (and re-typesetting via MathJax).
export const ProofTreeBuilderNode = memo(function ProofTreeBuilderNode({studentNode, answerNode, parentGamma, registry, highlightMistakes, root = true}: ProofTreeBuilderNodeProps) {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const hasChosenRule = studentNode.chosenRule !== undefined;
  // Keyed off the real rule/premise count, not the student's guess.
  const isLocalVar = hasChosenRule && answerNode.rule === Rule.Var && answerNode.premises.length === 0;
  const isLeaf = hasChosenRule && studentNode.premises.length === 0;
  const showDashedPlaceholder = !hasChosenRule;
  // Original index, not position in this filtered list — premises can be
  // revealed out of order.
  const premisesToShow = hasChosenRule
    ? studentNode.premises
      .map((premise, originalIndex) => ({premise, originalIndex}))
      .filter(({premise}) => premise.revealed)
    : [];

  const contextFilled = !studentNode.requiresContextBuild || studentNode.writtenBindings !== undefined;
  const typeSlotUnlocked = hasChosenRule
    && contextFilled
    && studentNode.premises.every((p) => p.writtenType !== undefined);

  const isItRoot = root ? "root" : "not-root";
  const isItLeaf = isLeaf ? "leaf-node" : "not-leaf-node";

  const ruleLabel = studentNode.chosenRule !== undefined ? RULE_LABELS[studentNode.chosenRule] : undefined;

  const anyInvalid = studentNode.ruleCheck === "invalid"
    || studentNode.typeCheck === "invalid"
    || studentNode.contextCheck === "invalid";
  const allValid = studentNode.ruleCheck === "valid"
    && studentNode.typeCheck === "valid"
    && (!studentNode.requiresContextBuild || studentNode.contextCheck === "valid");

  return (
    <div className="proof-node">
      <div
        className="premises"
        style={showDashedPlaceholder ? {borderBottomStyle: "dashed", opacity: 0.5} : undefined}
      >
        {isLocalVar && <VariableMembershipLeaf answerNode={answerNode} registry={registry}/>}
        {!isLocalVar && premisesToShow.map(({premise, originalIndex}, displayIndex) => {
          const answerPremise = answerNode.premises[originalIndex];
          if (!answerPremise) return null;
          // A global var's jump-to-definition premise has its own unrelated scope.
          const childParentGamma = answerNode.rule === Rule.Var ? answerPremise.gamma : answerNode.gamma;
          return (
            <Fragment key={premise.id}>
              <ProofTreeBuilderNode
                root={false}
                studentNode={premise}
                answerNode={answerPremise}
                parentGamma={childParentGamma}
                registry={registry}
                highlightMistakes={highlightMistakes}
              />
              {displayIndex !== premisesToShow.length - 1 && <div className="inter-proof"/>}
            </Fragment>
          );
        })}
      </div>

      <div className={`conclusion ${isItRoot} ${isItLeaf}`}>
        <div className="conclusion-left"/>

        <div
          className={cn(
            `conclusion-center ${isItLeaf} ${isItRoot} rounded-md my-1.5 px-2 flex items-center gap-2 transition-all duration-200`,
            highlightMistakes && anyInvalid && "bg-destructive/10 border border-destructive/30 dark:bg-destructive/15 dark:border-destructive/40",
            allValid && "bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-500/15 dark:border-emerald-500/40",
          )}
          title={highlightMistakes && anyInvalid
            ? "Doesn't match — press Check Proof again after fixing it"
            : undefined}
        >
          <ConclusionBuilder
            studentNode={studentNode}
            answerNode={answerNode}
            parentGamma={parentGamma}
            registry={registry}
            typeSlotUnlocked={typeSlotUnlocked}
          />
          {studentNode.chosenRule !== undefined && (
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title={t("proofBuilder.resetNode")}
              onClick={() => dispatch(resetNode({nodeId: studentNode.id}))}
            >
              <RotateCcw className="h-3 w-3"/>
            </button>
          )}
        </div>

        <div className="conclusion-right">
          <RulePickerPopover nodeId={studentNode.id}>
            <p
              className={cn(
                "rule-name cursor-pointer select-none hover:underline",
                highlightMistakes && studentNode.ruleCheck === "invalid" && "text-destructive",
              )}
            >
              {ruleLabel ?? t("proofBuilder.pickRule")}
            </p>
          </RulePickerPopover>
        </div>
      </div>
    </div>
  );
});
