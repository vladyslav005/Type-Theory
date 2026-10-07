import {memo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Plus, X} from "lucide-react";
import type {ManualField, ManualNode, ManualNodeResult, ManualVerdict} from "@/shared/ui-state/manualProof.ts";
import {useManualActions} from "@/features/proof-tree/manual/manualActions.ts";
import {cn} from "@/shared/lib/utils.ts";
import {LabEditor} from "@/features/docs/labs/components/LabEditor.tsx";
import {JUDGEMENT_LANGUAGE_ID} from "@/features/editor/hooks/judgementLanguage.ts";
import {useUndoableText} from "@/shared/hooks/useUndoableText.ts";
import {NodeFeedback} from "@/features/proof-tree/feedback/NodeFeedback.tsx";
import "@/features/proof-tree/components/proof-tree-using-css/ProofTree.css";
import {Tip} from "@/shared/components/Tip.tsx";

const verdictClass = (verdict: ManualVerdict | undefined) =>
  verdict === "valid"
    ? "border-emerald-500/70 bg-emerald-500/5"
    : verdict === "invalid"
      ? "border-destructive/70 bg-destructive/5"
      : "border-input";

interface FieldProps {
  value: string;
  placeholder: string;
  hint?: string;
  width: string;
  verdict?: ManualVerdict;
  readOnly?: boolean;
  onChange: (value: string) => void;
}

// A plain button until clicked: one Monaco editor at a time stays cheap however big the tree gets.
function Field({value, placeholder, hint: title, width, verdict, readOnly, onChange}: FieldProps) {
  const [editing, setEditing] = useState(false);
  if (editing && !readOnly) {
    return (
      <div className="shrink-0">
        <LabEditor
          minWidth={width}
          compact
          dense
          autoFocus
          suggestWhileTyping
          detachWidgets
          language={JUDGEMENT_LANGUAGE_ID}
          value={value}
          onChange={onChange}
          onSubmit={() => setEditing(false)}
          onBlur={() => setEditing(false)}
          placeholder={placeholder}
          className={cn("bg-background", verdictClass(verdict))}
        />
      </div>
    );
  }
  if (readOnly) {
    return (
      <Tip label={title}>
        <span
          style={{minWidth: width}}
          className={cn(
            "manual-readonly flex h-7 shrink-0 items-center whitespace-nowrap rounded border bg-background px-1.5 font-mono text-xs select-text cursor-text opacity-80",
            verdictClass(verdict),
          )}
        >
          {value || placeholder}
        </span>
      </Tip>
    );
  }
  return (
    <Tip label={title}>
      <button
        type="button"
        style={{minWidth: width}}
        onClick={() => setEditing(true)}
        onFocus={() => setEditing(true)}
        className={cn(
          "h-7 shrink-0 whitespace-nowrap rounded border bg-background px-1.5 text-left font-mono text-xs outline-none focus:ring-1 focus:ring-ring",
          verdictClass(verdict),
          !value && "text-muted-foreground",
          "cursor-text",
        )}
      >
        {value || placeholder}
      </button>
    </Tip>
  );
}

function RuleInput({value, placeholder, verdict, onChange}: {value: string; placeholder: string; verdict?: ManualVerdict; onChange: (value: string) => void}) {
  const history = useUndoableText(value, onChange);
  // Zero-size anchor like the automatic tree's .rule-name: the input sits right of the inference line, centred on it.
  return (
    <div className="relative h-0 w-0 self-start">
      <input
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => history.change(e.target.value)}
        onKeyDown={history.onKeyDown}
        className={cn(
          "absolute left-1.5 top-0 h-7 w-28 -translate-y-1/2 rounded border bg-background px-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring",
          verdictClass(verdict),
        )}
      />
    </div>
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
  const actions = useManualActions();
  const result = results[node.id];
  const constraintsShown = usesConstraints && (node.constraintsShown ?? true);
  const set = (field: ManualField) => (value: string) => actions.setField(node.id, field, value);

  const isLeaf = node.premises.length === 0;
  const rootClass = root ? "root" : "not-root";
  const leafClass = isLeaf ? "leaf-node" : "not-leaf-node";

  const removeButton = !root && (
    <Tip label={t("manualBuilder.removePremise")}>
      <button
        type="button"
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        onClick={() => actions.removePremise(node.id)}
      >
        <X className="h-3 w-3"/>
      </button>
    </Tip>
  );

  const messages = result?.messages ?? [];
  const messageList = (
    <NodeFeedback messages={messages.map((m) => m.code.startsWith("feedback.") ? m : {...m, code: `manualBuilder.msg.${m.code}`})}/>
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
              <Field value={node.constraints} placeholder="C" hint={t("manualBuilder.constraintsPlaceholder")} width="9rem" verdict={result?.constraints} onChange={set("constraints")}/>
              <Tip label={t("manualBuilder.removeConstraints")}>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  onClick={() => actions.setConstraintsShown(node.id, false)}
                >
                  <X className="h-3 w-3"/>
                </button>
              </Tip>
            </>
          ) : usesConstraints && (
            <Tip label={t("manualBuilder.addConstraints")}>
              <button
                type="button"
                className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-mono hover:bg-accent"
                onClick={() => actions.setConstraintsShown(node.id, true)}
              >
                + C
              </button>
            </Tip>
          )}
          {removeButton}
        </div>
        <div className="conclusion-right">
          <RuleInput
            value={node.rule}
            placeholder={t("manualBuilder.rulePlaceholder")}
            verdict={result?.rule}
            onChange={set("rule")}
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
          onClick={() => actions.addPremise(node.id, "judgement")}
        >
          <Plus className="h-3 w-3"/>{t("manualBuilder.addPremise")}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 hover:bg-accent"
          onClick={() => actions.addPremise(node.id, "fact")}
        >
          <Plus className="h-3 w-3"/>{t("manualBuilder.addSideCondition")}
        </button>
      </div>
    </div>
  );
});
