import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {MathJax} from "better-react-mathjax";
import type {ProofTree} from "@vladyslav005/tt-core";
import {Rule} from "@vladyslav005/tt-core";
import {reboundNames} from "@/shared/ui-state/studentProof.ts";
import type {ConstraintPair, ContextBinding, StudentProofNode} from "@/shared/ui-state/studentProof.ts";
import {TexMapper} from "@vladyslav005/tt-core";
import type {GammaRegistry} from "@vladyslav005/tt-core";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {revealPremise, setNodeConstraints, setNodeContext, setNodeType} from "@/shared/ui-state/termSlice.ts";
import {isVarRule} from "@/shared/ui-state/ruleFamilies.ts";
import {Popover, PopoverAnchor, PopoverContent} from "@/shared/components/ui/popover.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {Input} from "@/shared/components/ui/input.tsx";
import {cn} from "@/shared/lib/utils.ts";
import type {TypeScheme} from "@vladyslav005/tt-core";
import type {Type} from "@vladyslav005/tt-core";
import {type DraftType, draftToType, TypeSlotPicker, typeToDraft} from "@/features/proof-tree/components/proof-tree-builder/TypeSlotPicker.tsx";
import {buildTypeSuggestions} from "@/features/proof-tree/components/proof-tree-builder/typeSuggestions.ts";
import {useTexRefExpansion} from "@/features/proof-tree/components/proof-tree-using-css/TexRefExpansionContext.tsx";

interface ConclusionBuilderProps {
  studentNode: StudentProofNode;
  answerNode: ProofTree;
  parentGamma: Record<string, Type | TypeScheme>;
  registry: GammaRegistry;
  // True once a rule is chosen and every revealed premise has a type.
  typeSlotUnlocked: boolean;
}

// Numbered short form (Γ_n) by default, full recipe when toggled open.
// `hrefKey`, when given, makes the result independently clickable.
// eslint-disable-next-line react-refresh/only-export-components -- reused outside this component
export function gammaRefTex(
  gamma: Record<string, Type | TypeScheme>,
  registry: GammaRegistry,
  expanded: boolean,
  hrefKey?: string,
): string {
  const ref = registry.refFor(gamma);
  if (!ref) return "\\emptyset";
  const content = expanded ? ref.fullTex : ref.shortTex;
  return hrefKey ? `\\href{${hrefKey}}{${content}}` : content;
}

type EditorKind = "type" | "context" | "constraints" | null;

interface ConstraintDraft {
  left: DraftType | null;
  right: DraftType | null;
}

// Renders one node's judgement as a single MathJax expression, with each
// interactive slot wrapped in \href{key}{...} (gamma/context/type/premise:N)
// so MathJax renders it as a real clickable link.
export function ConclusionBuilder({studentNode, answerNode, parentGamma, registry, typeSlotUnlocked}: ConclusionBuilderProps) {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const {isExpanded, toggle} = useTexRefExpansion();
  const [openEditor, setOpenEditor] = useState<EditorKind>(null);
  const [typeDraft, setTypeDraft] = useState<DraftType | null>(null);
  const [bindingName, setBindingName] = useState("");
  const [bindingTypeDraft, setBindingTypeDraft] = useState<DraftType | null>(null);
  const [constraintDrafts, setConstraintDrafts] = useState<ConstraintDraft[]>([]);

  const hasChosenRule = studentNode.chosenRule !== undefined;
  const nearbyWritten = [
    studentNode.writtenType,
    ...(studentNode.writtenBindings ?? []).map((b) => b.type),
    ...(studentNode.writtenConstraints ?? []).flatMap((c) => [c.left, c.right]),
    ...studentNode.premises.flatMap((p) => [p.writtenType, ...(p.writtenConstraints ?? []).flatMap((c) => [c.left, c.right])]),
  ];
  const gammaKey = `${studentNode.id}:gamma`;

  const unrevealedPremiseIndices = new Set(
    hasChosenRule
      ? studentNode.premises.map((p, i) => (p.revealed ? -1 : i)).filter((i) => i >= 0)
      : [],
  );

  // A global var's premise is revealed by clicking the whole term (no sub-term to click).
  const isGlobalVarRef = isVarRule(answerNode.rule) && answerNode.premises.length > 0;

  const termTex = unrevealedPremiseIndices.size === 0
    ? TexMapper.termToTex(answerNode.term)
    : isGlobalVarRef
      ? `\\href{premise:0}{${TexMapper.termToTex(answerNode.term)}}`
      : TexMapper.termToTex(answerNode.term, (subterm, tex) => {
        const idx = answerNode.premises.findIndex((p) => p.term === subterm);
        return idx >= 0 && unrevealedPremiseIndices.has(idx) ? `\\href{premise:${idx}}{${tex}}` : tex;
      });

  const rhsTex = studentNode.writtenType
    ? TexMapper.typeToTex(studentNode.writtenType)
    : "?";

  const bindingTex = studentNode.writtenBindings?.length
    ? studentNode.writtenBindings.map((b) => `${b.name}:${TexMapper.typeToTex(b.type)}`).join(", ")
    : "?";

  const parentGammaRef = registry.refFor(parentGamma);
  const parentGammaTex = parentGammaRef
    ? `\\href{gamma}{${isExpanded(gammaKey) ? parentGammaRef.fullTex : parentGammaRef.shortTex}}`
    : null;
  const bindingSetTex = `\\{\\href{context}{${bindingTex}}\\}`;
  const rebound = reboundNames(studentNode.writtenBindings, parentGamma);
  const baseGammaTex = parentGammaTex && rebound.length > 0
    ? `( ${parentGammaTex} - \\{ ${rebound.join(", ")} \\} )`
    : parentGammaTex;

  const gammaSegment = studentNode.requiresContextBuild
    ? (baseGammaTex ? `${baseGammaTex} \\cup ${bindingSetTex}` : bindingSetTex)
    : gammaRefTex(answerNode.gamma, registry, isExpanded(gammaKey), "gamma");

  const constraintsTex = studentNode.writtenConstraints === undefined
    ? "?"
    : studentNode.writtenConstraints.length === 0
      ? "\\emptyset"
      : `\\{ ${studentNode.writtenConstraints.map((c) => `${TexMapper.typeToTex(c.left)} = ${TexMapper.typeToTex(c.right)}`).join(", ")} \\}`;
  const constraintsSegment = studentNode.requiresConstraints
    ? ` \\mid ${typeSlotUnlocked ? `\\href{constraints}{${constraintsTex}}` : constraintsTex}`
    : "";

  const judgement = `${gammaSegment} \\vdash ${termTex} : ${typeSlotUnlocked ? `\\href{type}{${rhsTex}}` : rhsTex}${constraintsSegment}`;

  const openTypeEditor = useCallback(() => {
    setTypeDraft(studentNode.writtenType ? typeToDraft(studentNode.writtenType) : null);
    setOpenEditor("type");
  }, [studentNode.writtenType]);

  const openContextEditor = useCallback(() => {
    const existing = studentNode.writtenBindings?.[0];
    setBindingName(existing?.name ?? "");
    setBindingTypeDraft(existing ? typeToDraft(existing.type) : null);
    setOpenEditor("context");
  }, [studentNode.writtenBindings]);

  const openConstraintsEditor = useCallback(() => {
    setConstraintDrafts(
      (studentNode.writtenConstraints ?? []).map((c) => ({left: typeToDraft(c.left), right: typeToDraft(c.right)})),
    );
    setOpenEditor("constraints");
  }, [studentNode.writtenConstraints]);

  const onJudgementClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    // MathJax's CHTML output renders \href{}{} as data-mjx-href, not a real href.
    const key = anchor.getAttribute("data-mjx-href");
    if (key === null) return;

    if (key === "gamma") {
      e.preventDefault();
      e.stopPropagation();
      toggle(gammaKey);
    } else if (key === "type") {
      if (!typeSlotUnlocked) return;
      e.preventDefault();
      e.stopPropagation();
      openTypeEditor();
    } else if (key === "constraints") {
      if (!typeSlotUnlocked) return;
      e.preventDefault();
      e.stopPropagation();
      openConstraintsEditor();
    } else if (key === "context") {
      e.preventDefault();
      e.stopPropagation();
      openContextEditor();
    } else if (key.startsWith("premise:")) {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(key.slice("premise:".length));
      const premise = studentNode.premises[idx];
      if (premise) dispatch(revealPremise({premiseId: premise.id}));
    }
  }, [typeSlotUnlocked, openTypeEditor, openContextEditor, openConstraintsEditor, studentNode.premises, dispatch, gammaKey, toggle]);

  const typeDraftAsType = typeDraft ? draftToType(typeDraft) : null;
  const submitType = useCallback(() => {
    if (!typeDraftAsType) return;
    dispatch(setNodeType({nodeId: studentNode.id, type: typeDraftAsType}));
    setOpenEditor(null);
  }, [typeDraftAsType, dispatch, studentNode.id]);

  const bindingTypeAsType = bindingTypeDraft ? draftToType(bindingTypeDraft) : null;
  const canSubmitBinding = bindingName.trim().length > 0 && bindingTypeAsType !== null;
  const submitBinding = useCallback(() => {
    if (!canSubmitBinding || !bindingTypeAsType) return;
    const bindings: ContextBinding[] = [{name: bindingName.trim(), type: bindingTypeAsType}];
    dispatch(setNodeContext({nodeId: studentNode.id, bindings}));
    setOpenEditor(null);
  }, [canSubmitBinding, bindingTypeAsType, bindingName, dispatch, studentNode.id]);

  const completedConstraints = constraintDrafts.map((d) => ({
    left: d.left ? draftToType(d.left) : null,
    right: d.right ? draftToType(d.right) : null,
  }));
  const constraintsComplete = completedConstraints.every((c) => c.left !== null && c.right !== null);
  const submitConstraints = useCallback((pairs: ConstraintPair[]) => {
    dispatch(setNodeConstraints({nodeId: studentNode.id, constraints: pairs}));
    setOpenEditor(null);
  }, [dispatch, studentNode.id]);
  const updateConstraintDraft = (index: number, patch: Partial<ConstraintDraft>) =>
    setConstraintDrafts((drafts) => drafts.map((d, i) => (i === index ? {...d, ...patch} : d)));

  return (
    <Popover open={openEditor !== null} onOpenChange={(o) => !o && setOpenEditor(null)}>
      <PopoverAnchor asChild>
        <span
          onClick={onJudgementClick}
          className={cn(
            (typeSlotUnlocked || studentNode.requiresContextBuild || unrevealedPremiseIndices.size > 0) && "cursor-pointer",
          )}
        >
          <MathJax key={judgement}>{`\\[ ${judgement} \\]`}</MathJax>
        </span>
      </PopoverAnchor>
      <PopoverContent className="w-auto max-w-sm space-y-2" align="start">
        {openEditor === "type" && (
          <>
            <p className="text-xs font-medium text-muted-foreground">{t("proofBuilder.buildJudgementType")}</p>
            {answerNode.rule === Rule.CtAbsInf && (
              <p className="text-[11px] text-muted-foreground max-w-72">{t("proofBuilder.freshVariableHint")}</p>
            )}
            {answerNode.rule === Rule.CtVarLet && (
              <p className="text-[11px] text-muted-foreground max-w-72">{t("proofBuilder.instantiateHint")}</p>
            )}
            <TypeSlotPicker value={typeDraft} onChange={setTypeDraft} contextTypes={buildTypeSuggestions(answerNode.gamma, nearbyWritten)} enabledTheories={enabledTheories}/>
            <Button size="sm" className="w-full" disabled={!typeDraftAsType} onClick={submitType}>{t("proofBuilder.setType")}</Button>
          </>
        )}
        {openEditor === "constraints" && (
          <>
            <p className="text-xs font-medium text-muted-foreground">{t("proofBuilder.constraintsQuestion")}</p>
            <p className="text-[11px] text-muted-foreground max-w-72">{t("proofBuilder.constraintsHint")}</p>
            <div className="space-y-2">
              {constraintDrafts.map((draft, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <TypeSlotPicker value={draft.left} onChange={(left) => updateConstraintDraft(i, {left})} contextTypes={buildTypeSuggestions(answerNode.gamma, nearbyWritten)} enabledTheories={enabledTheories}/>
                    <span className="text-muted-foreground text-xs font-mono">=</span>
                    <TypeSlotPicker value={draft.right} onChange={(right) => updateConstraintDraft(i, {right})} contextTypes={buildTypeSuggestions(answerNode.gamma, nearbyWritten)} enabledTheories={enabledTheories}/>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive text-xs px-1"
                    title={t("proofBuilder.removeConstraint")}
                    onClick={() => setConstraintDrafts((drafts) => drafts.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setConstraintDrafts((drafts) => [...drafts, {left: null, right: null}])}>
                {t("proofBuilder.addConstraint")}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 font-mono" onClick={() => submitConstraints([])}>
                ∅
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={constraintDrafts.length === 0 || !constraintsComplete}
              onClick={() => submitConstraints(completedConstraints.map((c) => ({left: c.left!, right: c.right!})))}
            >
              {t("proofBuilder.setConstraints")}
            </Button>
          </>
        )}
        {openEditor === "context" && (
          <>
            <p className="text-xs font-medium text-muted-foreground">{t("proofBuilder.contextQuestion")}</p>
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={bindingName}
                onChange={(e) => setBindingName(e.target.value)}
                placeholder={t("proofBuilder.namePlaceholder")}
                className="h-7 w-20 text-xs font-mono px-1"
              />
              <span className="text-muted-foreground text-xs">:</span>
              <TypeSlotPicker value={bindingTypeDraft} onChange={setBindingTypeDraft} contextTypes={buildTypeSuggestions(parentGamma, nearbyWritten)} enabledTheories={enabledTheories}/>
            </div>
            <Button size="sm" className="w-full" disabled={!canSubmitBinding} onClick={submitBinding}>{t("proofBuilder.setBinding")}</Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
