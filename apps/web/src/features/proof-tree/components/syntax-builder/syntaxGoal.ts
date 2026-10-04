import type {NblSyntaxNode, SourcePosition, TexTree} from "@vladyslav005/tt-core";

export const NO_RULE = "none";

// The derivation the student is expected to build; `rule` is undefined where no rule applies.
export interface SyntaxGoal {
  key: string;
  tex?: string;
  text?: string;
  // A whole judgement in plain text, e.g. a typing judgement `x:A ⊢ x : A`.
  judgement?: string;
  rule?: string;
  pos?: SourcePosition;
  children: SyntaxGoal[];
}

export type SyntaxChoices = Record<string, string>;

export function goalFromTexTree(tree: TexTree, key = "r"): SyntaxGoal {
  return {
    key,
    tex: tree.judgement,
    rule: tree.error ? undefined : tree.rule,
    pos: tree.pos,
    children: (tree.children ?? []).map((child, i) => goalFromTexTree(child, `${key}.${i}`)),
  };
}

export function goalFromNbl(node: NblSyntaxNode, key = "r"): SyntaxGoal {
  return {
    key,
    text: node.text,
    rule: node.rule,
    children: node.children.map((child, i) => goalFromNbl(child, `${key}.${i}`)),
  };
}

export const expectedChoice = (goal: SyntaxGoal) => goal.rule ?? NO_RULE;

// A node's premises appear only once its rule matches — a wrong rule can't decompose the term.
export const premisesShown = (goal: SyntaxGoal, choices: SyntaxChoices) =>
  goal.rule !== undefined && choices[goal.key] === goal.rule;

export interface SyntaxProgress {
  belongs: boolean;
  unchosen: number;
  wrong: number;
  done: boolean;
}

export function syntaxProgress(goal: SyntaxGoal, choices: SyntaxChoices): SyntaxProgress {
  let unchosen = 0;
  let wrong = 0;
  let foundNoRule = false;
  let belongs = true;
  const walkGoal = (node: SyntaxGoal) => {
    if (node.rule === undefined) belongs = false;
    node.children.forEach(walkGoal);
  };
  const walkVisible = (node: SyntaxGoal) => {
    const choice = choices[node.key];
    if (choice === undefined) unchosen += 1;
    else if (choice !== expectedChoice(node)) wrong += 1;
    else if (choice === NO_RULE) foundNoRule = true;
    if (premisesShown(node, choices)) node.children.forEach(walkVisible);
  };
  walkGoal(goal);
  walkVisible(goal);
  // Outside the language, pointing at one spot where no rule fits is the whole proof.
  const done = wrong === 0 && (belongs ? unchosen === 0 : foundNoRule);
  return {belongs, unchosen, wrong, done};
}

export function withChoice(choices: SyntaxChoices, key: string, rule: string | undefined): SyntaxChoices {
  const next = Object.fromEntries(Object.entries(choices).filter(([k]) => k !== key && !k.startsWith(`${key}.`)));
  return rule === undefined ? next : {...next, [key]: rule};
}
