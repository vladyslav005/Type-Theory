import type {Term} from "@/domain/ast";

// A compact, structural signature of a Term — every field that affects reduction, none of the
// per-node `id`/`pos` metadata that's fresh on every substitution. Two terms with the same
// signature are the same term, so if one recurs exactly during reduction it's a certain infinite
// loop (reduction is deterministic — the same state can only ever lead to the same next state).
// Not meant to be readable — just stable and injective enough to use as a Set/Map key.
export function termSignature(term: Term): string {
  switch (term.kind) {
    case "Var":
      return `V:${term.name}`;
    case "Lit":
      return `L:${term.value}`;
    case "Abs":
      return `Abs(${term.param}:${termSignature(term.body)})`;
    case "App":
      return `App(${termSignature(term.func)},${termSignature(term.arg)})`;
    case "DummyAbstraction":
      return `Dummy(${termSignature(term.body)})`;
    case "Let":
      return `Let(${term.name}=${termSignature(term.value)},${termSignature(term.body)})`;
    case "Fix":
      return `Fix(${termSignature(term.term)})`;
    case "TypeAbs":
      return `TAbs(${term.typeParam}.${termSignature(term.body)})`;
    case "TypeApp":
      return `TApp(${termSignature(term.term)})`;
    case "Inl":
      return `Inl(${termSignature(term.term)})`;
    case "Inr":
      return `Inr(${termSignature(term.term)})`;
    case "IfCondition": {
      const elif = (term.elif ?? []).map((b) => `${termSignature(b.condition)}->${termSignature(b.then)}`).join(",");
      const elseBranch = term.else ? termSignature(term.else) : "-";
      return `If(${termSignature(term.condition)},${termSignature(term.then)},[${elif}],${elseBranch})`;
    }
    case "Case":
      return `Case(${termSignature(term.variable)},${term.inl.variable}->${termSignature(term.inl.term)},${term.inr.variable}->${termSignature(term.inr.term)})`;
    case "VariantCase":
      return `VCase(${termSignature(term.variable)},${term.cases.map((c) => `${c.label}:${c.variable}->${termSignature(c.body)}`).join(",")})`;
    case "Variant":
      return `Variant(${term.variants.map((v) => `${v.label}=${termSignature(v.term)}`).join(",")})`;
    case "Ascribe":
      return `Asc(${termSignature(term.term)})`;
    case "TupleProjection":
      return `TProj(${termSignature(term.tuple)}.${term.index})`;
    case "RecordProjection":
      return `RProj(${termSignature(term.term)}.${term.label})`;
    case "Record":
      return `Rec(${term.fields.map((f) => `${f.label}=${termSignature(f.term)}`).join(",")})`;
    case "Tuple":
      return `Tup(${term.elements.map(termSignature).join(",")})`;
    case "Sequencing":
      return `Seq(${termSignature(term.first)};${termSignature(term.second)})`;
    case "BinOp":
      return `Bin(${termSignature(term.left)}${term.operator}${termSignature(term.right)})`;
    case "Nil":
      return "Nil";
    case "Cons":
      return `Cons(${termSignature(term.head)},${termSignature(term.tail)})`;
    case "IsNil":
      return `IsNil(${termSignature(term.term)})`;
    case "Head":
      return `Head(${termSignature(term.term)})`;
    case "Tail":
      return `Tail(${termSignature(term.term)})`;
    case "Fold":
      return `Fold(${termSignature(term.term)})`;
    case "Unfold":
      return `Unfold(${termSignature(term.term)})`;
  }
}
