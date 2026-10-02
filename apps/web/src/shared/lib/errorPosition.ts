import {ParseSyntaxError, type SourcePosition} from "@vladyslav005/tt-core";

const isPosition = (value: unknown): value is SourcePosition =>
  typeof value === "object" && value !== null && typeof (value as SourcePosition).line === "number";

export function errorPosition(error: Error): SourcePosition | undefined {
  if (error instanceof ParseSyntaxError) return error.errors[0];
  const pos = (error as {pos?: unknown}).pos;
  return isPosition(pos) ? pos : undefined;
}

export function findNodePosition(root: unknown, id: string): SourcePosition | undefined {
  if (typeof root !== "object" || root === null) return undefined;
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findNodePosition(item, id);
      if (found) return found;
    }
    return undefined;
  }
  const node = root as {id?: unknown; pos?: unknown};
  if (node.id === id && isPosition(node.pos)) return node.pos;
  for (const [key, value] of Object.entries(root)) {
    if (key === "pos") continue;
    const found = findNodePosition(value, id);
    if (found) return found;
  }
  return undefined;
}
