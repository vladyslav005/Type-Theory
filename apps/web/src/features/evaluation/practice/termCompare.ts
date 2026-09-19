import type {Term} from "@vladyslav005/tt-core";

const TYPE_KINDS = new Set([
  "TyIdentifier", "TyMetaVar", "TyArrow", "TupleType", "SumType", "VariantType", "RecordType", "ListType",
  "TyForall", "RecursiveType", "TyConstructorAbs", "TyConstructorApp", "TyPi", "TyIndexApp",
]);
const IGNORED_KEYS = new Set(["id", "pos", "type", "paramType"]);

type Rename = Map<string, string>;

export function findTermById(root: unknown, id: string): Term | undefined {
  if (!root || typeof root !== "object") return undefined;
  const node = root as Record<string, unknown>;
  if (typeof node.kind === "string" && node.id === id && !TYPE_KINDS.has(node.kind)) return root as Term;
  for (const value of Object.values(node)) {
    const found = Array.isArray(value)
      ? value.map((v) => findTermById(v, id)).find((f) => f !== undefined)
      : findTermById(value, id);
    if (found) return found;
  }
  return undefined;
}

const extend = (env: Rename, from: string, to: string): Rename => new Map(env).set(from, to);

// ignores types and bound-variable names: substitution may rename binders to avoid capture
export function termsAlphaEqual(a: Term, b: Term): boolean {
  return equal(a, b, new Map(), new Map());
}

function equal(a: unknown, b: unknown, ab: Rename, ba: Rename): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i], ab, ba));
  }

  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  if (typeof x.kind === "string" && TYPE_KINDS.has(x.kind)) return true;
  if (x.kind !== y.kind) return false;

  switch (x.kind) {
    case "Var": {
      const nx = x.name as string;
      const ny = y.name as string;
      if (ab.has(nx) || ba.has(ny)) return ab.get(nx) === ny && ba.get(ny) === nx;
      return nx === ny;
    }
    case "Abs":
      return equal(x.body, y.body, extend(ab, x.param as string, y.param as string), extend(ba, y.param as string, x.param as string));
    case "Let":
      return equal(x.value, y.value, ab, ba)
        && equal(x.body, y.body, extend(ab, x.name as string, y.name as string), extend(ba, y.name as string, x.name as string));
    case "Case": {
      const xi = x.inl as {variable: string; term: unknown};
      const yi = y.inl as {variable: string; term: unknown};
      const xr = x.inr as {variable: string; term: unknown};
      const yr = y.inr as {variable: string; term: unknown};
      return equal(x.variable, y.variable, ab, ba)
        && equal(xi.term, yi.term, extend(ab, xi.variable, yi.variable), extend(ba, yi.variable, xi.variable))
        && equal(xr.term, yr.term, extend(ab, xr.variable, yr.variable), extend(ba, yr.variable, xr.variable));
    }
    case "VariantCase": {
      const xc = x.cases as {label: string; variable: string; body: unknown}[];
      const yc = y.cases as {label: string; variable: string; body: unknown}[];
      return equal(x.variable, y.variable, ab, ba)
        && xc.length === yc.length
        && xc.every((c, i) => c.label === yc[i].label
          && equal(c.body, yc[i].body, extend(ab, c.variable, yc[i].variable), extend(ba, yc[i].variable, c.variable)));
    }
    default: {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)].filter((k) => !IGNORED_KEYS.has(k)));
      return [...keys].every((k) => equal(x[k], y[k], ab, ba));
    }
  }
}
