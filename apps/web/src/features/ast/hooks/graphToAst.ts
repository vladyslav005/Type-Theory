import type {Edge} from "@xyflow/react";
import type {AstFlowGraph, AstFlowNode} from "@/shared/presentation/flow/types";
import type {Abs, App, ASTNode, FunDecl, GlobalDecl, Kind, KindArrow, Program, RecursiveType, Term, TyConstructorAbs, TyConstructorApp, TyForall, TyIdentifier, TyIndexApp, TyPi, Type, TypeAliasDecl, TypeConstructorDecl, Var, VarDecl, TyArrow} from "@vladyslav005/tt-core";

function unitLit(id: string): Term {
  return {id, kind: "Lit", value: "unit"} as Term;
}

function boolLit(id: string, value: "true" | "false"): Term {
  return {id, kind: "Lit", value} as Term;
}

type NodeMap = Map<string, AstFlowNode>;

type ByHandle = Record<string, Edge[]>;

function groupOutgoingByHandle(edges: Edge[], sourceId: string): ByHandle {
  const result: ByHandle = {};
  for (const e of edges) {
    if (e.source !== sourceId) continue;
    const h = e.sourceHandle ?? "";
    (result[h] ??= []).push(e);
  }
  return result;
}

function firstTargetNode(byHandle: ByHandle, handle: string, nodeMap: NodeMap): AstFlowNode | undefined {
  const edge = byHandle[handle]?.[0];
  if (!edge?.target) return undefined;
  return nodeMap.get(edge.target);
}

function parseGlobalIndex(handle: string): number | null {
  if (handle === "global-decl") return 0;
  if (!handle.startsWith("global-")) return null;
  const n = Number(handle.slice("global-".length));
  return Number.isFinite(n) ? n : null;
}

function defaultTyIdentifier(id: string, name = "T"): TyIdentifier {
  return { id, kind: "TyIdentifier", name };
}

function defaultType(id: string): Type {
  return defaultTyIdentifier(id);
}

function defaultVar(id: string, name = "x"): Var {
  return { id, kind: "Var", name };
}

function defaultKind(id: string): Kind {
  return { id, kind: "StarKind" };
}

const RECONSTRUCTIBLE_TYPE_KINDS = new Set(["TyIdentifier", "TyArrow", "SumType", "TupleType", "VariantType", "RecordType", "TyForall", "TyConstructorAbs", "TyConstructorApp", "TyPi", "TyIndexApp", "ListType", "RecursiveType"]);
const RECONSTRUCTIBLE_KIND_KINDS = new Set(["StarKind", "KindArrow"]);

function reconstructKind(node: AstFlowNode, nodeMap: NodeMap, edges: Edge[], visiting: Set<string>): Kind {
  if (visiting.has(node.id)) {
    const raw = node.data.term as any;
    return (raw && RECONSTRUCTIBLE_KIND_KINDS.has(raw.kind)) ? (raw as Kind) : defaultKind(node.id);
  }
  visiting.add(node.id);

  const raw = node.data.term as any;
  const byHandle = groupOutgoingByHandle(edges, node.id);

  if (raw.kind === "StarKind") {
    visiting.delete(node.id);
    return { id: raw.id ?? node.id, kind: "StarKind" };
  }

  if (raw.kind === "KindArrow") {
    const fromNode = firstTargetNode(byHandle, "from", nodeMap);
    const toNode = firstTargetNode(byHandle, "to", nodeMap);

    // `from` is Kind | Type — System λP's dependent kind (e.g. "Nat -> @") connects an ordinary
    // Type node there instead of a Kind node, so which reconstructor to use is decided by the
    // *connected* node's own kind, not by anything recorded on this node.
    let from: Kind | Type = defaultKind(`${node.id}-from`);
    if (fromNode) {
      const fromRaw = fromNode.data.term as any;
      from = RECONSTRUCTIBLE_KIND_KINDS.has(fromRaw?.kind)
        ? reconstructKind(fromNode, nodeMap, edges, visiting)
        : reconstructType(fromNode, nodeMap, edges, visiting);
    }

    const ka: KindArrow = {
      id: raw.id ?? node.id,
      kind: "KindArrow",
      from,
      to: toNode ? reconstructKind(toNode, nodeMap, edges, visiting) : defaultKind(`${node.id}-to`),
    };
    visiting.delete(node.id);
    return ka;
  }

  visiting.delete(node.id);
  return (raw as Kind) ?? defaultKind(node.id);
}

function reconstructType(node: AstFlowNode, nodeMap: NodeMap, edges: Edge[], visiting: Set<string>): Type {
  if (visiting.has(node.id)) {
    const raw = node.data.term as any;
    return (raw && RECONSTRUCTIBLE_TYPE_KINDS.has(raw.kind)) ? (raw as Type) : defaultType(node.id);
  }
  visiting.add(node.id);

  const raw = node.data.term as any;
  const byHandle = groupOutgoingByHandle(edges, node.id);

  if (raw.kind === "TyIdentifier") {
    visiting.delete(node.id);
    return { id: raw.id ?? node.id, kind: "TyIdentifier", name: raw.name ?? "T" };
  }

  if (raw.kind === "TyArrow") {
    const fromNode = firstTargetNode(byHandle, "from", nodeMap);
    const toNode = firstTargetNode(byHandle, "to", nodeMap);
    const ty: TyArrow = {
      id: raw.id ?? node.id,
      kind: "TyArrow",
      from: fromNode ? reconstructType(fromNode, nodeMap, edges, visiting) : defaultType(`${node.id}-from`),
      to: toNode ? reconstructType(toNode, nodeMap, edges, visiting) : defaultType(`${node.id}-to`),
    } as TyArrow;
    visiting.delete(node.id);
    return ty;
  }

  if (raw.kind === "SumType") {
    const leftNode = firstTargetNode(byHandle, "left", nodeMap);
    const rightNode = firstTargetNode(byHandle, "right", nodeMap);
    const ty = {
      id: raw.id ?? node.id,
      kind: "SumType",
      left: leftNode ? reconstructType(leftNode, nodeMap, edges, visiting) : defaultType(`${node.id}-left`),
      right: rightNode ? reconstructType(rightNode, nodeMap, edges, visiting) : defaultType(`${node.id}-right`),
    };
    visiting.delete(node.id);
    return ty as Type;
  }

  if (raw.kind === "TupleType") {
    const count = Array.isArray(raw.elements) ? raw.elements.length : 0;
    const elements: Type[] = [];
    for (let i = 0; i < count; i++) {
      const elNode = firstTargetNode(byHandle, `el-${i}`, nodeMap);
      elements.push(elNode ? reconstructType(elNode, nodeMap, edges, visiting) : defaultType(`${node.id}-el-${i}`));
    }
    visiting.delete(node.id);
    return { id: raw.id ?? node.id, kind: "TupleType", elements } as Type;
  }

  if (raw.kind === "VariantType" || raw.kind === "RecordType") {
    const rawFields = raw.kind === "VariantType" ? raw.variants : raw.fields;
    const count = Array.isArray(rawFields) ? rawFields.length : 0;
    const fields: { label: string; type: Type }[] = [];
    for (let i = 0; i < count; i++) {
      const label = rawFields[i]?.label ?? `l${i + 1}`;
      const fNode = firstTargetNode(byHandle, `field-${i}`, nodeMap);
      fields.push({ label, type: fNode ? reconstructType(fNode, nodeMap, edges, visiting) : defaultType(`${node.id}-field-${i}`) });
    }
    visiting.delete(node.id);
    return raw.kind === "VariantType"
      ? ({ id: raw.id ?? node.id, kind: "VariantType", variants: fields } as Type)
      : ({ id: raw.id ?? node.id, kind: "RecordType", fields } as Type);
  }

  if (raw.kind === "TyForall") {
    const typeNode = firstTargetNode(byHandle, "type", nodeMap);
    const ty: TyForall = {
      id: raw.id ?? node.id,
      kind: "TyForall",
      typeVariable: raw.typeVariable ?? "X",
      type: typeNode ? reconstructType(typeNode, nodeMap, edges, visiting) : defaultType(`${node.id}-type`),
    };
    visiting.delete(node.id);
    return ty;
  }

  if (raw.kind === "TyConstructorAbs") {
    const paramKindNode = firstTargetNode(byHandle, "paramKind", nodeMap);
    const bodyNode = firstTargetNode(byHandle, "body", nodeMap);
    const ty: TyConstructorAbs = {
      id: raw.id ?? node.id,
      kind: "TyConstructorAbs",
      typeParam: raw.typeParam ?? "X",
      paramKind: paramKindNode ? reconstructKind(paramKindNode, nodeMap, edges, visiting) : defaultKind(`${node.id}-kind`),
      body: bodyNode ? reconstructType(bodyNode, nodeMap, edges, visiting) : defaultType(`${node.id}-body`),
    };
    visiting.delete(node.id);
    return ty;
  }

  if (raw.kind === "TyConstructorApp") {
    const funcNode = firstTargetNode(byHandle, "func", nodeMap);
    const argNode = firstTargetNode(byHandle, "arg", nodeMap);
    const ty: TyConstructorApp = {
      id: raw.id ?? node.id,
      kind: "TyConstructorApp",
      func: funcNode ? reconstructType(funcNode, nodeMap, edges, visiting) : defaultType(`${node.id}-func`),
      arg: argNode ? reconstructType(argNode, nodeMap, edges, visiting) : defaultType(`${node.id}-arg`),
    };
    visiting.delete(node.id);
    return ty;
  }

  if (raw.kind === "TyPi") {
    const paramTypeNode = firstTargetNode(byHandle, "paramType", nodeMap);
    const bodyNode = firstTargetNode(byHandle, "body", nodeMap);
    const ty: TyPi = {
      id: raw.id ?? node.id,
      kind: "TyPi",
      paramVar: raw.paramVar ?? "x",
      paramType: paramTypeNode ? reconstructType(paramTypeNode, nodeMap, edges, visiting) : defaultType(`${node.id}-paramType`),
      body: bodyNode ? reconstructType(bodyNode, nodeMap, edges, visiting) : defaultType(`${node.id}-body`),
    };
    visiting.delete(node.id);
    return ty;
  }

  if (raw.kind === "TyIndexApp") {
    const funcNode = firstTargetNode(byHandle, "func", nodeMap);
    const argNode = firstTargetNode(byHandle, "arg", nodeMap);
    const ty: TyIndexApp = {
      id: raw.id ?? node.id,
      kind: "TyIndexApp",
      func: funcNode ? reconstructType(funcNode, nodeMap, edges, visiting) : defaultType(`${node.id}-func`),
      arg: argNode ? (reconstruct(argNode, nodeMap, edges, visiting) as Term) : defaultVar(`${node.id}-arg`),
    };
    visiting.delete(node.id);
    return ty;
  }

  if (raw.kind === "ListType") {
    const elementTypeNode = firstTargetNode(byHandle, "elementType", nodeMap);
    const ty: Type = {
      id: raw.id ?? node.id,
      kind: "ListType",
      elementType: elementTypeNode ? reconstructType(elementTypeNode, nodeMap, edges, visiting) : defaultType(`${node.id}-elementType`),
    } as Type;
    visiting.delete(node.id);
    return ty;
  }

  if (raw.kind === "RecursiveType") {
    const typeNode = firstTargetNode(byHandle, "type", nodeMap);
    const ty: RecursiveType = {
      id: raw.id ?? node.id,
      kind: "RecursiveType",
      typeVariable: raw.typeVariable ?? "X",
      type: typeNode ? reconstructType(typeNode, nodeMap, edges, visiting) : defaultType(`${node.id}-type`),
    };
    visiting.delete(node.id);
    return ty;
  }

  visiting.delete(node.id);
  return (raw as Type) ?? defaultType(node.id);
}

function reconstruct(node: AstFlowNode, nodeMap: NodeMap, edges: Edge[], visiting: Set<string>): ASTNode {
  if (visiting.has(node.id)) return node.data.term as ASTNode;
  visiting.add(node.id);

  const raw = node.data.term as any;
  const byHandle = groupOutgoingByHandle(edges, node.id);

  switch (raw.kind) {
    case "TyIdentifier":
    case "TyArrow":
    case "SumType":
    case "TupleType":
    case "VariantType":
    case "RecordType":
    case "TyForall":
    case "TyConstructorAbs":
    case "TyConstructorApp":
    case "TyPi":
    case "TyIndexApp":
    case "ListType":
    case "RecursiveType": {
      visiting.delete(node.id);
      return reconstructType(node, nodeMap, edges, visiting) as any;
    }

    case "Program": {
      const program: Program = {
        id: raw.id ?? node.id,
        kind: "Program",
        globals: [],
      };

      const globals: Array<{ index: number; decl: GlobalDecl }> = [];
      for (const handle of Object.keys(byHandle)) {
        const idx = parseGlobalIndex(handle);
        if (idx === null) continue;

        // Support multiple connections from a single global-decl handle
        const edgesForHandle = byHandle[handle] ?? [];
        edgesForHandle.forEach((edge, localIndex) => {
          if (!edge?.target) return;
          const targetNode = nodeMap.get(edge.target);
          if (!targetNode) return;
          const effectiveIndex = handle === "global-decl" ? localIndex : idx;
          globals.push({
            index: effectiveIndex,
            decl: reconstruct(targetNode, nodeMap, edges, visiting) as GlobalDecl,
          });
        });
      }

      globals.sort((a, b) => a.index - b.index);
      program.globals = globals.map((g) => g.decl);

      const termNode = firstTargetNode(byHandle, "term", nodeMap);
      if (termNode) program.term = reconstruct(termNode, nodeMap, edges, visiting) as Term;

      visiting.delete(node.id);
      return program;
    }

    case "VarDecl": {
      const vd: VarDecl = {
        id: raw.id ?? node.id,
        kind: "VarDecl",
        name: raw.name ?? "a",
        type: defaultType(`${node.id}-type`),
        value: {} as Term,
      };

      // type can come from edge
      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      if (typeNode) vd.type = reconstructType(typeNode, nodeMap, edges, visiting);
      else if (raw.type) vd.type = raw.type as Type;

      const valueNode = firstTargetNode(byHandle, "value", nodeMap);
      if (valueNode) vd.value = reconstruct(valueNode, nodeMap, edges, visiting) as Term;
      visiting.delete(node.id);
      return vd;
    }

    case "TypeAliasDecl": {
      const ta: TypeAliasDecl = {
        id: raw.id ?? node.id,
        kind: "TypeAliasDecl",
        name: raw.name ?? "MyType",
        type: defaultType(`${node.id}-type`),
      };

      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      if (typeNode) ta.type = reconstructType(typeNode, nodeMap, edges, visiting);
      else if (raw.type) ta.type = raw.type as Type;

      visiting.delete(node.id);
      return ta;
    }

    case "TypeConstructorDecl": {
      const paramKindNode = firstTargetNode(byHandle, "paramKind", nodeMap);
      const tcd: TypeConstructorDecl = {
        id: raw.id ?? node.id,
        kind: "TypeConstructorDecl",
        name: raw.name ?? "MyType",
        paramKind: paramKindNode ? reconstructKind(paramKindNode, nodeMap, edges, visiting) : defaultKind(`${node.id}-kind`),
      };
      visiting.delete(node.id);
      return tcd;
    }

    case "FunDecl": {
      const fd: FunDecl = {
        id: raw.id ?? node.id,
        kind: "FunDecl",
        name: raw.name ?? "f",
        type: defaultType(`${node.id}-type`),
        value: defaultVar(`${node.id}-value`, "x"),
      };

      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      if (typeNode) fd.type = reconstructType(typeNode, nodeMap, edges, visiting);
      else if (raw.type) fd.type = raw.type as Type;

      const valueNode = firstTargetNode(byHandle, "value", nodeMap);
      if (valueNode) fd.value = reconstruct(valueNode, nodeMap, edges, visiting) as Term;
      visiting.delete(node.id);
      return fd;
    }

    case "Abs": {
      const abs: Abs = {
        id: raw.id ?? node.id,
        kind: "Abs",
        param: raw.param ?? "x",
        paramType: defaultType(`${node.id}-paramType`),
        body: defaultVar(`${node.id}-body`, "x"),
        type: defaultType(`${node.id}-type`),
      };

      const paramTypeNode = firstTargetNode(byHandle, "paramType", nodeMap);
      if (paramTypeNode) abs.paramType = reconstructType(paramTypeNode, nodeMap, edges, visiting);
      else if (raw.paramType) abs.paramType = raw.paramType as Type;

      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      if (typeNode) abs.type = reconstructType(typeNode, nodeMap, edges, visiting);
      else if (raw.type) abs.type = raw.type as Type;

      const bodyNode = firstTargetNode(byHandle, "body", nodeMap);
      if (bodyNode) abs.body = reconstruct(bodyNode, nodeMap, edges, visiting) as Term;

      visiting.delete(node.id);
      return abs;
    }

    case "App": {
      const app: App = {
        id: raw.id ?? node.id,
        kind: "App",
        func: defaultVar(`${node.id}-func`, "f"),
        arg: defaultVar(`${node.id}-arg`, "x"),
      };
      const funcNode = firstTargetNode(byHandle, "left", nodeMap);
      if (funcNode) app.func = reconstruct(funcNode, nodeMap, edges, visiting) as Term;
      const argNode = firstTargetNode(byHandle, "right", nodeMap);
      if (argNode) app.arg = reconstruct(argNode, nodeMap, edges, visiting) as Term;
      visiting.delete(node.id);
      return app;
    }

    case "Var": {
      const v: Var = { id: raw.id ?? node.id, kind: "Var", name: raw.name ?? "x" };
      visiting.delete(node.id);
      return v;
    }

    case "Lit": {
      const lit = { id: raw.id ?? node.id, kind: "Lit", value: String(raw.value ?? "0") };
      visiting.delete(node.id);
      return lit as any;
    }

    case "Inl":
    case "Inr": {
      const termNode = firstTargetNode(byHandle, "term", nodeMap);
      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: raw.kind,
        term: termNode ? reconstruct(termNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-term`),
        type: typeNode ? reconstructType(typeNode, nodeMap, edges, visiting) : (raw.type as Type) ?? defaultType(`${node.id}-type`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "Ascribe": {
      const termNode = firstTargetNode(byHandle, "term", nodeMap);
      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "Ascribe",
        term: termNode ? reconstruct(termNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-term`),
        type: typeNode ? reconstructType(typeNode, nodeMap, edges, visiting) : (raw.type as Type) ?? defaultType(`${node.id}-type`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "TupleProjection": {
      const tupleNode = firstTargetNode(byHandle, "tuple", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "TupleProjection",
        tuple: tupleNode ? reconstruct(tupleNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-tuple`, "t"),
        index: typeof raw.index === "number" ? raw.index : 1,
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "RecordProjection": {
      const termNode = firstTargetNode(byHandle, "term", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "RecordProjection",
        term: termNode ? reconstruct(termNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-term`, "r"),
        label: raw.label ?? "l",
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "Sequencing": {
      const firstNode = firstTargetNode(byHandle, "first", nodeMap);
      const secondNode = firstTargetNode(byHandle, "second", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "Sequencing",
        first: firstNode ? reconstruct(firstNode, nodeMap, edges, visiting) as Term : unitLit(`${node.id}-first`),
        second: secondNode ? reconstruct(secondNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-second`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "DummyAbstraction": {
      const paramTypeNode = firstTargetNode(byHandle, "paramType", nodeMap);
      const bodyNode = firstTargetNode(byHandle, "body", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "DummyAbstraction",
        paramType: paramTypeNode ? reconstructType(paramTypeNode, nodeMap, edges, visiting) : (raw.paramType as Type) ?? defaultType(`${node.id}-paramType`),
        body: bodyNode ? reconstruct(bodyNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-body`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "Tuple": {
      const count = Array.isArray(raw.elements) ? raw.elements.length : 0;
      const elements: Term[] = [];
      for (let i = 0; i < count; i++) {
        const elNode = firstTargetNode(byHandle, `el-${i}`, nodeMap);
        elements.push(elNode ? reconstruct(elNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-el-${i}`));
      }
      const result = { id: raw.id ?? node.id, kind: "Tuple", elements };
      visiting.delete(node.id);
      return result as any;
    }

    case "Record": {
      const count = Array.isArray(raw.fields) ? raw.fields.length : 0;
      const fields: { label: string; term: Term }[] = [];
      for (let i = 0; i < count; i++) {
        const label = raw.fields[i]?.label ?? `l${i + 1}`;
        const fNode = firstTargetNode(byHandle, `field-${i}`, nodeMap);
        fields.push({ label, term: fNode ? reconstruct(fNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-field-${i}`) });
      }
      const result = { id: raw.id ?? node.id, kind: "Record", fields };
      visiting.delete(node.id);
      return result as any;
    }

    case "Variant": {
      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      const count = Array.isArray(raw.variants) ? raw.variants.length : 0;
      const variants: { label: string; term: Term }[] = [];
      for (let i = 0; i < count; i++) {
        const label = raw.variants[i]?.label ?? `l${i + 1}`;
        const fNode = firstTargetNode(byHandle, `field-${i}`, nodeMap);
        variants.push({ label, term: fNode ? reconstruct(fNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-field-${i}`) });
      }
      const result = {
        id: raw.id ?? node.id,
        kind: "Variant",
        type: typeNode ? reconstructType(typeNode, nodeMap, edges, visiting) : (raw.type as Type) ?? defaultType(`${node.id}-type`),
        variants,
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "IfCondition": {
      const conditionNode = firstTargetNode(byHandle, "condition", nodeMap);
      const thenNode = firstTargetNode(byHandle, "then", nodeMap);
      const elifCount = Array.isArray(raw.elif) ? raw.elif.length : 0;
      const elif: { condition: Term; then: Term }[] = [];
      for (let i = 0; i < elifCount; i++) {
        const cNode = firstTargetNode(byHandle, `elif-${i}-condition`, nodeMap);
        const tNode = firstTargetNode(byHandle, `elif-${i}-then`, nodeMap);
        elif.push({
          condition: cNode ? reconstruct(cNode, nodeMap, edges, visiting) as Term : boolLit(`${node.id}-elif-${i}-cond`, "false"),
          then: tNode ? reconstruct(tNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-elif-${i}-then`),
        });
      }
      const result: any = {
        id: raw.id ?? node.id,
        kind: "IfCondition",
        condition: conditionNode ? reconstruct(conditionNode, nodeMap, edges, visiting) as Term : boolLit(`${node.id}-cond`, "true"),
        then: thenNode ? reconstruct(thenNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-then`),
      };
      if (elifCount > 0) result.elif = elif;
      if (raw.else !== undefined && raw.else !== null) {
        const elseNode = firstTargetNode(byHandle, "else", nodeMap);
        result.else = elseNode ? reconstruct(elseNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-else`);
      }
      visiting.delete(node.id);
      return result;
    }

    case "Case": {
      const variableNode = firstTargetNode(byHandle, "variable", nodeMap);
      const inlNode = firstTargetNode(byHandle, "inl-term", nodeMap);
      const inrNode = firstTargetNode(byHandle, "inr-term", nodeMap);
      const inlVar = raw.inl?.variable ?? "x";
      const inrVar = raw.inr?.variable ?? "y";
      const result = {
        id: raw.id ?? node.id,
        kind: "Case",
        variable: variableNode ? reconstruct(variableNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-variable`, "s"),
        inl: { variable: inlVar, term: inlNode ? reconstruct(inlNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-inl`, inlVar) },
        inr: { variable: inrVar, term: inrNode ? reconstruct(inrNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-inr`, inrVar) },
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "VariantCase": {
      const variableNode = firstTargetNode(byHandle, "variable", nodeMap);
      const count = Array.isArray(raw.cases) ? raw.cases.length : 0;
      const cases: { label: string; variable: string; body: Term }[] = [];
      for (let i = 0; i < count; i++) {
        const label = raw.cases[i]?.label ?? `l${i + 1}`;
        const variable = raw.cases[i]?.variable ?? "x";
        const cNode = firstTargetNode(byHandle, `case-${i}`, nodeMap);
        cases.push({ label, variable, body: cNode ? reconstruct(cNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-case-${i}`, variable) });
      }
      const result = {
        id: raw.id ?? node.id,
        kind: "VariantCase",
        variable: variableNode ? reconstruct(variableNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-variable`, "s"),
        cases,
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "Let": {
      const valueNode = firstTargetNode(byHandle, "value", nodeMap);
      const bodyNode = firstTargetNode(byHandle, "body", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "Let",
        name: raw.name ?? "x",
        value: valueNode ? reconstruct(valueNode, nodeMap, edges, visiting) as Term : ({id: `${node.id}-value`, kind: "Lit", value: "0"} as Term),
        body: bodyNode ? reconstruct(bodyNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-body`, raw.name ?? "x"),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "BinOp": {
      const leftNode = firstTargetNode(byHandle, "leftOperand", nodeMap);
      const rightNode = firstTargetNode(byHandle, "rightOperand", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "BinOp",
        operator: raw.operator ?? "+",
        left: leftNode ? reconstruct(leftNode, nodeMap, edges, visiting) as Term : ({id: `${node.id}-leftOperand`, kind: "Lit", value: "0"} as Term),
        right: rightNode ? reconstruct(rightNode, nodeMap, edges, visiting) as Term : ({id: `${node.id}-rightOperand`, kind: "Lit", value: "0"} as Term),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "Fix": {
      const termNode = firstTargetNode(byHandle, "term", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "Fix",
        term: termNode ? reconstruct(termNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-term`, "f"),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "Succ":
    case "Pred":
    case "IsZero": {
      const termNode = firstTargetNode(byHandle, "term", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: raw.kind,
        term: termNode ? reconstruct(termNode, nodeMap, edges, visiting) as Term : ({id: `${node.id}-term`, kind: "Lit", value: "0"} as Term),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "TypeAbs": {
      const bodyNode = firstTargetNode(byHandle, "body", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "TypeAbs",
        typeParam: raw.typeParam ?? "X",
        body: bodyNode ? reconstruct(bodyNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-body`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "TypeApp": {
      const termNode = firstTargetNode(byHandle, "term", nodeMap);
      const typeArgNode = firstTargetNode(byHandle, "typeArg", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "TypeApp",
        term: termNode ? reconstruct(termNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-term`, "f"),
        typeArg: typeArgNode ? reconstructType(typeArgNode, nodeMap, edges, visiting) : (raw.typeArg as Type) ?? defaultType(`${node.id}-typeArg`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "Nil": {
      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "Nil",
        type: typeNode ? reconstructType(typeNode, nodeMap, edges, visiting) : (raw.type as Type) ?? defaultType(`${node.id}-type`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "Cons": {
      const headNode = firstTargetNode(byHandle, "head", nodeMap);
      const tailNode = firstTargetNode(byHandle, "tail", nodeMap);
      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: "Cons",
        head: headNode ? reconstruct(headNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-head`),
        tail: tailNode ? reconstruct(tailNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-tail`),
        type: typeNode ? reconstructType(typeNode, nodeMap, edges, visiting) : (raw.type as Type) ?? defaultType(`${node.id}-type`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    case "IsNil":
    case "Head":
    case "Tail":
    case "Fold":
    case "Unfold": {
      const termNode = firstTargetNode(byHandle, "term", nodeMap);
      const typeNode = firstTargetNode(byHandle, "type", nodeMap);
      const result = {
        id: raw.id ?? node.id,
        kind: raw.kind,
        term: termNode ? reconstruct(termNode, nodeMap, edges, visiting) as Term : defaultVar(`${node.id}-term`),
        type: typeNode ? reconstructType(typeNode, nodeMap, edges, visiting) : (raw.type as Type) ?? defaultType(`${node.id}-type`),
      };
      visiting.delete(node.id);
      return result as any;
    }

    default:
      visiting.delete(node.id);
      return node.data.term as ASTNode;
  }
}

const isTermKind = (kind: unknown) =>
  typeof kind === "string" && !kind.startsWith("Ty") && !kind.endsWith("Type") && !kind.startsWith("Kind");

// With several unconnected candidates the largest tree wins; the others count as loose nodes.
function rootTermNode(graph: AstFlowGraph): AstFlowGraph["nodes"][number] | undefined {
  const hasParent = new Set(graph.edges.map((edge) => edge.target));
  const childrenOf = new Map<string, string[]>();
  graph.edges.forEach((edge) => childrenOf.set(edge.source, [...(childrenOf.get(edge.source) ?? []), edge.target]));
  const size = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    return 1 + (childrenOf.get(id) ?? []).reduce((sum, child) => sum + size(child, seen), 0);
  };
  return graph.nodes
    .filter((node) => !hasParent.has(node.id) && isTermKind((node.data as {term?: {kind?: unknown}})?.term?.kind))
    .sort((a, b) => size(b.id) - size(a.id))[0];
}

export function graphToAst(graph: AstFlowGraph): Program {
  const programNode = graph.nodes.find((n) => n.type === "program");
  const nodeMap: NodeMap = new Map(graph.nodes.map((n) => [n.id, n] as const));

  if (!programNode) {
    // Builders without declarations have no Program node: the root term is a node nothing points into.
    const root = rootTermNode(graph);
    return {
      id: "program-rootless",
      kind: "Program",
      globals: [],
      ...(root ? {term: reconstruct(root, nodeMap, graph.edges, new Set()) as Term} : {}),
    };
  }

  return reconstruct(programNode, nodeMap, graph.edges, new Set()) as Program;
}
