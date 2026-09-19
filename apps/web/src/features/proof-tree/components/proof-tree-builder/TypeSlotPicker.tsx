import {useState} from "react";
import {useTranslation} from "react-i18next";
import type {Kind, Term, Type} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {Input} from "@/shared/components/ui/input.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {kindToString, termIndexToString} from "@vladyslav005/tt-core";
import {DEFAULT_TYPE_THEORY_CONFIG, type TypeTheoryConfig} from "@vladyslav005/tt-core";

// A click-only draft of every Type kind the checker can produce as an answer. `null` sub-slots mean
// "not filled in yet" — draftToType returns null until every slot down to the leaves is complete.
export type DraftType =
  | {kind: "base"; name: string}
  | {kind: "arrow"; from: DraftType | null; to: DraftType | null}
  | {kind: "tuple"; elements: (DraftType | null)[]}
  | {kind: "sum"; left: DraftType | null; right: DraftType | null}
  | {kind: "variant"; variants: {label: string; type: DraftType | null}[]}
  | {kind: "record"; fields: {label: string; type: DraftType | null}[]}
  | {kind: "forall"; typeVariable: string; type: DraftType | null}
  | {kind: "list"; elementType: DraftType | null}
  | {kind: "mu"; typeVariable: string; type: DraftType | null}
  | {kind: "tyConstructorAbs"; typeParam: string; paramKind: DraftKind; body: DraftType | null}
  | {kind: "tyConstructorApp"; func: DraftType | null; arg: DraftType | null}
  | {kind: "tyPi"; paramVar: string; paramType: DraftType | null; body: DraftType | null}
  | {kind: "tyIndexApp"; func: DraftType | null; index: string};

// Kinds are simple enough (K ::= * | K -> K) that a draft is never "incomplete" — * is always a
// valid leaf, so there's no null state to track the way DraftType needs one.
export type DraftKind = {kind: "star"} | {kind: "arrow"; from: DraftKind; to: DraftKind};

function firstInferenceVariable(draft: DraftType | null): string | undefined {
  if (!draft) return undefined;
  switch (draft.kind) {
    case "base":
      return draft.name.startsWith("'") ? draft.name : undefined;
    case "arrow":
      return firstInferenceVariable(draft.from) ?? firstInferenceVariable(draft.to);
    case "sum":
      return firstInferenceVariable(draft.left) ?? firstInferenceVariable(draft.right);
    case "tuple":
      return draft.elements.map(firstInferenceVariable).find((v) => v !== undefined);
    case "list":
      return firstInferenceVariable(draft.elementType);
    default:
      return undefined;
  }
}

export const BASE_TYPES = ["Nat", "Bool", "Unit"] as const;

// the checker's own notation for inference variables
const TYPE_VARIABLE_CHIPS = ["'A", "'B", "'C"] as const;

function draftKindToKind(k: DraftKind): Kind {
  if (k.kind === "star") return {kind: "StarKind", id: crypto.randomUUID()};
  return {kind: "KindArrow", id: crypto.randomUUID(), from: draftKindToKind(k.from), to: draftKindToKind(k.to)};
}

// Falls back to * for a dependent kind's Type-valued `from` (e.g. "Nat -> @") — not editable here.
function kindToDraftKind(k: Kind): DraftKind {
  if (k.kind === "StarKind") return {kind: "star"};
  return {
    kind: "arrow",
    from: k.from.kind === "StarKind" || k.from.kind === "KindArrow" ? kindToDraftKind(k.from) : {kind: "star"},
    to: kindToDraftKind(k.to),
  };
}

// Plain-text (not LaTeX) label for a picker chip.
// eslint-disable-next-line react-refresh/only-export-components -- reused outside this component
export function typeLabel(type: Type): string {
  switch (type.kind) {
    case "TyArrow": {
      const from = type.from.kind === "TyArrow" ? `(${typeLabel(type.from)})` : typeLabel(type.from);
      return `${from} → ${typeLabel(type.to)}`;
    }
    case "TyIdentifier":
    case "TyMetaVar":
      return type.name;
    case "TupleType":
      return `⟨${type.elements.map(typeLabel).join(", ")}⟩`;
    case "SumType":
      return `${typeLabel(type.left)} + ${typeLabel(type.right)}`;
    case "VariantType":
      return `[${type.variants.map((v) => `${v.label}:${typeLabel(v.type)}`).join(", ")}]`;
    case "RecordType":
      return `{${type.fields.map((f) => `${f.label}:${typeLabel(f.type)}`).join(", ")}}`;
    case "TyForall":
      return `∀${type.typeVariable}.${typeLabel(type.type)}`;
    case "ListType":
      return `List ${typeLabel(type.elementType)}`;
    case "RecursiveType":
      return `μ${type.typeVariable}.${typeLabel(type.type)}`;
    case "TyConstructorAbs":
      return `λ${type.typeParam}:${kindToString(type.paramKind)}.${typeLabel(type.body)}`;
    case "TyConstructorApp":
      return `${typeLabel(type.func)} ${typeLabel(type.arg)}`;
    case "TyPi":
      return `Π${type.paramVar}:${typeLabel(type.paramType)}.${typeLabel(type.body)}`;
    case "TyIndexApp":
      return `${typeLabel(type.func)}[${termIndexToString(type.arg)}]`;
    default:
      return "?";
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- reused outside this component
export function draftToType(draft: DraftType): Type | null {
  switch (draft.kind) {
    case "base": {
      const name = draft.name.trim();
      if (!name) return null;
      // kept as a real TyMetaVar so it renders like the automatic tree
      return name.startsWith("'")
        ? {kind: "TyMetaVar", id: crypto.randomUUID(), name}
        : {kind: "TyIdentifier", id: crypto.randomUUID(), name};
    }
    case "arrow": {
      if (!draft.from || !draft.to) return null;
      const from = draftToType(draft.from);
      const to = draftToType(draft.to);
      return from && to ? {kind: "TyArrow", id: crypto.randomUUID(), from, to} : null;
    }
    case "tuple": {
      if (draft.elements.length === 0) return null;
      const elements = draft.elements.map((e) => e && draftToType(e));
      return elements.every((e): e is Type => e !== null && e !== undefined)
        ? {kind: "TupleType", id: crypto.randomUUID(), elements}
        : null;
    }
    case "sum": {
      if (!draft.left || !draft.right) return null;
      const left = draftToType(draft.left);
      const right = draftToType(draft.right);
      return left && right ? {kind: "SumType", id: crypto.randomUUID(), left, right} : null;
    }
    case "variant": {
      if (draft.variants.length === 0) return null;
      const variants: {label: string; type: Type}[] = [];
      for (const v of draft.variants) {
        const t = v.label.trim() && v.type ? draftToType(v.type) : null;
        if (!t) return null;
        variants.push({label: v.label.trim(), type: t});
      }
      return {kind: "VariantType", id: crypto.randomUUID(), variants};
    }
    case "record": {
      if (draft.fields.length === 0) return null;
      const fields: {label: string; type: Type}[] = [];
      for (const f of draft.fields) {
        const t = f.label.trim() && f.type ? draftToType(f.type) : null;
        if (!t) return null;
        fields.push({label: f.label.trim(), type: t});
      }
      return {kind: "RecordType", id: crypto.randomUUID(), fields};
    }
    case "forall": {
      if (!draft.typeVariable.trim() || !draft.type) return null;
      const body = draftToType(draft.type);
      return body ? {kind: "TyForall", id: crypto.randomUUID(), typeVariable: draft.typeVariable.trim(), type: body} : null;
    }
    case "list": {
      if (!draft.elementType) return null;
      const elementType = draftToType(draft.elementType);
      return elementType ? {kind: "ListType", id: crypto.randomUUID(), elementType} : null;
    }
    case "mu": {
      if (!draft.typeVariable.trim() || !draft.type) return null;
      const body = draftToType(draft.type);
      return body ? {kind: "RecursiveType", id: crypto.randomUUID(), typeVariable: draft.typeVariable.trim(), type: body} : null;
    }
    case "tyConstructorAbs": {
      if (!draft.typeParam.trim() || !draft.body) return null;
      const body = draftToType(draft.body);
      return body
        ? {kind: "TyConstructorAbs", id: crypto.randomUUID(), typeParam: draft.typeParam.trim(), paramKind: draftKindToKind(draft.paramKind), body}
        : null;
    }
    case "tyConstructorApp": {
      if (!draft.func || !draft.arg) return null;
      const func = draftToType(draft.func);
      const arg = draftToType(draft.arg);
      return func && arg ? {kind: "TyConstructorApp", id: crypto.randomUUID(), func, arg} : null;
    }
    case "tyPi": {
      if (!draft.paramVar.trim() || !draft.paramType || !draft.body) return null;
      const paramType = draftToType(draft.paramType);
      const body = draftToType(draft.body);
      return paramType && body ? {kind: "TyPi", id: crypto.randomUUID(), paramVar: draft.paramVar.trim(), paramType, body} : null;
    }
    case "tyIndexApp": {
      const indexName = draft.index.trim();
      if (!draft.func || !indexName) return null;
      const func = draftToType(draft.func);
      if (!func) return null;
      const arg: Term = /^\d+$/.test(indexName)
        ? {kind: "Lit", id: crypto.randomUUID(), value: indexName}
        : {kind: "Var", id: crypto.randomUUID(), name: indexName};
      return {kind: "TyIndexApp", id: crypto.randomUUID(), func, arg};
    }
  }
}

// Reopens the picker pre-filled with an existing value.
// eslint-disable-next-line react-refresh/only-export-components -- reused outside this component
export function typeToDraft(type: Type): DraftType {
  switch (type.kind) {
    case "TyArrow":
      return {kind: "arrow", from: typeToDraft(type.from), to: typeToDraft(type.to)};
    case "TyIdentifier":
    case "TyMetaVar":
      return {kind: "base", name: type.name};
    case "TupleType":
      return {kind: "tuple", elements: type.elements.map(typeToDraft)};
    case "SumType":
      return {kind: "sum", left: typeToDraft(type.left), right: typeToDraft(type.right)};
    case "VariantType":
      return {kind: "variant", variants: type.variants.map((v) => ({label: v.label, type: typeToDraft(v.type)}))};
    case "RecordType":
      return {kind: "record", fields: type.fields.map((f) => ({label: f.label, type: typeToDraft(f.type)}))};
    case "TyForall":
      return {kind: "forall", typeVariable: type.typeVariable, type: typeToDraft(type.type)};
    case "ListType":
      return {kind: "list", elementType: typeToDraft(type.elementType)};
    case "RecursiveType":
      return {kind: "mu", typeVariable: type.typeVariable, type: typeToDraft(type.type)};
    case "TyConstructorAbs":
      return {kind: "tyConstructorAbs", typeParam: type.typeParam, paramKind: kindToDraftKind(type.paramKind), body: typeToDraft(type.body)};
    case "TyConstructorApp":
      return {kind: "tyConstructorApp", func: typeToDraft(type.func), arg: typeToDraft(type.arg)};
    case "TyPi":
      return {kind: "tyPi", paramVar: type.paramVar, paramType: typeToDraft(type.paramType), body: typeToDraft(type.body)};
    case "TyIndexApp":
      return {kind: "tyIndexApp", func: typeToDraft(type.func), index: termIndexToString(type.arg)};
    default:
      // Unknown/unsupported kind (e.g. a stray TyMetaVar) — fall back to an empty slot.
      return {kind: "base", name: ""};
  }
}

function KindSlotPicker({value, onChange}: { value: DraftKind; onChange: (next: DraftKind) => void }) {
  const {t} = useTranslation();
  if (value.kind === "star") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className="font-mono text-xs px-1.5 py-0.5 rounded border border-primary/40 bg-primary/5">*</span>
        <button
          type="button"
          onClick={() => onChange({kind: "arrow", from: {kind: "star"}, to: {kind: "star"}})}
          title={t("proofBuilder.turnIntoKindArrow")}
          className="font-mono text-xs px-1 rounded border border-dashed border-muted-foreground/40 hover:bg-accent"
        >
          →
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <KindSlotPicker value={value.from} onChange={(next) => onChange({...value, from: next})}/>
      <span className="text-muted-foreground text-xs">→</span>
      <KindSlotPicker value={value.to} onChange={(next) => onChange({...value, to: next})}/>
    </span>
  );
}

interface TypeSlotPickerProps {
  value: DraftType | null;
  onChange: (next: DraftType | null) => void;
  // Quick-pick chips for types already in scope.
  contextTypes?: Type[];
  // Only the outermost slot shows "wrap in arrow" — nested from/to slots don't.
  topLevel?: boolean;
  // Gates which compound-type buttons are offered — matches STLCTypeChecker's own theory checks.
  enabledTheories?: TypeTheoryConfig;
}

export function TypeSlotPicker({value, onChange, contextTypes = [], topLevel = true, enabledTheories = DEFAULT_TYPE_THEORY_CONFIG}: TypeSlotPickerProps) {
  const {t} = useTranslation();
  // System F keeps plain names, so it opts out of the ' notation
  const forcesVariableNotation = (enabledTheories.letPolymorphism || enabledTheories.typeInference) && !enabledTheories.systemF;
  const asVariable = (name: string) => (forcesVariableNotation && name && !name.startsWith("'") ? `'${name}` : name);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");

  if (value === null) {
    return (
      <div className="flex flex-wrap items-center gap-1 max-w-80 p-1.5 rounded-md border border-dashed border-muted-foreground/30">
        {contextTypes.length > 0 && (
          <>
            <span className="w-full text-[10px] uppercase tracking-wide text-muted-foreground">{t("proofBuilder.fromContext")}</span>
            {contextTypes.map((t, i) => (
              <Button
                key={i}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs font-mono"
                onClick={() => onChange(typeToDraft(t))}
              >
                {typeLabel(t)}
              </Button>
            ))}
            <span className="w-full h-px bg-border my-0.5"/>
          </>
        )}
        {BASE_TYPES.map((name) => (
          <Button
            key={name}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs font-mono"
            onClick={() => onChange({kind: "base", name})}
          >
            {name}
          </Button>
        ))}
        {(enabledTheories.letPolymorphism || enabledTheories.typeInference || enabledTheories.systemF) && (
          <>
            <span className="w-full text-[10px] uppercase tracking-wide text-muted-foreground">{t("proofBuilder.typeVariables")}</span>
            {TYPE_VARIABLE_CHIPS.map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs font-mono italic"
                onClick={() => onChange({kind: "base", name})}
              >
                {name}
              </Button>
            ))}
          </>
        )}
        {customOpen ? (
          <span className="inline-flex items-center gap-1">
            <Input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customName.trim()) {
                  e.preventDefault();
                  onChange({kind: "base", name: asVariable(customName.trim())});
                  setCustomName("");
                  setCustomOpen(false);
                }
              }}
              placeholder="T"
              className="h-7 w-16 text-xs font-mono px-1"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={!customName.trim()}
              onClick={() => {
                onChange({kind: "base", name: asVariable(customName.trim())});
                setCustomName("");
                setCustomOpen(false);
              }}
            >
              ✓
            </Button>
          </span>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setCustomOpen(true)}>
            custom…
          </Button>
        )}
        <span className="w-full h-px bg-border my-0.5"/>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "arrow", from: null, to: null})}>
          →
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "sum", left: null, right: null})}>
          +
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "tuple", elements: [null, null]})}>
          ⟨,⟩
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "variant", variants: [{label: "", type: null}]})}>
          [l:]
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "record", fields: [{label: "", type: null}]})}>
          {"{l:}"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "list", elementType: null})}>
          List
        </Button>
        {(enabledTheories.systemF || enabledTheories.letPolymorphism) && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "forall", typeVariable: "", type: null})}>
            ∀
          </Button>
        )}
        {enabledTheories.isoRecursiveTypes && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "mu", typeVariable: "", type: null})}>
            μ
          </Button>
        )}
        {enabledTheories.systemFOmega && (
          <>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "tyConstructorAbs", typeParam: "", paramKind: {kind: "star"}, body: null})}>
              λX:K
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "tyConstructorApp", func: null, arg: null})}>
              F T
            </Button>
          </>
        )}
        {enabledTheories.systemLambdaP && (
          <>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "tyPi", paramVar: "", paramType: null, body: null})}>
              Π
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs font-mono" onClick={() => onChange({kind: "tyIndexApp", func: null, index: ""})}>
              F[i]
            </Button>
          </>
        )}
      </div>
    );
  }

  // Wraps the current draft as the left side of a new arrow, keeping it instead of discarding it.
  const wrapInArrow = () => onChange({kind: "arrow", from: value, to: null});
  const isComplete = draftToType(value) !== null;

  const canQuantify = enabledTheories.systemF || enabledTheories.letPolymorphism;
  const wrapInForall = () => onChange({kind: "forall", typeVariable: firstInferenceVariable(value) ?? "", type: value});

  const wrapButton = topLevel && isComplete && (
    <>
      {canQuantify && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={wrapInForall}
          className="h-7 px-2 text-xs font-mono gap-0.5 shrink-0"
          title={t("proofBuilder.wrapInForall")}
        >
          ∀
        </Button>
      )}
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={wrapInArrow}
      className="h-7 px-2 text-xs font-mono gap-0.5 shrink-0"
      title={t("proofBuilder.turnIntoArrow")}
    >
      →
    </Button>
    </>
  );

  const clearButton = (
    <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive text-xs px-1" title="Clear">
      ✕
    </button>
  );

  if (value.kind === "base") {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "font-mono text-xs px-2 py-1 rounded-md border transition-colors",
            value.name
              ? "border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60"
              : "border-dashed border-muted-foreground/40 text-muted-foreground italic hover:bg-accent",
          )}
          title={t("proofBuilder.clickToChange")}
        >
          {value.name || "(empty)"}
        </button>
        {wrapButton}
      </span>
    );
  }

  const nested = (v: DraftType | null, onChangeNested: (next: DraftType | null) => void) => (
    <TypeSlotPicker value={v} onChange={onChangeNested} contextTypes={contextTypes} topLevel={false} enabledTheories={enabledTheories}/>
  );

  const container = (content: React.ReactNode) => (
    <div
      className={cn(
        "flex items-center gap-1.5 flex-wrap",
        topLevel && isComplete && "px-1.5 py-1 rounded-md border border-primary/30 bg-primary/5",
      )}
    >
      {content}
      {clearButton}
      {wrapButton}
    </div>
  );

  switch (value.kind) {
    case "arrow":
      return container(
        <>
          {nested(value.from, (next) => onChange({...value, from: next}))}
          <span className="text-muted-foreground text-xs">→</span>
          {nested(value.to, (next) => onChange({...value, to: next}))}
        </>,
      );

    case "sum":
      return container(
        <>
          {nested(value.left, (next) => onChange({...value, left: next}))}
          <span className="text-muted-foreground text-xs">+</span>
          {nested(value.right, (next) => onChange({...value, right: next}))}
        </>,
      );

    case "tuple":
      return container(
        <>
          <span className="text-muted-foreground text-xs">⟨</span>
          {value.elements.map((el, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              {i > 0 && <span className="text-muted-foreground text-xs">,</span>}
              {nested(el, (next) => onChange({...value, elements: value.elements.map((e, j) => (j === i ? next : e))}))}
              <button type="button" className="text-muted-foreground hover:text-destructive text-[10px]" onClick={() => onChange({...value, elements: value.elements.filter((_, j) => j !== i)})}>✕</button>
            </span>
          ))}
          <span className="text-muted-foreground text-xs">⟩</span>
          <button type="button" className="text-xs px-1 rounded border border-dashed hover:bg-accent" onClick={() => onChange({...value, elements: [...value.elements, null]})}>+</button>
        </>,
      );

    case "variant":
    case "record": {
      const isVariant = value.kind === "variant";
      const items = isVariant ? value.variants : value.fields;
      const setItems = (next: {label: string; type: DraftType | null}[]) =>
        onChange(isVariant ? {...value, variants: next} : {...value, fields: next});
      return container(
        <>
          <span className="text-muted-foreground text-xs">{isVariant ? "[" : "{"}</span>
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              {i > 0 && <span className="text-muted-foreground text-xs">,</span>}
              <Input
                value={item.label}
                onChange={(e) => setItems(items.map((it, j) => (j === i ? {...it, label: e.target.value} : it)))}
                placeholder={t("proofBuilder.labelPlaceholder")}
                className="h-6 w-14 text-xs font-mono px-1"
              />
              <span className="text-muted-foreground text-xs">:</span>
              {nested(item.type, (next) => setItems(items.map((it, j) => (j === i ? {...it, type: next} : it))))}
              <button type="button" className="text-muted-foreground hover:text-destructive text-[10px]" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
          <span className="text-muted-foreground text-xs">{isVariant ? "]" : "}"}</span>
          <button type="button" className="text-xs px-1 rounded border border-dashed hover:bg-accent" onClick={() => setItems([...items, {label: "", type: null}])}>+</button>
        </>,
      );
    }

    case "list":
      return container(
        <>
          <span className="text-muted-foreground text-xs font-mono">List</span>
          {nested(value.elementType, (next) => onChange({...value, elementType: next}))}
        </>,
      );

    case "forall":
    case "mu": {
      const isForall = value.kind === "forall";
      return container(
        <>
          <span className="text-muted-foreground text-xs">{isForall ? "∀" : "μ"}</span>
          <Input
            value={value.typeVariable}
            onChange={(e) => onChange({...value, typeVariable: isForall ? asVariable(e.target.value.trim()) : e.target.value} as DraftType)}
            placeholder="X"
            className="h-6 w-10 text-xs font-mono px-1"
          />
          <span className="text-muted-foreground text-xs">.</span>
          {nested(value.type, (next) => onChange({...value, type: next} as DraftType))}
        </>,
      );
    }

    case "tyConstructorAbs":
      return container(
        <>
          <span className="text-muted-foreground text-xs">λ</span>
          <Input
            value={value.typeParam}
            onChange={(e) => onChange({...value, typeParam: e.target.value})}
            placeholder="X"
            className="h-6 w-10 text-xs font-mono px-1"
          />
          <span className="text-muted-foreground text-xs">:</span>
          <KindSlotPicker value={value.paramKind} onChange={(next) => onChange({...value, paramKind: next})}/>
          <span className="text-muted-foreground text-xs">.</span>
          {nested(value.body, (next) => onChange({...value, body: next}))}
        </>,
      );

    case "tyConstructorApp":
      return container(
        <>
          {nested(value.func, (next) => onChange({...value, func: next}))}
          {nested(value.arg, (next) => onChange({...value, arg: next}))}
        </>,
      );

    case "tyPi":
      return container(
        <>
          <span className="text-muted-foreground text-xs">Π</span>
          <Input
            value={value.paramVar}
            onChange={(e) => onChange({...value, paramVar: e.target.value})}
            placeholder="x"
            className="h-6 w-10 text-xs font-mono px-1"
          />
          <span className="text-muted-foreground text-xs">:</span>
          {nested(value.paramType, (next) => onChange({...value, paramType: next}))}
          <span className="text-muted-foreground text-xs">.</span>
          {nested(value.body, (next) => onChange({...value, body: next}))}
        </>,
      );

    case "tyIndexApp":
      return container(
        <>
          {nested(value.func, (next) => onChange({...value, func: next}))}
          <span className="text-muted-foreground text-xs">[</span>
          <Input
            value={value.index}
            onChange={(e) => onChange({...value, index: e.target.value})}
            placeholder="n"
            className="h-6 w-10 text-xs font-mono px-1"
          />
          <span className="text-muted-foreground text-xs">]</span>
        </>,
      );
  }
}
