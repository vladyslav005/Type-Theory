export interface PaletteItem {
  type: string;
  label: string;
  title: string;
}

export interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

export interface PaletteCategory {
  id: string;
  label: string;
  groups: PaletteGroup[];
}

// Every node type insertable from the AST editor's toolbar, grouped for the header dropdowns.
export const AST_NODE_PALETTE: PaletteCategory[] = [
  {
    id: "terms",
    label: "Terms",
    groups: [
      {
        label: "Terms",
        items: [
          {type: "abstraction", label: "λ", title: "Abstraction (λx.e)"},
          {type: "application", label: "@", title: "Application (f x)"},
          {type: "variable", label: "x", title: "Variable"},
          {type: "literal", label: "#", title: "Literal (0, true, unit)"},
          {type: "dummyAbstraction", label: "λ_", title: "Dummy Abstraction (λ_:T.t)"},
          {type: "sequencing", label: ";", title: "Sequencing (t1;t2)"},
          {type: "ascribe", label: "as", title: "Ascription (t as T)"},
          {type: "let", label: "let", title: "Let (let x = t1 in t2, with let-polymorphism)"},
        ],
      },
      {
        label: "Math",
        items: [
          {type: "binOp", label: "+/<", title: "Arithmetic or comparison (t1 op t2)"},
          {type: "fix", label: "fix", title: "Fixpoint operator (fix t, t : T -> T)"},
        ],
      },
      {
        label: "Sums",
        items: [
          {type: "inl", label: "inl", title: "Left injection (inl t as T1+T2)"},
          {type: "inr", label: "inr", title: "Right injection (inr t as T1+T2)"},
          {type: "case", label: "case", title: "Case analysis on a sum type"},
          {type: "variant", label: "[l=]", title: "Variant literal ([l=t] as VariantType)"},
          {type: "variantCase", label: "vcase", title: "Case analysis on a variant type"},
        ],
      },
      {
        label: "Lists",
        items: [
          {type: "nil", label: "nil", title: "Empty list (nil[T])"},
          {type: "cons", label: "cons", title: "Cons — prepend an element (cons[T] t1 t2)"},
          {type: "isNil", label: "isnil", title: "Is the list empty? (isnil[T] t)"},
          {type: "headOp", label: "head", title: "First element (head[T] t)"},
          {type: "tailOp", label: "tail", title: "Remaining elements (tail[T] t)"},
        ],
      },
      {
        label: "Recursive (μ)",
        items: [
          {type: "fold", label: "fold", title: "Fold — into μX.T (fold[μX.T] t)"},
          {type: "unfold", label: "unfold", title: "Unfold — out of μX.T (unfold[μX.T] t)"},
        ],
      },
      {
        label: "Tuples/Records",
        items: [
          {type: "tuple", label: "⟨,⟩", title: "Tuple literal"},
          {type: "tupleProjection", label: ".i", title: "Tuple projection (t.i)"},
          {type: "record", label: "⟨l=⟩", title: "Record literal"},
          {type: "recordProjection", label: ".l", title: "Record projection (t.l)"},
        ],
      },
      {
        label: "Control",
        items: [
          {type: "ifCondition", label: "if", title: "Conditional (if/then/elseif/else)"},
        ],
      },
      {
        label: "Numbers & booleans (NBL)",
        items: [
          {type: "succ", label: "succ", title: "Successor (succ t)"},
          {type: "pred", label: "pred", title: "Predecessor (pred t)"},
          {type: "iszero", label: "iszero", title: "Zero test (iszero t)"},
        ],
      },
    ],
  },
  {
    id: "types",
    label: "Types",
    groups: [
      {
        label: "Types",
        items: [
          {type: "typeVar", label: "T", title: "Type Variable"},
          {type: "typeArrow", label: "→", title: "Arrow Type (A→B)"},
          {type: "sumType", label: "+", title: "Sum Type (A+B)"},
          {type: "tupleType", label: "⟨*⟩", title: "Tuple Type (A*B)"},
          {type: "variantType", label: "[l:]", title: "Variant Type ([l:T,...])"},
          {type: "recordType", label: "{l:}", title: "Record Type (synthesized)"},
          {type: "forallType", label: "∀", title: "Forall Type (∀X. T)"},
          {type: "listType", label: "List", title: "List Type (List T)"},
          {type: "recursiveType", label: "μ", title: "Recursive Type (μX. T)"},
        ],
      },
    ],
  },
  {
    id: "polymorphism",
    label: "Polymorphism",
    groups: [
      {
        label: "System F",
        items: [
          {type: "typeAbs", label: "Λ", title: "Type Abstraction (ΛX. t)"},
          {type: "typeApp", label: "[T]", title: "Type Application (t [T])"},
        ],
      },
      {
        label: "System Fω",
        items: [
          {type: "typeConstructorAbs", label: "λX:@", title: "Type Constructor Abstraction (λX:K. T)"},
          {type: "typeConstructorApp", label: "F T", title: "Type Constructor Application (F T)"},
        ],
      },
      {
        label: "System λP",
        items: [
          {type: "typePi", label: "Πx:A", title: "Dependent Function Type (Πx:A. B)"},
          {type: "typeIndexApp", label: "F[t]", title: "Term-Indexed Type Application (F[t])"},
        ],
      },
      {
        label: "Kinds",
        items: [
          {type: "kindStar", label: "@", title: "Star Kind — the kind of ordinary types"},
          {type: "kindArrow", label: "K→K", title: "Function Kind (K→K, or T→K for a System λP dependent kind)"},
        ],
      },
    ],
  },
  {
    id: "declarations",
    label: "Declarations",
    groups: [
      {
        label: "Decls",
        items: [
          {type: "funDecl", label: "ƒ", title: "Function Declaration"},
          {type: "varDecl", label: "let", title: "Variable Declaration"},
          {type: "typeAliasDecl", label: "typedef", title: "Type Alias (typedef X = T)"},
        ],
      },
    ],
  },
];
