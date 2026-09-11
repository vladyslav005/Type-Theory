import type {Program} from "@vladyslav005/tt-core";
import {useCallback, useState, useEffect, useRef, forwardRef, useImperativeHandle} from "react";
import {useTranslation} from "react-i18next";
import {
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  SelectionMode,
  type NodeTypes,
  type Connection,
  type Node,
  type Edge,
  useReactFlow,
  type OnConnectStart,
  type OnConnectEnd,
} from "@xyflow/react";
import '@xyflow/react/dist/style.css';
import {useTheme} from "next-themes";
import type {AstFlowGraph} from "@/shared/presentation/flow/types.ts";
import {AbstractionFlowNode} from "@/features/ast/components/ast/flow/AbstractionFlowNode.tsx";
import {VariableFlowNode} from "@/features/ast/components/ast/flow/VariableFlowNode.tsx";
import {ApplicationFlowNode} from "@/features/ast/components/ast/flow/ApplicationFlowNode.tsx";
import {ProgramFlowNode} from "@/features/ast/components/ast/flow/ProgramFlowNode.tsx";
import {FunDeclFlowNode} from "@/features/ast/components/ast/flow/FunDeclFlowNode.tsx";
import {VarDeclFlowNode} from "@/features/ast/components/ast/flow/VarDeclFlowNode.tsx";
import {TypeAliasDeclFlowNode} from "@/features/ast/components/ast/flow/TypeAliasDeclFlowNode.tsx";
import {LiteralFlowNode} from "@/features/ast/components/ast/flow/LiteralFlowNode.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {Input} from "@/shared/components/ui/input.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/shared/components/ui/popover.tsx";
import {graphToAst} from "@/features/ast/hooks/graphToAst";
import {layoutAstFlow} from "@/features/ast/hooks/layoutAstFlow.ts";
import {useFitViewOnChange} from "@/features/ast/hooks/useFitViewOnChange.ts";
import type {TyArrow, TyIdentifier} from "@vladyslav005/tt-core";
import {TyIdentifierFlowNode} from "@/features/ast/components/ast/flow/TyIdentifierFlowNode";
import {TyArrowFlowNode} from "@/features/ast/components/ast/flow/TyArrowFlowNode";
import {SumTypeFlowNode} from "@/features/ast/components/ast/flow/SumTypeFlowNode";
import {TupleTypeFlowNode} from "@/features/ast/components/ast/flow/TupleTypeFlowNode";
import {VariantTypeFlowNode} from "@/features/ast/components/ast/flow/VariantTypeFlowNode";
import {RecordTypeFlowNode} from "@/features/ast/components/ast/flow/RecordTypeFlowNode";
import {InlFlowNode} from "@/features/ast/components/ast/flow/InlFlowNode";
import {InrFlowNode} from "@/features/ast/components/ast/flow/InrFlowNode";
import {IfConditionFlowNode} from "@/features/ast/components/ast/flow/IfConditionFlowNode";
import {CaseFlowNode} from "@/features/ast/components/ast/flow/CaseFlowNode";
import {VariantCaseFlowNode} from "@/features/ast/components/ast/flow/VariantCaseFlowNode";
import {VariantFlowNode} from "@/features/ast/components/ast/flow/VariantFlowNode";
import {AscribeFlowNode} from "@/features/ast/components/ast/flow/AscribeFlowNode";
import {TupleProjectionFlowNode} from "@/features/ast/components/ast/flow/TupleProjectionFlowNode";
import {RecordProjectionFlowNode} from "@/features/ast/components/ast/flow/RecordProjectionFlowNode";
import {RecordFlowNode} from "@/features/ast/components/ast/flow/RecordFlowNode";
import {SequencingFlowNode} from "@/features/ast/components/ast/flow/SequencingFlowNode";
import {TupleFlowNode} from "@/features/ast/components/ast/flow/TupleFlowNode";
import {DummyAbstractionFlowNode} from "@/features/ast/components/ast/flow/DummyAbstractionFlowNode";
import {LetFlowNode} from "@/features/ast/components/ast/flow/LetFlowNode";
import {BinOpFlowNode} from "@/features/ast/components/ast/flow/BinOpFlowNode";
import {FixFlowNode} from "@/features/ast/components/ast/flow/FixFlowNode";
import {TypeAbstractionFlowNode} from "@/features/ast/components/ast/flow/TypeAbstractionFlowNode";
import {TypeApplicationFlowNode} from "@/features/ast/components/ast/flow/TypeApplicationFlowNode";
import {TyForallFlowNode} from "@/features/ast/components/ast/flow/TyForallFlowNode";
import {TyConstructorAbsFlowNode} from "@/features/ast/components/ast/flow/TyConstructorAbsFlowNode";
import {TyConstructorAppFlowNode} from "@/features/ast/components/ast/flow/TyConstructorAppFlowNode";
import {TyPiFlowNode} from "@/features/ast/components/ast/flow/TyPiFlowNode";
import {TyIndexAppFlowNode} from "@/features/ast/components/ast/flow/TyIndexAppFlowNode";
import {TypeConstructorDeclFlowNode} from "@/features/ast/components/ast/flow/TypeConstructorDeclFlowNode";
import {NilFlowNode} from "@/features/ast/components/ast/flow/NilFlowNode";
import {ConsFlowNode} from "@/features/ast/components/ast/flow/ConsFlowNode";
import {IsNilFlowNode} from "@/features/ast/components/ast/flow/IsNilFlowNode";
import {HeadFlowNode} from "@/features/ast/components/ast/flow/HeadFlowNode";
import {TailFlowNode} from "@/features/ast/components/ast/flow/TailFlowNode";
import {ListTypeFlowNode} from "@/features/ast/components/ast/flow/ListTypeFlowNode";
import {FoldFlowNode} from "@/features/ast/components/ast/flow/FoldFlowNode";
import {UnfoldFlowNode} from "@/features/ast/components/ast/flow/UnfoldFlowNode";
import {RecursiveTypeFlowNode} from "@/features/ast/components/ast/flow/RecursiveTypeFlowNode";
import {KindStarFlowNode} from "@/features/ast/components/ast/flow/KindStarFlowNode.tsx";
import {KindArrowFlowNode} from "@/features/ast/components/ast/flow/KindArrowFlowNode.tsx";
import {Undo2, Redo2, LayoutGrid, Crosshair, Trash2, Eraser, Map as MapIcon, BoxSelect} from "lucide-react";

const HANDLE_LABELS: Record<string, string> = {
  "global-decl": "decl",
  "term": "term",
  "body": "body",
  "paramType": "param",
  "type": "type",
  "value": "value",
  "left": "fn",
  "right": "arg",
  "from": "from",
  "to": "to",
  "condition": "cond",
  "then": "then",
  "else": "else",
  "variable": "scrutinee",
  "inl-term": "inl",
  "inr-term": "inr",
  "tuple": "tuple",
  "first": "1st",
  "second": "2nd",
  "leftOperand": "left",
  "rightOperand": "right",
  "typeArg": "[T]",
};

export interface AstProps {
  AST: Program,
  setAST: (ast: Program) => void,
  graph: AstFlowGraph,
  setGraph:  React.Dispatch<React.SetStateAction<AstFlowGraph>>,
}

export interface AstEditorHandle {
  addStandaloneNode: (nodeType: string) => void;
  requestFitView: () => void;
}

function TypeFlowNodeDispatch(props: any) {
  const kind = (props.data?.term as any)?.kind;
  switch (kind) {
    case "TyArrow":
      return <TyArrowFlowNode {...props} />;
    case "SumType":
      return <SumTypeFlowNode {...props} />;
    case "TupleType":
      return <TupleTypeFlowNode {...props} />;
    case "VariantType":
      return <VariantTypeFlowNode {...props} />;
    case "RecordType":
      return <RecordTypeFlowNode {...props} />;
    case "TyForall":
      return <TyForallFlowNode {...props} />;
    case "TyConstructorAbs":
      return <TyConstructorAbsFlowNode {...props} />;
    case "TyConstructorApp":
      return <TyConstructorAppFlowNode {...props} />;
    case "TyPi":
      return <TyPiFlowNode {...props} />;
    case "TyIndexApp":
      return <TyIndexAppFlowNode {...props} />;
    case "ListType":
      return <ListTypeFlowNode {...props} />;
    case "RecursiveType":
      return <RecursiveTypeFlowNode {...props} />;
    default:
      return <TyIdentifierFlowNode {...props} />;
  }
}

function KindFlowNodeDispatch(props: any) {
  const kind = (props.data?.term as any)?.kind;
  switch (kind) {
    case "KindArrow":
      return <KindArrowFlowNode {...props} />;
    default:
      return <KindStarFlowNode {...props} />;
  }
}

const nodeTypes: NodeTypes = {
  program: ProgramFlowNode,
  funDecl: FunDeclFlowNode,
  varDecl: VarDeclFlowNode,
  typeAliasDecl: TypeAliasDeclFlowNode,
  typeConstructorDecl: TypeConstructorDeclFlowNode,
  abstraction: AbstractionFlowNode,
  variable: VariableFlowNode,
  application: ApplicationFlowNode,
  literal: LiteralFlowNode,
  type: TypeFlowNodeDispatch,
  kind: KindFlowNodeDispatch,
  inl: InlFlowNode,
  inr: InrFlowNode,
  ifCondition: IfConditionFlowNode,
  case: CaseFlowNode,
  variantCase: VariantCaseFlowNode,
  variant: VariantFlowNode,
  ascribe: AscribeFlowNode,
  tupleProjection: TupleProjectionFlowNode,
  recordProjection: RecordProjectionFlowNode,
  record: RecordFlowNode,
  sequencing: SequencingFlowNode,
  tuple: TupleFlowNode,
  dummyAbstraction: DummyAbstractionFlowNode,
  let: LetFlowNode,
  binOp: BinOpFlowNode,
  fix: FixFlowNode,
  typeAbs: TypeAbstractionFlowNode,
  typeApp: TypeApplicationFlowNode,
  nil: NilFlowNode,
  cons: ConsFlowNode,
  isNil: IsNilFlowNode,
  headOp: HeadFlowNode,
  tailOp: TailFlowNode,
  fold: FoldFlowNode,
  unfold: UnfoldFlowNode,
} as NodeTypes;

type AddOnDropKind = "decl" | "term" | "type" | "kind" | "kindOrType";

// Node kinds whose handles always point at further types. TyIndexApp is
// excluded — its "arg" handle is a term index, not a type.
const TYPE_SOURCE_KINDS = new Set(["TyIdentifier", "TyArrow", "SumType", "TupleType", "VariantType", "RecordType", "TyForall", "TyConstructorAbs", "TyConstructorApp", "TyPi", "ListType", "RecursiveType"]);

// Handle names are reused across term and type nodes, so the source node's
// own kind disambiguates which context a handle belongs to.
function expectedChildKind(sourceKind: string | undefined, handleId: string | undefined): AddOnDropKind | null {
  if (!handleId) return null;
  if (handleId === "global-decl") return "decl";
  // paramKind (TyConstructorAbs / TypeConstructorDecl) always points at a Kind node.
  if (handleId === "paramKind") return "kind";
  // KindArrow.to is always another Kind, but .from is Kind | Type — System λP's dependent
  // kind (e.g. "Nat -> @") connects an ordinary Type node there instead of a Kind node.
  if (sourceKind === "KindArrow" && handleId === "to") return "kind";
  if (sourceKind === "KindArrow" && handleId === "from") return "kindOrType";
  if (sourceKind && TYPE_SOURCE_KINDS.has(sourceKind)) return "type";
  if (handleId === "type" || handleId === "paramType" || handleId === "typeArg") return "type";
  return "term";
}

const VALID_NODE_TYPES_BY_KIND: Record<AddOnDropKind, string[]> = {
  decl: ["funDecl", "varDecl", "typeAliasDecl"],
  term: [
    "abstraction", "application", "variable", "literal",
    "inl", "inr", "ifCondition", "case", "variantCase", "variant",
    "ascribe", "tupleProjection", "recordProjection", "record",
    "sequencing", "tuple", "dummyAbstraction", "let", "binOp", "fix",
    "typeAbs", "typeApp",
    "nil", "cons", "isNil", "headOp", "tailOp",
    "fold", "unfold",
  ],
  type: ["typeVar", "typeArrow", "sumType", "tupleType", "variantType", "recordType", "forallType", "typeConstructorAbs", "typeConstructorApp", "typePi", "typeIndexApp", "listType", "recursiveType"],
  kind: ["kindStar", "kindArrow"],
  // What "from" on a KindArrow can create fresh: any Kind, or (for the System λP dependent
  // case) a plain type name — the full Type palette is overkill for something that's almost
  // always just a base type like "Nat".
  kindOrType: ["kindStar", "kindArrow", "typeVar"],
};

// Skeleton for each newly-added node kind; null for the original 8 kinds.
function makeDefaultTermNode(nodeType: string, id: string): { type: string; term: any } | null {
  switch (nodeType) {
    case "inl":
    case "inr":
      return {
        type: nodeType,
        term: {
          id, kind: nodeType === "inl" ? "Inl" : "Inr",
          term: { id: `${id}-term`, kind: "Var", name: "x" },
          type: {
            id: `${id}-type`, kind: "SumType",
            left: { id: `${id}-left`, kind: "TyIdentifier", name: "A" },
            right: { id: `${id}-right`, kind: "TyIdentifier", name: "B" },
          },
        },
      };
    case "ifCondition":
      return {
        type: "ifCondition",
        term: {
          id, kind: "IfCondition",
          condition: { id: `${id}-cond`, kind: "Lit", value: "true" },
          then: { id: `${id}-then`, kind: "Var", name: "x" },
        },
      };
    case "case":
      return {
        type: "case",
        term: {
          id, kind: "Case",
          variable: { id: `${id}-variable`, kind: "Var", name: "s" },
          inl: { variable: "x", term: { id: `${id}-inl`, kind: "Var", name: "x" } },
          inr: { variable: "y", term: { id: `${id}-inr`, kind: "Var", name: "y" } },
        },
      };
    case "variantCase":
      return {
        type: "variantCase",
        term: {
          id, kind: "VariantCase",
          variable: { id: `${id}-variable`, kind: "Var", name: "s" },
          cases: [{ label: "l1", variable: "x", body: { id: `${id}-case-0`, kind: "Var", name: "x" } }],
        },
      };
    case "variant":
      return {
        type: "variant",
        term: {
          id, kind: "Variant",
          type: {
            id: `${id}-type`, kind: "VariantType",
            variants: [{ label: "l1", type: { id: `${id}-type-f0`, kind: "TyIdentifier", name: "T" } }],
          },
          variants: [{ label: "l1", term: { id: `${id}-field-0`, kind: "Var", name: "x" } }],
        },
      };
    case "ascribe":
      return {
        type: "ascribe",
        term: {
          id, kind: "Ascribe",
          term: { id: `${id}-term`, kind: "Var", name: "x" },
          type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
        },
      };
    case "tupleProjection":
      return {
        type: "tupleProjection",
        term: {
          id, kind: "TupleProjection",
          tuple: { id: `${id}-tuple`, kind: "Var", name: "t" },
          index: 1,
        },
      };
    case "recordProjection":
      return {
        type: "recordProjection",
        term: {
          id, kind: "RecordProjection",
          term: { id: `${id}-term`, kind: "Var", name: "r" },
          label: "l",
        },
      };
    case "record":
      return {
        type: "record",
        term: {
          id, kind: "Record",
          fields: [{ label: "l1", term: { id: `${id}-field-0`, kind: "Var", name: "x" } }],
        },
      };
    case "sequencing":
      return {
        type: "sequencing",
        term: {
          id, kind: "Sequencing",
          first: { id: `${id}-first`, kind: "Lit", value: "unit" },
          second: { id: `${id}-second`, kind: "Var", name: "x" },
        },
      };
    case "let":
      return {
        type: "let",
        term: {
          id, kind: "Let", name: "x",
          value: { id: `${id}-value`, kind: "Lit", value: "0" },
          body: { id: `${id}-body`, kind: "Var", name: "x" },
        },
      };
    case "binOp":
      return {
        type: "binOp",
        term: {
          id, kind: "BinOp", operator: "+",
          left: { id: `${id}-leftOperand`, kind: "Lit", value: "1" },
          right: { id: `${id}-rightOperand`, kind: "Lit", value: "1" },
        },
      };
    case "fix":
      return {
        type: "fix",
        term: {
          id, kind: "Fix",
          term: {
            id: `${id}-term`, kind: "Abs", param: "f",
            paramType: { id: `${id}-paramType`, kind: "TyIdentifier", name: "T" },
            body: { id: `${id}-body`, kind: "Var", name: "f" },
          },
        },
      };
    case "tuple":
      return {
        type: "tuple",
        term: {
          id, kind: "Tuple",
          elements: [{ id: `${id}-el-0`, kind: "Var", name: "x" }],
        },
      };
    case "dummyAbstraction":
      return {
        type: "dummyAbstraction",
        term: {
          id, kind: "DummyAbstraction",
          paramType: { id: `${id}-paramType`, kind: "TyIdentifier", name: "T" },
          body: { id: `${id}-body`, kind: "Var", name: "x" },
        },
      };
    case "typeAbs":
      return {
        type: "typeAbs",
        term: {
          id, kind: "TypeAbs", typeParam: "X",
          body: { id: `${id}-body`, kind: "Var", name: "x" },
        },
      };
    case "typeApp":
      return {
        type: "typeApp",
        term: {
          id, kind: "TypeApp",
          term: { id: `${id}-term`, kind: "Var", name: "f" },
          typeArg: { id: `${id}-typeArg`, kind: "TyIdentifier", name: "T" },
        },
      };
    case "sumType":
      return {
        type: "type",
        term: {
          id, kind: "SumType",
          left: { id: `${id}-left`, kind: "TyIdentifier", name: "A" },
          right: { id: `${id}-right`, kind: "TyIdentifier", name: "B" },
        },
      };
    case "tupleType":
      return {
        type: "type",
        term: {
          id, kind: "TupleType",
          elements: [{ id: `${id}-el-0`, kind: "TyIdentifier", name: "A" }],
        },
      };
    case "variantType":
      return {
        type: "type",
        term: {
          id, kind: "VariantType",
          variants: [{ label: "l1", type: { id: `${id}-field-0`, kind: "TyIdentifier", name: "T" } }],
        },
      };
    case "recordType":
      return {
        type: "type",
        term: {
          id, kind: "RecordType",
          fields: [{ label: "l1", type: { id: `${id}-field-0`, kind: "TyIdentifier", name: "T" } }],
        },
      };
    case "forallType":
      return {
        type: "type",
        term: {
          id, kind: "TyForall", typeVariable: "X",
          type: { id: `${id}-type`, kind: "TyIdentifier", name: "X" },
        },
      };
    case "typeConstructorAbs":
      return {
        type: "type",
        term: {
          id, kind: "TyConstructorAbs", typeParam: "X",
          paramKind: { id: `${id}-kind`, kind: "StarKind" },
          body: { id: `${id}-body`, kind: "TyIdentifier", name: "X" },
        },
      };
    case "typeConstructorApp":
      return {
        type: "type",
        term: {
          id, kind: "TyConstructorApp",
          func: { id: `${id}-func`, kind: "TyIdentifier", name: "F" },
          arg: { id: `${id}-arg`, kind: "TyIdentifier", name: "A" },
        },
      };
    case "nil":
      return {
        type: "nil",
        term: {
          id, kind: "Nil",
          type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
        },
      };
    case "cons":
      return {
        type: "cons",
        term: {
          id, kind: "Cons",
          type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
          head: { id: `${id}-head`, kind: "Var", name: "x" },
          tail: { id: `${id}-tail`, kind: "Nil", type: { id: `${id}-tail-type`, kind: "TyIdentifier", name: "T" } },
        },
      };
    case "isNil":
      return {
        type: "isNil",
        term: {
          id, kind: "IsNil",
          type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
          term: { id: `${id}-term`, kind: "Var", name: "xs" },
        },
      };
    case "headOp":
      return {
        type: "headOp",
        term: {
          id, kind: "Head",
          type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
          term: { id: `${id}-term`, kind: "Var", name: "xs" },
        },
      };
    case "tailOp":
      return {
        type: "tailOp",
        term: {
          id, kind: "Tail",
          type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
          term: { id: `${id}-term`, kind: "Var", name: "xs" },
        },
      };
    case "typePi":
      return {
        type: "type",
        term: {
          id, kind: "TyPi", paramVar: "x",
          paramType: { id: `${id}-paramType`, kind: "TyIdentifier", name: "A" },
          body: { id: `${id}-body`, kind: "TyIdentifier", name: "B" },
        },
      };
    case "typeIndexApp":
      return {
        type: "type",
        term: {
          id, kind: "TyIndexApp",
          func: { id: `${id}-func`, kind: "TyIdentifier", name: "F" },
          arg: { id: `${id}-arg`, kind: "Var", name: "n" },
        },
      };
    case "kindStar":
      return {
        type: "kind",
        term: { id, kind: "StarKind" },
      };
    case "kindArrow":
      return {
        type: "kind",
        term: {
          id, kind: "KindArrow",
          from: { id: `${id}-from`, kind: "StarKind" },
          to: { id: `${id}-to`, kind: "StarKind" },
        },
      };
    case "listType":
      return {
        type: "type",
        term: {
          id, kind: "ListType",
          elementType: { id: `${id}-elementType`, kind: "TyIdentifier", name: "T" },
        },
      };
    case "recursiveType":
      return {
        type: "type",
        term: {
          id, kind: "RecursiveType", typeVariable: "X",
          type: { id: `${id}-type`, kind: "TyIdentifier", name: "X" },
        },
      };
    case "fold":
      return {
        type: "fold",
        term: {
          id, kind: "Fold",
          type: {
            id: `${id}-type`, kind: "RecursiveType", typeVariable: "X",
            type: { id: `${id}-type-body`, kind: "TyIdentifier", name: "X" },
          },
          term: { id: `${id}-term`, kind: "Var", name: "x" },
        },
      };
    case "unfold":
      return {
        type: "unfold",
        term: {
          id, kind: "Unfold",
          type: {
            id: `${id}-type`, kind: "RecursiveType", typeVariable: "X",
            type: { id: `${id}-type-body`, kind: "TyIdentifier", name: "X" },
          },
          term: { id: `${id}-term`, kind: "Var", name: "x" },
        },
      };
    default:
      return null;
  }
}

// Must run under ReactFlowProvider (required for useReactFlow).
export const AstEditor = forwardRef<AstEditorHandle, AstProps>(function AstEditor({
  setAST,
  graph,
  setGraph,
}, ref) {
  const {t} = useTranslation();
  const rf = useReactFlow();
  const {resolvedTheme} = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [fitToken, setFitToken] = useState(0);
  const requestFitView = useCallback(() => setFitToken((t) => t + 1), []);
  useFitViewOnChange(fitToken);

  // When on, a left-drag on empty canvas draws a marquee that selects the nodes it covers;
  // panning moves to the middle/right mouse button. Shift-drag still marquees in either mode.
  const [marqueeSelect, setMarqueeSelect] = useState(false);

  const [newNodeType_] = useState<string>("variable");
  const pendingAstRef = useRef<Program | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);

  const [connectDraft, setConnectDraft] = useState<null | {
    source: string;
    sourceHandle: string;
    kind: AddOnDropKind;
    clientX: number;
    clientY: number;
  }>(null);

  const [dropPopupPos, setDropPopupPos] = useState<null | { x: number; y: number }>(null);

  const [addOnDropChoice, setAddOnDropChoice] = useState<string | null>(null);
  const [addOnDropOpen, setAddOnDropOpen] = useState(false);
  const [addOnDropSearch, setAddOnDropSearch] = useState("");
  const addOnDropTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [nodeCtxMenu, setNodeCtxMenu] = useState<null | { x: number; y: number; nodeId: string }>(null);

  // Refs, not state, so undo/redo pushes don't trigger re-renders.
  const undoStackRef = useRef<AstFlowGraph[]>([]);
  const redoStackRef = useRef<AstFlowGraph[]>([]);

  const snapshotHistory = useCallback((current: AstFlowGraph) => {
    undoStackRef.current = [...undoStackRef.current, current].slice(-50);
    redoStackRef.current = [];
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const snapshot = undoStackRef.current.pop()!;
    redoStackRef.current = [...redoStackRef.current, graph].slice(-50);
    setGraph(snapshot);
  }, [graph, setGraph]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const snapshot = redoStackRef.current.pop()!;
    undoStackRef.current = [...undoStackRef.current, graph].slice(-50);
    setGraph(snapshot);
  }, [graph, setGraph]);

  useEffect(() => {
    pendingAstRef.current = graphToAst(graph);
  }, [graph]);

  useEffect(() => {
    if (!pendingAstRef.current) return;
    setAST(pendingAstRef.current);
    pendingAstRef.current = null;
  }, [graph, setAST]);

  const onNodesChange = useCallback(
    (changes: any) => {
      setGraph((prevGraph) => ({
        ...prevGraph,
        nodes: applyNodeChanges(changes, prevGraph.nodes),
      }));
    },
    [],
  );

  const onEdgesChange = useCallback(
    (changes: any) => {
      setGraph((prevGraph) => ({
        ...prevGraph,
        edges: applyEdgeChanges(changes, prevGraph.edges),
      }));
    },
    [],
  );

  const validateConnection = useCallback((params: Connection, nodes: Node[]): boolean => {
    const sourceNode = nodes.find((n) => n.id === params.source);
    const targetNode = nodes.find((n) => n.id === params.target);
    if (!sourceNode || !targetNode || !params.sourceHandle) return false;

    const sourceKind = (sourceNode.data as any)?.term?.kind as string | undefined;
    const targetKind = (targetNode.data as any)?.term?.kind as string | undefined;

    const isDecl = (k?: string) => k === "VarDecl" || k === "FunDecl";
    const isType = (k?: string) => !!k && TYPE_SOURCE_KINDS.has(k);
    const isKindNode = (k?: string) => k === "StarKind" || k === "KindArrow";
    const isTerm = (k?: string) =>
      !!k && !isDecl(k) && !isType(k) && !isKindNode(k) && k !== "Program";

    const expected = expectedChildKind(sourceKind, params.sourceHandle);
    if (!expected) return false;

    if (expected === "decl") return isDecl(targetKind);
    if (expected === "type") return isType(targetKind);
    if (expected === "kind") return isKindNode(targetKind);
    if (expected === "kindOrType") return isKindNode(targetKind) || isType(targetKind);
    return isTerm(targetKind);
  }, []);

  const isValidConnection = useCallback((params: Edge | Connection): boolean => {
    return validateConnection(params as Connection, rf.getNodes());
  }, [rf, validateConnection]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!validateConnection(params, rf.getNodes())) return;
      snapshotHistory(graph);
      const label = params.sourceHandle ? HANDLE_LABELS[params.sourceHandle] : undefined;
      setGraph((prevGraph) => {
        if (!validateConnection(params, prevGraph.nodes)) return prevGraph;

        const isGlobalHandle = params.sourceHandle === "global-decl";
        const nextEdges = isGlobalHandle
          ? prevGraph.edges
          : prevGraph.edges.filter(
              (e) => !(e.source === params.source && e.sourceHandle === params.sourceHandle),
            );

        const withNew = addEdge({ ...params, label }, nextEdges);
        const nextGraph = { ...prevGraph, edges: withNew };
        pendingAstRef.current = graphToAst(nextGraph);
        return nextGraph;
      });
    },
    [graph, rf, snapshotHistory, validateConnection],
  );

  const updateNodeTerm = useCallback((nodeId: string, patch: any) => {
    setGraph((prevGraph) => {
      const nextNodes = prevGraph.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            term: {
              ...(n.data as any).term,
              ...patch,
            },
          },
        };
      });

      const nextGraph = { ...prevGraph, nodes: nextNodes };
      pendingAstRef.current = graphToAst(nextGraph);
      return nextGraph;
    });
  }, []);

  useEffect(() => {
    const needsPatch = graph.nodes.some((n: any) => n.data?.editable && typeof (n.data as any).onChange !== "function");
    if (!needsPatch) return;

    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n: any) => {
        if (n.data?.editable && typeof (n.data as any).onChange !== "function") {
          return {
            ...n,
            data: {
              ...n.data,
              onChange: (patch: any) => updateNodeTerm(n.id, patch),
            },
          };
        }
        return n;
      }),
    }));
  }, [graph.nodes, setGraph, updateNodeTerm]);

  const addStandaloneNode = useCallback((nodeType?: string) => {
    let newNodeType = newNodeType_;
    if (nodeType) {
      newNodeType = nodeType as typeof newNodeType_;
    }

    // There is exactly one program root per graph — never a second one.
    if (newNodeType === "program" && graph.nodes.some((n) => n.type === "program")) return;

    const id = `manual-${newNodeType}-${Date.now()}`;
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    const viewportCenter = wrapperRect
      ? rf.screenToFlowPosition({x: wrapperRect.left + wrapperRect.width / 2, y: wrapperRect.top + wrapperRect.height / 2})
      : {x: 0, y: 0};
    // Cascade successive additions a bit so they don't stack exactly on top of each other,
    // wrapping around instead of drifting arbitrarily far from the visible viewport.
    const cascade = (graph.nodes.length % 8) * 24;
    const position = {x: viewportCenter.x - 80 + cascade, y: viewportCenter.y - 40 + cascade};

    const makeNode = () => {
      if (newNodeType === "program") {
        return {
          id, type: "program", position,
          data: {
            term: { id, kind: "Program", globals: [] },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          }
        };
      }
      if (newNodeType === "funDecl") {
        return {
          id, type: "funDecl", position,
          data: {
            term: {
              id, kind: "FunDecl", name: "f",
              type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
              value: { id: `${id}-value`, kind: "Var", name: "x" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (newNodeType === "varDecl") {
        return {
          id, type: "varDecl", position,
          data: {
            term: {
              id, kind: "VarDecl", name: "x",
              type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
              value: { id: `${id}-value`, kind: "Var", name: "x" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (newNodeType === "typeAliasDecl") {
        return {
          id, type: "typeAliasDecl", position,
          data: {
            term: {
              id, kind: "TypeAliasDecl", name: "MyType",
              type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (newNodeType === "abstraction") {
        return {
          id, type: "abstraction", position,
          data: {
            term: {
              id, kind: "Abs", param: "x",
              paramType: { id: `${id}-paramType`, kind: "TyIdentifier", name: "T" },
              body: { id: `${id}-body`, kind: "Var", name: "x" },
              type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (newNodeType === "application") {
        return {
          id, type: "application", position,
          data: {
            term: {
              id, kind: "App",
              func: { id: `${id}-func`, kind: "Var", name: "f" },
              arg: { id: `${id}-arg`, kind: "Var", name: "x" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (newNodeType === "literal") {
        return {
          id, type: "literal", position,
          data: {
            term: { id, kind: "Lit", value: 0 },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          }
        };
      }
      if (newNodeType === "typeVar") {
        const ty: TyIdentifier = { id, kind: "TyIdentifier", name: "T" };
        return {
          id, type: "type", position,
          data: { term: ty, editable: true, onChange: (patch: any) => updateNodeTerm(id, patch) },
        };
      }
      if (newNodeType === "typeArrow") {
        const ty: TyArrow = {
          id, kind: "TyArrow",
          from: { id: `${id}-from`, kind: "TyIdentifier", name: "A" },
          to: { id: `${id}-to`, kind: "TyIdentifier", name: "B" },
        };
        return {
          id, type: "type", position,
          data: { term: ty, editable: true, onChange: (patch: any) => updateNodeTerm(id, patch) },
        };
      }
      const skeleton = makeDefaultTermNode(newNodeType, id);
      if (skeleton) {
        return {
          id, type: skeleton.type, position,
          data: { term: skeleton.term, editable: true, onChange: (patch: any) => updateNodeTerm(id, patch) },
        };
      }

      return {
        id, type: "variable", position,
        data: {
          term: { id, kind: "Var", name: "x" },
          editable: true,
          onChange: (patch: any) => updateNodeTerm(id, patch),
        },
      };
    };

    snapshotHistory(graph);
    setGraph((prevGraph) => ({
      ...prevGraph,
      nodes: [...prevGraph.nodes, makeNode() as AstFlowGraph["nodes"][number]],
    }));
  }, [graph, newNodeType_, rf, setGraph, snapshotHistory, updateNodeTerm]);

  useImperativeHandle(ref, () => ({addStandaloneNode, requestFitView}), [addStandaloneNode, requestFitView]);

  const autoLayout = useCallback(() => {
    snapshotHistory(graph);
    setGraph((prev) => layoutAstFlow(prev.nodes, prev.edges));
  }, [graph, setGraph, snapshotHistory]);

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const clipboardRef = useRef<Array<{ node: Node; edges: Edge[] }> | null>(null);

  const deleteSelection = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
    snapshotHistory(graph);
    setGraph((prev) => {
      // The program root is never deletable, even as part of a multi-select.
      const deletableIds = selectedNodeIds.filter((id) => prev.nodes.find((n) => n.id === id)?.type !== "program");
      const remainingNodes = prev.nodes.filter((n) => !deletableIds.includes(n.id));
      const remainingEdges = prev.edges.filter((e) => {
        if (selectedEdgeIds.includes(e.id)) return false;
        if (deletableIds.includes(e.source) || deletableIds.includes(e.target)) return false;
        return true;
      });
      return { ...prev, nodes: remainingNodes, edges: remainingEdges };
    });
  }, [graph, selectedEdgeIds, selectedNodeIds, snapshotHistory]);

  const deleteNode = useCallback((nodeId: string) => {
    if (graph.nodes.find((n) => n.id === nodeId)?.type === "program") return;
    snapshotHistory(graph);
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
  }, [graph, setGraph, snapshotHistory]);

  const duplicateNode = useCallback((nodeId: string) => {
    snapshotHistory(graph);
    setGraph((prev) => {
      const original = prev.nodes.find((n) => n.id === nodeId);
      // Never a second program root — it's the one node that isn't duplicable.
      if (!original || original.type === "program") return prev;
      const newId = `${nodeId}-copy-${Date.now()}`;
      const newNode = {
        ...original,
        id: newId,
        position: { x: original.position.x + 40, y: original.position.y + 40 },
        selected: false,
        data: {
          ...(original.data as any),
          term: { ...(original.data as any)?.term, id: newId },
          onChange: (patch: any) => updateNodeTerm(newId, patch),
        },
      } as any;
      return { ...prev, nodes: [...prev.nodes, newNode] };
    });
  }, [graph, setGraph, snapshotHistory, updateNodeTerm]);

  const selectAll = useCallback(() => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => ({ ...n, selected: true })),
      edges: prev.edges.map((e) => ({ ...e, selected: true })),
    }));
  }, [setGraph]);

  const clearSelection = useCallback(() => {
    setGraph((prev) => {
      if (!prev.nodes.some((n) => n.selected) && !prev.edges.some((e) => e.selected)) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        edges: prev.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
      };
    });
  }, [setGraph]);

  const clearAll = useCallback(() => {
    snapshotHistory(graph);
    setGraph((prev) => {
      // Reset the program root instead of removing it — it always stays.
      const programNode = prev.nodes.find((n) => n.type === "program");
      if (!programNode) return { nodes: [], edges: [] };
      const resetProgram = {
        ...programNode,
        data: { ...(programNode.data as any), term: { id: programNode.id, kind: "Program", globals: [] } },
      } as AstFlowGraph["nodes"][number];
      return { nodes: [resetProgram], edges: [] };
    });
  }, [graph, setGraph, snapshotHistory]);

  function offsetPosition(pos: { x: number; y: number }, dx: number, dy: number) {
    return { x: pos.x + dx, y: pos.y + dy };
  }

  const copySelection = useCallback(() => {
    setGraph((prev) => {
      const nodes = prev.nodes.filter((n) => selectedNodeIds.includes(n.id));
      if (nodes.length === 0) return prev;

      const edges = prev.edges.filter(
        (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target),
      );

      clipboardRef.current = nodes.map((node) => ({
        node,
        edges: edges.filter((e) => e.source === node.id || e.target === node.id),
      }));

      return prev;
    });
  }, [selectedNodeIds]);

  const pasteSelection = useCallback(() => {
    // Never paste a copied program root — there's only ever one.
    const clip = clipboardRef.current?.filter(({node}) => node.type !== "program");
    if (!clip || clip.length === 0) return;

    snapshotHistory(graph);
    setGraph((prev) => {
      const idMap = new Map<string, string>();
      const now = Date.now();

      const newNodes: Node[] = clip.map(({ node }, idx) => {
        const newId = `${node.id}-copy-${now}-${idx}`;
        idMap.set(node.id, newId);
        return {
          ...node,
          id: newId,
          position: offsetPosition(node.position, 40, 40),
          selected: false,
          data: {
            ...(node.data as any),
            term: { ...(node.data as any)?.term, id: newId },
          },
        } as any;
      });

      const clipNodeIds = new Set(clip.map((c) => c.node.id));
      const edgesToCopy = prev.edges.filter(
        (e) => clipNodeIds.has(e.source) && clipNodeIds.has(e.target),
      );

      const pastedEdges: Edge[] = edgesToCopy.map((e, idx) => ({
        ...e,
        id: `${e.id}-copy-${now}-${idx}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: false,
      }));

      return {
        ...prev,
        nodes: [...prev.nodes, ...(newNodes as any)],
        edges: [...prev.edges, ...(pastedEdges as any)],
      };
    });
    requestFitView();
  }, [graph, snapshotHistory, requestFitView]);

  const onEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;

      const isEditingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.getAttribute("role") === "combobox";

      if (isEditingText) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        clearSelection();
        setNodeCtxMenu(null);
        setConnectDraft(null);
        setDropPopupPos(null);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (modifier && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (modifier && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }

      if (modifier && key === "a") {
        event.preventDefault();
        selectAll();
        return;
      }

      if (modifier && key === "c") {
        event.preventDefault();
        copySelection();
        return;
      }

      if (modifier && key === "v") {
        event.preventDefault();
        pasteSelection();
      }
    },
    [clearSelection, copySelection, deleteSelection, pasteSelection, redo, selectAll, undo],
  );

  const onNodesDelete = useCallback((deleted: Node[]) => {
    const ids = new Set(deleted.filter((n) => n.type !== "program").map((n) => n.id));
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => !ids.has(n.id)),
      edges: prev.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
    }));
  }, []);

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    const ids = new Set(deleted.map((e) => e.id));
    setGraph((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => !ids.has(e.id)),
    }));
  }, []);

  const onSelectionChange = useCallback((params: { nodes?: Node[]; edges?: Edge[] }) => {
    setSelectedNodeIds((params.nodes ?? []).map((n) => n.id));
    setSelectedEdgeIds((params.edges ?? []).map((e) => e.id));
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setNodeCtxMenu({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      nodeId: node.id,
    });
  }, []);

  const onPaneClick = useCallback(() => setNodeCtxMenu(null), []);

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    if (!params.nodeId || !params.handleId) return;
    const sourceNode = rf.getNodes().find((n) => n.id === params.nodeId);
    const sourceKind = (sourceNode?.data as any)?.term?.kind as string | undefined;
    const handleKind = expectedChildKind(sourceKind, params.handleId);
    if (!handleKind) return;

    setConnectDraft({
      source: params.nodeId,
      sourceHandle: params.handleId,
      kind: handleKind,
      clientX: 0,
      clientY: 0,
    });
    setAddOnDropChoice(null);
  }, [rf]);

  const onConnectEnd: OnConnectEnd = useCallback((event) => {
    if (!connectDraft) return;

    const targetIsPane = (event.target as HTMLElement | null)?.classList?.contains("react-flow__pane");
    if (!targetIsPane) {
      setConnectDraft(null);
      setDropPopupPos(null);
      setAddOnDropOpen(false);
      return;
    }

    const e = event as MouseEvent;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    setConnectDraft((prev) => (prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev));
    setDropPopupPos({
      x: Math.max(8, e.clientX - rect.left + 8),
      y: Math.max(8, e.clientY - rect.top + 8),
    });
    setAddOnDropOpen(true);
  }, [connectDraft]);

  const showAddOnDrop = Boolean(connectDraft && dropPopupPos);

  useEffect(() => {
    if (!showAddOnDrop) return;
    const t = window.setTimeout(() => {
      addOnDropTriggerRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [showAddOnDrop]);

  const commitAddNodeOnDrop = useCallback((choice: string) => {
    if (!connectDraft) return;

    const position = rf.screenToFlowPosition({
      x: connectDraft.clientX,
      y: connectDraft.clientY,
    });

    const nodeType = choice as any;
    const id = `drop-${nodeType}-${Date.now()}`;

    const node = ((): any => {
      if (nodeType === "funDecl") {
        return {
          id, type: "funDecl", position,
          data: {
            term: {
              id, kind: "FunDecl", name: "f",
              type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
              value: { id: `${id}-value`, kind: "Var", name: "x" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (nodeType === "varDecl") {
        return {
          id, type: "varDecl", position,
          data: {
            term: {
              id, kind: "VarDecl", name: "x",
              type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
              value: { id: `${id}-value`, kind: "Var", name: "x" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (nodeType === "typeAliasDecl") {
        return {
          id, type: "typeAliasDecl", position,
          data: {
            term: {
              id, kind: "TypeAliasDecl", name: "MyType",
              type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (nodeType === "abstraction") {
        return {
          id, type: "abstraction", position,
          data: {
            term: {
              id, kind: "Abs", param: "x",
              paramType: { id: `${id}-paramType`, kind: "TyIdentifier", name: "T" },
              body: { id: `${id}-body`, kind: "Var", name: "x" },
              type: { id: `${id}-type`, kind: "TyIdentifier", name: "T" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (nodeType === "application") {
        return {
          id, type: "application", position,
          data: {
            term: {
              id, kind: "App",
              func: { id: `${id}-func`, kind: "Var", name: "f" },
              arg: { id: `${id}-arg`, kind: "Var", name: "x" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (nodeType === "literal") {
        return {
          id, type: "literal", position,
          data: {
            term: { id, kind: "Lit", value: 0 },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (nodeType === "typeVar") {
        return {
          id, type: "type", position,
          data: {
            term: { id, kind: "TyIdentifier", name: "T" },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      if (nodeType === "typeArrow") {
        return {
          id, type: "type", position,
          data: {
            term: {
              id, kind: "TyArrow",
              from: { id: `${id}-from`, kind: "TyIdentifier", name: "A" },
              to: { id: `${id}-to`, kind: "TyIdentifier", name: "B" },
            },
            editable: true,
            onChange: (patch: any) => updateNodeTerm(id, patch),
          },
        };
      }
      const skeleton = makeDefaultTermNode(nodeType, id);
      if (skeleton) {
        return {
          id, type: skeleton.type, position,
          data: { term: skeleton.term, editable: true, onChange: (patch: any) => updateNodeTerm(id, patch) },
        };
      }

      return {
        id, type: "variable", position,
        data: {
          term: { id, kind: "Var", name: "x" },
          editable: true,
          onChange: (patch: any) => updateNodeTerm(id, patch),
        },
      };
    })();

    const connection: Connection = {
      source: connectDraft.source,
      sourceHandle: connectDraft.sourceHandle,
      target: id,
      targetHandle: null,
    };
    const label = connectDraft.sourceHandle ? HANDLE_LABELS[connectDraft.sourceHandle] : undefined;

    snapshotHistory(graph);
    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, node],
      edges: addEdge({ ...connection, label }, prev.edges),
    }));

    setConnectDraft(null);
    setDropPopupPos(null);
    setAddOnDropChoice(null);
    setAddOnDropOpen(false);
  }, [connectDraft, graph, rf, setGraph, snapshotHistory, updateNodeTerm]);

  return (
    <div
      ref={wrapperRef}
      style={{ width: '100%', height: '100%' }}
      className="relative"
      onKeyDown={onEditorKeyDown}
    >
      {/* Drop-to-create popup */}
      {showAddOnDrop && dropPopupPos && (
        <div
          className="absolute z-50 rounded-md border bg-background p-2 shadow-md"
          style={{ left: dropPopupPos.x, top: dropPopupPos.y }}
        >
          <div className="text-xs text-muted-foreground mb-2">{t("astEditor.insertNode")}</div>
          <Popover
            open={addOnDropOpen}
            onOpenChange={(o) => {
              setAddOnDropOpen(o);
              if (!o) setAddOnDropSearch("");
            }}
          >
            <PopoverTrigger asChild>
              <Button ref={addOnDropTriggerRef} variant="outline" className="w-44 justify-start font-normal">
                {addOnDropChoice ?? t("astEditor.selectNode")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <Input
                autoFocus
                value={addOnDropSearch}
                onChange={(e) => setAddOnDropSearch(e.target.value)}
                placeholder={t("astEditor.searchNodeTypes")}
                className="h-8 text-xs mb-2"
              />
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {(() => {
                  const options = connectDraft ? VALID_NODE_TYPES_BY_KIND[connectDraft.kind] : [];
                  const q = addOnDropSearch.trim().toLowerCase();
                  const filtered = q ? options.filter((nt) => nt.toLowerCase().includes(q)) : options;
                  if (filtered.length === 0) {
                    return <p className="text-xs text-muted-foreground px-2 py-1.5">{t("astEditor.noMatchingNodeTypes")}</p>;
                  }
                  return filtered.map((nt) => (
                    <button
                      key={nt}
                      type="button"
                      onClick={() => {
                        setAddOnDropChoice(nt);
                        commitAddNodeOnDrop(nt);
                      }}
                      className="w-full text-left font-mono text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
                    >
                      {nt}
                    </button>
                  ));
                })()}
              </div>
            </PopoverContent>
          </Popover>
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setConnectDraft(null);
                setDropPopupPos(null);
                setAddOnDropChoice(null);
                setAddOnDropOpen(false);
                setAddOnDropSearch("");
              }}
            >
              {t("astEditor.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Node context menu */}
      {nodeCtxMenu && (
        <div
          className="absolute z-50 min-w-[9rem] rounded-md border bg-popover text-popover-foreground shadow-md py-1"
          style={{ left: nodeCtxMenu.x, top: nodeCtxMenu.y }}
        >
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
            onClick={() => { duplicateNode(nodeCtxMenu.nodeId); setNodeCtxMenu(null); }}
          >
            {t("astEditor.duplicate")}
          </button>
          <div className="h-px bg-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-sm text-left text-destructive hover:bg-accent"
            onClick={() => { deleteNode(nodeCtxMenu.nodeId); setNodeCtxMenu(null); }}
          >
            {t("astEditor.delete")}
          </button>
        </div>
      )}

      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        minZoom={0.1}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange as any}
        nodeTypes={nodeTypes}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodesConnectable={true}
        deleteKeyCode={null}
        panActivationKeyCode={null}
        selectionOnDrag={marqueeSelect}
        selectionMode={SelectionMode.Partial}
        panOnDrag={marqueeSelect ? [1, 2] : true}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        defaultEdgeOptions={{
          labelStyle: { fontSize: 10 },
          labelBgPadding: [3, 4] as [number, number],
          labelBgBorderRadius: 3,
          labelBgStyle: { fillOpacity: 0.7 },
        }}
        fitView
      >
        <Panel position="top-right">
          <div className="flex gap-2">
            <Button size="icon" variant="secondary" onClick={undo} title={t("astEditor.undo")}
              className="shadow-lg hover:shadow-xl transition-shadow">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={redo} title={t("astEditor.redo")}
              className="shadow-lg hover:shadow-xl transition-shadow">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={autoLayout} title={t("astEditor.autoLayout")}
              className="shadow-lg hover:shadow-xl transition-shadow">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={marqueeSelect ? "secondary" : "outline"}
              onClick={() => setMarqueeSelect((prev) => !prev)}
              title={marqueeSelect ? "Marquee select: on (drag to box-select, middle/right-drag to pan)" : "Marquee select: off (drag to pan, Shift+drag to box-select)"}
              className="shadow-lg hover:shadow-xl transition-shadow">
              <BoxSelect className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => rf.fitView()} title={t("astEditor.centerView")}
              className="shadow-lg hover:shadow-xl transition-shadow">
              <Crosshair className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={deleteSelection}
              disabled={selectedNodeIds.length === 0 && selectedEdgeIds.length === 0}
              title="Delete selection (Del)" className="shadow-lg hover:shadow-xl transition-shadow">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={clearAll}
              title={t("astEditor.clearAll")}
              className="shadow-lg hover:shadow-xl transition-shadow hover:text-destructive">
              <Eraser className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={showMiniMap ? "secondary" : "outline"}
              onClick={() => setShowMiniMap((prev) => !prev)}
              title={showMiniMap ? "Hide Minimap" : "Show Minimap"}
              className="shadow-lg hover:shadow-xl transition-shadow">
              <MapIcon className="h-4 w-4" />
            </Button>
          </div>
        </Panel>
        <Background />
        {showMiniMap && <MiniMap
          className="bg-background! border-border!"
          nodeColor={(node) => {
            if (node.type === 'program') return 'hsl(var(--primary))';
            if (node.type === 'funDecl') return 'hsl(142, 71%, 45%)';
            if (node.type === 'varDecl') return 'hsl(189, 85%, 44%)';
            if (node.type === 'abstraction') return 'hsl(270, 55%, 55%)';
            if (node.type === 'application') return 'hsl(217, 91%, 60%)';
            if (node.type === 'variable') return 'hsl(142, 71%, 45%)';
            if (node.type === 'literal') return 'hsl(38, 92%, 50%)';
            if (node.type === 'inl') return 'hsl(347, 77%, 50%)';
            if (node.type === 'inr') return 'hsl(330, 81%, 60%)';
            if (node.type === 'ifCondition') return 'hsl(189, 94%, 43%)';
            if (node.type === 'case') return 'hsl(239, 84%, 67%)';
            if (node.type === 'variantCase') return 'hsl(258, 90%, 66%)';
            if (node.type === 'variant') return 'hsl(292, 84%, 61%)';
            if (node.type === 'ascribe') return 'hsl(173, 80%, 40%)';
            if (node.type === 'tupleProjection' || node.type === 'tuple') return 'hsl(84, 81%, 44%)';
            if (node.type === 'recordProjection' || node.type === 'record') return 'hsl(25, 95%, 53%)';
            if (node.type === 'sequencing') return 'hsl(199, 89%, 48%)';
            if (node.type === 'dummyAbstraction') return 'hsl(258, 90%, 66%)';
            if (node.type === 'let') return 'hsl(160, 84%, 39%)';
            if (node.type === 'binOp') return 'hsl(38, 92%, 50%)';
            if (node.type === 'fix') return 'hsl(0, 84%, 60%)';
            if (node.type === 'typeAbs') return 'hsl(239, 84%, 67%)';
            if (node.type === 'typeApp') return 'hsl(292, 84%, 61%)';
            if (node.type === 'typeAliasDecl') return 'hsl(48, 96%, 53%)';
            return 'hsl(var(--muted))';
          }}
        />}
      </ReactFlow>
    </div>
  );
});
