import {memo} from "react";
import {useTranslation} from "react-i18next";
import {Plus, X} from "lucide-react";
import type {ManualField, ManualNode, ManualNodeResult, ManualVerdict} from "@/shared/ui-state/manualProof.ts";
import {useAppDispatch} from "@/shared/hooks/reduxHooks.ts";
import {addManualPremise, removeManualPremise, setManualConstraintsShown, setManualField} from "@/shared/ui-state/termSlice.ts";
import {cn} from "@/shared/lib/utils.ts";
import {applyShortcuts} from "@/features/proof-tree/manual/notation.ts";
import "@/features/proof-tree/components/proof-tree-using-css/ProofTree.css";

const verdictClass = (verdict: ManualVerdict | undefined) =>
  verdict === "valid"
    ? "border-emerald-500/70 bg-emerald-500/5"
    : verdict === "invalid"
      ? "border-destructive/70 bg-destructive/5"
      : "border-input";

interface FieldProps {
  value: string;
  placeholder: string;
  title?: string;
  width: string;
  verdict?: ManualVerdict;
  readOnly?: boolean;
  onChange: (value: string) => void;
}

function Field({value, placeholder, title, width, verdict, readOnly, onChange}: FieldProps) {
  return (
    <input
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      title={title}
      spellCheck={false}
      onChange={(e) => onChange(applyShortcuts(e.target.value))}
      className={cn(
        "h-7 rounded border bg-background px-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring",
        verdictClass(verdict),
        readOnly && "opacity-80",
      )}
      style={{width}}
    />
  );
}

interface ManualNodeViewProps {
  node: ManualNode;
  results: Record<string, ManualNodeResult>;
  usesConstraints: boolean;
  root?: boolean;
}

export const ManualNodeView = memo(function ManualNodeView({node, results, usesConstraints, root = true}: ManualNodeViewProps) {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const result = results[node.id];
  const constraintsShown = node.constraintsShown ?? usesConstraints;
  const set = (field: ManualField) => (value: string) => dispatch(setManualField({nodeId: node.id, field, value}));

  const isLeaf = node.premises.length === 0;
  const rootClass = root ? "root" : "not-root";
  const leafClass = isLeaf ? "leaf-node" : "not-leaf-node";

  const removeButton = !root && (
    <button
      type="button"
      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
      title={t("manualBuilder.removePremise")}
      onClick={() => dispatch(removeManualPremise({nodeId: node.id}))}
    >
      <X className="h-3 w-3"/>
    </button>
  );

  const messages = result?.messages ?? [];
  const messageList = messages.length > 0 && (
    <ul className="max-w-md space-y-0.5 px-2 pb-1 text-[11px] text-destructive">
      {messages.map((m, i) => (
        <li key={i}>{t(`manualBuilder.msg.${m.code}`, m.params)}</li>
      ))}
    </ul>
  );

  if (node.kind === "fact") {
    return (
      <div className="proof-node">
        <div className={`conclusion not-root leaf-node`}>
          <div className="conclusion-left"/>
          <div className="conclusion-center leaf-node not-root rounded-md my-1.5 px-2 flex items-center gap-1.5">
            <Field
              value={node.fact}
              placeholder={t("manualBuilder.factPlaceholder")}
              width="20rem"
              verdict={result?.fact}
              onChange={set("fact")}
            />
            {removeButton}
          </div>
          <div className="conclusion-right"/>
        </div>
        {messageList}
      </div>
    );
  }

  return (
    <div className="proof-node">
      <div className="premises" style={isLeaf ? {borderBottomStyle: "dashed", opacity: 0.6} : undefined}>
        {node.premises.map((premise, i) => (
          <div key={premise.id} className="inline-flex items-end">
            <ManualNodeView node={premise} results={results} usesConstraints={usesConstraints} root={false}/>
            {i !== node.premises.length - 1 && <div className="inter-proof"/>}
          </div>
        ))}
      </div>

      <div className={`conclusion ${rootClass} ${leafClass}`}>
        <div className="conclusion-left"/>
        <div className={`conclusion-center ${leafClass} ${rootClass} rounded-md my-1.5 px-2 flex items-center gap-1.5`}>
          <Field value={node.gamma} placeholder="Γ" width="7rem" verdict={result?.gamma} onChange={set("gamma")}/>
          <span className="text-sm">⊢</span>
          <Field value={node.term} placeholder={t("manualBuilder.termPlaceholder")} width="13rem" verdict={result?.term} readOnly={root} onChange={set("term")}/>
          <span className="text-sm">:</span>
          <Field value={node.type} placeholder={t("manualBuilder.typePlaceholder")} width="9rem" verdict={result?.type} onChange={set("type")}/>
          {constraintsShown ? (
            <>
              <span className="text-sm">∣</span>
              <Field value={node.constraints} placeholder="C" title={t("manualBuilder.constraintsPlaceholder")} width="9rem" verdict={result?.constraints} onChange={set("constraints")}/>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title={t("manualBuilder.removeConstraints")}
                onClick={() => dispatch(setManualConstraintsShown({nodeId: node.id, shown: false}))}
              >
                <X className="h-3 w-3"/>
              </button>
            </>
          ) : usesConstraints && (
            <button
              type="button"
              className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-mono hover:bg-accent"
              title={t("manualBuilder.addConstraints")}
              onClick={() => dispatch(setManualConstraintsShown({nodeId: node.id, shown: true}))}
            >
              + C
            </button>
          )}
          {removeButton}
        </div>
        <div className="conclusion-right">
          <input
            value={node.rule}
            placeholder={t("manualBuilder.rulePlaceholder")}
            spellCheck={false}
            onChange={(e) => set("rule")(e.target.value)}
            className={cn(
              "rule-name h-6 w-24 rounded border bg-background px-1 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring",
              verdictClass(result?.rule),
            )}
          />
        </div>
      </div>

      {messageList}

      <div className="flex items-center justify-center gap-1.5 pb-1 text-[11px]">
        <span className={cn("text-muted-foreground", result?.premises === "invalid" && "text-destructive")}>
          {t("manualBuilder.premiseCount", {count: node.premises.length})}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 hover:bg-accent"
          onClick={() => dispatch(addManualPremise({parentId: node.id, kind: "judgement"}))}
        >
          <Plus className="h-3 w-3"/>{t("manualBuilder.addPremise")}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 hover:bg-accent"
          onClick={() => dispatch(addManualPremise({parentId: node.id, kind: "fact"}))}
        >
          <Plus className="h-3 w-3"/>{t("manualBuilder.addSideCondition")}
        </button>
      </div>
    </div>
  );
});
