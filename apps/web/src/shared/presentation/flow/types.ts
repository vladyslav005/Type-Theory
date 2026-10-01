import type {Edge, Node} from "@xyflow/react";
import type {
  Abs,
  App,
  Ascribe,
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
  IsZero,
  Kind,
  Let,
  Lit,
  Nil,
  Pred,
  Program,
  Record,
  RecordProjection,
  Sequencing,
  Succ,
  Tail,
  Tuple,
  TupleProjection,
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

export type ProgramNodeData = {
  term: Program;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type FunDeclNodeData = {
  term: FunDecl;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type VarDeclNodeData = {
  term: VarDecl;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type VariableNodeData = {
  term: Var;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type AbstractionNodeData = {
  term: Abs;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type ApplicationNodeData = {
  term: App;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type LiteralNodeData = {
  term: Lit;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type TypeNodeData = {
  term: Type;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type KindNodeData = {
  term: Kind;
  editable?: boolean;
  onChange?: (patch: any) => void;
};

export type InlNodeData = { term: Inl; editable?: boolean; onChange?: (patch: any) => void };
export type InrNodeData = { term: Inr; editable?: boolean; onChange?: (patch: any) => void };
export type IfConditionNodeData = { term: IfCondition; editable?: boolean; onChange?: (patch: any) => void };
export type CaseNodeData = { term: Case; editable?: boolean; onChange?: (patch: any) => void };
export type VariantCaseNodeData = { term: VariantCase; editable?: boolean; onChange?: (patch: any) => void };
export type VariantNodeData = { term: Variant; editable?: boolean; onChange?: (patch: any) => void };
export type AscribeNodeData = { term: Ascribe; editable?: boolean; onChange?: (patch: any) => void };
export type TupleProjectionNodeData = { term: TupleProjection; editable?: boolean; onChange?: (patch: any) => void };
export type RecordProjectionNodeData = { term: RecordProjection; editable?: boolean; onChange?: (patch: any) => void };
export type RecordNodeData = { term: Record; editable?: boolean; onChange?: (patch: any) => void };
export type SequencingNodeData = { term: Sequencing; editable?: boolean; onChange?: (patch: any) => void };
export type TupleNodeData = { term: Tuple; editable?: boolean; onChange?: (patch: any) => void };
export type DummyAbstractionNodeData = { term: DummyAbstraction; editable?: boolean; onChange?: (patch: any) => void };
export type LetNodeData = { term: Let; editable?: boolean; onChange?: (patch: any) => void };
export type BinOpNodeData = { term: BinOp; editable?: boolean; onChange?: (patch: any) => void };
export type FixNodeData = { term: Fix; editable?: boolean; onChange?: (patch: any) => void };
export type NblOpNodeData = { term: Succ | Pred | IsZero; editable?: boolean; onChange?: (patch: any) => void };
export type TypeAbsNodeData = { term: TypeAbs; editable?: boolean; onChange?: (patch: any) => void };
export type TypeAppNodeData = { term: TypeApp; editable?: boolean; onChange?: (patch: any) => void };
export type TypeAliasDeclNodeData = { term: TypeAliasDecl; editable?: boolean; onChange?: (patch: any) => void };
export type TypeConstructorDeclNodeData = { term: TypeConstructorDecl; editable?: boolean; onChange?: (patch: any) => void };

export type NilNodeData = { term: Nil; editable?: boolean; onChange?: (patch: any) => void };
export type ConsNodeData = { term: Cons; editable?: boolean; onChange?: (patch: any) => void };
export type IsNilNodeData = { term: IsNil; editable?: boolean; onChange?: (patch: any) => void };
export type HeadNodeData = { term: Head; editable?: boolean; onChange?: (patch: any) => void };
export type TailNodeData = { term: Tail; editable?: boolean; onChange?: (patch: any) => void };

export type FoldNodeData = { term: Fold; editable?: boolean; onChange?: (patch: any) => void };
export type UnfoldNodeData = { term: Unfold; editable?: boolean; onChange?: (patch: any) => void };

export type ProgramFlowNode = Node<ProgramNodeData, "program">;
export type FunDeclFlowNode = Node<FunDeclNodeData, "funDecl">;
export type VarDeclFlowNode = Node<VarDeclNodeData, "varDecl">;
export type VariableFlowNode = Node<VariableNodeData, "variable">;
export type AbstractionFlowNode = Node<AbstractionNodeData, "abstraction">;
export type ApplicationFlowNode = Node<ApplicationNodeData, "application">;
export type LiteralFlowNode = Node<LiteralNodeData, "literal">;
export type TypeFlowNode = Node<TypeNodeData, "type">;
export type KindFlowNode = Node<KindNodeData, "kind">;
export type InlFlowNode = Node<InlNodeData, "inl">;
export type InrFlowNode = Node<InrNodeData, "inr">;
export type IfConditionFlowNode = Node<IfConditionNodeData, "ifCondition">;
export type CaseFlowNode = Node<CaseNodeData, "case">;
export type VariantCaseFlowNode = Node<VariantCaseNodeData, "variantCase">;
export type VariantFlowNode = Node<VariantNodeData, "variant">;
export type AscribeFlowNode = Node<AscribeNodeData, "ascribe">;
export type TupleProjectionFlowNode = Node<TupleProjectionNodeData, "tupleProjection">;
export type RecordProjectionFlowNode = Node<RecordProjectionNodeData, "recordProjection">;
export type RecordFlowNode = Node<RecordNodeData, "record">;
export type SequencingFlowNode = Node<SequencingNodeData, "sequencing">;
export type TupleFlowNode = Node<TupleNodeData, "tuple">;
export type DummyAbstractionFlowNode = Node<DummyAbstractionNodeData, "dummyAbstraction">;
export type LetFlowNode = Node<LetNodeData, "let">;
export type BinOpFlowNode = Node<BinOpNodeData, "binOp">;
export type FixFlowNode = Node<FixNodeData, "fix">;
export type NblOpFlowNode = Node<NblOpNodeData, "nblOp">;
export type TypeAbsFlowNode = Node<TypeAbsNodeData, "typeAbs">;
export type TypeAppFlowNode = Node<TypeAppNodeData, "typeApp">;
export type TypeAliasDeclFlowNode = Node<TypeAliasDeclNodeData, "typeAliasDecl">;
export type TypeConstructorDeclFlowNode = Node<TypeConstructorDeclNodeData, "typeConstructorDecl">;

export type NilFlowNode = Node<NilNodeData, "nil">;
export type ConsFlowNode = Node<ConsNodeData, "cons">;
export type IsNilFlowNode = Node<IsNilNodeData, "isNil">;
export type HeadFlowNode = Node<HeadNodeData, "headOp">;
export type TailFlowNode = Node<TailNodeData, "tailOp">;

export type FoldFlowNode = Node<FoldNodeData, "fold">;
export type UnfoldFlowNode = Node<UnfoldNodeData, "unfold">;

export type AstFlowNode =
  | ProgramFlowNode
  | FunDeclFlowNode
  | VarDeclFlowNode
  | VariableFlowNode
  | AbstractionFlowNode
  | ApplicationFlowNode
  | LiteralFlowNode
  | TypeFlowNode
  | KindFlowNode
  | InlFlowNode
  | InrFlowNode
  | IfConditionFlowNode
  | CaseFlowNode
  | VariantCaseFlowNode
  | VariantFlowNode
  | AscribeFlowNode
  | TupleProjectionFlowNode
  | RecordProjectionFlowNode
  | RecordFlowNode
  | SequencingFlowNode
  | TupleFlowNode
  | DummyAbstractionFlowNode
  | LetFlowNode
  | BinOpFlowNode
  | FixFlowNode
  | NblOpFlowNode
  | TypeAbsFlowNode
  | TypeAppFlowNode
  | TypeAliasDeclFlowNode
  | TypeConstructorDeclFlowNode
  | NilFlowNode
  | ConsFlowNode
  | IsNilFlowNode
  | HeadFlowNode
  | TailFlowNode
  | FoldFlowNode
  | UnfoldFlowNode;

export type ProgramFlowNodeType = ProgramNodeData;
export type FunDeclFlowNodeType = FunDeclNodeData;
export type VarDeclFlowNodeType = VarDeclNodeData;
export type VariableFlowNodeType = VariableNodeData;
export type AbstractionFlowNodeType = AbstractionNodeData;
export type ApplicationFlowNodeType = ApplicationNodeData;
export type LiteralFlowNodeType = LiteralNodeData;
export type TypeFlowNodeType = TypeNodeData;
export type KindFlowNodeType = KindNodeData;
export type InlFlowNodeType = InlNodeData;
export type InrFlowNodeType = InrNodeData;
export type IfConditionFlowNodeType = IfConditionNodeData;
export type CaseFlowNodeType = CaseNodeData;
export type VariantCaseFlowNodeType = VariantCaseNodeData;
export type VariantFlowNodeType = VariantNodeData;
export type AscribeFlowNodeType = AscribeNodeData;
export type TupleProjectionFlowNodeType = TupleProjectionNodeData;
export type RecordProjectionFlowNodeType = RecordProjectionNodeData;
export type RecordFlowNodeType = RecordNodeData;
export type SequencingFlowNodeType = SequencingNodeData;
export type TupleFlowNodeType = TupleNodeData;
export type DummyAbstractionFlowNodeType = DummyAbstractionNodeData;
export type LetFlowNodeType = LetNodeData;
export type BinOpFlowNodeType = BinOpNodeData;
export type FixFlowNodeType = FixNodeData;
export type TypeAbsFlowNodeType = TypeAbsNodeData;
export type TypeAppFlowNodeType = TypeAppNodeData;
export type TypeAliasDeclFlowNodeType = TypeAliasDeclNodeData;
export type TypeConstructorDeclFlowNodeType = TypeConstructorDeclNodeData;
export type NilFlowNodeType = NilNodeData;
export type ConsFlowNodeType = ConsNodeData;
export type IsNilFlowNodeType = IsNilNodeData;
export type HeadFlowNodeType = HeadNodeData;
export type TailFlowNodeType = TailNodeData;
export type FoldFlowNodeType = FoldNodeData;
export type UnfoldFlowNodeType = UnfoldNodeData;

export type AstFlowGraph = {
  nodes: AstFlowNode[];
  edges: Edge[];
};
