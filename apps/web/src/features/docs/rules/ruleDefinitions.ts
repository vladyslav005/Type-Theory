// Uses the same TeX conventions as the app's proof tree renderer — see TexMapper.kindProofTex.
export interface RuleDefinition {
  id: string;
  premisesTex: string[];
  conclusionTex: string;
  description: string;
  // Long premises/conclusions cramp in a narrow grid column — let these span two.
  wide?: boolean;
}

export interface RuleGroup {
  id: string;
  title: string;
  note?: string;
  rules: RuleDefinition[];
}

// Grouped to mirror the lecture order, not the checker's internal Rule enum.
export const TYPE_RULE_GROUPS: RuleGroup[] = [
  {
    id: "stlc",
    title: "Simply Typed Lambda Calculus (STLC)",
    rules: [
      {
        id: "T-Var",
        premisesTex: ["x : T \\in \\Gamma"],
        conclusionTex: "\\Gamma \\vdash x : T",
        description: "A variable's type is whatever the context says it is.",
      },
      {
        id: "T-Abs",
        premisesTex: ["\\Gamma, x{:}T_1 \\vdash t_2 : T_2"],
        conclusionTex: "\\Gamma \\vdash \\lambda x{:}T_1.\\, t_2 : T_1 \\to T_2",
        description: "Check the body with the parameter added to the context; the result is a function type.",
      },
      {
        id: "T-Wildcard",
        premisesTex: ["\\Gamma \\vdash t_2 : T_2"],
        conclusionTex: "\\Gamma \\vdash \\lambda \\_ {:} T_1.\\, t_2 : T_1 \\to T_2",
        description: "A wildcard parameter is never bound — the body is checked in the unchanged context, unlike T-Abs.",
      },
      {
        id: "T-App",
        premisesTex: ["\\Gamma \\vdash t_1 : T_1 \\to T_2", "\\Gamma \\vdash t_2 : T_1"],
        conclusionTex: "\\Gamma \\vdash t_1\\ t_2 : T_2",
        description: "The function's argument type must match the argument's actual type.",
      },
      // {
      //   id: "T-Const",
      //   premisesTex: [],
      //   conclusionTex: "\\Gamma \\vdash c : \\mathit{type\\text{-}of}(c)",
      //   description: "Numerals are Nat, true/false are Bool, unit is Unit — no premises needed.",
      // },
      {
        id: "T-If",
        premisesTex: ["\\Gamma \\vdash t_1 : \\text{Bool}", "\\Gamma \\vdash t_2 : T", "\\Gamma \\vdash t_3 : T"],
        conclusionTex: "\\Gamma \\vdash \\text{if}\\ t_1\\ \\text{then}\\ t_2\\ \\text{else}\\ t_3 : T",
        description: "Both branches must agree on a single result type.",
        wide: true,
      },
      // {
      //   id: "T-BinOp",
      //   premisesTex: ["\\Gamma \\vdash t_1 : \\text{Nat}", "\\Gamma \\vdash t_2 : \\text{Nat}"],
      //   conclusionTex: "\\Gamma \\vdash t_1\\ \\mathit{op}\\ t_2 : \\text{Nat}\\ (\\text{or}\\ \\text{Bool})",
      //   description: "+ - * / produce Nat; < > <= >= == != produce Bool.",
      // },
      {
        id: "T-Let",
        premisesTex: ["\\Gamma \\vdash t_1 : T_1", "\\Gamma, x{:}T_1 \\vdash t_2 : T_2"],
        conclusionTex: "\\Gamma \\vdash \\text{let}\\ x = t_1\\ \\text{in}\\ t_2 : T_2",
        description: "Monomorphic let — x gets exactly one type, reused in the body.",
        wide: true,
      },
      {
        id: "T-Ascribe",
        premisesTex: ["\\Gamma \\vdash t : T"],
        conclusionTex: "\\Gamma \\vdash (t\\ \\text{as}\\ T) : T",
        description: "States the type explicitly; the checker still verifies it.",
      },
      {
        id: "T-Seq",
        premisesTex: ["\\Gamma \\vdash t_1 : \\text{Unit}", "\\Gamma \\vdash t_2 : T_2"],
        conclusionTex: "\\Gamma \\vdash t_1 ; t_2 : T_2",
        description: "t1 runs for its effect and must be Unit-typed; the result is t2's type.",
      },
    ],
  },
  {
    id: "curry-howard",
    title: "Curry–Howard Correspondence",
    note: "The exact same derivation as STLC typing, relabeled as natural-deduction logic — a term is a proof, its type is the proposition it proves.",
    rules: [
      {
        id: "Ax",
        premisesTex: ["\\varphi \\in \\Gamma"],
        conclusionTex: "\\Gamma \\vdash \\varphi",
        description: "A hypothesis already in context proves itself — the logical reading of T-Var.",
      },
      {
        id: "⇒I",
        premisesTex: ["\\Gamma, \\varphi \\vdash \\psi"],
        conclusionTex: "\\Gamma \\vdash \\varphi \\Rightarrow \\psi",
        description: "Implication introduction — the logical reading of T-Abs.",
      },
      {
        id: "⇒E",
        premisesTex: ["\\Gamma \\vdash \\varphi \\Rightarrow \\psi", "\\Gamma \\vdash \\varphi"],
        conclusionTex: "\\Gamma \\vdash \\psi",
        description: "Modus ponens — the logical reading of T-App.",
      },
      {
        id: "∧I",
        premisesTex: ["\\Gamma \\vdash \\varphi", "\\Gamma \\vdash \\psi"],
        conclusionTex: "\\Gamma \\vdash \\varphi \\wedge \\psi",
        description: "Conjunction introduction — the logical reading of tuple construction.",
      },
      {
        id: "∨I",
        premisesTex: ["\\Gamma \\vdash \\varphi"],
        conclusionTex: "\\Gamma \\vdash \\varphi \\vee \\psi",
        description: "Disjunction introduction — the logical reading of inl/inr.",
      },
    ],
  },
  {
    id: "data-types",
    title: "Data Types",
    rules: [
      {
        id: "T-Inl",
        premisesTex: ["\\Gamma \\vdash t_1 : T_1"],
        conclusionTex: "\\Gamma \\vdash \\text{inl}\\ t_1\\ \\text{as}\\ T_1{+}T_2 : T_1+T_2",
        description: "Inject into the left of a sum type; the ascription pins down the right side.",
      },
      {
        id: "T-Inr",
        premisesTex: ["\\Gamma \\vdash t_1 : T_2"],
        conclusionTex: "\\Gamma \\vdash \\text{inr}\\ t_1\\ \\text{as}\\ T_1{+}T_2 : T_1+T_2",
        description: "Inject into the right of a sum type; the ascription pins down the left side.",
      },
      {
        id: "T-Case",
        premisesTex: ["\\Gamma \\vdash t_0 : T_1{+}T_2", "\\Gamma, x_1{:}T_1 \\vdash t_1 : T", "\\Gamma, x_2{:}T_2 \\vdash t_2 : T"],
        conclusionTex: "\\Gamma \\vdash \\text{case}\\ t_0\\ \\text{of}\\ \\text{inl}\\ x_1{\\Rightarrow}t_1\\ |\\ \\text{inr}\\ x_2{\\Rightarrow}t_2 : T",
        description: "Both branches must agree on a result type, just like T-If.",
        wide: true,
      },
      {
        id: "T-Tuple",
        premisesTex: ["\\text{for each } i", "\\Gamma \\vdash t_i : T_i"],
        conclusionTex: "\\Gamma \\vdash \\langle t_i{}^{\\,i \\in 1..n} \\rangle : \\langle T_i{}^{\\,i \\in 1..n} \\rangle",
        description: "Every component is checked independently; the result type collects the component types positionally.",
        wide: true,
      },
      {
        id: "T-Proj",
        premisesTex: ["\\Gamma \\vdash t : \\langle T_i{}^{\\,i \\in 1..n} \\rangle"],
        conclusionTex: "\\Gamma \\vdash t.j : T_j",
        description: "Projection looks up the j-th component's already-known type.",
        wide: true,
      },
      {
        id: "T-Record",
        premisesTex: ["\\text{for each } i", "\\Gamma \\vdash t_i : T_i"],
        conclusionTex: "\\Gamma \\vdash \\langle \\mathit{lab}_i = t_i{}^{\\,i \\in 1..n} \\rangle : \\langle \\mathit{lab}_i : T_i{}^{\\,i \\in 1..n} \\rangle",
        description: "Same as T-Tuple, but components are collected by label instead of position.",
        wide: true,
      },
      {
        id: "T-RecordProj",
        premisesTex: ["\\Gamma \\vdash t : \\langle \\mathit{lab}_i : T_i{}^{\\,i \\in 1..n} \\rangle"],
        conclusionTex: "\\Gamma \\vdash t.\\mathit{lab}_j : T_j",
        description: "Field access looks up the label's already-known type.",
        wide: true,
      },
      {
        id: "T-Variant",
        premisesTex: ["\\Gamma \\vdash t_j : T_j"],
        conclusionTex: "\\Gamma \\vdash [\\mathit{lab}_j = t_j]\\ \\text{as}\\ [\\mathit{lab}_i : T_i{}^{\\,i \\in 1..n}] : [\\mathit{lab}_i : T_i{}^{\\,i \\in 1..n}]",
        description: "Inject a term under one label; the ascription fixes the full variant type. The n-ary generalization of T-Inl / T-Inr.",
        wide: true,
      },
      {
        id: "T-VariantCase",
        premisesTex: ["\\Gamma \\vdash t_0 : [\\mathit{lab}_i : T_i{}^{\\,i \\in 1..n}]", "\\Gamma, x_i {:} T_i \\vdash t_i : T"],
        conclusionTex: "\\Gamma \\vdash \\text{case}\\ t_0\\ \\text{of}\\ [\\mathit{lab}_i = x_i] \\Rightarrow t_i{}^{\\,i \\in 1..n} : T",
        description: "One branch per label, each binding x_i : T_i; every branch must agree on the result type T. The lecture calls this T-case.",
        wide: true,
      },
      {
        id: "T-Nil",
        premisesTex: [""],
        conclusionTex: "\\Gamma \\vdash \\text{nil}[T] : \\text{List}\\ T",
        description: "The empty list of a chosen element type — no premises.",
      },
      {
        id: "T-Cons",
        premisesTex: ["\\Gamma \\vdash t_1 : T", "\\Gamma \\vdash t_2 : \\text{List}\\ T"],
        conclusionTex: "\\Gamma \\vdash \\text{cons}[T]\\ t_1\\ t_2 : \\text{List}\\ T",
        description: "Prepend one element t1 to a list t2 of the same element type.",
        wide: true,
      },
      {
        id: "T-IsNil",
        premisesTex: ["\\Gamma \\vdash t_1 : \\text{List}\\ T"],
        conclusionTex: "\\Gamma \\vdash \\text{isnil}[T]\\ t_1 : \\text{Bool}",
        description: "Tests whether a list is empty.",
      },
      {
        id: "T-Head",
        premisesTex: ["\\Gamma \\vdash t_1 : \\text{List}\\ T"],
        conclusionTex: "\\Gamma \\vdash \\text{head}[T]\\ t_1 : T",
        description: "The first element of a list.",
      },
      {
        id: "T-Tail",
        premisesTex: ["\\Gamma \\vdash t_1 : \\text{List}\\ T"],
        conclusionTex: "\\Gamma \\vdash \\text{tail}[T]\\ t_1 : \\text{List}\\ T",
        description: "The list without its first element.",
      },
    ],
  },
  {
    id: "iso-recursive",
    title: "Iso-recursive Types (μ)",
    note: "μX.T and its one-step unfolding [X ↦ μX.T]T are isomorphic, not equal — fold/unfold are the two directions of that isomorphism, made explicit as terms.",
    rules: [
      {
        id: "T-Fold",
        premisesTex: ["\\Gamma \\vdash t : [X \\mapsto \\mu X. T]\\, T"],
        conclusionTex: "\\Gamma \\vdash \\text{fold}[\\mu X. T]\\ t : \\mu X. T",
        description: "Roll an unfolded value up into the recursive type.",
      },
      {
        id: "T-Unfold",
        premisesTex: ["\\Gamma \\vdash t : \\mu X. T"],
        conclusionTex: "\\Gamma \\vdash \\text{unfold}[\\mu X. T]\\ t : [X \\mapsto \\mu X. T]\\, T",
        description: "Unroll a recursive value by one layer to inspect it.",
        wide: false,
      },
    ],
  },
  {
    id: "recursion",
    title: "Recursion (fix)",
    rules: [
      {
        id: "T-Fix",
        premisesTex: ["\\Gamma \\vdash t_1 : T \\to T"],
        conclusionTex: "\\Gamma \\vdash \\text{fix}\\ t_1 : T",
        description: "fix ties the recursive knot without the function needing to refer to its own name.",
        wide: true
      },
    ],
  },
  {
    id: "let-polymorphism",
    title: "Let-polymorphism & Type Inference",
    note: "With this theory on, the checker switches to constraint judgements Γ ⊢ t : T | C — each rule collects equations C to be solved later by unification. Watch for these CT-* rules in the Proof Tree.",
    rules: [
      {
        id: "CT-Abs",
        premisesTex: ["\\Gamma, x{:}T_1 \\vdash t : T_2 \\mid C"],
        conclusionTex: "\\Gamma \\vdash \\lambda x{:}T_1.\\, t : T_1 \\to T_2 \\mid C",
        description: "Annotated lambda — the constraint set just passes through from the body.",
        wide: true,
      },
      {
        id: "CT-AbsInf",
        premisesTex: ["\\Gamma, x{:}X \\vdash t : T \\mid C"],
        conclusionTex: "\\Gamma \\vdash \\lambda x.\\, t : X \\to T \\mid C",
        description: "Unannotated lambda — the parameter gets a fresh type variable X for unification to pin down.",
        wide: true,
      },
      {
        id: "CT-App",
        premisesTex: ["\\Gamma \\vdash t_1 : T_1 \\mid C_1", "\\Gamma \\vdash t_2 : T_2 \\mid C_2"],
        conclusionTex: "\\Gamma \\vdash t_1\\ t_2 : X \\mid C = C_1 \\cup C_2 \\cup \\{T_1 = T_2 \\to X\\}",
        description: "Fresh X for the result, plus the constraint that the function's type is T_2 → X.",
        wide: true,
      },
      {
        id: "CT-If",
        premisesTex: ["\\Gamma \\vdash t_1 : T_1 \\mid C_1", "\\Gamma \\vdash t_2 : T_2 \\mid C_2", "\\Gamma \\vdash t_3 : T_3 \\mid C_3"],
        conclusionTex: "\\Gamma \\vdash \\text{if}\\ t_1\\ \\text{then}\\ t_2\\ \\text{else}\\ t_3 : T_2 \\mid C = C_1 \\cup C_2 \\cup C_3 \\cup \\{T_1 = \\text{Bool},\\, T_2 = T_3\\}",
        description: "Constrain the condition to Bool and both branches to the same type.",
        wide: true,
      },
    ],
  },
  {
    id: "system-f",
    title: "System F",
    rules: [
      {
        id: "T-TAbs",
        premisesTex: ["\\Gamma \\vdash t : T", "X \\notin \\Gamma"],
        conclusionTex: "\\Gamma \\vdash \\Lambda X.\\, t : \\forall X. T",
        description: "Abstract over a type variable — X must be genuinely fresh, not already constrained by the context.",
        wide: false,
      },
      {
        id: "T-TApp",
        premisesTex: ["\\Gamma \\vdash t : \\forall X. T_2"],
        conclusionTex: "\\Gamma \\vdash t\\,[T_1] : [X \\mapsto T_1]\\, T_2",
        description: "Instantiate a polymorphic term at a chosen type, explicitly — unlike let-polymorphism, always written out.",
      },
    ],
  },
  {
    id: "system-f-omega",
    title: "System Fω — Kinding",
    note: "Kinds classify types the way types classify terms. @ (\"star\") is the kind of ordinary types; □ (\"box\") is the sort of kinds. The lecture presents Fω as a Pure Type System — one Γ ⊢ A : B judgement across all levels — so its Abst / Appl rules are exactly K-Abs / K-App read at the kind level.",
    rules: [
      {
        id: "K-Base",
        premisesTex: [""],
        conclusionTex: "\\Gamma \\vdash T : @",
        description: "Nat, Bool, Unit, and any type variable of kind @ are already well-kinded.",
      },
      {
        id: "K-Form",
        premisesTex: ["\\Gamma \\vdash T_1 : @", "\\Gamma \\vdash T_2 : @"],
        conclusionTex: "\\Gamma \\vdash T_1 \\to T_2 : @",
        description: "Arrow (and sum/tuple/etc.) types are well-kinded when both sides are.",
      },
      {
        id: "K-Abs",
        premisesTex: ["\\Gamma, X{:}K_1 \\vdash T_2 : K_2", "\\Gamma \\vdash K_1 \\to K_2 : \\square"],
        conclusionTex: "\\Gamma \\vdash \\lambda X{:}K_1.\\, T_2 : K_1 \\to K_2",
        description: "The lecture's Abst rule at the kind level — check the body with X:K_1 in context, and check the resulting arrow kind is well-formed.",
        wide: true,
      },
      {
        id: "K-App",
        premisesTex: ["\\Gamma \\vdash T_1 : K_1 \\to K_2", "\\Gamma \\vdash T_2 : K_1"],
        conclusionTex: "\\Gamma \\vdash T_1\\ T_2 : K_2",
        description: "The lecture's Appl rule at the kind level — apply a type constructor of kind K_1 → K_2 to a type argument of kind K_1.",
        wide: true,
      },
    ],
  },
  {
    id: "system-lambda-p",
    title: "System λP (Dependent Types)",
    note: "The result type of a Π-typed function may mention the argument itself — that's what makes it dependent.",
    rules: [
      {
        id: "K-Pi",
        premisesTex: ["\\Gamma \\vdash A : @", "\\Gamma, x{:}A \\vdash B : @"],
        conclusionTex: "\\Gamma \\vdash \\Pi x{:}A.\\, B : @",
        description: "A dependent function type is well-kinded when its result kind stays @ with x bound to A.",
        wide: true,
      },
      {
        id: "T-PiApp",
        premisesTex: ["\\Gamma \\vdash t_1 : \\Pi x{:}A.\\, B", "\\Gamma \\vdash t_2 : A"],
        conclusionTex: "\\Gamma \\vdash t_1\\ t_2 : [x \\mapsto t_2]\\, B",
        description: "Unlike plain T-App, the argument gets substituted into the *result type*, not just consumed.",
        wide: true,
      },
      {
        id: "K-IndexApp",
        premisesTex: ["\\Gamma \\vdash F : (A \\to K)", "\\Gamma \\vdash t : A"],
        conclusionTex: "\\Gamma \\vdash F[t] : [x \\mapsto t]\\, K",
        description: "Indexing a term-parameterized type family (e.g. Vec[n]) by an actual term.",
        wide: true,
      },
      {
        id: "Conv",
        premisesTex: ["\\Gamma \\vdash t : T", "\\Gamma \\vdash T' : @", "T \\equiv_\\beta T'"],
        conclusionTex: "\\Gamma \\vdash t : T'",
        description: "The rule that makes dependent typing work: if two well-formed types are β-equal (e.g. Vec[2+1] ≡ Vec[3]), a term of one also has the other.",
        wide: true,
      },
    ],
  },
];

// Mirrors TYPE_RULE_GROUPS' topics; congruence rules (E-App1-style) get one shared card, not one each.
export const EVALUATION_RULE_GROUPS: RuleGroup[] = [
  {
    id: "stlc-eval",
    title: "Simply Typed Lambda Calculus (STLC)",
    note: "One rule fires per reduction step — the Evaluation panel shows this sequence with the strategy of your choice.",
    rules: [
      {
        id: "E-Abs",
        premisesTex: [""],
        conclusionTex: "(\\lambda x{:}T.\\, t)\\ v \\to [x \\mapsto v]\\, t",
        description: "β-reduction — the redex at the heart of the whole calculus: substitute the argument into the body.",
        wide: false,
      },
      {
        id: "E-wildcard",
        premisesTex: [""],
        conclusionTex: "(\\lambda \\_ : T_1. t_1) v_2 \\to t_1",
        description: "",
        wide: false,
      },
      {
        id: "E-App1",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "t_1\\ t_2 \\to t_1'\\ t_2",
        description: "Reduce the function position first — the general congruence pattern every other multi-subterm construct follows too.",
      },
      {
        id: "E-App2",
        premisesTex: ["v_1\\ \\text{is a value}", "t_2 \\to t_2'"],
        conclusionTex: "v_1\\ t_2 \\to v_1\\ t_2'",
        description: "Once the function is a value, reduce the argument.",
      },
      {
        id: "E-IfTrue",
        premisesTex: [""],
        conclusionTex: "\\text{if}\\ \\text{true}\\ \\text{then}\\ t_2\\ \\text{else}\\ t_3 \\to t_2",
        description: "The condition must reduce to a boolean value before either branch is taken.",
        wide: false,
      },
      {
        id: "E-IfFalse",
        premisesTex: [""],
        conclusionTex: "\\text{if}\\ \\text{false}\\ \\text{then}\\ t_2\\ \\text{else}\\ t_3 \\to t_3",
        description: "The condition must reduce to a boolean value before either branch is taken.",
        wide: false,
      },
      {
        id: "E-If",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "\\text{if}\\ t_1 \\ \\text{then}\\ t_2\\ \\text{else}\\ t_3 \\to \\text{if}\\ t_1' \\ \\text{then}\\ t_2\\ \\text{else}\\ t_3",
        description: "The condition must reduce to a boolean value before either branch is taken.",
        wide: true,
      },
      // {
      //   id: "E-BinOp",
      //   premisesTex: ["n_1, n_2\\ \\text{are numerals}"],
      //   conclusionTex: "n_1\\ \\mathit{op}\\ n_2 \\to \\mathit{result}",
      //   description: "Once both sides are values, arithmetic/comparison actually computes.",
      // },
      {
        id: "E-Let",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "\\text{let}\\ x = t_1\\ \\text{in}\\ t_2 \\to \\text{let}\\ x = t_1'\\ \\text{in}\\ t_2",
        description: "Once the bound expression is a value, substitute it into the body — same shape as β-reduction.",
        wide: false,
      },
      {
        id: "E-LetV",
        premisesTex: [""],
        conclusionTex: "\\text{let}\\ x = v_1\\ \\text{in}\\ t_2 \\to [x \\mapsto v_1]\\, t_2",
        description: "Once the bound expression is a value, substitute it into the body — same shape as β-reduction.",
        wide: false,
      },
      {
        id: "E-Seq",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "t_1;t_2 \\to t_1';t_2",
        description: "Once t1 reduces to unit, sequencing just drops it and continues with t2.",
      },
      {
        id: "E-SeqNext",
        premisesTex: ["" ],
        conclusionTex: "\\text{unit} ; t_2 \\to t_2",
        description: "Once t1 reduces to unit, sequencing just drops it and continues with t2.",
      },
      {
        id: "E-Ascribe",
        premisesTex: [""],
        conclusionTex: "v_1\\ \\text{as}\\ T \\to v_1",
        description: "Ascription only guided the checker — at runtime it's a no-op once the term is a value.",
      },
      {
        id: "E-Ascribe1",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "t_1\\ \\text{as}\\ T \\to t_1' \\text{as}\\ T",
        description: "Ascription only guided the checker — at runtime it's a no-op once the term is a value.",
      },
    ],
  },
  {
    id: "data-types-eval",
    title: "Data Types",
    rules: [
      {
        id: "E-ProjTuple",
        premisesTex: [""],
        conclusionTex: "\\langle v_i{}^{\\,i \\in 1..n} \\rangle.j \\to v_j",
        description: "Once every component is a value, projection picks out the j-th one.",
        wide: false,
      },
      {
        id: "E-Proj",
        premisesTex: ["t \\to t'"],
        conclusionTex: "t.lab \\to t'.lab",
        description: "Reduce the term being projected before projecting — same rule for a tuple index or a record label.",
      },
      {
        id: "E-Tuple",
        premisesTex: ["t_j \\to t_j'"],
        conclusionTex: "\\langle v_i{}^{\\,i \\in 1..j-1}, t_j, t_k{}^{\\,k \\in j+1..n} \\rangle \\to \\langle v_i{}^{\\,i \\in 1..j-1}, t_j', t_k{}^{\\,k \\in j+1..n} \\rangle",
        description: "Reduce the leftmost component that isn't a value yet, left to right.",
        wide: true,
      },
      {
        id: "E-ProjRecord",
        premisesTex: [""],
        conclusionTex: "\\langle \\mathit{lab}_i = v_i{}^{\\,i \\in 1..n} \\rangle.\\mathit{lab}_j \\to v_j",
        description: "The record analogue of E-ProjTuple — once every field is a value, pick out the one named lab_j.",
        wide: true,
      },
      {
        id: "E-Record",
        premisesTex: ["t_j \\to t_j'"],
        conclusionTex: "\\langle \\mathit{lab}_i = v_i{}^{\\,i \\in 1..j-1}, \\mathit{lab}_j = t_j, \\mathit{lab}_k = t_k{}^{\\,k \\in j+1..n} \\rangle \\to \\langle \\mathit{lab}_i = v_i{}^{\\,i \\in 1..j-1}, \\mathit{lab}_j = t_j', \\mathit{lab}_k = t_k{}^{\\,k \\in j+1..n} \\rangle",
        description: "The record analogue of E-Tuple — reduce the leftmost field that isn't a value yet.",
        wide: true,
      },
      {
        id: "E-CaseInl",
        premisesTex: [""],
        conclusionTex: "\\text{case}\\ (\\text{inl}\\ v\\ \\text{as}\\ T)\\ \\text{of}\\ \\text{inl}\\ x{\\Rightarrow}t_1\\ |\\ \\text{inr}\\ y{\\Rightarrow}t_2 \\to [x \\mapsto v]\\, t_1",
        description: "The value after \"case\" is a left injection — put its contents in place of x and run the inl branch.",
        wide: true,
      },
      {
        id: "E-CaseInr",
        premisesTex: [""],
        conclusionTex: "\\text{case}\\ (\\text{inr}\\ v\\ \\text{as}\\ T)\\ \\text{of}\\ \\text{inl}\\ x{\\Rightarrow}t_1\\ |\\ \\text{inr}\\ y{\\Rightarrow}t_2 \\to [y \\mapsto v]\\, t_2",
        description: "The value after \"case\" is a right injection — put its contents in place of y and run the inr branch.",
        wide: true,
      },
      {
        id: "E-Inl",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "\\text{inl}\\ t_1\\ \\text{as}\\ T \\to \\text{inl}\\ t_1'\\ \\text{as}\\ T",
        description: "Reduce the injected term before the left injection is a value.",
      },
      {
        id: "E-Inr",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "\\text{inr}\\ t_1\\ \\text{as}\\ T \\to \\text{inr}\\ t_1'\\ \\text{as}\\ T",
        description: "Reduce the injected term before the right injection is a value.",
      },
      {
        id: "E-CaseVariant",
        premisesTex: [""],
        conclusionTex: "\\text{case}\\ ([\\mathit{lab}_j = v_j]\\ \\text{as}\\ T)\\ \\text{of}\\ [\\mathit{lab}_i = x_i] \\Rightarrow t_i{}^{\\,i \\in 1..n} \\to [x_j \\mapsto v_j]\\, t_j",
        description: "Pick the branch whose label matches the value, then put the value's contents in place of that branch's variable. The many-label version of E-CaseInl / E-CaseInr.",
        wide: true,
      },
      {
        id: "E-Case",
        premisesTex: ["t_0 \\to t_0'"],
        conclusionTex: "\\text{case}\\ t_0\\ \\text{of}\\ \\ldots \\to \\text{case}\\ t_0'\\ \\text{of}\\ \\ldots",
        description: "Reduce the value after \"case\" first, before choosing a branch — same rule for a sum case and a variant case.",
        wide: true,
      },
      {
        id: "E-Variant",
        premisesTex: ["t_i \\to t_i'"],
        conclusionTex: "[\\mathit{lab}_i = t_i]\\ \\text{as}\\ T \\to [\\mathit{lab}_i = t_i']\\ \\text{as}\\ T",
        description: "Reduce the injected term before the variant is a value.",
        wide: true,
      },
    ],
  },
  {
    id: "lists-eval",
    title: "Lists",
    rules: [
      {
        id: "E-Cons1",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "\\text{cons}[T]\\ t_1\\ t_2 \\to \\text{cons}[T]\\ t_1'\\ t_2",
        description: "Reduce the head element first.",
        wide: false,
      },
      {
        id: "E-Cons2",
        premisesTex: ["t_2 \\to t_2'"],
        conclusionTex: "\\text{cons}[T]\\ v_1\\ t_2 \\to \\text{cons}[T]\\ v_1\\ t_2'",
        description: "Once the head is a value, reduce the tail.",
        wide: false,
      },
      {
        id: "E-IsNilNil",
        premisesTex: [""],
        conclusionTex: "\\text{isnil}[T]\\ (\\text{nil}[T]) \\to \\text{true}",
        description: "The empty list is empty.",
        wide: false,
      },
      {
        id: "E-IsNilCons",
        premisesTex: [""],
        conclusionTex: "\\text{isnil}[T]\\ (\\text{cons}[T]\\ v_1\\ v_2) \\to \\text{false}",
        description: "A cons cell is not empty.",
        wide: false,
      },
      {
        id: "E-IsNil",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "\\text{isnil}[T]\\ t_1 \\to \\text{isnil}[T]\\ t_1'",
        description: "Reduce the list before testing it.",
        wide: false,
      },
      {
        id: "E-HeadCons",
        premisesTex: [""],
        conclusionTex: "\\text{head}[T]\\ (\\text{cons}[T]\\ v_1\\ v_2) \\to v_1",
        description: "head returns the first element.",
        wide: false,
      },
      {
        id: "E-Head",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "\\text{head}[T]\\ t_1 \\to \\text{head}[T]\\ t_1'",
        description: "Reduce the list before taking its head.",
        wide: false,
      },
      {
        id: "E-TailCons",
        premisesTex: [""],
        conclusionTex: "\\text{tail}[T]\\ (\\text{cons}[T]\\ v_1\\ v_2) \\to v_2",
        description: "tail returns the list without its first element.",
        wide: false,
      },
      {
        id: "E-Tail",
        premisesTex: ["t_1 \\to t_1'"],
        conclusionTex: "\\text{tail}[T]\\ t_1 \\to \\text{tail}[T]\\ t_1'",
        description: "Reduce the list before taking its tail.",
      },
    ],
  },
  {
    id: "iso-recursive-eval",
    title: "Iso-recursive Types (μ)",
    rules: [
      {
        id: "E-UnfoldFold",
        premisesTex: [""],
        conclusionTex: "\\text{unfold}[\\mu X. T]\\,(\\text{fold}[\\mu X. T]\\ v) \\to v",
        description: "fold and unfold cancel — the computational content of the μX.T isomorphism.",
        wide: false,
      },
      {
        id: "E-Fold",
        premisesTex: ["t \\to t'"],
        conclusionTex: "\\text{fold}[\\mu X. T]\\ t \\to \\text{fold}[\\mu X. T]\\ t'",
        description: "Reduce the wrapped term; fold of a value is itself a value.",
        wide: false,
      },
      {
        id: "E-Unfold",
        premisesTex: ["t \\to t'"],
        conclusionTex: "\\text{unfold}[\\mu X. T]\\ t \\to \\text{unfold}[\\mu X. T]\\ t'",
        description: "Reduce the wrapped term before unfolding it.",
        wide: false,
      },
    ],
  },
  {
    id: "recursion-eval",
    title: "Recursion (fix)",
    rules: [
      {
        id: "E-FixBeta",
        premisesTex: [""],
        conclusionTex: "\\text{fix}\\ (\\lambda x{:}T.\\, t) \\to [x \\mapsto \\text{fix}\\ (\\lambda x{:}T.\\, t)]\\, t",
        description: "Unfolds one layer of recursion, substituting the whole fix expression back in for the recursive call.",
        wide: false,
      },
      {
        id: "E-Fix",
        premisesTex: ["t \\to t'"],
        conclusionTex: "\\text{fix}\\ t \\to \\text{fix}\\ t'",
        description: "Reduce the term before unfolding the recursion — it must become a lambda first.",
      },
    ],
  },
  {
    id: "system-f-eval",
    title: "System F",
    rules: [
      {
        id: "E-TappTabs",
        premisesTex: [""],
        conclusionTex: "(\\Lambda X.\\, t)\\,[T] \\to [X \\mapsto T]\\, t",
        description: "Type application's β-reduction — the type-level analogue of E-AppAbs, erased at runtime but explicit here.",
        wide: false,
      },
      {
        id: "E-TApp",
        premisesTex: ["t \\to t'"],
        conclusionTex: "t\\,[T_1] \\to t'\\,[T_1]",
        description: "Reduce the term to a type-abstraction value before applying the type argument.",
      },
    ],
  },
];

export function findRule(id: string): RuleDefinition | undefined {
  for (const group of [...TYPE_RULE_GROUPS, ...EVALUATION_RULE_GROUPS]) {
    const rule = group.rules.find((r) => r.id === id);
    if (rule) return rule;
  }
  return undefined;
}
