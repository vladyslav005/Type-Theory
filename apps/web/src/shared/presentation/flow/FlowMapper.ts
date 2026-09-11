import type {Edge} from "@xyflow/react";
import type {
  Abs,
  App,
  Ascribe,
  ASTNode,
  BinOp,
  Case,
  Cons,
  DummyAbstraction,
  Fix,
  Fold,
  FunDecl,
  Head,
  IfCondition,
  Inl,
  Inr,
  IsNil,
  Kind,
  Let,
  Lit,
  Nil,
  Program,
  Record as RecordTerm,
  RecordProjection,
  Sequencing,
  Tail,
  Tuple,
  TupleProjection,
  TyConstructorAbs,
  TyConstructorApp,
  Type,
  TypeAbs,
  TypeAliasDecl,
  TypeApp,
  TypeConstructorDecl,
  Unfold,
  Var,
  VarDecl,
  Variant,
  VariantCase,
} from "@vladyslav005/tt-core";
import {AstVisitor} from "@vladyslav005/tt-core";
import type {AstFlowGraph, AstFlowNode} from "@/shared/presentation/flow/types.ts";

export class AstFlowMapper extends AstVisitor<void> {
  private nodes: AstFlowNode[] = [];
  private edges: Edge[] = [];
  private visitedNodes: Set<string> = new Set();
  private visitedEdges: Set<string> = new Set();

  map(root: ASTNode): AstFlowGraph {
    this.nodes = [];
    this.edges = [];
    this.visitedNodes = new Set();
    this.visitedEdges = new Set();
    this.visit(root);
    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }

  protected visitProgram(node: Program): void {
    if (node.term) {
      this.visit(node.term);
      this.pushEdge({
        id: `e-${node.id}-term-${node.term.id}`,
        source: node.id,
        sourceHandle: "term",
        target: node.term.id,
      });
    }

    this.pushNode(node);

    node.globals.forEach((decl) => {
      this.visit(decl);
      this.pushEdge({
        id: `e-${node.id}-global-${decl.id}`,
        source: node.id,
        sourceHandle: `global-decl`,
        target: decl.id,
      });
    });
  }

  protected visitVar(node: Var): void {
    this.pushNode(node);
  }

  protected visitAbs(node: Abs): void {
    this.pushNode(node);

    // paramType (omitted for an unannotated parameter, e.g. inside a let)
    if (node.paramType) {
      this.visit(node.paramType as any);
      this.pushEdge({
        id: `e-${node.id}-paramType-${(node.paramType as any).id}`,
        source: node.id,
        sourceHandle: "paramType",
        target: (node.paramType as any).id,
      });
    }

    if (node.type) {
      this.visit((node as any).type);
      this.pushEdge({
        id: `e-${node.id}-type-${(node as any).type.id}`,
        source: node.id,
        sourceHandle: "type",
        target: (node as any).type.id,
      });
    }

    this.visit(node.body);
    this.pushEdge({
      id: `e-${node.id}-body-${node.body.id}`,
      source: node.id,
      sourceHandle: "body",
      target: node.body.id,
    });
  }

  protected visitApp(node: App): void {
    this.pushNode(node);
    this.visit(node.arg);
    this.visit(node.func);
    this.pushEdge({
      id: `e-${node.id}-arg-${node.arg.id}`,
      source: node.id,
      sourceHandle: "right",
      target: node.arg.id,
    });
    this.pushEdge({
      id: `e-${node.id}-func-${node.func.id}`,
      source: node.id,
      sourceHandle: "left",
      target: node.func.id,
    });
  }

  protected visitLit(node: Lit): void {
    this.pushNode(node);
  }

  protected visitTermDecl(node: FunDecl): void {
    this.pushNode(node);

    if (node.type) {
      this.visit(node.type);
      this.pushEdge({
        id: `e-${node.id}-type-${node.type.id}`,
        source: node.id,
        sourceHandle: "type",
        target: node.type.id,
      });
    }

    this.visit(node.value);
    this.pushEdge({
      id: `e-${node.id}-value-${node.value.id}`,
      source: node.id,
      sourceHandle: "value",
      target: node.value.id,
    });
  }

  protected visitTypeDecl(node: VarDecl): void {
    this.pushNode(node);

    this.visit((node as any).type);
    this.pushEdge({
      id: `e-${node.id}-type-${(node as any).type.id}`,
      source: node.id,
      sourceHandle: "type",
      target: (node as any).type.id,
    });

    this.pushEdge({
      id: `e-${node.id}-value-${node.value.id}`,
      source: node.id,
      sourceHandle: "value",
      target: node.value.id,
    });
  }

  protected visitTypeAliasDecl(node: TypeAliasDecl): void {
    this.pushNode(node);
    this.visitChild(node, "type", "type", node.type);
  }

  protected visitTypeConstructorDecl(node: TypeConstructorDecl): void {
    this.pushNode(node);
    this.visitChild(node, "paramKind", "kind", node.paramKind);
  }

  protected visitType(node: Type): void {
    this.pushNode(node);

    switch (node.kind) {
      case "TyArrow":
        this.visitChild(node, "to", "to", node.to);
        this.visitChild(node, "from", "from", node.from);
        return;

      case "SumType":
        this.visitChild(node, "left", "left", node.left);
        this.visitChild(node, "right", "right", node.right);
        return;

      case "TupleType":
        node.elements.forEach((el, i) => {
          this.visitChild(node, `el-${i}`, `#${i + 1}`, el);
        });
        return;

      case "VariantType":
        node.variants.forEach((v, i) => {
          this.visitChild(node, `field-${i}`, v.label, v.type);
        });
        return;

      case "RecordType":
        node.fields.forEach((f, i) => {
          this.visitChild(node, `field-${i}`, f.label, f.type);
        });
        return;

      case "TyIdentifier":
        return;

      case "TyForall":
        this.visitChild(node, "type", "type", node.type);
        return;

      case "TyConstructorAbs":
        this.visitChild(node, "body", "body", node.body);
        return;

      case "TyConstructorApp":
        this.visitChild(node, "func", "func", node.func);
        this.visitChild(node, "arg", "arg", node.arg);
        return;

      case "TyPi":
        this.visitChild(node, "body", "body", node.body);
        this.visitChild(node, "paramType", "paramType", node.paramType);
        return;

      case "TyIndexApp":
        this.visitChild(node, "arg", "arg", node.arg);
        this.visitChild(node, "func", "func", node.func);
        return;

      case "ListType":
        this.visitChild(node, "elementType", "elem", node.elementType);
        return;

      case "RecursiveType":
        this.visitChild(node, "type", "body", node.type);
        return;
    }
  }

  protected visitInl(node: Inl): void {
    this.pushNode(node);
    this.visitChild(node, "type", "as", node.type);
    this.visitChild(node, "term", "term", node.term);
  }

  protected visitInr(node: Inr): void {
    this.pushNode(node);
    this.visitChild(node, "type", "as", node.type);
    this.visitChild(node, "term", "term", node.term);

  }

  protected visitIfCondition(node: IfCondition): void {
    this.pushNode(node);
    this.visitChild(node, "condition", "cond", node.condition);
    this.visitChild(node, "then", "then", node.then);
    (node.elif ?? []).forEach((branch, i) => {
      this.visitChild(node, `elif-${i}-condition`, `elseif ${i + 1} cond`, branch.condition);
      this.visitChild(node, `elif-${i}-then`, `elseif ${i + 1} then`, branch.then);
    });
    if (node.else) {
      this.visitChild(node, "else", "else", node.else);
    }
  }

  protected visitCase(node: Case): void {
    this.pushNode(node);
    this.visitChild(node, "variable", "scrutinee", node.variable);
    this.visitChild(node, "inl-term", `inl ${node.inl.variable}`, node.inl.term);
    this.visitChild(node, "inr-term", `inr ${node.inr.variable}`, node.inr.term);
  }

  protected visitVariantCase(node: VariantCase): void {
    this.pushNode(node);
    this.visitChild(node, "variable", "scrutinee", node.variable);
    node.cases.forEach((c, i) => {
      this.visitChild(node, `case-${i}`, `[${c.label}=${c.variable}]`, c.body);
    });
  }

  protected visitVariant(node: Variant): void {
    this.pushNode(node);
    this.visitChild(node, "type", "as", node.type);
    node.variants.forEach((v, i) => {
      this.visitChild(node, `field-${i}`, v.label, v.term);
    });
  }

  protected visitAscribe(node: Ascribe): void {
    this.pushNode(node);
    this.visitChild(node, "term", "term", node.term);
    this.visitChild(node, "type", "as", node.type);
  }

  protected visitTupleProjection(node: TupleProjection): void {
    this.pushNode(node);
    this.visitChild(node, "tuple", "tuple", node.tuple);
  }

  protected visitRecordProjection(node: RecordProjection): void {
    this.pushNode(node);
    this.visitChild(node, "term", "record", node.term);
  }

  protected visitRecord(node: RecordTerm): void {
    this.pushNode(node);
    node.fields.forEach((f, i) => {
      this.visitChild(node, `field-${i}`, f.label, f.term);
    });
  }

  protected visitSequencing(node: Sequencing): void {
    this.pushNode(node);
    this.visitChild(node, "first", "1st", node.first);
    this.visitChild(node, "second", "2nd", node.second);
  }

  protected visitTuple(node: Tuple): void {
    this.pushNode(node);
    node.elements.forEach((e, i) => {
      this.visitChild(node, `el-${i}`, `#${i + 1}`, e);
    });
  }

  protected visitDummyAbstraction(node: DummyAbstraction): void {
    this.pushNode(node);
    this.visitChild(node, "paramType", "param", node.paramType);
    this.visitChild(node, "body", "body", node.body);
  }

  protected visitLet(node: Let): void {
    this.pushNode(node);
    this.visitChild(node, "body", "body", node.body);
    this.visitChild(node, "value", "value", node.value);

  }

  protected visitBinOp(node: BinOp): void {
    this.pushNode(node);
    this.visitChild(node, "rightOperand", "right", node.right);
    this.visitChild(node, "leftOperand", "left", node.left);
  }

  protected visitFix(node: Fix): void {
    this.pushNode(node);
    this.visitChild(node, "term", "t", node.term);
  }

  protected visitNil(node: Nil): void {
    this.pushNode(node);
    this.visitChild(node, "type", "type", node.type);
  }

  protected visitCons(node: Cons): void {
    this.pushNode(node);
    this.visitChild(node, "head", "head", node.head);
    this.visitChild(node, "tail", "tail", node.tail);
    this.visitChild(node, "type", "type", node.type);
  }

  protected visitIsNil(node: IsNil): void {
    this.pushNode(node);
    this.visitChild(node, "type", "type", node.type);
    this.visitChild(node, "term", "list", node.term);
  }

  protected visitHead(node: Head): void {
    this.pushNode(node);
    this.visitChild(node, "term", "list", node.term);
    this.visitChild(node, "type", "type", node.type);
  }

  protected visitTail(node: Tail): void {
    this.pushNode(node);
    this.visitChild(node, "term", "list", node.term);
    this.visitChild(node, "type", "type", node.type);
  }

  protected visitFold(node: Fold): void {
    this.pushNode(node);
    this.visitChild(node, "term", "term", node.term);
    this.visitChild(node, "type", "type", node.type);
  }

  protected visitUnfold(node: Unfold): void {
    this.pushNode(node);
    this.visitChild(node, "term", "term", node.term);
    this.visitChild(node, "type", "type", node.type);
  }

  protected visitTypeAbstraction(node: TypeAbs): void {
    this.pushNode(node);
    this.visitChild(node, "body", "body", node.body);
  }

  protected visitTypeApplication(node: TypeApp): void {
    this.pushNode(node);
    this.visitChild(node, "typeArg", "[T]", node.typeArg);
    this.visitChild(node, "term", "term", node.term);
  }

  protected visitTypeConstructorAbstraction(node: TyConstructorAbs): void {
    this.pushNode(node);
    this.visitChild(node, "paramKind", "kind", node.paramKind);
    this.visitChild(node, "body", "body", node.body);
  }

  protected visitTypeConstructorApplication(node: TyConstructorApp): void {
    this.pushNode(node);
    this.visitChild(node, "arg", "arg", node.arg);
    this.visitChild(node, "func", "func", node.func);
  }

  protected visitKind(node: Kind): void {
    this.pushNode(node);
    if (node.kind === "KindArrow") {
      // System λP: `from` may be a Type (T→K) rather than another Kind (K→K) — either way it's
      // a normal ASTNode, so the generic double-dispatch in `visit` routes it correctly.
      this.visitChild(node, "to", "to", node.to);
      this.visitChild(node, "from", "from", node.from);
    }
  }

  private visitChild(parent: ASTNode, handle: string, label: string, child: ASTNode): void {
    this.visit(child);
    this.pushEdge({
      id: `e-${parent.id}-${handle}-${child.id}`,
      source: parent.id,
      sourceHandle: handle,
      target: child.id,
      label,
    });
  }

  private pushNode(node: ASTNode): void {
    if (this.visitedNodes.has(node.id)) {
      return;
    }

    this.visitedNodes.add(node.id);
    switch (node.kind) {
      case "Program":
        this.nodes.push({
          id: node.id,
          type: "program",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "FunDecl":
        this.nodes.push({
          id: node.id,
          type: "funDecl",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "VarDecl":
        this.nodes.push({
          id: node.id,
          type: "varDecl",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "TypeAliasDecl":
        this.nodes.push({
          id: node.id,
          type: "typeAliasDecl",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "TypeConstructorDecl":
        this.nodes.push({
          id: node.id,
          type: "typeConstructorDecl",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "Var":
        this.nodes.push({
          id: node.id,
          type: "variable",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "Abs":
        this.nodes.push({
          id: node.id,
          type: "abstraction",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "App":
        this.nodes.push({
          id: node.id,
          type: "application",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "Lit":
        this.nodes.push({
          id: node.id,
          type: "literal",
          position: {x: 0, y: 0},
          data: {term: node},
        });
        return;
      case "TyIdentifier":
      case "TyArrow":
      case "TupleType":
      case "SumType":
      case "VariantType":
      case "RecordType":
      case "ListType":
      case "RecursiveType":
        this.nodes.push({
          id: node.id,
          type: "type",
          position: {x: 0, y: 0},
          data: {term: node as any},
        } as any);
        return;
      case "Inl":
        this.nodes.push({id: node.id, type: "inl", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Inr":
        this.nodes.push({id: node.id, type: "inr", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "IfCondition":
        this.nodes.push({id: node.id, type: "ifCondition", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Case":
        this.nodes.push({id: node.id, type: "case", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "VariantCase":
        this.nodes.push({id: node.id, type: "variantCase", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Variant":
        this.nodes.push({id: node.id, type: "variant", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Ascribe":
        this.nodes.push({id: node.id, type: "ascribe", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "TupleProjection":
        this.nodes.push({id: node.id, type: "tupleProjection", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "RecordProjection":
        this.nodes.push({id: node.id, type: "recordProjection", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Record":
        this.nodes.push({id: node.id, type: "record", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Sequencing":
        this.nodes.push({id: node.id, type: "sequencing", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Tuple":
        this.nodes.push({id: node.id, type: "tuple", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "DummyAbstraction":
        this.nodes.push({id: node.id, type: "dummyAbstraction", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Let":
        this.nodes.push({id: node.id, type: "let", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "BinOp":
        this.nodes.push({id: node.id, type: "binOp", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Fix":
        this.nodes.push({id: node.id, type: "fix", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Nil":
        this.nodes.push({id: node.id, type: "nil", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Cons":
        this.nodes.push({id: node.id, type: "cons", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "IsNil":
        this.nodes.push({id: node.id, type: "isNil", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Head":
        this.nodes.push({id: node.id, type: "headOp", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Tail":
        this.nodes.push({id: node.id, type: "tailOp", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Fold":
        this.nodes.push({id: node.id, type: "fold", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "Unfold":
        this.nodes.push({id: node.id, type: "unfold", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "TypeAbs":
        this.nodes.push({id: node.id, type: "typeAbs", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "TypeApp":
        this.nodes.push({id: node.id, type: "typeApp", position: {x: 0, y: 0}, data: {term: node}});
        return;
      case "TyForall":
      case "TyConstructorAbs":
      case "TyConstructorApp":
      case "TyPi":
      case "TyIndexApp":
        this.nodes.push({id: node.id, type: "type", position: {x: 0, y: 0}, data: {term: node as any}} as any);
        return;
      case "StarKind":
      case "KindArrow":
        this.nodes.push({id: node.id, type: "kind", position: {x: 0, y: 0}, data: {term: node as any}} as any);
        return;
    }
  }

  private static readonly HANDLE_LABELS: Record<string, string> = {
    "global-decl": "decl",
    "term": "term",
    "body": "body",
    "paramType": "param",
    "type": "type",
    "value": "value",
    "left": "fn",
    "right": "arg",
    "leftOperand": "left",
    "rightOperand": "right",
    "from": "from",
    "to": "to",
    "typeArg": "[T]",
  };

  private pushEdge(edge: Edge): void {
    if (this.visitedEdges.has(edge.id)) return;
    this.visitedEdges.add(edge.id);
    const label = edge.label ?? (edge.sourceHandle ? AstFlowMapper.HANDLE_LABELS[edge.sourceHandle] : undefined);
    this.edges.push(label !== undefined ? { ...edge, label } : edge);
  }
}
