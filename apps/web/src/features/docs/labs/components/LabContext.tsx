import {useTranslation} from "react-i18next";
import {PRELUDE_CODE} from "@/features/editor/components/InsertPreludeButton.tsx";
import {Tip} from "@/shared/components/Tip.tsx";

// Shown in lab notation: the engine's tru/fls are what students write as true/false.
const toLabNotation = (text: string) => text.replace(/\btru\b/g, "true").replace(/\bfls\b/g, "false");

// Read from the prelude itself, so the list always matches what the task's checker has in scope.
const DEFINITIONS = PRELUDE_CODE.split("\n")
  .map((line) => line.replace(/\/\/.*$/, "").trim())
  .map((line) => line.match(/^(\w+)\s*=\s*(.+?);$/))
  .filter((match): match is RegExpMatchArray => match !== null)
  .map(([, name, body]) => ({name: toLabNotation(name), body: toLabNotation(body)}));

export function LabContext({onInsert}: {onInsert: (name: string) => void}) {
  const {t} = useTranslation();
  return (
    <details className="text-[11px]">
      <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
        {t("labWidgets.contextTitle")}
      </summary>
      <div className="mt-1 max-h-40 overflow-y-auto rounded-md border bg-muted/20 px-2 py-1 font-mono leading-snug">
        {DEFINITIONS.map(({name, body}) => (
          <div key={name} className="flex gap-1.5 whitespace-nowrap">
            <Tip label={t("evalPractice.insertName", {name})}>
              <button type="button" className="font-semibold hover:underline" onClick={() => onInsert(name)}>{name}</button>
            </Tip>
            <span className="text-muted-foreground">= {body}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

// Appends a name to an answer, keeping one space between tokens.
// eslint-disable-next-line react-refresh/only-export-components -- tiny helper shared with the task rows
export const appendName = (value: string, name: string) => (value && !/[\s(]$/.test(value) ? `${value} ${name}` : `${value}${name}`);
