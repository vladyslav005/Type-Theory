# tt — an interactive typed lambda calculus playground

[![License: MIT](https://img.shields.io/github/license/vladyslav005/Type-Theory)](LICENSE)
[![npm](https://img.shields.io/npm/v/@vladyslav005/tt-core)](https://www.npmjs.com/package/@vladyslav005/tt-core)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/vladyslav005.tt-vscode-extension)](https://marketplace.visualstudio.com/items?itemName=vladyslav005.tt-vscode-extension)

**Live app: [type-theory.dev](https://type-theory.dev)** /
**[tt-woad.vercel.app](https://tt-woad.vercel.app/)**

**VS Code extension: [Type Theory (tt) on the Marketplace](https://marketplace.visualstudio.com/items?itemName=vladyslav005.tt-vscode-extension)**

**npm package: [@vladyslav005/tt-core](https://www.npmjs.com/package/@vladyslav005/tt-core)**

A web-based environment for writing lambda calculus terms and interactively exploring how they parse,
type-check, evaluate, and correspond to logical proofs — built on a framework-agnostic language engine
([`@vladyslav005/tt-core`](https://www.npmjs.com/package/@vladyslav005/tt-core), published
independently on npm) that also powers a [VS Code extension](apps/vscode-extension) for working with
`.tt` files locally.

## What's implemented today

- **Parser & type checker** for simply-typed lambda calculus plus six optional extensions, toggleable
  independently: let-polymorphism, type inference, iso-recursive types, System F, System Fω, and
  System λP (dependent types).
- **AST visualization** as an interactive node graph, alongside a structural AST editor for building
  terms without writing syntax.
- **Typing derivation (proof) trees** that are always fully constructed, with explicit error nodes
  showing exactly where and why a derivation fails, rather than a plain pass/fail result.
- **Manual proof construction mode** — build a typing derivation yourself, rule by rule, with the
  system validating it against the term as you go.
- **Curry–Howard view** — typing derivations for the plain-STLC fragment can be shown as propositional
  logic proofs instead, with LaTeX/ebproof export.
- **Evaluation** under normal order, call-by-value, or call-by-name, run fully or traced step by step,
  with the active redex highlighted at each step.
- **VS Code extension** ([Marketplace](https://marketplace.visualstudio.com/items?itemName=vladyslav005.tt-vscode-extension),
  source in `apps/vscode-extension`) mirroring the AST/proof-tree/evaluation views as native editor
  panels, plus syntax highlighting, diagnostics, and completions for `.tt` files.

## Structure

This repo is an **npm workspaces monorepo** with three packages:

- [`apps/web`](apps/web) — `@vladyslav005/tt-web`, the React/Vite frontend (the live app above)
- [`apps/vscode-extension`](apps/vscode-extension) — `tt-vscode-extension`, the
  [VS Code extension](https://marketplace.visualstudio.com/items?itemName=vladyslav005.tt-vscode-extension)
  — see its own [README](apps/vscode-extension/README.md) for details
- [`packages/core`](packages/core) — `@vladyslav005/tt-core`, the framework-agnostic language engine
  (parser, type checker, evaluator) that both of the above build on, published independently on
  [npm](https://www.npmjs.com/package/@vladyslav005/tt-core) — see its own
  [README](packages/core/README.md) for the library API and grammar reference

---

*The sections below describe the original design vision this project was built from — some framing is
forward-looking rather than a description of the current build (e.g. §8, generating a term from a
manually-built logical proof, is not yet implemented).*

# Specification and Design of an Interactive Visualization Tool for Typing, Evaluation, and Proofs

## 1. Vision and User-Centered Perspective

The application is designed as an **interactive environment** in which the user can freely choose:

* how a lambda calculus term is introduced,
* what kind of analysis is performed,
* and how the results are explored and visualized.

Rather than enforcing a single workflow, the system supports a **set of orthogonal interaction paths**. A user may simply check whether a term is well-typed, or may deeply engage with the underlying theory by manually constructing proofs, exploring evaluation strategies, or translating between programs and logic via the Curry–Howard correspondence.

At its core, the system treats **typing as proof construction**, **evaluation as interpretation**, and **logic as an alternative semantic view** of the same structure.

---

## 2. Conceptual Model

All user interactions operate on a shared conceptual core:

* Lambda calculus terms
* Abstract syntax trees (AST)
* Typing derivation (proof) trees
* Evaluation semantics
* Logical proof trees

Each of these representations is not independent, but rather a **different view of the same underlying object**.

---

## 3. AST Input Modalities

The system allows multiple ways of defining a lambda calculus term. These modalities are interchangeable and synchronized.

### 3.1 Textual Input

The user enters a lambda calculus expression using a formal textual syntax.

Characteristics:

* Close to textbook notation
* Suitable for experienced users
* Requires parsing and syntax validation

The textual input is automatically transformed into an AST.

---

### 3.2 Structural (AST-Based) Input

The user constructs the term directly as an abstract syntax tree.

Characteristics:

* Tree-based visual editor
* Only syntactically valid terms can be constructed
* Eliminates syntax errors by construction

This mode emphasizes the hierarchical structure of lambda terms.

---

### 3.3 Proof-Derived Input (Optional)

In advanced usage, the term may be implicitly constructed by building a typing or logical proof tree.

Characteristics:

* The proof structure determines the term
* Reinforces the correspondence between terms and proofs

---

## 4. Typing and Proof Tree Generation

### 4.1 Automatic Typing

Given a term and a selected type theory, the system attempts to construct a typing derivation tree.

Key design decisions:

* Typing is modeled as **derivation tree construction**, not as a yes/no check
* The system always produces a tree
* Errors are represented explicitly

---

### 4.2 Partial Proof Trees and Error Representation

If a typing rule cannot be applied, the derivation tree contains an **error node**.

An error node includes:

* The failed judgment
* The rule that was attempted
* A structured explanation of the failure

This allows the user to see how far the derivation progressed and where it failed.

---

## 5. Proof Construction and Proof Validation Mode

### 5.1 Manual Proof Construction

Instead of relying on automatic typing, the user may choose to **manually construct a typing derivation tree**.

Workflow:

1. The user inputs a lambda term
2. The term is fixed and displayed
3. The root typing judgment is generated
4. The user applies typing rules step by step

---

### 5.2 Proof Validation

At any point, the system can validate the constructed proof tree.

The validation process checks:

* Correctness of applied rules
* Consistency of typing contexts
* Alignment between proof structure and term structure
* Type consistency across premises and conclusions
* Completeness of the proof

Incorrect or incomplete nodes are highlighted and explained.

---

## 6. Evaluation (Interpretation) of Terms

### 6.1 Conditional Evaluation

Evaluation is only enabled if the typing derivation is correct.

This reflects the theoretical property of type safety.

---

### 6.2 Evaluation Strategies

The user may choose an evaluation strategy, for example:

* Call-by-name
* Call-by-value
* Normal order

The evaluation process can be:

* Performed fully
* Executed step by step

---

### 6.3 Evaluation Visualization

During evaluation:

* The current redex is highlighted in the AST
* Corresponding typing proof nodes are emphasized
* Intermediate terms are displayed

---

## 7. Curry–Howard Correspondence Integration

### 7.1 Typing Proof to Logical Proof

Using the Curry–Howard correspondence:

* Types are interpreted as propositions
* Typing judgments are interpreted as logical judgments
* Typing derivation trees correspond to proofs in intuitionistic natural deduction

The system can automatically transform a typing derivation tree into a logical proof tree.

---

### 7.2 Logical Proof Tree Visualization

The logical proof tree:

* Preserves the structure of the typing derivation
* Uses logical inference rules instead of typing rules
* Is displayed side by side with the typing proof

Corresponding nodes are visually linked.

---

### 7.3 Errors and Invalid Proofs

If the typing derivation contains error nodes, the corresponding logical proof is incomplete or invalid.

This visually demonstrates that ill-typed programs correspond to invalid proofs.

---

## 8. Logic-Driven Program Construction

In an advanced interaction mode, the user may:

* Manually construct a logical proof tree
* Ask the system to determine whether the proof is valid
* Automatically generate a lambda calculus term corresponding to the proof

This mode demonstrates the correspondence in the reverse direction: **proofs as programs**.

---

## 9. Unified Interaction Flow

From the user perspective, the system supports the following flexible workflow:

1. Input a term (textual or structural)
2. Choose an action:

    * Automatically generate typing proof
    * Manually construct typing proof
3. Inspect or validate the proof tree
4. If typing is correct:

    * Evaluate the term
    * Choose evaluation strategy
5. Convert typing proof to logical proof
6. Explore or construct logical proofs
7. Generate terms from logical proofs

Each step is optional, and the user may return to previous stages at any time.

---
