// Γ, typing judgements, constraint sets and the manual builder's definitions (Γ_1 = {x : 'A}, C_2 = {…}).
export const JUDGEMENT_LANGUAGE_ID = "tt-judgement";

const BASE_TYPES = ["Nat", "Bool", "Unit", "String"];

// What the completions offer beyond known names; a lab narrows it to the types and forms it needs.
export interface JudgementVocabulary {
  baseTypes?: string[];
  // The let-polymorphism forms: instantiate, generalize, ∀ schemes.
  schemes?: boolean;
}

// Set by the manual builder: Γ_n / C_n it has definitions for and the term's variable names.
let knownNames: string[] = [];
let vocabulary: Required<JudgementVocabulary> = {baseTypes: BASE_TYPES, schemes: true};

export function setJudgementNames(names: string[], options: JudgementVocabulary = {}): void {
  knownNames = names;
  vocabulary = {baseTypes: options.baseTypes ?? BASE_TYPES, schemes: options.schemes ?? true};
}

const SYMBOLS: [string, string, string][] = [
  ["\\emptyset", "∅", "Empty set"],
  ["\\in", "∈", "Element of"],
  ["\\cup", "∪", "Union"],
  ["\\setminus", "∖", "Set difference"],
  ["\\vdash", "⊢", "Turnstile"],
  ["\\Gamma", "Γ", "Context"],
  ["\\forall", "∀", "Forall"],
  ["\\lambda", "λ", "Lambda"],
  ["\\to", "→", "Arrow"],
];

export function setUpJudgementLanguage(monaco: any, lambda: {keywords: string[]; tokenizer: {root: unknown[]}}): void {
  monaco.languages.register({id: JUDGEMENT_LANGUAGE_ID});
  monaco.languages.setMonarchTokensProvider(JUDGEMENT_LANGUAGE_ID, {
    keywords: lambda.keywords,
    tokenizer: {
      root: [
        [/\b(instantiate|generali[sz]e)\b/, "keyword"],
        [/(Γ|C)(_\{?\d+\}?|[₀-₉]+)?(?![\w'])/, "contextName"],
        [/'[A-Za-z]\w*/, "typeVar"],
        [/[∅∪∖∈⊢∣|−]/, "setOp"],
        [/-(?!>)/, "setOp"],
        [/[{}]/, "lb"],
        [/,/, "dot"],
        ...lambda.tokenizer.root,
      ],
      whitespace: [[/[ \t\r\n]+/, "white"]],
    },
  });
  monaco.languages.setLanguageConfiguration(JUDGEMENT_LANGUAGE_ID, {
    brackets: [["{", "}"], ["(", ")"]],
    autoClosingPairs: [{open: "{", close: "}"}, {open: "(", close: ")"}],
  });

  monaco.languages.registerCompletionItemProvider(JUDGEMENT_LANGUAGE_ID, {
    triggerCharacters: ["\\"],
    provideCompletionItems: (model: any, position: any) => {
      const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const slash = /\\[A-Za-z]*$/.exec(line);
      if (slash) {
        const range = new monaco.Range(position.lineNumber, position.column - slash[0].length, position.lineNumber, position.column);
        return {
          suggestions: SYMBOLS.map(([label, insertText, detail]) => ({
            label, insertText, detail, range, kind: monaco.languages.CompletionItemKind.Operator,
          })),
        };
      }
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const gamma = knownNames.find((name) => name.startsWith("Γ")) ?? "Γ";
      const snippet = (label: string, insertText: string, detail: string) => ({
        label, insertText, detail, range,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: "0",
      });
      const snippets = [
        ...(vocabulary.schemes ? [snippet("instantiate", `instantiate(\${1:x} : \${2:S} ∈ \${3:${gamma}})`, "instantiate(x : S ∈ Γ)")] : []),
        ...(vocabulary.schemes ? [snippet("generalize", `generalize(\${1:T}, \${2:${gamma}}) = \${3:S}`, "generalize(T, Γ) = S")] : []),
        snippet("in", `\${1:x} : \${2:T} ∈ \${3:${gamma}}`, "x : T ∈ Γ"),
        ...(vocabulary.schemes ? [snippet("forall", "∀'${1:A}. ${2:T}", "∀'A. T — a type scheme")] : []),
      ];
      const inBuffer = model.getValue().match(/[A-Za-zΓ][\w']*/g) ?? [];
      const names = [...new Set([...knownNames, ...vocabulary.baseTypes, ...inBuffer])].filter((name) => name !== word.word);
      return {
        suggestions: [...snippets, ...names.map((name) => ({
          label: name,
          insertText: name,
          range,
          kind: /^(Γ|C)(_|$)/.test(name)
            ? monaco.languages.CompletionItemKind.Constant
            : vocabulary.baseTypes.includes(name) ? monaco.languages.CompletionItemKind.Class : monaco.languages.CompletionItemKind.Variable,
        }))],
      };
    },
  });
}
