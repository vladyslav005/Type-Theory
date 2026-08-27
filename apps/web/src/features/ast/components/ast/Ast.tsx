import type {Program, SourcePosition} from "@vladyslav005/tt-core";
import {useCallback, useState, useEffect} from "react";
import type {RefObject} from "react";
import {applyEdgeChanges, applyNodeChanges, ReactFlow, Background, MiniMap, Panel, useReactFlow, type NodeTypes} from "@xyflow/react";
import '@xyflow/react/dist/style.css';
import {useTheme} from "next-themes";
import {Crosshair, Map} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import type {AstFlowGraph, AstFlowNode} from "@/shared/presentation/flow/types.ts";
import type {TextEditorHandle} from "@/features/editor/components/TextEditor.tsx";
import {AbstractionFlowNode} from "@/features/ast/components/ast/flow/AbstractionFlowNode.tsx";
import {VariableFlowNode} from "@/features/ast/components/ast/flow/VariableFlowNode.tsx";
import {ApplicationFlowNode} from "@/features/ast/components/ast/flow/ApplicationFlowNode.tsx";
import {ProgramFlowNode} from "@/features/ast/components/ast/flow/ProgramFlowNode.tsx";
import {FunDeclFlowNode} from "@/features/ast/components/ast/flow/FunDeclFlowNode.tsx";
import {VarDeclFlowNode} from "@/features/ast/components/ast/flow/VarDeclFlowNode.tsx";
import {LiteralFlowNode} from "@/features/ast/components/ast/flow/LiteralFlowNode.tsx";
import {useMapAstToFlow} from "@/features/ast/hooks/mapAstToFlow.ts";
import {layoutAstFlow} from "@/features/ast/hooks/layoutAstFlow.ts";
import {useFitViewOnChange} from "@/features/ast/hooks/useFitViewOnChange.ts";
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
import {TypeAliasDeclFlowNode} from "@/features/ast/components/ast/flow/TypeAliasDeclFlowNode";
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


export interface AstProps {
  AST: Program,
  editorRef?: RefObject<TextEditorHandle | null>,
  highlightOnHover?: boolean,
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

// Rendered inside <ReactFlow> so it can reach the flow context; re-centers the graph
// every time a freshly built AST replaces the previous one.
function FitViewOnAstChange({token}: {token: number}) {
  useFitViewOnChange(token);
  return null;
}

// Needs the ReactFlow context from its parent <Panel>.
function CenterViewButton() {
  const rf = useReactFlow();
  return (
    <Button
      size="icon"
      variant="secondary"
      onClick={() => rf.fitView()}
      title="Center View"
      className="shadow-lg hover:shadow-xl transition-shadow"
    >
      <Crosshair className="h-4 w-4" />
    </Button>
  );
}

function MiniMapToggleButton({showMiniMap, setShowMiniMap}: {showMiniMap: boolean; setShowMiniMap: (v: (prev: boolean) => boolean) => void}) {
  return (
    <Button
      size="icon"
      variant={showMiniMap ? "secondary" : "outline"}
      onClick={() => setShowMiniMap((prev) => !prev)}
      title={showMiniMap ? "Hide Minimap" : "Show Minimap"}
      className="shadow-lg hover:shadow-xl transition-shadow"
    >
      <Map className="h-4 w-4" />
    </Button>
  );
}

const nodeTypes: NodeTypes = {
  program: ProgramFlowNode,
  funDecl: FunDeclFlowNode,
  varDecl: VarDeclFlowNode,
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
  typeAliasDecl: TypeAliasDeclFlowNode,
  typeConstructorDecl: TypeConstructorDeclFlowNode,
  nil: NilFlowNode,
  cons: ConsFlowNode,
  isNil: IsNilFlowNode,
  headOp: HeadFlowNode,
  tailOp: TailFlowNode,
  fold: FoldFlowNode,
  unfold: UnfoldFlowNode,
} as NodeTypes;

export function Ast({
  AST,
  editorRef,
  highlightOnHover = false,
} : AstProps) {
  const { mapAstToFlow } = useMapAstToFlow()
  const { resolvedTheme } = useTheme();
  const [graph, setGraph] = useState<AstFlowGraph>({ nodes: [], edges: [] });
  const [fitToken, setFitToken] = useState(0);
  const [showMiniMap, setShowMiniMap] = useState(false);

  const handleNodeMouseEnter = useCallback(
    (_event: unknown, node: AstFlowNode) => {
      if (!highlightOnHover) return;
      const pos = (node.data?.term as {pos?: SourcePosition} | undefined)?.pos ?? null;
      editorRef?.current?.highlightRange?.(pos);
    },
    [highlightOnHover, editorRef],
  );

  const handleNodeMouseLeave = useCallback(() => {
    if (!highlightOnHover) return;
    editorRef?.current?.highlightRange?.(null);
  }, [highlightOnHover, editorRef]);

  useEffect(() => {
    const newGraph = mapAstToFlow();
    const layoutGraph = layoutAstFlow(newGraph.nodes, newGraph.edges);
    if (newGraph) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGraph(layoutGraph);
      setFitToken((t) => t + 1);
    }
  }, [AST]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        minZoom={0.1}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        fitView
      >
        <FitViewOnAstChange token={fitToken} />
        <Panel position="top-right">
          <div className="flex gap-2">
            <MiniMapToggleButton showMiniMap={showMiniMap} setShowMiniMap={setShowMiniMap} />
            <CenterViewButton />
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
}