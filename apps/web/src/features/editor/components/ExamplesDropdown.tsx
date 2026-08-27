import { BookOpen, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface Example {
  label: string;
  description: string;
  code: string;
}

interface ExampleGroup {
  title: string;
  items: Example[];
}

const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    title: "Basics",
    items: [
      {
        label: "Identity Function",
        description: "the simplest possible term — apply λx:T.x to a variable a:T and get a back unchanged",
        code: "a : T;\n(λ x : T . x) a;",
      },
      {
        label: "Type Alias: Basic Synonym",
        description: "typedef X = T introduces a transparent synonym, usable anywhere T could be",
        code: `typedef MyNat = Nat;

f = λ x : MyNat . x + 1 : MyNat -> MyNat;

f 5;`,
      },
      {
        label: "Type Alias: Chained",
        description: "a typedef built from an earlier typedef resolves through the whole chain to Nat",
        code: `typedef Id = Nat;
typedef Score = Id;

s : Score;
s + 10;`,
      },
      {
        label: "Type Alias: Function Type",
        description: "aliasing a compound (arrow) type to shorten a repeated signature",
        code: `typedef IntFn = Nat -> Nat;

apply = λ f : IntFn . λ x : Nat . f x : IntFn -> Nat -> Nat;

inc = λ x : Nat . x + 1 : Nat -> Nat;

apply inc 5;`,
      },
      {
        label: "Application Chain: compose & twice",
        description: "identity, compose, and twice combined — twice applies (compose identity identity) to itself, a classic higher-order-function workout",
        code: `identity = λ x : T . x : T -> T;

compose =
  λ f : T -> T .
  λ g : T -> T .
  λ x : T .
    f (g x)
  : (T -> T) -> (T -> T) -> T -> T;

twice =
  λ f : T -> T .
  λ x : T .
    f (f x)
  : (T -> T) -> T -> T;

twice ((compose identity) identity);`,
      },
      {
        label: "Alpha Conversion",
        description: "the outer y (bound outside) is shadowed by the inner λy — the body's x still refers to the outer parameter, unaffected by the name clash",
        code: `y: T; (λ x : T . λ y : T . x) y;`,
      },
      {
        label: "Booleans & If",
        description: "if/then/elseif/else chain over Bool — the first true branch wins (elseif true then 200 short-circuits before else)",
        code: `(if false then 100 elseif true then 200 else 300);`,
      },
      {
        label: "Ascription & Sequencing",
        description: "unit; 42 sequences a Unit-typed effect then a Nat result, and the whole thing is ascribed to Nat",
        code: `((unit; 42) as Nat);`,
      },
      {
        label: "Dummy Abstraction: λ_",
        description: "λ_:T.t discards its argument entirely — the parameter is never given a name, so it can't be referenced in the body",
        code: `((λ _ : Nat . true) 5);`,
      },
      {
        label: "Arithmetic",
        description: "+ - * / over Nat — all four share one precedence level (left-to-right), so group with parens to control order",
        code: `((2 + 3) * 4 - 1) / 3;`,
      },
      {
        label: "Comparison",
        description: "< <= > >= == != over Nat, each producing a Bool usable directly in an if",
        code: `if (2 + 3) >= 5 then (10 == 10) else (10 != 10);`,
      },
    ],
  },
  {
    title: "Sums & Variants",
    items: [
      {
        label: "Sum Types: inl / inr",
        description: "inl 5 : Nat+Bool builds the left alternative; case ... of inl x => ... || inr y => ... recovers it, picking the Nat branch",
        code: `value = (inl 5 as Nat+Bool) : Nat+Bool;

(case value || inl x => x || inr y => 0);`,
      },
      {
        label: "Variants: Labeled Sum",
        description: "an n-ary labeled sum type ([circle:Nat, square:Nat]) generalizing binary inl/inr — matched with case ... of [label=x] => ...",
        code: `shape = ([circle=1] as [circle:Nat, square:Nat]) : [circle:Nat, square:Nat];

(case shape of [circle=r] => r || [square=s] => s);`,
      },
    ],
  },
  {
    title: "Tuples & Records",
    items: [
      {
        label: "Tuples",
        description: "a heterogeneous tuple literal <1, true, 2>, projected positionally with .2",
        code: `(<1, true, 2>.2);`,
      },
      {
        label: "Records",
        description: "a labeled record literal <name=1, flag=true>, projected by field name with .flag",
        code: `(<name=1, flag=true>.flag);`,
      },
      {
        label: "Chained Projections",
        description: "projecting through a function's result (swap<7,9>).1, plus a tuple-inside-a-record chain .2.label",
        code: `swap = λ p : <Nat*Nat> . <p.2, p.1> : <Nat*Nat> -> <Nat*Nat>;

<((swap <7, 9>).1), (<10, <label=20, flag=true>>.2.label)>;`,
      },
    ],
  },
  {
    title: "Lists",
    items: [
      {
        label: "Head of a List",
        description: "cons/nil construction, then head extracts the first element — the lecture's own worked example (reduces to 3)",
        code: `head[Nat] cons[Nat] 3 (cons[Nat] 8 nil[Nat]);`,
      },
      {
        label: "isnil: Empty vs. Non-empty",
        description: "isnil[Nat] tests whether a list is nil — here on a non-empty list (cons 1 nil), so it reduces to false",
        code: `isnil[Nat] (cons[Nat] 1 nil[Nat]);`,
      },
      {
        label: "tail: Drop the First Element",
        description: "tail[Nat] on a two-element list (cons 1 (cons 2 nil)) drops the head, leaving cons[Nat] 2 nil[Nat]",
        code: `tail[Nat] (cons[Nat] 1 (cons[Nat] 2 nil[Nat]));`,
      },
    ],
  },
  {
    title: "Iso-recursive Types (μ)",
    items: [
      {
        label: "Nat via μ: the lecture's own definition",
        description: "NatRec ≅ μX.[zero:Unit, succ:X] — exactly the lecture's \"Nat = μX...\" (renamed NatRec here since Nat itself is reserved for the language's built-in numeral literals); defines zero/succ/iszero/pred, then checks iszero(zero)",
        code: `typedef NatRec = μX.[zero:Unit, succ:X];

zero = fold[NatRec] ([zero=unit] as [zero:Unit, succ:NatRec]) : NatRec;

succ = λ n : NatRec . fold[NatRec] ([succ=n] as [zero:Unit, succ:NatRec]) : NatRec -> NatRec;

iszero = λ n : NatRec . (case unfold[NatRec] n of [zero=x] => true || [succ=y] => false) : NatRec -> Bool;

pred = λ n : NatRec . (case unfold[NatRec] n of [zero=x] => zero || [succ=y] => y) : NatRec -> NatRec;

iszero zero;`,
      },
      {
        label: "Nat via μ: iszero(succ zero) = false",
        description: "same NatRec encoding — unfold exposes the variant so iszero's case-split lands on the \"succ\" branch instead of \"zero\"",
        code: `typedef NatRec = μX.[zero:Unit, succ:X];

zero = fold[NatRec] ([zero=unit] as [zero:Unit, succ:NatRec]) : NatRec;

succ = λ n : NatRec . fold[NatRec] ([succ=n] as [zero:Unit, succ:NatRec]) : NatRec -> NatRec;

iszero = λ n : NatRec . (case unfold[NatRec] n of [zero=x] => true || [succ=y] => false) : NatRec -> Bool;

pred = λ n : NatRec . (case unfold[NatRec] n of [zero=x] => zero || [succ=y] => y) : NatRec -> NatRec;

iszero (succ zero);`,
      },
      {
        label: "Nat via μ: pred(succ n) = n",
        description: "pred unfolds one succ-cell and hands back its payload directly, undoing the succ that was just applied",
        code: `typedef NatRec = μX.[zero:Unit, succ:X];

zero = fold[NatRec] ([zero=unit] as [zero:Unit, succ:NatRec]) : NatRec;

succ = λ n : NatRec . fold[NatRec] ([succ=n] as [zero:Unit, succ:NatRec]) : NatRec -> NatRec;

pred = λ n : NatRec . (case unfold[NatRec] n of [zero=x] => zero || [succ=y] => y) : NatRec -> NatRec;

pred (succ zero);`,
      },
      {
        label: "Nat via μ: pred(zero) = zero",
        description: "the usual boundary convention — pred of zero is defined to just hand back zero again, rather than being left stuck",
        code: `typedef NatRec = μX.[zero:Unit, succ:X];

zero = fold[NatRec] ([zero=unit] as [zero:Unit, succ:NatRec]) : NatRec;

pred = λ n : NatRec . (case unfold[NatRec] n of [zero=x] => zero || [succ=y] => y) : NatRec -> NatRec;

pred zero;`,
      },
      {
        label: "fold/unfold cancellation (E-unfoldfold)",
        description: "unfold[T](fold[T] v) → v in a single evaluation step — the core isomorphism rule, isolated from the Nat encoding so it's visible on its own",
        code: `typedef NatRec = μX.[zero:Unit, succ:X];

unfold[NatRec] (fold[NatRec] ([zero=unit] as [zero:Unit, succ:NatRec]));`,
      },
      {
        label: "μ over a function type",
        description: "recursive types aren't limited to variant/record bodies — μX.(X→X) is a self-referential function type, folded and unfolded exactly the same way",
        code: `typedef SelfFn = μX.(X -> X);

identity = fold[SelfFn] (λ x : SelfFn . x) : SelfFn;

unfold[SelfFn] identity;`,
      },
    ],
  },
  {
    title: "Recursion (fix)",
    items: [
      {
        label: "Factorial via fix",
        description: "the classic fix g factorial encoding, g : (Nat->Nat)->Nat->Nat — g's own recursive call goes through the fixpoint operator instead of naming itself",
        code: `g = λ f : Nat -> Nat . λ n : Nat . if n == 0 then 1 else n * (f (n - 1)) : (Nat -> Nat) -> Nat -> Nat;

(fix g) 5;`,
      },
      {
        label: "Fibonacci via fix",
        description: "same fixpoint pattern as factorial, but with two recursive calls per step, g : (Nat->Nat)->Nat->Nat",
        code: `fib = λ f : Nat -> Nat . λ n : Nat . if n <= 1 then n else (f (n - 1)) + (f (n - 2)) : (Nat -> Nat) -> Nat -> Nat;

(fix fib) 7;`,
      },
      {
        label: "Non-terminating fix",
        description: "fix (λx:Nat.x) unfolds to itself forever with no base case — hits the evaluator's step limit rather than a value",
        code: `fix (λ x : Nat . x);`,
      },
    ],
  },
  {
    title: "Let & Polymorphism",
    items: [
      {
        label: "Let Bindings",
        description: "bind a name with let x = ..., then reference it in the body — no polymorphism needed for a single monomorphic use",
        code: `let x = true in (if x then 1 else 2);`,
      },
      {
        label: "Let-bound Function",
        description: "bind an unannotated function with let, then apply it in the body — its parameter type is inferred from the call site",
        code: `let apply = λ f . λ x . f x in (apply (λ y : Nat . y) 5);`,
      },
      {
        label: "Nested Let: Shadowing",
        description: "an inner let x = true shadows the outer let x = 1 within its own body, without affecting the outer binding",
        code: `let x = 1 in (let x = true in x);`,
      },
      {
        label: "Let-polymorphism: id at Two Types",
        description: "id is generalized (∀A. A -> A) so the SAME definition is reused at Nat and Bool within one body — this needs the Let-polymorphism theory, not just Type inference",
        code: `let id = λ x . x in <(id 5), (id true)>;`,
      },
      {
        label: "Let-polymorphism: const",
        description: "const is generalized over two independent type variables (∀A,B. A -> B -> A) and reused at two different instantiations",
        code: `let const = λ x . λ y . x in <(const 1 true), (const false 2)>;`,
      },
      {
        label: "Type Inference: Unannotated λ",
        description: "with the Type inference theory on, an unannotated λx.x works even outside a let-bound value",
        code: `(λ x . x) 5;`,
      },
      {
        label: "Type Inference: Inferred from Usage",
        description: "with Type inference on, f's parameter type is inferred from how f is applied inside the body (f 5 forces Nat), not from an explicit annotation",
        code: `(λ f . f 5) (λ x : Nat . x + 1);`,
      },
    ],
  },
  {
    title: "System F",
    items: [
      {
        label: "Polymorphic Identity (System F)",
        description: "explicit type abstraction ΛX.λx:X.x : ∀X.X->X, instantiated explicitly at Nat and Bool via id[Nat]/id[Bool] — enable the System F theory",
        code: `id = ΛX. λ x : X . x : ∀X. X -> X;

<(id[Nat] 5), (id[Bool] true)>;`,
      },
      {
        label: "Polymorphic Compose (System F)",
        description: "compose takes three explicit type parameters ∀A.∀B.∀C, instantiated with compose[Nat][Nat][Bool] to compose isZero after inc",
        code: `compose = ΛA. ΛB. ΛC. λ f : B -> C . λ g : A -> B . λ x : A . f (g x) : ∀A. ∀B. ∀C. (B -> C) -> (A -> B) -> A -> C;

inc = λ x : Nat . x + 1 : Nat -> Nat;
isZero = λ x : Nat . (x == 0) : Nat -> Bool;

(compose[Nat][Nat][Bool] isZero inc) 5;`,
      },
    ],
  },
  {
    title: "System Fω (Type Constructors)",
    items: [
      {
        label: "Identity Constructor (System Fω)",
        description: "typedef Id = λX:@.X — a type constructor of kind @→@ that's a no-op on types; (Id Nat) normalizes to Nat — enable the System Fω theory",
        code: `typedef Id = λ X : @ . X;

f = λ x : (Id Nat) . x + 1 : (Id Nat) -> (Id Nat);

f 5;`,
      },
      {
        label: "Endo Constructor (System Fω)",
        description: "typedef Endo = λX:@.X->X builds \"the type of endofunctions on T\" from any T, itself classified by kind @→@",
        code: `typedef Endo = λ X : @ . X -> X;

inc = λ x : Nat . x + 1 : Nat -> Nat;

apply = λ f : (Endo Nat) . λ x : Nat . f x : (Endo Nat) -> Nat -> Nat;

apply inc 5;`,
      },
    ],
  },
  {
    title: "System λP (Dependent Types)",
    items: [
      {
        label: "Dependent Head (System λP)",
        description: "typedef Vec : Nat -> @ declares an opaque, term-indexed type family; vecHead's Πn:Nat.Vec[n]->Nat type instantiates its own argument's expected type per call — enable the System λP theory",
        code: `// Vec is a family of types indexed by a Nat: Vec[0], Vec[1], Vec[2] ...
// are each distinct, unrelated types. It's declared "opaque" — only its
// kind is given (Nat -> @, i.e. "feed it a number, get back a type"), not
// what it actually contains, so Vec[3] never unfolds into anything
// simpler. It just IS a type, the same way Nat itself doesn't unfold.
typedef Vec : Nat -> @;

// v3 has type Vec[3] specifically, not Vec[4], not Vec[100].
v3 : Vec[3];

// vecHead's type is a Π-type (dependent function type): give it a number n,
// and it hands back a function expecting Vec[n] — THE SAME n — and
// producing Nat. Unlike a plain A -> B, the type of the 2nd argument
// changes with whichever n you passed first: vecHead 3 expects Vec[3],
// vecHead 5 expects Vec[5].
vecHead = λ n : Nat . λ x : Vec[n] . n : Π n : Nat . Vec[n] -> Nat;

// vecHead 3 has type Vec[3] -> Nat, and v3 : Vec[3] — matches, type-checks.
vecHead 3 v3;`,
      },
      {
        label: "Dependent Head: Index Mismatch (System λP)",
        description: "same head as above, but v4 : Vec[4] is passed where Vec[3] is expected — rejected because the index is baked into the type itself, not just a runtime value",
        code: `// Same opaque Vec family as the "Dependent Head (System λP)" example.
typedef Vec : Nat -> @;

// v4 has type Vec[4], NOT Vec[3].
v4 : Vec[4];

vecHead = λ n : Nat . λ x : Vec[n] . n : Π n : Nat . Vec[n] -> Nat;

// vecHead 3 expects an argument of type Vec[3], but v4 : Vec[4] is a
// DIFFERENT type (Vec[3] ≠ Vec[4], same as Nat ≠ Bool) — so this is
// rejected: "Cannot unify Vec[3] with Vec[4]". That's the payoff of
// dependent types: the mismatch is caught before the program ever runs.
vecHead 3 v4;`,
      },
    ],
  },
];

interface ExamplesDropdownProps {
  onSelect: (code: string) => void;
  disabled?: boolean;
}

const exampleSlug = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function ExamplesDropdown({ onSelect, disabled = false }: ExamplesDropdownProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={disabled}
          title={disabled ? t("topbar.onlyOnEditor") : undefined}
        >
          <BookOpen className="h-3.5 w-3.5" />
          {t("examples.trigger")}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
        {EXAMPLE_GROUPS.map((group, groupIndex) => (
          <div key={group.title}>
            {groupIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{t(`examples.groups.${group.title}`, group.title)}</DropdownMenuLabel>
            {group.items.map((ex) => {
              const slug = exampleSlug(ex.label);
              return (
              <DropdownMenuItem key={ex.label} onClick={() => onSelect(ex.code)}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{t(`examples.items.${slug}.label`, ex.label)}</span>
                  <span className="text-xs text-muted-foreground">{t(`examples.items.${slug}.description`, ex.description)}</span>
                </div>
              </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
