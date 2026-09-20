import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Button} from "@/shared/components/ui/button.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {EvaluationPractice} from "@/features/evaluation/practice/EvaluationPractice.tsx";
import {TermInput} from "@/features/docs/labs/components/TermInput.tsx";
import {Feedback, Row} from "@/features/docs/labs/components/taskUi.tsx";
import {type Verdict} from "@/features/docs/labs/components/taskStyles.ts";
import {
  decodeChurch,
  equalTerms,
  etaNormal,
  fullyParenthesized,
  labNotation,
  normalize,
  parseLambda,
  printTerm,
  requiredParentheses,
  variableOccurrences,
} from "@/features/docs/labs/lambda/lambdaEngine.ts";

export type LambdaTaskType = "parens" | "scope" | "normal-form" | "church" | "define";

function ParensRow({index, source}: {index: number; source: string}) {
  const {t} = useTranslation();
  const parsed = useMemo(() => parseLambda(source), [source]);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<Verdict>();

  const check = () => {
    if (!parsed.ok) return;
    const typed = parseLambda(value);
    if (!typed.ok) return setVerdict({ok: false, text: t("labWidgets.cannotRead", {detail: typed.message})});
    if (!equalTerms(typed.term, parsed.term)) return setVerdict({ok: false, text: t("labWidgets.parensChanged")});
    const missing = requiredParentheses(parsed.term) - (value.match(/\(/g)?.length ?? 0);
    setVerdict(missing > 0
      ? {ok: false, text: t("labWidgets.parensMissing", {count: missing})}
      : {ok: true, text: t("labWidgets.parensOk")});
  };

  return (
    <Row index={index} source={source} solution={parsed.ok ? <code className="font-mono">{fullyParenthesized(parsed.term)}</code> : parsed.message}>
      <div className="flex flex-wrap items-center gap-2">
        <TermInput value={value} onChange={(next) => { setValue(next); setVerdict(undefined); }} onSubmit={check} placeholder={source}/>
        <Button size="sm" disabled={!value.trim()} onClick={check}>{t("labWidgets.check")}</Button>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

type Mark = "free" | "bound" | undefined;

function ScopeRow({index, source}: {index: number; source: string}) {
  const {t} = useTranslation();
  const parsed = useMemo(() => parseLambda(source), [source]);
  const occurrences = useMemo(() => (parsed.ok ? variableOccurrences(parsed.term) : []), [parsed]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [checked, setChecked] = useState(false);

  const cycle = (i: number) => {
    setChecked(false);
    setMarks((list) => {
      const next = [...list];
      next[i] = list[i] === undefined ? "free" : list[i] === "free" ? "bound" : undefined;
      return next;
    });
  };

  const pieces: (string | number)[] = [];
  let cursor = 0;
  occurrences.forEach((occurrence, i) => {
    pieces.push(source.slice(cursor, occurrence.column), i);
    cursor = occurrence.column + occurrence.length;
  });
  pieces.push(source.slice(cursor));

  const allCorrect = occurrences.every((occurrence, i) => marks[i] === (occurrence.free ? "free" : "bound"));
  const verdict: Verdict = checked
    ? allCorrect ? {ok: true, text: t("labWidgets.correct")} : {ok: false, text: t("labWidgets.scopeWrong")}
    : undefined;

  return (
    <Row
      index={index}
      solution={
        <p className="font-mono">
          {pieces.map((piece, i) => typeof piece === "string"
            ? <span key={i}>{piece}</span>
            : <span key={i} className={occurrences[piece].free ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400"}>{occurrences[piece].name}</span>)}
        </p>
      }
    >
      {!parsed.ok ? <p className="text-xs text-destructive">{parsed.message}</p> : (
        <>
          <div className="flex gap-3 font-mono text-sm">
            <span className="w-6 shrink-0 text-muted-foreground">{`(${index + 1})`}</span>
            <span className="min-w-0 break-words leading-9">
              {pieces.map((piece, i) => {
                if (typeof piece === "string") return <span key={i} className="whitespace-pre">{piece}</span>;
                const mark = marks[piece];
                const correct = mark === (occurrences[piece].free ? "free" : "bound");
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => cycle(piece)}
                    title={t("labWidgets.scopeToggleHint")}
                    className={cn(
                      "mx-px rounded border px-1 font-mono text-sm transition-colors",
                      !mark && "border-dashed text-foreground hover:bg-muted",
                      mark === "free" && "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                      mark === "bound" && "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-400",
                      checked && mark && (correct ? "ring-2 ring-emerald-500/60" : "ring-2 ring-destructive/60"),
                    )}
                  >
                    {occurrences[piece].name}
                  </button>
                );
              })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t("labWidgets.scopeLegend")}</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={marks.filter(Boolean).length === 0} onClick={() => setChecked(true)}>{t("labWidgets.check")}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setMarks([]); setChecked(false); }}>{t("lectureWidgets.reset")}</Button>
          </div>
          <Feedback verdict={verdict}/>
        </>
      )}
    </Row>
  );
}

function NormalFormRow({index, source}: {index: number; source: string}) {
  const {t} = useTranslation();
  const parsed = useMemo(() => parseLambda(source), [source]);
  const normalized = useMemo(() => (parsed.ok ? normalize(parsed.program) : undefined), [parsed]);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<Verdict>();
  const [practice, setPractice] = useState(false);

  const check = () => {
    if (!normalized) return;
    if (normalized.limit) return setVerdict({ok: false, text: t("labWidgets.diverges")});
    const typed = parseLambda(value);
    if (!typed.ok) return setVerdict({ok: false, text: t("labWidgets.cannotRead", {detail: typed.message})});
    const eta = etaNormal(normalized.result);
    setVerdict(equalTerms(typed.term, normalized.result) || equalTerms(typed.term, eta)
      ? {ok: true, text: t("labWidgets.correct")}
      : {ok: false, text: t("labWidgets.tryAgain")});
  };

  const solution = normalized && (
    <div className="space-y-1">
      <p className="font-mono">{printTerm(normalized.result)}</p>
      {!equalTerms(normalized.result, etaNormal(normalized.result)) && (
        <p className="font-mono">{t("labWidgets.afterEta")} {printTerm(etaNormal(normalized.result))}</p>
      )}
    </div>
  );

  return (
    <Row index={index} source={source} solution={parsed.ok ? solution : parsed.message}>
      <div className="flex flex-wrap items-center gap-2">
        <TermInput value={value} onChange={(next) => { setValue(next); setVerdict(undefined); }} onSubmit={check} placeholder={t("labWidgets.normalFormPlaceholder")}/>
        <Button size="sm" disabled={!value.trim()} onClick={check}>{t("labWidgets.check")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setPractice((v) => !v)}>{practice ? t("labWidgets.hideSteps") : t("labWidgets.practiceSteps")}</Button>
      </div>
      <Feedback verdict={verdict}/>
      {practice && normalized && <div className="rounded-lg border bg-background pt-3"><EvaluationPractice key={source} evaluation={normalized.evaluation} typeAliases={{}}/></div>}
    </Row>
  );
}

function ChurchRow({index, source}: {index: number; source: string}) {
  const {t} = useTranslation();
  const parsed = useMemo(() => parseLambda(labNotation(source), true), [source]);
  const normalized = useMemo(() => (parsed.ok ? normalize(parsed.program) : undefined), [parsed]);
  const decoded = useMemo(() => (normalized && !normalized.limit ? decodeChurch(normalized.result) : undefined), [normalized]);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<Verdict>();

  const check = () => {
    if (!normalized) return;
    if (normalized.limit) return setVerdict({ok: false, text: t("labWidgets.diverges")});
    const typed = parseLambda(labNotation(value), true);
    if (!typed.ok) return setVerdict({ok: false, text: t("labWidgets.cannotRead", {detail: typed.message})});
    const typedResult = normalize(typed.program);
    setVerdict(!typedResult.limit && equalTerms(typedResult.result, normalized.result)
      ? {ok: true, text: t("labWidgets.correct")}
      : {ok: false, text: t("labWidgets.tryAgain")});
  };

  return (
    <Row
      index={index}
      source={source}
      solution={normalized && (
        <div className="space-y-1 font-mono">
          {decoded && <p>{decoded}</p>}
          <p className="text-muted-foreground">{printTerm(normalized.result)}</p>
        </div>
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TermInput value={value} onChange={(next) => { setValue(next); setVerdict(undefined); }} onSubmit={check} placeholder={t("labWidgets.churchPlaceholder")} widthClass="w-72"/>
        <Button size="sm" disabled={!value.trim()} onClick={check}>{t("labWidgets.check")}</Button>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

export function DefineTask({tests, solution}: {tests: [string, string][]; solution?: string}) {
  const {t} = useTranslation();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<{call: string; expected: string; ok: boolean}[]>();
  const [error, setError] = useState<string>();

  const run = () => {
    const candidate = parseLambda(labNotation(value), true);
    if (!candidate.ok) {
      setResults(undefined);
      return setError(t("labWidgets.cannotRead", {detail: candidate.message}));
    }
    setError(undefined);
    setResults(tests.map(([args, expected]) => {
      const call = parseLambda(labNotation(`(${value}) ${args}`), true);
      const want = parseLambda(labNotation(expected), true);
      if (!call.ok || !want.ok) return {call: args, expected, ok: false};
      const got = normalize(call.program);
      return {call: args, expected, ok: !got.limit && equalTerms(got.result, normalize(want.program).result)};
    }));
  };

  const passed = results?.filter((r) => r.ok).length ?? 0;

  return (
    <ul className="list-none print:hidden">
      <Row index={0} solution={solution ? <code className="font-mono">{solution}</code> : undefined}>
        <TermInput value={value} onChange={(next) => { setValue(next); setResults(undefined); setError(undefined); }} onSubmit={run} placeholder={t("labWidgets.definePlaceholder")} widthClass="w-full max-w-xl"/>
        <Button size="sm" disabled={!value.trim()} onClick={run}>{t("labWidgets.runTests")}</Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {results && (
          <div className="space-y-1.5">
            <p className={cn("text-xs font-medium", passed === results.length ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
              {t("labWidgets.testsPassed", {passed, total: results.length})}
            </p>
            <ul className="space-y-0.5 font-mono text-xs">
              {results.map((result, i) => (
                <li key={i} className="flex gap-2">
                  <span className={result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{result.ok ? "✓" : "✗"}</span>
                  <span>f {result.call} = {result.expected}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Row>
    </ul>
  );
}

export function LambdaTask({type, terms = [], tests = [], solution}: {type: LambdaTaskType; terms?: string[]; tests?: [string, string][]; solution?: string}) {
  if (type === "define") return <DefineTask tests={tests} solution={solution}/>;
  return (
    <ol className="space-y-3 list-none print:hidden">
      {terms.map((source, index) => {
        switch (type) {
          case "parens": return <ParensRow key={index} index={index} source={source}/>;
          case "scope": return <ScopeRow key={index} index={index} source={source}/>;
          case "normal-form": return <NormalFormRow key={index} index={index} source={source}/>;
          case "church": return <ChurchRow key={index} index={index} source={source}/>;
        }
      })}
    </ol>
  );
}
