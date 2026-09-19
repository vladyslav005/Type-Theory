# @vladyslav005/tt-core

[![npm](https://img.shields.io/npm/v/@vladyslav005/tt-core)](https://www.npmjs.com/package/@vladyslav005/tt-core)
[![License: MIT](https://img.shields.io/github/license/vladyslav005/Type-Theory)](LICENSE)

A pure TypeScript engine for a typed lambda calculus: parser, type checker (STLC + optional
extensions), evaluator, proof-tree generator, and LaTeX/pretty-printer output. No React, no DOM,
no side effects — usable from Node, a browser, or any other JS runtime.

## Install

```bash
npm install @vladyslav005/tt-core
```

## Quick start

```typescript
import {
  AntlrParserAdapter,
  SLTLCTypeChecker,
  Evaluator,
  EvaluationStrategy,
  TexMapper,
  astToText,
  typeToString,
} from "@vladyslav005/tt-core";

const source = `
a : T;
identity = λ x : T . x : T -> T;
identity a;
`;

// 1. Parse — throws ParseSyntaxError on invalid syntax.
const parser = new AntlrParserAdapter();
const program = parser.parseExpression(source);

// 2. Type-check — takes the whole Program (declarations + final term).
const checker = new SLTLCTypeChecker();
const proof = checker.check(program);

console.log(typeToString(proof.type));      // "T"
console.log(checker.getErrors());           // [] — empty when well-typed

// 3. Evaluate — also takes the whole Program, so global decls are in scope.
const evaluator = new Evaluator();
const result = evaluator.evaluate(program, EvaluationStrategy.CALL_BY_VALUE);

console.log(astToText({ ...program, term: result.result })); // "a;"
console.log(result.steps.length);                             // 2

// 4. Render the typing derivation (e.g. for LaTeX/UI rendering).
const texTree = new TexMapper().visit(proof);
console.log(texTree.judgement); // "\Gamma_{1} \vdash (identity\ a) : T"
```

## Language guide

For an interactive syntax reference, guided lectures, and worked examples, see the web app:
**[type-theory.dev](https://type-theory.dev)** / **[tt-woad.vercel.app](https://tt-woad.vercel.app/)**.
What follows here is the terse BNF reference for library consumers.

The parser (ANTLR4, grammar in [`src/antlr/Lambda.g4`](./src/antlr/Lambda.g4)) accepts a program
as zero or more global declarations followed by an optional final term:

```
program    ::= declaration* (term ';')?

declaration
           ::= ID ':' type ';'                  (* declare a free variable's type *)
             | ID '=' term ':' type ';'          (* define a global value, with its type *)
             | 'typedef' ID '=' type ';'         (* transparent type alias *)
             | 'typedef' ID ':' kind ';'         (* opaque type constructor *)
```

Note the declaration order is `name = term : type`, not `name : type = term`.

### Terms

```
term ::= ID                                       (* variable *)
       | 'λ' ID ':' type '.' term                 (* abstraction *)
       | 'λ' ID '.' term                           (* unannotated abstraction — needs inference *)
       | 'λ' '_' ':' type '.' term                 (* dummy abstraction, discards its argument *)
       | term term                                 (* application *)
       | term ('+'|'-'|'*'|'/') term                (* arithmetic *)
       | term ('<'|'<='|'>'|'>='|'=='|'!=') term    (* comparison *)
       | 'if' term 'then' term ('elseif' term 'then' term)* ('else' term)?
       | 'let' ID '=' term 'in' term
       | term 'as' type                            (* ascription *)
       | term ';' term                             (* sequencing *)
       | term '.' NAT | term '.' ID                (* tuple / record projection *)
       | '<' term (',' term)* '>'                  (* tuple *)
       | '<' ID '=' term (',' ID '=' term)* '>'     (* record *)
       | '[' ID '=' term (',' ID '=' term)* ']' 'as' type   (* labeled variant *)
       | 'inl' term 'as' type | 'inr' term 'as' type
       | 'case' term '||' 'inl' ID '=>' term '||' 'inr' ID '=>' term
       | 'case' term 'of' '[' ID '=' ID ']' '=>' term ('||' '[' ID '=' ID ']' '=>' term)*
       | 'fix' term
       | 'nil' '[' type ']' | 'cons' '[' type ']' term term
       | 'isnil' '[' type ']' term | 'head' '[' type ']' term | 'tail' '[' type ']' term
       | 'fold' '[' type ']' term | 'unfold' '[' type ']' term
       | true | True | false | False | unit | Unit | NAT | STRING       (* "..." double-quoted, \-escaped *)
       | '(' term ')'
```

### Types

```
type ::= ID | 'Nat' | 'Bool' | 'Unit' | 'String'
       | type '->' type                            (* right-associative *)
       | type '+' type                              (* sum type *)
       | '<' type ('*' type)* '>'                    (* tuple type *)
       | '[' ID ':' type (',' ID ':' type)* ']'      (* variant type *)
       | '(' type ')'
```

Arrows write as `->` or `→`; lambda as `λ` or `\`; `Λ`, `∀`, `Π`, `μ`, `@` are used by the
extensions below.

### Comments

`// line comment` — no block comments.

### Optional type theories

The Terms/Types grammar above is the always-on STLC core. Six more theories add further syntax —
System F's `ΛX. t`/`t [T]`, `∀X. T`; System Fω's `λX:K. T`/`F T` and kinds; System λP's `Π x:A. B`
and dependent kinds; iso-recursive `μX.T`/`fold`/`unfold` — summarized by example below rather than
spelled out in full BNF here; see [`src/antlr/Lambda.g4`](./src/antlr/Lambda.g4) for the complete
grammar including every extension. The parser accepts all of it unconditionally (grammar doesn't
know about theory flags); `SLTLCTypeChecker#setTheories` is what actually gates which constructs
type-check successfully:

| Theory | Unlocks | Example |
| --- | --- | --- |
| `typeInference` | Omitting a lambda's parameter type — inferred from usage | `(λ x . x) 5;` |
| `letPolymorphism` | Generalizing a `let`-bound value so it's reusable at different types | `let id = λ x . x in <(id 5), (id true)>;` |
| `isoRecursiveTypes` | Self-referential types via `μX.T`, introduced/eliminated with `fold`/`unfold` | `typedef NatRec = μX.[zero:Unit, succ:X];` |
| `systemF` | Explicit polymorphism: type abstraction `ΛX. t` and application `t [T]` | `id = ΛX. λ x : X . x : ∀X. X -> X;` |
| `systemFOmega` | Types abstracted over types: `λX:K. T`, applied as `F T`, classified by kinds (`K ::= @ \| K→K`) | `typedef Id = λ X : @ . X;` |
| `systemLambdaP` | Types depending on terms via `Π x:A. B`, and kinds indexed by a type (`K ::= @ \| T→K`) | `typedef Vec : Nat -> @;` |

`setTheories` takes a full `TypeTheoryConfig` (all six flags); `DEFAULT_TYPE_THEORY_CONFIG` has
everything off. `TYPE_THEORIES` exports the same table above as data (id, label, description) if
you're building a UI toggle for it.

## API reference

### Parsing

```typescript
class AntlrParserAdapter implements Parser {
  parseExpression(input: string): Program; // throws ParseSyntaxError on invalid syntax
}

class ParseSyntaxError extends Error {
  errors: { line: number; column: number; length: number; message: string }[];
}
```

### Type checking

```typescript
class SLTLCTypeChecker {
  check(program: Program): InferProofTree;       // full derivation tree, error nodes included
  getErrors(): Error[];                            // every TypeCheckError collected during check()
  setTheories(theories: TypeTheoryConfig): void;    // enable extensions, see table above
  getTypeAliases(): { [name: string]: Type };       // resolved `typedef X = T;` bindings
}

interface ProofTree {
  rule: Rule;                                // e.g. Rule.Var, Rule.Abs, Rule.App, ...
  premises: ProofTree[];
  term: Term;
  type: Type;
  gamma: Record<string, Type | TypeScheme>;   // the typing context at this node
  error?: string;                             // set on this node if it failed to type
}
```

A failed program still returns a full tree — errors live on the specific node(s) that failed,
and `getErrors()` collects them all in one place.

### Evaluation

```typescript
enum EvaluationStrategy { NORMAL, CALL_BY_VALUE, CALL_BY_NAME }

class Evaluator {
  constructor(maximumSteps?: number); // default 500
  evaluate(program: Program, strategy: EvaluationStrategy): EvaluationResult;
}

interface EvaluationResult {
  result: Term;                        // final term (normal form, or stuck/limited)
  steps: ReductionStep[];              // one entry per reduction, with before/after
  reachedStepLimit: boolean;
  errors?: { message: string; stuckTermId?: string }[];
  globals: Record<string, Term>;
}
```

### Pretty printing

```typescript
function astToText(program: Program): string;

class AstPrettyPrinter {
  printProgram(program: Program): string;
  printTerm(term: Term): string;
  printType(type: Type): string;
}
```

Output always re-parses with `AntlrParserAdapter` — useful for round-tripping an AST you built or
edited programmatically back into source.

### Proof-tree rendering (LaTeX / UI)

```typescript
class TexMapper {
  visit(proof: ProofTree): TexTree;              // typing derivation → renderable tree
}

class LogicMapper {
  visit(proof: ProofTree): TexTree;              // Curry–Howard: typing proof → logical proof
  // throws NonStlcProofError if the proof uses anything beyond plain STLC
}

function texTreeToEbproofDocument(tree: TexTree, opts: { expandedKeys: ReadonlySet<string> }): string;
```

`isPlainStlc(theories: TypeTheoryConfig): boolean` (from the domain layer) tells you up front
whether `LogicMapper` will accept a given proof. `GammaRegistry` is the shared Γ-numbering helper
`TexMapper`/`LogicMapper` use internally — exported for anyone building a custom renderer on the
same `ProofTree`.

### Type utilities

```typescript
function typeToString(t: Type): string;
function kindToString(k: Kind): string;
function typeEquals(a: Type, b: Type): boolean;
function normalizeType(t: Type): Type;
function expandTypeAliases(t: Type, aliases: ReadonlyMap<string, Type>): Type;
function termIndexEquals(a: Term, b: Term): boolean;   // structural identity, ignoring IDs
function termIndexToString(t: Term): string;
```

### AST types

`Program`, `Term`, `Type`, `Kind`, and `GlobalDecl` are all exported as discriminated unions —
every node carries a `kind` field plus a `pos?: SourcePosition`:

```typescript
interface Program { globals: GlobalDecl[]; term?: Term; }

type GlobalDecl = VarDecl | FunDecl | TypeAliasDecl | TypeConstructorDecl;

type Term = Var | Abs | App | Lit | IfCondition | Let | BinOp | Ascribe
  | Tuple | TupleProjection | Record | RecordProjection | Sequencing
  | Variant | VariantCase | Inl | Inr | Case | DummyAbstraction
  | TypeAbs | TypeApp | Fix | Nil | Cons | IsNil | Head | Tail | Fold | Unfold;

type Type = TyIdentifier | TyArrow | TupleType | SumType | VariantType | RecordType
  | TyForall | TyConstructorAbs | TyConstructorApp | TyPi | TyIndexApp
  | ListType | RecursiveType;
```

The full field list per variant is in the shipped `.d.ts` — every extension's node shape lives
right next to the plain-STLC ones (e.g. `TyPi` for System λP, `TyConstructorAbs` for System Fω).

### Visitors

`AstVisitor<R>` and `ProofTreeVisitor<R>` are the abstract base classes the checker, evaluator,
and every mapper above are built on — each requires one `visitX` method per node/rule variant (30+
for terms, one per `Rule` for proofs). Extend them directly if you need a custom traversal over
either tree; for anything less than a full traversal, work with the plain `Term`/`Type`/`ProofTree`
data instead.

## Error handling

```typescript
import { ParseSyntaxError } from "@vladyslav005/tt-core";

try {
  parser.parseExpression(source);
} catch (e) {
  if (e instanceof ParseSyntaxError) {
    e.errors.forEach(({ line, column, message }) =>
      console.log(`${line}:${column} — ${message}`));
  }
}
```

```typescript
const proof = checker.check(program);
if (proof.error) console.log("Top-level:", proof.error);
checker.getErrors().forEach((err) => console.log(err.message));
```

## Building & regenerating the grammar

```bash
npm run build         # tsup -> dist/{index.js, index.cjs, index.d.ts}
npm run gen-grammar    # regenerate src/antlr/* from src/antlr/Lambda.g4
```

## Related

- **Source**: [github.com/vladyslav005/Type-Theory/tree/main/packages/core](https://github.com/vladyslav005/Type-Theory/tree/main/packages/core)
- **Main project**: [tt](https://github.com/vladyslav005/Type-Theory) — the interactive web UI built on this library
- **Live demo**: [type-theory.dev](https://type-theory.dev) / [tt-woad.vercel.app](https://tt-woad.vercel.app/)
- **NPM**: [npmjs.com/package/@vladyslav005/tt-core](https://www.npmjs.com/package/@vladyslav005/tt-core)
