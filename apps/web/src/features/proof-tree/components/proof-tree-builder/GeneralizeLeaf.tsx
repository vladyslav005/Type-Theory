import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {MathJax} from "better-react-mathjax";
import type {GammaRegistry, ProofTree} from "@vladyslav005/tt-core";
import {TexMapper} from "@vladyslav005/tt-core";
import type {StudentProofNode} from "@/shared/ui-state/studentProof.ts";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {setNodeScheme} from "@/shared/ui-state/termSlice.ts";
import {Popover, PopoverAnchor, PopoverContent} from "@/shared/components/ui/popover.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {type DraftType, draftToType, TypeSlotPicker, typeToDraft} from "@/features/proof-tree/components/proof-tree-builder/TypeSlotPicker.tsx";
import {buildTypeSuggestions} from "@/features/proof-tree/components/proof-tree-builder/typeSuggestions.ts";
import {gammaRefTex} from "@/features/proof-tree/components/proof-tree-builder/ConclusionBuilder.tsx";

interface GeneralizeLeafProps {
  letStudentNode: StudentProofNode;
  letAnswerNode: ProofTree;
  registry: GammaRegistry;
  highlightMistakes: boolean;
}

// The generalize(T, Γ) = S premise of CT-Let — the dual of instantiate(...) at each CT-VarLet.
// It sits between the let's value and body, exactly where the automatic tree draws it.
export function GeneralizeLeaf({letStudentNode, letAnswerNode, registry, highlightMistakes}: GeneralizeLeafProps) {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftType | null>(null);

  const valueStudent = letStudentNode.premises[0];
  const valueType = valueStudent?.writtenType;
  const unlocked = valueType !== undefined;
  const scheme = letStudentNode.writtenScheme;

  const valueTex = valueType ? TexMapper.typeToTex(valueType) : "?";
  // The automatic tree writes a bare Γ when the context is empty.
  const gammaTex = letAnswerNode.gamma && Object.keys(letAnswerNode.gamma).length > 0 ? gammaRefTex(letAnswerNode.gamma, registry, false) : "\\Gamma";
  const schemeTex = scheme ? TexMapper.typeToTex(scheme) : "?";
  const judgement = `\\mathit{generalize}(${valueTex}, ${gammaTex}) = ${unlocked ? `\\href{scheme}{${schemeTex}}` : schemeTex}`;

  const draftAsType = draft ? draftToType(draft) : null;
  const submit = useCallback(() => {
    if (!draftAsType) return;
    dispatch(setNodeScheme({nodeId: letStudentNode.id, scheme: draftAsType}));
    setOpen(false);
  }, [draftAsType, dispatch, letStudentNode.id]);

  const onClick = (e: React.MouseEvent<HTMLElement>) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor || anchor.getAttribute("data-mjx-href") !== "scheme" || !unlocked) return;
    e.preventDefault();
    e.stopPropagation();
    setDraft(scheme ? typeToDraft(scheme) : null);
    setOpen(true);
  };

  const check = letStudentNode.generalizeCheck;

  return (
    <div className="proof-node">
      <div className="conclusion not-root leaf-node">
        <div className="conclusion-left"/>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div
              className={cn(
                "conclusion-center leaf-node not-root rounded-md my-1.5 px-2 flex items-center gap-2 text-muted-foreground",
                unlocked && "cursor-pointer",
                check === "valid" && "bg-emerald-500/10 border border-emerald-500/30",
                highlightMistakes && check === "invalid" && "bg-destructive/10 border border-destructive/30",
              )}
              onClick={onClick}
            >
              <MathJax key={judgement}>{`\\[ ${judgement} \\]`}</MathJax>
            </div>
          </PopoverAnchor>
          <PopoverContent className="w-auto max-w-sm space-y-2" align="start">
            <p className="text-xs font-medium text-muted-foreground">{t("proofBuilder.generalizeQuestion")}</p>
            <p className="text-[11px] text-muted-foreground max-w-72">{t("proofBuilder.generalizeHint")}</p>
            <TypeSlotPicker value={draft} onChange={setDraft} contextTypes={buildTypeSuggestions(letAnswerNode.gamma, [valueType])} enabledTheories={enabledTheories}/>
            <Button size="sm" className="w-full" disabled={!draftAsType} onClick={submit}>{t("proofBuilder.setScheme")}</Button>
          </PopoverContent>
        </Popover>
        <div className="conclusion-right"/>
      </div>
    </div>
  );
}
