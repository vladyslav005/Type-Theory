import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {
  isNblValue,
  nblConstants,
  nblDepth,
  nblEquals,
  nblEvaluate,
  nblSize,
  nblStep,
  parseNbl,
  printNbl,
  type NblStep,
  type NblTerm,
} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {TermInput} from "@/features/docs/labs/components/TermInput.tsx";
import {Feedback, Row} from "@/features/docs/labs/components/taskUi.tsx";
import {inputClass, type Verdict} from "@/features/docs/labs/components/taskStyles.ts";
import {useTaskId, useTrackedVerdict} from "@/shared/activity/taskTracking.ts";
import {NblTreeBuilder} from "@/features/docs/labs/components/NblTreeBuilder.tsx";
import {emptySlot, slotToTerm, type Slot} from "@/features/docs/labs/components/nblTreeModel.ts";

export type NblTaskType = "valid" | "tree" | "size" | "depth" | "constants" | "evaluate";

function useInvalidNote(term: NblTerm | undefined, message: string | undefined) {
  const {t} = useTranslation();
  return term ? undefined : t("labWidgets.notInTerm", {detail: message});
}

function ValidRow({id, index, source}: {id?: string; index: number; source: string}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);

  const answer = (belongs: boolean) =>
    setVerdict(belongs === parsed.ok
      ? {ok: true, text: parsed.ok ? t("labWidgets.validYes") : t("labWidgets.validNo", {detail: parsed.message})}
      : {ok: false, text: t("labWidgets.tryAgain")});

  return (
    <Row
      taskId={taskId}
      index={index}
      source={source}
      solution={parsed.ok ? t("labWidgets.validYes") : t("labWidgets.validNo", {detail: parsed.message})}
    >
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => answer(true)}>{t("labWidgets.belongs")}</Button>
        <Button size="sm" variant="outline" onClick={() => answer(false)}>{t("labWidgets.notBelongs")}</Button>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

function NumberRow({id, index, source, metric}: {id?: string; index: number; source: string; metric: "size" | "depth"}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const expected = parsed.ok ? (metric === "size" ? nblSize(parsed.term) : nblDepth(parsed.term)) : undefined;
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const invalid = useInvalidNote(parsed.ok ? parsed.term : undefined, parsed.ok ? undefined : parsed.message);

  const check = () => {
    if (invalid) return setVerdict({ok: false, kind: "notInTerm", text: invalid});
    setVerdict(Number(value.trim()) === expected ? {ok: true, text: t("labWidgets.correct")} : {ok: false, text: t("labWidgets.tryAgain")});
  };

  return (
    <Row taskId={taskId} index={index} source={source} solution={invalid ?? String(expected)}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={value} onChange={(e) => { setValue(e.target.value); setVerdict(undefined); }} onKeyDown={(e) => e.key === "Enter" && check()} className={inputClass} inputMode="numeric" placeholder="0" spellCheck={false}/>
        <Button size="sm" disabled={!value.trim()} onClick={check}>{t("labWidgets.check")}</Button>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

const CONSTANTS = ["0", "true", "false"];
const formatSet = (values: Iterable<string>) => `{${[...values].sort((a, b) => CONSTANTS.indexOf(a) - CONSTANTS.indexOf(b)).join(", ")}}`;

function ConstantsRow({id, index, source}: {id?: string; index: number; source: string}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const expected = parsed.ok ? nblConstants(parsed.term) : undefined;
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const invalid = useInvalidNote(parsed.ok ? parsed.term : undefined, parsed.ok ? undefined : parsed.message);

  const check = () => {
    if (invalid || !expected) return setVerdict({ok: false, kind: "notInTerm", text: invalid ?? ""});
    const items = value.split(/[\s,{}]+/).filter(Boolean);
    const unknown = items.find((item) => !CONSTANTS.includes(item));
    if (unknown) return setVerdict({ok: false, kind: "unknownConstant", text: t("labWidgets.unknownConstant", {name: unknown})});
    const given = new Set(items);
    const same = given.size === expected.size && [...given].every((item) => expected.has(item as "0"));
    setVerdict(same ? {ok: true, text: t("labWidgets.correct")} : {ok: false, text: t("labWidgets.tryAgain")});
  };

  return (
    <Row taskId={taskId} index={index} source={source} solution={invalid ?? formatSet(expected!)}>
      <div className="flex flex-wrap items-center gap-2">
        <TermInput value={value} onChange={(next) => { setValue(next); setVerdict(undefined); }} onSubmit={check} placeholder="{0, true}" widthClass="w-48"/>
        <Button size="sm" disabled={!value.trim()} onClick={check}>{t("labWidgets.check")}</Button>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

function TreeRow({id, index, source}: {id?: string; index: number; source: string}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const [slot, setSlot] = useState<Slot>(emptySlot);
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const invalid = useInvalidNote(parsed.ok ? parsed.term : undefined, parsed.ok ? undefined : parsed.message);

  const check = () => {
    if (!parsed.ok) return setVerdict({ok: false, kind: "notInTerm", text: invalid ?? ""});
    const built = slotToTerm(slot);
    if (!built) return setVerdict({ok: false, kind: "treeIncomplete", text: t("labWidgets.treeIncomplete")});
    setVerdict(nblEquals(built, parsed.term) ? {ok: true, text: t("labWidgets.correct")} : {ok: false, text: t("labWidgets.tryAgain")});
  };

  const outline = (term: NblTerm, depth = 0): string[] => [
    `${"  ".repeat(depth)}${term.kind === "zero" ? "0" : term.kind}`,
    ...(term.kind === "succ" || term.kind === "pred" || term.kind === "iszero"
      ? outline(term.arg, depth + 1)
      : term.kind === "if" ? [term.cond, term.then, term.else].flatMap((child) => outline(child, depth + 1)) : []),
  ];

  return (
    <Row
      taskId={taskId}
      index={index}
      source={source}
      solution={parsed.ok ? <pre className="font-mono">{outline(parsed.term).join("\n")}</pre> : invalid}
    >
      <NblTreeBuilder slot={slot} onChange={(next) => { setSlot(next); setVerdict(undefined); }}/>
      <div className="flex gap-2">
        <Button size="sm" onClick={check}>{t("labWidgets.check")}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setSlot(emptySlot()); setVerdict(undefined); }}>{t("lectureWidgets.reset")}</Button>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

function EvaluateRow({id, index, source}: {id?: string; index: number; source: string}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const [accepted, setAccepted] = useState<NblStep[]>([]);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const [done, setDone] = useState(false);
  const invalid = useInvalidNote(parsed.ok ? parsed.term : undefined, parsed.ok ? undefined : parsed.message);

  const current = parsed.ok ? (accepted.length > 0 ? accepted[accepted.length - 1].term : parsed.term) : undefined;
  const expectedStep = current && nblStep(current);
  const full = parsed.ok ? nblEvaluate(parsed.term) : undefined;

  const submit = () => {
    if (!current) return setVerdict({ok: false, kind: "notInTerm", text: invalid ?? ""});
    if (!expectedStep) return setVerdict({ok: false, kind: "noStepLeft", text: t("labWidgets.noStepLeft")});
    const typed = parseNbl(value);
    if (!typed.ok) return setVerdict({ok: false, kind: "cannotRead", text: t("labWidgets.cannotRead", {detail: typed.message})});
    if (!nblEquals(typed.term, expectedStep.term)) return setVerdict({ok: false, kind: "notNextStep", text: t("labWidgets.notNextStep")});
    setAccepted((list) => [...list, expectedStep]);
    setValue("");
    setVerdict({ok: true, kind: "step", text: t("labWidgets.stepRule", {rule: expectedStep.rule})});
  };

  const finish = (asValue: boolean) => {
    if (!current) return setVerdict({ok: false, kind: "notInTerm", text: invalid ?? ""});
    if (expectedStep) return setVerdict({ok: false, kind: "canStillReduce", text: t("labWidgets.canStillReduce")});
    const actuallyValue = isNblValue(current);
    if (asValue === actuallyValue) {
      setDone(true);
      setVerdict({ok: true, text: actuallyValue ? t("labWidgets.endedValue", {value: printNbl(current)}) : t("labWidgets.endedStuck", {term: printNbl(current)})});
    } else {
      setVerdict({ok: false, kind: "wrongEnding", text: t("labWidgets.tryAgain")});
    }
  };

  const restart = () => { setAccepted([]); setValue(""); setVerdict(undefined); setDone(false); };

  return (
    <Row
      taskId={taskId}
      index={index}
      source={source}
      solution={full && parsed.ok ? (
        <ol className="space-y-0.5 font-mono">
          <li>{printNbl(parsed.term)}</li>
          {full.steps.map((step, i) => (
            <li key={i} className="flex gap-3">→ {printNbl(step.term)} <span className="ml-auto italic text-muted-foreground">{step.rule}</span></li>
          ))}
          <li className="pt-1 font-sans text-muted-foreground">
            {full.status === "value" ? t("labWidgets.endedValue", {value: printNbl(full.result)}) : t("labWidgets.endedStuck", {term: printNbl(full.result)})}
          </li>
        </ol>
      ) : invalid}
    >
      {accepted.length > 0 && (
        <ol className="space-y-0.5 font-mono text-xs">
          {accepted.map((step, i) => (
            <li key={i} className="flex gap-3">→ {printNbl(step.term)} <span className="ml-auto italic text-muted-foreground">{step.rule}</span></li>
          ))}
        </ol>
      )}
      {!done && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <TermInput value={value} onChange={(next) => { setValue(next); setVerdict(undefined); }} onSubmit={submit} placeholder={t("labWidgets.nextStepPlaceholder")}/>
            <Button size="sm" disabled={!value.trim()} onClick={submit}>{t("labWidgets.check")}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => finish(true)}>{t("labWidgets.itIsValue")}</Button>
            <Button size="sm" variant="outline" onClick={() => finish(false)}>{t("labWidgets.itIsStuck")}</Button>
          </div>
        </>
      )}
      {(accepted.length > 0 || done) && <Button size="sm" variant="ghost" onClick={restart}>{t("lectureWidgets.reset")}</Button>}
      <Feedback verdict={verdict}/>
    </Row>
  );
}

export function NblTask({id, type, terms}: {id?: string; type: NblTaskType; terms: string[]}) {
  return (
    <ol className="space-y-3 list-none print:hidden">
      {terms.map((source, index) => {
        switch (type) {
          case "valid": return <ValidRow key={index} id={id} index={index} source={source}/>;
          case "size": return <NumberRow key={index} id={id} index={index} source={source} metric="size"/>;
          case "depth": return <NumberRow key={index} id={id} index={index} source={source} metric="depth"/>;
          case "constants": return <ConstantsRow key={index} id={id} index={index} source={source}/>;
          case "tree": return <TreeRow key={index} id={id} index={index} source={source}/>;
          case "evaluate": return <EvaluateRow key={index} id={id} index={index} source={source}/>;
        }
      })}
    </ol>
  );
}
